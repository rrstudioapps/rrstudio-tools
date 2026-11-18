// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { checkChar } from '../tools/codice-fiscale/codice-fiscale';
import { mod97, normalizeIban } from '../tools/iban-partita-iva/iban';

/**
 * Riconoscimento del contenuto incollato in home. Funzioni pure (niente Angular, niente rete): dato un testo,
 * dicono di che cosa potrebbe trattarsi, con un punteggio da 0 a 100. I rilevatori sono prudenti: meglio
 * non riconoscere che proporre uno strumento sbagliato (quindi controlli di checksum, di struttura e di intervalli).
 */
export type ContentType =
  | 'json'
  | 'jwt'
  | 'url'
  | 'base64'
  | 'color'
  | 'cron'
  | 'iban'
  | 'codice-fiscale'
  | 'partita-iva'
  | 'svg'
  | 'curl'
  | 'docker-run'
  | 'csv'
  | 'yaml'
  | 'xml'
  | 'sql'
  | 'unix-timestamp'
  | 'uuid'
  | 'hash'
  | 'pem'
  | 'ip'
  | 'roman'
  | 'morse'
  | 'date'
  | 'text';

export interface Detection {
  type: ContentType;
  /** 0-100: quanto siamo sicuri. */
  score: number;
  /** Dettaglio utile all'anteprima (algoritmo dell'hash, separatore del CSV, etichetta del PEM…). */
  info?: string;
}

/** Oltre questa lunghezza il contenuto si analizza solo in parte (per non bloccare la pagina). */
export const MAX_ANALYZE = 2_000_000;

type Detector = (s: string) => Detection | null;

const det = (type: ContentType, score: number, info?: string): Detection => ({ type, score, ...(info ? { info } : {}) });

// ---------------------------------------------------------------- strutturati

export function detectJson(s: string): Detection | null {
  const c = s[0];
  if ((c !== '{' && c !== '[') || s.length > MAX_ANALYZE) return null;
  const end = s[s.length - 1];
  if ((c === '{' && end !== '}') || (c === '[' && end !== ']')) return null;
  try {
    const v = JSON.parse(s);
    return typeof v === 'object' && v !== null ? det('json', 100) : null;
  } catch {
    return null;
  }
}

function b64urlDecode(seg: string): string | null {
  try {
    const b = seg.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
    return decodeURIComponent(
      Array.from(bin, (ch) => '%' + ch.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    );
  } catch {
    return null;
  }
}

export function detectJwt(s: string): Detection | null {
  const t = s.replace(/^bearer\s+/i, '');
  const m = /^([A-Za-z0-9_-]{4,})\.([A-Za-z0-9_-]{2,})\.([A-Za-z0-9_-]*)$/.exec(t);
  if (!m) return null;
  const header = b64urlDecode(m[1]);
  if (!header || header[0] !== '{') return null;
  try {
    const h = JSON.parse(header);
    if (typeof h !== 'object' || h === null || !('alg' in h || 'typ' in h)) return null;
  } catch {
    return null;
  }
  return det('jwt', 100);
}

export function detectUrl(s: string): Detection | null {
  if (/\s/.test(s) || s.length > 8000) return null;
  if (!/^(https?|ftp|wss?):\/\/[^/?#]+/i.test(s)) return null;
  try {
    const u = new URL(s);
    return u.hostname ? det('url', 95) : null;
  } catch {
    return null;
  }
}

function printableRatio(text: string): number {
  if (!text) return 0;
  let ok = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127 && c !== 0xfffd && !(c >= 128 && c < 160))) ok++;
  }
  return ok / [...text].length;
}

