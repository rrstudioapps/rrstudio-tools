// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Estrae da un testo le voci di un certo tipo (email, URL, IP, date, telefoni, IBAN…).
 * Logica pura, senza Angular. Nessuna espressione regolare ha quantificatori annidati o
 * ambigui: il tempo resta lineare anche su testi patologici (vedi spec).
 */

export const KINDS = ['email', 'url', 'ipv4', 'ipv6', 'number', 'date', 'phone', 'hashtag', 'mention', 'iban', 'uuid', 'color', 'euro'] as const;
export type Kind = (typeof KINDS)[number];

export type SortMode = 'appearance' | 'az' | 'frequency';
export type Separator = 'newline' | 'comma' | 'semicolon';

/** Limite di testo accettato (caratteri). */
export const MAX_CHARS = 2 * 1024 * 1024;
/** Oltre questo numero di voci l'elenco a video è troncato (copia e download no). */
export const MAX_SHOWN = 5000;

export interface ExtractOptions {
  /** Toglie i doppioni. */
  unique: boolean;
  sort: SortMode;
  /** Maiuscole e minuscole uguali nei doppioni (solo email, hashtag, menzioni). */
  ignoreCase: boolean;
  locale: string;
}

export const DEFAULT_OPTIONS: ExtractOptions = { unique: true, sort: 'appearance', ignoreCase: true, locale: 'it' };

export interface ExtractItem {
  /** Voce come scritta nel testo (la prima incontrata, per i doppioni). */
  value: string;
  /** Chiave di confronto dei doppioni. */
  key: string;
  /** Quante volte compare nel testo. */
  count: number;
}

export interface ExtractResult {
  items: ExtractItem[];
  /** Occorrenze trovate in tutto il testo, doppioni compresi. */
  total: number;
}

/** Tipi per cui ha senso «ignora maiuscole». */
export function supportsIgnoreCase(kind: Kind): boolean {
  return kind === 'email' || kind === 'hashtag' || kind === 'mention';
}

// ---------------------------------------------------------------------------
// Utilità di scansione
// ---------------------------------------------------------------------------

function scan(re: RegExp, text: string, pick: (m: RegExpExecArray) => string | null): string[] {
  const out: string[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0] === '') {
      re.lastIndex++;
      continue;
    }
    const v = pick(m);
    if (v !== null) out.push(v);
  }
  return out;
}

const isAlnum = (c: number): boolean => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);

// ---------------------------------------------------------------------------
// Email: scansione manuale attorno a ogni «@» (una regex con «[…]+@» sarebbe quadratica)
// ---------------------------------------------------------------------------

const isLocalChar = (c: number): boolean => isAlnum(c) || c === 46 /* . */ || c === 95 /* _ */ || c === 37 /* % */ || c === 43 /* + */ || c === 45 /* - */;
const isDomainChar = (c: number): boolean => isAlnum(c) || c === 46 || c === 45;
const MAX_LOCAL = 64;
const MAX_DOMAIN = 255;

/** Dominio valido: etichette non vuote di lettere, cifre e trattini (non ai bordi), ultima di sole lettere (almeno 2). */
function validDomain(domain: string): boolean {
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (label === '' || label.startsWith('-') || label.endsWith('-')) return false;
  }
  return /^[A-Za-z]{2,}$/.test(labels[labels.length - 1]);
}

function findEmails(text: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const at = text.indexOf('@', from);
    if (at < 0) break;
    from = at + 1;
    let s = at;
    while (s > 0 && at - s < MAX_LOCAL && isLocalChar(text.charCodeAt(s - 1))) s--;
    while (s < at && (text[s] === '.' || text[s] === '-')) s++;
    if (s === at || text[at - 1] === '.') continue;
    let e = at + 1;
    while (e < text.length && e - at <= MAX_DOMAIN && isDomainChar(text.charCodeAt(e))) e++;
    while (e > at + 1 && (text[e - 1] === '.' || text[e - 1] === '-')) e--;
    const domain = text.slice(at + 1, e);
    if (validDomain(domain)) out.push(text.slice(s, e));
  }
  return out;
}

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

