// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { I18nService } from '../../core/i18n/i18n.service';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { SegmentOption, Segmented } from '../../shared/segmented';
import { dropPosition, moveItem } from '../pdf-tools/page-model';
import { parseRanges, rangePages } from '../pdf-tools/page-ranges';
import { baseName } from '../pdf-tools/pdf-names';
import { PasswordProtectedError, openPdf } from '../pdf-tools/pdf-thumbs';
import { IMAGES_PDF_DICTIONARIES } from './images-pdf.i18n';
import { inspectImage, isHeic, isSupportedImage, prepareImage } from './image-prepare';
import { buildImagesPdf } from './pdf-build';
import { MARGINS_MM, Orientation, PageFormat, PerPage, pageCount } from './pdf-layout';
import { DPIS, Dpi, MAX_PAGES, OutFormat, imageName, renderPageImage } from './pdf-render';
import { ToolHandoff } from '../../shared/tool-handoff';

export type Mode = 'images-to-pdf' | 'pdf-to-images';

const MAX_IMAGES = 100;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_PDF_BYTES = 100 * 1024 * 1024;
const pause = () => new Promise<void>((r) => setTimeout(r, 0));

interface Item {
  uid: number;
  file: File;
  name: string;
  width: number;
  height: number;
  thumb: string;
}

interface Result {
  page: number;
  name: string;
  blob: Blob;
  thumb: string;
  size: number;
}

interface PdfSource {
  name: string;
  base: string;
  pageCount: number;
  doc: PDFDocumentProxy;
}

type MoveAct = 'before' | 'after';

