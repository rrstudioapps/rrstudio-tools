// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Conversione tra un elenco (una voce per riga) e un testo su una sola riga con separatori,
 * apici ed escape (SQL, JSON, JavaScript/Python, CSV, URL, shell). Logica pura, senza Angular.
 */

/** Limite di testo accettato (caratteri). */
export const MAX_CHARS = 2 * 1024 * 1024;

export type Quote = 'none' | 'double' | 'single' | 'backtick' | 'minimal';
/** `double` raddoppia l'apice (SQL, CSV); `backslash` usa la barra rovesciata (JS, Python); `json` e `shell` sono completi. */
export type Escape = 'none' | 'double' | 'backslash' | 'json' | 'shell';
export type SortMode = 'none' | 'az' | 'za' | 'numeric';
export type CaseMode = 'none' | 'lower' | 'upper';

/** Separatori predefiniti (il «personalizzato» è una stringa qualsiasi). */
export const SEPARATORS = { comma: ',', commaSpace: ', ', semicolon: ';', space: ' ', tab: '\t', pipe: '|' } as const;
export type SeparatorName = keyof typeof SEPARATORS;

/** Pulizia comune alle due direzioni. */
export interface CleanOptions {
  trim: boolean;
  dropEmpty: boolean;
  unique: boolean;
  sort: SortMode;
  caseMode: CaseMode;
  locale: string;
}

/** Aspetto del testo su una riga: è ciò che cambiano i preset. */
export interface FormatOptions {
  separator: string;
  quote: Quote;
  escape: Escape;
  prefix: string;
  suffix: string;
  /** Separatore anche dopo l'ultima voce. */
  trailing: boolean;
  /** Non mette gli apici a ciò che è un numero JSON (123, -1.5, 2e3; non 007). */
  noQuoteNumbers: boolean;
  /** Codifica ogni voce con encodeURIComponent. */
  encodeUri: boolean;
}

export type ToLineOptions = CleanOptions & FormatOptions;

export const DEFAULT_FORMAT: FormatOptions = {
  separator: ', ',
  quote: 'none',
  escape: 'double',
  prefix: '',
  suffix: '',
  trailing: false,
  noQuoteNumbers: false,
  encodeUri: false,
};

export const DEFAULT_CLEAN: CleanOptions = { trim: true, dropEmpty: true, unique: false, sort: 'none', caseMode: 'none', locale: 'it' };

export const DEFAULT_TO_LINE: ToLineOptions = { ...DEFAULT_CLEAN, ...DEFAULT_FORMAT };

