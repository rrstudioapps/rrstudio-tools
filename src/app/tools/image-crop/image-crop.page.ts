// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, PLATFORM_ID, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import {
  ASPECTS,
  ASPECT_IDS,
  HANDLES,
  MIME,
  clampRect,
  cropFileName,
  defaultCrop,
  fitRatio,
  moveRect,
  normalizeAngle,
  nudgeRect,
  outputSize,
  parseDimension,
  resizeRect,
  roundRect,
  type AspectId,
  type Handle,
  type OutFormat,
  type Rect,
  type Size,
} from './image-crop';
import { drawPreview, exportCrop, loadBitmap, transformedSize } from './image-crop-render';
import { IMAGE_CROP_DICTIONARIES } from './image-crop.i18n';

type DragMode = { kind: 'move' } | { kind: 'resize'; handle: Handle };

@Component({
  selector: 'app-image-crop',
  imports: [FileDrop, Icon, PrivacyNote, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-crop.page.html',
  styleUrl: './image-crop.page.scss',
})
export class ImageCropPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('preview');

  protected readonly handles = HANDLES;
  protected readonly aspectIds = ASPECT_IDS;

  protected readonly files = signal<File[]>([]);
  protected readonly current = signal(0);
  private bitmap: ImageBitmap | null = null;
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly status = signal('');
  protected readonly note = signal('');
  protected readonly working = signal(false);
  /** Dimensione originale (con orientamento EXIF applicato). */
  protected readonly source = signal<Size | null>(null);

  // ---- trasformazioni ----
  protected readonly quarter = signal(0);
  protected readonly tilt = signal(0);
  protected readonly flipH = signal(false);
  protected readonly flipV = signal(false);
  protected readonly angle = computed(() => normalizeAngle(this.quarter() * 90 + this.tilt()));

  // ---- ritaglio ----
  protected readonly aspect = signal<AspectId>('free');
  protected readonly ratio = computed(() => ASPECTS[this.aspect()]);
  /** Immagine trasformata (riquadro che contiene l'immagine ruotata): è lo spazio delle coordinate del ritaglio. */
  protected readonly bounds = signal<Size>({ width: 1, height: 1 });
  protected readonly crop = signal<Rect>({ x: 0, y: 0, w: 1, h: 1 });
  private cropVersion = 0;

  // ---- uscita ----
  protected readonly format = signal<OutFormat>('png');
  protected readonly quality = signal(90);
  protected readonly lock = signal(true);
  protected readonly outW = signal('');
  protected readonly outH = signal('');
  private driver: 'width' | 'height' = 'width';

  protected readonly aspects = computed<SegmentOption<AspectId>[]>(() =>
    ASPECT_IDS.map((id) => ({ value: id, label: this.i18n.t(id === 'free' ? 'crop.aspect.free' : id === 'id' ? 'crop.aspect.id' : 'crop.aspect.n', { r: id }) })),
  );
  protected readonly formats: SegmentOption<OutFormat>[] = [
    { value: 'png', label: 'PNG' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'webp', label: 'WebP' },
  ];

  protected readonly rounded = computed(() => roundRect(this.crop(), this.bounds()));
  protected readonly result = computed(() => {
    const w = parseDimension(this.outW());
    const h = parseDimension(this.outH());
    const r = this.rounded();
    // con proporzioni fisse la dimensione finale segue il rapporto esatto, non quello arrotondato ai pixel del ritaglio
    const ratio = this.ratio();
    const crop = ratio && (w !== null || h !== null) ? { width: ratio * 1000, height: 1000 } : { width: r.w, height: r.h };
    return outputSize(crop, { width: w, height: h, lock: this.lock(), driver: this.driver });
  });
  protected readonly cropStyle = computed(() => {
    const b = this.bounds();
    const c = this.crop();
    return {
      left: `${(c.x / b.width) * 100}%`,
      top: `${(c.y / b.height) * 100}%`,
      width: `${(c.w / b.width) * 100}%`,
      height: `${(c.h / b.height) * 100}%`,
    };
  });
  protected readonly stageStyle = computed(() => {
    const b = this.bounds();
    return { 'aspect-ratio': `${b.width} / ${b.height}`, width: `min(100%, calc(62vh * ${b.width / b.height}))` };
  });
  protected readonly fileName = computed(() => this.files()[this.current()]?.name ?? '');
  protected readonly angleLabel = computed(() => `${this.angle()}°`);

  private drag: { mode: DragMode; startX: number; startY: number; rect: Rect; scale: number } | null = null;

  constructor() {
    this.i18n.register(IMAGE_CROP_DICTIONARIES);
    // ridisegna l'anteprima e riporta il ritaglio sui limiti nuovi quando cambia la trasformazione
    effect(() => {
      const angle = this.angle();
      const fh = this.flipH();
      const fv = this.flipV();
      const src = this.source();
      const canvas = this.canvasRef()?.nativeElement;
      if (!this.browser || !src || !canvas || !this.bitmap) return;
      untracked(() => {
        const size = drawPreview(canvas, this.bitmap!, { angle, flipH: fh, flipV: fv });
        const prev = this.bounds();
        this.bounds.set(size);
        if (prev.width !== size.width || prev.height !== size.height || this.cropVersion === 0) {
          this.crop.set(defaultCrop(size, this.ratio()));
          this.cropVersion++;
        }
      });
    });
  }

  protected async onFiles(list: File[]): Promise<void> {
    const images = list.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|svg)$/i.test(f.name));
    if (images.length === 0) {
      this.error.set(this.i18n.t('crop.err.notImage'));
      return;
    }
    this.error.set('');
    this.note.set(list.length > images.length ? this.i18n.t('crop.err.skipped', { n: list.length - images.length }) : '');
    this.files.set(images);
    await this.open(0);
  }

  protected async select(value: string): Promise<void> {
    await this.open(Number(value));
  }

  private async open(index: number): Promise<void> {
    const file = this.files()[index];
    if (!file) return;
    this.loading.set(true);
    this.status.set('');
    try {
      const bmp = await loadBitmap(file);
      this.bitmap?.close();
      this.bitmap = bmp;
      this.current.set(index);
      this.quarter.set(0);
      this.tilt.set(0);
      this.flipH.set(false);
      this.flipV.set(false);
      this.outW.set('');
      this.outH.set('');
      this.cropVersion = 0;
      this.bounds.set(transformedSize(bmp, 0).size);
      this.source.set({ width: bmp.width, height: bmp.height });
    } catch {
      this.error.set(this.i18n.t('crop.err.decode', { name: file.name }));
      this.source.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  // ---- trasformazioni ----
  protected turn(dir: 1 | -1): void {
    this.quarter.update((q) => (q + dir + 4) % 4);
  }
  protected setTilt(v: string): void {
    const n = Number(v);
    this.tilt.set(Number.isFinite(n) ? Math.min(45, Math.max(-45, n)) : 0);
  }
  protected resetTransform(): void {
    this.quarter.set(0);
    this.tilt.set(0);
    this.flipH.set(false);
    this.flipV.set(false);
  }

  // ---- ritaglio ----
  protected setAspect(id: AspectId): void {
    this.aspect.set(id);
    this.crop.update((c) => fitRatio(c, this.bounds(), ASPECTS[id]));
  }
  protected resetCrop(): void {
    this.crop.set(defaultCrop(this.bounds(), this.ratio()));
  }
  protected setField(field: 'x' | 'y' | 'w' | 'h', value: string, input: HTMLInputElement): void {
    const n = Number(value);
    const c = this.rounded();
    if (Number.isFinite(n) && value.trim() !== '') {
      let r: Rect = { ...c, [field]: n };
      const ratio = this.ratio();
      if (ratio && field === 'w') r = { ...r, h: n / ratio };
      if (ratio && field === 'h') r = { ...r, w: n * ratio };
      const b = this.bounds();
      r = ratio ? fitRatio(clampRect(r, b), b, ratio) : clampRect(r, b);
      this.crop.set(r);
    }
    input.value = String(this.rounded()[field]);
  }

  protected onPointerDown(e: PointerEvent, mode: DragMode): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const stage = (e.currentTarget as HTMLElement).closest('.stage') as HTMLElement | null;
    if (!stage) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const box = stage.getBoundingClientRect();
    this.drag = { mode, startX: e.clientX, startY: e.clientY, rect: this.crop(), scale: this.bounds().width / box.width };
  }
  protected onPointerMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const dx = (e.clientX - d.startX) * d.scale;
    const dy = (e.clientY - d.startY) * d.scale;
    const b = this.bounds();
    this.crop.set(d.mode.kind === 'move' ? moveRect(d.rect, dx, dy, b) : resizeRect(d.rect, d.mode.handle, dx, dy, b, this.ratio()));
  }
  protected onPointerUp(): void {
    this.drag = null;
  }

  /** Frecce = sposta (Maiusc: x10); Alt+frecce e +/- = ridimensiona dal centro. */
  protected onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey) return;
    const step = Math.max(1, Math.round(this.bounds().width / 200)) * (e.shiftKey ? 10 : 1);
    const next = nudgeRect(this.crop(), e.key, step, e.altKey, this.bounds(), this.ratio());
    if (next) {
      e.preventDefault();
      this.crop.set(next);
    }
  }

  // ---- uscita ----
  protected onOutW(v: string): void {
    this.driver = 'width';
    this.outW.set(v);
  }
  protected onOutH(v: string): void {
    this.driver = 'height';
    this.outH.set(v);
  }

  protected async download(): Promise<void> {
    const bmp = this.bitmap;
    if (!bmp || this.working()) return;
    this.working.set(true);
    this.error.set('');
    try {
      const fmt = this.format();
      const out = this.result();
      const blob = await exportCrop(
        bmp,
        { angle: this.angle(), flipH: this.flipH(), flipV: this.flipV() },
        this.rounded(),
        out,
        fmt,
        this.quality(),
      );
      const name = cropFileName(this.fileName(), fmt, this.i18n.lang() === 'en' ? 'crop' : 'ritaglio');
      saveBytes(blob, name, MIME[fmt]);
      this.status.set(this.i18n.t('crop.done', { name, w: out.width, h: out.height, kb: Math.max(1, Math.round(blob.size / 1024)) }));
    } catch (e) {
      this.error.set(this.i18n.t((e as Error).message === 'format' ? 'crop.err.format' : 'crop.err.export'));
    } finally {
      this.working.set(false);
    }
  }
}
