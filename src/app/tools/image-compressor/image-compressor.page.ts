// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { formatBytes } from '../../shared/text-stats';
import { CompareSlider } from './compare-slider';
import {
  CompressorSettings,
  DEFAULT_RESIZE_VALUE,
  DEFAULT_SETTINGS,
  FORMAT_MIME,
  MAX_FILES,
  MAX_FILE_BYTES,
  OutputFormat,
  ResizeMode,
  clampQuality,
  formatSaving,
  inputMime,
  outputFileName,
  resolveOutputMime,
  savingPercent,
  shouldKeepOriginal,
  uniqueNames,
} from './image-compressor';
import { IMAGE_COMPRESSOR_DICTIONARIES } from './image-compressor.i18n';
import { detectEncodableFormats } from './image-processor';
import { ProcessorClient } from './processor-client';

type Status = 'queued' | 'processing' | 'done' | 'error';

interface Item {
  id: number;
  file: File;
  sourceMime: string;
  /** Object URL dell'originale (per il confronto). */
  url: string;
  thumbUrl: string | null;
  status: Status;
  srcWidth: number;
  srcHeight: number;
  outWidth: number;
  outHeight: number;
  outBytes: number;
  outMime: string;
  /** Blob da scaricare: il risultato oppure, se più pesante, l'originale. */
  blob: Blob | null;
  resultUrl: string | null;
  kept: boolean;
  /** Nome del file di uscita. */
  outName: string;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp';
const DEBOUNCE_MS = 300;

@Component({
  selector: 'app-image-compressor',
  imports: [Icon, PrivacyNote, FileDrop, CompareSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-compressor.page.html',
  styleUrl: './image-compressor.page.scss',
})
export class ImageCompressorPage {
  protected readonly i18n = inject(I18nService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly accept = ACCEPT;
  protected readonly maxFiles = MAX_FILES;

  protected readonly settings = signal<CompressorSettings>({ ...DEFAULT_SETTINGS });
  protected readonly items = signal<Item[]>([]);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly supported = signal<ReadonlySet<string>>(new Set(['image/jpeg', 'image/png', 'image/webp']));
  protected readonly notice = signal<string>('');
  protected readonly zipping = signal(false);

  private readonly client = new ProcessorClient();
  private nextId = 1;
  /** Cambia a ogni modifica delle impostazioni: i risultati di una generazione vecchia si scartano. */
  private generation = 0;
  private running = false;

  protected readonly formats = computed(() => {
    const sup = this.supported();
    const list: { value: OutputFormat; label: string }[] = [
      { value: 'original', label: this.i18n.t('ic.fmt.original') },
      { value: 'jpeg', label: 'JPEG' },
      { value: 'webp', label: 'WebP' },
      { value: 'png', label: 'PNG' },
      { value: 'avif', label: 'AVIF' },
    ];
    return list.filter((f) => f.value === 'original' || sup.has(FORMAT_MIME[f.value]));
  });

  protected readonly resizeModes = computed<{ value: ResizeMode; label: string }[]>(() => [
    { value: 'none', label: this.i18n.t('ic.resize.none') },
    { value: 'width', label: this.i18n.t('ic.resize.width') },
    { value: 'height', label: this.i18n.t('ic.resize.height') },
    { value: 'percent', label: this.i18n.t('ic.resize.percent') },
  ]);

  protected readonly qualityDisabled = computed(() => this.settings().format === 'png');
  /** Lo sfondo conta solo se almeno un file esce come JPEG. */
  protected readonly backgroundUsed = computed(() => {
    const f = this.settings().format;
    return f === 'jpeg' || f === 'original';
  });

  protected readonly selected = computed(() => {
    const id = this.selectedId();
    const list = this.items();
    return list.find((i) => i.id === id && i.status === 'done') ?? list.find((i) => i.status === 'done') ?? null;
  });

  protected readonly doneCount = computed(() => this.items().filter((i) => i.status === 'done').length);
  protected readonly busy = computed(() => this.items().some((i) => i.status === 'queued' || i.status === 'processing'));

  protected readonly summary = computed(() => {
    const done = this.items().filter((i) => i.status === 'done');
    if (done.length === 0) return null;
    const before = done.reduce((n, i) => n + i.file.size, 0);
    const after = done.reduce((n, i) => n + i.outBytes, 0);
    return { before, after, percent: savingPercent(before, after), count: done.length };
  });

  protected readonly statusText = computed(() => {
    const list = this.items();
    if (list.length === 0) return '';
    const done = list.filter((i) => i.status === 'done' || i.status === 'error').length;
    if (done < list.length) return this.i18n.t('ic.status.progress', { done, total: list.length });
    return this.i18n.t('ic.status.complete', { count: list.length });
  });

  constructor() {
    this.i18n.register(IMAGE_COMPRESSOR_DICTIONARIES);
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.client.dispose();
      this.generation++;
      for (const i of this.items()) this.revoke(i);
    });
    if (this.isBrowser) {
      void detectEncodableFormats().then((s) => this.supported.set(s));
    }
    // Impostazioni cambiate: dopo un breve debounce si rielabora tutto
    effect((onCleanup) => {
      this.settings();
      if (untracked(() => this.items().length) === 0) return;
      const t = setTimeout(() => this.requeueAll(), DEBOUNCE_MS);
      onCleanup(() => clearTimeout(t));
    });
  }

  // ---- impostazioni ----
  protected setFormat(v: string): void {
    this.settings.update((s) => ({ ...s, format: v as OutputFormat }));
  }
  protected setQuality(v: string): void {
    this.settings.update((s) => ({ ...s, quality: clampQuality(Number(v)) }));
  }
  protected setResizeMode(v: string): void {
    const mode = v as ResizeMode;
    this.settings.update((s) => ({ ...s, resizeMode: mode, resizeValue: DEFAULT_RESIZE_VALUE[mode] }));
  }
  protected setResizeValue(v: string): void {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n > 0) this.settings.update((s) => ({ ...s, resizeValue: n }));
  }
  protected setBackground(v: string): void {
    this.settings.update((s) => ({ ...s, background: v }));
  }

