// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { zipSync } from 'fflate';
import { I18nService } from '../../core/i18n/i18n.service';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { formatBytes } from '../../shared/text-stats';
import { LoadedPdf } from '../pdf-common/pdf-file';
import { PdfSource } from '../pdf-common/pdf-source';
import { Extraction, FoundImage, extractImages } from './pdf-images';
import { PDF_IMAGES_DICTIONARIES } from './pdf-images.i18n';

const MIME = { jpg: 'image/jpeg', png: 'image/png', jp2: 'image/jp2' } as const;

@Component({
  selector: 'app-pdf-images',
  imports: [Icon, PrivacyNote, PdfSource],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-images.page.html',
  styleUrl: './pdf-images.page.scss',
})
export class PdfImagesPage {
  protected readonly i18n = inject(I18nService);
  protected readonly pdf = signal<LoadedPdf | null>(null);
  protected readonly found = signal<Extraction | null>(null);
  protected readonly busy = signal(false);
  protected readonly zipping = signal(false);
  private readonly urls = signal<Map<number, string>>(new Map());
  private readonly picked = signal<ReadonlySet<number>>(new Set());

  protected readonly items = computed(() => {
    const f = this.found();
    return f ? f.images.map((img) => ({ img, url: img.format === 'jp2' || img.cmyk ? '' : (this.urls().get(img.id) ?? ''), on: this.picked().has(img.id) })) : [];
  });
  protected readonly selectedCount = computed(() => this.picked().size);
  protected readonly summary = computed(() => {
    const f = this.found();
    if (!f) return '';
    const skipped = Object.values(f.skipped).reduce((a, b) => a + (b ?? 0), 0);
    return this.i18n.t('pim.summary', { n: f.images.length, tiny: f.tiny, skipped });
  });

  constructor() {
    this.i18n.register(PDF_IMAGES_DICTIONARIES);
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  private revoke(): void {
    for (const u of this.urls().values()) URL.revokeObjectURL(u);
    this.urls.set(new Map());
  }

  protected async onLoaded(p: LoadedPdf): Promise<void> {
    this.pdf.set(p);
    this.found.set(null);
    this.revoke();
    this.busy.set(true);
    try {
      const f = await extractImages(p.bytes);
      const map = new Map<number, string>();
      for (const img of f.images) if (img.format !== 'jp2' && !img.cmyk) map.set(img.id, URL.createObjectURL(new Blob([img.bytes as BlobPart], { type: MIME[img.format] })));
      this.urls.set(map);
      this.picked.set(new Set(f.images.map((i) => i.id)));
      this.found.set(f);
    } catch {
      this.found.set({ images: [], skipped: {}, tiny: 0 });
    } finally {
      this.busy.set(false);
    }
  }

  protected onCleared(): void {
    this.pdf.set(null);
    this.found.set(null);
    this.revoke();
  }

  protected sizeText(n: number): string {
    return formatBytes(n, this.i18n.locale());
  }

  protected toggle(id: number, on: boolean): void {
    this.picked.update((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  protected selectAll(on: boolean): void {
    this.picked.set(on ? new Set(this.found()?.images.map((i) => i.id)) : new Set());
  }

  private fileName(img: FoundImage): string {
    const base = this.pdf()?.base ?? 'documento';
    return `${base}-immagine-${String(img.id).padStart(3, '0')}.${img.format}`;
  }

  protected downloadOne(img: FoundImage): void {
    saveBytes(img.bytes, this.fileName(img), MIME[img.format]);
  }

  protected downloadZip(): void {
    const f = this.found();
    if (!f) return;
    this.zipping.set(true);
    try {
      const files: Record<string, Uint8Array> = {};
      for (const img of f.images) if (this.picked().has(img.id)) files[this.fileName(img)] = img.bytes;
      // le immagini sono già compresse: i file vanno nello ZIP senza ricompressione
      const zip = zipSync(files, { level: 0 });
      saveBytes(zip, `${this.pdf()?.base ?? 'documento'}-immagini.zip`, 'application/zip');
    } finally {
      this.zipping.set(false);
    }
  }
}
