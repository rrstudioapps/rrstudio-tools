// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { BarcodeError, BarcodeFormat, FORMATS, MAX_BULK, MAX_LENGTH, Normalized, formatInfo, normalizeInput, planBulk } from './barcode';
import { BC_DICTIONARIES } from './barcode-generator.i18n';
import { BarcodeStyle, DEFAULT_STYLE, renderPng, renderSvg } from './barcode-render';
import { bindSvgPreview } from '../../shared/svg-preview';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './barcode-generator.share';

type Mode = 'single' | 'bulk';
type BulkKind = 'svg' | 'png';

@Component({
  selector: 'app-barcode-generator',
  imports: [ShareLink, Icon, PrivacyNote, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './barcode-generator.page.html',
  styleUrl: './barcode-generator.page.scss',
})
export class BarcodeGeneratorPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly formats = FORMATS;
  protected readonly maxBulk = MAX_BULK;
  protected readonly mode = signal<Mode>('single');
  protected readonly format = signal<BarcodeFormat>('EAN13');
  protected readonly text = signal('590123412345');
  protected readonly barWidth = signal(DEFAULT_STYLE.barWidth);
  protected readonly height = signal(DEFAULT_STYLE.height);
  protected readonly showText = signal(DEFAULT_STYLE.showText);
  protected readonly fontSize = signal(DEFAULT_STYLE.fontSize);
  protected readonly margin = signal(DEFAULT_STYLE.margin);
  protected readonly fg = signal(DEFAULT_STYLE.fg);
  protected readonly bg = signal(DEFAULT_STYLE.bg);
  protected readonly mod43 = signal(false);
  protected readonly pngScale = signal(2);

  protected readonly bulkText = signal('');
  protected readonly bulkKind = signal<BulkKind>('svg');
  protected readonly bulkBusy = signal('');
  protected readonly bulkDone = signal('');

  protected readonly svg = signal('');
  protected readonly renderFailed = signal(false);
  protected readonly previewUrl = signal<string | null>(null);

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'single', label: this.i18n.t('bc.mode.single') },
    { value: 'bulk', label: this.i18n.t('bc.mode.bulk') },
  ]);
  protected readonly bulkKinds: SegmentOption<BulkKind>[] = [
    { value: 'svg', label: 'SVG' },
    { value: 'png', label: 'PNG' },
  ];

  protected readonly info = computed(() => formatInfo(this.format()));
  protected readonly hint = computed(() => this.i18n.t(this.info().hintKey));
  protected readonly style = computed<BarcodeStyle>(() => ({
    barWidth: this.barWidth(),
    height: this.height(),
    showText: this.showText(),
    fontSize: this.fontSize(),
    margin: this.margin(),
    fg: this.fg(),
    bg: this.bg(),
    mod43: this.mod43(),
  }));

  protected readonly normalized = computed<Normalized | null>(() => (this.text().trim() === '' ? null : normalizeInput(this.format(), this.text())));
  protected readonly value = computed(() => {
    const n = this.normalized();
    return n && n.ok ? n.value : '';
  });
  protected readonly errorText = computed(() => {
    const n = this.normalized();
    if (!n || n.ok) return this.renderFailed() ? this.i18n.t('bc.err.render') : '';
    return this.errorMessage(n.error, n);
  });
  protected readonly checkNote = computed(() => {
    const n = this.normalized();
    if (!n || !n.ok || n.checkDigit === null) return '';
    return this.i18n.t(n.added ? 'bc.checkAdded' : 'bc.checkOk', { digit: n.checkDigit });
  });
  protected readonly alt = computed(() => this.i18n.t('bc.preview.alt', { format: this.info().label, value: this.value() }));

  // elenco
  protected readonly plan = computed(() => planBulk(this.format(), this.bulkText()));
  protected readonly validCount = computed(() => this.plan().entries.filter((e) => e.result.ok).length);
  protected readonly badEntries = computed(() =>
    this.plan()
      .entries.filter((e) => !e.result.ok)
      .map((e) => ({ line: e.line, input: e.input, message: e.result.ok ? '' : this.errorMessage(e.result.error, e.result) })),
  );
  protected readonly bulkSummary = computed(() =>
    this.i18n.t('bc.bulk.summary', { ok: this.validCount(), bad: this.badEntries().length }),
  );

  private seq = 0;

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode,
    format: this.format,
    text: this.text,
    barWidth: this.barWidth,
    height: this.height,
    showText: this.showText,
    fontSize: this.fontSize,
    margin: this.margin,
    fg: this.fg,
    bg: this.bg,
    mod43: this.mod43,
    pngScale: this.pngScale,
    bulkText: this.bulkText,
    bulkKind: this.bulkKind,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(BC_DICTIONARIES);
    // il disegno si rifà a ogni cambio di contenuto, formato o aspetto
    effect(() => {
      const value = this.value();
      const format = this.format();
      const style = this.style();
      if (!this.browser) return;
      const id = ++this.seq;
      this.renderFailed.set(false);
      if (!value) {
        this.svg.set('');
        return;
      }
      renderSvg(format, value, style)
        .then((s) => {
          if (id === this.seq) this.svg.set(s);
        })
        .catch(() => {
          if (id !== this.seq) return;
          this.svg.set('');
          this.renderFailed.set(true);
        });
    });
    bindSvgPreview(() => this.svg(), this.previewUrl);
  }

  private errorMessage(error: BarcodeError, n: { expected?: string; lengths?: readonly number[] }): string {
    return this.i18n.t('bc.err.' + error, {
      expected: n.expected ?? '',
      lengths: (n.lengths ?? []).join(' / '),
      max: MAX_LENGTH,
    });
  }

  protected setFormat(value: string): void {
    this.format.set(value as BarcodeFormat);
    this.bulkDone.set('');
  }

  protected useExample(): void {
    this.text.set(this.info().example);
  }

  protected num(value: string, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  protected downloadSvg(): void {
    const svg = this.svg();
    if (svg) saveBytes(new Blob([svg], { type: 'image/svg+xml' }), `${this.fileBase()}.svg`, 'image/svg+xml');
  }

  protected async downloadPng(): Promise<void> {
    const value = this.value();
    if (!value) return;
    try {
      const blob = await renderPng(this.format(), value, this.style(), this.pngScale());
      saveBytes(blob, `${this.fileBase()}.png`, 'image/png');
    } catch {
      this.renderFailed.set(true);
    }
  }

  private fileBase(): string {
    return `${this.format().toLowerCase()}-${this.value().replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30) || 'codice'}`;
  }

  protected async downloadZip(): Promise<void> {
    const entries = this.plan().entries.filter((e) => e.result.ok && e.name);
    this.bulkDone.set('');
    if (entries.length === 0) return;
    const { zipSync, strToU8 } = await import('fflate');
    const files: Record<string, Uint8Array> = {};
    const kind = this.bulkKind();
    const format = this.format();
    const style = this.style();
    let n = 0;
    try {
      for (const e of entries) {
        this.bulkBusy.set(this.i18n.t('bc.bulk.busy', { n: ++n, total: entries.length }));
        const value = (e.result as { value: string }).value;
        if (kind === 'svg') files[`${e.name}.svg`] = strToU8(await renderSvg(format, value, style));
        else files[`${e.name}.png`] = new Uint8Array(await (await renderPng(format, value, style, this.pngScale())).arrayBuffer());
        // cede il thread ogni tanto: l'interfaccia resta reattiva
        if (n % 10 === 0) await new Promise((r) => setTimeout(r));
      }
      const zip = zipSync(files, { level: 0 });
      saveBytes(zip, `barcodes-${format.toLowerCase()}.zip`, 'application/zip');
      this.bulkDone.set(this.i18n.t('bc.bulk.done', { n: entries.length }));
    } catch {
      this.bulkDone.set(this.i18n.t('bc.err.render'));
    } finally {
      this.bulkBusy.set('');
    }
  }
}