export function detectBase64(s: string): Detection | null {
  if (s.length < 12 || s.length > MAX_ANALYZE) return null;
  // sono ammessi gli a capo (MIME, righe da 64/76 caratteri) ma non gli spazi dentro una riga
  const lines = s.split(/\r?\n/);
  if (lines.some((l) => /\s/.test(l.trim()) || l.trim() === '')) return null;
  const t = lines.map((l) => l.trim()).join('');
  if (t.length < 12 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(t)) return null;
  if (/^[0-9a-f]+$/i.test(t) || /^\d+$/.test(t)) return null; // hash esadecimali e numeri
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t)) return null; // UUID
  if (/[+/]/.test(t) && /[_-]/.test(t)) return null; // alfabeti misti: non è base64
  const std = t.replace(/-/g, '+').replace(/_/g, '/');
  const body = std.replace(/=+$/, '');
  if (body.length % 4 === 1) return null;
  if (t.includes('=') && t.length % 4 !== 0) return null;
  let bytes: Uint8Array;
  try {
    const bin = atob(body + '='.repeat((4 - (body.length % 4)) % 4));
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  let text = '';
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = '';
  }
  if (text && printableRatio(text) >= 0.95) return det('base64', 90, 'text');
  // binario (immagini, file): serve un segnale in più oltre all'alfabeto, altrimenti una parola lunga sembrerebbe base64
  if (t.length >= 24 && (/=$/.test(t) || (/\d/.test(t) && /[+/]/.test(t)))) return det('base64', 55, 'binary');
  return null;
}

const NAMED_COLOR_FN = /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(\s*[^()]+\)$/i;

export function detectColor(s: string): Detection | null {
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return det('color', 92);
  if (s.length <= 80 && NAMED_COLOR_FN.test(s) && /\d/.test(s)) {
    // il contenuto delle parentesi deve essere fatto di numeri, percentuali, unità e separatori
    const inner = s.slice(s.indexOf('(') + 1, -1);
    if (/^[\d\s.,%/+\-a-z]+$/i.test(inner) && !/[a-z]{4,}/i.test(inner.replace(/\b(from|none|deg|rad|grad|turn|display-p3|srgb|calc)\b/gi, ''))) {
      return det('color', 96);
    }
  }
  return null;
}

const CRON_MACROS = /^@(yearly|annually|monthly|weekly|daily|midnight|hourly|reboot)$/i;
const MONTHS = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' ');
const DAYS = 'SUN MON TUE WED THU FRI SAT'.split(' ');

function cronValue(v: string, min: number, max: number, names: string[] | null): boolean {
  if (/^\d+$/.test(v)) return Number(v) >= min && Number(v) <= max;
  if (names) {
    const i = names.indexOf(v.toUpperCase());
    return i !== -1 && v.length === 3;
  }
  return false;
}

function cronField(f: string, min: number, max: number, names: string[] | null, extras: RegExp | null): boolean {
  if (f === '*' || f === '?') return true;
  if (extras && extras.test(f)) return true;
  for (const part of f.split(',')) {
    if (!part) return false;
    const [range, step, ...rest] = part.split('/');
    if (rest.length) return false;
    if (step !== undefined && !/^[1-9]\d*$/.test(step)) return false;
    if (range === '*') continue;
    const bounds = range.split('-');
    if (bounds.length > 2) return false;
    if (!bounds.every((b) => cronValue(b, min, max, names))) return false;
  }
  return true;
}

