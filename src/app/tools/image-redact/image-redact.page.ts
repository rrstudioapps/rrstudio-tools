// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, PLATFORM_ID, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, type SegmentOption } from '../../shared/segmented';
import { ShareLink } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import {
  EFFECTS, HANDLES, MAX_BLOCK, MAX_BLUR, MAX_PIXELS, MAX_REGIONS, MIME, MIN_BLOCK, MIN_BLUR, OUT_FORMATS,
  applyRegions, applySafely, clampNumber, clampRect, isHexColor, moveRect, outputName, pushHistory, rectFromPoints, rectToPercent,
  redoHistory, resizeRect, scaleRegions, screenToImage, tooLarge, undoHistory,
  type Effect, type Handle, type History, type OutFormat, type Rect, type Region,
} from './image-redact';
import { RED_DICTIONARIES } from './image-redact.i18n';
import { SHARE_SCHEMA } from './image-redact.share';

type Drag =
  | { kind: 'draw'; x0: number; y0: number; id: number | null }
  | { kind: 'move'; x0: number; y0: number; id: number; rect: Rect }
  | { kind: 'resize'; x0: number; y0: number; id: number; rect: Rect; handle: Handle };

/** Lato lungo massimo dell'anteprima: l'esportazione usa sempre la risoluzione originale. */
const PREVIEW_MAX = 1400;
/** Sotto questa distanza (px dell'immagine) un trascinamento è un semplice clic. */
const MIN_DRAG = 3;

