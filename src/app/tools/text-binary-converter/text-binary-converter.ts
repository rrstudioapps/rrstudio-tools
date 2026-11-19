// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { base64ToBytes, bytesToBase64 } from '../../shared/base64';

export type Encoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'latin1' | 'windows-1252' | 'ascii';
export type ByteFormat = 'hex' | 'bin' | 'dec' | 'oct' | 'base64';
export type SeparatorKind = 'space' | 'none' | 'comma' | 'dash' | 'bs-x' | '0x';

export const ENCODINGS: readonly Encoding[] = ['utf-8', 'utf-16le', 'utf-16be', 'latin1', 'windows-1252', 'ascii'];
export const BYTE_FORMATS: readonly ByteFormat[] = ['hex', 'bin', 'dec', 'oct', 'base64'];
export const SEPARATORS: readonly SeparatorKind[] = ['space', 'none', 'comma', 'dash', 'bs-x', '0x'];
/** Limite del testo in ingresso (circa 1 MB). */
export const MAX_CHARS = 1_000_000;
/** Dimensione massima del file letto (il resto viene ignorato) e parte mostrata nell'hex dump. */
export const MAX_FILE_BYTES = 1_048_576;
export const HEX_DUMP_BYTES = 65_536;
/** Righe della tabella dei caratteri. */
export const TABLE_ROWS = 200;

// ---------------------------------------------------------------- Windows-1252

/** Code point dei byte 0x80-0x9F in Windows-1252 (0 = non definito). */
const CP1252_HIGH: readonly number[] = [
  0x20ac, 0, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0, 0x017d, 0,
  0, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0, 0x017e, 0x0178,
];
const CP1252_REVERSE = new Map<number, number>(CP1252_HIGH.map((cp, i) => [cp, 0x80 + i] as const).filter(([cp]) => cp !== 0));

// ---------------------------------------------------------------- codifica

export interface EncodeResult {
  bytes: Uint8Array;
  /** Quanti caratteri non rappresentabili nella codifica sono stati sostituiti con «?». */
  unmappable: number;
}

/** Byte di un code point in una codifica a 8 bit; undefined se non rappresentabile. */
function singleByte(cp: number, enc: Encoding): number | undefined {
  if (enc === 'ascii') return cp <= 0x7f ? cp : undefined;
  if (cp <= 0x7f) return cp;
  if (enc === 'latin1') return cp <= 0xff ? cp : undefined;
  if (cp >= 0xa0 && cp <= 0xff) return cp;
  return CP1252_REVERSE.get(cp);
}

function encodeUtf16(text: string, littleEndian: boolean): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    const u = text.charCodeAt(i);
    out[i * 2] = littleEndian ? u & 0xff : u >> 8;
    out[i * 2 + 1] = littleEndian ? u >> 8 : u & 0xff;
  }
  return out;
}

const BOMS: Partial<Record<Encoding, readonly number[]>> = {
  'utf-8': [0xef, 0xbb, 0xbf],
  'utf-16le': [0xff, 0xfe],
  'utf-16be': [0xfe, 0xff],
};

/** Testo → byte nella codifica scelta. Con `bom` aggiunge il BOM (solo UTF-8 e UTF-16). */
export function encodeText(text: string, encoding: Encoding, options: { bom?: boolean } = {}): EncodeResult {
  let bytes: Uint8Array;
  let unmappable = 0;
  if (encoding === 'utf-8') {
    bytes = new TextEncoder().encode(text);
  } else if (encoding === 'utf-16le' || encoding === 'utf-16be') {
    bytes = encodeUtf16(text, encoding === 'utf-16le');
  } else {
    const out: number[] = [];
    for (const c of text) {
      const b = singleByte(c.codePointAt(0)!, encoding);
      if (b === undefined) { out.push(0x3f); unmappable++; } else out.push(b);
    }
    bytes = Uint8Array.from(out);
  }
  const bom = options.bom ? BOMS[encoding] : undefined;
  if (bom) {
    const withBom = new Uint8Array(bom.length + bytes.length);
    withBom.set(bom);
    withBom.set(bytes, bom.length);
    bytes = withBom;
  }
  return { bytes, unmappable };
}

// ---------------------------------------------------------------- decodifica

export type DecodeResult =
  | { ok: true; text: string; /** Byte sostituiti con «�». */ replaced: number; /** Era presente (ed è stato tolto) il BOM. */ bom: boolean }
  | { ok: false; position: number; byte: number | null };

