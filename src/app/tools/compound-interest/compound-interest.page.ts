// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { parseDecimal } from '../../shared/decimal';
import { PrintButton, PrintParam } from '../../shared/print-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { formatMoney } from '../calcolo-iva/iva';
import { COMPOUNDINGS, Compounding, CompoundError, CompoundInput, CompoundResult, ContribFreq, ContribTiming, chartBars, computeCompound, roundCents } from './compound';
import { COMPOUND_DICTIONARIES } from './compound-interest.i18n';
import { SHARE_SCHEMA } from './compound-interest.share';

/** Area del grafico dentro il viewBox (lascia spazio alle etichette). */
const VB_W = 640;
const VB_H = 250;
const PLOT_X = 74;
const PLOT_Y = 12;
const PLOT_R = 8;
const PLOT_H = 190;

@Component({
  selector: 'app-compound-interest',
  imports: [PrintButton, PrivacyNote, Segmented, ShareLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './compound-interest.page.html',
  styleUrl: './compound-interest.page.scss',
})
export class CompoundInterestPage {
  protected readonly i18n = inject(I18nService);

  protected readonly principalText = signal('');
  protected readonly contributionText = signal('');
  protected readonly rateText = signal('');
  protected readonly yearsText = signal('10');
  protected readonly inflationText = signal('');
  protected readonly taxText = signal('');
  protected readonly frequency = signal<ContribFreq>('monthly');
  protected readonly timing = signal<ContribTiming>('end');
  protected readonly compounding = signal<Compounding>(12);

  protected readonly frequencies = computed<SegmentOption<ContribFreq>[]>(() => [
    { value: 'monthly', label: this.i18n.t('ci.freq.monthly') },
    { value: 'yearly', label: this.i18n.t('ci.freq.yearly') },
  ]);
  protected readonly timings = computed<SegmentOption<ContribTiming>[]>(() => [
    { value: 'start', label: this.i18n.t('ci.timing.start') },
    { value: 'end', label: this.i18n.t('ci.timing.end') },
  ]);
  protected readonly compoundings = COMPOUNDINGS;

  /** Numero digitato (vuoto = valore predefinito); NaN se non è un numero. */
  private num(text: string, empty: number): number {
    if (text.trim() === '') return empty;
    return parseDecimal(text, this.i18n.lang()) ?? NaN;
  }

  private readonly input = computed<CompoundInput>(() => ({
    principal: this.num(this.principalText(), 0),
    contribution: this.num(this.contributionText(), 0),
    frequency: this.frequency(),
    timing: this.timing(),
    ratePct: this.num(this.rateText(), NaN),
    compounding: this.compounding(),
    years: this.num(this.yearsText(), NaN),
    inflationPct: this.num(this.inflationText(), 0),
    taxPct: this.num(this.taxText(), 0),
  }));

  private readonly outcome = computed(() => (this.rateText().trim() === '' ? null : computeCompound(this.input())));
  protected readonly result = computed<CompoundResult | null>(() => {
    const o = this.outcome();
    return o?.ok ? o.result : null;
  });
  protected readonly error = computed<CompoundError | null>(() => {
    const o = this.outcome();
    return o && !o.ok ? o.error : null;
  });
  /** Errore da mostrare sotto il campo giusto. */
  protected fieldError(field: 'amount' | 'rate' | 'years' | 'inflation' | 'tax'): boolean {
    const e = this.error();
    if (e === null) return false;
    const i = this.input();
    switch (field) {
      case 'amount':
        return e === 'negative' || (e === 'amount' && (!Number.isFinite(i.principal) || !Number.isFinite(i.contribution) || i.principal > 1e12 || i.contribution > 1e12)) || e === 'nothing';
      case 'rate':
        return e === 'rate' || (e === 'amount' && !Number.isFinite(i.ratePct));
      case 'years':
        return e === 'years' || (e === 'amount' && !Number.isFinite(i.years));
      case 'inflation':
        return e === 'inflation' || (e === 'amount' && !Number.isFinite(i.inflationPct));
      case 'tax':
        return e === 'tax' || (e === 'amount' && !Number.isFinite(i.taxPct));
    }
  }
  protected readonly amountErrorKey = computed(() => (this.error() === 'nothing' ? 'ci.err.nothing' : this.error() === 'negative' ? 'ci.err.negative' : 'ci.err.amount'));

  /** Parametri per il riepilogo di stampa (al posto dei campi). */
  protected readonly printParams = computed<PrintParam[]>(() => {
    const t = (k: string) => this.i18n.t(k);
    const p = (label: string, value: string): PrintParam => ({ label, value: value.trim() || '-' });
    return [
      p(t('ci.principal'), this.principalText()),
      p(t('ci.contribution'), this.contributionText()),
      p(t('ci.frequency'), t('ci.freq.' + this.frequency())),
      p(t('ci.timing'), t('ci.timing.' + this.timing())),
      p(t('ci.rate'), this.rateText()),
      p(t('ci.years'), this.yearsText()),
      p(t('ci.compounding'), t('ci.comp.' + this.compounding())),
      p(t('ci.inflation'), this.inflationText()),
      p(t('ci.tax'), this.taxText()),
    ];
  });

  protected readonly hasTax = computed(() => (this.input().taxPct || 0) > 0);

  // ---- grafico ----
  protected readonly vbW = VB_W;
  protected readonly vbH = VB_H;
  /** Margine sinistro proporzionato all'etichetta più lunga dell'asse Y (carattere mono da 12 px, circa 7,3 px a carattere). */
  protected readonly plotX = computed(() => Math.max(PLOT_X, Math.ceil(this.yMax().length * 7.3) + 14));
  protected readonly plotY = PLOT_Y;
  protected readonly plotW = computed(() => VB_W - this.plotX() - PLOT_R);
  protected readonly plotH = PLOT_H;
  protected readonly bars = computed(() => {
    const r = this.result();
    return r ? chartBars(r.rows, this.plotW(), PLOT_H) : [];
  });
  protected readonly yMax = computed(() => (this.result() ? this.compact(this.result()!.final) : ''));

  // ---- link di condivisione ----
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    principalText: this.principalText,
    contributionText: this.contributionText,
    rateText: this.rateText,
    yearsText: this.yearsText,
    inflationText: this.inflationText,
    taxText: this.taxText,
    frequency: this.frequency,
    timing: this.timing,
    compounding: this.compounding,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  constructor() {
    this.i18n.register(COMPOUND_DICTIONARIES);
  }

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  protected money(x: number): string {
    return formatMoney(Math.round(roundCents(x) * 100), this.i18n.locale());
  }
  /** Importo abbreviato per le etichette del grafico (1,2 mln, 350 mila). */
  protected compact(x: number): string {
    const it = this.i18n.lang() === 'it';
    const fmt = (v: number) => {
      const s = (Math.round(v * 10) / 10).toString();
      return it ? s.replace('.', ',') : s;
    };
    if (x >= 1e9) return fmt(x / 1e9) + (it ? ' mld' : ' bn');
    if (x >= 1e6) return fmt(x / 1e6) + (it ? ' mln' : ' m');
    if (x >= 1e4) return fmt(x / 1e3) + (it ? ' mila' : ' k');
    return Math.round(x).toString();
  }
  protected rate(pct: number): string {
    const s = String(Math.round(pct * 1000) / 1000);
    return (this.i18n.lang() === 'it' ? s.replace('.', ',') : s) + '%';
  }
  protected onCompounding(v: string): void {
    this.compounding.set(Number(v) as Compounding);
  }
}
