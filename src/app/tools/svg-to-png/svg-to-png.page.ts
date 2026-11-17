// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { bindSvgPreview } from '../../shared/svg-preview';
import { ToolHandoff } from '../../shared/tool-handoff';
import { SHARE_SCHEMA } from './svg-to-png.share';
import { SVG_TO_PNG_DICTIONARIES } from './svg-to-png.i18n';
import { renderSvg } from './svg-to-png-render';
import {
  FORMAT_MIME,
  OUT_FORMATS,
  SCALES,
  isHexColor,
  looksLikeSvg,
  outputFileName,
  outputSize,
  parseDimension,
  prepareSvg,
  readSvg,
  type OutFormat,
  type SizeMode,
} from './svg-size';

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="28" fill="#fbbf24" stroke="#92400e" stroke-width="3"/>
  <path d="M20 38c3 8 21 8 24 0" fill="none" stroke="#92400e" stroke-width="3" stroke-linecap="round"/>
  <circle cx="23" cy="25" r="3.5" fill="#92400e"/>
  <circle cx="41" cy="25" r="3.5" fill="#92400e"/>
</svg>`;

/** Un SVG scelto o ricevuto, letto come testo (il peso è limitato da readSvg). */
const isSvgFile = (f: File): boolean => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name);

@Component({
  selector: 'app-svg-to-png',
  imports: [FileDrop, Icon, PrivacyNote, Segmented, SendTo, ShareLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './svg-to-png.page.html',
  styleUrl: './svg-to-png.page.scss',
})
export class SvgToPngPage {
  protected readonly i18n = inject(I18nService);
  protected readonly shareSchema = SHARE_SCHEMA;
  protected readonly scales = SCALES;

  protected readonly svg = signal('');
  protected readonly fileName = signal('');
  protected readonly mode = signal<SizeMode>('scale');
  protected readonly scale = signal<number>(2);
  protected readonly valueText = signal('1024');
  protected readonly format = signal<OutFormat>('png');
  protected readonly quality = signal(92);
  protected readonly transparent = signal(true);
  protected readonly background = signal('#ffffff');
  protected readonly error = signal('');
  protected readonly status = signal('');
  protected readonly working = signal(false);
  protected readonly previewUrl = signal<string | null>(null);

  /** Lettura dell'SVG scritto: dimensioni, viewBox e risorse esterne. */
  protected readonly read = computed(() => readSvg(this.svg()));
  protected readonly info = computed(() => {
    const r = this.read();
    return r.ok ? r.info : null;
  });
  protected readonly readError = computed(() => {
    const r = this.read();
    return !r.ok && this.svg().trim() !== '' ? this.i18n.t('s2p.err.' + r.error) : '';
  });
  protected readonly out = computed(() => {
    const i = this.info();
    if (!i) return null;
    const m = this.mode();
    const v = parseDimension(this.valueText());
    // senza un valore valido si resta alla dimensione naturale
    return outputSize(i.size, m === 'scale' || v === null ? { mode: 'scale', scale: m === 'scale' ? this.scale() : 1, value: 0 } : { mode: m, scale: 1, value: v });
  });
  protected readonly sourceLabel = computed(() => this.i18n.t('s2p.source.' + (this.info()?.source ?? 'fallback')));
  protected readonly externalShown = computed(() => (this.info()?.external ?? []).slice(0, 5));
  protected readonly qualityOn = computed(() => this.format() !== 'png');
  protected readonly bgCss = computed(() => (this.transparent() ? null : this.background()));
  protected readonly prepared = computed(() => {
    const i = this.info();
    return i ? (prepareSvg(this.svg(), { width: Math.max(1, Math.round(i.size.width)), height: Math.max(1, Math.round(i.size.height)) }) ?? '') : '';
  });

  protected readonly modes = computed<SegmentOption<SizeMode>[]>(() => [
    { value: 'scale', label: this.i18n.t('s2p.mode.scale') },
    { value: 'width', label: this.i18n.t('s2p.mode.width') },
    { value: 'height', label: this.i18n.t('s2p.mode.height') },
  ]);
  protected readonly formats: SegmentOption<OutFormat>[] = OUT_FORMATS.map((f) => ({ value: f, label: f === 'jpeg' ? 'JPG' : f === 'webp' ? 'WebP' : 'PNG' }));

  // Link di condivisione: il testo dell'SVG e le opzioni
  protected readonly shareState = (): ShareData => ({
    svg: this.svg(),
    mode: this.mode(),
    scale: this.scale(),
    value: parseDimension(this.valueText()) ?? 1024,
    format: this.format(),
    quality: this.quality(),
    transparent: this.transparent(),
    background: this.background(),
  });

  constructor() {
    this.i18n.register(SVG_TO_PNG_DICTIONARIES);
    bindSvgPreview(() => this.prepared(), this.previewUrl);
    // contenuto ricevuto da un altro strumento: testo (SVG) o file immagine .svg
    const rx = inject(ToolHandoff).take('svg-to-png');
    if (rx?.kind === 'svg' && typeof rx.text === 'string') {
      if (looksLikeSvg(rx.text)) this.svg.set(rx.text);
      else this.error.set(this.i18n.t('s2p.err.received'));
    } else if (rx?.files?.length) {
      const f = rx.files.find(isSvgFile);
      if (f) afterNextRender(() => void this.onFiles([f]));
      else this.error.set(this.i18n.t('s2p.err.received'));
    }
  }

  protected restoreShared(data: ShareData): void {
    applyShare(data, {
      svg: this.svg,
      mode: this.mode,
      scale: this.scale,
      value: { set: (v: number) => this.valueText.set(String(v)) },
      format: this.format,
      quality: this.quality,
      transparent: this.transparent,
      background: this.background,
    } as never);
  }

  protected setSvg(v: string): void {
    this.svg.set(v);
    this.fileName.set('');
    this.status.set('');
    this.error.set('');
  }
  protected sample(): void {
    this.setSvg(SAMPLE);
    this.fileName.set(this.i18n.t('s2p.sampleName') + '.svg');
  }
  protected clear(): void {
    this.setSvg('');
  }

  protected async onFiles(list: File[]): Promise<void> {
    const f = list.find(isSvgFile);
    if (!f) {
      this.error.set(this.i18n.t('s2p.err.file'));
      return;
    }
    this.setSvg(await f.text());
    this.fileName.set(f.name);
  }

  protected setMode(m: SizeMode): void {
    this.mode.set(m);
  }
  protected setScale(v: string): void {
    const n = Number(v);
    if ((SCALES as readonly number[]).includes(n)) this.scale.set(n);
  }
  protected setBackground(v: string): void {
    if (isHexColor(v)) this.background.set(v);
  }
  protected setQuality(v: string): void {
    const n = Math.round(Number(v));
    if (Number.isFinite(n)) this.quality.set(Math.min(100, Math.max(1, n)));
  }

  private name(): string {
    return outputFileName(this.fileName() || this.i18n.t('s2p.sampleName'), this.format());
  }

  private async makeBlob(): Promise<Blob | null> {
    const o = this.out();
    if (!o || this.working()) return null;
    this.working.set(true);
    this.error.set('');
    try {
      return await renderSvg(this.svg(), o, this.format(), this.bgCss(), this.quality());
    } catch (e) {
      const m = (e as Error).message;
      this.error.set(this.i18n.t(m === 'format' ? 's2p.err.format' : m === 'decode' || m === 'svg' ? 's2p.err.render' : 's2p.err.export'));
      return null;
    } finally {
      this.working.set(false);
    }
  }

  /** L'immagine come file, per "Invia a…". */
  protected readonly imageFiles = async (): Promise<File[]> => {
    const blob = await this.makeBlob();
    return blob ? [new File([blob], this.name(), { type: FORMAT_MIME[this.format()] })] : [];
  };

  protected async download(): Promise<void> {
    const blob = await this.makeBlob();
    const o = this.out();
    if (!blob || !o) return;
    const name = this.name();
    saveBytes(blob, name, blob.type);
    this.status.set(this.i18n.t('s2p.done', { name, w: o.width, h: o.height, kb: Math.max(1, Math.round(blob.size / 1024)) }));
  }
}
