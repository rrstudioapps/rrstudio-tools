// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, type SegmentOption } from '../../shared/segmented';
import { ShareLink } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './split-bill.share';
import { BILL_DICTIONARIES } from './split-bill.i18n';
import {
  MAX_PEOPLE, NO_TIP, ROUND_STEPS, formatCents, parseConsumptionLines, parseMoney, parsePercent, splitByConsumption, splitEqual,
  type RoundStep, type Tip,
} from './split-bill';

type Mode = 'equal' | 'consumption';
type TipKind = 'percent' | 'amount';

@Component({
  selector: 'app-split-bill',
  imports: [ShareLink, PrivacyNote, CopyButton, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './split-bill.page.html',
  styleUrl: './split-bill.page.scss',
})
export class SplitBillPage {
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<Mode>('equal');
  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'equal', label: this.i18n.t('bill.mode.equal') },
    { value: 'consumption', label: this.i18n.t('bill.mode.consumption') },
  ]);
  protected readonly total = signal('');
  protected readonly people = signal('2');
  protected readonly tipKind = signal<TipKind>('percent');
  protected readonly tipKinds = computed<SegmentOption<TipKind>[]>(() => [
    { value: 'percent', label: this.i18n.t('bill.tip.percent') },
    { value: 'amount', label: this.i18n.t('bill.tip.amount') },
  ]);
  protected readonly tip = signal('');
  protected readonly step = signal<RoundStep>(1);
  protected readonly steps = ROUND_STEPS;
  protected readonly lines = signal('');
  protected readonly common = signal('');

  private readonly lang = computed(() => this.i18n.lang());
  protected readonly maxPeople = MAX_PEOPLE;

  /** Importo con simbolo dell'euro nella lingua corrente. */
  protected fmt(cents: number): string {
    return formatCents(cents, this.i18n.locale());
  }

  /** Mancia letta dal campo; null se non valida (campo vuoto = nessuna mancia). */
  private readonly tipValue = computed<Tip | null>(() => {
    const text = this.tip().trim();
    if (text === '') return NO_TIP;
    if (this.tipKind() === 'percent') {
      const h = parsePercent(text, this.lang());
      return h === null ? null : { kind: 'percent', hundredths: h };
    }
    const c = parseMoney(text, this.lang());
    return c === null ? null : { kind: 'amount', cents: c };
  });
  protected readonly tipError = computed(() => (this.tipValue() === null ? (this.tipKind() === 'percent' ? 'bill.err.tipPercent' : 'bill.err.tipAmount') : ''));

  // --- in parti uguali ---
  private readonly totalValue = computed(() => (this.total().trim() === '' ? null : parseMoney(this.total(), this.lang())));
  protected readonly totalInvalid = computed(() => this.total().trim() !== '' && this.totalValue() === null);
  private readonly peopleValue = computed(() => {
    const t = this.people().trim();
    const n = /^\d+$/.test(t) ? Number(t) : NaN;
    return n >= 1 && n <= MAX_PEOPLE ? n : null;
  });
  protected readonly peopleInvalid = computed(() => this.peopleValue() === null);
  protected readonly equal = computed(() => {
    const total = this.totalValue();
    const people = this.peopleValue();
    const tip = this.tipValue();
    if (total === null || people === null || tip === null) return null;
    return { ...splitEqual({ total, people, tip, step: this.step() }), people };
  });
  protected readonly equalText = computed(() => {
    const r = this.equal();
    if (!r) return '';
    const t = (k: string) => this.i18n.t('bill.r.' + k);
    return [
      `${t('bill')}: ${this.fmt(this.totalValue() ?? 0)}`,
      `${t('tip')}: ${this.fmt(r.tip)}`,
      `${t('people')}: ${r.people}`,
      `${t('share')}: ${this.fmt(r.share)}`,
      `${t('paid')}: ${this.fmt(r.paid)}`,
    ].join('\n');
  });

  // --- per consumo ---
  private readonly parsed = computed(() => parseConsumptionLines(this.lines(), this.lang()));
  protected readonly lineErrors = computed(() => this.parsed().errors);
  private readonly commonValue = computed(() => (this.common().trim() === '' ? 0 : parseMoney(this.common(), this.lang())));
  protected readonly commonInvalid = computed(() => this.commonValue() === null);
  protected readonly consumption = computed(() => {
    const { diners, errors } = this.parsed();
    const common = this.commonValue();
    const tip = this.tipValue();
    if (diners.length === 0 || errors.length > 0 || common === null || tip === null) return null;
    return splitByConsumption({ diners, common, tip });
  });
  protected readonly consumptionText = computed(() =>
    (this.consumption()?.rows ?? []).map((r) => `${r.name} ${this.fmt(r.total)}`).join('\n'),
  );

  protected readonly shareSchema = SHARE_SCHEMA;
  protected readonly shareState = (): ShareData => ({
    mode: this.mode(),
    total: this.total().slice(0, 20),
    people: this.peopleValue() ?? 2,
    tipKind: this.tipKind(),
    tip: this.tip().slice(0, 20),
    step: this.step(),
    lines: this.lines().slice(0, 2000),
    common: this.common().slice(0, 20),
  });
  protected restoreShared(data: ShareData): void {
    const s = data as Partial<Record<string, unknown>>;
    if (s['mode'] === 'equal' || s['mode'] === 'consumption') this.mode.set(s['mode']);
    if (typeof s['total'] === 'string') this.total.set(s['total']);
    if (typeof s['people'] === 'number') this.people.set(String(s['people']));
    if (s['tipKind'] === 'percent' || s['tipKind'] === 'amount') this.tipKind.set(s['tipKind']);
    if (typeof s['tip'] === 'string') this.tip.set(s['tip']);
    const st = ROUND_STEPS.find((x) => x === s['step']);
    if (st) this.step.set(st);
    if (typeof s['lines'] === 'string') this.lines.set(s['lines']);
    if (typeof s['common'] === 'string') this.common.set(s['common']);
  }

  constructor() {
    this.i18n.register(BILL_DICTIONARIES);
  }

  protected setStep(value: string): void {
    const st = ROUND_STEPS.find((x) => String(x) === value);
    if (st) this.step.set(st);
  }

  protected clear(): void {
    this.total.set('');
    this.people.set('2');
    this.tip.set('');
    this.tipKind.set('percent');
    this.step.set(1);
    this.lines.set('');
    this.common.set('');
  }
}
