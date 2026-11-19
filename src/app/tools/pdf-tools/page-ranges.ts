// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Intervallo di pagine, numerate da 1, estremi inclusi. */
export interface PageRange {
  from: number;
  to: number;
}

export type RangeErrorCode = 'empty' | 'syntax' | 'outOfRange' | 'reversed';

export interface RangeError {
  code: RangeErrorCode;
  /** Pezzo di testo che ha causato l'errore (già senza spazi). */
  token: string;
  /** Numero di pagine disponibili. */
  total: number;
}

export type RangeParse = { ok: true; ranges: PageRange[] } | { ok: false; error: RangeError };

const TOKEN = /^(\d+)(?:\s*[-–—]\s*(\d+))?$/;

/**
 * Interpreta un testo tipo "1-3, 5, 8-10" con `total` pagine disponibili.
 * Gli spazi attorno a numeri e trattini sono ignorati (ma "2 3" non è un numero) e le virgole doppie
 * o finali tollerate. Gli intervalli possono sovrapporsi (restano separati, nell'ordine scritto).
 * Sono errori: testo vuoto, sintassi non valida, pagine fuori da 1..total e intervalli al contrario
 * (es. "5-3").
 */
export function parseRanges(text: string, total: number): RangeParse {
  const tokens = text
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter((t) => t !== '');
  if (tokens.length === 0) return { ok: false, error: { code: 'empty', token: '', total } };
  const ranges: PageRange[] = [];
  for (const token of tokens) {
    const m = TOKEN.exec(token);
    if (!m) return { ok: false, error: { code: 'syntax', token, total } };
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]);
    if (from < 1 || to < 1 || from > total || to > total) {
      return { ok: false, error: { code: 'outOfRange', token, total } };
    }
    if (from > to) return { ok: false, error: { code: 'reversed', token, total } };
    ranges.push({ from, to });
  }
  return { ok: true, ranges };
}

/** Elenco delle pagine (da 1) di un intervallo. */
export function rangePages(r: PageRange): number[] {
  return Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i);
}