const URL_RE = /(?<![A-Za-z0-9@./:\-])(?:https?:\/\/|www\.)[^\s<>"'`«»“”‘’]+/giu;
const URL_TRAIL = '.,;:!?…*';

function cleanUrl(raw: string): string | null {
  // parentesi finali: si tolgono solo se non hanno la coppia dentro l'indirizzo
  const bal: Record<string, number> = { '(': 0, ')': 0, '[': 0, ']': 0, '{': 0, '}': 0 };
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] in bal) bal[raw[i]]++;
  }
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  let end = raw.length;
  for (; end > 0; end--) {
    const c = raw[end - 1];
    if (URL_TRAIL.includes(c)) continue;
    if (c in pairs && bal[c] > bal[pairs[c]]) {
      bal[c]--;
      continue;
    }
    break;
  }
  const url = raw.slice(0, end);
  const rest = url.replace(/^(?:https?:\/\/|www\.)/i, '');
  if (!/[A-Za-z0-9]/.test(rest.slice(0, 1))) return null;
  // «www.» senza nessun altro punto non è un indirizzo
  if (/^www\./i.test(url) && !rest.includes('.')) return null;
  return url;
}

// ---------------------------------------------------------------------------
// IP
// ---------------------------------------------------------------------------

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4_RE = new RegExp(`(?<!\\d)(?<!\\d\\.)${OCTET}(?:\\.${OCTET}){3}(?!\\.?\\d)`, 'g');

function validIpv6(s: string): boolean {
  if (!/[0-9A-Fa-f]/.test(s) || s.length < 3) return false;
  const dbl = s.indexOf('::');
  if (dbl !== s.lastIndexOf('::')) return false;
  if (s.includes(':::')) return false;
  const groups = (part: string): string[] | null => (part === '' ? [] : part.split(':'));
  const okGroup = (g: string): boolean => /^[0-9A-Fa-f]{1,4}$/.test(g);
  if (dbl < 0) {
    const g = groups(s);
    return g !== null && g.length === 8 && g.every(okGroup);
  }
  const head = groups(s.slice(0, dbl));
  const tail = groups(s.slice(dbl + 2));
  if (head === null || tail === null) return false;
  return head.length + tail.length <= 7 && head.every(okGroup) && tail.every(okGroup);
}

const IPV6_RE = /(?<![0-9A-Za-z:.])[0-9A-Fa-f:]+(?![0-9A-Za-z:])/g;

// ---------------------------------------------------------------------------
// Numeri
// ---------------------------------------------------------------------------

const NUMBER_RE = /(?<!\w)[+-]?(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?(?!\d)|\d+(?:[.,]\d+)?)/g;

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

const DATE_RE = /(?<!\d)(?<!\d[/.-])(?:(\d{1,2})([/.-])(\d{1,2})\2(\d{4})|(\d{4})([/.-])(\d{1,2})\6(\d{1,2}))(?!\d)/g;

export function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

// ---------------------------------------------------------------------------
// Telefoni
// ---------------------------------------------------------------------------

const PHONE_RE = /(?<![\w+])\+?\(?\d[\d ().\-\t ]{6,24}\d(?!\d)/g;

function cleanPhone(raw: string): string | null {
  let v = raw;
  if (v.startsWith('(') && !v.includes(')')) v = v.slice(1);
  const digits = v.replace(/\D/g, '').length;
  if (digits < 8 || digits > 15) return null;
  // date e indirizzi IP non sono telefoni
  if (/^\d{1,4}[-./]\d{1,2}[-./]\d{1,4}$/.test(v)) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(v)) return null;
  return v;
}

// ---------------------------------------------------------------------------
// IBAN
// ---------------------------------------------------------------------------

/** Lunghezza dell'IBAN per paese (registro SWIFT, paesi più comuni). */
const IBAN_LENGTHS: Readonly<Record<string, number>> = {
  AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27,
  HR: 21, HU: 28, IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31, NL: 18, NO: 15, PL: 28, PT: 25, RO: 24,
  SE: 24, SI: 19, SK: 24, SM: 27, VA: 22,
};

