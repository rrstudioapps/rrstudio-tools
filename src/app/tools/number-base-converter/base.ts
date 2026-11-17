// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Conversioni di base numerica con BigInt, complemento a due e numeri in virgola mobile IEEE-754. */

export const MIN_BASE = 2;
export const MAX_BASE = 36;
export const MAX_DIGITS = 5000;

export type ParseError = 'empty' | 'invalid' | 'tooLong' | 'base';
export type ParseResult = { ok: true; value: bigint } | { ok: false; error: ParseError; /** Carattere non valido, se c'è. */ char?: string };

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

export function isValidBase(b: number): boolean {
  return Number.isInteger(b) && b >= MIN_BASE && b <= MAX_BASE;
}

/**
 * Testo → intero in una base 2-36. Accetta segno, spazi/underscore/apostrofi come separatori e il prefisso
 * 0x (base 16), 0b (base 2) o 0o (base 8); maiuscole e minuscole. Gli interi sono illimitati (BigInt).
 */
export function parseInteger(text: string, base: number): ParseResult {
  if (!isValidBase(base)) return { ok: false, error: 'base' };
  let s = text.replace(/[\s_']/g, '').toLowerCase().replace(/[−–]/g, '-');
  if (s === '') return { ok: false, error: 'empty' };
  let negative = false;
  if (s[0] === '-' || s[0] === '+') {
    negative = s[0] === '-';
    s = s.slice(1);
  }
  const prefix = base === 16 ? '0x' : base === 2 ? '0b' : base === 8 ? '0o' : '';
  if (prefix && s.startsWith(prefix)) s = s.slice(2);
  if (s === '') return { ok: false, error: 'empty' };
  if (s.length > MAX_DIGITS) return { ok: false, error: 'tooLong' };
  let value = 0n;
  const b = BigInt(base);
  for (const ch of s) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= base) return { ok: false, error: 'invalid', char: ch };
    value = value * b + BigInt(d);
  }
  return { ok: true, value: negative ? -value : value };
}

export interface FormatOptions {
  upper?: boolean;
  /** Raggruppa le cifre (4 per binario ed esadecimale, 3 per ottale, 3 per decimale). */
  group?: boolean;
  /** Lingua dell'interfaccia: decide il separatore delle migliaia in decimale ('.' in italiano, ',' in inglese, come shared/decimal.ts). */
  lang?: 'it' | 'en';
}

const GROUP_SIZE: Record<number, number> = { 2: 4, 8: 3, 10: 3, 16: 4 };

export function toBase(value: bigint, base: number, opts: FormatOptions = {}): string {
  let s = value.toString(base);
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  if (opts.upper) s = s.toUpperCase();
  const size = GROUP_SIZE[base];
  if (opts.group && size) s = groupFromRight(s, size, base === 10 ? (opts.lang === 'en' ? ',' : '.') : ' ');
  return (neg ? '-' : '') + s;
}

/** Raggruppa da destra: "11111111" → "1111 1111". */
export function groupFromRight(s: string, size: number, sep = ' '): string {
  const out: string[] = [];
  for (let end = s.length; end > 0; end -= size) out.unshift(s.slice(Math.max(0, end - size), end));
  return out.join(sep);
}

// ---- Complemento a due ----

export const WIDTHS = [8, 16, 32, 64] as const;
export type Width = (typeof WIDTHS)[number];

export interface TwosComplement {
  width: Width;
  /** Schema di bit (stringa di 0 e 1, lunga `width`). */
  bits: string;
  /** Esadecimale a `width / 4` cifre, maiuscolo. */
  hex: string;
  /** Lo stesso schema letto senza segno. */
  unsigned: bigint;
  /** Lo stesso schema letto con segno. */
  signed: bigint;
  min: bigint;
  max: bigint;
}

export type TwosResult = { ok: true; value: TwosComplement } | { ok: false; min: bigint; max: bigint };

/** Intervallo rappresentabile: dal minimo con segno al massimo senza segno. */
export function twosRange(width: Width): { min: bigint; max: bigint } {
  const w = BigInt(width);
  return { min: -(1n << (w - 1n)), max: (1n << w) - 1n };
}

