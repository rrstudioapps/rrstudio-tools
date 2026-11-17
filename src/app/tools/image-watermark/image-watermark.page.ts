// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, PLATFORM_ID, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { I18nService } from '../../core/i18n/i18n.service';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { formatBytes } from '../../shared/text-stats';
import { FORMAT_MIME, MAX_FILES, MAX_FILE_BYTES, inputMime } from '../image-compressor/image-compressor';
import { parseRanges } from '../pdf-tools/page-ranges';
import { PasswordProtectedError, openPdf } from '../pdf-tools/pdf-thumbs';
import { EncryptedPdfError } from '../pdf-sign/pdf-sign';
import { renderPage } from '../pdf-sign/pdf-sign-render';
import {
  ANCHORS,
  DEFAULT_SETTINGS,
  FONT_IDS,
  LIMITS,
  MAX_TEXT,
  clampField,
  cleanText,
  hasContent,
  isFontId,
  isHexColor,
  isPlacement,
  outputNames,
  pagesFromRanges,
  type FontId,
  type Placement,
  type WatermarkKind,
  type WatermarkSettings,
} from './image-watermark';
import { watermarkPdf } from './image-watermark-pdf';
import { drawPreview, loadBitmap, logoToPng, renderImage } from './image-watermark-render';
import { IMAGE_WATERMARK_DICTIONARIES } from './image-watermark.i18n';
import { SHARE_SCHEMA } from './image-watermark.share';

type OutFormat = 'original' | 'png' | 'jpeg' | 'webp';
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,application/pdf,.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp,.pdf';
const SAFE_ORIGINAL = ['image/jpeg', 'image/png', 'image/webp'];

interface Item {
  id: number;
  file: File;
  kind: 'image' | 'pdf';
}

/** Errore di un singolo file, con il testo già pronto. */
class ItemError extends Error {}

const isPdf = (f: File): boolean => f.type === 'application/pdf' || (f.type === '' && /\.pdf$/i.test(f.name));

