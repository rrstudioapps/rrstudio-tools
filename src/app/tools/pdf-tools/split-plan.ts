// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { RangeError, parseRanges, rangePages } from './page-ranges';

export type SplitMode = 'each' | 'every' | 'ranges';

export interface SplitOptions {
  /** Pagine per file nella modalità "every". */
  every: number;
  /** Testo degli intervalli nella modalità "ranges". */
  ranges: string;
}

/** Un file di uscita: posizioni (da 1) delle pagine nell'ordine in cui compaiono nella griglia. */
export type SplitGroup = number[];

export type SplitPlan =
  | { ok: true; groups: SplitGroup[] }
  | { ok: false; error: RangeError | { code: 'every'; token: string; total: number } | { code: 'none'; token: ''; total: number } };

/** Calcola come dividere `total` pagine. Non tocca i file: restituisce solo il piano. */
export function planSplit(mode: SplitMode, total: number, opts: SplitOptions): SplitPlan {
  if (total < 1) return { ok: false, error: { code: 'none', token: '', total } };
  if (mode === 'each') {
    return { ok: true, groups: Array.from({ length: total }, (_, i) => [i + 1]) };
  }
  if (mode === 'every') {
    const n = opts.every;
    if (!Number.isInteger(n) || n < 1) return { ok: false, error: { code: 'every', token: String(n), total } };
    const groups: SplitGroup[] = [];
    for (let start = 1; start <= total; start += n) {
      const end = Math.min(start + n - 1, total);
      groups.push(Array.from({ length: end - start + 1 }, (_, i) => start + i));
    }
    return { ok: true, groups };
  }
  const parsed = parseRanges(opts.ranges, total);
  if (!parsed.ok) return parsed;
  return { ok: true, groups: parsed.ranges.map(rangePages) };
}
