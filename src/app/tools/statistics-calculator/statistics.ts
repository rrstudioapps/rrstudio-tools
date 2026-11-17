// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { parseDecimal } from '../../shared/decimal';

type Lang = 'it' | 'en';

export interface ParsedNumbers {
  values: number[];
  /** Voci che non sono numeri (prime 5, per il messaggio). */
  invalid: string[];
  invalidCount: number;
}

/** Divide un testo in voci: spazi, a capo e punto e virgola; in inglese anche la virgola (tranne nelle migliaia come 1,234). */
function tokens(text: string, lang: Lang): string[] {
  const out: string[] = [];
  for (const t of text.split(/[\s;]+/)) {
    if (t === '') continue;
    if (lang === 'en' && t.includes(',') && !/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) && !/^[+-]?\d*,\d+$/.test(t)) out.push(...t.split(',').filter((x) => x !== ''));
    else out.push(t);
  }
  return out;
}

/** Elenco di numeri incollati. */
export function parseNumberList(text: string, lang: Lang): ParsedNumbers {
  return collect(tokens(text, lang), lang);
}

function collect(items: string[], lang: Lang): ParsedNumbers {
  const values: number[] = [];
  const invalid: string[] = [];
  let invalidCount = 0;
  for (const t of items) {
    const n = parseDecimal(t, lang);
    if (n === null) {
      invalidCount++;
      if (invalid.length < 5) invalid.push(t);
    } else values.push(n);
  }
  return { values, invalid, invalidCount };
}

/** Righe CSV: delimitatore rilevato dalla prima riga (; tab , nell'ordine di frequenza), virgolette doppie supportate. */
export function parseCsvRows(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  const count = (c: string) => first.split(c).length - 1;
  const delim = [';', '\t', ','].reduce((best, c) => (count(c) > count(best) ? c : best), ';');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** Numero di colonne del CSV e intestazioni (se la prima riga è un'intestazione). */
export function csvColumns(text: string): number {
  return parseCsvRows(text).reduce((m, r) => Math.max(m, r.length), 0);
}

/** Una colonna del CSV (indice da 0) come elenco di numeri; `header` salta la prima riga. */
export function parseCsvColumn(text: string, column: number, header: boolean, lang: Lang): ParsedNumbers {
  const rows = parseCsvRows(text);
  const body = header ? rows.slice(1) : rows;
  return collect(
    body.map((r) => (r[column] ?? '').trim()).filter((c) => c !== ''),
    lang,
  );
}

export interface Quartiles {
  q1: number;
  q2: number;
  q3: number;
  iqr: number;
}

/**
 * Percentile con interpolazione lineare tra i valori ordinati (metodo "inclusivo": rango p·(n−1),
 * come QUARTILE.INC / PERCENTILE.INC di Excel e il tipo 7 di R). `sorted` deve essere ordinato e non vuoto.
 */
export function percentileSorted(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 1) return sorted[0];
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

/** Istogramma con `bins` classi di uguale ampiezza (l'ultima include il massimo). Con tutti i valori uguali una sola classe. */
export function histogram(sorted: number[], bins: number): HistogramBin[] {
  if (sorted.length === 0) return [];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) return [{ from: min, to: max, count: sorted.length }];
  const k = Math.max(1, Math.min(60, Math.floor(bins)));
  const w = (max - min) / k;
  const out: HistogramBin[] = Array.from({ length: k }, (_, i) => ({ from: min + i * w, to: i === k - 1 ? max : min + (i + 1) * w, count: 0 }));
  for (const v of sorted) out[Math.min(k - 1, Math.floor((v - min) / w))].count++;
  return out;
}

/** Numero di classi suggerito dalla regola di Sturges: ⌈log2 n⌉ + 1. */
export function sturges(n: number): number {
  return n < 2 ? 1 : Math.ceil(Math.log2(n)) + 1;
}

export interface Stats {
  count: number;
  sum: number;
  min: number;
  max: number;
  range: number;
  mean: number;
  median: number;
  /** Valori più frequenti (vuoto se tutti compaiono una volta sola) e quante volte compaiono. */
  mode: number[];
  modeCount: number;
  /** Con meno di due valori sono null. */
  varianceSample: number | null;
  variancePopulation: number;
  sdSample: number | null;
  sdPopulation: number;
  quartiles: Quartiles;
  fences: { low: number; high: number };
  outliers: number[];
  sorted: number[];
}

/** Tutte le statistiche descrittive di un insieme di numeri (null se vuoto). */
export function computeStats(values: number[]): Stats | null {
  const n = values.length;
  if (n === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  // somma compensata (Kahan–Neumaier) per non perdere cifre su molti valori
  let sum = 0;
  let c = 0;
  for (const v of sorted) {
    const t = sum + v;
    c += Math.abs(sum) >= Math.abs(v) ? sum - t + v : v - t + sum;
    sum = t;
  }
  sum += c;
  const mean = sum / n;
  let ss = 0;
  for (const v of sorted) ss += (v - mean) ** 2;
  const freq = new Map<number, number>();
  for (const v of sorted) freq.set(v, (freq.get(v) ?? 0) + 1);
  const modeCount = Math.max(...freq.values());
  const mode = modeCount > 1 ? [...freq].filter(([, f]) => f === modeCount).map(([v]) => v) : [];
  const q1 = percentileSorted(sorted, 25);
  const q2 = percentileSorted(sorted, 50);
  const q3 = percentileSorted(sorted, 75);
  const iqr = q3 - q1;
  const fences = { low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr };
  return {
    count: n,
    sum,
    min: sorted[0],
    max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
    mean,
    median: q2,
    mode,
    modeCount: mode.length ? modeCount : 1,
    varianceSample: n > 1 ? ss / (n - 1) : null,
    variancePopulation: ss / n,
    sdSample: n > 1 ? Math.sqrt(ss / (n - 1)) : null,
    sdPopulation: Math.sqrt(ss / n),
    quartiles: { q1, q2, q3, iqr },
    fences,
    outliers: sorted.filter((v) => v < fences.low || v > fences.high),
    sorted,
  };
}
