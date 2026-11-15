// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { I18nService } from '../../core/i18n/i18n.service';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { SegmentOption, Segmented } from '../../shared/segmented';
import { LazyVisible } from './lazy-visible';
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  PageItem,
  SOURCE_COLORS,
  dropPosition,
  moveItem,
  normalizeRotation,
} from './page-model';
import { PdfBuilder } from './pdf-engine';
import { baseName, pdfName, splitNames } from './pdf-names';
import { PDF_TOOLS_DICTIONARIES } from './pdf-tools.i18n';
import { PasswordProtectedError, openPdf, renderThumb } from './pdf-thumbs';
import { SplitMode, planSplit } from './split-plan';

interface Source {
  id: number;
  name: string;
  file: File;
  pageCount: number;
  color: number;
  doc: PDFDocumentProxy;
}

type MoveAct = 'before' | 'after';

const pause = () => new Promise<void>((r) => setTimeout(r, 0));

@Component({
  selector: 'app-pdf-tools',
  imports: [Icon, PrivacyNote, FileDrop, Segmented, LazyVisible],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-tools.page.html',
  styleUrl: './pdf-tools.page.scss',
})
export class PdfToolsPage {
  protected readonly i18n = inject(I18nService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly maxFiles = MAX_FILES;

  protected readonly sources = signal<Source[]>([]);
  protected readonly pages = signal<PageItem[]>([]);
  /** Miniature pronte: chiave `fileId:indice` → object URL ('' se il disegno è fallito). */
  protected readonly thumbs = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly notices = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly working = signal(false);
  protected readonly progress = signal('');
  protected readonly result = signal('');
  protected readonly announcement = signal('');

  protected readonly splitMode = signal<SplitMode>('each');
  protected readonly splitEvery = signal(2);
  protected readonly splitRanges = signal('');

  protected readonly dragUid = signal<number | null>(null);
  protected readonly dropOver = signal<{ uid: number; after: boolean } | null>(null);

  private nextSourceId = 1;
  private nextUid = 1;
  private thumbQueue: number[] = [];
  private pumping = false;
  /** Cambia quando si azzera tutto: i disegni in corso di una generazione vecchia vengono scartati. */
  private generation = 0;

  protected readonly splitOptions = computed<SegmentOption<SplitMode>[]>(() => [
    { value: 'each', label: this.i18n.t('pdf.split.each') },
    { value: 'every', label: this.i18n.t('pdf.split.every') },
    { value: 'ranges', label: this.i18n.t('pdf.split.ranges') },
  ]);

  protected readonly sourceById = computed(() => new Map(this.sources().map((s) => [s.id, s])));
  protected readonly selectedCount = computed(() => this.pages().filter((p) => p.selected).length);
  protected readonly allSelected = computed(() => this.pages().length > 0 && this.selectedCount() === this.pages().length);

  protected readonly plan = computed(() =>
    planSplit(this.splitMode(), this.pages().length, { every: this.splitEvery(), ranges: this.splitRanges() }),
  );

  /** Errore di validazione dell'intervallo: mostrato solo quando serve (testo scritto o modalità attiva). */
  protected readonly splitError = computed(() => {
    const p = this.plan();
    if (p.ok) return '';
    const mode = this.splitMode();
    if (mode === 'ranges' && p.error.code === 'empty' && this.splitRanges().trim() === '') return '';
    const e = p.error;
    const fixed = e.token.includes('-') ? e.token.split(/[-–—]/).reverse().join('-') : e.token;
    return this.i18n.t(`pdf.err.${e.code}`, { token: e.token, total: e.total, fixed });
  });

  protected readonly splitCount = computed(() => {
    const p = this.plan();
    if (!p.ok) return '';
    return p.groups.length === 1
      ? this.i18n.t('pdf.split.count.one')
      : this.i18n.t('pdf.split.count', { n: p.groups.length });
  });

  protected readonly canSplit = computed(() => this.plan().ok && !this.working());

  constructor() {
    this.i18n.register(PDF_TOOLS_DICTIONARIES);
    inject(DestroyRef).onDestroy(() => this.releaseAll());
  }

  // ---- caricamento ----
  protected async onFiles(files: File[]): Promise<void> {
    if (!this.isBrowser || this.loading()) return;
    this.loading.set(true);
    const generation = this.generation;
    const notes: string[] = [];
    let added = 0;
    try {
      for (const file of files) {
        if (generation !== this.generation) return;
        const name = file.name;
        if (!/\.pdf$/i.test(name) && file.type !== 'application/pdf') {
          notes.push(this.i18n.t('pdf.err.type', { name }));
        } else if (file.size > MAX_FILE_BYTES) {
          notes.push(this.i18n.t('pdf.err.size', { name }));
        } else if (this.sources().length >= MAX_FILES) {
          notes.push(this.i18n.t('pdf.err.count', { name, max: MAX_FILES }));
        } else {
          try {
            const doc = await openPdf(new Uint8Array(await file.arrayBuffer()));
            if (generation !== this.generation) {
              void doc.loadingTask.destroy();
              return;
            }
            this.addSource(file, doc);
            added += doc.numPages;
          } catch (e) {
            notes.push(this.i18n.t(e instanceof PasswordProtectedError ? 'pdf.err.password' : 'pdf.err.invalid', { name }));
          }
        }
        await pause();
      }
    } finally {
      if (generation === this.generation) {
        this.loading.set(false);
        this.notices.set(notes);
        if (added > 0) this.announce(this.i18n.t('pdf.say.added', { n: added, total: this.pages().length }));
      }
    }
  }

  private addSource(file: File, doc: PDFDocumentProxy): void {
    const id = this.nextSourceId++;
    const used = new Set(this.sources().map((s) => s.color));
    let color = 0;
    while (color < SOURCE_COLORS - 1 && used.has(color)) color++;
    this.sources.update((l) => [...l, { id, name: file.name, file, pageCount: doc.numPages, color, doc }]);
    const items: PageItem[] = Array.from({ length: doc.numPages }, (_, index) => ({
      uid: this.nextUid++,
      sourceId: id,
      index,
      rotation: 0,
      selected: false,
    }));
    this.pages.update((l) => [...l, ...items]);
    this.result.set('');
  }

  protected removeSource(s: Source): void {
    this.dropSource(s.id);
    this.announce(this.i18n.t('pdf.say.removedFile', { name: s.name, total: this.pages().length }));
  }

  /** Toglie un file e tutte le sue pagine, liberando miniature e documento pdf.js. */
  private dropSource(id: number): void {
    const src = this.sources().find((s) => s.id === id);
    if (!src) return;
    const gone = new Set(this.pages().filter((p) => p.sourceId === id).map((p) => p.uid));
    this.thumbQueue = this.thumbQueue.filter((u) => !gone.has(u));
    this.thumbs.update((m) => {
      const next = new Map(m);
      for (const [k, url] of m) {
        if (k.startsWith(`${id}:`)) {
          if (url) URL.revokeObjectURL(url);
          next.delete(k);
        }
      }
      return next;
    });
    this.pages.update((l) => l.filter((p) => p.sourceId !== id));
    this.sources.update((l) => l.filter((s) => s.id !== id));
    void src.doc.loadingTask.destroy();
  }

  protected reset(): void {
    this.releaseAll();
    this.notices.set([]);
    this.result.set('');
    this.progress.set('');
    this.announce(this.i18n.t('pdf.say.reset'));
  }

  private releaseAll(): void {
    this.generation++;
    this.thumbQueue = [];
    for (const url of this.thumbs().values()) if (url) URL.revokeObjectURL(url);
    this.thumbs.set(new Map());
    for (const s of this.sources()) void s.doc.loadingTask.destroy();
    this.sources.set([]);
    this.pages.set([]);
    this.loading.set(false);
  }

  // ---- miniature (una alla volta, solo per le pagine che si avvicinano alla vista) ----
  protected requestThumb(uid: number): void {
    const page = this.pages().find((p) => p.uid === uid);
    if (!page || this.thumbs().has(`${page.sourceId}:${page.index}`) || this.thumbQueue.includes(uid)) return;
    this.thumbQueue.push(uid);
    void this.pump();
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.thumbQueue.length > 0) {
        const uid = this.thumbQueue.shift()!;
        const page = this.pages().find((p) => p.uid === uid);
        const src = page && this.sourceById().get(page.sourceId);
        if (!page || !src) continue;
        const key = `${page.sourceId}:${page.index}`;
        if (this.thumbs().has(key)) continue;
        const generation = this.generation;
        let url = '';
        try {
          const blob = await renderThumb(src.doc, page.index);
          if (blob) url = URL.createObjectURL(blob);
        } catch {
          /* pagina non disegnabile: resta il segnaposto */
        }
        if (generation !== this.generation || !this.sourceById().has(page.sourceId)) {
          if (url) URL.revokeObjectURL(url);
          continue;
        }
        this.thumbs.update((m) => new Map(m).set(key, url));
        await pause(); // lascia respirare l'interfaccia tra una pagina e l'altra
      }
    } finally {
      this.pumping = false;
    }
  }

  protected thumbUrl(p: PageItem): string | undefined {
    return this.thumbs().get(`${p.sourceId}:${p.index}`);
  }

  // ---- operazioni sulle pagine ----
  private pageNo(uid: number): number {
    return this.pages().findIndex((p) => p.uid === uid) + 1;
  }

  protected rotate(p: PageItem, delta: number): void {
    const rotation = normalizeRotation(p.rotation + delta);
    this.pages.update((l) => l.map((x) => (x.uid === p.uid ? { ...x, rotation } : x)));
    this.announce(this.i18n.t('pdf.say.rotated', { n: this.pageNo(p.uid), deg: rotation }));
  }

  protected rotateAll(): void {
    this.pages.update((l) => l.map((x) => ({ ...x, rotation: normalizeRotation(x.rotation + 90) })));
    this.announce(this.i18n.t('pdf.say.rotatedAll'));
  }

  protected toggle(p: PageItem): void {
    this.pages.update((l) => l.map((x) => (x.uid === p.uid ? { ...x, selected: !x.selected } : x)));
  }

  protected toggleAll(): void {
    const on = !this.allSelected();
    this.pages.update((l) => l.map((x) => ({ ...x, selected: on })));
  }

  protected remove(p: PageItem): void {
    const idx = this.pages().findIndex((x) => x.uid === p.uid);
    const key = `${p.sourceId}:${p.index}`;
    this.pages.update((l) => l.filter((x) => x.uid !== p.uid));
    this.thumbQueue = this.thumbQueue.filter((u) => u !== p.uid);
    const url = this.thumbs().get(key);
    if (url) URL.revokeObjectURL(url);
    this.thumbs.update((m) => {
      const next = new Map(m);
      next.delete(key);
      return next;
    });
    // un file senza più pagine non serve: si libera la memoria
    if (!this.pages().some((x) => x.sourceId === p.sourceId)) this.dropSource(p.sourceId);
    this.announce(this.i18n.t('pdf.say.deleted', { total: this.pages().length }));
    // il focus passa alla pagina successiva (o all'ultima) invece di sparire con la carta eliminata
    const nextUid = this.pages()[Math.min(idx, this.pages().length - 1)]?.uid;
    if (nextUid !== undefined) this.focusSoon(nextUid, 'delete');
  }

  protected moveBy(p: PageItem, delta: number, act: MoveAct): void {
    const list = this.pages();
    const from = list.findIndex((x) => x.uid === p.uid);
    const to = Math.max(0, Math.min(list.length - 1, from + delta));
    if (to === from) return;
    this.pages.set(moveItem(list, from, to));
    this.announce(this.i18n.t('pdf.say.moved', { pos: to + 1, total: list.length }));
    this.focusSoon(p.uid, act);
  }

  protected onKey(e: KeyboardEvent, p: PageItem): void {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    if (e.key === 'ArrowLeft') this.moveBy(p, -1, 'before');
    else this.moveBy(p, 1, 'after');
  }

  /** Dopo che Angular ha spostato la carta rimette il focus sul pulsante usato (o su quello opposto se è disabilitato). */
  private focusSoon(uid: number, act: string): void {
    setTimeout(() => {
      const card = this.host.nativeElement.querySelector(`[data-uid="${uid}"]`);
      const pick = (a: string) => card?.querySelector<HTMLButtonElement>(`[data-act="${a}"]`);
      let btn = pick(act);
      if (!btn || btn.disabled) btn = pick(act === 'before' ? 'after' : 'before') ?? pick('rotate');
      btn?.focus();
    }, 0);
  }

  // ---- trascinamento (HTML5 nativo) ----
  protected onDragStart(e: DragEvent, p: PageItem): void {
    this.dragUid.set(p.uid);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(p.uid));
    }
  }

  protected onDragOver(e: DragEvent, p: PageItem): void {
    if (this.dragUid() === null) return; // altro tipo di trascinamento (es. file dal desktop)
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = e.clientX > rect.left + rect.width / 2;
    const cur = this.dropOver();
    if (!cur || cur.uid !== p.uid || cur.after !== after) this.dropOver.set({ uid: p.uid, after });
  }

  protected onDrop(e: DragEvent, p: PageItem): void {
    const dragged = this.dragUid();
    const over = this.dropOver();
    if (dragged === null) return;
    e.preventDefault();
    e.stopPropagation();
    this.endDrag();
    const list = this.pages();
    const from = list.findIndex((x) => x.uid === dragged);
    const overIdx = list.findIndex((x) => x.uid === p.uid);
    if (from < 0 || overIdx < 0) return;
    const to = dropPosition(from, overIdx, over?.uid === p.uid ? over.after : false);
    if (to === from) return;
    this.pages.set(moveItem(list, from, to));
    this.announce(this.i18n.t('pdf.say.moved', { pos: to + 1, total: list.length }));
  }

  protected endDrag(): void {
    this.dragUid.set(null);
    this.dropOver.set(null);
  }

  // ---- esportazione ----
  private builder(): PdfBuilder {
    const byId = this.sourceById();
    return new PdfBuilder(async (id) => new Uint8Array(await byId.get(id)!.file.arrayBuffer()));
  }

  private outPages(list: readonly PageItem[]) {
    return list.map((p) => ({ sourceId: p.sourceId, index: p.index, rotation: p.rotation }));
  }

  private firstBase(): string {
    return baseName(this.sources()[0]?.name ?? '', this.i18n.t('pdf.default.name'));
  }

  /** Il primo file caricato: dà il nome e il titolo ai PDF prodotti. */
  private firstId(): number | undefined {
    return this.sources()[0]?.id;
  }

  private async run(job: () => Promise<void>): Promise<void> {
    if (this.working()) return;
    this.working.set(true);
    this.result.set('');
    this.notices.set([]);
    this.progress.set(this.i18n.t('pdf.working'));
    try {
      await job();
    } catch (e) {
      this.notices.set([this.i18n.t(e instanceof ZipError ? 'pdf.err.zip' : 'pdf.err.build')]);
    } finally {
      this.working.set(false);
      this.progress.set('');
    }
  }

  protected merge(): Promise<void> {
    return this.run(async () => {
      const list = this.pages();
      const builder = this.builder();
      try {
        const name = pdfName(this.firstBase(), this.i18n.t('pdf.suffix.merged'));
        this.saveBytes(await builder.build(this.outPages(list), this.firstId()), name, 'application/pdf');
        this.result.set(this.i18n.t('pdf.done.merge', { name }));
      } finally {
        builder.dispose();
      }
    });
  }

  protected extract(): Promise<void> {
    return this.run(async () => {
      const list = this.pages().filter((p) => p.selected);
      if (list.length === 0) return;
      const builder = this.builder();
      try {
        const name = pdfName(this.firstBase(), this.i18n.t('pdf.suffix.extracted'));
        this.saveBytes(await builder.build(this.outPages(list), this.firstId()), name, 'application/pdf');
        this.result.set(this.i18n.t('pdf.done.extract', { name, n: list.length }));
      } finally {
        builder.dispose();
      }
    });
  }

  protected split(): Promise<void> {
    return this.run(async () => {
      const plan = this.plan();
      if (!plan.ok) return;
      const list = this.pages();
      const base = this.firstBase();
      const names = splitNames(base, plan.groups, list.length, {
        page: this.i18n.t('pdf.word.page'),
        pages: this.i18n.t('pdf.word.pages'),
        part: this.i18n.t('pdf.word.part'),
      });
      const builder = this.builder();
      try {
        const files: Record<string, Uint8Array> = {};
        for (let i = 0; i < plan.groups.length; i++) {
          this.progress.set(this.i18n.t('pdf.working.step', { done: i + 1, total: plan.groups.length }));
          await pause();
          const pages = plan.groups[i].map((pos) => list[pos - 1]);
          files[names[i]] = await builder.build(this.outPages(pages), this.firstId());
        }
        if (names.length === 1) {
          this.saveBytes(files[names[0]], names[0], 'application/pdf');
          this.result.set(this.i18n.t('pdf.done.merge', { name: names[0] }));
          return;
        }
        let zipped: Uint8Array;
        try {
          const { zipSync } = await import('fflate');
          // i PDF sono già compressi: solo archiviazione
          zipped = zipSync(files, { level: 0 });
        } catch {
          throw new ZipError();
        }
        const zipName = `${base}-${this.i18n.t('pdf.suffix.split')}.zip`;
        this.saveBytes(zipped, zipName, 'application/zip');
        this.result.set(this.i18n.t('pdf.done.split', { name: zipName, n: names.length }));
      } finally {
        builder.dispose();
      }
    });
  }

  private saveBytes(data: Uint8Array, name: string, type: string): void {
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ---- testi per il template ----
  private announceFlip = false;
  /** Annuncio per i lettori di schermo; il carattere finale alterna per far rileggere anche un testo identico. */
  private announce(text: string): void {
    this.announceFlip = !this.announceFlip;
    this.announcement.set(this.announceFlip ? text : `${text}\u00a0`);
  }

  protected setEvery(v: string): void {
    this.splitEvery.set(Math.floor(Number(v)));
  }

  protected rotationOf(p: PageItem): number {
    return p.rotation;
  }

  protected sourceName(p: PageItem): string {
    return this.sourceById().get(p.sourceId)?.name ?? '';
  }

  protected sourceColor(p: PageItem): number {
    return this.sourceById().get(p.sourceId)?.color ?? 0;
  }

  protected isDropBefore(p: PageItem): boolean {
    const d = this.dropOver();
    return !!d && d.uid === p.uid && !d.after && this.dragUid() !== p.uid;
  }

  protected isDropAfter(p: PageItem): boolean {
    const d = this.dropOver();
    return !!d && d.uid === p.uid && d.after && this.dragUid() !== p.uid;
  }
}

class ZipError extends Error {}
