// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { formatBytes } from '../../shared/text-stats';
import { LoadedPdf, downloadPdf, openForEdit } from '../pdf-common/pdf-file';
import { PdfSource } from '../pdf-common/pdf-source';
import { openPdf, renderThumb } from '../pdf-tools/pdf-thumbs';
import { MM, Margins, Op, SIZES, SizeName, transformPages, visualSize } from './pdf-crop';
import { PDF_CROP_DICTIONARIES } from './pdf-crop.i18n';

type Mode = 'crop' | 'scale' | 'fit';
type Side = keyof Margins;

@Component({
  selector: 'app-pdf-crop',
  imports: [Icon, PrivacyNote, PdfSource, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-crop.page.html',
  styleUrl: './pdf-crop.page.scss',
})
export class PdfCropPage {
  protected readonly i18n = inject(I18nService);
  protected readonly sides: readonly Side[] = ['top', 'right', 'bottom', 'left'];
  protected readonly sizeNames = Object.keys(SIZES) as SizeName[];
  protected readonly pdf = signal<LoadedPdf | null>(null);
  protected readonly mode = signal<Mode>('crop');
  private readonly margins = signal<Margins>({ top: 10, right: 10, bottom: 10, left: 10 });
  protected readonly percent = signal(90);
  protected readonly size = signal<SizeName>('A4');
  protected readonly fitMargin = signal(10);
  protected readonly pages = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal('');
  protected readonly thumb = signal<{ url: string; width: number; height: number } | null>(null);
  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'crop', label: this.i18n.t('pcr.m.crop') },
    { value: 'scale', label: this.i18n.t('pcr.m.scale') },
    { value: 'fit', label: this.i18n.t('pcr.m.fit') },
  ]);
  /** Riquadro di ritaglio in percentuale della pagina mostrata (valori in mm del campo, pagina in punti). */
  protected readonly frame = computed(() => {
    const t = this.thumb();
    const m = this.margins();
    if (!t) return { top: 0, right: 0, bottom: 0, left: 0 };
    const pct = (mm: number, total: number): number => Math.max(0, Math.min(49, ((mm * MM) / total) * 100));
    return { top: pct(m.top, t.height), right: pct(m.right, t.width), bottom: pct(m.bottom, t.height), left: pct(m.left, t.width) };
  });

  constructor() {
    this.i18n.register(PDF_CROP_DICTIONARIES);
    inject(DestroyRef).onDestroy(() => this.dropThumb());
  }

  protected margin(side: Side): number {
    return this.margins()[side];
  }

  protected setMargin(side: Side, e: Event): void {
    this.done.set('');
    const v = Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
    this.margins.update((m) => ({ ...m, [side]: v }));
  }

  private dropThumb(): void {
    const t = this.thumb();
    if (t) URL.revokeObjectURL(t.url);
    this.thumb.set(null);
  }

  protected async onLoaded(p: LoadedPdf): Promise<void> {
    this.pdf.set(p);
    this.error.set('');
    this.done.set('');
    this.dropThumb();
    try {
      const doc = await openPdf(p.bytes.slice());
      const blob = await renderThumb(doc, 0);
      void doc.loadingTask.destroy();
      const size = visualSize((await openForEdit(p.bytes)).getPage(0));
      if (blob) this.thumb.set({ url: URL.createObjectURL(blob), width: size.width, height: size.height });
    } catch {
      /* l'anteprima è facoltativa */
    }
  }

  protected onCleared(): void {
    this.pdf.set(null);
    this.dropThumb();
  }

  private op(): Op {
    const pages = this.pages();
    if (this.mode() === 'crop') {
      const m = this.margins();
      return { kind: 'crop', pages, margins: { top: m.top * MM, right: m.right * MM, bottom: m.bottom * MM, left: m.left * MM } };
    }
    if (this.mode() === 'scale') return { kind: 'scale', percent: this.percent(), pages };
    return { kind: 'fit', size: this.size(), margin: Math.max(0, this.fitMargin()) * MM, pages };
  }

  protected async go(): Promise<void> {
    const p = this.pdf();
    if (!p) return;
    this.busy.set(true);
    this.error.set('');
    this.done.set('');
    try {
      const r = await transformPages(p.bytes, this.op());
      if (!r.ok) {
        const e = r.error;
        this.error.set(
          e.code === 'range'
            ? this.i18n.t('pcr.err.range', { token: e.error.token, total: e.error.total })
            : e.code === 'tooMuch'
              ? this.i18n.t('pcr.err.tooMuch', { page: e.page })
              : this.i18n.t('pcr.err.' + e.code),
        );
        return;
      }
      const suffix = this.mode() === 'crop' ? 'ritagliato' : this.mode() === 'scale' ? 'scalato' : 'adattato';
      downloadPdf(r.bytes, p.base, suffix);
      this.done.set(this.i18n.t('pc.done', { name: `${p.base}-${suffix}.pdf`, size: formatBytes(r.bytes.length, this.i18n.locale()) }));
    } catch {
      this.error.set(this.i18n.t('pc.err.build'));
    } finally {
      this.busy.set(false);
    }
  }
}
