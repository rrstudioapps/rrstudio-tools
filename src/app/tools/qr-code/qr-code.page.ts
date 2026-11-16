// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { saveBytes } from '../../shared/download';
import { Ecl, QrCode, QrError, encodeQr, maxByteCapacity } from './qr-encoder';
import { EMPTY_FIELDS, QR_TYPES, QrFields, QrType, WifiSecurity, buildPayload, parseCoordinate } from './qr-payload';
import { MAX_LOGO_FRACTION, MIN_LOGO_FRACTION, RenderOptions, contrastIssue, contrastRatio, drawToCanvas, toSvg } from './qr-render';
import { QR_DICTIONARIES } from './qr-code.i18n';

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
/** Il logo viene ridotto a questo lato massimo prima di entrare nell'SVG (mantiene leggero il file). */
const LOGO_PX = 256;
const ECLS: readonly Ecl[] = ['L', 'M', 'Q', 'H'];

interface Logo {
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  image: HTMLImageElement;
}

@Component({
  selector: 'app-qr-code',
  imports: [Icon, PrivacyNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qr-code.page.html',
  styleUrl: './qr-code.page.scss',
})
export class QrCodePage {
  protected readonly i18n = inject(I18nService);
  protected readonly types = QR_TYPES;
  protected readonly eclOptions = ECLS;
  protected readonly maxLogoPercent = MAX_LOGO_FRACTION * 100;
  protected readonly minLogoPercent = MIN_LOGO_FRACTION * 100;

  protected readonly type = signal<QrType>('url');
  protected readonly fields = signal<QrFields>({ ...EMPTY_FIELDS });
  protected readonly ecl = signal<Ecl>('M');
  protected readonly size = signal(512);
  protected readonly margin = signal(4);
  protected readonly fg = signal('#000000');
  protected readonly bg = signal('#ffffff');
  protected readonly logo = signal<Logo | null>(null);
  protected readonly logoPercent = signal(18);
  protected readonly logoError = signal<'logoRead' | 'logoSize' | null>(null);
  protected readonly copyState = signal<'' | 'copied' | 'failed'>('');
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly canCopyImage = signal(false);

  protected readonly payload = computed(() => buildPayload(this.type(), this.fields()));
  protected readonly effectiveEcl = computed<Ecl>(() => (this.logo() ? 'H' : this.ecl()));

  /** Esito della codifica: il QR, oppure 'too-long'. */
  private readonly encoded = computed<{ qr: QrCode | null; tooLong: boolean }>(() => {
    const text = this.payload();
    if (!text) return { qr: null, tooLong: false };
    try {
      return { qr: encodeQr(text, { ecl: this.effectiveEcl() }), tooLong: false };
    } catch (e) {
      if (e instanceof QrError) return { qr: null, tooLong: true };
      throw e;
    }
  });
  protected readonly qr = computed(() => this.encoded().qr);

  private readonly renderOptions = computed<RenderOptions>(() => {
    const logo = this.logo();
    return {
      margin: this.safeMargin(),
      fg: this.fg(),
      bg: this.bg(),
      logo: logo ? { dataUrl: logo.dataUrl, fraction: this.logoPercent() / 100, width: logo.width, height: logo.height } : null,
    };
  });

  protected readonly svg = computed(() => {
    const qr = this.qr();
    return qr ? toSvg(qr, this.renderOptions()) : '';
  });

  protected readonly warnings = computed<string[]>(() => {
    const out: string[] = [];
    const t = this.i18n;
    if (this.encoded().tooLong) out.push(t.t('qr.warn.tooLong', { max: new Intl.NumberFormat(t.locale()).format(maxByteCapacity(this.effectiveEcl())) }));
    if (this.type() === 'geo') {
      const f = this.fields();
      if ((f.geoLat || f.geoLon) && !this.payload()) out.push(t.t('qr.warn.geo'));
    }
    const issue = contrastIssue(this.fg(), this.bg());
    if (issue === 'low') out.push(t.t('qr.warn.contrast.low', { ratio: contrastRatio(this.fg(), this.bg()).toFixed(1) }));
    if (issue === 'inverted') out.push(t.t('qr.warn.contrast.inverted'));
    if (this.margin() < 4) out.push(t.t('qr.warn.margin'));
    const le = this.logoError();
    if (le) out.push(t.t('qr.warn.' + le));
    return out;
  });

  protected readonly info = computed(() => {
    const qr = this.qr();
    if (!qr) return '';
    const bytes = new TextEncoder().encode(this.payload()).length;
    return this.i18n.t('qr.info', { version: qr.version, modules: qr.size, ecl: qr.ecl, bytes: new Intl.NumberFormat(this.i18n.locale()).format(bytes) });
  });

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.i18n.register(QR_DICTIONARIES);
    // l'anteprima è lo stesso SVG che si scarica, servito come immagine da un object URL
    effect((onCleanup) => {
      const svg = this.svg();
      if (!svg || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        this.previewUrl.set(null);
        return;
      }
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      this.previewUrl.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });
    afterNextRender(() => this.canCopyImage.set(typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write));
    this.destroyRef.onDestroy(() => this.previewUrl.set(null));
  }

  private safeMargin(): number {
    const m = Math.round(this.margin());
    return Number.isFinite(m) ? Math.min(16, Math.max(0, m)) : 4;
  }

  protected set<K extends keyof QrFields>(key: K, value: QrFields[K]): void {
    this.fields.update((f) => ({ ...f, [key]: value }));
  }

  protected onText(key: keyof QrFields, e: Event): void {
    this.set(key, (e.target as HTMLInputElement | HTMLTextAreaElement).value as never);
  }

  protected onChecked(key: keyof QrFields, e: Event): void {
    this.set(key, (e.target as HTMLInputElement).checked as never);
  }

  protected onSecurity(e: Event): void {
    this.set('wifiSecurity', (e.target as HTMLSelectElement).value as WifiSecurity);
  }

  protected onNumber(target: 'size' | 'margin' | 'logoPercent', e: Event): void {
    const v = Number((e.target as HTMLInputElement).value);
    if (!Number.isFinite(v)) return;
    if (target === 'size') this.size.set(v);
    else if (target === 'margin') this.margin.set(v);
    else this.logoPercent.set(Math.min(this.maxLogoPercent, Math.max(this.minLogoPercent, v)));
  }

  protected geoInvalid(key: 'geoLat' | 'geoLon'): boolean {
    const v = this.fields()[key];
    return v.trim() !== '' && parseCoordinate(v, key === 'geoLat' ? 90 : 180) === null;
  }

  protected async onLogo(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.logoError.set(null);
    if (file.size > MAX_LOGO_BYTES) {
      this.logoError.set('logoSize');
      return;
    }
    try {
      this.logo.set(await loadLogo(file));
    } catch {
      this.logoError.set('logoRead');
    }
  }

  protected removeLogo(): void {
    this.logo.set(null);
    this.logoError.set(null);
  }

  /** PNG alla dimensione scelta (canvas quadrato di size x size pixel). */
  private pngBlob(): Promise<Blob | null> {
    const qr = this.qr();
    if (!qr) return Promise.resolve(null);
    const px = Math.min(4096, Math.max(64, Math.round(this.size()) || 512));
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    drawToCanvas(ctx, qr, this.renderOptions(), px, this.logo()?.image ?? null);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  protected async downloadPng(): Promise<void> {
    const blob = await this.pngBlob();
    if (blob) saveBytes(blob, 'qr-code.png', 'image/png');
  }

  protected downloadSvg(): void {
    const svg = this.svg();
    if (svg) saveBytes(new Blob([svg], { type: 'image/svg+xml' }), 'qr-code.svg', 'image/svg+xml');
  }

  protected async copyImage(): Promise<void> {
    try {
      const blob = await this.pngBlob();
      if (!blob) throw new Error('no image');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this.copyState.set('copied');
    } catch {
      this.copyState.set('failed');
    }
  }
}

/** Legge l'immagine scelta e la riduce a LOGO_PX (PNG con trasparenza) per l'SVG e il canvas. */
async function loadLogo(file: File): Promise<Logo> {
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('immagine non valida'));
    i.src = src;
  });
  const natW = img.naturalWidth || LOGO_PX;
  const natH = img.naturalHeight || LOGO_PX;
  const scale = Math.min(1, LOGO_PX / Math.max(natW, natH));
  const width = Math.max(1, Math.round(natW * scale));
  const height = Math.max(1, Math.round(natH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas non disponibile');
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/png');
  const small = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('immagine non valida'));
    i.src = dataUrl;
  });
  return { name: file.name, dataUrl, width, height, image: small };
}
