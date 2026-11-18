// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, PLATFORM_ID, computed, effect, inject, signal, untracked, viewChild, afterNextRender } from '@angular/core';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { I18nService } from '../../core/i18n/i18n.service';
import { safeFileName, saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { PasswordProtectedError, openPdf } from '../pdf-tools/pdf-thumbs';
import {
  EncryptedPdfError,
  applyPlacements,
  formatDate,
  movePlacement,
  newDate,
  newSignature,
  resizePlacement,
  safeColor,
  scalePlacement,
  type DateStyle,
  type Placement,
  type Stroke,
} from './pdf-sign';
import {
  TYPED_FONTS,
  TYPED_STYLES,
  canvasToSignature,
  drawStrokes,
  imageToCanvas,
  pageRatios,
  renderPage,
  typedCanvas,
  type BuiltSignature,
  type TypedStyle,
} from './pdf-sign-render';
import { PDF_SIGN_DICTIONARIES } from './pdf-sign.i18n';
import { PDFDocument } from 'pdf-lib';
import { ToolHandoff } from '../../shared/tool-handoff';

/** Peso massimo del PDF (il browser deve tenerlo in memoria due volte). */
const MAX_BYTES = 60 * 1024 * 1024;
const PAD_W = 900;
const PAD_H = 300;

interface Sig extends BuiltSignature {
  id: number;
}
type Mode = 'draw' | 'type' | 'image';
type Drag = { kind: 'move' | 'resize'; id: number; x: number; y: number; start: Placement; sw: number; sh: number };

@Component({
  selector: 'app-pdf-sign',
  imports: [FileDrop, Icon, PrivacyNote, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-sign.page.html',
  styleUrl: './pdf-sign.page.scss',
})
export class PdfSignPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly pageCanvas = viewChild<ElementRef<HTMLCanvasElement>>('pageCanvas');
  private readonly padCanvas = viewChild<ElementRef<HTMLCanvasElement>>('pad');

  // ---- documento ----
  private bytes: Uint8Array | null = null;
  private doc: PDFDocumentProxy | null = null;
  protected readonly docName = signal('');
  protected readonly ratios = signal<number[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly status = signal('');
  protected readonly working = signal(false);
  protected readonly pageReady = signal(false);
  protected readonly pageCount = computed(() => this.ratios().length);
  protected readonly pageRatio = computed(() => this.ratios()[this.pageIndex()] ?? 0.7071);
  protected readonly stageStyle = computed(() => ({ 'aspect-ratio': `${this.pageRatio()}` }));

  // ---- firme ----
  protected readonly mode = signal<Mode>('draw');
  protected readonly signatures = signal<Sig[]>([]);
  protected readonly activeSig = signal<number | null>(null);
  protected readonly ink = signal('#1a2a6c');
  protected readonly thickness = signal(3);
  protected readonly typedText = signal('');
  protected readonly typedStyle = signal<TypedStyle>('script');
  protected readonly removeBg = signal(true);
  protected readonly threshold = signal(200);
  protected readonly imageName = signal('');
  protected readonly imagePreview = signal<BuiltSignature | null>(null);
  protected readonly signError = signal('');
  protected readonly strokeCount = signal(0);
  private strokes: Stroke[] = [];
  private currentStroke: Stroke | null = null;
  private readonly imageFileSignal = signal<File | null>(null);
  private nextSig = 1;
  private nextPlacement = 1;

  protected readonly typedStyles = TYPED_STYLES;
  protected readonly typedFonts = TYPED_FONTS;
  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'draw', label: this.i18n.t('sign.mode.draw') },
    { value: 'type', label: this.i18n.t('sign.mode.type') },
    { value: 'image', label: this.i18n.t('sign.mode.image') },
  ]);

  // ---- elementi sulla pagina ----
  protected readonly placements = signal<Placement[]>([]);
  protected readonly selected = signal<number | null>(null);
  protected readonly dateStyle = signal<DateStyle>('numeric');
  protected readonly dateText = signal(formatDate(new Date(), 'numeric', 'it-IT'));
  protected readonly pagePlacements = computed(() => this.placements().filter((p) => p.page === this.pageIndex()));
  protected readonly selectedPlacement = computed(() => this.placements().find((p) => p.id === this.selected()) ?? null);
  protected readonly dateStyles = computed<SegmentOption<DateStyle>[]>(() => [
    { value: 'numeric', label: this.i18n.t('sign.date.numeric') },
    { value: 'iso', label: this.i18n.t('sign.date.iso') },
    { value: 'long', label: this.i18n.t('sign.date.long') },
  ]);
  private drag: Drag | null = null;

  constructor() {
    this.i18n.register(PDF_SIGN_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('pdf-sign');
    if (rx?.files?.length) afterNextRender(() => void this.onPdf(rx.files![0]));
    inject(DestroyRef).onDestroy(() => {
      void this.doc?.loadingTask.destroy();
      for (const s of this.signatures()) URL.revokeObjectURL(s.url);
    });
    // disegna la pagina corrente (quando il documento e il canvas sono pronti)
    effect(() => {
      const idx = this.pageIndex();
      const ready = this.ratios().length > 0;
      const canvas = this.pageCanvas()?.nativeElement;
      if (!this.browser || !ready || !canvas || !this.doc) return;
      untracked(async () => {
        this.pageReady.set(false);
        try {
          if (await renderPage(this.doc!, idx, canvas)) this.pageReady.set(true);
        } catch {
          this.error.set(this.i18n.t('sign.err.render'));
        }
      });
    });
    // il canvas del tratto compare dopo il caricamento del PDF: lo ridisegna con i tratti già fatti
    effect(() => {
      const pad = this.padCanvas()?.nativeElement;
      if (this.browser && pad) untracked(() => this.redrawPad());
    });
    // anteprima della firma da immagine
    effect(() => {
      const rm = this.removeBg();
      const th = this.threshold();
      const file = this.imageFileSignal();
      if (!this.browser || !file) return;
      untracked(() => void this.buildImagePreview(file, rm, th));
    });
  }

  // ======== documento ========
  protected async onPdf(file: File): Promise<void> {
    this.error.set('');
    this.status.set('');
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      this.error.set(this.i18n.t('sign.err.notPdf', { name: file.name }));
      return;
    }
    if (file.size > MAX_BYTES) {
      this.error.set(this.i18n.t('sign.err.tooBig', { name: file.name }));
      return;
    }
    this.loading.set(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // pdf.js prende in carico i byte che riceve: gli passo una copia
      const doc = await openPdf(bytes.slice());
      // alcuni PDF si aprono con la password vuota ma sono cifrati: pdf-lib non sa riscriverli
      try {
        await PDFDocument.load(bytes, { updateMetadata: false });
      } catch (e) {
        void doc.loadingTask.destroy();
        throw (e as Error)?.name === 'EncryptedPDFError' || /encrypt/i.test((e as Error)?.message ?? '') ? new PasswordProtectedError() : e;
      }
      const ratios = await pageRatios(doc);
      void this.doc?.loadingTask.destroy();
      this.doc = doc;
      this.bytes = bytes;
      this.docName.set(file.name);
      this.placements.set([]);
      this.selected.set(null);
      this.pageIndex.set(0);
      this.ratios.set(ratios);
    } catch (e) {
      this.error.set(this.i18n.t(e instanceof PasswordProtectedError ? 'sign.err.encrypted' : 'sign.err.invalid', { name: file.name }));
    } finally {
      this.loading.set(false);
    }
  }

  protected goTo(index: number): void {
    const n = this.pageCount();
    if (n === 0) return;
    this.pageIndex.set(Math.min(n - 1, Math.max(0, Math.round(index))));
    this.selected.set(null);
  }
  protected onPageInput(v: string, input: HTMLInputElement): void {
    const n = Number(v);
    if (Number.isFinite(n)) this.goTo(n - 1);
    input.value = String(this.pageIndex() + 1);
  }

  // ======== creazione firma ========
  private addSignature(b: BuiltSignature): void {
    const sig: Sig = { ...b, id: this.nextSig++ };
    this.signatures.update((l) => [...l, sig]);
    this.activeSig.set(sig.id);
    this.signError.set('');
  }
  protected removeSignature(id: number): void {
    const s = this.signatures().find((x) => x.id === id);
    if (!s) return;
    URL.revokeObjectURL(s.url);
    this.signatures.update((l) => l.filter((x) => x.id !== id));
    this.placements.update((l) => l.filter((p) => p.sigId !== id));
    if (this.selected() !== null && !this.placements().some((p) => p.id === this.selected())) this.selected.set(null);
    if (this.activeSig() === id) this.activeSig.set(this.signatures()[0]?.id ?? null);
  }

  // -- disegno --
  private redrawPad(): void {
    const pad = this.padCanvas()?.nativeElement;
    if (pad) drawStrokes(pad, this.strokes, 1.5);
  }
  private padPoint(e: PointerEvent): { x: number; y: number; p: number } {
    const pad = this.padCanvas()!.nativeElement;
    const r = pad.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * PAD_W, y: ((e.clientY - r.top) / r.height) * PAD_H, p: e.pressure > 0 ? e.pressure : 0.5 };
  }
  protected padDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.currentStroke = { points: [this.padPoint(e)], width: this.thickness(), color: safeColor(this.ink()), pen: e.pointerType === 'pen' };
    this.strokes.push(this.currentStroke);
    this.strokeCount.set(this.strokes.length);
    this.redrawPad();
  }
  protected padMove(e: PointerEvent): void {
    if (!this.currentStroke) return;
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) this.currentStroke.points.push(this.padPoint(ev));
    this.redrawPad();
  }
  protected padUp(): void {
    this.currentStroke = null;
  }
  protected undoStroke(): void {
    this.strokes.pop();
    this.strokeCount.set(this.strokes.length);
    this.redrawPad();
  }
  protected clearPad(): void {
    this.strokes = [];
    this.strokeCount.set(0);
    this.redrawPad();
  }
  protected async useDrawn(): Promise<void> {
    const pad = this.padCanvas()?.nativeElement;
    const built = pad && this.strokes.length ? await canvasToSignature(pad) : null;
    if (!built) {
      this.signError.set(this.i18n.t('sign.err.emptyDraw'));
      return;
    }
    this.addSignature(built);
    this.clearPad();
  }

  // -- digitata --
  protected async useTyped(): Promise<void> {
    const text = this.typedText().trim();
    if (!text) {
      this.signError.set(this.i18n.t('sign.err.emptyType'));
      return;
    }
    const built = await canvasToSignature(typedCanvas(text, this.typedStyle(), safeColor(this.ink())));
    if (!built) {
      this.signError.set(this.i18n.t('sign.err.emptyType'));
      return;
    }
    this.addSignature(built);
  }

  // -- immagine --
  protected onImage(file: File): void {
    this.signError.set('');
    if (!file.type.startsWith('image/')) {
      this.signError.set(this.i18n.t('sign.err.notImage'));
      return;
    }
    this.imageName.set(file.name);
    this.imageFileSignal.set(file);
  }
  private async buildImagePreview(file: File, removeBg: boolean, threshold: number): Promise<void> {
    try {
      const built = await canvasToSignature(await imageToCanvas(file, removeBg, threshold));
      const old = this.imagePreview();
      if (old) URL.revokeObjectURL(old.url);
      this.imagePreview.set(built);
      if (!built) this.signError.set(this.i18n.t('sign.err.emptyImage'));
      else this.signError.set('');
    } catch {
      this.imagePreview.set(null);
      this.signError.set(this.i18n.t('sign.err.imageDecode', { name: file.name }));
    }
  }
  protected useImage(): void {
    const prev = this.imagePreview();
    if (!prev) return;
    // la miniatura diventa firma: serve un URL tutto suo, quello dell'anteprima verrà rilasciato
    const url = URL.createObjectURL(new Blob([prev.png as BlobPart], { type: 'image/png' }));
    this.addSignature({ ...prev, url });
  }

  // ======== elementi sulla pagina ========
  protected sigById(id: number | undefined): Sig | undefined {
    return this.signatures().find((s) => s.id === id);
  }
  private aspectOf(p: Placement): number {
    return p.kind === 'signature' ? (this.sigById(p.sigId)?.aspect ?? 1) : 1;
  }
  private update(id: number, fn: (p: Placement) => Placement): void {
    this.placements.update((l) => l.map((p) => (p.id === id ? fn(p) : p)));
  }

  protected addSignatureToPage(): void {
    const sig = this.sigById(this.activeSig() ?? -1);
    if (!sig) return;
    const p = newSignature(this.nextPlacement++, this.pageIndex(), sig.id, sig.aspect, this.pageRatio());
    this.placements.update((l) => [...l, p]);
    this.selected.set(p.id);
  }
  protected setDateStyle(style: DateStyle): void {
    this.dateStyle.set(style);
    this.dateText.set(formatDate(new Date(), style, this.i18n.locale()));
  }
  protected addDateToPage(): void {
    const text = this.dateText().trim();
    if (!text) return;
    const p = newDate(this.nextPlacement++, this.pageIndex(), text, this.pageRatio());
    this.placements.update((l) => [...l, p]);
    this.selected.set(p.id);
  }
  protected removePlacement(id: number): void {
    this.placements.update((l) => l.filter((p) => p.id !== id));
    if (this.selected() === id) this.selected.set(null);
  }
  /** Copia l'elemento selezionato nella stessa posizione di tutte le altre pagine (utile per sigle e date). */
  protected copyToAll(): void {
    const p = this.selectedPlacement();
    if (!p) return;
    const copies: Placement[] = [];
    this.ratios().forEach((ratio, i) => {
      if (i === p.page || this.placements().some((o) => o.page === i && o.kind === p.kind && o.sigId === p.sigId && Math.abs(o.x - p.x) < 1e-6 && Math.abs(o.y - p.y) < 1e-6)) return;
      // le pagine possono avere proporzioni diverse: l'altezza segue il rapporto di quella pagina
      const h = p.kind === 'signature' ? (p.w * ratio) / this.aspectOf(p) : p.h;
      copies.push({ ...p, id: this.nextPlacement++, page: i, h });
    });
    this.placements.update((l) => [...l, ...copies]);
    this.status.set(this.i18n.t('sign.copied', { n: copies.length }));
  }
  protected scaleSelected(factor: number): void {
    const p = this.selectedPlacement();
    if (p) this.update(p.id, (q) => scalePlacement(q, factor, this.pageRatio(), this.aspectOf(q)));
  }

  protected itemLabel(p: Placement): string {
    const n = this.placements().filter((x) => x.kind === p.kind && x.page === p.page).findIndex((x) => x.id === p.id) + 1;
    return this.i18n.t(p.kind === 'signature' ? 'sign.item.sig' : 'sign.item.date', { n, page: p.page + 1 });
  }

  protected select(id: number): void {
    this.selected.set(id);
  }
  protected onItemDown(e: PointerEvent, p: Placement, kind: 'move' | 'resize'): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const stage = (e.currentTarget as HTMLElement).closest('.stage') as HTMLElement | null;
    if (!stage) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const r = stage.getBoundingClientRect();
    this.selected.set(p.id);
    (e.currentTarget as HTMLElement).closest<HTMLElement>('.item')?.focus();
    this.drag = { kind, id: p.id, x: e.clientX, y: e.clientY, start: p, sw: r.width, sh: r.height };
  }
  protected onItemMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const dx = (e.clientX - d.x) / d.sw;
    const dy = (e.clientY - d.y) / d.sh;
    const ratio = this.pageRatio();
    if (d.kind === 'move') this.update(d.id, () => movePlacement(d.start, dx, dy, ratio));
    else this.update(d.id, () => resizePlacement(d.start, d.start.kind === 'date' ? d.start.h + dy : d.start.w + dx, ratio, this.aspectOf(d.start)));
  }
  protected onItemUp(): void {
    this.drag = null;
  }
  protected onItemKey(e: KeyboardEvent, p: Placement): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const step = e.shiftKey ? 0.02 : 0.005;
    const ratio = this.pageRatio();
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (e.key in arrows) {
      e.preventDefault();
      const [dx, dy] = arrows[e.key];
      this.update(p.id, (q) => movePlacement(q, dx, dy * ratio, ratio));
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      this.update(p.id, (q) => scalePlacement(q, 1.08, ratio, this.aspectOf(q)));
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      this.update(p.id, (q) => scalePlacement(q, 1 / 1.08, ratio, this.aspectOf(q)));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.removePlacement(p.id);
    }
  }
  protected clearSelection(): void {
    this.selected.set(null);
  }

  // ======== esportazione ========
  protected async download(): Promise<void> {
    if (!this.bytes || this.placements().length === 0 || this.working()) return;
    this.working.set(true);
    this.error.set('');
    try {
      const images = new Map(this.signatures().map((s) => [s.id, { png: s.png }]));
      const out = await applyPlacements(this.bytes, images, this.placements());
      const base = safeFileName(this.docName().replace(/\.pdf$/i, ''), 'documento');
      const name = `${base}-${this.i18n.lang() === 'en' ? 'signed' : 'firmato'}.pdf`;
      saveBytes(out, name, 'application/pdf');
      this.status.set(this.i18n.t('sign.done', { name, n: this.placements().length }));
    } catch (e) {
      this.error.set(this.i18n.t(e instanceof EncryptedPdfError ? 'sign.err.encrypted' : 'sign.err.export', { name: this.docName() }));
    } finally {
      this.working.set(false);
    }
  }
}
