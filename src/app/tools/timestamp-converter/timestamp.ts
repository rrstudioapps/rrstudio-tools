// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Conversioni tra timestamp Unix e date, con fusi orari e cambi d'ora gestiti da Intl. */

export type Unit = 's' | 'ms' | 'us' | 'ns';
export type UnitChoice = Unit | 'auto';
export const UNITS: readonly Unit[] = ['s', 'ms', 'us', 'ns'];

/** Si formatta solo tra gli anni 0001 e 9999 (fuori, gli anni di Intl e l'ISO 8601 base non sono affidabili). */
export const MIN_MS = -62135596800000;
export const MAX_MS = 253402300799999;

const UNIT_FACTOR: Record<Unit, bigint> = { s: 1000n, ms: 1n, us: 1n, ns: 1n };
const UNIT_DIVISOR: Record<Unit, bigint> = { s: 1n, ms: 1n, us: 1000n, ns: 1000000n };

/** Divisione intera con arrotondamento verso il basso (BigInt tronca verso lo zero). */
function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
}

/** Unità dedotta dall'ordine di grandezza: < 1e11 secondi, < 1e14 ms, < 1e17 µs, altrimenti ns. */
export function detectUnit(abs: bigint): Unit {
  if (abs < 100_000_000_000n) return 's';
  if (abs < 100_000_000_000_000n) return 'ms';
  if (abs < 100_000_000_000_000_000n) return 'us';
  return 'ns';
}

export type ParsedTimestamp =
  | { ok: true; ms: number; unit: Unit; auto: boolean }
  | { ok: false; error: 'empty' | 'format' | 'range' };

const NUMBER_RE = /^[+-]?\d+(?:[.,]\d+)?$/;