@Component({
  selector: 'app-images-pdf',
  imports: [Icon, PrivacyNote, FileDrop, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './images-pdf.page.html',
  styleUrl: './images-pdf.page.scss',
})
export class ImagesPdfPage {
  protected readonly i18n = inject(I18nService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** La modalità arriva dalla route (/images-to-pdf o /pdf-to-images). */
  protected readonly mode: Mode = (inject(ActivatedRoute).snapshot.data['mode'] as Mode | undefined) ?? 'images-to-pdf';
  protected readonly maxImages = MAX_IMAGES;
  protected readonly maxPages = MAX_PAGES;
  protected readonly margins = MARGINS_MM;
  protected readonly dpis = DPIS;

  protected readonly notices = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly progress = signal('');
  protected readonly result = signal('');
  protected readonly announcement = signal('');

  // ---- immagini -> PDF ----
  protected readonly items = signal<Item[]>([]);
  protected readonly format = signal<PageFormat>('a4');
  protected readonly orientation = signal<Orientation>('auto');
  protected readonly margin = signal(10);
  protected readonly perPage = signal<PerPage>(1);
  protected readonly quality = signal(100);
  protected readonly dragUid = signal<number | null>(null);
  protected readonly dropOver = signal<{ uid: number; after: boolean } | null>(null);
  private nextUid = 1;

  // ---- PDF -> immagini ----
  protected readonly pdf = signal<PdfSource | null>(null);
  protected readonly pageMode = signal<'all' | 'range'>('all');
  protected readonly rangeText = signal('');
  protected readonly outFormat = signal<OutFormat>('png');
  protected readonly dpi = signal<Dpi>(150);
  protected readonly results = signal<Result[]>([]);

  protected readonly modeOptions = computed<SegmentOption<Mode>[]>(() => [
    { value: 'images-to-pdf', label: this.i18n.t('ip.mode.toPdf') },
    { value: 'pdf-to-images', label: this.i18n.t('ip.mode.toImages') },
  ]);
  protected readonly formatOptions = computed<SegmentOption<PageFormat>[]>(() => [
    { value: 'a4', label: this.i18n.t('ip.format.a4') },
    { value: 'letter', label: this.i18n.t('ip.format.letter') },
    { value: 'fit', label: this.i18n.t('ip.format.fit') },
  ]);
  protected readonly orientationOptions = computed<SegmentOption<Orientation>[]>(() => [
    { value: 'auto', label: this.i18n.t('ip.orientation.auto') },
    { value: 'portrait', label: this.i18n.t('ip.orientation.portrait') },
    { value: 'landscape', label: this.i18n.t('ip.orientation.landscape') },
  ]);
  protected readonly perPageOptions: SegmentOption<'1' | '2' | '4'>[] = [
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '4', label: '4' },
  ];
  protected readonly outFormatOptions: SegmentOption<OutFormat>[] = [
    { value: 'png', label: 'PNG' },
    { value: 'jpeg', label: 'JPEG' },
  ];
  protected readonly pageModeOptions = computed<SegmentOption<'all' | 'range'>[]>(() => [
    { value: 'all', label: this.i18n.t('ip.pages.all') },
    { value: 'range', label: this.i18n.t('ip.pages.range') },
  ]);

  protected readonly perPageValue = computed(() => String(this.perPage()) as '1' | '2' | '4');
  protected readonly effectivePerPage = computed<PerPage>(() => (this.format() === 'fit' ? 1 : this.perPage()));
  protected readonly pagesTotal = computed(() => pageCount(this.items().length, this.perPage(), this.format()));
  protected readonly summary = computed(() => {
    const n = this.items().length;
    return n === 1 ? this.i18n.t('ip.summary.one') : this.i18n.t('ip.summary', { n, pages: this.pagesTotal() });
  });

  /** Pagine scelte (da 1) oppure l'errore di validazione. */
  protected readonly selection = computed<{ pages: number[]; error: string }>(() => {
    const src = this.pdf();
    if (!src) return { pages: [], error: '' };
    if (this.pageMode() === 'all') return { pages: Array.from({ length: src.pageCount }, (_, i) => i + 1), error: '' };
    const text = this.rangeText();
    const parsed = parseRanges(text, src.pageCount);
    if (!parsed.ok) {
      if (parsed.error.code === 'empty' && text.trim() === '') return { pages: [], error: '' };
      const e = parsed.error;
      const fixed = e.token.includes('-') ? e.token.split(/[-–—]/).reverse().join('-') : e.token;
      return { pages: [], error: this.i18n.t(`ip.err.${e.code}`, { token: e.token, total: e.total, fixed }) };
    }
    const unique = [...new Set(parsed.ranges.flatMap(rangePages))];
    return { pages: unique, error: '' };
  });
  protected readonly tooMany = computed(() => {
    const n = this.selection().pages.length;
    return n > MAX_PAGES ? this.i18n.t('ip.err.tooMany', { max: MAX_PAGES, n }) : '';
  });
  protected readonly canConvert = computed(
    () => !this.busy() && this.selection().pages.length > 0 && !this.selection().error && !this.tooMany(),
  );
  protected readonly selectionCount = computed(() => {
    const n = this.selection().pages.length;
    return n === 1 ? this.i18n.t('ip.pages.count.one') : this.i18n.t('ip.pages.count', { n });
  });
  protected readonly pdfLabel = computed(() => {
    const s = this.pdf();
    return s ? this.i18n.t(s.pageCount === 1 ? 'ip.pdf.loaded.one' : 'ip.pdf.loaded', { name: s.name, n: s.pageCount }) : '';
  });

  constructor() {
    this.i18n.register(IMAGES_PDF_DICTIONARIES);
    // immagini ricevute da un altro strumento: stessa strada del file-drop
    // (l'id dello strumento coincide con la modalità: 'images-to-pdf' o 'pdf-to-images')
    const rx = inject(ToolHandoff).take(this.mode);
    if (rx?.files?.length) {
      afterNextRender(() => void (this.mode === 'images-to-pdf' ? this.onImages(rx.files!) : this.onPdf(rx.files![0])));
    }
    inject(DestroyRef).onDestroy(() => {
      this.releaseItems();
      this.releaseResults();
      void this.pdf()?.doc.loadingTask.destroy();
    });
  }

  protected get toPdf(): boolean {
    return this.mode === 'images-to-pdf';
  }

  protected goMode(m: Mode): void {
    if (m !== this.mode) void this.router.navigateByUrl(this.i18n.link(m === 'images-to-pdf' ? 'images-to-pdf' : 'pdf-to-images'));
  }

  private announceFlip = false;
  private announce(text: string): void {
    this.announceFlip = !this.announceFlip;
    this.announcement.set(this.announceFlip ? text : `${text} `);
  }

  // ======================= immagini -> PDF =======================
  protected async onImages(files: File[]): Promise<void> {
    if (!this.isBrowser || this.busy()) return;
    this.busy.set(true);
    const notes: string[] = [];
    let added = 0;
    try {
      for (const file of files) {
        const name = file.name;
        if (isHeic(file)) notes.push(this.i18n.t('ip.err.heic', { name }));
        else if (!isSupportedImage(file)) notes.push(this.i18n.t('ip.err.type', { name }));
        else if (file.size > MAX_IMAGE_BYTES) notes.push(this.i18n.t('ip.err.size', { name }));
        else if (this.items().length >= MAX_IMAGES) notes.push(this.i18n.t('ip.err.count', { name, max: MAX_IMAGES }));
        else {
          try {
            const info = await inspectImage(file);
            this.items.update((l) => [...l, { uid: this.nextUid++, file, name, width: info.width, height: info.height, thumb: info.thumbUrl }]);
            added++;
          } catch {
            notes.push(this.i18n.t('ip.err.decode', { name }));
          }
        }
        await pause();
      }
    } finally {
      this.busy.set(false);
      this.notices.set(notes);
      this.result.set('');
      if (added > 0) this.announce(this.i18n.t('ip.say.added', { n: added, total: this.items().length }));
    }
  }

  protected removeItem(it: Item): void {
    const list = this.items();
    const idx = list.findIndex((x) => x.uid === it.uid);
    URL.revokeObjectURL(it.thumb);
    this.items.set(list.filter((x) => x.uid !== it.uid));
    this.result.set('');
    this.announce(this.i18n.t('ip.say.removed', { total: this.items().length }));
    const next = this.items()[Math.min(idx, this.items().length - 1)]?.uid;
    if (next !== undefined) this.focusSoon(next, 'remove');
  }

  protected clearItems(): void {
    this.releaseItems();
    this.notices.set([]);
    this.result.set('');
    this.announce(this.i18n.t('ip.say.cleared'));
  }

  private releaseItems(): void {
    for (const it of this.items()) URL.revokeObjectURL(it.thumb);
    this.items.set([]);
  }

  protected moveBy(it: Item, delta: number, act: MoveAct): void {
    const list = this.items();
    const from = list.findIndex((x) => x.uid === it.uid);
    const to = Math.max(0, Math.min(list.length - 1, from + delta));
    if (to === from) return;
    this.items.set(moveItem(list, from, to));
    this.result.set('');
    this.announce(this.i18n.t('ip.say.moved', { pos: to + 1, total: list.length }));
    this.focusSoon(it.uid, act);
  }

  protected onKey(e: KeyboardEvent, it: Item): void {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    this.moveBy(it, e.key === 'ArrowLeft' ? -1 : 1, e.key === 'ArrowLeft' ? 'before' : 'after');
  }

  private focusSoon(uid: number, act: string): void {
    setTimeout(() => {
      const card = this.host.nativeElement.querySelector(`[data-uid="${uid}"]`);
      const pick = (a: string) => card?.querySelector<HTMLButtonElement>(`[data-act="${a}"]`);
      let btn = pick(act);
      if (!btn || btn.disabled) btn = pick(act === 'before' ? 'after' : 'before') ?? pick('remove');
      btn?.focus();
    }, 0);
  }

  protected onDragStart(e: DragEvent, it: Item): void {
    this.dragUid.set(it.uid);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(it.uid));
    }
  }

  protected onDragOver(e: DragEvent, it: Item): void {
    if (this.dragUid() === null) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = e.clientX > rect.left + rect.width / 2;
    const cur = this.dropOver();
    if (!cur || cur.uid !== it.uid || cur.after !== after) this.dropOver.set({ uid: it.uid, after });
  }

  protected onDrop(e: DragEvent, it: Item): void {
    const dragged = this.dragUid();
    const over = this.dropOver();
    if (dragged === null) return;
    e.preventDefault();
    e.stopPropagation();
    this.endDrag();
    const list = this.items();
    const from = list.findIndex((x) => x.uid === dragged);
    const overIdx = list.findIndex((x) => x.uid === it.uid);
    if (from < 0 || overIdx < 0) return;
    const to = dropPosition(from, overIdx, over?.uid === it.uid ? over.after : false);
    if (to === from) return;
    this.items.set(moveItem(list, from, to));
    this.result.set('');
    this.announce(this.i18n.t('ip.say.moved', { pos: to + 1, total: list.length }));
  }

  protected endDrag(): void {
    this.dragUid.set(null);
    this.dropOver.set(null);
  }

  protected isDropBefore(it: Item): boolean {
    const d = this.dropOver();
    return !!d && d.uid === it.uid && !d.after && this.dragUid() !== it.uid;
  }

  protected isDropAfter(it: Item): boolean {
    const d = this.dropOver();
    return !!d && d.uid === it.uid && d.after && this.dragUid() !== it.uid;
  }

  protected setPerPage(v: '1' | '2' | '4'): void {
    this.perPage.set(Number(v) as PerPage);
  }

  protected setMargin(v: string): void {
    this.margin.set(Number(v));
  }

  protected setDpi(v: string): void {
    this.dpi.set(Number(v) as Dpi);
  }

  protected setQuality(v: string): void {
    this.quality.set(Math.max(30, Math.min(100, Number(v))));
  }

  protected async createPdf(): Promise<void> {
    if (this.busy() || this.items().length === 0) return;
    this.busy.set(true);
    this.result.set('');
    this.notices.set([]);
    const list = this.items();
    const q = this.quality();
    try {
      const sizes = list.map((i) => ({ width: i.width, height: i.height }));
      const bytes = await buildImagesPdf(
        sizes,
        async (i) => {
          await pause();
          return prepareImage(list[i].file, q, sizes[i]);
        },
        { format: this.format(), orientation: this.orientation(), marginMm: this.margin(), perPage: this.effectivePerPage() },
        (done, total) => this.progress.set(this.i18n.t('ip.working', { done, total })),
      );
      const name = `${this.i18n.t('ip.default.pdf')}.pdf`;
      saveBytes(bytes, name, 'application/pdf');
      this.result.set(
        this.i18n.t('ip.done.pdf', { name, pages: this.pagesTotal(), size: this.formatSize(bytes.length) }),
      );
    } catch {
      this.notices.set([this.i18n.t('ip.err.build')]);
    } finally {
      this.busy.set(false);
      this.progress.set('');
    }
  }

  // ======================= PDF -> immagini =======================
  protected async onPdf(file: File): Promise<void> {
    if (!this.isBrowser || this.busy()) return;
    const name = file.name;
    this.notices.set([]);
    if (!/\.pdf$/i.test(name) && file.type !== 'application/pdf') {
      this.notices.set([this.i18n.t('ip.err.pdfType', { name })]);
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      this.notices.set([this.i18n.t('ip.err.pdfSize', { name })]);
      return;
    }
    this.busy.set(true);
    this.progress.set(this.i18n.t('ip.pdf.loading'));
    try {
      const doc = await openPdf(new Uint8Array(await file.arrayBuffer()));
      void this.pdf()?.doc.loadingTask.destroy();
      this.releaseResults();
      this.pdf.set({
        name,
        base: baseName(name, this.i18n.t('ip.default.name')),
        pageCount: doc.numPages,
        doc,
      });
      this.pageMode.set('all');
      this.rangeText.set('');
      this.result.set('');
      this.announce(this.i18n.t('ip.say.pdfLoaded', { n: doc.numPages }));
    } catch (e) {
      this.notices.set([this.i18n.t(e instanceof PasswordProtectedError ? 'ip.err.password' : 'ip.err.pdfInvalid', { name })]);
    } finally {
      this.busy.set(false);
      this.progress.set('');
    }
  }

  protected closePdf(): void {
    void this.pdf()?.doc.loadingTask.destroy();
    this.pdf.set(null);
    this.releaseResults();
    this.notices.set([]);
    this.result.set('');
    this.announce(this.i18n.t('ip.say.cleared'));
  }

  private releaseResults(): void {
    for (const r of this.results()) URL.revokeObjectURL(r.thumb);
    this.results.set([]);
  }

  protected async convert(): Promise<void> {
    const src = this.pdf();
    if (!src || !this.canConvert()) return;
    this.busy.set(true);
    this.notices.set([]);
    this.result.set('');
    this.releaseResults();
    const pages = this.selection().pages;
    const fmt = this.outFormat();
    const dpi = this.dpi();
    const word = this.i18n.t('ip.word.page');
    const out: Result[] = [];
    let reduced = false;
    try {
      for (let i = 0; i < pages.length; i++) {
        this.progress.set(this.i18n.t('ip.converting', { done: i + 1, total: pages.length }));
        await pause();
        try {
          const r = await renderPageImage(src.doc, pages[i] - 1, dpi, fmt);
          reduced ||= r.reduced;
          out.push({
            page: pages[i],
            name: imageName(src.base, word, pages[i], src.pageCount, fmt),
            blob: r.blob,
            thumb: URL.createObjectURL(r.thumb),
            size: r.blob.size,
          });
          this.results.set([...out]);
        } catch {
          this.notices.update((l) => [...l, this.i18n.t('ip.err.render', { n: pages[i] })]);
        }
      }
      const done = [this.i18n.t('ip.done.images', { n: out.length })];
      if (reduced) done.push(this.i18n.t('ip.reduced'));
      this.result.set(done.join(' '));
    } finally {
      this.busy.set(false);
      this.progress.set('');
    }
  }

  protected downloadResult(r: Result): void {
    saveBytes(r.blob, r.name, r.blob.type);
  }

  protected async downloadZip(): Promise<void> {
    const src = this.pdf();
    if (!src || this.busy()) return;
    this.busy.set(true);
    try {
      const { zipSync } = await import('fflate');
      const files: Record<string, Uint8Array> = {};
      for (const r of this.results()) files[r.name] = new Uint8Array(await r.blob.arrayBuffer());
      // PNG e JPEG sono già compressi: solo archiviazione
      saveBytes(zipSync(files, { level: 0 }), `${src.base}-${this.i18n.t('ip.zip.name')}.zip`, 'application/zip');
    } catch {
      this.notices.set([this.i18n.t('ip.err.zip')]);
    } finally {
      this.busy.set(false);
    }
  }

  protected formatSize(n: number): string {
    const nf = new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 1 });
    if (n < 1024 * 1024) return `${nf.format(n / 1024)} KB`;
    return `${nf.format(n / 1024 / 1024)} MB`;
  }

  protected itemIndex(it: Item): number {
    return this.items().findIndex((x) => x.uid === it.uid);
  }
}