export function detectCron(s: string): Detection | null {
  if (s.includes('\n') || s.length > 120) return null;
  if (CRON_MACROS.test(s)) return det('cron', 95);
  const f = s.split(/\s+/);
  if (f.length < 5 || f.length > 7) return null;
  const hasSecond = f.length >= 6;
  const fields = hasSecond ? f.slice(0, 6) : f;
  const [sec, min, hour, dom, mon, dow] = hasSecond ? fields : ['0', ...fields];
  const ok =
    cronField(sec, 0, 59, null, null) &&
    cronField(min, 0, 59, null, null) &&
    cronField(hour, 0, 23, null, null) &&
    cronField(dom, 1, 31, null, /^(L|LW|\d{1,2}W)$/i) &&
    cronField(mon, 1, 12, MONTHS, null) &&
    cronField(dow, 0, 7, DAYS, /^(\d|[A-Za-z]{3})?L$|^[0-7A-Za-z]{1,3}#[1-5]$/);
  if (!ok) return null;
  if (f.length === 7 && !/^(\*|\d{4}([-,/]\d{4})*)$/.test(f[6])) return null;
  // cinque numeri semplici ("1 2 3 4 5") sono più probabilmente numeri qualsiasi che una pianificazione
  const special = /[*/,\-?LW#]/.test(s) || /[A-Za-z]/.test(s);
  return det('cron', special ? 97 : 45);
}

export function detectIban(s: string): Detection | null {
  const n = normalizeIban(s);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(n) || /\s{2,}|\n/.test(s)) return null;
  if (mod97(n) === 1) return det('iban', 98);
  return /^IT\d{2}[A-Z]\d{10}[A-Z0-9]{12}$/.test(n) ? det('iban', 60, 'checksum') : null;
}

const CF_RE = /^[A-Z]{6}[\dLMNPQRSTUV]{2}[ABCDEHLMPRST][\dLMNPQRSTUV]{2}[A-Z][\dLMNPQRSTUV]{3}[A-Z]$/;

export function detectCodiceFiscale(s: string): Detection | null {
  const n = s.toUpperCase().replace(/\s+/g, '');
  if (n.length !== 16 || !CF_RE.test(n)) return null;
  return checkChar(n.slice(0, 15)) === n[15] ? det('codice-fiscale', 100) : det('codice-fiscale', 60, 'checksum');
}

function vatValid(d: string): boolean {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const x = Number(d[i]);
    sum += i % 2 === 0 ? x : x * 2 > 9 ? x * 2 - 9 : x * 2;
  }
  return (10 - (sum % 10)) % 10 === Number(d[10]);
}

export function detectPartitaIva(s: string): Detection | null {
  const m = /^(IT)?\s*(\d{11})$/i.exec(s);
  if (!m || /^0{11}$/.test(m[2])) return null;
  if (!vatValid(m[2])) return null;
  return det('partita-iva', m[1] ? 95 : 70);
}

export function detectSvg(s: string): Detection | null {
  if (!/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)?(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(s)) return null;
  return /<\/svg>\s*$/i.test(s) || /\/>\s*$/.test(s) ? det('svg', 100) : null;
}

export function detectCurl(s: string): Detection | null {
  return /^(\$\s*)?curl(\.exe)?\s+\S/.test(s) ? det('curl', 100) : null;
}

export function detectDockerRun(s: string): Detection | null {
  return /^(\$\s*)?(sudo\s+)?docker\s+(container\s+)?run\s+\S/.test(s) ? det('docker-run', 100) : null;
}

/** Separa una riga CSV rispettando le virgolette. Restituisce il numero di campi. */
function fieldCount(line: string, delim: string): number {
  let n = 1;
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted && ch === delim) n++;
  }
  return quoted ? -1 : n;
}

export function detectCsv(s: string): Detection | null {
  const lines = s.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2 || lines.length > 100_000) return null;
  const sample = lines.slice(0, 200);
  let best: Detection | null = null;
  for (const [delim, name] of [
    [',', 'comma'],
    [';', 'semicolon'],
    ['\t', 'tab'],
    ['|', 'pipe'],
  ] as const) {
    const counts = sample.map((l) => fieldCount(l, delim));
    const first = counts[0];
    if (first < 2) continue;
    const same = counts.filter((c) => c === first).length;
    if (same / counts.length < 0.9) continue;
    // prosa: righe che finiscono con un segno di punteggiatura da frase non sono righe di tabella
    if (sample.filter((l) => /[.!?]\s*$/.test(l)).length / sample.length >= 0.5) continue;
    // due sole righe a due colonne senza nemmeno un numero sono più spesso frasi con una virgola che una tabella
    const numeric = sample.slice(1).some((l) => l.split(delim).some((c) => /^\s*"?-?[\d.,]+"?\s*$/.test(c)));
    if (sample.length <= 2 && first < 3 && !numeric) continue;
    // una tabella ha celle brevi: righe lunghe come frasi con una virgola ogni tanto non lo sono
    const avgCell = sample.reduce((a, l) => a + l.length, 0) / sample.reduce((a, l) => a + Math.max(1, fieldCount(l, delim)), 0);
    if (avgCell > 60) continue;
    const score = (name === 'tab' ? 85 : 80) + (lines.length >= 3 ? 5 : -15) + (first >= 3 ? 3 : 0);
    if (!best || score > best.score) best = det('csv', Math.min(score, 92), name);
  }
  return best;
}