/** Valore → schema di bit a `width` bit. Valido da −2^(w−1) a 2^w − 1 (interpretazione con o senza segno). */
export function twosComplement(value: bigint, width: Width): TwosResult {
  const { min, max } = twosRange(width);
  if (value < min || value > max) return { ok: false, min, max };
  const pattern = BigInt.asUintN(width, value);
  return {
    ok: true,
    value: {
      width,
      bits: pattern.toString(2).padStart(width, '0'),
      hex: pattern.toString(16).toUpperCase().padStart(width / 4, '0'),
      unsigned: pattern,
      signed: BigInt.asIntN(width, pattern),
      min,
      max,
    },
  };
}

// ---- IEEE-754 ----

export type FloatKind = 'f32' | 'f64';

export interface FloatLayout {
  bits: number;
  expBits: number;
  mantBits: number;
  bias: number;
}

export const FLOAT_LAYOUT: Record<FloatKind, FloatLayout> = {
  f32: { bits: 32, expBits: 8, mantBits: 23, bias: 127 },
  f64: { bits: 64, expBits: 11, mantBits: 52, bias: 1023 },
};

export type FloatClass = 'zero' | 'subnormal' | 'normal' | 'infinity' | 'nan';

export interface FloatDecoded {
  kind: FloatKind;
  sign: 0 | 1;
  /** Esponente grezzo (come memorizzato). */
  exponent: number;
  /** Mantissa grezza (bit dopo l'1 implicito). */
  mantissa: bigint;
  cls: FloatClass;
  /** Esponente reale (senza bias); per i subnormali −126 o −1022. */
  unbiased: number | null;
  value: number;
  /** Valore esatto in decimale (tutte le cifre); "NaN", "Infinity" o "-Infinity" per i casi speciali. */
  exact: string;
  /** Schema completo in binario, diviso in segno / esponente / mantissa. */
  signBits: string;
  expBitsStr: string;
  mantBitsStr: string;
  hex: string;
}

/** M × 2^E → decimale esatto (nessuna approssimazione: M × 5^k scalato di 10^k). */
export function exactDecimal(negative: boolean, mantissa: bigint, exp2: number): string {
  const sign = negative ? '-' : '';
  if (mantissa === 0n) return sign + '0';
  if (exp2 >= 0) return sign + (mantissa << BigInt(exp2)).toString();
  const k = -exp2;
  const s = (mantissa * 5n ** BigInt(k)).toString().padStart(k + 1, '0');
  const int = s.slice(0, s.length - k);
  const frac = s.slice(s.length - k).replace(/0+$/, '');
  return sign + int + (frac ? '.' + frac : '');
}

export function decodeFloat(bits: bigint, kind: FloatKind): FloatDecoded {
  const L = FLOAT_LAYOUT[kind];
  const pattern = BigInt.asUintN(L.bits, bits);
  const sign = Number(pattern >> BigInt(L.bits - 1)) as 0 | 1;
  const exponent = Number((pattern >> BigInt(L.mantBits)) & ((1n << BigInt(L.expBits)) - 1n));
  const mantissa = pattern & ((1n << BigInt(L.mantBits)) - 1n);
  const maxExp = (1 << L.expBits) - 1;
  const full = pattern.toString(2).padStart(L.bits, '0');
  const base = {
    kind,
    sign,
    exponent,
    mantissa,
    signBits: full.slice(0, 1),
    expBitsStr: full.slice(1, 1 + L.expBits),
    mantBitsStr: full.slice(1 + L.expBits),
    hex: pattern.toString(16).toUpperCase().padStart(L.bits / 4, '0'),
  };
  if (exponent === maxExp) {
    if (mantissa === 0n) {
      return { ...base, cls: 'infinity', unbiased: null, value: sign ? -Infinity : Infinity, exact: sign ? '-Infinity' : 'Infinity' };
    }
    return { ...base, cls: 'nan', unbiased: null, value: NaN, exact: 'NaN' };
  }
  const isSub = exponent === 0;
  const significand = isSub ? mantissa : mantissa | (1n << BigInt(L.mantBits));
  const unbiased = (isSub ? 1 : exponent) - L.bias;
  const exp2 = unbiased - L.mantBits;
  const exact = exactDecimal(sign === 1, significand, exp2);
  const dv = new DataView(new ArrayBuffer(8));
  let value: number;
  if (kind === 'f32') {
    dv.setUint32(0, Number(pattern));
    value = dv.getFloat32(0);
  } else {
    dv.setBigUint64(0, pattern);
    value = dv.getFloat64(0);
  }
  const cls: FloatClass = mantissa === 0n && isSub ? 'zero' : isSub ? 'subnormal' : 'normal';
  return { ...base, cls, unbiased: cls === 'zero' ? null : unbiased, value, exact };
}

