// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Conversione tra fusi orari IANA usando solo Intl: nessun database dei fusi è incluso, l'elenco viene
 * da Intl.supportedValuesOf('timeZone') e gli spostamenti (ora legale compresa) dal motore del browser.
 */

export interface LocalTime {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
}

/** Uso di un fuso non valido o sconosciuto dal motore. */
export function isValidZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Elenco dei fusi del motore più "UTC"; senza supporto restituisce un elenco minimo. */
export function listZones(): string[] {
  let zones: string[] = [];
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (fn) zones = fn.call(Intl, 'timeZone');
  } catch {
    zones = [];
  }
  if (!zones.length) {
    zones = ['Europe/Rome', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney'];
  }
  return zones.includes('UTC') ? zones : [...zones, 'UTC'];
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    });
    formatterCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts extends LocalTime {
  s: number;
  /** 0 = domenica … 6 = sabato. */
  weekday: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Ora locale del fuso nell'istante `ms`. */
export function partsInZone(ms: number, tz: string): ZonedParts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(ms)) out[p.type] = p.value;
  return {
    y: Number(out['year']),
    m: Number(out['month']),
    d: Number(out['day']),
    h: Number(out['hour']) % 24,
    mi: Number(out['minute']),
    s: Number(out['second']),
    weekday: WEEKDAYS.indexOf(out['weekday']),
  };
}

/** Scarto dal UTC in minuti (positivo a est) del fuso nell'istante `ms`. */
export function offsetMinutes(tz: string, ms: number): number {
  const p = partsInZone(ms, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  // ms troncato al secondo: gli istanti con millisecondi non falsano lo scarto
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

export type ResolveStatus = 'ok' | 'gap' | 'ambiguous';

export interface Resolved {
  ms: number;
  status: ResolveStatus;
}

/**
 * Ora locale di un fuso → istante UTC.
 * - Ora inesistente (salto in avanti dell'ora legale): si usa lo scarto di prima del salto, quindi l'ora scivola avanti
 *   (02:30 → 03:30), stato "gap".
 * - Ora doppia (ritorno all'ora solare): si sceglie la prima occorrenza (quella con ora legale), stato "ambiguous".
 */
export function zonedToInstant(tz: string, t: LocalTime): Resolved {
  const asUtc = Date.UTC(t.y, t.m - 1, t.d, t.h, t.mi);
  const DAY = 86_400_000;
  const before = offsetMinutes(tz, asUtc - DAY);
  const after = offsetMinutes(tz, asUtc + DAY);
  const candidates = new Set<number>();
  for (const off of new Set([before, after])) {
    const ms = asUtc - off * 60000;
    if (offsetMinutes(tz, ms) === off) candidates.add(ms);
  }
  if (candidates.size === 0) return { ms: asUtc - before * 60000, status: 'gap' };
  const sorted = [...candidates].sort((a, b) => a - b);
  return { ms: sorted[0], status: sorted.length > 1 ? 'ambiguous' : 'ok' };
}

/** Ora legale in vigore: lo scarto supera quello "standard", cioè il minore tra gennaio e luglio dello stesso anno. */
export function isDst(tz: string, ms: number): boolean {
  const y = partsInZone(ms, tz).y;
  const jan = offsetMinutes(tz, Date.UTC(y, 0, 1));
  const jul = offsetMinutes(tz, Date.UTC(y, 6, 1));
  if (jan === jul) return false;
  return offsetMinutes(tz, ms) > Math.min(jan, jul);
}

/** 330 → "UTC+05:30"; −210 → "UTC-03:30"; 0 → "UTC+00:00". */
export function formatOffset(min: number): string {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/** "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export function cityOf(tz: string): string {
  return (tz.split('/').pop() ?? tz).replace(/_/g, ' ');
}

/** "America/Argentina/Buenos_Aires" → "America / Argentina". */
export function regionOf(tz: string): string {
  const parts = tz.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join(' / ').replace(/_/g, ' ') : '';
}

const nameFormatters = new Map<string, Intl.DateTimeFormat>();

/** Formatter per il nome del fuso, in cache: crearne ~400 a ogni tasto nella ricerca sarebbe lento. */
function nameFormatter(tz: string, locale: string, style: 'long' | 'short'): Intl.DateTimeFormat {
  const key = `${locale}|${tz}|${style}`;
  let f = nameFormatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: style });
    nameFormatters.set(key, f);
  }
  return f;
}

