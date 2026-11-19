// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { I18nService } from '../../core/i18n/i18n.service';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { formatBytes } from '../../shared/text-stats';
import { LoadedPdf, downloadPdf } from '../pdf-common/pdf-file';
import { PdfSource } from '../pdf-common/pdf-source';
import { openPdf } from '../pdf-tools/pdf-thumbs';
import { Areas, Rect, countAreas, rectFromDrag, textHits } from './pdf-redact';
import { ImageFormat, pageText, redactPdf, renderPage } from './pdf-redact-browser';
import { PDF_REDACT_DICTIONARIES } from './pdf-redact.i18n';

const VIEW_WIDTH = 720;

@Component({
  selector: 'app-pdf-redact',
  imports: [Icon, PrivacyNote, PdfSource],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-redact.page.html',
  styleUrl: './pdf-redact.page.scss',
})
export class PdfRedactPage {
  protected readonly i18n = inject(I18nService);
  private readonly view = viewChild<ElementRef<HTMLCanvasElement>>('view');
  protected readonly dpis: readonly number[] = [100, 150, 200, 300];
  protected readonly pdf = signal<LoadedPdf | null>(null);
  private doc: PDFDocumentProxy | null = null;
  protected readonly index = signal(0);
  private readonly areas = signal<Areas>({});
  protected readonly dpi = signal(150);
  protected readonly format = signal<ImageFormat>('jpeg');
  protected readonly query = signal('');
  protected readonly searchNote = signal('');
  protected readonly searching = signal(false);
  protected readonly busy = signal(false);
  protected readonly progress = signal('');
  protected readonly error = signal('');
  protected readonly done = signal('');
  protected readonly dragRect = signal<Rect | null>(null);
  private dragStart: { x: number; y: number } | null = null;

  protected readonly pageAreas = computed(() => this.areas()[this.index()] ?? []);
  protected readonly totals = computed(() => countAreas(this.areas()));

  constructor() {
    this.i18n.register(PDF_REDACT_DICTIONARIES);
    inject(DestroyRef).onDestroy(() => void this.doc?.loadingTask.destroy());
    // ridisegna la pagina quando cambia il documento, la pagina o il canvas è pronto
    effect(() => {
      const idx = this.index();
      const el = this.view()?.nativeElement;
      if (this.pdf() && el && this.doc) void renderPage(this.doc, idx, el, VIEW_WIDTH);
    });
  }

  protected async onLoaded(p: LoadedPdf): Promise<void> {
    void this.doc?.loadingTask.destroy();
    this.doc = null;
    this.areas.set({});
    this.index.set(0);
    this.error.set('');
    this.done.set('');
    this.searchNote.set('');
    try {
      this.doc = await openPdf(p.bytes.slice());
      this.pdf.set(p);
    } catch {
      this.pdf.set(null);
      this.error.set(this.i18n.t('pc.err.invalid'));
    }
  }

  protected onCleared(): void {
    void this.doc?.loadingTask.destroy();
    this.doc = null;
    this.pdf.set(null);
  }

  protected go(i: number): void {
    const n = this.pdf()?.pages ?? 1;
    this.index.set(Math.max(0, Math.min(n - 1, Math.floor(i) || 0)));
  }

  // ---- disegno delle aree ----
  private point(e: PointerEvent): { x: number; y: number } {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  protected down(e: PointerEvent): void {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    this.dragStart = this.point(e);
    this.dragRect.set(null);
  }

  protected move(e: PointerEvent): void {
    if (!this.dragStart) return;
    const p = this.point(e);
    this.dragRect.set(rectFromDrag(this.dragStart.x, this.dragStart.y, p.x, p.y, 0));
  }

  protected up(e: PointerEvent): void {
    if (!this.dragStart) return;
    const p = this.point(e);
    const r = rectFromDrag(this.dragStart.x, this.dragStart.y, p.x, p.y);
    this.cancel();
    if (r) this.add(this.index(), [r]);
  }

  protected cancel(): void {
    this.dragStart = null;
    this.dragRect.set(null);
  }

  private add(page: number, rects: Rect[]): void {
    this.done.set('');
    this.areas.update((a) => ({ ...a, [page]: [...(a[page] ?? []), ...rects] }));
  }

  protected undo(): void {
    this.areas.update((a) => ({ ...a, [this.index()]: (a[this.index()] ?? []).slice(0, -1) }));
  }

  protected clearPage(): void {
    this.areas.update((a) => ({ ...a, [this.index()]: [] }));
  }

  protected wholePage(): void {
    this.add(this.index(), [{ x: 0, y: 0, w: 1, h: 1 }]);
  }

  // ---- ricerca di testo ----
  protected async findAll(): Promise<void> {
    const doc = this.doc;
    const q = this.query().trim();
    if (!doc || q === '') return;
    this.searching.set(true);
    this.searchNote.set('');
    try {
      let found = 0;
      let skipped = 0;
      for (let i = 0; i < doc.numPages; i++) {
        const t = await pageText(doc, i);
        if (t.rotated) {
          skipped++;
          continue;
        }
        const hits = textHits(t.items, q, t.width, t.height);
        if (hits.length) this.add(i, hits);
        found += hits.length;
      }
      this.searchNote.set(
        found === 0 ? this.i18n.t('prd.search.none') : this.i18n.t('prd.search.found', { n: found }) + (skipped ? ' ' + this.i18n.t('prd.search.skipped', { n: skipped }) : ''),
      );
    } catch {
      this.searchNote.set(this.i18n.t('pc.err.build'));
    } finally {
      this.searching.set(false);
    }
  }

  // ---- uscita ----
  protected async run(): Promise<void> {
    const p = this.pdf();
    const doc = this.doc;
    if (!p || !doc) return;
    this.busy.set(true);
    this.error.set('');
    this.done.set('');
    try {
      const r = await redactPdf(doc, p.bytes, this.areas(), { dpi: this.dpi(), format: this.format() }, (d, t) => this.progress.set(this.i18n.t('prd.progress', { done: d, total: t })));
      downloadPdf(r.bytes, p.base, 'oscurato');
      this.done.set(this.i18n.t('prd.done', { areas: r.areas, pages: r.pages, size: formatBytes(r.bytes.length, this.i18n.locale()) }));
    } catch {
      this.error.set(this.i18n.t('pc.err.build'));
    } finally {
      this.busy.set(false);
      this.progress.set('');
    }
  }
}
