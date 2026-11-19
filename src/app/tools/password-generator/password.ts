// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { RandomSource, cryptoSource, randomChar, randomInt } from './random';

export const LOWER = 'abcdefghijklmnopqrstuvwxyz';
export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const DIGITS = '0123456789';
export const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?/~|';
/** Caratteri facili da confondere. */
export const AMBIGUOUS = '0Oo1lI|';

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;
export const MIN_WORDS = 3;
export const MAX_WORDS = 12;
export const SEPARATORS = ['-', ' ', '.', '_', ''] as const;
export type Separator = (typeof SEPARATORS)[number];
/** Il numero opzionale della passphrase va da 0 a 99. */
export const NUMBER_RANGE = 100;

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  noAmbiguous: boolean;
}

export interface PassphraseOptions {
  words: number;
  separator: Separator;
  capitalize: boolean;
  withNumber: boolean;
}

export interface Generated {
  text: string;
  /** Entropia in bit dello spazio da cui è stata estratta (log2 del numero di risultati possibili). */
  bits: number;
}

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Insiemi di caratteri attivi (disgiunti), già privati dei caratteri ambigui se richiesto. */
export function activeSets(o: PasswordOptions): string[] {
  const strip = (s: string): string => (o.noAmbiguous ? [...s].filter((c) => !AMBIGUOUS.includes(c)).join('') : s);
  const sets: string[] = [];
  if (o.lower) sets.push(strip(LOWER));
  if (o.upper) sets.push(strip(UPPER));
  if (o.digits) sets.push(strip(DIGITS));
  if (o.symbols) sets.push(strip(SYMBOLS));
  return sets;
}

/**
 * Genera una password. Si estrae ogni carattere uniformemente dall'unione dei set e si riprova
 * finché c'è almeno un carattere per ogni set scelto: la distribuzione resta uniforme sulle sole
 * password valide (nessuna scorciatoia che sbilanci le posizioni o i caratteri).
 */
export function generatePassword(o: PasswordOptions, src: RandomSource = cryptoSource): Generated {
  const sets = activeSets(o);
  if (sets.length === 0) throw new RangeError('serve almeno un insieme di caratteri');
  const length = clamp(o.length, MIN_LENGTH, MAX_LENGTH);
  if (length < sets.length) throw new RangeError('lunghezza minore del numero di insiemi');
  const pool = sets.join('');
  for (let attempt = 0; attempt < 100_000; attempt++) {
    let out = '';
    for (let i = 0; i < length; i++) out += randomChar(pool, src);
    if (sets.every((s) => [...s].some((c) => out.includes(c)))) {
      return { text: out, bits: passwordEntropy(o) };
    }
  }
  throw new Error('generazione non riuscita'); // praticamente impossibile con una sorgente uniforme
}

/**
 * Entropia onesta: log2 del numero di password valide, cioè di lunghezza L con almeno un carattere
 * per ogni set (inclusione-esclusione sui set mancanti), non un'euristica sulla stringa.
 */
export function passwordEntropy(o: PasswordOptions): number {
  const sets = activeSets(o).map((s) => s.length);
  const length = clamp(o.length, MIN_LENGTH, MAX_LENGTH);
  const total = sets.reduce((a, b) => a + b, 0);
  let count = 0n;
  for (let mask = 0; mask < 1 << sets.length; mask++) {
    let size = total;
    let bits = 0;
    for (let i = 0; i < sets.length; i++) {
      if (mask & (1 << i)) {
        size -= sets[i];
        bits++;
      }
    }
    const term = BigInt(size) ** BigInt(length);
    count += bits % 2 === 0 ? term : -term;
  }
  return count > 0n ? log2BigInt(count) : 0;
}

/** log2 di un BigInt positivo (precisione ~53 bit di mantissa). */
export function log2BigInt(n: bigint): number {
  const s = n.toString(2);
  if (s.length <= 53) return Math.log2(Number(n));
  return Math.log2(parseInt(s.slice(0, 53), 2)) + (s.length - 53);
}

/** Genera una passphrase: parole scelte con randomInt dalla lista, senza altre trasformazioni casuali. */
export function generatePassphrase(
  o: PassphraseOptions,
  wordlist: readonly string[],
  src: RandomSource = cryptoSource,
): Generated {
  if (wordlist.length < 2) throw new RangeError('lista di parole vuota');
  const n = clamp(o.words, MIN_WORDS, MAX_WORDS);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const w = wordlist[randomInt(wordlist.length, src)];
    parts.push(o.capitalize ? w.charAt(0).toUpperCase() + w.slice(1) : w);
  }
  if (o.withNumber) parts.push(String(randomInt(NUMBER_RANGE, src)));
  return { text: parts.join(o.separator), bits: passphraseEntropy(o, wordlist.length) };
}

export function passphraseEntropy(o: PassphraseOptions, listSize: number): number {
  const n = clamp(o.words, MIN_WORDS, MAX_WORDS);
  return n * Math.log2(listSize) + (o.withNumber ? Math.log2(NUMBER_RANGE) : 0);
}

export type Strength = 'weak' | 'fair' | 'strong' | 'veryStrong';

export function strengthOf(bits: number): Strength {
  if (bits < 50) return 'weak';
  if (bits < 80) return 'fair';
  if (bits < 110) return 'strong';
  return 'veryStrong';
}

/** Tentativi al secondo ipotizzati per la stima (attaccante con molto hardware, hash veloce). */
export const GUESSES_PER_SECOND = 1e10;

/** Tempo medio per indovinare (si prova metà dello spazio), in secondi. */
export function crackSeconds(bits: number): number {
  return Math.pow(2, bits - 1) / GUESSES_PER_SECOND;
}

export type DurationUnit =
  | 'instant'
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'year'
  | 'millionYear'
  | 'billionYear'
  | 'overTrillion';

export interface Duration {
  unit: DurationUnit;
  value: number;
}

const YEAR = 365.25 * 86400;

/** Porta i secondi nell'unità più leggibile (la formattazione testuale sta nella pagina, via i18n). */
export function describeDuration(seconds: number): Duration {
  if (seconds < 1) return { unit: 'instant', value: 0 };
  if (seconds < 60) return { unit: 'second', value: Math.round(seconds) };
  if (seconds < 3600) return { unit: 'minute', value: Math.round(seconds / 60) };
  if (seconds < 86400) return { unit: 'hour', value: Math.round(seconds / 3600) };
  if (seconds < YEAR) return { unit: 'day', value: Math.round(seconds / 86400) };
  const years = seconds / YEAR;
  if (years < 1e6) return { unit: 'year', value: Math.round(years) };
  if (years < 1e9) return { unit: 'millionYear', value: years / 1e6 };
  if (years < 1e12) return { unit: 'billionYear', value: years / 1e9 };
  return { unit: 'overTrillion', value: 0 };
}
