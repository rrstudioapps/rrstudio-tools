// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Formati supportati. L'HTML non c'è: per le entità c'è lo strumento «Entità HTML». */
export type EscapeFormat = 'json' | 'js' | 'python' | 'regex' | 'shell' | 'sql' | 'csv' | 'java' | 'php';
export type QuoteStyle = 'single' | 'double' | 'backtick';

export interface EscapeOptions {
  /** Apice usato da JavaScript, Python e PHP (negli altri formati è fisso). */
  quote: QuoteStyle;
  /** Aggiunge (escape) o si aspetta (unescape) gli apici o le virgolette esterne. Per CSV: sempre, invece che solo se serve. */
  wrap: boolean;
  /** Scrive come sequenza di escape anche tutti i caratteri non ASCII. */
  ascii: boolean;
  /** Separatore dei campi CSV. */
  separator: string;
}

export const DEFAULT_OPTIONS: EscapeOptions = { quote: 'double', wrap: false, ascii: false, separator: ',' };

export const FORMATS: readonly EscapeFormat[] = ['json', 'js', 'python', 'regex', 'shell', 'sql', 'csv', 'java', 'php'];
export const SEPARATORS: readonly string[] = [',', ';', '\t', '|'];
/** Limite del testo in ingresso (circa 1 MB). */
export const MAX_CHARS = 1_000_000;

/** Quali opzioni hanno senso per ciascun formato (serve all'interfaccia). */
export function quoteChoices(format: EscapeFormat): QuoteStyle[] {
  if (format === 'js') return ['single', 'double', 'backtick'];
  if (format === 'python' || format === 'php') return ['single', 'double'];
  return [];
}
export const supportsWrap = (f: EscapeFormat): boolean => f !== 'regex' && f !== 'shell';
export const supportsAscii = (f: EscapeFormat): boolean => f === 'json' || f === 'js' || f === 'python' || f === 'java' || f === 'php';

/** Errore di unescape: `error` è un codice stabile (tradotto dalla pagina), `position` un indice UTF-16 nel testo. */
export type UnescapeResult = { ok: true; value: string } | { ok: false; error: string; position?: number };

const fail = (error: string, position?: number): UnescapeResult => ({ ok: false, error, position });
const ok = (value: string): UnescapeResult => ({ ok: true, value });

/** Riga e colonna (da 1) di un indice nel testo. */
export function lineCol(text: string, position: number): { line: number; col: number } {
  let line = 1;
  let last = -1;
  for (let i = 0; i < position && i < text.length; i++) {
    if (text[i] === '\n') { line++; last = i; }
  }
  return { line, col: position - last };
}

const hex = (n: number, width: number): string => n.toString(16).padStart(width, '0');
const HEX_RE = /^[0-9a-fA-F]+$/;

/** Caratteri che conviene scrivere come escape: controlli, invisibili, separatori di riga, surrogati spaiati. */
function needsEscape(cp: number): boolean {
  return (
    cp < 0x20 || (cp >= 0x7f && cp <= 0x9f) || cp === 0xad ||
    (cp >= 0x200b && cp <= 0x200f) || cp === 0x2028 || cp === 0x2029 ||
    (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2060 && cp <= 0x2064) || cp === 0xfeff ||
    (cp >= 0xd800 && cp <= 0xdfff)
  );
}

/** `\uXXXX`, con coppia di surrogati sopra il piano base. */
function u4(cp: number): string {
  if (cp <= 0xffff) return '\\u' + hex(cp, 4);
  const v = cp - 0x10000;
  return '\\u' + hex(0xd800 + (v >> 10), 4) + '\\u' + hex(0xdc00 + (v & 0x3ff), 4);
}

// ---------------------------------------------------------------- escape con backslash

interface BackslashSpec {
  /** Escape mnemonici (code point → testo). */
  names: Readonly<Record<number, string>>;
  /** Apice da proteggere ('' = nessuno). */
  quote: string;
  /** Escape per i caratteri non stampabili (e, con `ascii`, per i non ASCII). */
  encode: (cp: number) => string;
  /** Protegge anche `${` (template literal) o `$` (PHP). */
  dollar?: 'brace' | 'always';
}

const NAMES_JSON = { 8: '\\b', 9: '\\t', 10: '\\n', 12: '\\f', 13: '\\r' };