export const PRESET_IDS = ['sql', 'json', 'js', 'csv', 'url', 'shell'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

/** Preset a un clic: ognuno definisce tutto l'aspetto del testo (la pulizia resta quella scelta dall'utente). */
export const PRESETS: Readonly<Record<PresetId, FormatOptions>> = {
  sql: { ...DEFAULT_FORMAT, separator: ', ', quote: 'single', escape: 'double', prefix: '(', suffix: ')', noQuoteNumbers: true },
  json: { ...DEFAULT_FORMAT, separator: ', ', quote: 'double', escape: 'json', prefix: '[', suffix: ']', noQuoteNumbers: true },
  js: { ...DEFAULT_FORMAT, separator: ', ', quote: 'single', escape: 'backslash', prefix: '[', suffix: ']' },
  csv: { ...DEFAULT_FORMAT, separator: ',', quote: 'minimal', escape: 'double' },
  url: { ...DEFAULT_FORMAT, separator: ',', quote: 'none', encodeUri: true },
  shell: { ...DEFAULT_FORMAT, separator: ' ', quote: 'single', escape: 'shell' },
};

/** Opzioni complete di un preset. */
export function presetOptions(id: PresetId, clean: Partial<CleanOptions> = {}): ToLineOptions {
  return { ...DEFAULT_TO_LINE, ...clean, ...PRESETS[id] };
}

/** Nome del separatore predefinito che corrisponde alla stringa, se c'è. */
export function separatorName(sep: string): SeparatorName | null {
  const hit = (Object.keys(SEPARATORS) as SeparatorName[]).find((k) => SEPARATORS[k] === sep);
  return hit ?? null;
}

/** Nel separatore personalizzato `\n`, `\t`, `\r` e `\\` valgono come a capo, tabulazione, ritorno e barra rovesciata. */
export function unescapeSeparator(s: string): string {
  return s.replace(/\\([ntr\\])/g, (_m, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : '\\'));
}

/** Righe di un testo: l'a capo finale non crea una voce in più; il testo vuoto non ha righe. */
export function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

// ---------------------------------------------------------------------------
// Pulizia comune
// ---------------------------------------------------------------------------

const NUMERIC_RE = /^[+-]?\d+(?:[.,]\d+)?$/;
const JSON_NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

function numericValue(s: string): number {
  return NUMERIC_RE.test(s) ? Number(s.replace(',', '.')) : NaN;
}

function sortItems(items: string[], mode: SortMode, locale: string): string[] {
  if (mode === 'none') return items;
  const collator = new Intl.Collator(locale);
  const text = (a: string, b: string): number => collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
  if (mode === 'az') return [...items].sort(text);
  if (mode === 'za') return [...items].sort((a, b) => text(b, a));
  // numerico: i numeri in ordine crescente, poi le altre voci in ordine alfabetico
  const keyed = items.map((s, i) => ({ s, i, n: numericValue(s.trim()) }));
  keyed.sort((a, b) => {
    const an = Number.isNaN(a.n);
    const bn = Number.isNaN(b.n);
    if (an && bn) return text(a.s, b.s);
    if (an) return 1;
    if (bn) return -1;
    return a.n - b.n || a.i - b.i;
  });
  return keyed.map((k) => k.s);
}

/** Spazi, vuote, maiuscole, doppioni e ordine (in quest'ordine). */
export function cleanItems(items: readonly string[], options: Partial<CleanOptions> = {}): string[] {
  const o = { ...DEFAULT_CLEAN, ...options };
  let r: string[] = o.trim ? items.map((s) => s.trim()) : [...items];
  if (o.dropEmpty) r = r.filter((s) => s !== '');
  if (o.caseMode === 'lower') r = r.map((s) => s.toLowerCase());
  else if (o.caseMode === 'upper') r = r.map((s) => s.toUpperCase());
  if (o.unique) r = [...new Set(r)];
  return sortItems(r, o.sort, o.locale);
}

// ---------------------------------------------------------------------------
// Da elenco a riga
// ---------------------------------------------------------------------------

const QUOTE_CHARS: Record<'double' | 'single' | 'backtick', string> = { double: '"', single: "'", backtick: '`' };

function encodeUri(s: string): string {
  try {
    return encodeURIComponent(s);
  } catch {
    // surrogati spaiati: encodeURIComponent lancia un errore, si sostituiscono con U+FFFD
    return encodeURIComponent(s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�'));
  }
}

function escapeBackslash(s: string, q: string): string {
  const ctl = s.replace(/[\u0000-\u001f\\]/g, (c) => {
    switch (c) {
      case '\\': return '\\\\';
      case '\n': return '\\n';
      case '\r': return '\\r';
      case '\t': return '\\t';
      default: return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
    }
  });
  return ctl.split(q).join('\\' + q);
}

/** Tra virgolette solo se serve (CSV): separatore, virgolette, a capo o spazi ai bordi. */
function needsCsvQuote(v: string, separator: string): boolean {
  if (v === '') return false;
  const sepKey = separator.trim() || separator;
  return /["\r\n]/.test(v) || v !== v.trim() || (sepKey !== '' && v.includes(sepKey));
}

/** Una voce con codifica, apici ed escape. */
export function formatItem(item: string, o: FormatOptions): string {
  const v = o.encodeUri ? encodeUri(item) : item;
  if (o.quote === 'none') return v;
  if (o.noQuoteNumbers && JSON_NUMBER_RE.test(v)) return v;
  if (o.quote === 'minimal') return needsCsvQuote(v, o.separator) ? `"${v.split('"').join('""')}"` : v;
  const q = QUOTE_CHARS[o.quote];
  switch (o.escape) {
    case 'json':
      return JSON.stringify(v);
    case 'shell':
      return `'${v.split("'").join("'\\''")}'`;
    case 'backslash':
      return q + escapeBackslash(v, q) + q;
    case 'double':
      return q + v.split(q).join(q + q) + q;
    case 'none':
      return q + v + q;
  }
}

/** Voci → testo su una riga. Senza voci il risultato è vuoto. */
export function itemsToLine(items: readonly string[], options: Partial<ToLineOptions> = {}): string {
  const o = { ...DEFAULT_TO_LINE, ...options };
  const clean = cleanItems(items, o);
  if (clean.length === 0) return '';
  let body = clean.map((it) => formatItem(it, o)).join(o.separator);
  if (o.trailing) body += o.separator.trim() === '' ? o.separator : o.separator.trimEnd();
  return o.prefix + body + o.suffix;
}

/** Testo a righe → testo su una riga. */
export function listToLine(text: string, options: Partial<ToLineOptions> = {}): string {
  return itemsToLine(splitLines(text), options);
}

// ---------------------------------------------------------------------------
// Da riga a elenco
// ---------------------------------------------------------------------------

export interface ToListOptions extends CleanOptions {
  /** `null` = automatico. */
  separator: string | null;
  /** Toglie gli apici dalle voci che ne hanno. */
  stripQuotes: boolean;
  /** Dentro gli apici interpreta `\n`, `\"`, `\\`, `\uXXXX`… (JSON, JavaScript, Python). */
  backslash: boolean;
  /** Toglie le parentesi esterne [ ], ( ) o { } di ogni riga. */
  stripWrapper: boolean;
  /** Caratteri che aprono una voce tra apici. */
  quoteChars: string;
}

export const DEFAULT_TO_LIST: ToListOptions = {
  ...DEFAULT_CLEAN,
  separator: null,
  stripQuotes: true,
  backslash: false,
  stripWrapper: false,
  quoteChars: '"\'`',
};

interface Field {
  /** Testo del campo com'è scritto (apici compresi). */
  raw: string;
  /** Contenuto senza apici, se era tra apici. */
  inner: string | null;
}

function decodeEscape(line: string, p: number): [string, number] {
  const c = line[p];
  switch (c) {
    case 'n': return ['\n', 1];
    case 'r': return ['\r', 1];
    case 't': return ['\t', 1];
    case 'b': return ['\b', 1];
    case 'f': return ['\f', 1];
    case '\\': case '"': case "'": case '`': case '/': return [c, 1];
    case 'u':
      if (/^[0-9A-Fa-f]{4}$/.test(line.slice(p + 1, p + 5))) return [String.fromCharCode(parseInt(line.slice(p + 1, p + 5), 16)), 5];
      return ['\\u', 1];
    default:
      return ['\\' + c, 1];
  }
}

const isBlank = (c: string): boolean => c === ' ' || c === '\t';

/** Legge un campo tra apici che parte in `j`. Restituisce contenuto e posizione dopo gli spazi che seguono, o `null` se non è ben chiuso. */
function readQuoted(line: string, j: number, q: string, sep: string, backslash: boolean): { value: string; end: number } | null {
  const n = line.length;
  let value = '';
  let k = j + 1;
  while (k < n) {
    const c = line[k];
    if (backslash && c === '\\' && k + 1 < n) {
      const [ch, len] = decodeEscape(line, k + 1);
      value += ch;
      k += 1 + len;
      continue;
    }
    if (c === q) {
      if (line[k + 1] === q) {
        value += q;
        k += 2;
        continue;
      }
      let e = k + 1;
      while (e < n && isBlank(line[e]) && !line.startsWith(sep, e)) e++;
      return e === n || line.startsWith(sep, e) ? { value, end: e } : null;
    }
    value += c;
    k++;
  }
  return null;
}

/** Divide una riga nei campi, rispettando gli apici. */
function splitLine(line: string, sep: string, o: Pick<ToListOptions, 'backslash' | 'quoteChars'>): Field[] {
  if (sep === '') return [{ raw: line, inner: null }];
  const out: Field[] = [];
  const n = line.length;
  const collapse = sep === ' ';
  let i = 0;
  for (;;) {
    if (collapse) while (i < n && line[i] === ' ') i++;
    let j = i;
    while (j < n && isBlank(line[j]) && !line.startsWith(sep, j)) j++;
    const q = line[j];
    const quoted = q !== undefined && o.quoteChars.includes(q) ? readQuoted(line, j, q, sep, o.backslash) : null;
    if (quoted) {
      out.push({ raw: line.slice(i, quoted.end).trim(), inner: quoted.value });
      i = quoted.end;
    } else {
      const k = line.indexOf(sep, i);
      const end = k < 0 ? n : k;
      out.push({ raw: line.slice(i, end), inner: null });
      i = end;
    }
    if (i >= n) break;
    i += sep.length;
  }
  return out;
}

const WRAPPERS: Record<string, string> = { '[': ']', '(': ')', '{': '}' };

/** Righe da analizzare: senza parentesi esterne e senza righe che sono solo una parentesi (JSON su più righe). */
function wrapperFree(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.length === 1 && (t in WRAPPERS || t === ']' || t === ')' || t === '}')) continue;
    out.push(t.length >= 2 && WRAPPERS[t[0]] === t[t.length - 1] ? t.slice(1, -1) : line);
  }
  return out;
}

const AUTO_ORDER = ['\t', ';', '|', ','] as const;

function prepareLines(text: string, o: Pick<ToListOptions, 'stripWrapper'>): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return o.stripWrapper ? wrapperFree(lines) : lines;
}