  // ---- file ----
  protected onFiles(files: File[]): void {
    let rejectedType = 0;
    let rejectedSize = 0;
    let rejectedCount = 0;
    const added: Item[] = [];
    const room = MAX_FILES - this.items().length;
    for (const file of files) {
      const mime = inputMime(file);
      if (!mime) rejectedType++;
      else if (file.size > MAX_FILE_BYTES) rejectedSize++;
      else if (added.length >= room) rejectedCount++;
      else {
        added.push({
          id: this.nextId++,
          file,
          sourceMime: mime,
          url: URL.createObjectURL(file),
          thumbUrl: null,
          status: 'queued',
          srcWidth: 0,
          srcHeight: 0,
          outWidth: 0,
          outHeight: 0,
          outBytes: 0,
          outMime: '',
          blob: null,
          resultUrl: null,
          kept: false,
          outName: '',
        });
      }
    }
    const msgs: string[] = [];
    if (rejectedType) msgs.push(this.i18n.t('ic.err.type', { n: rejectedType }));
    if (rejectedSize) msgs.push(this.i18n.t('ic.err.size', { n: rejectedSize }));
    if (rejectedCount) msgs.push(this.i18n.t('ic.err.count', { n: rejectedCount, max: MAX_FILES }));
    this.notice.set(msgs.join(' '));
    if (added.length === 0) return;
    this.items.update((l) => [...l, ...added]);
    this.refreshNames();
    void this.run();
  }

  protected select(item: Item): void {
    if (item.status === 'done') this.selectedId.set(item.id);
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
    this.selectedId.set(null);
    this.notice.set('');
  }

  private revoke(i: Item): void {
    URL.revokeObjectURL(i.url);
    if (i.thumbUrl) URL.revokeObjectURL(i.thumbUrl);
    if (i.resultUrl) URL.revokeObjectURL(i.resultUrl);
  }

  private patch(id: number, p: Partial<Item>): void {
    this.items.update((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }

  /** Rimette in coda ogni file (nuove impostazioni). */
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
        const settings = this.settings();
        this.patch(item.id, { status: 'processing' });
        const mime = resolveOutputMime(item.sourceMime, settings.format, this.supported());
        try {
          const r = await this.client.process({ file: item.file, settings, mime, wantThumb: item.thumbUrl === null });
          if (gen !== this.generation) continue; // impostazioni cambiate nel frattempo
          if (!this.items().some((i) => i.id === item.id)) continue; // rimosso
          const keep = shouldKeepOriginal(item.sourceMime, mime, item.file.size, r.blob.size);
          const blob = keep ? item.file : r.blob;
          const outMime = keep ? item.sourceMime : mime;
          if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
          this.patch(item.id, {
            status: 'done',
            srcWidth: r.srcWidth,
            srcHeight: r.srcHeight,
            outWidth: keep ? r.srcWidth : r.width,
            outHeight: keep ? r.srcHeight : r.height,
            outBytes: blob.size,
            outMime,
            blob,
            kept: keep,
            resultUrl: URL.createObjectURL(blob),
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
    const base = list.map((i) => outputFileName(i.file.name, i.outMime || i.sourceMime));
    const names = uniqueNames(base);
    if (list.some((i, n) => i.outName !== names[n])) {
      this.items.set(list.map((i, n) => ({ ...i, outName: names[n] })));
    }
  }

  // ---- download ----
  protected download(item: Item): void {
    if (!item.resultUrl) return;
    this.saveUrl(item.resultUrl, item.outName);
  }

  protected async downloadZip(): Promise<void> {
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
      this.notice.set(this.i18n.t('ic.err.zip'));
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
  protected px(w: number, h: number): string {
    return `${w}×${h}`;
  }
  protected saving(item: Item): string {
    return formatSaving(savingPercent(item.file.size, item.outBytes));
  }
  protected savingTotal(percent: number): string {
    return formatSaving(percent);
  }
  protected statusLabel(s: Status): string {
    return this.i18n.t(`ic.st.${s}`);
  }
  protected formatLabel(mime: string): string {
    return mime.replace('image/', '').toUpperCase();
  }
}
