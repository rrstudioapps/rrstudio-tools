// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Numeri in lettere, in italiano corretto. Parte intera con BigInt, fino a 999.999.999.999 (miliardi).
 *
 * Regole ortografiche applicate:
 * - le decine perdono la vocale finale davanti a "uno" e "otto": ventuno, trentotto, novantuno;
 * - "cento" perde la "o" davanti a "otto" e "ottanta": centotto, centottanta, duecentottantotto;
 * - "tre" in fondo a un numero composto prende l'accento: ventitré, centotré, milletré (ma ventitremila);
 * - mille/mila: mille, milleuno, duemila, ventunomila, centomila;
 * - milione e miliardo sono parole a sé: un milione, due milioni, un miliardo (a richiesta tutto attaccato).
 */

export const MAX_INT = 999_999_999_999n;

const UNDER20 = [
  '', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici',
  'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove',
];
const TENS = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];

/** 1-999 in lettere, senza accento finale su "tre". */
function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let rest = '';
  if (r < 20) rest = UNDER20[r];
  else {
    const t = TENS[Math.floor(r / 10)];
    const u = r % 10;
    rest = u === 1 || u === 8 ? t.slice(0, -1) + UNDER20[u] : t + UNDER20[u];
  }
  let hundreds = '';
  if (h > 0) {
    hundreds = h === 1 ? 'cento' : UNDER20[h] + 'cento';
    if (rest.startsWith('o')) hundreds = hundreds.slice(0, -1); // centotto, centottanta
  }
  return hundreds + rest;
}

/** "tre" finale di un numero composto prende l'accento: ventitré. */
function accentFinalTre(w: string): string {
  return w.length > 3 && w.endsWith('tre') ? w.slice(0, -3) + 'tré' : w;
}

export interface WordsOptions {
  /** Scrive milioni e miliardi attaccati al resto (unmilione, duemilioni…). Di default sono parole separate. */
  joined?: boolean;
}

/** Numero intero non negativo in lettere. Lancia RangeError oltre MAX_INT. */
export function integerToWords(value: bigint, opts: WordsOptions = {}): string {
  if (value < 0n || value > MAX_INT) throw new RangeError('fuori intervallo');
  if (value === 0n) return 'zero';
  const n = Number(value); // < 10^12: esatto
  const billions = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const thousands = Math.floor((n % 1e6) / 1e3);
  const units = n % 1e3;
  const joined = !!opts.joined;
  const parts: string[] = [];

  // attaccato a "milioni" il "tre" non è più in fondo alla parola: niente accento
  const acc = (x: string) => (joined ? x : accentFinalTre(x));
  if (billions) parts.push(billions === 1 ? 'un miliardo' : acc(below1000(billions)) + ' miliardi');
  if (millions) parts.push(millions === 1 ? 'un milione' : acc(below1000(millions)) + ' milioni');
  // le migliaia e le unità formano un'unica parola: duemilatrecento, milleuno
  let low = '';
  if (thousands) low += thousands === 1 ? 'mille' : below1000(thousands) + 'mila';
  if (units) low += below1000(units);
  if (low) parts.push(accentFinalTre(low));

  if (!joined) return parts.join(' ');
  return parts.map((p) => p.replace(/^un (milione|miliardo)$/, 'un$1').replace(/ (milioni|miliardi)$/, '$1').replace(/ /g, '')).join('');
}

// ---- Lettura del numero digitato ----

export interface ParsedNumber {
  negative: boolean;
  int: bigint;
  /** Cifre decimali (stringa, può avere zeri iniziali); '' se intero. */
  frac: string;
}

export type ParseError = 'empty' | 'invalid' | 'range';

/**
 * Numero all'italiana: "1.234,56", "1234,56", "-12,5", ma anche "1234.56" (punto decimale se non è un raggruppamento
 * di migliaia). Spazi e simbolo € ignorati. Accetta il segno meno (anche tipografico).
 */