/**
 * Separatore più probabile: tabulazione, punto e virgola, pipe, virgola (in quest'ordine, il primo che divide
 * davvero qualche riga fuori dagli apici), poi lo spazio; se niente divide, la virgola.
 */
export function detectSeparator(text: string, options: Partial<Pick<ToListOptions, 'stripWrapper' | 'backslash' | 'quoteChars'>> = {}): string {
  const o = { ...DEFAULT_TO_LIST, ...options };
  const lines = prepareLines(text, o);
  const candidates = [...AUTO_ORDER, ' '];
  // un campo che inizia con un apice ma non si chiude bene segnala il separatore sbagliato (es. «"a,b","c;d"» diviso da «;»)
  const unclean = (f: Field): boolean => f.inner === null && f.raw.trim() !== '' && o.quoteChars.includes(f.raw.trimStart()[0]);
  for (const strict of [true, false]) {
    for (const sep of candidates) {
      let splits = false;
      let bad = false;
      for (const line of lines) {
        if (!line.includes(sep)) continue;
        const fields = splitLine(line, sep, o);
        if (fields.length > 1 && (sep !== ' ' || fields.filter((f) => f.raw.trim() !== '').length > 1)) splits = true;
        if (strict && fields.some(unclean)) {
          bad = true;
          break;
        }
      }
      if (splits && !bad) return sep;
    }
  }
  return ',';
}

/** Testo con separatori → voci. */
export function lineToList(text: string, options: Partial<ToListOptions> = {}): string[] {
  const o = { ...DEFAULT_TO_LIST, ...options };
  if (text === '') return [];
  const sep = o.separator ?? detectSeparator(text, o);
  const values: string[] = [];
  for (const line of prepareLines(text, o)) {
    for (const f of splitLine(line, sep, o)) values.push(o.stripQuotes && f.inner !== null ? f.inner : f.raw);
  }
  return cleanItems(values, o);
}