/** Legge un timestamp (anche con segno e decimali, es. 1700000000.5) e lo porta in millisecondi interi (arrotondati per difetto). */
export function parseTimestamp(text: string, choice: UnitChoice = 'auto'): ParsedTimestamp {
  const t = text.trim().replace(/[\s_']/g, '');
  if (t === '') return { ok: false, error: 'empty' };
  if (!NUMBER_RE.test(t)) return { ok: false, error: 'format' };
  const neg = t.startsWith('-');
  const [intPart, fracPart = ''] = t.replace(/^[+-]/, '').replace(',', '.').split('.');
  const intVal = BigInt(intPart);
  const unit = choice === 'auto' ? detectUnit(intVal) : choice;
  // intero scalato a ms con la parte decimale (fino a 9 cifre) come frazione dell'unità
  const frac = BigInt((fracPart + '000000000').slice(0, 9));
  const scale = 1_000_000_000n;
  const total = (intVal * scale + frac) * (neg ? -1n : 1n); // unità × 1e9
  const ms = floorDiv(total * UNIT_FACTOR[unit], scale * UNIT_DIVISOR[unit]);
  if (ms < BigInt(MIN_MS) || ms > BigInt(MAX_MS)) return { ok: false, error: 'range' };
  return { ok: true, ms: Number(ms), unit, auto: choice === 'auto' };
}

/** Timestamp dell'istante nell'unità data, come stringa (BigInt: i nanosecondi superano 2^53). */
export function msToTimestamp(ms: number, unit: Unit): string {
  const v = BigInt(Math.floor(ms));
  switch (unit) {
    case 's':
      return floorDiv(v, 1000n).toString();
    case 'ms':
      return v.toString();
    case 'us':
      return (v * 1000n).toString();
    case 'ns':
      return (v * 1000000n).toString();
  }
}

// ---------------- fusi orari ----------------

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function parts(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export interface Fields {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

/** Campi della data così come si leggono in un fuso orario. */
export function fieldsIn(ms: number, tz: string): Fields {
  const p: Record<string, number> = {};
  for (const part of parts(tz).formatToParts(ms)) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return {
    year: p['year'],
    month: p['month'],
    day: p['day'],
    hour: p['hour'] === 24 ? 0 : p['hour'],
    minute: p['minute'],
    second: p['second'],
    millisecond: ((ms % 1000) + 1000) % 1000,
  };
}

const utcMs = (f: Fields): number => {
  const d = new Date(0);
  d.setUTCFullYear(f.year, f.month - 1, f.day);
  d.setUTCHours(f.hour, f.minute, f.second, f.millisecond);
  return d.getTime();
};

/** Scarto dal UTC (in minuti, + a est di Greenwich) del fuso nell'istante dato: Europe/Rome in estate = 120. */
export function offsetMinutes(ms: number, tz: string): number {
  if (tz === 'UTC') return 0;
  const f = fieldsIn(ms, tz);
  const local = utcMs({ ...f, millisecond: 0 });
  const real = Math.floor(ms / 1000) * 1000;
  return Math.round((local - real) / 60000);
}

const pad = (n: number, w = 2): string => String(Math.abs(n)).padStart(w, '0');

function offsetText(min: number, colon: boolean): string {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  return `${sign}${pad(Math.floor(a / 60))}${colon ? ':' : ''}${pad(a % 60)}`;
}

/** ISO 8601 con scarto: 2026-03-29T03:00:00.000+02:00 (Z per UTC). */
export function formatIso(ms: number, tz: string): string {
  const f = fieldsIn(ms, tz);
  const base = `${pad(f.year, 4)}-${pad(f.month)}-${pad(f.day)}T${pad(f.hour)}:${pad(f.minute)}:${pad(f.second)}.${pad(f.millisecond, 3)}`;
  return tz === 'UTC' ? base + 'Z' : base + offsetText(offsetMinutes(ms, tz), true);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** RFC 2822: Sun, 29 Mar 2026 03:00:00 +0200 (sempre in inglese, come da standard). */
export function formatRfc2822(ms: number, tz: string): string {
  const f = fieldsIn(ms, tz);
  const weekday = new Date(utcMs({ ...f, hour: 12, minute: 0, second: 0, millisecond: 0 })).getUTCDay();
  return `${DAYS[weekday]}, ${pad(f.day)} ${MONTHS[f.month - 1]} ${pad(f.year, 4)} ${pad(f.hour)}:${pad(f.minute)}:${pad(f.second)} ${offsetText(tz === 'UTC' ? 0 : offsetMinutes(ms, tz), false)}`;
}

/** Formato leggibile nella lingua dell'utente (Intl), con il nome del fuso. */
export function formatLocale(ms: number, tz: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'long', timeZone: tz }).format(ms);
}

/** Elenco dei fusi orari del browser, con UTC in testa. */
export function timeZoneList(): string[] {
  let list: string[] = [];
  try {
    list = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    list = [];
  }
  return ['UTC', ...list.filter((z) => z !== 'UTC')];
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ---------------- data → timestamp ----------------

export type DateStatus = 'ok' | 'ambiguous' | 'gap';

export type ParsedDate =
  | {
      ok: true;
      ms: number;
      status: DateStatus;
      /** Tutti gli istanti possibili (due se l'ora locale ricorre due volte per il cambio all'ora solare). */
      candidates: number[];
      /** Vero se il testo conteneva già Z o uno scarto: il fuso scelto non conta. */
      explicitOffset: boolean;
    }
  | { ok: false; error: 'empty' | 'format' | 'range' };

const DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

/**
 * Istanti possibili per un'ora locale in un fuso: uno di norma, due se ricorre (fine ora legale),
 * nessuno se non esiste (inizio ora legale).
 */
export function localToInstants(f: Fields, tz: string): number[] {
  const wall = utcMs(f);
  if (tz === 'UTC') return [wall];
  const day = 86_400_000;
  const found = new Set<number>();
  for (const off of new Set([offsetMinutes(wall - day, tz), offsetMinutes(wall + day, tz), offsetMinutes(wall, tz)])) {
    const cand = wall - off * 60000;
    if (offsetMinutes(cand, tz) === off) found.add(cand);
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * Legge una data ISO (`2026-03-29 02:30:00`, con o senza `T`, secondi e millisecondi opzionali) nel fuso dato.
 * Un'ora che ricorre due volte (fine ora legale) dà la prima occorrenza e `status: 'ambiguous'`;
 * un'ora che non esiste (inizio ora legale) viene spostata in avanti e dà `status: 'gap'`.
 */
export function parseDate(text: string, tz: string): ParsedDate {
  const t = text.trim();
  if (t === '') return { ok: false, error: 'empty' };
  const m = DATE_RE.exec(t);
  if (!m) return { ok: false, error: 'format' };
  const f: Fields = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4] ?? 0),
    minute: Number(m[5] ?? 0),
    second: Number(m[6] ?? 0),
    millisecond: Number(((m[7] ?? '') + '000').slice(0, 3)),
  };
  if (f.year < 1 || f.month < 1 || f.month > 12 || f.hour > 23 || f.minute > 59 || f.second > 59) return { ok: false, error: 'format' };
  const daysInMonth = new Date(Date.UTC(2000 + (f.year % 400), f.month, 0)).getUTCDate();
  if (f.day < 1 || f.day > daysInMonth) return { ok: false, error: 'format' };

  if (m[8]) {
    const z = m[8].toUpperCase();
    let off = 0;
    if (z !== 'Z') {
      const digits = z.slice(1).replace(':', '');
      off = (z[0] === '-' ? -1 : 1) * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2) || 0));
    }
    const ms = utcMs(f) - off * 60000;
    if (ms < MIN_MS || ms > MAX_MS) return { ok: false, error: 'range' };
    return { ok: true, ms, status: 'ok', candidates: [ms], explicitOffset: true };
  }

  const found = localToInstants(f, tz);
  let status: DateStatus = 'ok';
  let ms: number;
  if (found.length === 0) {
    // ora inesistente: come fa Date, si usa lo scarto di prima del salto (l'istante cade dopo il salto)
    const before = offsetMinutes(utcMs(f) - 86_400_000, tz);
    ms = utcMs(f) - before * 60000;
    status = 'gap';
    found.push(ms);
  } else {
    ms = found[0];
    if (found.length > 1) status = 'ambiguous';
  }
  if (ms < MIN_MS || ms > MAX_MS) return { ok: false, error: 'range' };
  return { ok: true, ms, status, candidates: found, explicitOffset: false };
}

