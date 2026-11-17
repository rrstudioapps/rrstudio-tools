// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { Content, classify } from './qr-content';
import { QRR_DICTIONARIES } from './qr-code-reader.i18n';
import { decodePixels, fitSize } from './qr-scan';

type Source = 'image' | 'camera';
type CameraState = 'off' | 'starting' | 'on';

const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
/** Lati massimi provati in successione: un QR piccolo in una foto grande si legge meglio ridotto o a piena risoluzione. */
const IMAGE_SIZES = [2000, 1000, 600];
const CAMERA_MAX = 640;
const CAMERA_INTERVAL_MS = 130;

@Component({
  selector: 'app-qr-code-reader',
  imports: [Icon, PrivacyNote, Segmented, CopyButton, FileDrop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qr-code-reader.page.html',
  styleUrl: './qr-code-reader.page.scss',
})
export class QrCodeReaderPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  protected readonly source = signal<Source>('image');
  protected readonly text = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly messageKey = signal<string | null>(null);
  protected readonly imageUrl = signal<string | null>(null);
  protected readonly revealPassword = signal(false);

  protected readonly cameraState = signal<CameraState>('off');
  private readonly stream = signal<MediaStream | null>(null);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private loop: ReturnType<typeof setTimeout> | undefined;
  private canvas: HTMLCanvasElement | null = null;

  protected readonly sources = computed<SegmentOption<Source>[]>(() => [
    { value: 'image', label: this.i18n.t('qrr.source.image') },
    { value: 'camera', label: this.i18n.t('qrr.source.camera') },
  ]);
  protected readonly content = computed<Content | null>(() => {
    const t = this.text();
    return t === null ? null : classify(t);
  });
  protected readonly message = computed(() => {
    const k = this.messageKey();
    return k ? this.i18n.t(k) : '';
  });
  protected readonly warnings = computed(() => {
    const c = this.content();
    return c && c.kind === 'url' ? c.url.warnings.map((w) => this.i18n.t('qrr.warn.' + w)) : [];
  });
  protected readonly wifiPassword = computed(() => {
    const c = this.content();
    return c && c.kind === 'wifi' ? c.wifi.password : '';
  });

  constructor() {
    this.i18n.register(QRR_DICTIONARIES);
    // collega il flusso al video e avvia la lettura quando entrambi esistono
    effect(() => {
      const v = this.video();
      const s = this.stream();
      if (!v || !s) return;
      const el = v.nativeElement;
      el.srcObject = s;
      el.muted = true;
      void el.play().catch(() => undefined);
      this.scheduleScan();
    });
    this.destroyRef.onDestroy(() => this.stopCamera());
  }

  // ---- immagine ----

  @HostListener('document:paste', ['$event'])
  protected onPaste(e: ClipboardEvent): void {
    const files = Array.from(e.clipboardData?.files ?? []);
    const image = files.find((f) => f.type.startsWith('image/'));
    if (!image) return;
    e.preventDefault();
    this.source.set('image');
    void this.readFile(image);
  }

  protected setSource(s: Source): void {
    if (s !== 'camera') this.stopCamera();
    this.source.set(s);
    this.messageKey.set(null);
  }

  protected onFile(file: File): void {
    void this.readFile(file);
  }

  private async readFile(file: File): Promise<void> {
    this.clearResult();
    if (!file.type.startsWith('image/')) return void this.messageKey.set('qrr.err.type');
    if (file.size > MAX_IMAGE_BYTES) return void this.messageKey.set('qrr.err.big');
    this.busy.set(true);
    const prev = this.imageUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.imageUrl.set(URL.createObjectURL(file));
    try {
      const bitmap = await this.loadBitmap(file);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('canvas');
      let found: string | null = null;
      for (const max of IMAGE_SIZES) {
        const size = fitSize(bitmap.width, bitmap.height, max);
        canvas.width = size.width;
        canvas.height = size.height;
        ctx.drawImage(bitmap, 0, 0, size.width, size.height);
        const data = ctx.getImageData(0, 0, size.width, size.height);
        const r = await decodePixels(data.data, size.width, size.height);
        if (r) {
          found = r.text;
          break;
        }
        // l'immagine è già più piccola del lato successivo: inutile riprovare
        if (Math.max(bitmap.width, bitmap.height) <= max) break;
      }
      bitmap.close?.();
      if (found === null) this.messageKey.set('qrr.notfound');
      else this.text.set(found);
    } catch {
      this.messageKey.set('qrr.err.decode');
    } finally {
      this.busy.set(false);
    }
  }

  private async loadBitmap(file: File): Promise<ImageBitmap & { close?: () => void }> {
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(file);
      } catch {
        /* ripiego su <img> */
      }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return Object.assign(img, { close: undefined }) as unknown as ImageBitmap;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---- fotocamera ----

  protected async startCamera(): Promise<void> {
    if (this.cameraState() !== 'off') return;
    this.clearResult();
    if (!this.browser || !navigator.mediaDevices?.getUserMedia) return void this.messageKey.set('qrr.camera.unsupported');
    this.cameraState.set('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (this.cameraState() !== 'starting') {
        // fermata (o pagina chiusa) mentre si aspettava l'autorizzazione
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream.set(s);
      this.cameraState.set('on');
    } catch (e) {
      this.cameraState.set('off');
      const name = (e as { name?: string }).name;
      this.messageKey.set(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'qrr.camera.denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'qrr.camera.notfound'
            : 'qrr.camera.error',
      );
    }
  }

  /** Spegne la fotocamera: ferma ogni traccia del flusso e il ciclo di lettura. */
  protected stopCamera(): void {
    clearTimeout(this.loop);
    this.loop = undefined;
    const s = this.stream();
    s?.getTracks().forEach((t) => t.stop());
    const v = this.video();
    if (v) v.nativeElement.srcObject = null;
    this.stream.set(null);
    this.cameraState.set('off');
  }

  @HostListener('document:visibilitychange')
  protected onVisibility(): void {
    // pagina in secondo piano: la fotocamera non deve restare accesa
    if (typeof document !== 'undefined' && document.hidden && this.cameraState() !== 'off') this.stopCamera();
  }

  @HostListener('window:pagehide')
  protected onPageHide(): void {
    this.stopCamera();
  }

  private scheduleScan(): void {
    clearTimeout(this.loop);
    this.loop = setTimeout(() => void this.scanFrame(), CAMERA_INTERVAL_MS);
  }

  private async scanFrame(): Promise<void> {
    if (this.cameraState() !== 'on') return;
    const v = this.video()?.nativeElement;
    if (v && v.readyState >= 2 && v.videoWidth > 0) {
      const size = fitSize(v.videoWidth, v.videoHeight, CAMERA_MAX);
      this.canvas ??= document.createElement('canvas');
      const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        this.canvas.width = size.width;
        this.canvas.height = size.height;
        ctx.drawImage(v, 0, 0, size.width, size.height);
        const data = ctx.getImageData(0, 0, size.width, size.height);
        const r = await decodePixels(data.data, size.width, size.height);
        if (r && this.cameraState() === 'on') {
          this.text.set(r.text);
          this.stopCamera();
          return;
        }
      }
    }
    if (this.cameraState() === 'on') this.scheduleScan();
  }

  // ---- risultato ----

  protected clearResult(): void {
    this.text.set(null);
    this.messageKey.set(null);
    this.revealPassword.set(false);
  }

  protected clearAll(): void {
    this.clearResult();
    const url = this.imageUrl();
    if (url) URL.revokeObjectURL(url);
    this.imageUrl.set(null);
  }
}