/** Controllo IBAN: lunghezza del paese e resto 1 della divisione per 97. Accetta spazi e minuscole. */
export function isValidIban(iban: string): boolean {
  const s = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false;
  const len = IBAN_LENGTHS[s.slice(0, 2)];
  if (len === undefined || s.length !== len) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    // lettere: A=10 … Z=35 (due cifre); cifre: una cifra
    rem = code >= 65 ? (rem * 100 + (code - 55)) % 97 : (rem * 10 + (code - 48)) % 97;
  }
  return rem === 1;
}

const IBAN_RE = /(?<![A-Za-z0-9])[A-Za-z]{2}\d{2}(?: ?[A-Za-z0-9]){11,30}/g;

function cleanIban(raw: string): string | null {
  const len = IBAN_LENGTHS[raw.slice(0, 2).toUpperCase()];
  if (len === undefined) return null;
  // il testo trovato può includere parole successive: si prendono solo i primi `len` caratteri alfanumerici
  let n = 0;
  let end = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== ' ') n++;
    if (n === len) {
      end = i + 1;
      break;
    }
  }
  if (end === 0) return null;
  const candidate = raw.slice(0, end);
  // il codice deve finire lì: niente altre lettere o cifre attaccate
  const next = raw[end];
  if (next !== undefined && next !== ' ') return null;
  return isValidIban(candidate) ? candidate : null;
}

