// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrintButton, PrintParam } from '../../shared/print-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import {
  BareUnit,
  OvertimeScope,
  amountCents,
  computeSheet,
  convertAuto,
  decimalHours,
  formatCents,
  formatHms,
  parseDuration,
  parsePercent,
  parseRate,
  sumLines,
} from './time';
import { TIME_DICTIONARIES } from './time-calculator.i18n';
import { SHARE_SCHEMA } from './time-calculator.share';

type Mode = 'sum' | 'sheet' | 'convert';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const SAMPLE_SUM = '1:30\n1h 30m\n90m\n1,5h\n01:30:15\n-0:20 # pausa non pagata';
export const SAMPLE_SHEET = 'lun 8:30 17:30 60\nmar 8:30 18:00 60\nmer 8:30 17:30 60\ngio 9:00 19:00 45\nven 22:00 06:00 30';

@Component({
  selector: 'app-time-calculator',
  imports: [CopyButton, Icon, IoPanel, PrintButton, PrivacyNote, Segmented, ShareLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './time-calculator.page.html',
  styleUrl: './time-calculator.page.scss',
})
export class TimeCalculatorPage {
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<Mode>('sum');
  protected readonly sumText = signal('');
  protected readonly bare = signal<BareUnit>('h');
  protected readonly sheetText = signal('');
  protected readonly threshold = signal('40:00');
  protected readonly scope = signal<OvertimeScope>('week');
  protected readonly rate = signal('');
  protected readonly premium = signal('');
  protected readonly convertIn = signal('');

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'sum', label: this.i18n.t('time.mode.sum') },
    { value: 'sheet', label: this.i18n.t('time.mode.sheet') },
    { value: 'convert', label: this.i18n.t('time.mode.convert') },
  ]);
  protected readonly bares = computed<SegmentOption<BareUnit>[]>(() => [
    { value: 'h', label: this.i18n.t('time.bare.h') },
    { value: 'm', label: this.i18n.t('time.bare.m') },
  ]);
  protected readonly scopes = computed<SegmentOption<OvertimeScope>[]>(() => [
    { value: 'week', label: this.i18n.t('time.scope.week') },
    { value: 'day', label: this.i18n.t('time.scope.day') },
  ]);

  private readonly nf = computed(() => new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 4 }));
  protected dec(n: number): string {
    return this.nf().format(n);
  }
  protected hms(s: number): string {
    return formatHms(s);
  }
  private money(c: bigint): string {
    const it = this.i18n.lang() === 'it';
    return formatCents(c, it ? ',' : '.', it ? '.' : ',') + ' €';
  }

  // ---------- somma ----------

  protected readonly sum = computed(() => sumLines(this.sumText(), this.bare()));
  protected readonly sumBad = computed(() => this.sum().rows.filter((r) => r.error));
  protected readonly sumTotalText = computed(() => (this.sum().count ? formatHms(this.sum().total) : ''));

  // ---------- foglio ore ----------

  protected readonly thresholdSeconds = computed(() => {
    const t = this.threshold().trim();
    return t === '' ? null : parseDuration(t, 'h');
  });
  protected readonly thresholdBad = computed(() => this.threshold().trim() !== '' && this.thresholdSeconds() === null);
  protected readonly sheet = computed(() => computeSheet(this.sheetText(), this.thresholdBad() ? null : this.thresholdSeconds(), this.scope()));
  protected readonly sheetRows = computed(() =>
    this.sheet().rows.map((r) => ({
      line: r.line,
      day: r.day === null ? '' : this.i18n.t('time.day.' + DAY_KEYS[r.day]),
      start: this.clock(r.start),
      end: this.clock(r.end) + (r.crossesMidnight ? ' (+1)' : ''),
      brk: r.breakSeconds ? formatHms(r.breakSeconds) : '–',
      worked: formatHms(r.worked),
    })),
  );
  protected readonly sheetDays = computed(() => this.sheet().days.map((d) => ({ name: this.i18n.t('time.day.' + DAY_KEYS[d.day]), value: formatHms(d.seconds) })));
  protected readonly sheetErrors = computed(() => this.sheet().errors.map((e) => this.i18n.t('time.err.sheet.' + e.error, { line: e.line, text: e.text })));
  protected readonly sheetTotalText = computed(() => (this.sheet().rows.length ? formatHms(this.sheet().total) : ''));
  private clock(min: number): string {
    return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
  }

  // ---------- tariffa ----------

  private readonly rateValue = computed(() => (this.rate().trim() === '' ? null : parseRate(this.rate())));
  protected readonly rateBad = computed(() => this.rate().trim() !== '' && this.rateValue() === null);
  private readonly premiumValue = computed(() => (this.premium().trim() === '' ? 0n : parsePercent(this.premium())));
  protected readonly premiumBad = computed(() => this.premium().trim() !== '' && this.premiumValue() === null);

  protected readonly amount = computed(() => {
    const rate = this.rateValue();
    if (rate === null) return '';
    const m = this.mode();
    if (m === 'sum') {
      const t = this.sum().total;
      if (this.sum().count === 0) return '';
      // un totale negativo dà un importo negativo
      const c = amountCents(Math.abs(t), 0, rate);
      return this.money(t < 0 ? -c : c);
    }
    if (m === 'sheet') {
      const s = this.sheet();
      if (!s.rows.length) return '';
      const prem = this.premiumValue();
      if (prem === null) return '';
      return this.money(amountCents(s.regular, s.overtime, rate, prem));
    }
    return '';
  });

  // ---------- conversione ----------

  protected readonly converted = computed(() => {
    const t = this.convertIn().trim();
    if (t === '') return null;
    const c = convertAuto(t);
    if (!c) return { error: true as const };
    return {
      error: false as const,
      from: c.from,
      hms: formatHms(c.seconds),
      decimal: this.dec(decimalHours(c.seconds)),
      minutes: this.dec(Number((c.seconds / 60).toFixed(2))),
    };
  });

  protected loadSample(): void {
    if (this.mode() === 'sheet') this.sheetText.set(SAMPLE_SHEET);
    else this.sumText.set(SAMPLE_SUM);
  }
  protected clearAll(): void {
    if (this.mode() === 'sheet') this.sheetText.set('');
    else if (this.mode() === 'convert') this.convertIn.set('');
    else this.sumText.set('');
  }

  /** Parametri per il riepilogo di stampa (al posto dei campi). */
  protected readonly printParams = computed<PrintParam[]>(() => {
    const t = (k: string) => this.i18n.t(k);
    const p = (label: string, value: string): PrintParam => ({ label, value: value.trim() || '-' });
    const out = [p(t('time.mode'), t('time.mode.' + this.mode()))];
    if (this.mode() === 'sum') out.push(p(t('time.bare'), t('time.bare.' + this.bare())));
    if (this.mode() === 'sheet') out.push(p(t('time.threshold'), this.threshold()), p(t('time.scope'), t('time.scope.' + this.scope())));
    if (this.mode() === 'convert') out.push(p(t('time.convert.input'), this.convertIn()));
    else {
      if (this.rate().trim()) out.push(p(t('time.rate'), this.rate()));
      if (this.mode() === 'sheet' && this.premium().trim()) out.push(p(t('time.premium'), this.premium()));
    }
    return out;
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode,
    sumText: this.sumText,
    bare: this.bare,
    sheetText: this.sheetText,
    threshold: this.threshold,
    scope: this.scope,
    rate: this.rate,
    premium: this.premium,
    convertIn: this.convertIn,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(TIME_DICTIONARIES);
    // testo ricevuto da un altro strumento ("Invia a…"): finisce nelle durate da sommare
    const rx = inject(ToolHandoff).take('time-calculator');
    if (rx?.text !== undefined) {
      this.sumText.set(rx.text);
      this.mode.set('sum');
    }
  }
}