/** Posizione del primo byte non valido in UTF-8 (segue la definizione di Unicode: niente forme ridondanti né surrogati). */
function firstInvalidUtf8(b: Uint8Array): number {
  let i = 0;
  while (i < b.length) {
    const c = b[i];
    if (c < 0x80) { i++; continue; }
    let need: number;
    let min: number;
    let cp: number;
    if (c >= 0xc2 && c <= 0xdf) { need = 1; min = 0x80; cp = c & 0x1f; }
    else if (c >= 0xe0 && c <= 0xef) { need = 2; min = 0x800; cp = c & 0x0f; }
    else if (c >= 0xf0 && c <= 0xf4) { need = 3; min = 0x10000; cp = c & 0x07; }
    else return i;
    for (let k = 1; k <= need; k++) {
      const n = b[i + k];
      if (n === undefined || (n & 0xc0) !== 0x80) return i + k;
      cp = (cp << 6) | (n & 0x3f);
    }
    if (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return i;
    i += need + 1;
  }
  return -1;
}

function decodeUtf16(b: Uint8Array, littleEndian: boolean, strict: boolean): DecodeResult {
  let text = '';
  let replaced = 0;
  const n = b.length - (b.length % 2);
  for (let i = 0; i < n; i += 2) {
    const u = littleEndian ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1];
    if (u >= 0xd800 && u <= 0xdbff && i + 3 < n) {
      const lo = littleEndian ? b[i + 2] | (b[i + 3] << 8) : (b[i + 2] << 8) | b[i + 3];
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        text += String.fromCharCode(u, lo);
        i += 2;
        continue;
      }
    }
    if (u >= 0xd800 && u <= 0xdfff) {
      if (strict) return { ok: false, position: i, byte: b[i] };
      text += '�';
      replaced += 2;
    } else {
      text += String.fromCharCode(u);
    }
  }
  if (b.length % 2 === 1) {
    if (strict) return { ok: false, position: b.length - 1, byte: b[b.length - 1] };
    text += '�';
    replaced++;
  }
  return { ok: true, text, replaced, bom: false };
}

/**
 * Byte → testo. In modo `strict` il primo byte non valido dà `{ ok: false, position }`;
 * altrimenti i byte non validi diventano «�» (e vengono contati in `replaced`). Un BOM iniziale viene tolto.
 */
export function decodeBytes(bytes: Uint8Array, encoding: Encoding, options: { strict?: boolean } = {}): DecodeResult {
  const strict = options.strict ?? true;
  const bomBytes = BOMS[encoding];
  const hasBom = bomBytes !== undefined && bytes.length >= bomBytes.length && bomBytes.every((v, i) => bytes[i] === v);
  const body = hasBom ? bytes.subarray(bomBytes!.length) : bytes;
  const shift = hasBom ? bomBytes!.length : 0;
  let res: DecodeResult;
  if (encoding === 'utf-8') {
    const bad = firstInvalidUtf8(body);
    if (bad >= 0 && strict) return { ok: false, position: bad + shift, byte: body[bad] };
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(body);
    let replaced = 0;
    if (bad >= 0) for (const c of text) if (c === '�') replaced++;
    res = { ok: true, text, replaced, bom: false };
  } else if (encoding === 'utf-16le' || encoding === 'utf-16be') {
    res = decodeUtf16(body, encoding === 'utf-16le', strict);
    if (!res.ok) return { ...res, position: res.position + shift };
  } else {
    let text = '';
    let replaced = 0;
    for (let i = 0; i < body.length; i++) {
      const b = body[i];
      let cp: number | undefined;
      if (b < 0x80 || encoding === 'latin1') cp = b;
      else if (encoding === 'windows-1252') cp = b >= 0xa0 ? b : CP1252_HIGH[b - 0x80] || undefined;
      if (cp === undefined) {
        if (strict) return { ok: false, position: i, byte: b };
        text += '�';
        replaced++;
      } else {
        text += String.fromCharCode(cp);
      }
    }
    res = { ok: true, text, replaced, bom: false };
  }
  return res.ok ? { ...res, bom: hasBom } : res;
}

// ---------------------------------------------------------------- formattazione

export interface FormatOptions {
  separator: SeparatorKind;
  /** Cifre esadecimali maiuscole. */
  uppercase: boolean;
  /** Byte per gruppo (1, 2, 4, 8): solo esadecimale e binario. */
  group: number;
  /** Binario a 8 cifre, decimale e ottale a 3. */
  pad: boolean;
  /** Byte per riga (0 = tutto su una riga). */
  perLine: number;
}

