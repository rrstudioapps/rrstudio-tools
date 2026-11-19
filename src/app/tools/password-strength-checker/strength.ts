// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Stima della robustezza di una password con zxcvbn-ts (dizionari comune, inglese e italiano).
 * Tutto avviene nel browser: nessuna verifica online (niente archivi di password violate).
 * La libreria e i dizionari si caricano con import dinamico, solo quando serve la pagina.
 */

/** Oltre questa lunghezza la password viene troncata per l'analisi (la stima diventa lenta e non cambia). */
export const MAX_ANALYZED_LENGTH = 128;

export type Score = 0 | 1 | 2 | 3 | 4;

export interface CrackTimes {
  /** Attacco online con limite di tentativi (100 all'ora). */
  throttled: number;
  /** Attacco online senza limite (10 al secondo). */
  online: number;
  /** Hash lento (bcrypt, 10 mila al secondo). */
  offlineSlow: number;
  /** Hash veloce (GPU, 10 miliardi al secondo). */
  offlineFast: number;
}

export interface PatternInfo {
  /** Tipo riconosciuto: dictionary, spatial, repeat, sequence, regex, date, separator, bruteforce. */
  kind: string;
  token: string;
}

export interface StrengthResult {
  score: Score;
  /** Stima dei tentativi necessari. */
  guesses: number;
  /** Entropia stimata in bit: log2 dei tentativi. */
  bits: number;
  /** Entropia teorica se ogni carattere fosse scelto a caso nell'alfabeto usato. */
  naiveBits: number;
  crackTimes: CrackTimes;
  /** Chiave dell'avviso (es. "straightRow"), se c'è. */
  warning: string | null;
  /** Chiavi dei suggerimenti (es. "anotherWord"). */
  suggestions: string[];
  patterns: PatternInfo[];
  truncated: boolean;
  length: number;
}

/** Soglie dei punteggi usate da zxcvbn: lo schema dei tempi di rottura è lo stesso. */
export const SCORE_LABEL_KEYS = ['very-weak', 'weak', 'fair', 'strong', 'very-strong'] as const;

// ---- funzioni pure (testabili senza la libreria) ----

/** Numero di caratteri dell'alfabeto minimo che contiene la password (minuscole, maiuscole, cifre, simboli, altro). */
export function charsetSize(password: string): number {
  let size = 0;
  if (/[a-z]/.test(password)) size += 26;
  if (/[A-Z]/.test(password)) size += 26;
  if (/[0-9]/.test(password)) size += 10;
  if (/[ !"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/.test(password)) size += 33;
  if (/[^\x00-\x7f]/.test(password)) size += 100;
  return size;
}

/** Entropia "da manuale": lunghezza per log2 dell'alfabeto. Sovrastima le password prevedibili. */
export function naiveEntropy(password: string): number {
  const size = charsetSize(password);
  if (size === 0) return 0;
  return [...password].length * Math.log2(size);
}

export type Duration =
  | { kind: 'instant' }
  | { kind: 'unit'; unit: 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year'; n: number }
  | { kind: 'centuries' };

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const MONTH = DAY * 31;
const YEAR = DAY * 365;

/** Durata espressa nell'unità più adatta (arrotondata per difetto, almeno 1), "istantaneo" sotto il secondo e "secoli" oltre i 100 anni. */
export function describeDuration(seconds: number): Duration {
  if (!Number.isFinite(seconds) || seconds >= 100 * YEAR) return { kind: 'centuries' };
  if (seconds < 1) return { kind: 'instant' };
  const pick = (unit: 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year', size: number): Duration => ({
    kind: 'unit',
    unit,
    n: Math.max(1, Math.floor(seconds / size)),
  });
  if (seconds < MINUTE) return pick('second', 1);
  if (seconds < HOUR) return pick('minute', MINUTE);
  if (seconds < DAY) return pick('hour', HOUR);
  if (seconds < MONTH) return pick('day', DAY);
  if (seconds < YEAR) return pick('month', MONTH);
  return pick('year', YEAR);
}

/** Tempi di rottura a partire dal numero di tentativi (stesse velocità di zxcvbn). */
export function crackTimesFromGuesses(guesses: number): CrackTimes {
  return {
    throttled: guesses / (100 / 3600),
    online: guesses / 10,
    offlineSlow: guesses / 1e4,
    offlineFast: guesses / 1e10,
  };
}

export function truncatePassword(password: string): { value: string; truncated: boolean } {
  const chars = [...password];
  if (chars.length <= MAX_ANALYZED_LENGTH) return { value: password, truncated: false };
  return { value: chars.slice(0, MAX_ANALYZED_LENGTH).join(''), truncated: true };
}

// ---- analisi con la libreria ----

interface MinimalResult {
  score: number;
  guesses: number;
  feedback: { warning: string | null; suggestions: string[] };
  sequence: { pattern: string; token: string }[];
}
interface Checker {
  check(password: string): MinimalResult;
}

let checkerPromise: Promise<Checker> | null = null;

/** Carica una sola volta libreria e dizionari (common + en + it). */
export function loadChecker(): Promise<Checker> {
  checkerPromise ??= (async () => {
    const [core, common, en, it] = await Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-en'),
      import('@zxcvbn-ts/language-it'),
    ]);
    return new core.ZxcvbnFactory({
      graphs: common.adjacencyGraphs,
      dictionary: { ...common.dictionary, ...en.dictionary, ...it.dictionary },
      useLevenshteinDistance: false,
    }) as unknown as Checker;
  })().catch((e) => {
    checkerPromise = null;
    throw e;
  });
  return checkerPromise;
}

/** Converte "warnings.straightRow" in "straightRow" (le chiavi arrivano senza traduzione dalla libreria). */
export function feedbackKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  return dot >= 0 ? raw.slice(dot + 1) : raw;
}

export function toResult(password: string, truncated: boolean, r: MinimalResult): StrengthResult {
  const guesses = Math.max(1, r.guesses);
  return {
    score: Math.min(4, Math.max(0, Math.round(r.score))) as Score,
    guesses,
    bits: Math.log2(guesses),
    naiveBits: naiveEntropy(password),
    crackTimes: crackTimesFromGuesses(guesses),
    warning: feedbackKey(r.feedback.warning),
    suggestions: r.feedback.suggestions.map((s) => feedbackKey(s) as string),
    patterns: r.sequence.map((s) => ({ kind: s.pattern, token: s.token })),
    truncated,
    length: [...password].length,
  };
}

/** Analizza la password. Una password vuota non si analizza (null). */
export async function analyze(password: string): Promise<StrengthResult | null> {
  if (password === '') return null;
  const { value, truncated } = truncatePassword(password);
  const checker = await loadChecker();
  return toResult(value, truncated, checker.check(value));
}