function backslashEscape(text: string, spec: BackslashSpec, ascii: boolean): string {
  const cps = [...text];
  let out = '';
  for (let i = 0; i < cps.length; i++) {
    const c = cps[i];
    const cp = c.codePointAt(0)!;
    if (c === '\\') out += '\\\\';
    else if (c === spec.quote) out += '\\' + c;
    else if (c === '$' && (spec.dollar === 'always' || (spec.dollar === 'brace' && cps[i + 1] === '{'))) out += '\\$';
    else if (spec.names[cp] !== undefined) out += spec.names[cp];
    else if (needsEscape(cp) || (ascii && cp > 0x7e)) out += spec.encode(cp);
    else out += c;
  }
  return out;
}

const QUOTE_CHAR: Record<QuoteStyle, string> = { single: "'", double: '"', backtick: '`' };

function specFor(format: EscapeFormat, quote: QuoteStyle): BackslashSpec {
  switch (format) {
    case 'json':
      return { names: NAMES_JSON, quote: '"', encode: u4 };
    case 'js':
      return { names: { ...NAMES_JSON, 11: '\\v' }, quote: QUOTE_CHAR[quote], encode: u4, dollar: quote === 'backtick' ? 'brace' : undefined };
    case 'python':
      return {
        names: { 7: '\\a', 8: '\\b', 9: '\\t', 10: '\\n', 11: '\\v', 12: '\\f', 13: '\\r' },
        quote: QUOTE_CHAR[quote === 'backtick' ? 'double' : quote],
        encode: (cp) => (cp < 0x100 ? '\\x' + hex(cp, 2) : cp <= 0xffff ? '\\u' + hex(cp, 4) : '\\U' + hex(cp, 8)),
      };
    case 'java':
      return { names: NAMES_JSON, quote: '"', encode: u4 };
    default: // php, tra doppi apici
      return {
        names: { 9: '\\t', 10: '\\n', 11: '\\v', 12: '\\f', 13: '\\r', 27: '\\e' },
        quote: '"',
        encode: (cp) => (cp < 0x80 ? '\\x' + hex(cp, 2) : '\\u{' + hex(cp, 4) + '}'),
        dollar: 'always',
      };
  }
}

/** Apice effettivo per il formato (alcuni formati ne ammettono uno solo). */
function effectiveQuote(format: EscapeFormat, quote: QuoteStyle): QuoteStyle {
  if (format === 'json' || format === 'java') return 'double';
  if (format === 'sql') return 'single';
  if (format === 'python' || format === 'php') return quote === 'backtick' ? 'double' : quote;
  return quote;
}

const REGEX_META = '\\^$.|?*+()[]{}-/';

