// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { formatBytes } from '../../shared/text-stats';
import { LoadedPdf, downloadPdf } from '../pdf-common/pdf-file';
import { PdfSource } from '../pdf-common/pdf-source';
import { EMPTY_META, PdfMeta, readMeta, writeMeta } from './pdf-metadata';
import { PDF_METADATA_DICTIONARIES } from './pdf-metadata.i18n';

type TextField = 'title' | 'author' | 'subject' | 'keywords' | 'creator' | 'producer';
type DateField = 'created' | 'modified';

@Component({
  selector: 'app-pdf-metadata',
  imports: [Icon, PrivacyNote, PdfSource],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-metadata.page.html',
  styleUrl: './pdf-metadata.page.scss',
})
export class PdfMetadataPage {
  protected readonly i18n = inject(I18nService);
  protected readonly textFields: readonly TextField[] = ['title', 'author', 'subject', 'keywords', 'creator', 'producer'];
  protected readonly dateFields: readonly DateField[] = ['created', 'modified'];
  protected readonly pdf = signal<LoadedPdf | null>(null);
  protected readonly meta = signal<PdfMeta>(EMPTY_META);
  private original: PdfMeta = EMPTY_META;
  protected readonly hasXmp = signal(false);
  protected readonly customKeys = signal<string[]>([]);
  protected readonly removeXmp = signal(false);
  protected readonly removeCustom = signal(false);
  protected readonly busy = signal(false);
  protected readonly done = signal('');
  protected readonly dateError = signal<DateField | ''>('');
  protected readonly badDate = this.dateError;

  constructor() {
    this.i18n.register(PDF_METADATA_DICTIONARIES);
  }

  protected async onLoaded(p: LoadedPdf): Promise<void> {
    this.done.set('');
    this.dateError.set('');
    try {
      const info = await readMeta(p.bytes);
      this.pdf.set(p);
      this.original = info.meta;
      this.meta.set(info.meta);
      this.hasXmp.set(info.hasXmp);
      this.customKeys.set(info.customKeys);
      this.removeXmp.set(false);
      this.removeCustom.set(false);
    } catch {
      this.pdf.set(null);
    }
  }

  protected onCleared(): void {
    this.pdf.set(null);
  }

  protected setField(f: TextField | DateField, e: Event): void {
    this.done.set('');
    this.dateError.set('');
    this.meta.update((m) => ({ ...m, [f]: (e.target as HTMLInputElement).value }));
  }

  protected restore(): void {
    this.done.set('');
    this.dateError.set('');
    this.meta.set(this.original);
  }

  /** `wipe`: tutti i campi vuoti, anche XMP e chiavi personalizzate. */
  protected async save(wipe: boolean): Promise<void> {
    const p = this.pdf();
    if (!p) return;
    this.busy.set(true);
    this.done.set('');
    this.dateError.set('');
    try {
      const r = await writeMeta(p.bytes, wipe ? EMPTY_META : this.meta(), { removeXmp: wipe || this.removeXmp(), removeCustom: wipe || this.removeCustom() });
      if (!r.ok) {
        this.dateError.set(r.field);
        return;
      }
      downloadPdf(r.bytes, p.base, wipe ? 'senza-metadati' : 'metadati');
      this.done.set(this.i18n.t('pm.done', { size: formatBytes(r.bytes.length, this.i18n.locale()) }));
      if (wipe) {
        this.meta.set(EMPTY_META);
        this.hasXmp.set(false);
        this.customKeys.set([]);
      }
    } catch {
      this.done.set(this.i18n.t('pc.err.build'));
    } finally {
      this.busy.set(false);
    }
  }
}