export function parseNumber(input: string): { ok: true; value: ParsedNumber } | { ok: false; error: ParseError } {
  let v = input.replace(/[€\s ']/g, '').replace(/[−–]/g, '-');
  if (v === '') return { ok: false, error: 'empty' };
  let negative = false;
  if (v[0] === '-' || v[0] === '+') {
    negative = v[0] === '-';
    v = v.slice(1);
  }
  if (!/^[\d.,]+$/.test(v) || !/\d/.test(v)) return { ok: false, error: 'invalid' };
  const lastComma = v.lastIndexOf(',');
  const lastDot = v.lastIndexOf('.');
  let intPart: string;
  let frac = '';
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = Math.max(lastComma, lastDot);
    const sepDec = v[dec];
    const sepGroup = sepDec === ',' ? '.' : ',';
    if (v.split(sepDec).length !== 2) return { ok: false, error: 'invalid' };
    const ip = v.slice(0, dec);
    if (!new RegExp(`^\\d{1,3}(\\${sepGroup}\\d{3})*$`).test(ip)) return { ok: false, error: 'invalid' };
    intPart = ip.split(sepGroup).join('');
    frac = v.slice(dec + 1);
  } else if (lastComma >= 0) {
    if (v.indexOf(',') !== lastComma) return { ok: false, error: 'invalid' };
    intPart = v.slice(0, lastComma);
    frac = v.slice(lastComma + 1);
  } else if (lastDot >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(v)) intPart = v.replace(/\./g, '');
    else if (v.indexOf('.') === lastDot) {
      intPart = v.slice(0, lastDot);
      frac = v.slice(lastDot + 1);
    } else return { ok: false, error: 'invalid' };
  } else intPart = v;
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(frac) || (intPart === '' && frac === '')) return { ok: false, error: 'invalid' };
  const int = BigInt(intPart || '0');
  if (int > MAX_INT) return { ok: false, error: 'range' };
  return { ok: true, value: { negative, int, frac } };
}

// ---- Conversione ----

export type NumberMode = 'text' | 'cheque';
export type LetterCase = 'lower' | 'upper' | 'capitalize';

export interface ConvertOptions {
  mode: NumberMode;
  joined?: boolean;
  /** Modalità assegno: antepone "euro". */
  euro?: boolean;
  letterCase?: LetterCase;
}

export type ConvertError = ParseError | 'negativeCheque';
export type ConvertOutcome = { ok: true; text: string } | { ok: false; error: ConvertError };

const MAX_DIGIT_BY_DIGIT = 9;

/** Parte decimale a parole: zeri iniziali uno a uno, il resto come numero ("05" → zero cinque; "14" → quattordici). */
function fractionToWords(frac: string, opts: WordsOptions): string {
  const zeros = frac.match(/^0*/)![0].length;
  const rest = frac.slice(zeros);
  const words: string[] = Array(zeros).fill('zero');
  if (rest) {
    if (rest.length <= MAX_DIGIT_BY_DIGIT) words.push(integerToWords(BigInt(rest), opts));
    else for (const d of rest) words.push(d === '0' ? 'zero' : UNDER20[Number(d)]);
  }
  return words.join(' ');
}

/** Arrotonda le cifre decimali a due (mezzo in su): restituisce l'eventuale riporto sull'intero e i centesimi. */
function toCents(frac: string): { carry: boolean; cents: string } {
  const f = (frac + '00').slice(0, 2);
  if (frac.length > 2 && frac.charCodeAt(2) >= 53) {
    const n = Number(f) + 1;
    return n === 100 ? { carry: true, cents: '00' } : { carry: false, cents: String(n).padStart(2, '0') };
  }
  return { carry: false, cents: f };
}

function applyCase(s: string, c: LetterCase): string {
  if (c === 'upper') return s.toUpperCase();
  if (c === 'capitalize') return s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

export function convertNumber(input: string, opts: ConvertOptions): ConvertOutcome {
  const p = parseNumber(input);
  if (!p.ok) return p;
  const { negative, frac } = p.value;
  let int = p.value.int;
  const w: WordsOptions = { joined: opts.joined };
  let text: string;
  if (opts.mode === 'cheque') {
    const { carry, cents } = toCents(frac);
    if (carry) int += 1n;
    if (int > MAX_INT) return { ok: false, error: 'range' };
    const isZero = int === 0n && cents === '00';
    if (negative && !isZero) return { ok: false, error: 'negativeCheque' };
    text = `${integerToWords(int, w)}/${cents}`;
    if (opts.euro) text = `euro ${text}`;
  } else {
    text = integerToWords(int, w);
    if (frac) text += ' virgola ' + fractionToWords(frac, w);
    const isZero = int === 0n && /^0*$/.test(frac);
    if (negative && !isZero) text = 'meno ' + text;
  }
  return { ok: true, text: applyCase(text, opts.letterCase ?? 'lower') };
}