@Component({
  selector: 'app-image-watermark',
  imports: [FileDrop, Icon, PrivacyNote, Segmented, SendTo, ShareLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-watermark.page.html',
  styleUrl: './image-watermark.page.scss',
})
export class ImageWatermarkPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('preview');

  protected readonly accept = ACCEPT;
  protected readonly maxFiles = MAX_FILES;
  protected readonly maxText = MAX_TEXT;
  protected readonly limits = LIMITS;
  protected readonly anchors = ANCHORS;
  protected readonly shareSchema = SHARE_SCHEMA;

  protected readonly settings = signal<WatermarkSettings>({ ...DEFAULT_SETTINGS });
  protected readonly pagesText = signal('');
  protected readonly format = signal<OutFormat>('original');
  protected readonly quality = signal(90);

  protected readonly items = signal<Item[]>([]);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly working = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly status = signal('');
  protected readonly logoName = signal('');
  /** Si incrementa quando cambia il logo o la sorgente dell'anteprima: forza il ridisegno. */
  private readonly drawTick = signal(0);
  protected readonly hasSource = signal(false);

  private nextId = 1;
  private logo: ImageBitmap | null = null;
  private source: ImageBitmap | HTMLCanvasElement | null = null;
  private pdfDoc: PDFDocumentProxy | null = null;
  private pdfPages = 0;
  private previewToken = 0;

  protected readonly selected = computed(() => this.items().find((i) => i.id === this.selectedId()) ?? null);
  protected readonly hasPdf = computed(() => this.items().some((i) => i.kind === 'pdf'));
  protected readonly imageCount = computed(() => this.items().filter((i) => i.kind === 'image').length);
  protected readonly ready = computed(() => this.items().length > 0 && hasContent(this.settings(), this.logoName() !== ''));
  protected readonly isImageKind = computed(() => this.settings().kind === 'image');
  protected readonly isTile = computed(() => this.settings().position === 'tile');
  protected readonly qualityOn = computed(() => this.format() !== 'png');

  protected readonly kinds = computed<SegmentOption<WatermarkKind>[]>(() => [
    { value: 'text', label: this.i18n.t('wm.kind.text') },
    { value: 'image', label: this.i18n.t('wm.kind.image') },
  ]);
  protected readonly fonts = computed<SegmentOption<FontId>[]>(() => FONT_IDS.map((f) => ({ value: f, label: this.i18n.t('wm.font.' + f) })));
  protected readonly formats = computed<SegmentOption<OutFormat>[]>(() => [
    { value: 'original', label: this.i18n.t('wm.format.original') },
    { value: 'png', label: 'PNG' },
    { value: 'jpeg', label: 'JPG' },
    { value: 'webp', label: 'WebP' },
  ]);
  /** Pagina del PDF mostrata nell'anteprima: la prima dell'intervallo scritto (o la 1). */
  private previewPage(): number {
    const t = this.pagesText().trim();
    if (!t || this.pdfPages === 0) return 0;
    const r = parseRanges(t, this.pdfPages);
    return r.ok ? r.ranges[0].from - 1 : 0;
  }

  // Link di condivisione: solo le opzioni testuali, mai immagini, logo o PDF
  protected readonly shareState = (): ShareData => {
    const s = this.settings();
    return {
      text: s.text,
      font: s.font,
      bold: s.bold,
      sizePct: s.sizePct,
      color: s.color,
      opacity: s.opacity,
      rotation: s.rotation,
      position: s.position,
      margin: s.margin,
      gap: s.gap,
      format: this.format(),
      quality: this.quality(),
    };
  };

  constructor() {
    this.i18n.register(IMAGE_WATERMARK_DICTIONARIES);
    // immagini ricevute da un altro strumento: stessa strada del file-drop
    const rx = inject(ToolHandoff).take('image-watermark');
    if (rx?.files?.length) afterNextRender(() => void this.onFiles(rx.files!));
    inject(DestroyRef).onDestroy(() => {
      this.previewToken++;
      this.logo?.close();
      this.releaseSource();
    });
    // ridisegna l'anteprima a ogni cambio di opzioni, logo o sorgente
    effect(() => {
      const s = this.settings();
      this.drawTick();
      const canvas = this.canvasRef()?.nativeElement;
      if (!this.browser || !canvas || !this.hasSource()) return;
      untracked(() => {
        if (this.source) drawPreview(canvas, this.source, s, this.logo);
      });
    });
    // l'anteprima di un PDF segue la prima pagina dell'intervallo
    effect(() => {
      this.pagesText();
      if (!this.browser) return;
      untracked(() => {
        if (this.pdfDoc) void this.renderPdfPreview(this.previewPage());
      });
    });
  }

  // ---- opzioni ----
  protected patch(p: Partial<WatermarkSettings>): void {
    this.settings.update((s) => ({ ...s, ...p }));
  }
  protected setNum(key: 'sizePct' | 'opacity' | 'rotation' | 'margin' | 'gap' | 'logoScale', v: string): void {
    this.patch({ [key]: clampField(key, v, DEFAULT_SETTINGS[key]) });
  }
  protected setText(v: string): void {
    this.patch({ text: v.replace(/[\r\n]+/g, ' ').slice(0, MAX_TEXT) });
  }
  protected setColor(v: string): void {
    if (isHexColor(v)) this.patch({ color: v });
  }
  protected setPosition(p: Placement): void {
    this.patch({ position: p });
  }
  protected setQuality(v: string): void {
    const n = Math.round(Number(v));
    if (Number.isFinite(n)) this.quality.set(Math.min(100, Math.max(1, n)));
  }

  protected restoreShared(data: ShareData): void {
    const t: Partial<Record<keyof WatermarkSettings, unknown>> = {};
    applyShare(data, {
      text: { set: (v: string) => (t.text = v) },
      font: { set: (v: string) => (t.font = v) },
      bold: { set: (v: boolean) => (t.bold = v) },
      sizePct: { set: (v: number) => (t.sizePct = v) },
      color: { set: (v: string) => (t.color = v) },
      opacity: { set: (v: number) => (t.opacity = v) },
      rotation: { set: (v: number) => (t.rotation = v) },
      position: { set: (v: string) => (t.position = v) },
      margin: { set: (v: number) => (t.margin = v) },
      gap: { set: (v: number) => (t.gap = v) },
      format: { set: (v: OutFormat) => this.format.set(v) },
      quality: { set: (v: number) => this.quality.set(v) },
    });
    this.settings.update((s) => ({
      ...s,
      kind: 'text',
      text: typeof t.text === 'string' ? cleanText(t.text) : s.text,
      font: isFontId(t.font) ? t.font : s.font,
      bold: typeof t.bold === 'boolean' ? t.bold : s.bold,
      sizePct: typeof t.sizePct === 'number' ? clampField('sizePct', t.sizePct, s.sizePct) : s.sizePct,
      color: typeof t.color === 'string' && isHexColor(t.color) ? t.color : s.color,
      opacity: typeof t.opacity === 'number' ? clampField('opacity', t.opacity, s.opacity) : s.opacity,
      rotation: typeof t.rotation === 'number' ? clampField('rotation', t.rotation, s.rotation) : s.rotation,
      position: isPlacement(t.position) ? t.position : s.position,
      margin: typeof t.margin === 'number' ? clampField('margin', t.margin, s.margin) : s.margin,
      gap: typeof t.gap === 'number' ? clampField('gap', t.gap, s.gap) : s.gap,
    }));
  }

  // ---- logo ----
  protected async onLogo(files: FileList | null): Promise<void> {
    const f = files?.[0];
    if (!f) return;
    try {
      const bmp = await loadBitmap(f);
      this.logo?.close();
      this.logo = bmp;
      this.logoName.set(f.name);
      this.error.set('');
      this.drawTick.update((n) => n + 1);
    } catch {
      this.error.set(this.i18n.t('wm.err.logo'));
    }
  }

  // ---- file ----
  protected async onFiles(list: File[]): Promise<void> {
    let badType = 0;
    let tooBig = 0;
    let tooMany = 0;
    const added: Item[] = [];
    const room = MAX_FILES - this.items().length;
    for (const file of list) {
      const pdf = isPdf(file);
      if (!pdf && !inputMime(file)) badType++;
      else if (file.size > MAX_FILE_BYTES) tooBig++;
      else if (added.length >= room) tooMany++;
      else added.push({ id: this.nextId++, file, kind: pdf ? 'pdf' : 'image' });
    }
    const msgs: string[] = [];
    if (badType) msgs.push(this.i18n.t('wm.err.type', { n: badType }));
    if (tooBig) msgs.push(this.i18n.t('wm.err.size', { n: tooBig }));
    if (tooMany) msgs.push(this.i18n.t('wm.err.count', { n: tooMany, max: MAX_FILES }));
    this.notice.set(msgs.join(' '));
    this.status.set('');
    if (added.length === 0) return;
    this.items.update((l) => [...l, ...added]);
    if (this.selectedId() === null) await this.select(added[0].id);
  }

  protected async select(id: number): Promise<void> {
    const item = this.items().find((i) => i.id === id);
    if (!item) return;
    this.selectedId.set(id);
    const token = ++this.previewToken;
    this.loading.set(true);
    this.error.set('');
    try {
      if (item.kind === 'image') {
        const bmp = await loadBitmap(item.file);
        if (token !== this.previewToken) return void bmp.close();
        this.releaseSource();
        this.source = bmp;
      } else {
        const bytes = new Uint8Array(await item.file.arrayBuffer());
        const doc = await openPdf(bytes);
        if (token !== this.previewToken) return void doc.loadingTask.destroy();
        this.releaseSource();
        this.pdfDoc = doc;
        this.pdfPages = doc.numPages;
        this.source = document.createElement('canvas');
        await renderPage(doc, this.previewPage(), this.source);
        if (token !== this.previewToken) return;
      }
      this.hasSource.set(true);
      this.drawTick.update((n) => n + 1);
    } catch (e) {
      this.hasSource.set(false);
      this.error.set(this.i18n.t(item.kind === 'pdf' ? (e instanceof PasswordProtectedError ? 'wm.err.encrypted' : 'wm.err.pdf') : 'wm.err.decode', { name: item.file.name }));
    } finally {
      if (token === this.previewToken) this.loading.set(false);
    }
  }

  private async renderPdfPreview(page: number): Promise<void> {
    const doc = this.pdfDoc;
    const canvas = this.source;
    if (!doc || !(canvas instanceof HTMLCanvasElement) || page >= doc.numPages) return;
    if (await renderPage(doc, page, canvas)) this.drawTick.update((n) => n + 1);
  }

  private releaseSource(): void {
    if (this.source && 'close' in this.source) this.source.close();
    this.source = null;
    void this.pdfDoc?.loadingTask.destroy();
    this.pdfDoc = null;
    this.pdfPages = 0;
    this.hasSource.set(false);
  }

  protected async remove(item: Item): Promise<void> {
    const rest = this.items().filter((i) => i.id !== item.id);
    this.items.set(rest);
    if (this.selectedId() === item.id) {
      this.selectedId.set(null);
      this.previewToken++;
      this.releaseSource();
      if (rest.length) await this.select(rest[0].id);
    }
  }

  protected clearAll(): void {
    this.items.set([]);
    this.selectedId.set(null);
    this.previewToken++;
    this.releaseSource();
    this.notice.set('');
    this.status.set('');
    this.error.set('');
  }

  // ---- elaborazione ----
  private mimeFor(file: File): string {
    const f = this.format();
    if (f !== 'original') return FORMAT_MIME[f];
    const m = inputMime(file);
    return m && SAFE_ORIGINAL.includes(m) ? m : 'image/png';
  }

  private async processItem(item: Item, s: WatermarkSettings, logoPng: Uint8Array | null): Promise<Blob> {
    if (item.kind === 'image') {
      try {
        return await renderImage(item.file, s, this.logo, this.mimeFor(item.file), this.quality());
      } catch (e) {
        throw new ItemError(this.i18n.t((e as Error).message === 'size' ? 'wm.err.big' : 'wm.err.item', { name: item.file.name }));
      }
    }
    const text = this.pagesText().trim();
    let rangeError = '';
    try {
      const res = await watermarkPdf(
        new Uint8Array(await item.file.arrayBuffer()),
        s,
        (total) => {
          if (!text) return pagesFromRanges(null, total);
          const r = parseRanges(text, total);
          if (!r.ok) {
            rangeError = this.i18n.t('wm.err.range', { name: item.file.name, total, detail: r.error.token });
            throw new Error('range');
          }
          return pagesFromRanges(r.ranges, total);
        },
        logoPng,
      );
      if (res.replaced) this.notice.set(this.i18n.t('wm.replaced', { name: item.file.name }));
      return new Blob([res.bytes as BlobPart], { type: 'application/pdf' });
    } catch (e) {
      if (rangeError) throw new ItemError(rangeError);
      const key = e instanceof EncryptedPdfError ? 'wm.err.encrypted' : 'wm.err.item';
      throw new ItemError(this.i18n.t(key, { name: item.file.name }));
    }
  }

  /** Applica la filigrana a tutti i file (o solo alle immagini); gli errori di un file non fermano gli altri. */
  private async processAll(onlyImages: boolean): Promise<{ name: string; blob: Blob }[]> {
    const s = this.settings();
    const list = this.items().filter((i) => !onlyImages || i.kind === 'image');
    if (list.length === 0) return [];
    const errors: string[] = [];
    this.error.set('');
    this.notice.set('');
    const logoPng = s.kind === 'image' && this.logo && list.some((i) => i.kind === 'pdf') ? await logoToPng(this.logo) : null;
    const done: { item: Item; blob: Blob }[] = [];
    for (const [n, item] of list.entries()) {
      this.status.set(this.i18n.t('wm.working', { done: n, total: list.length }));
      try {
        done.push({ item, blob: await this.processItem(item, s, logoPng) });
      } catch (e) {
        errors.push(e instanceof ItemError ? e.message : this.i18n.t('wm.err.item', { name: item.file.name }));
      }
    }
    if (errors.length) this.error.set(errors.join(' '));
    const names = outputNames(
      done.map((d) => ({ name: d.item.file.name, mime: d.blob.type })),
      this.i18n.lang() === 'en' ? 'watermark' : 'filigrana',
    );
    return done.map((d, i) => ({ name: names[i], blob: d.blob }));
  }

  /** Le immagini con la filigrana come file, per "Invia a…". */
  protected readonly imageFiles = async (): Promise<File[]> => {
    if (this.working() || !this.ready()) return [];
    this.working.set(true);
    try {
      const out = await this.processAll(true);
      this.status.set('');
      return out.map((o) => new File([o.blob], o.name, { type: o.blob.type }));
    } finally {
      this.working.set(false);
    }
  };

  protected async download(): Promise<void> {
    if (this.working()) return;
    if (this.items().length === 0) return void this.error.set(this.i18n.t('wm.err.nofiles'));
    if (!this.ready()) return void this.error.set(this.i18n.t('wm.err.empty'));
    this.working.set(true);
    try {
      const out = await this.processAll(false);
      if (out.length === 0) {
        this.status.set('');
        return;
      }
      if (out.length === 1) {
        saveBytes(out[0].blob, out[0].name, out[0].blob.type);
        this.status.set(this.i18n.t('wm.done.one', { name: out[0].name }));
        return;
      }
      try {
        const { zipSync } = await import('fflate');
        const files: Record<string, Uint8Array> = {};
        for (const o of out) files[o.name] = new Uint8Array(await o.blob.arrayBuffer());
        // immagini e PDF sono già compressi: solo archiviazione
        saveBytes(new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: 'application/zip' }), this.i18n.lang() === 'en' ? 'watermarked.zip' : 'filigrana.zip', 'application/zip');
        this.status.set(this.i18n.t('wm.done', { count: out.length }));
      } catch {
        this.error.set(this.i18n.t('wm.err.zip'));
        this.status.set('');
      }
    } finally {
      this.working.set(false);
    }
  }

  protected size(bytes: number): string {
    return formatBytes(bytes, this.i18n.locale());
  }
}