export function detectYaml(s: string): Detection | null {
  if (/^[{[]/.test(s) || /^</.test(s)) return null;
  const lines = s.split(/\r?\n/).filter((l) => l.trim() !== '' && !/^\s*#/.test(l) && l.trim() !== '---' && l.trim() !== '...');
  if (!lines.length || lines.length > 100_000) return null;
  const KV = /^\s*(-\s+)?("[^"]+"|'[^']+'|[A-Za-z_][\w.\- ]{0,60}):(\s+\S.*|\s*)$/;
  const ITEM = /^\s*-\s+\S/;
  const matching = lines.filter((l) => (KV.test(l) && !/^\s*\w+:\/\//.test(l)) || ITEM.test(l) || /^\s+\S/.test(l)).length;
  const kv = lines.filter((l) => KV.test(l)).length;
  if (kv === 0 || matching / lines.length < 0.8) return null;
  const docStart = /^---\s*\n/.test(s);
  if (lines.length === 1) return docStart ? det('yaml', 70) : null;
  if (kv < 2 && !docStart) return null;
  return det('yaml', docStart ? 90 : lines.length >= 3 ? 82 : 68);
}

export function detectXml(s: string): Detection | null {
  if (s[0] !== '<' || s[s.length - 1] !== '>' || s.length > MAX_ANALYZE) return null;
  if (/^<\?xml\s/i.test(s)) return det('xml', 96, 'xml');
  if (/^<!doctype\s+html|^<html[\s>]/i.test(s)) return det('xml', 92, 'html');
  const m = /^<([A-Za-z][\w:.-]*)(\s[^<>]*)?>/.exec(s);
  if (!m) return null;
  const closing = new RegExp(`</${m[1].replace(/[.]/g, '\\.')}\\s*>$`);
  if (closing.test(s)) return det('xml', 82, /^(div|p|span|a|ul|ol|li|table|section|body|head|h[1-6]|form|button)$/i.test(m[1]) ? 'html' : 'xml');
  if (/\/>$/.test(s) && !s.slice(1, -2).includes('<')) return det('xml', 70, 'xml');
  return null;
}

export function detectSql(s: string): Detection | null {
  if (s.length > MAX_ANALYZE) return null;
  const q = s.replace(/^(\s*(--[^\n]*\n|\/\*[\s\S]*?\*\/))+/, '').trimStart();
  const tests: RegExp[] = [
    /^select\s+[\s\S]+?\s+from\s+\S/i,
    /^select\s+(\d+|'[^']*'|@@?\w+|\w+\s*\([^)]*\))(\s+as\s+\w+)?\s*;?$/i,
    /^insert\s+(into|ignore\s+into)\s+\S[\s\S]*(values|select|set)\b/i,
    /^update\s+\S+\s+set\s+\S/i,
    /^delete\s+from\s+\S/i,
    /^create\s+(or\s+replace\s+)?(temp(orary)?\s+)?(table|view|index|unique\s+index|database|schema)\s+\S/i,
    /^alter\s+table\s+\S+\s+\S/i,
    /^drop\s+(table|view|index|database|schema)\s+\S/i,
    /^with\s+\w+\s+as\s*\(/i,
    /^truncate\s+table\s+\S/i,
  ];
  return tests.some((r) => r.test(q)) ? det('sql', 95) : null;
}

export function detectUnixTimestamp(s: string): Detection | null {
  const m = /^(\d{10}|\d{13})(\.\d{1,9})?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  const sec = m[1].length === 10 ? n : n / 1000;
  // dal 2001 al 2100: fuori da qui è quasi certamente un numero qualsiasi
  if (sec < 978_307_200 || sec > 4_102_444_800) return null;
  return det('unix-timestamp', 80, m[1].length === 10 ? 's' : 'ms');
}

export function detectUuid(s: string): Detection | null {
  const t = s.replace(/^\{|\}$/g, '').replace(/^urn:uuid:/i, '');
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) return det('uuid', 100);
  if (/^(0{8}-0{4}-0{4}-0{4}-0{12}|f{8}-f{4}-f{4}-f{4}-f{12})$/i.test(t)) return det('uuid', 90, 'special');
  return null;
}

const HASH_LENGTHS: Record<number, string> = { 32: 'md5', 40: 'sha1', 56: 'sha224', 64: 'sha256', 96: 'sha384', 128: 'sha512' };

export function detectHash(s: string): Detection | null {
  const t = s.replace(/^(md5|sha-?\d+)\s*[:=]\s*/i, '');
  const algo = HASH_LENGTHS[t.length];
  if (!algo || !/^[0-9a-f]+$/i.test(t) || !/[a-f]/i.test(t) || !/\d/.test(t)) return null;
  return det('hash', 85, algo);
}

export function detectPem(s: string): Detection | null {
  const m = /^-----BEGIN ([A-Z0-9 ]+)-----\s*[\s\S]*?-----END \1-----\s*$/.exec(s);
  if (!m) return null;
  return det('pem', 100, m[1]);
}

function ipv4Valid(a: string): boolean {
  const p = a.split('.');
  return p.length === 4 && p.every((x) => /^(0|[1-9]\d{0,2})$/.test(x) && Number(x) <= 255);
}

function ipv6Valid(a: string): boolean {
  if (!/^[0-9a-f:.]+$/i.test(a) || (a.match(/:/g) ?? []).length < 2 || /:::/.test(a)) return false;
  const dbl = a.split('::');
  if (dbl.length > 2) return false;
  const groups = (x: string) => (x === '' ? [] : x.split(':'));
  const all = dbl.flatMap(groups);
  let count = all.length;
  const last = all[all.length - 1];
  if (last && last.includes('.')) {
    if (!ipv4Valid(last)) return false;
    count++; // l'IPv4 finale vale due gruppi
    all.pop();
  }
  if (!all.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return false;
  return dbl.length === 2 ? count < 8 : count === 8;
}

export function detectIp(s: string): Detection | null {
  const [addr, prefix, ...rest] = s.split('/');
  if (rest.length || addr === '') return null;
  const v4 = ipv4Valid(addr);
  const v6 = !v4 && ipv6Valid(addr);
  if (!v4 && !v6) return null;
  if (prefix !== undefined) {
    if (!/^\d{1,3}$/.test(prefix) || Number(prefix) > (v4 ? 32 : 128)) return null;
    return det('ip', 96, 'cidr');
  }
  return det('ip', v4 ? 85 : 80, 'address');
}

const ROMAN_RE = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

export function detectRoman(s: string): Detection | null {
  // solo maiuscole: in minuscolo "mix" e "mild" sarebbero numeri romani
  if (s.length < 2 || s.length > 15 || !ROMAN_RE.test(s)) return null;
  return det('roman', s.length >= 3 ? 85 : 50);
}

export function detectMorse(s: string): Detection | null {
  if (s.length > 20_000 || !/^[.\-/\s|]+$/.test(s) || !/[.-]/.test(s)) return null;
  const groups = s.split(/[\s|/]+/).filter(Boolean);
  if (groups.length < 2 || !groups.every((g) => /^[.-]{1,7}$/.test(g))) return null;
  // "- - -", "---" e "..." sono elenchi puntati, linee e puntini di sospensione
  if (/^[-\s]+$/.test(s) || /^[.\s]+$/.test(s)) return null;
  return det('morse', groups.length >= 3 ? 90 : 60);
}

function validYmd(y: number, m: number, d: number): boolean {
  if (y < 1000 || y > 2999 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function detectDate(s: string): Detection | null {
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(s);
  if (m) {
    const timeOk = m[4] === undefined || (Number(m[4]) < 24 && Number(m[5]) < 60 && (m[6] === undefined || Number(m[6]) < 61));
    return timeOk && validYmd(+m[1], +m[2], +m[3]) ? det('date', 90, 'iso') : null;
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m && validYmd(+m[3], +m[2], +m[1])) return det('date', 85, 'dmy');
  if (m && validYmd(+m[3], +m[1], +m[2])) return det('date', 70, 'mdy');
  if (/^[A-Z][a-z]{2},?\s+\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}(\s+\d{2}:\d{2}(:\d{2})?)?(\s+\S+)?$/.test(s) && !Number.isNaN(Date.parse(s))) {
    return det('date', 80, 'rfc');
  }
  return null;
}

const DETECTORS: Detector[] = [
  detectJson,
  detectJwt,
  detectPem,
  detectSvg,
  detectUuid,
  detectUrl,
  detectCurl,
  detectDockerRun,
  detectIban,
  detectCodiceFiscale,
  detectPartitaIva,
  detectColor,
  detectCron,
  detectUnixTimestamp,
  detectDate,
  detectIp,
  detectHash,
  detectRoman,
  detectMorse,
  detectBase64,
  detectSql,
  detectXml,
  detectCsv,
  detectYaml,
];

/**
 * Tutti i tipi plausibili per il testo, dal più sicuro. Chi supera 90 nasconde i candidati deboli (sotto top-40);
 * se nessun rilevatore risponde resta solo `text`, che porta agli strumenti di testo generici.
 */
export function detectContent(raw: string): Detection[] {
  const s = raw.replace(/^﻿/, '').trim();
  if (!s) return [];
  const found: Detection[] = [];
  for (const d of DETECTORS) {
    let r: Detection | null = null;
    try {
      r = d(s);
    } catch {
      r = null;
    }
    if (r) found.push(r);
  }
  found.sort((a, b) => b.score - a.score);
  // CSV e YAML sono "ultima spiaggia": se un formato più specifico è sicuro, non vanno proposti
  const strong = found.some((d) => d.score >= 90 && d.type !== 'csv' && d.type !== 'yaml');
  if (strong) found.splice(0, found.length, ...found.filter((d) => d.type !== 'csv' && d.type !== 'yaml'));
  const top = found[0]?.score ?? 0;
  const kept = found.filter((d) => d.score >= 40 && d.score >= top - 40);
  return [...kept, det('text', 1)];
}

/** Il tipo migliore, o `text`. */
export function bestType(raw: string): ContentType {
  return detectContent(raw)[0]?.type ?? 'text';
}

// ---------------------------------------------------------------- anteprima sicura

const BIDI_AND_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g;

/**
 * Anteprima breve e sicura: SOLO testo (chi la mostra deve usare l'interpolazione, mai innerHTML). Toglie
 * caratteri di controllo e di direzione (che potrebbero ingannare), limita righe e lunghezza e non mostra
 * il corpo di una chiave privata.
 */
export function previewText(raw: string, maxChars = 240, maxLines = 4): string {
  let s = raw.replace(/^﻿/, '').trim();
  const priv = /^-----BEGIN ([A-Z0-9 ]*PRIVATE KEY[A-Z0-9 ]*)-----/.exec(s);
  if (priv) return `-----BEGIN ${priv[1]}-----\n…`;
  s = s.replace(BIDI_AND_CONTROL, '·');
  let lines = s.split(/\r?\n/);
  let cut = false;
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    cut = true;
  }
  s = lines.map((l) => (l.length > 120 ? l.slice(0, 120) + '…' : l)).join('\n');
  if (s.length > maxChars) {
    s = s.slice(0, maxChars);
    cut = true;
  }
  return cut ? s.replace(/\s+$/, '') + '…' : s;
}
