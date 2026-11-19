// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { formatBytes } from '../../shared/text-stats';
import { LoadedPdf, downloadPdf } from '../pdf-common/pdf-file';
import { PdfSource } from '../pdf-common/pdf-source';
import { openPdf, renderThumb } from '../pdf-tools/pdf-thumbs';
import { DEFAULT_OPTIONS, EMPTY_SLOTS, FontName, PageTextOptions, Slots, addPageText } from './pdf-page-text';
import { PDF_PAGE_TEXT_DICTIONARIES } from './pdf-page-text.i18n';

type Row = 'header' | 'footer';
type Pos = 'left' | 'center' | 'right';
type Preset = 'nm' | 'n' | 'page' | 'head' | 'none';

@Component({
  selector: 'app-pdf-page-text',
  imports: [Icon, PrivacyNote, PdfSource],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-page-text.page.html',
  styleUrl: './pdf-page-text.page.scss',
})
export class PdfPageTextPage {
  protected readonly i18n = inject(I18nService);
  protected readonly rows: readonly Row[] = ['header', 'footer'];
  protected readonly positions: readonly Pos[] = ['left', 'center', 'right'];
  protected readonly fonts: readonly FontName[] = ['Helvetica', 'TimesRoman', 'Courier'];
  protected readonly pdf = signal<LoadedPdf | null>(null);
  protected readonly header = signal<Slots>(EMPTY_SLOTS);
  protected readonly footer = signal<Slots>(DEFAULT_OPTIONS.footer);
  protected readonly font = signal<FontName>('Helvetica');
  protected readonly size = signal(10);
  protected readonly color = signal('#444444');
  protected readonly margin = signal(28);
  protected readonly startAt = signal(1);
  protected readonly pages = signal('');
  protected readonly skipFirst = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal('');
  protected readonly previewUrl = signal<string | null>(null);

  private readonly options = computed<PageTextOptions>(() => ({
    header: this.header(),
    footer: this.footer(),
    font: this.font(),
    size: Math.min(72, Math.max(4, this.size() || 10)),
    color: this.color(),
    margin: Math.min(200, Math.max(0, this.margin() || 0)),
    startAt: Math.max(0, Math.floor(this.startAt() || 0)),
    pages: this.pages(),
    skipFirst: this.skipFirst(),
  }));

  constructor() {
    this.i18n.register(PDF_PAGE_TEXT_DICTIONARIES);
    inject(DestroyRef).onDestroy(() => this.clearPreview());
  }

  protected onLoaded(p: LoadedPdf): void {
    this.pdf.set(p);
    this.error.set('');
    this.done.set('');
    this.clearPreview();
  }

  protected onCleared(): void {
    this.pdf.set(null);
    this.clearPreview();
  }

  protected slot(row: Row, pos: Pos): string {
    return (row === 'header' ? this.header() : this.footer())[pos];
  }

  protected setSlot(row: Row, pos: Pos, e: Event): void {
    this.done.set('');
    const v = (e.target as HTMLInputElement).value;
    (row === 'header' ? this.header : this.footer).update((s) => ({ ...s, [pos]: v }));
  }

  protected preset(p: Preset): void {
    this.done.set('');
    const none = EMPTY_SLOTS;
    this.header.set(none);
    this.footer.set(none);
    const t = (k: string): string => this.i18n.t(k);
    if (p === 'nm') this.footer.set({ ...none, center: '{n} / {total}' });
    else if (p === 'n') this.footer.set({ ...none, right: '{n}' });
    else if (p === 'page') this.footer.set({ ...none, center: t('pt.word.page') + ' {n} ' + t('pt.word.of') + ' {total}' });
    else if (p === 'head') {
      this.header.set({ left: '{name}', center: '', right: '{date}' });
      this.footer.set({ ...none, center: '{n} / {total}' });
    }
  }

  private clearPreview(): void {
    const u = this.previewUrl();
    if (u) URL.revokeObjectURL(u);
    this.previewUrl.set(null);
  }

  private async build(): Promise<Uint8Array | null> {
    const p = this.pdf();
    if (!p) return null;
    this.error.set('');
    const r = await addPageText(p.bytes, p.name, this.options());
    if (!r.ok) {
      this.error.set(this.i18n.t('pt.err.range', { token: r.error.token, total: r.error.total }));
      return null;
    }
    return r.bytes;
  }

  protected async makePreview(): Promise<void> {
    this.busy.set(true);
    this.done.set('');
    try {
      const bytes = await this.build();
      if (!bytes) return;
      const doc = await openPdf(bytes.slice());
      const first = this.firstPage();
      const blob = await renderThumb(doc, first);
      void doc.loadingTask.destroy();
      this.clearPreview();
      if (blob) this.previewUrl.set(URL.createObjectURL(blob));
    } catch {
      this.error.set(this.i18n.t('pc.err.build'));
    } finally {
      this.busy.set(false);
    }
  }

  /** Pagina da mostrare nell'anteprima: la prima che riceve il testo. */
  private firstPage(): number {
    const o = this.options();
    const m = /^\s*(\d+)/.exec(o.pages);
    const first = m ? Number(m[1]) - 1 : 0;
    return Math.max(0, Math.min((this.pdf()?.pages ?? 1) - 1, o.skipFirst && first === 0 ? 1 : first));
  }

  protected async go(): Promise<void> {
    const p = this.pdf();
    if (!p) return;
    this.busy.set(true);
    this.done.set('');
    try {
      const bytes = await this.build();
      if (!bytes) return;
      downloadPdf(bytes, p.base, 'numerato');
      this.done.set(this.i18n.t('pc.done', { name: `${p.base}-numerato.pdf`, size: formatBytes(bytes.length, this.i18n.locale()) }));
    } catch {
      this.error.set(this.i18n.t('pc.err.build'));
    } finally {
      this.busy.set(false);
    }
  }
}
