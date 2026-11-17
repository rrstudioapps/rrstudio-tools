// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, PLATFORM_ID, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { buildShareUrl } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { parseColor } from '../color-converter/color-convert';
import {
  DEFAULT_COLORS,
  MAX_COLORS,
  MIN_COLORS,
  clampCount,
  colorValues,
  converterText,
  dominantPalette,
  lensOrigin,
  moveCrosshair,
  paletteExport,
  pixelAt,
  pushHistory,
  samplePixels,
  toImageCoords,
  type ExportFormat,
  type Pixel,
  type Rgb,
} from './palette';
import { IMAGE_COLOR_PICKER_DICTIONARIES } from './image-color-picker.i18n';

/** Lato massimo (px) dell'immagine su cui si legge il colore: oltre, viene ridotta. */
const MAX_SIDE = 4096;
/** Lato (px) della zona ingrandita dalla lente: dispari, così c'è un pixel al centro. */
const LENS_PIXELS = 11;
const LENS_SIZE = 143;
/** Lato massimo del campione per la palette. */
const PALETTE_SIDE = 256;

type Source = ImageBitmap | HTMLImageElement;

@Component({
  selector: 'app-image-color-picker',
  imports: [CopyButton, FileDrop, Icon, PrivacyNote, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-color-picker.page.html',
  styleUrl: './image-color-picker.page.scss',
})
export class ImageColorPickerPage {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('img');
  private readonly lensRef = viewChild<ElementRef<HTMLCanvasElement>>('lens');

  protected readonly lensSize = LENS_SIZE;
  protected readonly minColors = MIN_COLORS;
  protected readonly maxColors = MAX_COLORS;

  protected readonly fileName = signal('');
  protected readonly size = signal<{ w: number; h: number; scaledW: number; scaledH: number } | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  /** Posizione del mirino nell'immagine mostrata. */
  protected readonly pos = signal({ x: 0, y: 0 });
  /** Colore mostrato (quello sotto il mirino o quello scelto da storico o palette). */
  protected readonly shown = signal<Pixel | null>(null);
  protected readonly history = signal<string[]>([]);

  protected readonly count = signal(DEFAULT_COLORS);
  private readonly samples = signal<Rgb[]>([]);
  protected readonly exportAs = signal<ExportFormat>('css');
  protected readonly varName = signal('palette');
  private pressing = false;

  protected readonly values = computed(() => {
    const p = this.shown();
    return p ? colorValues(p) : null;
  });
  protected readonly reps = computed(() => {
    const v = this.values();
    if (!v) return [];
    return (['hex', 'rgb', 'hsl', 'oklch'] as const).map((k) => ({ key: k, label: this.i18n.t('cpk.rep.' + k), value: v[k] }));
  });
  protected readonly alphaPct = computed(() => Math.round(((this.shown()?.a ?? 255) / 255) * 100));
  protected readonly palette = computed(() => dominantPalette(this.samples(), this.count()));
  protected readonly exportText = computed(() => paletteExport(this.palette(), this.varName(), this.exportAs()));
  protected readonly exportOptions = computed<SegmentOption<ExportFormat>[]>(() => [
    { value: 'css', label: this.i18n.t('cpk.export.css') },
    { value: 'json', label: this.i18n.t('cpk.export.json') },
  ]);
  protected readonly crossStyle = computed(() => {
    const s = this.size();
    const p = this.pos();
    if (!s) return {};
    return { left: `${((p.x + 0.5) / s.scaledW) * 100}%`, top: `${((p.y + 0.5) / s.scaledH) * 100}%` };
  });
  protected readonly stageStyle = computed(() => {
    const s = this.size();
    return s ? { 'aspect-ratio': `${s.scaledW} / ${s.scaledH}`, width: `min(100%, calc(60vh * ${s.scaledW / s.scaledH}))` } : {};
  });

  constructor() {
    this.i18n.register(IMAGE_COLOR_PICKER_DICTIONARIES);
    // immagini ricevute da un altro strumento: stessa strada del file-drop
    const rx = inject(ToolHandoff).take('image-color-picker');
    if (rx?.files?.length) afterNextRender(() => void this.onFiles(rx.files!));
    // la lente segue il mirino
    effect(() => {
      const p = this.pos();
      this.size();
      if (!this.browser) return;
      untracked(() => this.drawLens(p.x, p.y));
    });
  }

  // ---- file ----
  protected async onFiles(list: File[]): Promise<void> {
    const file = list.find((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|svg)$/i.test(f.name));
    if (!file) {
      this.error.set(this.i18n.t('cpk.err.notImage'));
      return;
    }
    this.error.set('');
    this.loading.set(true);
    try {
      const src = await decode(file);
      const w = src.width;
      const h = src.height;
      const k = Math.min(1, MAX_SIDE / Math.max(w, h));
      const sw = Math.max(1, Math.round(w * k));
      const sh = Math.max(1, Math.round(h * k));
      this.fileName.set(file.name);
      const canvas = this.canvasRef()?.nativeElement;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !ctx) throw new Error('canvas');
      canvas.width = sw;
      canvas.height = sh;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, sw, sh);
      this.makeSamples(src);
      if ('close' in src) src.close();
      this.size.set({ w, h, scaledW: sw, scaledH: sh });
      this.history.set([]);
      this.moveTo(Math.floor(sw / 2), Math.floor(sh / 2));
    } catch {
      this.size.set(null);
      this.shown.set(null);
      this.samples.set([]);
      this.error.set(this.i18n.t('cpk.err.decode', { name: file.name }));
    } finally {
      this.loading.set(false);
    }
  }

  /** Campione ridotto per la palette (lato lungo al massimo PALETTE_SIDE). */
  private makeSamples(src: Source): void {
    const k = Math.min(1, PALETTE_SIDE / Math.max(src.width, src.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(src.width * k));
    c.height = Math.max(1, Math.round(src.height * k));
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, c.width, c.height);
    this.samples.set(samplePixels(ctx.getImageData(0, 0, c.width, c.height).data));
    c.width = c.height = 0;
  }

  // ---- mirino ----
  private readPixel(x: number, y: number): Pixel | null {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return null;
    const px = ctx.getImageData(x, y, 1, 1).data;
    return pixelAt(px, 1, 1, 0, 0);
  }

  protected moveTo(x: number, y: number): void {
    const s = this.size();
    if (!s) return;
    const nx = Math.min(s.scaledW - 1, Math.max(0, x));
    const ny = Math.min(s.scaledH - 1, Math.max(0, y));
    this.pos.set({ x: nx, y: ny });
    const p = this.readPixel(nx, ny);
    if (p) this.shown.set(p);
  }

  private drawLens(x: number, y: number): void {
    const lens = this.lensRef()?.nativeElement;
    const src = this.canvasRef()?.nativeElement;
    if (!lens || !src || !this.size()) return;
    const ctx = lens.getContext('2d');
    if (!ctx) return;
    lens.width = lens.height = LENS_SIZE;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, LENS_SIZE, LENS_SIZE);
    const { sx, sy } = lensOrigin(x, y, LENS_PIXELS);
    // la parte fuori dall'immagine resta vuota: si disegna solo l'intersezione
    const x0 = Math.max(0, sx);
    const y0 = Math.max(0, sy);
    const x1 = Math.min(src.width, sx + LENS_PIXELS);
    const y1 = Math.min(src.height, sy + LENS_PIXELS);
    if (x1 <= x0 || y1 <= y0) return;
    const k = LENS_SIZE / LENS_PIXELS;
    ctx.drawImage(src, x0, y0, x1 - x0, y1 - y0, (x0 - sx) * k, (y0 - sy) * k, (x1 - x0) * k, (y1 - y0) * k);
  }

  protected onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    this.pressing = true;
    this.fromPointer(e);
    this.addCurrent();
  }
  protected onPointerMove(e: PointerEvent): void {
    // mouse: il colore segue il puntatore; touch e penna: solo mentre si tiene premuto
    if (e.pointerType !== 'mouse' && !this.pressing) return;
    this.fromPointer(e);
  }
  protected onPointerUp(e: PointerEvent): void {
    if (this.pressing) {
      this.fromPointer(e);
      this.addCurrent();
    }
    this.pressing = false;
  }
  private fromPointer(e: PointerEvent): void {
    const s = this.size();
    const canvas = this.canvasRef()?.nativeElement;
    if (!s || !canvas) return;
    const p = toImageCoords(e.clientX, e.clientY, canvas.getBoundingClientRect(), s.scaledW, s.scaledH);
    this.moveTo(p.x, p.y);
  }

  protected onKey(e: KeyboardEvent): void {
    const s = this.size();
    if (!s || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.addCurrent();
      return;
    }
    const p = this.pos();
    const next = moveCrosshair(p.x, p.y, e.key, 1, e.shiftKey, s.scaledW, s.scaledH);
    if (next) {
      e.preventDefault();
      this.moveTo(next.x, next.y);
    }
  }

  // ---- storico e scelta ----
  protected addCurrent(): void {
    const v = this.values();
    if (v) this.history.update((h) => pushHistory(h, v.hex));
  }
  protected useHex(hex: string): void {
    const p = parseColor(hex);
    if (p) this.shown.set({ r: Math.round(p.rgb.r), g: Math.round(p.rgb.g), b: Math.round(p.rgb.b), a: 255 });
  }
  protected clearHistory(): void {
    this.history.set([]);
  }

  protected setCount(v: string): void {
    this.count.set(clampCount(Number(v)));
  }
  protected setName(v: string): void {
    this.varName.set(v.slice(0, 30));
  }

  /** Apre il convertitore colori con il colore mostrato (stato nell'hash, mai inviato). */
  protected async openConverter(): Promise<void> {
    const v = this.values();
    if (!v) return;
    const r = await buildShareUrl(this.i18n.link('color-converter'), 'color-converter', { text: converterText(v.hex) });
    if (r.ok) await this.router.navigateByUrl(r.url);
  }

  protected copyLabel(what: string): string {
    return this.i18n.t('cpk.copy', { what });
  }
  protected inkOn(hex: string): string {
    const p = parseColor(hex);
    if (!p) return '#ffffff';
    // luminosità percepita: sopra la metà, testo scuro
    return 0.299 * p.rgb.r + 0.587 * p.rgb.g + 0.114 * p.rgb.b > 150 ? '#111111' : '#ffffff';
  }
  protected scaledNote(): string {
    const s = this.size();
    return s && (s.w !== s.scaledW || s.h !== s.scaledH) ? this.i18n.t('cpk.scaled', { w: s.scaledW, h: s.scaledH }) : '';
  }
}

/** Decodifica con l'orientamento EXIF; per i formati che createImageBitmap non apre (SVG) ripiega su <img>. */
async function decode(file: File): Promise<Source> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (!img.naturalWidth || !img.naturalHeight) throw new Error('size');
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