/** Nome esteso del fuso nella lingua (es. "Central European Standard Time"); '' se non disponibile. */
export function zoneLongName(tz: string, ms: number, locale: string): string {
  try {
    const p = nameFormatter(tz, locale, 'long').formatToParts(ms);
    return p.find((x) => x.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

/** Sigla breve del fuso (CET, EDT, GMT+9…). */
export function zoneShortName(tz: string, ms: number, locale: string): string {
  try {
    const p = nameFormatter(tz, locale, 'short').formatToParts(ms);
    return p.find((x) => x.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

/** Nomi comuni italiani e inglesi delle città più cercate, il cui nome non coincide con quello IANA. */
const CITY_ALIASES: Record<string, string> = {
  'Europe/Rome': 'roma rome italia italy',
  'Europe/London': 'londra london regno unito uk',
  'Europe/Paris': 'parigi paris francia',
  'Europe/Berlin': 'berlino berlin germania germany',
  'Europe/Madrid': 'spagna spain',
  'Europe/Lisbon': 'lisbona lisbon portogallo',
  'Europe/Vienna': 'vienna wien austria',
  'Europe/Zurich': 'zurigo zurich svizzera switzerland',
  'Europe/Brussels': 'bruxelles brussels belgio',
  'Europe/Athens': 'atene athens grecia greece',
  'Europe/Moscow': 'mosca moscow russia',
  'Europe/Prague': 'praga prague',
  'Europe/Warsaw': 'varsavia warsaw polonia',
  'Europe/Copenhagen': 'copenaghen copenhagen danimarca',
  'Europe/Stockholm': 'stoccolma stockholm svezia',
  'Europe/Dublin': 'dublino dublin irlanda',
  'Europe/Istanbul': 'istanbul turchia turkey ankara',
  'Europe/Kyiv': 'kiev kyiv ucraina ukraine',
  'Africa/Cairo': 'il cairo cairo egitto egypt',
  'Africa/Johannesburg': 'sudafrica south africa citta del capo cape town',
  'Asia/Shanghai': 'pechino beijing cina china',
  'Asia/Kolkata': 'kolkata calcutta delhi nuova delhi new delhi mumbai bombay india',
  // il motore V8 elenca ancora i nomi storici: stessi alias
  'Asia/Calcutta': 'kolkata calcutta delhi nuova delhi new delhi mumbai bombay india',
  'Europe/Kiev': 'kiev kyiv ucraina ukraine',
  'Asia/Tokyo': 'giappone japan',
  'Asia/Seoul': 'seul corea korea',
  'Asia/Dubai': 'emirati uae',
  'Asia/Bangkok': 'tailandia thailand',
  'Asia/Jerusalem': 'gerusalemme jerusalem israele israel tel aviv',
  'America/New_York': 'new york nyc boston washington miami est eastern',
  'America/Chicago': 'central cst',
  'America/Denver': 'mountain mst',
  'America/Los_Angeles': 'san francisco seattle pst pacific california',
  'America/Mexico_City': 'citta del messico messico mexico',
  'America/Sao_Paulo': 'san paolo brasile brazil rio',
  'America/Argentina/Buenos_Aires': 'argentina',
  'America/Buenos_Aires': 'argentina',
  'Pacific/Honolulu': 'hawaii',
  'Australia/Sydney': 'australia melbourne canberra',
  'Pacific/Auckland': 'nuova zelanda new zealand',
  UTC: 'utc gmt zulu tempo coordinato universale',
};

/** Normalizza per la ricerca: minuscolo, senza accenti, spazi al posto di _ e /. */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cerca fusi per città, regione, nome comune o nome esteso del fuso. Prima i nomi che iniziano con la ricerca,
 * poi quelli che la contengono. Il nome esteso (più costoso da ottenere) si usa solo se serve.
 */
export function searchZones(query: string, zones: readonly string[], locale = 'en-GB', limit = 10): string[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const z of zones) {
    const city = normalizeSearch(cityOf(z));
    const alias = normalizeSearch(CITY_ALIASES[z] ?? '');
    // "starts": la città o una parola dei nomi comuni comincia con la ricerca
    if (city.startsWith(q) || (' ' + alias).includes(' ' + q)) starts.push(z);
    else if ((normalizeSearch(z) + ' ' + alias).includes(q)) contains.push(z);
  }
  let out = [...starts, ...contains];
  if (out.length < 3 && q.length >= 3) {
    const now = Date.now();
    for (const z of zones) {
      if (out.includes(z)) continue;
      if (normalizeSearch(zoneLongName(z, now, locale)).includes(q)) out.push(z);
      if (out.length >= limit) break;
    }
  }
  out = out.slice(0, limit);
  return out;
}