function escapeCsv(text: string, o: EscapeOptions): string {
  const needs = o.wrap || text.includes('"') || text.includes(o.separator) || /[\r\n]/.test(text);
  return needs ? '"' + text.replace(/"/g, '""') + '"' : text;
}

/** Protegge i caratteri speciali di `text` per il formato scelto. */
export function escapeString(format: EscapeFormat, text: string, options: Partial<EscapeOptions> = {}): string {
  const o: EscapeOptions = { ...DEFAULT_OPTIONS, ...options };
  const quote = effectiveQuote(format, o.quote);
  const q = QUOTE_CHAR[quote];
  const wrapped = (s: string): string => (o.wrap ? q + s + q : s);
  switch (format) {
    case 'regex': {
      let out = '';
      for (const c of text) out += REGEX_META.includes(c) ? '\\' + c : c;
      return out;
    }
    case 'shell':
      return "'" + text.replace(/'/g, "'\\''") + "'";
    case 'sql':
      return wrapped(text.replace(/'/g, "''"));
    case 'csv':
      return escapeCsv(text, o);
    case 'php':
      if (quote === 'single') return wrapped(text.replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
      return wrapped(backslashEscape(text, specFor('php', quote), o.ascii));
    default:
      return wrapped(backslashEscape(text, specFor(format, quote), o.ascii));
  }
}

// ---------------------------------------------------------------- unescape

interface ScanRules {
  /** Carattere dopo il backslash → valore. */
  simple: Readonly<Record<string, string>>;
  /** `\xNN`: esatte 2 cifre ('exact') o 1-2 cifre, altrimenti il testo resta ('php'). */
  hex?: 'exact' | 'php';
  u4?: boolean;
  u8?: boolean;
  /** `\u{...}`. */
  uBrace?: boolean;
  /** Ottali: solo `\0` (JavaScript) o fino a 3 cifre. */
  octal?: 'nul' | 'full';
  /** Backslash + a capo = continuazione di riga. */
  lineCont?: boolean;
  /** Escape sconosciuto: errore, solo il carattere, oppure resta com'è. */
  unknown: 'error' | 'char' | 'keep';
  /** `\N{nome}` di Python: non supportato, meglio un errore che un risultato sbagliato. */
  rejectNamed?: boolean;
  /** Caratteri di controllo non ammessi nel testo (JSON). */
  rawControl?: boolean;
  /** Apice che non può comparire senza escape (JSON). */
  bareQuote?: string;
}

const SIMPLE_JSON = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/' };

const RULES: Record<'json' | 'js' | 'python' | 'java' | 'phpDouble', ScanRules> = {
  json: { simple: SIMPLE_JSON, u4: true, unknown: 'error', rawControl: true, bareQuote: '"' },
  js: {
    simple: { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '\\': '\\', "'": "'", '"': '"', '`': '`' },
    hex: 'exact', u4: true, uBrace: true, octal: 'nul', lineCont: true, unknown: 'char',
  },
  python: {
    simple: { a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', "'": "'", '"': '"' },
    hex: 'exact', u4: true, u8: true, octal: 'full', lineCont: true, unknown: 'keep', rejectNamed: true,
  },
  java: {
    simple: { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', a: '\x07', s: ' ', '\\': '\\', "'": "'", '"': '"' },
    u4: true, u8: true, octal: 'full', unknown: 'error',
  },
  phpDouble: {
    simple: { n: '\n', r: '\r', t: '\t', v: '\v', e: '\x1b', f: '\f', '\\': '\\', $: '$', '"': '"' },
    hex: 'php', uBrace: true, octal: 'full', unknown: 'keep',
  },
};

const isOct = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '7';

/** Legge le sequenze di escape con backslash secondo le regole del formato. `base` sposta le posizioni segnalate. */
function scanBackslash(text: string, r: ScanRules, base: number): UnescapeResult {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch !== '\\') {
      if (r.rawControl && ch.charCodeAt(0) < 0x20) return fail('rawControl', base + i);
      if (r.bareQuote === ch) return fail('unescapedQuote', base + i);
      out += ch;
      i++;
      continue;
    }
    const start = i;
    if (i + 1 >= text.length) return fail('trailingBackslash', base + i);
    const n = text[i + 1];
    if (Object.prototype.hasOwnProperty.call(r.simple, n)) {
      out += r.simple[n];
      i += 2;
    } else if (n === 'x' && r.hex) {
      const digits = text.slice(i + 2, i + 4);
      const m = /^[0-9a-fA-F]{1,2}/.exec(digits);
      if (r.hex === 'exact') {
        if (digits.length !== 2 || !HEX_RE.test(digits)) return fail('badHex', base + start);
        out += String.fromCharCode(parseInt(digits, 16));
        i += 4;
      } else if (m) {
        out += String.fromCharCode(parseInt(m[0], 16));
        i += 2 + m[0].length;
      } else {
        out += '\\x';
        i += 2;
      }
    } else if (n === 'u' && r.uBrace && text[i + 2] === '{') {
      const close = text.indexOf('}', i + 3);
      const digits = close < 0 ? '' : text.slice(i + 3, close);
      if (!HEX_RE.test(digits) || digits.length > 8) return fail('badUnicode', base + start);
      const cp = parseInt(digits, 16);
      if (cp > 0x10ffff) return fail('codePointRange', base + start);
      out += String.fromCodePoint(cp);
      i = close + 1;
    } else if (n === 'u' && r.u4) {
      const digits = text.slice(i + 2, i + 6);
      if (digits.length !== 4 || !HEX_RE.test(digits)) return fail('badUnicode', base + start);
      out += String.fromCharCode(parseInt(digits, 16));
      i += 6;
    } else if (n === 'U' && r.u8) {
      const digits = text.slice(i + 2, i + 10);
      if (digits.length !== 8 || !HEX_RE.test(digits)) return fail('badUnicode', base + start);
      const cp = parseInt(digits, 16);
      if (cp > 0x10ffff) return fail('codePointRange', base + start);
      out += String.fromCodePoint(cp);
      i += 10;
    } else if (r.octal === 'nul' && n === '0' && !/[0-9]/.test(text[i + 2] ?? '')) {
      out += '\0';
      i += 2;
    } else if (r.octal === 'full' && isOct(n)) {
      let len = 1;
      const maxLen = n <= '3' ? 3 : 2;
      while (len < maxLen && isOct(text[i + 1 + len])) len++;
      out += String.fromCharCode(parseInt(text.slice(i + 1, i + 1 + len), 8));
      i += 1 + len;
    } else if (r.lineCont && (n === '\n' || n === '\r' || n === '\u2028' || n === '\u2029')) {
      i += n === '\r' && text[i + 2] === '\n' ? 3 : 2;
    } else if (r.rejectNamed && n === 'N') {
      return fail('badEscape', base + start);
    } else {
      const c = String.fromCodePoint(text.codePointAt(i + 1)!);
      if (r.unknown === 'error') return fail('badEscape', base + start);
      out += r.unknown === 'char' ? c : '\\' + c;
      i += 1 + c.length;
    }
  }
  return ok(out);
}

/** Toglie gli apici esterni (spazi ai lati ammessi); restituisce il contenuto e la sua posizione nel testo. */
function unwrap(text: string, quotes: string): { inner: string; offset: number } | UnescapeResult {
  const lead = text.length - text.trimStart().length;
  const t = text.trim();
  if (t.length < 2 || !quotes.includes(t[0]) || t[t.length - 1] !== t[0]) return fail('wrapMissing', t.length === 0 ? 0 : lead);
  return { inner: t.slice(1, -1), offset: lead + 1 };
}

const isResult = (v: { inner: string; offset: number } | UnescapeResult): v is UnescapeResult => 'ok' in v;

function unescapeSql(text: string, offset: number): UnescapeResult {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "'") { out += text[i]; continue; }
    if (text[i + 1] !== "'") return fail('sqlOddQuote', offset + i);
    out += "'";
    i++;
  }
  return ok(out);
}

function unescapeCsv(text: string): UnescapeResult {
  if (!text.startsWith('"')) return ok(text);
  let out = '';
  let i = 1;
  for (;;) {
    if (i >= text.length) return fail('csvUnclosed', 0);
    if (text[i] === '"') {
      if (text[i + 1] === '"') { out += '"'; i += 2; continue; }
      break;
    }
    out += text[i++];
  }
  const rest = text.slice(i + 1);
  if (rest.trim() !== '') return fail('csvTrailing', i + 1 + (rest.length - rest.trimStart().length));
  return ok(out);
}

function unescapeShell(text: string): UnescapeResult {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'") {
      const close = text.indexOf("'", i + 1);
      if (close < 0) return fail('shellUnclosed', i);
      out += text.slice(i + 1, close);
      i = close + 1;
    } else if (c === '\\') {
      if (i + 1 >= text.length) return fail('trailingBackslash', i);
      const next = String.fromCodePoint(text.codePointAt(i + 1)!);
      out += next;
      i += 1 + next.length;
    } else {
      out += c;
      i++;
    }
  }
  return ok(out);
}

function unescapeRegex(text: string): UnescapeResult {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '\\') { out += text[i]; continue; }
    if (i + 1 >= text.length) return fail('trailingBackslash', i);
    const n = text[i + 1];
    out += REGEX_META.includes(n) ? n : '\\' + n;
    i++;
  }
  return ok(out);
}