@Component({
  selector: 'app-image-redact',
  imports: [FileDrop, Icon, PrivacyNote, Segmented, ShareLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-redact.page.html',
  styleUrl: './image-redact.page.scss',
})
export class ImageRedactPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('preview');

  protected readonly handles = HANDLES;
  protected readonly minBlock = MIN_BLOCK;
  protected readonly maxBlock = 200;
  protected readonly minBlur = MIN_BLUR;
  protected readonly maxBlur = 100;
  protected readonly rectToPercent = rectToPercent;

  protected readonly loading = signal(false);
  protected readonly working = signal(false);
  protected readonly error = signal('');
  protected readonly status = signal('');
  protected readonly fileName = signal('');
  protected readonly source = signal<{ width: number; height: number } | null>(null);
  private bitmap: ImageBitmap | null = null;
  private base: ImageData | null = null;
  private scale = 1;

  protected readonly regions = signal<Region[]>([]);
  protected readonly selectedId = signal<number | null>(null);
  private history = signal<History<Region[]>>({ past: [], future: [] });
  private nextId = 1;
  /** Istantanea presa prima di una modifica continua (trascinamento, cursore): diventa un passo di cronologia alla fine. */
  private pending: Region[] | null = null;
  private drag: Drag | null = null;

  // ---- impostazioni dell'effetto (valgono per il rettangolo selezionato e per i nuovi) ----
  protected readonly effect = signal<Effect>('fill');
  protected readonly color = signal('#000000');
  protected readonly block = signal(16);
  protected readonly blur = signal(20);
  protected readonly format = signal<OutFormat>('png');
  protected readonly quality = signal(90);

  protected readonly effects = computed<SegmentOption<Effect>[]>(() => EFFECTS.map((e) => ({ value: e, label: this.i18n.t('red.effect.' + e) })));
  protected readonly formats: SegmentOption<OutFormat>[] = OUT_FORMATS.map((f) => ({ value: f, label: f === 'png' ? 'PNG' : 'JPEG' }));
  protected readonly selected = computed(() => this.regions().find((r) => r.id === this.selectedId()) ?? null);
  protected readonly canUndo = computed(() => this.history().past.length > 0);
  protected readonly canRedo = computed(() => this.history().future.length > 0);
  protected readonly stageStyle = computed(() => {
    const s = this.source();
    if (!s) return {};
    return { 'aspect-ratio': `${s.width} / ${s.height}`, width: `min(100%, calc(62vh * ${s.width / s.height}))` };
  });
  protected readonly rows = computed(() =>
    this.regions().map((r, i) => ({ region: r, n: i + 1, label: this.i18n.t('red.item', { n: i + 1, effect: this.i18n.t('red.effect.' + r.effect), x: r.rect.x, y: r.rect.y, w: r.rect.w, h: r.rect.h }) })),
  );

  // ---- link condivisibile: solo impostazioni ----
  protected readonly shareSchema = SHARE_SCHEMA;
  protected readonly shareState = (): ShareData => ({
    effect: this.effect(),
    color: this.color(),
    block: this.block(),
    blur: this.blur(),
    format: this.format(),
    quality: this.quality(),
  });
  protected restoreShared(data: ShareData): void {
    const s = data as Partial<Record<string, unknown>>;
    if (EFFECTS.includes(s['effect'] as Effect)) this.effect.set(s['effect'] as Effect);
    if (typeof s['color'] === 'string' && isHexColor(s['color'])) this.color.set(s['color']);
    if (typeof s['block'] === 'number') this.block.set(Math.round(clampNumber(s['block'], MIN_BLOCK, MAX_BLOCK)));
    if (typeof s['blur'] === 'number') this.blur.set(Math.round(clampNumber(s['blur'], MIN_BLUR, MAX_BLUR)));
    if (OUT_FORMATS.includes(s['format'] as OutFormat)) this.format.set(s['format'] as OutFormat);
    if (typeof s['quality'] === 'number') this.quality.set(Math.round(clampNumber(s['quality'], 10, 100)));
  }

  constructor() {
    this.i18n.register(RED_DICTIONARIES);
    // ridisegna l'anteprima (immagine ridotta con gli effetti) a ogni cambio di rettangoli
    effect(() => {
      const regions = this.regions();
      const src = this.source();
      const canvas = this.canvasRef()?.nativeElement;
      if (!this.browser || !src || !canvas || !this.base) return;
      untracked(() => this.paint(canvas, regions));
    });
  }

  private paint(canvas: HTMLCanvasElement, regions: Region[]): void {
    const base = this.base!;
    if (canvas.width !== base.width || canvas.height !== base.height) {
      canvas.width = base.width;
      canvas.height = base.height;
    }
    const copy = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
    applyRegions(copy.data, base.width, base.height, scaleRegions(regions, this.scale));
    canvas.getContext('2d')?.putImageData(copy, 0, 0);
  }

  // ---- caricamento ----
  protected async onFiles(list: File[]): Promise<void> {
    const file = list.find((f) => /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name));
    if (!file) {
      this.error.set(this.i18n.t('red.err.notImage'));
      return;
    }
    this.error.set('');
    this.status.set('');
    this.loading.set(true);
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      if (tooLarge(bmp.width, bmp.height)) {
        const mp = Math.round((bmp.width * bmp.height) / 100_000) / 10;
        bmp.close();
        this.error.set(this.i18n.t('red.err.tooBig', { mp, max: MAX_PIXELS / 1_000_000 }));
        return;
      }
      this.scale = Math.min(1, PREVIEW_MAX / Math.max(bmp.width, bmp.height));
      const pw = Math.max(1, Math.round(bmp.width * this.scale));
      const ph = Math.max(1, Math.round(bmp.height * this.scale));
      const tmp = document.createElement('canvas');
      tmp.width = pw;
      tmp.height = ph;
      const ctx = tmp.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(bmp, 0, 0, pw, ph);
      this.base = ctx.getImageData(0, 0, pw, ph);
      this.bitmap?.close();
      this.bitmap = bmp;
      this.fileName.set(file.name);
      this.regions.set([]);
      this.selectedId.set(null);
      this.history.set({ past: [], future: [] });
      this.source.set({ width: bmp.width, height: bmp.height });
    } catch {
      this.error.set(this.i18n.t('red.err.decode', { name: file.name }));
    } finally {
      this.loading.set(false);
    }
  }

  // ---- modifica dei rettangoli e cronologia ----
  private commit(next: Region[]): void {
    this.history.set(pushHistory(this.history(), this.regions()));
    this.regions.set(next);
  }
  private begin(): void {
    this.pending ??= this.regions();
  }
  private end(): void {
    const before = this.pending;
    this.pending = null;
    if (before && before !== this.regions()) this.history.set(pushHistory(this.history(), before));
  }
  private patch(id: number, change: Partial<Region>): void {
    this.regions.update((list) => list.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }
  private newRegion(rect: Rect): Region {
    return { id: this.nextId++, rect, effect: this.effect(), color: this.color(), block: this.block(), blur: this.blur() };
  }

  protected add(): void {
    const s = this.source();
    if (!s || this.regions().length >= MAX_REGIONS) return;
    const w = Math.max(1, Math.round(Math.min(s.width, s.height) / 4));
    const rect = clampRect({ x: (s.width - w) / 2, y: (s.height - w) / 2, w, h: w }, s.width, s.height);
    const region = this.newRegion(rect);
    this.commit([...this.regions(), region]);
    this.selectedId.set(region.id);
  }
  protected select(id: number | null): void {
    this.selectedId.set(id);
    const r = this.regions().find((x) => x.id === id);
    if (r) {
      this.effect.set(r.effect);
      this.color.set(r.color);
      this.block.set(r.block);
      this.blur.set(r.blur);
    }
  }
  protected remove(id: number): void {
    this.commit(this.regions().filter((r) => r.id !== id));
    if (this.selectedId() === id) this.selectedId.set(null);
  }
  protected clearAll(): void {
    if (this.regions().length === 0) return;
    this.commit([]);
    this.selectedId.set(null);
  }
  protected undo(): void {
    const res = undoHistory(this.history(), this.regions());
    if (res) this.restore(res.history, res.value);
  }
  protected redo(): void {
    const res = redoHistory(this.history(), this.regions());
    if (res) this.restore(res.history, res.value);
  }
  private restore(history: History<Region[]>, value: Region[]): void {
    this.pending = null;
    this.history.set(history);
    this.regions.set(value);
    if (!value.some((r) => r.id === this.selectedId())) this.selectedId.set(null);
  }

  // ---- impostazioni dell'effetto ----
  protected setEffect(e: Effect): void {
    this.effect.set(e);
    const sel = this.selectedId();
    if (sel !== null) {
      this.begin();
      this.patch(sel, { effect: e });
      this.end();
    }
  }
  /** Cursori e colore: si aggiorna in diretta (input) e si registra un solo passo di cronologia (change). */
  protected setParam(key: 'color' | 'block' | 'blur', raw: string): void {
    if (key === 'color') {
      if (!isHexColor(raw)) return;
      this.color.set(raw);
    } else {
      const n = Math.round(Number(raw));
      if (!Number.isFinite(n)) return;
      this[key].set(n);
    }
    const sel = this.selectedId();
    if (sel !== null) {
      this.begin();
      this.patch(sel, { [key]: key === 'color' ? this.color() : this[key]() });
    }
  }
  protected endParam(): void {
    this.end();
  }

  /** Campi numerici: valori in pixel dell'immagine originale, limitati ai bordi. */
  protected setField(field: keyof Rect, value: string, input: HTMLInputElement): void {
    const sel = this.selected();
    const s = this.source();
    if (!sel || !s) return;
    const n = Number(value);
    if (value.trim() !== '' && Number.isFinite(n)) {
      const rect = clampRect({ ...sel.rect, [field]: n }, s.width, s.height);
      this.commit(this.regions().map((r) => (r.id === sel.id ? { ...r, rect } : r)));
    }
    input.value = String(this.selected()?.rect[field] ?? '');
  }

  // ---- puntatore ----
  private stageBox(e: PointerEvent): DOMRect {
    return (e.currentTarget as HTMLElement).getBoundingClientRect();
  }
  protected onPointerDown(e: PointerEvent): void {
    const s = this.source();
    if (!s || (e.button !== 0 && e.pointerType === 'mouse')) return;
    const target = e.target as HTMLElement;
    const p = screenToImage(e.clientX, e.clientY, this.stageBox(e), s.width, s.height);
    const handle = target.closest<HTMLElement>('[data-handle]')?.dataset['handle'] as Handle | undefined;
    const rid = target.closest<HTMLElement>('[data-rid]')?.dataset['rid'];
    const region = rid ? this.regions().find((r) => r.id === Number(rid)) : undefined;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (region && handle) {
      this.select(region.id);
      this.drag = { kind: 'resize', x0: p.x, y0: p.y, id: region.id, rect: region.rect, handle };
    } else if (region) {
      this.select(region.id);
      this.drag = { kind: 'move', x0: p.x, y0: p.y, id: region.id, rect: region.rect };
    } else {
      this.drag = { kind: 'draw', x0: p.x, y0: p.y, id: null };
    }
    this.begin();
  }
  protected onPointerMove(e: PointerEvent): void {
    const d = this.drag;
    const s = this.source();
    if (!d || !s) return;
    const p = screenToImage(e.clientX, e.clientY, this.stageBox(e), s.width, s.height);
    if (d.kind === 'draw') {
      if (d.id === null) {
        if (Math.hypot(p.x - d.x0, p.y - d.y0) < MIN_DRAG || this.regions().length >= MAX_REGIONS) return;
        const region = this.newRegion(clampRect(rectFromPoints(d.x0, d.y0, p.x, p.y), s.width, s.height));
        d.id = region.id;
        this.regions.update((list) => [...list, region]);
        this.selectedId.set(region.id);
      } else {
        this.patch(d.id, { rect: clampRect(rectFromPoints(d.x0, d.y0, p.x, p.y), s.width, s.height) });
      }
    } else if (d.kind === 'move') {
      this.patch(d.id, { rect: clampRect(moveRect(d.rect, p.x - d.x0, p.y - d.y0, s.width, s.height), s.width, s.height) });
    } else {
      this.patch(d.id, { rect: clampRect(resizeRect(d.rect, d.handle, p.x - d.x0, p.y - d.y0, s.width, s.height), s.width, s.height) });
    }
  }
  protected onPointerUp(): void {
    const d = this.drag;
    this.drag = null;
    // un semplice clic su un punto vuoto toglie la selezione
    if (d?.kind === 'draw' && d.id === null) this.selectedId.set(null);
    this.end();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (!this.source()) return;
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && ['text', 'number'].includes((t as HTMLInputElement).type)));
    if (typing) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if ((e.ctrlKey || e.metaKey) && key === 'y') {
      e.preventDefault();
      this.redo();
    } else if ((key === 'delete' || key === 'backspace') && this.selectedId() !== null && !e.ctrlKey && !e.metaKey && !(t instanceof HTMLButtonElement)) {
      e.preventDefault();
      this.remove(this.selectedId()!);
    }
  }

  // ---- esportazione alla risoluzione originale ----
  protected async download(): Promise<void> {
    const bmp = this.bitmap;
    if (!bmp || this.working()) return;
    if (this.regions().length === 0) {
      this.error.set(this.i18n.t('red.noRects'));
      return;
    }
    this.working.set(true);
    this.error.set('');
    this.status.set('');
    try {
      const fmt = this.format();
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('canvas');
      if (fmt === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, bmp.width, bmp.height);
      }
      ctx.drawImage(bmp, 0, 0);
      const data = ctx.getImageData(0, 0, bmp.width, bmp.height);
      applySafely(data.data, bmp.width, bmp.height, this.regions());
      ctx.putImageData(data, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, MIME[fmt], this.quality() / 100));
      canvas.width = 0;
      if (!blob || blob.type !== MIME[fmt]) throw new Error('encode');
      const name = outputName(this.fileName(), this.i18n.lang() === 'en' ? 'redacted' : 'oscurata', fmt);
      saveBytes(blob, name, MIME[fmt]);
      this.status.set(this.i18n.t('red.done', { name, w: bmp.width, h: bmp.height, kb: Math.max(1, Math.round(blob.size / 1024)), n: this.regions().length }));
    } catch {
      this.error.set(this.i18n.t('red.err.export'));
    } finally {
      this.working.set(false);
    }
  }
}
