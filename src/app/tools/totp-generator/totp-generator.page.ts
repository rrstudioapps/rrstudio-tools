// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { encodeQr } from '../qr-code/qr-encoder';
import { toSvg } from '../qr-code/qr-render';
import {
  ALGORITHMS,
  DEFAULT_PARAMS,
  MAX_PERIOD,
  MAX_WINDOW,
  MIN_PERIOD,
  Neighbours,
  TotpAlgorithm,
  TotpError,
  VerifyResult,
  base32Decode,
  buildOtpauth,
  formatCode,
  groupSecret,
  isOtpauthUri,
  parseOtpauth,
  randomSecret,
  secondsRemaining,
  timeCounter,
  totpNeighbours,
  verifyTotp,
} from './totp';
import { TOTP_DICTIONARIES } from './totp-generator.i18n';

@Component({
  selector: 'app-totp-generator',
  imports: [Icon, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './totp-generator.page.html',
  styleUrl: './totp-generator.page.scss',
})
export class TotpGeneratorPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  protected readonly minPeriod = MIN_PERIOD;
  protected readonly maxPeriod = MAX_PERIOD;
  protected readonly windows = Array.from({ length: MAX_WINDOW + 1 }, (_, i) => i);

  protected readonly secretText = signal('');
  protected readonly algorithm = signal<TotpAlgorithm>(DEFAULT_PARAMS.algorithm);
  protected readonly digits = signal<'6' | '7' | '8'>('6');
  protected readonly period = signal(DEFAULT_PARAMS.period);
  protected readonly label = signal('');
  protected readonly issuer = signal('');
  protected readonly imported = signal(false);
  protected readonly uriError = signal<string | null>(null);

  /** Istante attuale, aggiornato quattro volte al secondo (solo nel browser). */
  private readonly now = signal(Date.now());
  protected readonly neighbours = signal<Neighbours | null>(null);

  protected readonly verifyCode = signal('');
  protected readonly window = signal(1);
  protected readonly verifyResult = signal<VerifyResult | null>(null);

  protected readonly algorithms = computed<SegmentOption<TotpAlgorithm>[]>(() => ALGORITHMS.map((a) => ({ value: a, label: a })));
  protected readonly digitOptions: SegmentOption<'6' | '7' | '8'>[] = [
    { value: '6', label: '6' },
    { value: '7', label: '7' },
    { value: '8', label: '8' },
  ];

  protected readonly params = computed(() => ({ algorithm: this.algorithm(), digits: Number(this.digits()), period: this.period() }));

  /** Segreto decodificato, oppure il codice dell'errore. */
  protected readonly secret = computed<{ bytes: Uint8Array; text: string } | { error: string } | null>(() => {
    const raw = this.secretText();
    if (raw.trim() === '') return null;
    if (isOtpauthUri(raw)) return { error: 'uri-paste' };
    try {
      const bytes = base32Decode(raw);
      return { bytes, text: raw.replace(/[\s-]+/g, '').replace(/=+$/, '').toUpperCase() };
    } catch (e) {
      return { error: e instanceof TotpError ? e.code : 'base32' };
    }
  });
  protected readonly secretError = computed(() => {
    const uriError = this.uriError();
    if (uriError) return uriError;
    const s = this.secret();
    return s && 'error' in s ? this.i18n.t('totp.err.' + (s.error === 'uri-paste' ? 'uri' : s.error)) : '';
  });
  private readonly validSecret = computed(() => {
    const s = this.secret();
    return s && !('error' in s) ? s : null;
  });

  private readonly counter = computed(() => timeCounter(this.now(), this.period()));
  protected readonly remaining = computed(() => secondsRemaining(this.now(), this.period()));
  protected readonly remainingPercent = computed(() => (this.remaining() / this.period()) * 100);
  protected readonly remainingText = computed(() => this.i18n.t('totp.remaining', { n: this.remaining() }));
  protected readonly current = computed(() => this.neighbours()?.current ?? '');
  protected readonly currentShown = computed(() => (this.current() ? formatCode(this.current()) : ''));

  protected readonly uri = computed(() => {
    const s = this.validSecret();
    if (!s) return '';
    try {
      return buildOtpauth({ secret: s.text, params: this.params(), label: this.label().trim() || 'account', issuer: this.issuer().trim() });
    } catch {
      return '';
    }
  });
  protected readonly svg = computed(() => {
    const uri = this.uri();
    if (!uri) return '';
    try {
      return toSvg(encodeQr(uri, { ecl: 'M' }), { margin: 4, fg: '#000000', bg: '#ffffff' });
    } catch {
      return '';
    }
  });
  protected readonly previewUrl = signal<string | null>(null);

  protected readonly verifyMessage = computed(() => {
    const r = this.verifyResult();
    const code = this.verifyCode().replace(/\s+/g, '');
    if (code === '') return '';
    if (!r) return '';
    if (r.ok) {
      const o = r.offset ?? 0;
      if (o === 0) return this.i18n.t('totp.verify.ok0');
      return o < 0 ? this.i18n.t('totp.verify.okPrev', { n: -o }) : this.i18n.t('totp.verify.okNext', { n: o });
    }
    if (!/^[0-9]*$/.test(code) || code.length !== this.params().digits) return this.i18n.t('totp.verify.format', { digits: this.params().digits });
    return this.i18n.t('totp.verify.bad');
  });

  private seqCodes = 0;
  private seqVerify = 0;

  constructor() {
    this.i18n.register(TOTP_DICTIONARIES);
    if (this.browser) {
      const timer = setInterval(() => this.now.set(Date.now()), 250);
      this.destroyRef.onDestroy(() => clearInterval(timer));
    }
    // codici: si ricalcolano al cambio di periodo, segreto o impostazioni
    effect(() => {
      const s = this.validSecret();
      const p = this.params();
      this.counter();
      if (!this.browser) return;
      const id = ++this.seqCodes;
      if (!s) {
        this.neighbours.set(null);
        return;
      }
      const now = untracked(() => this.now());
      void totpNeighbours(s.bytes, now, p)
        .then((n) => {
          if (id === this.seqCodes) this.neighbours.set(n);
        })
        .catch(() => {
          if (id === this.seqCodes) this.neighbours.set(null);
        });
    });
    // verifica del codice digitato
    effect(() => {
      const s = this.validSecret();
      const p = this.params();
      const code = this.verifyCode();
      const w = this.window();
      this.counter();
      if (!this.browser) return;
      const id = ++this.seqVerify;
      if (!s || code.trim() === '') {
        this.verifyResult.set(null);
        return;
      }
      const now = untracked(() => this.now());
      void verifyTotp(code, s.bytes, now, p, w)
        .then((r) => {
          if (id === this.seqVerify) this.verifyResult.set(r);
        })
        .catch(() => this.verifyResult.set(null));
    });
    // anteprima del QR: lo stesso SVG che si scarica, servito come immagine da un object URL
    effect((onCleanup) => {
      const svg = this.svg();
      if (!svg || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        this.previewUrl.set(null);
        return;
      }
      let url: string;
      try {
        url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      } catch {
        this.previewUrl.set(null);
        return;
      }
      this.previewUrl.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });
    this.destroyRef.onDestroy(() => this.previewUrl.set(null));
  }

  protected onSecret(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.imported.set(false);
    this.uriError.set(null);
    if (isOtpauthUri(value)) {
      try {
        const d = parseOtpauth(value);
        this.secretText.set(groupSecret(d.secret));
        this.algorithm.set(d.params.algorithm);
        this.digits.set(String(d.params.digits) as '6' | '7' | '8');
        this.period.set(d.params.period);
        this.label.set(d.label);
        this.issuer.set(d.issuer);
        this.imported.set(true);
      } catch (err) {
        this.secretText.set(value);
        this.uriError.set(this.i18n.t('totp.err.' + (err instanceof TotpError ? err.code : 'uri')));
      }
      return;
    }
    this.secretText.set(value);
  }

  protected generate(): void {
    this.imported.set(false);
    this.uriError.set(null);
    this.secretText.set(groupSecret(randomSecret()));
  }

  protected clear(): void {
    this.secretText.set('');
    this.imported.set(false);
    this.uriError.set(null);
    this.verifyCode.set('');
  }

  protected setPeriod(value: string): void {
    const n = Math.round(Number(value));
    this.period.set(Number.isFinite(n) ? Math.min(MAX_PERIOD, Math.max(MIN_PERIOD, n)) : DEFAULT_PARAMS.period);
  }

  protected setWindow(value: string): void {
    this.window.set(Math.min(MAX_WINDOW, Math.max(0, Math.round(Number(value)) || 0)));
  }

  protected shown(code: string | undefined): string {
    return code ? formatCode(code) : '';
  }

  protected downloadQr(): void {
    const svg = this.svg();
    if (svg) saveBytes(new Blob([svg], { type: 'image/svg+xml' }), 'totp-qr.svg', 'image/svg+xml');
  }
}