/** Come `scan`, ma riparte subito dopo l'IBAN trovato (la regex può aver inglobato anche le parole seguenti). */
function findIbans(text: string): string[] {
  const out: string[] = [];
  IBAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IBAN_RE.exec(text)) !== null) {
    const v = cleanIban(m[0]);
    if (v !== null) out.push(v);
    IBAN_RE.lastIndex = m.index + (v?.length ?? 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Altri tipi
// ---------------------------------------------------------------------------

const HASHTAG_RE = /(?<![\p{L}\p{N}_#&/])#[\p{L}\p{N}_]+/gu;
const MENTION_RE = /(?<![\p{L}\p{N}_@])@[\p{L}\p{N}_]+/gu;
const UUID_RE = /(?<![0-9A-Fa-f-])[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}(?![0-9A-Fa-f])/g;
const COLOR_RE = /(?<![\w&#])#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})(?![\w])/g;

const EUR_NUM = '(?:\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?(?!\\d)|\\d+(?:[.,]\\d{1,2})?)';
const EUR_SIGN = '(?:€|(?<![A-Za-z])(?:EUR|euro)(?![A-Za-z]))';
const EURO_RE = new RegExp(`${EUR_SIGN}[ \\t\\u00a0]?${EUR_NUM}|(?<![\\d.,])${EUR_NUM}[ \\t\\u00a0]?${EUR_SIGN}`, 'gi');

const hasLetter = (s: string): boolean => /\p{L}/u.test(s);

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Tutte le occorrenze del tipo, nell'ordine in cui compaiono e con i doppioni. */
export function findAll(text: string, kind: Kind): string[] {
  if (text === '') return [];
  switch (kind) {
    case 'email':
      return findEmails(text);
    case 'url':
      return scan(URL_RE, text, (m) => cleanUrl(m[0]));
    case 'ipv4':
      return scan(IPV4_RE, text, (m) => m[0]);
    case 'ipv6':
      return scan(IPV6_RE, text, (m) => (validIpv6(m[0]) ? m[0] : null));
    case 'number':
      return scan(NUMBER_RE, text, (m) => m[0]);
    case 'date':
      return scan(DATE_RE, text, (m) => {
        const iso = m[5] !== undefined;
        const ok = iso ? isValidDate(+m[5], +m[7], +m[8]) : isValidDate(+m[4], +m[3], +m[1]);
        return ok ? m[0] : null;
      });
    case 'phone':
      return scan(PHONE_RE, text, (m) => cleanPhone(m[0]));
    case 'hashtag':
      return scan(HASHTAG_RE, text, (m) => (hasLetter(m[0]) ? m[0] : null));
    case 'mention':
      return scan(MENTION_RE, text, (m) => (hasLetter(m[0]) ? m[0] : null));
    case 'iban':
      return findIbans(text);
    case 'uuid':
      return scan(UUID_RE, text, (m) => m[0]);
    case 'color':
      return scan(COLOR_RE, text, (m) => m[0]);
    case 'euro':
      return scan(EURO_RE, text, (m) => m[0].trim());
  }
}

/** Chiave di confronto per i doppioni. */
export function keyOf(kind: Kind, value: string, ignoreCase: boolean): string {
  if (kind === 'iban') return value.replace(/\s+/g, '').toUpperCase();
  if (ignoreCase && supportsIgnoreCase(kind)) return value.toLowerCase();
  return value;
}

/** Applica doppioni e ordinamento a un elenco di occorrenze già trovate. */
export function arrange(matches: readonly string[], kind: Kind, options: Partial<ExtractOptions> = {}): ExtractResult {
  const o = { ...DEFAULT_OPTIONS, ...options };
  const keys = matches.map((v) => keyOf(kind, v, o.ignoreCase));
  const counts = new Map<string, number>();
  const firstAt = new Map<string, number>();
  keys.forEach((k, i) => {
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (!firstAt.has(k)) firstAt.set(k, i);
  });
  let items: ExtractItem[];
  if (o.unique) {
    items = [];
    for (const [k, at] of firstAt) items.push({ value: matches[at], key: k, count: counts.get(k) ?? 1 });
  } else {
    items = matches.map((value, i) => ({ value, key: keys[i], count: counts.get(keys[i]) ?? 1 }));
  }
  if (o.sort === 'az') {
    const collator = new Intl.Collator(o.locale, { numeric: true, sensitivity: 'base' });
    items = items.map((it, i) => ({ it, i })).sort((a, b) => collator.compare(a.it.value, b.it.value) || a.i - b.i).map((x) => x.it);
  } else if (o.sort === 'frequency') {
    items = items
      .map((it, i) => ({ it, i }))
      .sort((a, b) => b.it.count - a.it.count || (firstAt.get(a.it.key) ?? 0) - (firstAt.get(b.it.key) ?? 0) || a.i - b.i)
      .map((x) => x.it);
  }
  return { items, total: matches.length };
}

/** Quante voci mostrerebbe il tipo con queste opzioni (per il contatore sui pulsanti). */
export function countOf(matches: readonly string[], kind: Kind, options: Partial<ExtractOptions> = {}): number {
  const o = { ...DEFAULT_OPTIONS, ...options };
  if (!o.unique) return matches.length;
  const seen = new Set<string>();
  for (const v of matches) seen.add(keyOf(kind, v, o.ignoreCase));
  return seen.size;
}

/** Estrae dal testo le voci del tipo scelto. Oltre {@link MAX_CHARS} caratteri non fa nulla. */
export function extract(text: string, kind: Kind, options: Partial<ExtractOptions> = {}): ExtractResult {
  if (text.length > MAX_CHARS) return { items: [], total: 0 };
  return arrange(findAll(text, kind), kind, options);
}

const SEPARATORS: Record<Separator, string> = { newline: '\n', comma: ', ', semicolon: '; ' };

/** Testo da copiare: le voci col separatore scelto, con il conteggio tra parentesi se richiesto. */
export function toText(items: readonly ExtractItem[], separator: Separator = 'newline', showCount = false): string {
  return items.map((it) => (showCount ? `${it.value} (${it.count})` : it.value)).join(SEPARATORS[separator]);
}

function csvCell(v: string): string {
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV «voce;conteggio» (una riga per voce distinta), con BOM perché Excel legga bene l'UTF-8. */
export function toCsv(items: readonly ExtractItem[]): string {
  const rows = new Map<string, { value: string; count: number }>();
  for (const it of items) {
    if (!rows.has(it.key)) rows.set(it.key, { value: it.value, count: it.count });
  }
  const lines = [...rows.values()].map((r) => `${csvCell(r.value)};${r.count}`);
  return '﻿' + lines.join('\r\n') + (lines.length ? '\r\n' : '');
}
