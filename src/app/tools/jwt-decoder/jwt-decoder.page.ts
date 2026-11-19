// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { useNow } from '../../shared/clock';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { JsonToken, tokenizeJson } from '../json-formatter/json-tools';
import { JWT_DICTIONARIES } from './jwt-decoder.i18n';
import { ToolHandoff } from '../../shared/tool-handoff';
import {
  DateClaim,
  JweInfo,
  JwtDecoded,
  JwtError,
  JwtResult,
  TokenStatus,
  parseJwt,
  remaining,
  sampleToken,
  splitDuration,
  statusOf,
} from './jwt';

interface DateRow {
  claim: DateClaim;
  local: string;
  utc: string;
  iso: string;
  relative: string;
}

@Component({
  selector: 'app-jwt-decoder',
  imports: [Icon, IoPanel, PrivacyNote, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './jwt-decoder.page.html',
  styleUrl: './jwt-decoder.page.scss',
})
export class JwtDecoderPage {
  protected readonly i18n = inject(I18nService);
  private readonly now = useNow(1000);

  protected readonly input = signal('');
  protected readonly jweParts = [0, 1, 2, 3, 4];

  private readonly result = computed<JwtResult | null>(() => (this.input().trim() === '' ? null : parseJwt(this.input())));
  protected readonly jws = computed<JwtDecoded | null>(() => {
    const r = this.result();
    return r?.ok && r.token.type === 'jws' ? r.token : null;
  });
  protected readonly jwe = computed<JweInfo | null>(() => {
    const r = this.result();
    return r?.ok && r.token.type === 'jwe' ? r.token : null;
  });
  protected readonly error = computed<string>(() => {
    const r = this.result();
    return r && !r.ok ? this.errorText(r.error) : '';
  });

  protected readonly headerTokens = computed<JsonToken[]>(() => tokenizeJson(this.jws()?.headerText ?? ''));
  protected readonly payloadTokens = computed<JsonToken[]>(() => tokenizeJson(this.jws()?.payloadText ?? ''));
  protected readonly jweHeaderTokens = computed<JsonToken[]>(() => tokenizeJson(this.jwe()?.headerText ?? ''));

  protected readonly status = computed<TokenStatus | null>(() => {
    const t = this.jws();
    return t ? statusOf(t.dates, this.now()) : null;
  });
  protected readonly statusText = computed(() => {
    const s = this.status();
    return s ? this.i18n.t('jwt.status.' + (s === 'not-yet' ? 'notyet' : s === 'no-exp' ? 'noexp' : s)) : '';
  });

  protected readonly timeZone = computed(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });

  protected readonly dateRows = computed<DateRow[]>(() => {
    const t = this.jws();
    if (!t) return [];
    const locale = this.i18n.locale();
    const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const local = new Intl.DateTimeFormat(locale, { ...opts, timeZoneName: 'short' });
    const utc = new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC', timeZoneName: 'short' });
    const nowMs = this.now();
    return t.dates.map((d) => {
      if (d.ms === null) {
        const out = this.i18n.t('jwt.dates.out');
        return { claim: d.claim, local: out, utc: out, iso: String(d.seconds), relative: '' };
      }
      return {
        claim: d.claim,
        local: local.format(d.ms),
        utc: utc.format(d.ms),
        iso: new Date(d.ms).toISOString(),
        relative: this.relativeText(d.claim, d.ms, nowMs),
      };
    });
  });

  protected readonly badDates = computed(() =>
    (this.jws()?.badDates ?? []).map((claim) => this.i18n.t('jwt.dates.bad', { claim })),
  );

  protected readonly sigText = computed(() => {
    const t = this.jws();
    if (!t) return '';
    return t.signatureBytes === 0 ? this.i18n.t('jwt.sig.none') : this.i18n.t('jwt.sig.bytes', { n: t.signatureBytes });
  });

  protected readonly meta = computed(() => (this.input().trim() ? this.i18n.t('jwt.meta', { chars: this.input().trim().length }) : ''));

  protected claimLabel(claim: DateClaim): string {
    return this.i18n.t('jwt.claim.' + claim);
  }

  protected jweLength(i: number): string {
    return this.i18n.t('jwt.jwe.chars', { n: this.jwe()?.lengths[i] ?? 0 });
  }

  private relativeText(claim: DateClaim, ms: number, nowMs: number): string {
    const r = remaining(ms, nowMs);
    if (r.state === 'now') return this.i18n.t('jwt.rel.now');
    const kind = claim === 'exp' || claim === 'nbf' ? claim : 'other';
    return this.i18n.t(`jwt.rel.${r.state}.${kind}`, { t: this.durationText(r.seconds) });
  }

  private durationText(seconds: number): string {
    const locale = this.i18n.locale();
    const parts = splitDuration(seconds).map((p) =>
      new Intl.NumberFormat(locale, { style: 'unit', unit: p.unit, unitDisplay: 'long' }).format(p.value),
    );
    return new Intl.ListFormat(locale, { style: 'short', type: 'unit' }).format(parts);
  }

  private errorText(e: JwtError): string {
    const part = (p: string): string => this.i18n.t('jwt.part.' + p);
    switch (e.kind) {
      case 'segments':
        return e.count < 3 ? this.i18n.t('jwt.err.segments.one') : this.i18n.t('jwt.err.segments', { count: e.count });
      case 'base64': {
        const detail = e.char ? this.i18n.t('jwt.err.base64.char', { c: e.char }) : this.i18n.t('jwt.err.base64.len');
        return this.i18n.t('jwt.err.base64', { part: part(e.part), char: detail });
      }
      case 'utf8':
        return this.i18n.t('jwt.err.utf8', { part: part(e.part) });
      case 'json':
        return this.i18n.t('jwt.err.json', { part: part(e.part), message: e.message });
      case 'header-type':
        return this.i18n.t('jwt.err.headerType');
      default:
        return '';
    }
  }

  constructor() {
    this.i18n.register(JWT_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('jwt-decoder');
    if (rx?.text !== undefined) this.input.set(rx.text.trim());
  }

  protected onInput(e: Event): void {
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  protected loadSample(): void {
    this.input.set(sampleToken(Math.floor(Date.now() / 1000)));
  }

  protected clear(): void {
    this.input.set('');
  }
}
