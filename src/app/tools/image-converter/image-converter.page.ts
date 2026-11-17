// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { ShareLink, applyShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { formatBytes } from '../../shared/text-stats';
import { detectEncodableFormats, processImage } from '../image-compressor/image-processor';
import {
  CONVERT_FORMATS,
  ConvertFormat,
  ConverterSettings,
  DEFAULT_RESIZE_VALUE,
  DEFAULT_SETTINGS,
  FORMAT_LABELS,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_RESIZE_PX,
  RESIZE_MODES,
  ResizeMode,
  backgroundApplies,
  clampResizeValue,
  encodedAsRequested,
  formatMime,
  formatSaving,
  inputMime,
  isConvertFormat,
  isHexColor,
  outputNames,
  qualityApplies,
  resolveFormat,
  savingPercent,
  toProcessorSettings,
} from './image-converter';
import { IMAGE_CONVERTER_DICTIONARIES } from './image-converter.i18n';
import { SHARE_SCHEMA } from './image-converter.share';
import { SendTo } from '../../shared/send-to';
import { ToolHandoff } from '../../shared/tool-handoff';

type Status = 'queued' | 'processing' | 'done' | 'error';

interface Item {
  id: number;
  file: File;
  status: Status;
  srcWidth: number;
  srcHeight: number;
  outWidth: number;
  outHeight: number;
  outBytes: number;
  outFormat: ConvertFormat;
  blob: Blob | null;
  /** Miniatura (anteprima nell'elenco). */
  thumbUrl: string | null;
  resultUrl: string | null;
  outName: string;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp';
const DEBOUNCE_MS = 300;

@Component({
  selector: 'app-image-converter',
  imports: [Icon, PrivacyNote, FileDrop, ShareLink, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-converter.page.html',
  styleUrl: './image-converter.page.scss',
})
export class ImageConverterPage {
  protected readonly i18n = inject(I18nService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly accept = ACCEPT;
  protected readonly maxFiles = MAX_FILES;
  protected readonly maxResize = MAX_RESIZE_PX;
  protected readonly shareSchema = SHARE_SCHEMA;

  protected readonly settings = signal<ConverterSettings>({ ...DEFAULT_SETTINGS });
  protected readonly items = signal<Item[]>([]);
  /** MIME che questo browser sa codificare (PNG, JPEG e WebP finché la prova non è finita). */
  protected readonly supported = signal<ReadonlySet<string>>(new Set(['image/png', 'image/jpeg', 'image/webp']));
  protected readonly detected = signal(false);
  protected readonly notice = signal('');
  protected readonly zipping = signal(false);

  private nextId = 1;
  /** Cambia a ogni modifica delle impostazioni: i risultati di una generazione vecchia si scartano. */
  private generation = 0;
  private running = false;

  /** Formato davvero usato: quello scelto, o PNG se il browser non lo sa produrre. */
  protected readonly effectiveFormat = computed(() => resolveFormat(this.settings().format, this.supported()));

  protected readonly formatOptions = computed(() =>
    CONVERT_FORMATS.map((f) => ({
      value: f,
      label: FORMAT_LABELS[f],
      disabled: !this.supported().has(formatMime(f)),
    })),
  );
  protected readonly unsupportedList = computed(() =>
    this.formatOptions()
      .filter((f) => f.disabled)
      .map((f) => f.label)
      .join(', '),
  );

  protected readonly resizeModes = computed<{ value: ResizeMode; label: string }[]>(() =>
    RESIZE_MODES.map((m) => ({ value: m, label: this.i18n.t('icv.resize.' + m) })),
  );
  protected readonly qualityOn = computed(() => qualityApplies(this.effectiveFormat()));
  protected readonly backgroundOn = computed(() => backgroundApplies(this.effectiveFormat()));

  protected readonly doneCount = computed(() => this.items().filter((i) => i.status === 'done').length);
  protected readonly summary = computed(() => {
    const done = this.items().filter((i) => i.status === 'done');
    if (done.length === 0) return null;
    const before = done.reduce((n, i) => n + i.file.size, 0);
    const after = done.reduce((n, i) => n + i.outBytes, 0);
    return { before, after, percent: savingPercent(before, after) };
  });
  protected readonly statusText = computed(() => {
    const list = this.items();
    if (list.length === 0) return '';
    const done = list.filter((i) => i.status === 'done' || i.status === 'error').length;
    return done < list.length
      ? this.i18n.t('icv.status.progress', { done, total: list.length })
      : this.i18n.t('icv.status.complete', { count: list.length });
  });

  // Link di condivisione: solo le opzioni, mai le immagini
  protected readonly shareState = (): ShareData => {
    const s = this.settings();
    return { format: s.format, quality: s.quality, resizeMode: s.resizeMode, resizeValue: s.resizeValue, background: s.background };
  };

  constructor() {
    this.i18n.register(IMAGE_CONVERTER_DICTIONARIES);
    // immagini ricevute da un altro strumento: stessa strada del file-drop
    const rx = inject(ToolHandoff).take('image-converter');
    if (rx?.files?.length) afterNextRender(() => this.onFiles(rx.files!));
    inject(DestroyRef).onDestroy(() => {
      this.generation++;
      for (const i of this.items()) this.revoke(i);
    });
    if (this.isBrowser) {
      void detectEncodableFormats().then((s) => {
        this.supported.set(s);
        this.detected.set(true);
      });
    }
    // Impostazioni cambiate: dopo un breve debounce si rielabora tutto
    effect((onCleanup) => {
      this.settings();
      this.supported();
      if (untracked(() => this.items().length) === 0) return;
      const t = setTimeout(() => this.requeueAll(), DEBOUNCE_MS);
      onCleanup(() => clearTimeout(t));
    });
  }

  // ---- impostazioni ----
  protected restoreShared(data: ShareData): void {
    const t: Partial<Record<keyof ConverterSettings, unknown>> = {};
    applyShare(data, {
      format: { set: (v: string) => (t.format = v) },
      quality: { set: (v: number) => (t.quality = v) },
      resizeMode: { set: (v: string) => (t.resizeMode = v) },
      resizeValue: { set: (v: number) => (t.resizeValue = v) },
      background: { set: (v: string) => (t.background = v) },
    });
    this.settings.update((s) => {
      const mode = (RESIZE_MODES as readonly unknown[]).includes(t.resizeMode) ? (t.resizeMode as ResizeMode) : s.resizeMode;
      return {
        format: isConvertFormat(t.format) ? t.format : s.format,
        quality: typeof t.quality === 'number' ? t.quality : s.quality,
        resizeMode: mode,
        resizeValue: mode === 'none' ? 0 : clampResizeValue(mode, typeof t.resizeValue === 'number' ? t.resizeValue : s.resizeValue),
        background: typeof t.background === 'string' && isHexColor(t.background) ? t.background : s.background,
      };
    });
  }

  protected setFormat(f: ConvertFormat): void {
    if (this.supported().has(formatMime(f))) this.settings.update((s) => ({ ...s, format: f }));
  }
  protected setQuality(v: string): void {
    const n = Math.round(Number(v));
    if (Number.isFinite(n)) this.settings.update((s) => ({ ...s, quality: Math.min(100, Math.max(1, n)) }));
  }
  protected setResizeMode(v: string): void {
    const mode = v as ResizeMode;
    this.settings.update((s) => ({ ...s, resizeMode: mode, resizeValue: DEFAULT_RESIZE_VALUE[mode] }));
  }
  protected setResizeValue(v: string): void {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) this.settings.update((s) => ({ ...s, resizeValue: clampResizeValue(s.resizeMode, n) }));
  }
  protected setBackground(v: string): void {
    if (isHexColor(v)) this.settings.update((s) => ({ ...s, background: v }));
  }

  // ---- file ----
  protected onFiles(files: File[]): void {
    let badType = 0;
    let tooBig = 0;
    let tooMany = 0;
    const added: Item[] = [];
    const room = MAX_FILES - this.items().length;
    for (const file of files) {
      if (!inputMime(file)) badType++;
      else if (file.size > MAX_FILE_BYTES) tooBig++;
      else if (added.length >= room) tooMany++;
      else {
        added.push({
          id: this.nextId++,
          file,
          status: 'queued',
          srcWidth: 0,
          srcHeight: 0,
          outWidth: 0,
          outHeight: 0,
          outBytes: 0,
          outFormat: this.effectiveFormat(),
          blob: null,
          thumbUrl: null,
          resultUrl: null,
          outName: '',
        });
      }
    }
    const msgs: string[] = [];
    if (badType) msgs.push(this.i18n.t('icv.err.type', { n: badType }));
    if (tooBig) msgs.push(this.i18n.t('icv.err.size', { n: tooBig }));
    if (tooMany) msgs.push(this.i18n.t('icv.err.count', { n: tooMany, max: MAX_FILES }));
    this.notice.set(msgs.join(' '));
    if (added.length === 0) return;
    this.items.update((l) => [...l, ...added]);
    this.refreshNames();
    void this.run();
  }

  protected remove(item: Item): void {
    this.revoke(item);
    this.items.update((l) => l.filter((i) => i.id !== item.id));
    this.refreshNames();
  }

  protected clearAll(): void {
    this.generation++;
    for (const i of this.items()) this.revoke(i);
    this.items.set([]);
    this.notice.set('');
  }

  private revoke(i: Item): void {
    if (i.thumbUrl) URL.revokeObjectURL(i.thumbUrl);
    if (i.resultUrl) URL.revokeObjectURL(i.resultUrl);
  }

  private patch(id: number, p: Partial<Item>): void {
    this.items.update((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }

  private requeueAll(): void {
    this.generation++;
    this.items.update((l) => l.map((i) => ({ ...i, status: 'queued' as Status })));
    void this.run();
  }

  /** Elabora in sequenza i file in coda (uno alla volta, per contenere la memoria). */
  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (;;) {
        const item = this.items().find((i) => i.status === 'queued');
        if (!item) break;
        const gen = this.generation;
        const settings = { ...this.settings(), format: this.effectiveFormat() };
        const mime = formatMime(settings.format);
        this.patch(item.id, { status: 'processing', outFormat: settings.format });
        try {
          const r = await processImage({ file: item.file, settings: toProcessorSettings(settings), mime, wantThumb: item.thumbUrl === null });
          if (gen !== this.generation) continue; // impostazioni cambiate nel frattempo
          if (!this.items().some((i) => i.id === item.id)) continue; // rimosso
          if (!encodedAsRequested(r.blob.type, mime)) throw new Error('encode');
          if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
          this.patch(item.id, {
            status: 'done',
            srcWidth: r.srcWidth,
            srcHeight: r.srcHeight,
            outWidth: r.width,
            outHeight: r.height,
            outBytes: r.blob.size,
            outFormat: settings.format,
            blob: r.blob,
            resultUrl: URL.createObjectURL(r.blob),
            thumbUrl: item.thumbUrl ?? (r.thumb ? URL.createObjectURL(r.thumb) : null),
          });
          this.refreshNames();
        } catch {
          if (gen !== this.generation) continue;
          this.patch(item.id, { status: 'error', blob: null });
        }
      }
    } finally {
      this.running = false;
    }
    // un cambio di impostazioni arrivato mentre il ciclo finiva
    if (this.items().some((i) => i.status === 'queued')) void this.run();
  }

  /** Ricalcola i nomi di uscita, senza duplicati, sull'intera lista. */
  private refreshNames(): void {
    const list = this.items();
    // lo stesso formato per tutti: quello delle impostazioni correnti
    const names = outputNames(
      list.map((i) => i.file.name),
      this.effectiveFormat(),
    );
    if (list.some((i, n) => i.outName !== names[n])) {
      this.items.set(list.map((i, n) => ({ ...i, outName: names[n] })));
    }
  }

  // ---- download ----
  protected download(item: Item): void {
    if (item.resultUrl) this.saveUrl(item.resultUrl, item.outName);
  }

  /** Tutti i risultati in un unico file ZIP (fflate, già nelle dipendenze). */
  /** I risultati pronti come file, per "Invia a…". */
  protected readonly doneFiles = (): File[] =>
    this.items()
      .filter((i) => i.status === 'done' && i.blob)
      .map((i) => new File([i.blob!], i.outName, { type: i.blob!.type }));

  protected async downloadAll(): Promise<void> {
    const done = this.items().filter((i) => i.status === 'done' && i.blob);
    if (done.length === 0 || this.zipping()) return;
    this.zipping.set(true);
    try {
      const { zipSync } = await import('fflate');
      const files: Record<string, Uint8Array> = {};
      for (const i of done) files[i.outName] = new Uint8Array(await i.blob!.arrayBuffer());
      // immagini già compresse: livello 0 (solo archiviazione)
      const data = zipSync(files, { level: 0 });
      const url = URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/zip' }));
      this.saveUrl(url, 'immagini.zip');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      this.notice.set(this.i18n.t('icv.err.zip'));
    } finally {
      this.zipping.set(false);
    }
  }

  private saveUrl(url: string, name: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---- testi per il template ----
  protected size(bytes: number): string {
    return formatBytes(bytes, this.i18n.locale());
  }
  protected saving(item: Item): string {
    return formatSaving(savingPercent(item.file.size, item.outBytes));
  }
  protected savingTotal(percent: number): string {
    return formatSaving(percent);
  }
  protected label(f: ConvertFormat): string {
    return FORMAT_LABELS[f];
  }
  protected statusLabel(s: Status): string {
    return this.i18n.t('icv.st.' + s);
  }
}
