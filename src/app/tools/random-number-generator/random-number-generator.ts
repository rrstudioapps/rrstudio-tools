// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Estrazioni casuali: numeri, dadi, elenchi e monete. La sorgente è `crypto.getRandomValues` e i valori si ottengono per
 * scarto (rejection sampling), quindi non c'è la leggera distorsione del `% n`. Nei test la sorgente si sostituisce.
 */

/** Sorgente di interi a 32 bit non negativi. */
export type U32 = () => number;

export const cryptoU32: U32 = () => crypto.getRandomValues(new Uint32Array(1))[0];

const TWO32 = 2 ** 32;
const TWO53 = 2 ** 53;

/** Intero uniforme in [0, range) con range ≤ 2^53. */
function below(range: number, u32: U32): number {
  if (range <= 1) return 0;
  if (range <= TWO32) {
    const limit = TWO32 - (TWO32 % range);
    for (;;) {
      const x = u32();
      if (x < limit) return x % range;
    }
  }
  const limit = TWO53 - (TWO53 % range);
  for (;;) {
    const x = (u32() & 0x1fffff) * TWO32 + u32(); // 21 + 32 = 53 bit
    if (x < limit) return x % range;
  }
}

/** Intero uniforme tra `min` e `max` inclusi (interi sicuri, min ≤ max). */
export function randomInt(min: number, max: number, u32: U32 = cryptoU32): number {
  return min + below(max - min + 1, u32);
}

export function shuffle<T>(items: readonly T[], u32: U32 = cryptoU32): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = below(i + 1, u32);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- numeri ---------------------------------------------------------------------------------------------------------

export interface NumberSpec {
  min: number;
  max: number;
  count: number;
  /** Senza ripetizioni. */
  unique: boolean;
  /** Cifre decimali (0 = interi). */
  decimals: number;
  /** In ordine crescente. */
  sorted: boolean;
}

export type NumbersResult = { ok: true; values: number[] } | { ok: false; error: 'range' | 'count' | 'tooMany' | 'unique' | 'tooBig' };

export const MAX_COUNT = 1000;

export function randomNumbers(spec: NumberSpec, u32: U32 = cryptoU32): NumbersResult {
  const { min, max, count, unique, decimals, sorted } = spec;
  if (![min, max, count, decimals].every(Number.isFinite) || !Number.isInteger(count) || !Number.isInteger(decimals)) return { ok: false, error: 'range' };
  if (min > max) return { ok: false, error: 'range' };
  if (count < 1) return { ok: false, error: 'count' };
  if (count > MAX_COUNT) return { ok: false, error: 'tooMany' };
  const scale = 10 ** Math.min(Math.max(decimals, 0), 6);
  const lo = Math.ceil(min * scale - 1e-9);
  const hi = Math.floor(max * scale + 1e-9);
  if (lo > hi) return { ok: false, error: 'range' };
  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || hi - lo + 1 > TWO53) return { ok: false, error: 'tooBig' };
  const range = hi - lo + 1;
  if (unique && count > range) return { ok: false, error: 'unique' };
  let ints: number[];
  if (unique) {
    // scambi di Fisher–Yates "virtuali": funzionano anche con intervalli enormi senza costruire l'elenco
    const swapped = new Map<number, number>();
    ints = [];
    for (let i = 0; i < count; i++) {
      const j = i + below(range - i, u32);
      ints.push((swapped.get(j) ?? j) + lo);
      swapped.set(j, swapped.get(i) ?? i);
    }
  } else {
    ints = Array.from({ length: count }, () => randomInt(lo, hi, u32));
  }
  let values = ints.map((n) => n / scale);
  if (sorted) values = values.sort((a, b) => a - b);
  return { ok: true, values };
}

// --- dadi -----------------------------------------------------------------------------------------------------------

export interface DiceSpec {
  count: number;
  sides: number;
  /** Bonus o malus sul totale. */
  mod: number;
}

export const MAX_DICE = 100;
export const MAX_SIDES = 1000;

/** Legge la notazione dei dadi: `2d6+3`, `d20`, `4d8-1`, `3D10` (maiuscole e spazi ammessi). */
export function parseDice(text: string): DiceSpec | null {
  const m = /^(\d{0,3})d(\d{1,4})(?:([+-])(\d{1,5}))?$/.exec(text.toLowerCase().replace(/\s+/g, ''));
  if (!m) return null;
  const count = m[1] === '' ? 1 : Number(m[1]);
  const sides = Number(m[2]);
  if (count < 1 || count > MAX_DICE || sides < 2 || sides > MAX_SIDES) return null;
  const mod = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0;
  return { count, sides, mod };
}

export function formatDice(spec: DiceSpec): string {
  return `${spec.count}d${spec.sides}${spec.mod > 0 ? '+' + spec.mod : spec.mod < 0 ? String(spec.mod) : ''}`;
}

export function rollDice(spec: DiceSpec, u32: U32 = cryptoU32): { rolls: number[]; total: number } {
  const rolls = Array.from({ length: spec.count }, () => randomInt(1, spec.sides, u32));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) + spec.mod };
}

// --- elenchi --------------------------------------------------------------------------------------------------------

/**
 * Voci di un elenco: una per riga; se il testo è su una sola riga si separa anche con virgole e punti e virgola.
 * Spazi tolti, righe vuote scartate.
 */
export function parseList(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const parts = lines.filter((l) => l.trim() !== '').length <= 1 ? text.split(/[,;\n]/) : lines;
  return parts.map((p) => p.trim()).filter((p) => p !== '');
}

/** Estrae `n` voci (senza ripetizioni, o con se `unique` è falso). */
export function pickFromList<T>(items: readonly T[], n: number, unique: boolean, u32: U32 = cryptoU32): T[] {
  if (items.length === 0 || n < 1) return [];
  if (!unique) return Array.from({ length: n }, () => items[below(items.length, u32)]);
  return shuffle(items, u32).slice(0, Math.min(n, items.length));
}

/** Divide le voci in `teams` squadre della stessa dimensione (±1), mescolando. */
export function splitTeams<T>(items: readonly T[], teams: number, u32: U32 = cryptoU32): T[][] {
  const n = Math.max(1, Math.floor(teams));
  const out: T[][] = Array.from({ length: n }, () => []);
  shuffle(items, u32).forEach((x, i) => out[i % n].push(x));
  return out;
}

// --- moneta ---------------------------------------------------------------------------------------------------------

export function flipCoins(count: number, u32: U32 = cryptoU32): { heads: number; tails: number; flips: boolean[] } {
  const flips = Array.from({ length: count }, () => below(2, u32) === 1);
  const heads = flips.filter(Boolean).length;
  return { heads, tails: flips.length - heads, flips };
}
