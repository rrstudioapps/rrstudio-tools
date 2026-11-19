// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Rata di un mutuo con ammortamento alla francese (rata costante). Importi interi in CENTESIMI.
 * Il tasso periodico è quello proporzionale usato dalle banche italiane: TAN / rate all'anno
 * (TAN 3% con rate mensili: 0,25% al mese). Gli interessi di ogni rata sono arrotondati al centesimo
 * e l'ultima rata assorbe la differenza, così il debito residuo finale è esattamente zero.
 *
 * Strumento indicativo: non include spese, assicurazioni, istruttoria né il TAEG.
 */

/** Mesi tra una rata e l'altra per ogni periodicità. */
export const PERIODICITY_MONTHS = { monthly: 1, quarterly: 3, semiannual: 6 } as const;
export type Periodicity = keyof typeof PERIODICITY_MONTHS;

export const MAX_CAPITAL_CENTS = 1_000_000_000_00; // 1 miliardo di euro
export const MAX_MONTHS = 600; // 50 anni

export interface MortgageInput {
  /** Capitale finanziato in centesimi. */
  capital: number;
  /** TAN annuo in percentuale (3,25 = 3,25%). */
  tan: number;
  /** Durata totale in mesi. */
  months: number;
  periodicity: Periodicity;
}

export interface ScheduleRow {
  /** Numero progressivo della rata (da 1). */
  n: number;
  payment: number;
  interest: number;
  principal: number;
  /** Debito residuo dopo la rata. */
  balance: number;
}

export type MortgageError = 'capital' | 'tan' | 'duration' | 'multiple';

export interface MortgageResult {
  periods: number;
  /** Rata costante (l'ultima può differire di qualche centesimo). */
  payment: number;
  /** Tasso periodico in percentuale (per mostrarlo). */
  periodicRate: number;
  totalInterest: number;
  totalPaid: number;
  schedule: ScheduleRow[];
}

export type MortgageOutcome = { ok: true; result: MortgageResult } | { ok: false; error: MortgageError };

/** TAN digitato ("3,25", "3.25", "3,25%") → percentuale; null se non valido (0-100, fino a tre decimali). */
export function parseRate(input: string): number | null {
  const v = input.replace(/[%\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(v)) return null;
  const n = Number(v);
  return n <= 100 ? n : null;
}

/** Numero intero non negativo (anni o mesi digitati); null se non valido. */
export function parseWhole(input: string): number | null {
  const v = input.trim();
  if (v === '') return 0;
  return /^\d{1,4}$/.test(v) ? Number(v) : null;
}

/** Rata costante in centesimi per `n` rate al tasso periodico `i` (frazione, 0,0025 = 0,25%). */
export function constantPayment(capital: number, i: number, n: number): number {
  if (i === 0) return Math.round(capital / n);
  // C·i / (1 - (1+i)^-n) scritta con expm1/log1p: stabile anche per tassi minuscoli
  return Math.round((capital * i) / -Math.expm1(-n * Math.log1p(i)));
}

export function computeMortgage(input: MortgageInput): MortgageOutcome {
  const { capital, tan, months, periodicity } = input;
  if (!Number.isInteger(capital) || capital <= 0 || capital > MAX_CAPITAL_CENTS) return { ok: false, error: 'capital' };
  if (!(tan >= 0) || tan > 100) return { ok: false, error: 'tan' };
  if (!Number.isInteger(months) || months <= 0 || months > MAX_MONTHS) return { ok: false, error: 'duration' };
  const step = PERIODICITY_MONTHS[periodicity];
  if (months % step !== 0) return { ok: false, error: 'multiple' };

  const periods = months / step;
  const periodsPerYear = 12 / step;
  const i = tan / 100 / periodsPerYear;
  const payment = constantPayment(capital, i, periods);

  const schedule: ScheduleRow[] = [];
  let balance = capital;
  let totalInterest = 0;
  for (let n = 1; n <= periods; n++) {
    const interest = Math.round(balance * i);
    const last = n === periods;
    // Capitale mai negativo (la rata arrotondata può non coprire gli interessi) e debito mai azzerato prima
    // dell'ultima rata (con capitali piccoli e durate lunghe): l'ultima rata assorbe la differenza.
    const principal = last ? balance : Math.max(0, Math.min(Math.max(balance - 1, 0), payment - interest));
    balance -= principal;
    totalInterest += interest;
    schedule.push({ n, payment: principal + interest, interest, principal, balance });
  }
  const totalPaid = capital + totalInterest;
  return { ok: true, result: { periods, payment, periodicRate: tan / periodsPerYear, totalInterest, totalPaid, schedule } };
}

/** Centesimi → "1234,56" o "1234.56" (senza raggruppamento, per i fogli di calcolo). */
function plainMoney(cents: number, decimal: ',' | '.'): string {
  const s = String(Math.abs(cents)).padStart(3, '0');
  return (cents < 0 ? '-' : '') + s.slice(0, -2) + decimal + s.slice(-2);
}

/**
 * Piano di ammortamento in CSV. In italiano separatore ";" e virgola decimale (si apre bene in Excel italiano),
 * in inglese "," e punto. Inizia con il BOM UTF-8 per Excel.
 */
export function scheduleToCsv(
  schedule: readonly ScheduleRow[],
  header: readonly [string, string, string, string, string],
  lang: 'it' | 'en',
): string {
  const sep = lang === 'it' ? ';' : ',';
  const dec = lang === 'it' ? ',' : '.';
  const lines = [header.join(sep)];
  for (const r of schedule) {
    lines.push([r.n, plainMoney(r.payment, dec), plainMoney(r.interest, dec), plainMoney(r.principal, dec), plainMoney(r.balance, dec)].join(sep));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
