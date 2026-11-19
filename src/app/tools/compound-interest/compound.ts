// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Interesse composto con versamenti periodici. Logica pura, senza DOM e senza Angular.
 *
 * Modello: il tasso annuo nominale `r` con `n` capitalizzazioni l'anno dà il tasso annuo effettivo
 * `(1 + r/n)^n − 1`; la simulazione procede mese per mese con il tasso mensile equivalente
 * `(1 + effettivo)^(1/12) − 1`. Con capitalizzazione mensile il tasso mensile è quindi esattamente `r/12`
 * e i risultati coincidono con le formule chiuse dei libri; con capitalizzazione annuale, a fine anno il capitale
 * è esattamente `P·(1 + r)^anni`. I versamenti annuali cadono all'inizio (mese 1) o alla fine (mese 12) dell'anno,
 * quelli mensili all'inizio o alla fine di ogni mese. Nessuna imposta di legge è inclusa.
 */

export type ContribFreq = 'monthly' | 'yearly';
export type ContribTiming = 'start' | 'end';
export const COMPOUNDINGS = [1, 2, 4, 12, 365] as const;
export type Compounding = (typeof COMPOUNDINGS)[number];

export interface CompoundInput {
  principal: number;
  /** Versamento a ogni periodo (mese o anno). */
  contribution: number;
  frequency: ContribFreq;
  timing: ContribTiming;
  /** Tasso annuo nominale in percentuale (5 = 5%). */
  ratePct: number;
  compounding: Compounding;
  years: number;
  inflationPct: number;
  /** Tassazione sui rendimenti in percentuale, applicata una sola volta alla fine sugli interessi maturati. */
  taxPct: number;
}

export interface YearRow {
  year: number;
  /** Capitale iniziale più versamenti fatti fino a fine anno. */
  deposited: number;
  /** Interessi maturati fino a fine anno. */
  interest: number;
  balance: number;
  /** Montante in euro di oggi (deflazionato con l'inflazione). */
  real: number;
}

export interface CompoundResult {
  rows: YearRow[];
  final: number;
  deposited: number;
  interest: number;
  real: number;
  /** Imposta sugli interessi (0 se il campo è vuoto). */
  tax: number;
  netFinal: number;
  netInterest: number;
  netReal: number;
  /** Tasso annuo effettivo in percentuale. */
  effectiveRatePct: number;
}

export type CompoundOutcome = { ok: true; result: CompoundResult } | { ok: false; error: CompoundError };
export type CompoundError = 'nothing' | 'negative' | 'rate' | 'years' | 'inflation' | 'tax' | 'amount';

export const MAX_AMOUNT = 1e12;
export const MAX_YEARS = 100;

/** Arrotonda al centesimo. */
export function roundCents(x: number): number {
  return Math.round((x + Math.sign(x) * Number.EPSILON * Math.abs(x)) * 100) / 100;
}

export function effectiveAnnualRate(ratePct: number, compounding: Compounding): number {
  return Math.pow(1 + ratePct / 100 / compounding, compounding) - 1;
}

export function validate(i: CompoundInput): CompoundError | null {
  if (![i.principal, i.contribution, i.ratePct, i.years, i.inflationPct, i.taxPct].every(Number.isFinite)) return 'amount';
  if (i.principal < 0 || i.contribution < 0) return 'negative';
  if (i.principal > MAX_AMOUNT || i.contribution > MAX_AMOUNT) return 'amount';
  if (i.ratePct < 0 || i.ratePct > 100) return 'rate';
  if (!Number.isInteger(i.years) || i.years < 1 || i.years > MAX_YEARS) return 'years';
  if (i.inflationPct < 0 || i.inflationPct > 100) return 'inflation';
  if (i.taxPct < 0 || i.taxPct > 100) return 'tax';
  if (i.principal === 0 && i.contribution === 0) return 'nothing';
  return null;
}

export function computeCompound(input: CompoundInput): CompoundOutcome {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const eff = effectiveAnnualRate(input.ratePct, input.compounding);
  const monthly = Math.pow(1 + eff, 1 / 12) - 1;
  // con capitalizzazione mensile il tasso mensile è esattamente r/12 (senza il rumore di pow)
  const rm = input.compounding === 12 ? input.ratePct / 100 / 12 : monthly;
  const defl = 1 + input.inflationPct / 100;

  let balance = input.principal;
  let deposited = input.principal;
  const rows: YearRow[] = [];
  for (let y = 1; y <= input.years; y++) {
    for (let m = 1; m <= 12; m++) {
      const pay = input.frequency === 'monthly' || (input.timing === 'start' ? m === 1 : m === 12);
      if (pay && input.timing === 'start') {
        balance += input.contribution;
        deposited += input.contribution;
      }
      balance += balance * rm;
      if (pay && input.timing === 'end') {
        balance += input.contribution;
        deposited += input.contribution;
      }
    }
    rows.push({ year: y, deposited, interest: balance - deposited, balance, real: balance / Math.pow(defl, y) });
  }

  const last = rows[rows.length - 1];
  const interest = last.interest;
  const tax = (interest * input.taxPct) / 100;
  const realFactor = Math.pow(defl, input.years);
  return {
    ok: true,
    result: {
      rows,
      final: last.balance,
      deposited: last.deposited,
      interest,
      real: last.real,
      tax,
      netFinal: last.balance - tax,
      netInterest: interest - tax,
      netReal: (last.balance - tax) / realFactor,
      effectiveRatePct: eff * 100,
    },
  };
}

// ---------- grafico ----------

export interface Bar {
  year: number;
  x: number;
  width: number;
  /** Parte versata (in basso). */
  depositedY: number;
  depositedH: number;
  /** Parte di interessi (sopra). */
  interestY: number;
  interestH: number;
}

/** Barre impilate in un'area `width` × `height` (origine in alto a sinistra); il massimo occupa tutta l'altezza. */
export function chartBars(rows: readonly YearRow[], width: number, height: number): Bar[] {
  if (rows.length === 0) return [];
  const max = Math.max(...rows.map((r) => r.balance));
  const slot = width / rows.length;
  const gap = Math.min(4, slot * 0.2);
  const w = Math.max(1, slot - gap);
  return rows.map((r, i) => {
    const dh = max > 0 ? (Math.max(0, r.deposited) / max) * height : 0;
    const ih = max > 0 ? (Math.max(0, r.interest) / max) * height : 0;
    return { year: r.year, x: i * slot + gap / 2, width: w, depositedY: height - dh, depositedH: dh, interestY: height - dh - ih, interestH: ih };
  });
}

/** Tabella anno per anno in CSV (importi in euro con due decimali, punto decimale). */
export function csvRows(rows: readonly YearRow[]): string {
  return ['year,deposited,interest,balance,real', ...rows.map((r) => [r.year, r.deposited, r.interest, r.balance, r.real].map((v, k) => (k === 0 ? String(v) : roundCents(v).toFixed(2))).join(','))].join('\n');
}
