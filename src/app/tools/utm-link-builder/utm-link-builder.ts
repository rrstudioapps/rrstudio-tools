// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Parametri di campagna nell'ordine in cui compaiono nel link (utm_id subito dopo la campagna, come fa Google). */
export const UTM_FIELDS = ['source', 'medium', 'campaign', 'id', 'term', 'content'] as const;
export type UtmField = (typeof UTM_FIELDS)[number];
export const REQUIRED_FIELDS: readonly UtmField[] = ['source', 'medium', 'campaign'];
export type UtmParams = Partial<Record<UtmField, string>>;

export const MAX_URL = 2000;
export const MAX_VALUE = 500;
/** Oltre questa lunghezza un valore viene segnalato (non bloccato). */
export const LONG_VALUE = 100;
export const MAX_BULK_LINES = 100;
/** Lunghezza oltre la quale un link intero viene segnalato (alcuni servizi lo tagliano). */
export const LONG_URL = 2000;

/** Parametri di tracciamento di altre piattaforme che si portano dietro il loro identificatore di clic. */
export const TRACKING_PARAMS: readonly string[] = ['gclid', 'gbraid', 'wbraid', 'dclid', 'fbclid', 'msclkid', 'ttclid', 'twclid', 'igshid', 'yclid'];

export interface UtmOptions {
  /** Converte i valori in minuscolo (Google Analytics distingue maiuscole e minuscole). */
  lowercase: boolean;
  /** Come si scrivono gli spazi dentro i valori: «%20» oppure sostituiti da «-». */
  spaces: 'percent' | 'dash';
}
export const DEFAULT_OPTIONS: UtmOptions = { lowercase: true, spaces: 'percent' };

export type UtmError = 'empty' | 'invalid' | 'scheme' | 'tooLong' | 'valueTooLong' | 'encoding';
export type WarningCode = 'noScheme' | 'missing' | 'upper' | 'spaces' | 'weird' | 'long' | 'tracking' | 'overwritten' | 'credentials' | 'urlLong';
export interface UtmWarning {
  code: WarningCode;
  field?: UtmField;
  /** Nomi dei parametri coinvolti (tracking, overwritten). */
  names?: string[];
  /** Vero se la correzione è stata applicata (minuscolo, trattino al posto degli spazi). */
  applied?: boolean;
}
export type UtmResult =
  | { ok: true; url: string; warnings: UtmWarning[]; /** Parametri finali della query, decodificati. */ query: [string, string][] }
  | { ok: false; error: UtmError };

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