export const DEFAULT_FORMAT: FormatOptions = { separator: 'space', uppercase: true, group: 1, pad: true, perLine: 0 };

const JOINERS: Record<SeparatorKind, string> = { space: ' ', none: '', comma: ',', dash: '-', 'bs-x': '', '0x': ', ' };

/** Byte → testo nel formato scelto (esadecimale, binario, decimale, ottale o Base64). */
export function formatBytes(bytes: Uint8Array, format: ByteFormat, options: Partial<FormatOptions> = {}): string {
  if (format === 'base64') return bytesToBase64(bytes);
  const o: FormatOptions = { ...DEFAULT_FORMAT, ...options };
  // i prefissi hanno senso solo per l'esadecimale
  const sep: SeparatorKind = format !== 'hex' && (o.separator === 'bs-x' || o.separator === '0x') ? 'space' : o.separator;
  const prefix = sep === 'bs-x' ? '\\x' : sep === '0x' ? '0x' : '';
  const group = format === 'hex' || format === 'bin' ? (sep === 'bs-x' ? 1 : Math.max(1, o.group)) : 1;
  const unit = (b: number): string => {
    switch (format) {
      case 'hex': { const h = b.toString(16).padStart(2, '0'); return o.uppercase ? h.toUpperCase() : h; }
      case 'bin': return b.toString(2).padStart(o.pad || group > 1 ? 8 : 1, '0');
      case 'oct': return b.toString(8).padStart(o.pad ? 3 : 1, '0');
      default: return String(b).padStart(o.pad ? 3 : 1, '0');
    }
  };
  const joiner = JOINERS[sep];
  const lineBreak = sep === 'comma' || sep === '0x' ? joiner.trimEnd() + '\n' : '\n';
  const perLine = o.perLine > 0 ? o.perLine : bytes.length || 1;
  const lines: string[] = [];
  for (let start = 0; start < bytes.length; start += perLine) {
    const end = Math.min(start + perLine, bytes.length);
    const units: string[] = [];
    for (let i = start; i < end; i += group) {
      let u = '';
      for (let k = i; k < Math.min(i + group, end); k++) u += unit(bytes[k]);
      units.push(prefix + u);
    }
    lines.push(units.join(joiner));
  }
  return lines.join(lineBreak);
}

// ---------------------------------------------------------------- lettura

export type ParseResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; error: 'invalidChar' | 'oddHex' | 'outOfRange' | 'badBinaryLength' | 'badBase64'; position: number; token: string };

const SEPARATOR_CHARS = /[\s,;:-]/;

/** Lunghezza del prefisso del formato all'inizio di `s` (0 se non c'è). */
function prefixLength(s: string, format: ByteFormat): number {
  if (format === 'hex') return /^(0x|\\x|%)/i.exec(s)?.[0].length ?? 0;
  if (format === 'bin') return /^0b/i.exec(s)?.[0].length ?? 0;
  if (format === 'oct') return /^(0o|\\)/i.exec(s)?.[0].length ?? 0;
  return 0;
}

const DIGITS: Record<'hex' | 'bin' | 'dec' | 'oct', RegExp> = {
  hex: /^[0-9a-fA-F]+/,
  bin: /^[01]+/,
  dec: /^[0-9]+/,
  oct: /^[0-7]+/,
};
const RADIX = { hex: 16, bin: 2, dec: 10, oct: 8 } as const;

/**
 * Testo → byte. Accetta separatori misti (spazi, virgole, trattini, due punti, a capo), prefissi (`0x`, `\x`, `%`,
 * `0b`, `0o`), maiuscole e minuscole. Segnala il primo elemento non valido con la sua posizione (indice nel testo).
 */
export function parseBytes(text: string, format: ByteFormat): ParseResult {
  if (format === 'base64') return parseBase64(text);
  const out: number[] = [];
  const radix = RADIX[format];
  let i = 0;
  while (i < text.length) {
    if (SEPARATOR_CHARS.test(text[i])) { i++; continue; }
    const rest = text.slice(i);
    const plen = prefixLength(rest, format);
    const m = DIGITS[format].exec(rest.slice(plen));
    if (!m) {
      const at = i + plen;
      // prefisso senza cifre, oppure carattere che non è una cifra del formato
      if (at >= text.length) return { ok: false, error: 'invalidChar', position: i, token: rest };
      return { ok: false, error: 'invalidChar', position: at, token: String.fromCodePoint(text.codePointAt(at)!) };
    }
    const digits = m[0];
    const start = i;
    if (format === 'hex') {
      if (digits.length === 1) out.push(parseInt(digits, 16));
      else if (digits.length % 2 === 0) for (let k = 0; k < digits.length; k += 2) out.push(parseInt(digits.slice(k, k + 2), 16));
      else return { ok: false, error: 'oddHex', position: start, token: digits };
    } else if (format === 'bin') {
      if (digits.length <= 8) out.push(parseInt(digits, 2));
      else if (digits.length % 8 === 0) for (let k = 0; k < digits.length; k += 8) out.push(parseInt(digits.slice(k, k + 8), 2));
      else return { ok: false, error: 'badBinaryLength', position: start, token: digits };
    } else {
      const v = parseInt(digits, radix);
      if (v > 255) return { ok: false, error: 'outOfRange', position: start, token: digits };
      out.push(v);
    }
    i += plen + digits.length;
  }
  return { ok: true, bytes: Uint8Array.from(out) };
}

