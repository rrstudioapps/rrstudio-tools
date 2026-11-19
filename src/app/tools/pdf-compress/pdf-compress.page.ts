// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { formatBytes } from '../../shared/text-stats';
import { LoadedPdf, downloadPdf } from '../pdf-common/pdf-file';
import { PdfSource } from '../pdf-common/pdf-source';
import { browserRecoder, rasterizePdf } from './pdf-compress-browser';
import { compressImages } from './pdf-compress';
import { PDF_COMPRESS_DICTIONARIES } from './pdf-compress.i18n';

type Mode = 'images' | 'lossless' | 'raster';
interface Result {
  bytes: Uint8Array;
  before: number;
  after: number;
  detail: string;
}

@Component({
  selector: 'app-pdf-compress',
  imports: [Icon, PrivacyNote, PdfSource, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-compress.page.html',
  styleUrl: './pdf-compress.page.scss',
})
export class PdfCompressPage {
  protected readonly i18n = inject(I18nService);
  protected readonly sides: readonly number[] = [0, 2400, 1600, 1200, 800];
  protected readonly dpis: readonly number[] = [72, 100, 150, 200];
  protected readonly pdf = signal<LoadedPdf | null>(null);
  protected readonly mode = signal<Mode>('images');
  protected readonly quality = signal(75);
  protected readonly maxSide = signal(1600);
  protected readonly dpi = signal(100);
  protected readonly busy = signal(false);
  protected readonly progress = signal('');
  protected readonly error = signal('');
  protected readonly result = signal<Result | null>(null);
  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'images', label: this.i18n.t('pcz.m.images') },
    { value: 'lossless', label: this.i18n.t('pcz.m.lossless') },
    { value: 'raster', label: this.i18n.t('pcz.m.raster') },
  ]);

  constructor() {
    this.i18n.register(PDF_COMPRESS_DICTIONARIES);
  }

  protected onLoaded(p: LoadedPdf): void {
    this.pdf.set(p);
    this.result.set(null);
    this.error.set('');
  }

  protected onCleared(): void {
    this.pdf.set(null);
    this.result.set(null);
  }

  protected sizeText(n: number): string {
    return formatBytes(n, this.i18n.locale());
  }

  protected savedText(r: Result): string {
    if (r.after >= r.before) return this.i18n.t('pcz.saved.none');
    return this.i18n.t('pcz.saved', { pct: Math.round((1 - r.after / r.before) * 100) });
  }

  protected async run(): Promise<void> {
    const p = this.pdf();
    if (!p) return;
    this.busy.set(true);
    this.error.set('');
    this.result.set(null);
    this.progress.set('');
    try {
      const q = this.quality() / 100;
      let bytes: Uint8Array;
      let detail = '';
      if (this.mode() === 'raster') {
        bytes = await rasterizePdf(p.bytes, this.dpi(), q, (d, t) => this.progress.set(this.i18n.t('pcz.progress', { done: d, total: t })));
        detail = this.i18n.t('pcz.detail.raster', { pages: p.pages, dpi: this.dpi() });
      } else {
        const r = await compressImages(p.bytes, this.mode() === 'images' ? browserRecoder : null, { quality: q, maxSide: this.maxSide() });
        bytes = r.bytes;
        const sk = Object.entries(r.report.skipped).map(([k, n]) => `${this.i18n.t('pcz.skip.' + k)}: ${n}`);
        detail = this.mode() === 'images' ? this.i18n.t('pcz.detail.images', { found: r.report.images, done: r.report.recoded }) + (sk.length ? ` (${sk.join(', ')})` : '') : this.i18n.t('pcz.detail.lossless');
      }
      this.result.set({ bytes, before: p.bytes.length, after: bytes.length, detail });
    } catch {
      this.error.set(this.i18n.t('pc.err.build'));
    } finally {
      this.busy.set(false);
      this.progress.set('');
    }
  }

  protected download(): void {
    const p = this.pdf();
    const r = this.result();
    if (p && r) downloadPdf(r.bytes, p.base, 'compresso');
  }
}