/** Numero → schema di bit, con arrotondamento al più vicino (pari in caso di parità). */
export function encodeFloat(value: number, kind: FloatKind): bigint {
  const dv = new DataView(new ArrayBuffer(8));
  if (kind === 'f32') {
    dv.setFloat32(0, value);
    return BigInt(dv.getUint32(0));
  }
  dv.setFloat64(0, value);
  return dv.getBigUint64(0);
}

export type FloatInputError = 'empty' | 'invalid' | 'bitsTooLong';
export type FloatInput =
  | { ok: true; bits: bigint; /** Il testo era già uno schema di bit. */ fromBits: boolean; /** Numero richiesto, se il testo era un numero. */ requested: number | null }
  | { ok: false; error: FloatInputError };

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Testo del campo IEEE-754: un numero decimale ("0,1", "-1.5e10", "NaN", "Infinity", "-0"), oppure uno schema di bit
 * in esadecimale ("0x3F800000") o binario ("0b0011…"), che viene decodificato così com'è.
 */
export function parseFloatInput(text: string, kind: FloatKind): FloatInput {
  const t = text.trim().replace(/[−–]/g, '-').replace(/[\s_']/g, '');
  if (t === '') return { ok: false, error: 'empty' };
  const L = FLOAT_LAYOUT[kind];
  const radix = /^0x[0-9a-f]+$/i.test(t) ? 16 : /^0b[01]+$/i.test(t) ? 2 : 0;
  if (radix) {
    const digits = t.slice(2);
    const maxLen = radix === 16 ? L.bits / 4 : L.bits;
    if (digits.length > maxLen && digits.replace(/^0+/, '').length > maxLen) return { ok: false, error: 'bitsTooLong' };
    return { ok: true, bits: BigInt((radix === 16 ? '0x' : '0b') + digits), fromBits: true, requested: null };
  }
  const lower = t.toLowerCase();
  const special: Record<string, number> = { nan: NaN, infinity: Infinity, '+infinity': Infinity, '-infinity': -Infinity, inf: Infinity, '+inf': Infinity, '-inf': -Infinity };
  if (lower in special) {
    const v = special[lower];
    return { ok: true, bits: encodeFloat(v, kind), fromBits: false, requested: v };
  }
  const normalized = t.replace(',', '.');
  if (!NUMBER_RE.test(normalized)) return { ok: false, error: 'invalid' };
  const v = Number(normalized);
  return { ok: true, bits: encodeFloat(v, kind), fromBits: false, requested: v };
}

/**
 * Decimale in forma canonica ("-0012,50e2" non è accettato: solo punto) per confrontare due scritture dello stesso
 * numero: senza zeri inutili, esponente applicato, "-0" = "0". null se il testo non è un decimale o l'esponente è enorme.
 */
export function canonicalDecimal(text: string): string | null {
  const m = /^([+-]?)(\d*)\.?(\d*)(?:[eE]([+-]?\d+))?$/.exec(text.trim());
  if (!m || (m[2] === '' && m[3] === '')) return null;
  const e = m[4] ? Number(m[4]) : 0;
  if (Math.abs(e) > 2000) return null;
  const digits = m[2] + m[3];
  const point = m[2].length + e;
  let int: string;
  let frac: string;
  if (point <= 0) {
    int = '0';
    frac = '0'.repeat(-point) + digits;
  } else if (point >= digits.length) {
    int = digits + '0'.repeat(point - digits.length);
    frac = '';
  } else {
    int = digits.slice(0, point);
    frac = digits.slice(point);
  }
  int = int.replace(/^0+(?=\d)/, '');
  frac = frac.replace(/0+$/, '');
  const body = frac ? `${int}.${frac}` : int;
  return body === '0' ? '0' : (m[1] === '-' ? '-' : '') + body;
}

/** Il testo decimale digitato coincide esattamente con il valore memorizzato (che è `exact`)? */
export function isExactMatch(typed: string, exact: string): boolean {
  const a = canonicalDecimal(typed.trim().replace(',', '.'));
  const b = canonicalDecimal(exact);
  return a !== null && b !== null && a === b;
}