/** Valore → pezzo di query: encodeURIComponent più i caratteri che questa non codifica (!'()*). Lancia URIError con surrogati spaiati. */
function encodeValue(v: string): string {
  return encodeURIComponent(v).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/** Query decodificata a coppie nome/valore (per l'anteprima). */
export function parseQuery(search: string): [string, string][] {
  return search
    .replace(/^\?/, '')
    .split('&')
    .filter((s) => s !== '')
    .map((seg) => {
      const i = seg.indexOf('=');
      return i < 0 ? [safeDecode(seg), ''] : [safeDecode(seg.slice(0, i)), safeDecode(seg.slice(i + 1))];
    });
}

/** Valore digitato → valore da scrivere nel link (ancora senza codifica) e avvisi relativi al solo campo. */
export function normalizeValue(raw: string, field: UtmField, options: UtmOptions): { value: string; warnings: UtmWarning[] } {
  const warnings: UtmWarning[] = [];
  let value = raw.trim();
  if (value !== value.toLowerCase()) {
    warnings.push({ code: 'upper', field, applied: options.lowercase });
    if (options.lowercase) value = value.toLowerCase();
  }
  if (/\s/.test(value)) {
    warnings.push({ code: 'spaces', field, applied: options.spaces === 'dash' });
    if (options.spaces === 'dash') value = value.replace(/\s+/g, '-');
  }
  if (/[^\p{L}\p{N}\s_.\-~]/u.test(value)) warnings.push({ code: 'weird', field });
  if ([...value].length > LONG_VALUE) warnings.push({ code: 'long', field });
  return { value, warnings };
}

type UrlStep = { ok: true; url: URL; noScheme: boolean } | { ok: false; error: UtmError };

/** Indirizzo digitato → URL http/https valido. Senza schema aggiunge https:// (e lo segnala). Qualsiasi altro schema è rifiutato. */
function parseUrl(input: string): UrlStep {
  const text = input.trim();
  if (text === '') return { ok: false, error: 'empty' };
  if (text.length > MAX_URL) return { ok: false, error: 'tooLong' };
  // caratteri di controllo: i browser li ignorano dentro lo schema («java\tscript:»), meglio rifiutarli
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(text)) return { ok: false, error: 'invalid' };
  let candidate = text;
  let noScheme = false;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[a-z0-9.-]+:\d+(?:[/?#]|$)/i.test(text);
  if (hasScheme) {
    if (!/^https?:/i.test(text)) return { ok: false, error: 'scheme' };
  } else {
    candidate = (text.startsWith('//') ? 'https:' : 'https://') + text;
    noScheme = true;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.hostname === '') return { ok: false, error: 'invalid' };
  return { ok: true, url, noScheme };
}

/**
 * Aggiunge i parametri utm_* all'indirizzo. I parametri già presenti restano (anche altri utm_*); quelli che
 * ricompaiono vengono sovrascritti, senza duplicati; il frammento (#...) resta in fondo. Nessuna richiesta di rete.
 */
export function buildUtmLink(urlText: string, params: UtmParams, options: UtmOptions = DEFAULT_OPTIONS): UtmResult {
  const parsed = parseUrl(urlText);
  if (!parsed.ok) return parsed;
  const warnings: UtmWarning[] = [];
  if (parsed.noScheme) warnings.push({ code: 'noScheme' });
  const { url } = parsed;
  if (url.username !== '' || url.password !== '') warnings.push({ code: 'credentials' });

  const own: [string, string][] = [];
  for (const f of UTM_FIELDS) {
    const raw = (params[f] ?? '').trim();
    if (raw === '') continue;
    if (raw.length > MAX_VALUE) return { ok: false, error: 'valueTooLong' };
    const n = normalizeValue(raw, f, options);
    warnings.push(...n.warnings);
    try {
      own.push([`utm_${f}`, encodeValue(n.value)]);
    } catch {
      return { ok: false, error: 'encoding' };
    }
  }

  const search = url.search;
  const hash = url.hash;
  url.search = '';
  url.hash = '';
  const ownKeys = new Set(own.map(([k]) => k));
  const overwritten: string[] = [];
  const kept: string[] = [];
  for (const seg of search.replace(/^\?/, '').split('&')) {
    if (seg === '') continue;
    const i = seg.indexOf('=');
    const key = safeDecode(i < 0 ? seg : seg.slice(0, i)).toLowerCase();
    if (ownKeys.has(key)) {
      if (!overwritten.includes(key)) overwritten.push(key);
    } else kept.push(seg);
  }
  if (overwritten.length > 0) warnings.push({ code: 'overwritten', names: overwritten });
  const tracking = [...new Set(kept.map((s) => safeDecode(s.split('=')[0]).toLowerCase()).filter((k) => TRACKING_PARAMS.includes(k)))];
  if (tracking.length > 0) warnings.push({ code: 'tracking', names: tracking });

  const queryText = [...kept, ...own.map(([k, v]) => `${k}=${v}`)].join('&');
  const query = parseQuery(queryText);
  for (const f of REQUIRED_FIELDS) {
    if (!query.some(([k]) => k.toLowerCase() === `utm_${f}`)) warnings.push({ code: 'missing', field: f });
  }
  const finalUrl = url.href + (queryText === '' ? '' : '?' + queryText) + hash;
  if (finalUrl.length > LONG_URL) warnings.push({ code: 'urlLong' });
  return { ok: true, url: finalUrl, warnings, query };
}

// --- modalità multipla ---

export interface BulkRow {
  line: number;
  source: string;
  medium: string;
  content: string;
}
export type BulkReason = 'format' | 'empty' | 'tooMany' | 'limit';
export interface BulkError {
  line: number;
  text: string;
  reason: BulkReason;
}

/**
 * Una riga per sorgente: «source,medium[,content]» (anche con «;» o tabulazione) oppure «source medium [content]».
 * Le righe vuote sono ignorate ma contano per la numerazione; ogni riga malformata è segnalata col suo numero.
 */
export function parseBulkLines(text: string): { rows: BulkRow[]; errors: BulkError[] } {
  const rows: BulkRow[] = [];
  const errors: BulkError[] = [];
  text.split(/\r\n|\r|\n/).forEach((raw, idx) => {
    const line = idx + 1;
    const t = raw.trim();
    if (t === '') return;
    if (rows.length >= MAX_BULK_LINES) {
      if (!errors.some((e) => e.reason === 'limit')) errors.push({ line, text: t.slice(0, 60), reason: 'limit' });
      return;
    }
    const sep = t.includes(',') ? ',' : t.includes(';') ? ';' : t.includes('\t') ? '\t' : null;
    const parts = (sep === null ? t.split(/\s+/) : t.split(sep)).map((p) => p.trim());
    if (parts.length < 2) {
      errors.push({ line, text: t.slice(0, 60), reason: 'format' });
    } else if (parts.length > 3) {
      errors.push({ line, text: t.slice(0, 60), reason: 'tooMany' });
    } else if (parts[0] === '' || parts[1] === '') {
      errors.push({ line, text: t.slice(0, 60), reason: 'empty' });
    } else {
      rows.push({ line, source: parts[0], medium: parts[1], content: parts[2] ?? '' });
    }
  });
  return { rows, errors };
}

export interface BulkLink {
  row: BulkRow;
  result: UtmResult;
}

/** Un link per riga, con la stessa campagna; il contenuto della riga, se c'è, sostituisce quello comune. */
export function buildBulk(urlText: string, common: UtmParams, rows: readonly BulkRow[], options: UtmOptions = DEFAULT_OPTIONS): BulkLink[] {
  return rows.map((row) => ({
    row,
    result: buildUtmLink(urlText, { ...common, source: row.source, medium: row.medium, content: row.content !== '' ? row.content : common.content }, options),
  }));
}

// --- CSV ---

/** Cella CSV con virgolette; le celle che inizierebbero una formula (= + - @) ricevono un apostrofo davanti (iniezione di formule in Excel). */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
}

/** CSV con intestazione, una riga per link riuscito (le righe con errore sono omesse), terminatori CRLF. */
export function bulkToCsv(links: readonly BulkLink[], common: UtmParams): string {
  const head = ['source', 'medium', 'campaign', 'term', 'content', 'id', 'url'];
  const lines = [head.join(',')];
  for (const { row, result } of links) {
    if (!result.ok) continue;
    const content = row.content !== '' ? row.content : (common.content ?? '');
    lines.push([row.source, row.medium, common.campaign ?? '', common.term ?? '', content, common.id ?? '', result.url].map((c) => csvCell(c.trim())).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

// --- preset ---

export interface UtmPreset {
  id: string;
  source: string;
  medium: string;
}
export const PRESETS: readonly UtmPreset[] = [
  { id: 'newsletter', source: 'newsletter', medium: 'email' },
  { id: 'facebook', source: 'facebook', medium: 'social' },
  { id: 'instagram', source: 'instagram', medium: 'social' },
  { id: 'linkedin', source: 'linkedin', medium: 'social' },
  { id: 'x', source: 'twitter', medium: 'social' },
  { id: 'googleAds', source: 'google', medium: 'cpc' },
  { id: 'telegram', source: 'telegram', medium: 'social' },
  { id: 'whatsapp', source: 'whatsapp', medium: 'social' },
  { id: 'qr', source: 'qr-code', medium: 'print' },
];
