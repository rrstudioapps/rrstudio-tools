// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { formatMoney, parseMoney } from '../calcolo-iva/iva';
import { MUTUO_DICTIONARIES } from './calcolo-rata-mutuo.i18n';
import { MAX_CAPITAL_CENTS, MortgageResult, PERIODICITY_MONTHS, Periodicity, computeMortgage, parseRate, parseWhole, scheduleToCsv } from './mutuo';

const PAGE_SIZE = 24;

@Component({
  selector: 'app-calcolo-rata-mutuo',
  imports: [Icon, PrivacyNote, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calcolo-rata-mutuo.page.html',
  styleUrl: './calcolo-rata-mutuo.page.scss',
})
export class CalcoloRataMutuoPage {
  protected readonly i18n = inject(I18nService);

  protected readonly capitalText = signal('');
  protected readonly tanText = signal('');
  protected readonly yearsText = signal('20');
  protected readonly monthsText = signal('');
  protected readonly periodicity = signal<Periodicity>('monthly');
  protected readonly page = signal(0);

  protected readonly periods = computed<SegmentOption<Periodicity>[]>(() =>
    (Object.keys(PERIODICITY_MONTHS) as Periodicity[]).map((p) => ({ value: p, label: this.i18n.t('mutuo.period.' + p) })),
  );

  private readonly capital = computed(() => parseMoney(this.capitalText()));
  private readonly tan = computed(() => parseRate(this.tanText()));
  private readonly totalMonths = computed(() => {
    const y = parseWhole(this.yearsText());
    const m = parseWhole(this.monthsText());
    return y === null || m === null ? null : y * 12 + m;
  });

  protected readonly capitalError = computed(
    () => this.capitalText().trim() !== '' && (this.capital() === null || this.capital() === 0 || (this.capital() ?? 0) > MAX_CAPITAL_CENTS),
  );
  protected readonly tanError = computed(() => this.tanText().trim() !== '' && this.tan() === null);
  protected readonly durationError = computed<'duration' | 'multiple' | null>(() => {
    const t = this.totalMonths();
    if (t === null || t <= 0 || t > 600) return this.yearsText().trim() === '' && this.monthsText().trim() === '' ? null : 'duration';
    return t % PERIODICITY_MONTHS[this.periodicity()] !== 0 ? 'multiple' : null;
  });

  /** Vuoto finché capitale e TAN non sono compilati e validi. */
  protected readonly result = computed<MortgageResult | null>(() => {
    const c = this.capital();
    const t = this.tan();
    const m = this.totalMonths();
    if (c === null || t === null || m === null || this.tanText().trim() === '') return null;
    const o = computeMortgage({ capital: c, tan: t, months: m, periodicity: this.periodicity() });
    return o.ok ? o.result : null;
  });

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil((this.result()?.schedule.length ?? 0) / PAGE_SIZE)));
  protected readonly currentPage = computed(() => Math.min(this.page(), this.pageCount() - 1));
  protected readonly rows = computed(() => {
    const r = this.result();
    if (!r) return [];
    const from = this.currentPage() * PAGE_SIZE;
    return r.schedule.slice(from, from + PAGE_SIZE);
  });
  protected readonly pageInfo = computed(() => {
    const r = this.result();
    const rows = this.rows();
    if (!r || !rows.length) return '';
    return this.i18n.t('mutuo.page', { from: rows[0].n, to: rows[rows.length - 1].n, total: r.periods });
  });

  constructor() {
    this.i18n.register(MUTUO_DICTIONARIES);
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.locale());
  }

  protected rate(pct: number): string {
    const s = String(Math.round(pct * 10000) / 10000);
    return (this.i18n.lang() === 'it' ? s.replace('.', ',') : s) + '%';
  }

  protected go(delta: number): void {
    this.page.set(Math.max(0, Math.min(this.pageCount() - 1, this.currentPage() + delta)));
  }

  protected download(): void {
    const r = this.result();
    if (!r) return;
    const t = (k: string) => this.i18n.t('mutuo.col.' + k);
    const csv = scheduleToCsv(r.schedule, [t('n'), t('payment'), t('interest'), t('principal'), t('balance')], this.i18n.lang());
    saveBytes(new TextEncoder().encode(csv), 'piano-ammortamento.csv', 'text/csv;charset=utf-8');
  }
}