function parseBase64(text: string): ParseResult {
  let seenPad = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) continue;
    if (c === '=') { seenPad = true; continue; }
    if (seenPad || !/[A-Za-z0-9+/_-]/.test(c)) return { ok: false, error: 'badBase64', position: i, token: c };
  }
  try {
    return { ok: true, bytes: base64ToBytes(text) };
  } catch {
    // lunghezza impossibile (un solo carattere di troppo nell'ultimo gruppo)
    return { ok: false, error: 'badBase64', position: Math.max(0, text.trimEnd().length - 1), token: '' };
  }
}

// ---------------------------------------------------------------- tabella dei caratteri e statistiche

export interface CharRow {
  /** Carattere visibile (con un simbolo per spazi e caratteri di controllo). */
  shown: string;
  /** `U+XXXX`. */
  codePoint: string;
  /** Byte nella codifica scelta, in esadecimale. */
  bytes: string;
  /** Il carattere non esiste nella codifica: nei byte c'è «?». */
  unmappable: boolean;
}

/** Simbolo per mostrare un carattere non visibile. */
export function visibleChar(c: string): string {
  const cp = c.codePointAt(0)!;
  if (cp === 0x20) return '␣'; // ␣
  if (cp < 0x20) return String.fromCodePoint(0x2400 + cp); // ␀ … ␟
  if (cp === 0x7f) return '␡'; // ␡
  if (cp === 0xa0) return '⍽'; // ⍽
  if ((cp >= 0x80 && cp <= 0x9f) || cp === 0xad || (cp >= 0x200b && cp <= 0x200f) || cp === 0x2028 || cp === 0x2029 || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2060 && cp <= 0x2064) || cp === 0xfeff) return '◌'; // ◌
  return c;
}

/** Prime `limit` righe della tabella dei caratteri. */
export function charTable(text: string, encoding: Encoding, limit = TABLE_ROWS): CharRow[] {
  const rows: CharRow[] = [];
  for (const c of text) {
    if (rows.length >= limit) break;
    const cp = c.codePointAt(0)!;
    const enc = encodeText(c, encoding);
    rows.push({
      shown: visibleChar(c),
      codePoint: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
      bytes: formatBytes(enc.bytes, 'hex'),
      unmappable: enc.unmappable > 0,
    });
  }
  return rows;
}

export interface TextStats {
  /** Caratteri percepiti (una famiglia di emoji conta uno); null per testi molto lunghi. */
  graphemes: number | null;
  codePoints: number;
  bytes: number;
}

const GRAPHEME_LIMIT = 200_000;

export function textStats(text: string, byteCount: number): TextStats {
  let codePoints = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.codePointAt(i)! > 0xffff) i++;
    codePoints++;
  }
  let graphemes: number | null = null;
  if (text.length <= GRAPHEME_LIMIT) {
    if (typeof Intl.Segmenter === 'function') {
      graphemes = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)).length;
    } else {
      graphemes = codePoints;
    }
  }
  return { graphemes, codePoints, bytes: byteCount };
}

/** Hex dump classico: offset, 16 byte in esadecimale e colonna ASCII. Solo i primi `max` byte. */
export function hexDump(bytes: Uint8Array, max = HEX_DUMP_BYTES): string {
  const n = Math.min(bytes.length, max);
  const lines: string[] = [];
  for (let off = 0; off < n; off += 16) {
    const chunk = bytes.subarray(off, Math.min(off + 16, n));
    const hex = Array.from(chunk, (b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(chunk, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
    lines.push(off.toString(16).padStart(8, '0') + '  ' + hex.padEnd(47, ' ') + '  |' + ascii + '|');
  }
  return lines.join('\n');
}
