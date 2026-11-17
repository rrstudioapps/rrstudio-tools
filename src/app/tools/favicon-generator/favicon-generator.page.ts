// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import {
  ALL_SIZES,
  DEFAULT_SITE,
  FitMode,
  ICO_SIZES,
  Shape,
  SizedPngs,
  buildPackage,
  encodeIco,
  htmlSnippet,
  manifestJson,
  readableOn,
  validHexColor,
} from './favicon';
import { FontFamily, LoadedImage, RenderOptions, RenderSource, canvasToPng, drawFavicon, loadImageFile } from './favicon-render';
import { FAV_DICTIONARIES } from './favicon-generator.i18n';

type SourceKind = 'text' | 'image';
const PREVIEW_SIZES = [16, 32, 48, 180] as const;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-favicon-generator',
  imports: [Icon, PrivacyNote, Segmented, FileDrop, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './favicon-generator.page.html',
  styleUrl: './favicon-generator.page.scss',
})
export class FaviconGeneratorPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly previewSizes = PREVIEW_SIZES;

  protected readonly kind = signal<SourceKind>('text');
  protected readonly kinds = computed<SegmentOption<SourceKind>[]>(() => [
    { value: 'text', label: this.i18n.t('fav.source.text') },
    { value: 'image', label: this.i18n.t('fav.source.image') },
  ]);

  // testo
  protected readonly text = signal('R');
  protected readonly textColor = signal('#ffffff');
  protected readonly font = signal<FontFamily>('sans');
  protected readonly bold = signal(true);
  // immagine
  protected readonly image = signal<LoadedImage | null>(null);
  protected readonly imageName = signal('');
  protected readonly imageError = signal('');
  // aspetto
  protected readonly bg = signal('#6366f1');
  protected readonly transparent = signal(false);
  protected readonly shape = signal<Shape>('rounded');
  protected readonly padding = signal(8);
  protected readonly fit = signal<FitMode>('cover');
  protected readonly zoom = signal(1);
  // sito
  protected readonly siteName = signal('My site');
  protected readonly shortName = signal('Site');
  protected readonly themeColor = signal('#6366f1');
  protected readonly appBg = signal('#ffffff');

  protected readonly shapes = computed<SegmentOption<Shape>[]>(() => [
    { value: 'square', label: this.i18n.t('fav.shape.square') },
    { value: 'rounded', label: this.i18n.t('fav.shape.rounded') },
    { value: 'circle', label: this.i18n.t('fav.shape.circle') },
  ]);
  protected readonly fits = computed<SegmentOption<FitMode>[]>(() => [
    { value: 'cover', label: this.i18n.t('fav.fit.cover') },
    { value: 'contain', label: this.i18n.t('fav.fit.contain') },
  ]);

  protected readonly previews = signal<{ size: number; url: string }[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly site = computed(() => ({
    name: this.siteName(),
    shortName: this.shortName(),
    themeColor: validHexColor(this.themeColor()) ? this.themeColor() : DEFAULT_SITE.themeColor,
    backgroundColor: validHexColor(this.appBg()) ? this.appBg() : DEFAULT_SITE.backgroundColor,
  }));
  protected readonly snippet = computed(() => htmlSnippet(this.site()));
  protected readonly manifest = computed(() => manifestJson(this.site()));
  protected readonly canBuild = computed(() => (this.kind() === 'text' ? this.text().trim() !== '' : this.image() !== null));

  private readonly renderSource = computed<RenderSource | null>(() => {
    if (this.kind() === 'text') {
      if (this.text().trim() === '') return null;
      return { kind: 'text', text: this.text(), color: this.textColor(), font: this.font(), bold: this.bold() };
    }
    const image = this.image();
    return image ? { kind: 'image', image } : null;
  });
  private readonly renderOptions = computed<RenderOptions>(() => ({
    background: this.transparent() ? null : this.bg(),
    shape: this.shape(),
    padding: this.padding(),
    fit: this.fit(),
    zoom: this.zoom(),
  }));

  constructor() {
    this.i18n.register(FAV_DICTIONARIES);
    effect(() => {
      const src = this.renderSource();
      const opts = this.renderOptions();
      if (!this.browser) return;
      untracked(() => this.updatePreviews(src, opts));
    });
  }

  private updatePreviews(src: RenderSource | null, opts: RenderOptions): void {
    if (!src) {
      this.previews.set([]);
      return;
    }
    const canvas = document.createElement('canvas');
    this.previews.set(
      PREVIEW_SIZES.map((size) => {
        drawFavicon(canvas, size, src, opts);
        return { size, url: canvas.toDataURL('image/png') };
      }),
    );
  }

  // ---- ingressi ----
  protected async onFile(file: File): Promise<void> {
    this.imageError.set('');
    if (!file.type.startsWith('image/') && !/\.(png|jpe?g|svg|gif|webp)$/i.test(file.name)) {
      this.imageError.set(this.i18n.t('fav.image.type'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.imageError.set(this.i18n.t('fav.image.big'));
      return;
    }
    try {
      const img = await loadImageFile(file);
      this.image.set(img);
      this.imageName.set(file.name);
      this.kind.set('image');
      if (this.themeColor() === '#6366f1') this.transparent.set(true);
    } catch {
      this.imageError.set(this.i18n.t('fav.image.err'));
    }
  }

  protected setNumber(sig: { set(v: number): void }, value: string, min: number, max: number): void {
    const n = Number(value.replace(',', '.'));
    if (value.trim() === '' || !Number.isFinite(n)) return;
    sig.set(Math.min(max, Math.max(min, n)));
  }

  protected setColor(sig: { set(v: string): void }, value: string): void {
    if (validHexColor(value)) sig.set(value.toLowerCase());
  }

  protected autoTextColor(): void {
    this.textColor.set(readableOn(this.bg()));
  }

  // ---- uscita ----
  private async renderPngs(): Promise<SizedPngs> {
    const src = this.renderSource();
    if (!src) throw new Error('empty');
    const opts = this.renderOptions();
    const canvas = document.createElement('canvas');
    const out: SizedPngs = {};
    for (const size of ALL_SIZES) {
      drawFavicon(canvas, size, src, opts);
      out[size] = await canvasToPng(canvas);
    }
    return out;
  }

  protected async downloadZip(): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      const pngs = await this.renderPngs();
      const files = buildPackage(pngs, this.site());
      const { zipSync } = await import('fflate');
      saveBytes(zipSync(files), this.i18n.t('fav.zip.name'), 'application/zip');
    } catch {
      this.error.set(this.i18n.t('fav.err.build'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async downloadIco(): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      const pngs = await this.renderPngs();
      const ico = encodeIco(ICO_SIZES.map((size) => ({ size, png: pngs[size] as Uint8Array })));
      saveBytes(ico, 'favicon.ico', 'image/x-icon');
    } catch {
      this.error.set(this.i18n.t('fav.err.build'));
    } finally {
      this.busy.set(false);
    }
  }
}