/** Riporta il testo alla forma originale. Non lancia eccezioni: gli errori tornano come `{ ok: false }`. */
export function unescapeString(format: EscapeFormat, text: string, options: Partial<EscapeOptions> = {}): UnescapeResult {
  const o: EscapeOptions = { ...DEFAULT_OPTIONS, ...options };
  switch (format) {
    case 'regex': return unescapeRegex(text);
    case 'shell': return unescapeShell(text);
    case 'csv': return unescapeCsv(text);
    default: break;
  }
  let inner = text;
  let offset = 0;
  if (o.wrap) {
    const u = unwrap(text, format === 'json' || format === 'java' ? '"' : format === 'sql' ? "'" : format === 'php' ? QUOTE_CHAR[effectiveQuote('php', o.quote)] : '\'"`'.slice(0, format === 'js' ? 3 : 2));
    if (isResult(u)) return u;
    inner = u.inner;
    offset = u.offset;
  }
  if (format === 'sql') return unescapeSql(inner, offset);
  if (format === 'php' && effectiveQuote('php', o.quote) === 'single') {
    return ok(inner.replace(/\\([\\'])/g, '$1'));
  }
  const rules = RULES[format === 'php' ? 'phpDouble' : (format as 'json' | 'js' | 'python' | 'java')];
  const res = scanBackslash(inner, rules, offset);
  if (res.ok && format === 'json') {
    try {
      JSON.parse('"' + inner + '"');
    } catch {
      return fail('jsonInvalid');
    }
  }
  return res;
}

/** Numero di caratteri (code point): una emoji conta uno, non due. */
export function countChars(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) i++;
    }
    n++;
  }
  return n;
}