// ---------------- relativo ----------------

export interface RelativeParts {
  value: number;
  unit: Intl.RelativeTimeFormatUnit;
}

/** Distanza da `nowMs` nell'unità più naturale (secondi, minuti, ore, giorni, mesi, anni), per Intl.RelativeTimeFormat. */
export function relativeParts(ms: number, nowMs: number): RelativeParts {
  const diff = (ms - nowMs) / 1000;
  const abs = Math.abs(diff);
  const steps: [Intl.RelativeTimeFormatUnit, number, number][] = [
    ['second', 1, 60],
    ['minute', 60, 3600],
    ['hour', 3600, 86400],
    ['day', 86400, 86400 * 30],
    ['month', 86400 * 30, 86400 * 365],
  ];
  for (const [unit, size, limit] of steps) {
    const value = Math.round(diff / size);
    // se l'arrotondamento raggiunge il limite si passa all'unità successiva (59,6 s → 1 minuto)
    if (Math.abs(value) * size < limit && abs < limit) return { value: value || 0, unit };
  }
  return { value: Math.round(diff / (86400 * 365)), unit: 'year' };
}

export function formatRelative(ms: number, nowMs: number, locale: string): string {
  const { value, unit } = relativeParts(ms, nowMs);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit);
}

// ---------------- più timestamp insieme ----------------

export interface BatchRow {
  line: number;
  input: string;
  result: ParsedTimestamp;
}

export const MAX_BATCH = 2000;

/** Un timestamp per riga; le righe vuote si saltano. */
export function parseBatch(text: string, choice: UnitChoice): { rows: BatchRow[]; truncated: boolean } {
  const rows: BatchRow[] = [];
  const lines = text.split(/\r?\n/);
  let truncated = false;
  lines.forEach((raw, i) => {
    if (raw.trim() === '') return;
    if (rows.length >= MAX_BATCH) {
      truncated = true;
      return;
    }
    rows.push({ line: i + 1, input: raw.trim(), result: parseTimestamp(raw, choice) });
  });
  return { rows, truncated };
}
