// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { parseDecimal } from '../../shared/decimal';

/** Importo massimo accettato per un singolo valore: 10 milioni di euro, in centesimi. */
export const MAX_CENTS = 1_000_000_000;
export const MAX_PEOPLE = 100;
export const MAX_NAME = 40;
/** Arrotondamenti della quota ammessi, in centesimi. */
export const ROUND_STEPS = [1, 5, 10, 50, 100] as const;
export type RoundStep = (typeof ROUND_STEPS)[number];

type Lang = 'it' | 'en';

/** Mancia o servizio: percentuale sul conto (in centesimi di punto, 1000 = 10%) o importo fisso in centesimi. */
export type Tip = { kind: 'percent'; hundredths: number } | { kind: 'amount'; cents: number };

export const NO_TIP: Tip = { kind: 'amount', cents: 0 };

/** Importo digitato → centesimi interi (≥ 0, arrotondato al centesimo); null se non valido o troppo grande. */
export function parseMoney(text: string, lang: Lang): number | null {
  const n = parseDecimal(text.replace(/€|\beur\b/gi, ''), lang);
  if (n === null || n < 0) return null;
  const cents = Math.round(Number((n * 100).toPrecision(12)));
  return cents <= MAX_CENTS ? cents : null;
}

/** Percentuale digitata (0-100) → centesimi di punto; null se non valida. */
export function parsePercent(text: string, lang: Lang): number | null {
  const n = parseDecimal(text, lang);
  if (n === null || n < 0 || n > 100) return null;
  return Math.round(Number((n * 100).toPrecision(12)));
}

function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

/** Mancia in centesimi su una base in centesimi. */
export function tipCents(tip: Tip, baseCents: number): number {
  return tip.kind === 'amount' ? tip.cents : Math.round((baseCents * tip.hundredths) / 10_000);
}

/**
 * Ripartisce `total` centesimi in parti intere proporzionali ai pesi, col metodo del resto più grande:
 * ognuno riceve la parte intera, poi i centesimi avanzati vanno a chi ha il resto maggiore (a parità, a chi
 * viene prima nell'elenco). La somma è sempre `total`. Con pesi tutti nulli le parti sono uguali.
 */
export function distribute(total: number, weights: readonly number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const w = weights.every((x) => x === 0) ? weights.map(() => 1n) : weights.map((x) => BigInt(x));
  const sum = w.reduce((a, b) => a + b, 0n);
  const t = BigInt(total);
  const parts = w.map((x, i) => ({ i, q: (t * x) / sum, r: (t * x) % sum }));
  let left = Number(t - parts.reduce((a, p) => a + p.q, 0n));
  const order = [...parts].sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  const out = parts.map((p) => Number(p.q));
  for (const p of order) {
    if (left <= 0) break;
    out[p.i]++;
    left--;
  }
  return out;
}

export interface EqualResult {
  /** Mancia in centesimi. */
  tip: number;
  /** Conto più mancia. */
  bill: number;
  /** Quota per persona, arrotondata per eccesso al passo scelto. */
  share: number;
  /** Totale che pagano tutti insieme. */
  paid: number;
  /** Quanto si supera il conto per l'arrotondamento. */
  surplus: number;
}

/** Divide in parti uguali conto + mancia, arrotondando la quota per eccesso al passo (in centesimi). */
export function splitEqual(opts: { total: number; people: number; tip: Tip; step: RoundStep }): EqualResult {
  const { total, people, step } = opts;
  if (!Number.isInteger(people) || people < 1 || people > MAX_PEOPLE) throw new RangeError('people');
  const tip = tipCents(opts.tip, total);
  const bill = total + tip;
  const share = ceilDiv(bill, people * step) * step;
  const paid = share * people;
  return { tip, bill, share, paid, surplus: paid - bill };
}

export type LineErrorReason = 'format' | 'name' | 'amount' | 'tooMany';

export interface LineError {
  /** Numero di riga, da 1. */
  line: number;
  text: string;
  reason: LineErrorReason;
}

export interface Diner {
  name: string;
  cents: number;
}

/**
 * Legge l'elenco dei consumi, una persona per riga: «Nome: importo», «Nome; importo» oppure «Nome importo».
 * Le righe vuote si saltano; la stessa persona su più righe (senza badare alle maiuscole) viene sommata.
 */
export function parseConsumptionLines(text: string, lang: Lang): { diners: Diner[]; errors: LineError[] } {
  const diners: Diner[] = [];
  const errors: LineError[] = [];
  const lines = text.split(/\r\n|\r|\n/);
  for (let idx = 0; idx < lines.length; idx++) {
    const line = idx + 1;
    const raw = lines[idx];
    const s = raw.replace(/€/g, ' ').trim();
    if (s === '') continue;
    const err = (reason: LineErrorReason) => errors.push({ line, text: raw.trim().slice(0, 60), reason });
    const sep = Math.max(s.lastIndexOf(':'), s.lastIndexOf(';'));
    const cut = sep >= 0 ? sep : s.search(/\s\S*$/);
    if (cut < 0) {
      err('format');
      continue;
    }
    const name = s.slice(0, cut).trim();
    if (name === '' || name.length > MAX_NAME) {
      err('name');
      continue;
    }
    const cents = parseMoney(s.slice(cut + 1), lang);
    if (cents === null) {
      err('amount');
      continue;
    }
    const existing = diners.find((d) => d.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (existing.cents + cents > MAX_CENTS) err('amount');
      else existing.cents += cents;
    } else if (diners.length >= MAX_PEOPLE) err('tooMany');
    else diners.push({ name, cents });
  }
  return { diners, errors };
}

export interface ConsumptionRow {
  name: string;
  consumption: number;
  common: number;
  tip: number;
  total: number;
}

export interface ConsumptionResult {
  rows: ConsumptionRow[];
  consumption: number;
  common: number;
  tip: number;
  /** Totale del conto: consumi + costi comuni + mancia. */
  total: number;
  /** Somma delle quote delle persone (sempre uguale a `total`). */
  sum: number;
}

/**
 * Divide per consumo: ognuno paga ciò che ha ordinato, i costi comuni si dividono in parti uguali e la mancia
 * (percentuale su consumi + costi comuni, o importo fisso) in proporzione ai consumi. I centesimi di resto sono
 * distribuiti col metodo del resto più grande, quindi la somma delle quote è esattamente il totale.
 */
export function splitByConsumption(opts: { diners: readonly Diner[]; common: number; tip: Tip }): ConsumptionResult {
  const { diners } = opts;
  if (diners.length === 0) throw new RangeError('diners');
  const consumption = diners.reduce((a, d) => a + d.cents, 0);
  const tip = tipCents(opts.tip, consumption + opts.common);
  const common = distribute(opts.common, diners.map(() => 1));
  const tips = distribute(tip, diners.map((d) => d.cents));
  const rows = diners.map((d, i) => ({ name: d.name, consumption: d.cents, common: common[i], tip: tips[i], total: d.cents + common[i] + tips[i] }));
  return { rows, consumption, common: opts.common, tip, total: consumption + opts.common + tip, sum: rows.reduce((a, r) => a + r.total, 0) };
}

/** Importo in euro per la lingua (centesimi → «12,50 €»). */
export function formatCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
