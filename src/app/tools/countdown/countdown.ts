// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Fuso: «local» = quello del dispositivo, altrimenti un nome IANA. */
export type Zone = string;

/** Fusi proposti oltre a quello locale del dispositivo. */
export const ZONES: readonly string[] = ['Europe/Rome', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'America/Los_Angeles', 'Australia/Sydney'];

/** Data civile (senza fuso) con l'ora, come la scrive una persona. */
export interface Wall {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

export interface Ymd {
  y: number;
  m: number;
  d: number;
}

const MS_H = 3_600_000;
const MS_D = 86_400_000;
export const MIN_YEAR = 1970;
export const MAX_YEAR = 2100;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    formatters.set(zone, f);
  }
  return f;
}

/** Data e ora civili di un istante nel fuso dato. */
export function wallOf(ms: number, zone: Zone): Wall {
  if (zone === 'local') {
    const t = new Date(ms);
    return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate(), h: t.getHours(), mi: t.getMinutes(), s: t.getSeconds() };
  }
  const p: Record<string, number> = {};
  for (const part of formatter(zone).formatToParts(ms)) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return { y: p['year'], m: p['month'], d: p['day'], h: (p['hour'] ?? 0) % 24, mi: p['minute'], s: p['second'] };
}

/** Differenza (ms) tra l'ora civile e l'istante UTC nel fuso dato, a quell'istante. */
function offsetAt(ms: number, zone: Zone): number {
  const w = wallOf(ms, zone);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000;
}

/**
 * Istante corrispondente a una data civile nel fuso dato. Nell'ora che non esiste (salto in avanti) dà
 * l'istante dopo il salto; nell'ora doppia (ritorno indietro) sceglie la prima.
 */
export function wallToMs(w: Wall, zone: Zone): number {
  if (zone === 'local') {
    const t = new Date(2000, 0, 1, w.h, w.mi, w.s);
    t.setFullYear(w.y, w.m - 1, w.d);
    return t.getTime();
  }
  const guess = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  const off1 = offsetAt(guess, zone);
  const t1 = guess - off1;
  const off2 = offsetAt(t1, zone);
  return off2 === off1 ? t1 : guess - off2;
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

/** «AAAA-MM-GGTHH:mm», il formato del campo `datetime-local`. */
export function formatWall(w: Wall): string {
  return `${pad(w.y, 4)}-${pad(w.m)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}`;
}

/** Legge «AAAA-MM-GGTHH:mm[:ss]»; null se non è una data esistente tra il 1970 e il 2100. */
export function parseWall(text: string): Wall | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  if (y < MIN_YEAR || y > MAX_YEAR || h > 23 || mi > 59 || s > 59) return null;
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { y, m: mo, d, h, mi, s };
}

/** Somma `n` giorni di calendario mantenendo l'ora civile. */
export function addDays(w: Wall, n: number): Wall {
  const t = new Date(Date.UTC(w.y, w.m - 1, w.d + n, w.h, w.mi, w.s));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), s: t.getUTCSeconds() };
}

const dayNumber = (x: Ymd) => Math.round(Date.UTC(x.y, x.m - 1, x.d) / MS_D);

/**
 * Giorni lavorativi (lunedì-venerdì, senza festività) dopo la data `from` fino alla data `to` inclusa:
 * da venerdì a lunedì ne conta 1. 0 se `to` non è dopo `from`.
 */
export function workingDaysBetween(from: Ymd, to: Ymd): number {
  const a = dayNumber(from);
  const n = dayNumber(to) - a;
  if (n <= 0) return 0;
  let count = Math.floor(n / 7) * 5;
  for (let i = 1; i <= n % 7; i++) {
    // giorno della settimana: il 1/1/1970 era giovedì (4); 0 = domenica
    const wd = (((a + n - (n % 7) + i + 4) % 7) + 7) % 7;
    if (wd !== 0 && wd !== 6) count++;
  }
  return count;
}

export interface Breakdown {
  /** future = manca tempo; now = istante raggiunto; past = già passato. */
  state: 'future' | 'now' | 'past';
  /** Giorni di calendario interi tra i due istanti (un giorno dura 23 o 25 ore al cambio dell'ora legale). */
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Settimane approssimate a un decimale. */
  weeks: number;
  /** Ore realmente trascorse, intere. */
  totalHours: number;
  /** Giorni lavorativi tra le due date (vedi `workingDaysBetween`). */
  workingDays: number;
}

/**
 * Scompone la distanza tra `target` e `now` (istanti in ms) in giorni di calendario, ore, minuti e secondi,
 * sempre in positivo; `state` dice se è futuro o passato. I giorni si contano sull'ora civile del fuso
 * (così il passaggio all'ora legale non sposta l'ora del giorno), il resto è tempo reale.
 */
export function breakdown(target: number, now: number, zone: Zone = 'local'): Breakdown {
  const state = target > now ? 'future' : target < now ? 'past' : 'now';
  const a = Math.min(target, now);
  const b = Math.max(target, now);
  const wa = wallOf(a, zone);
  const frac = a - Math.floor(a / 1000) * 1000; // wallOf scarta i millisecondi
  const at = (k: number) => wallToMs(addDays(wa, k), zone) + frac;
  let k = Math.floor((b - a) / MS_D);
  while (at(k + 1) <= b) k++;
  while (k > 0 && at(k) > b) k--;
  const rem = b - at(k);
  const hours = Math.floor(rem / MS_H);
  const minutes = Math.floor((rem % MS_H) / 60_000);
  const seconds = Math.floor((rem % 60_000) / 1000);
  return {
    state,
    days: k,
    hours,
    minutes,
    seconds,
    weeks: Math.round(((k + rem / MS_D) / 7) * 10) / 10,
    totalHours: Math.floor((b - a) / MS_H),
    workingDays: workingDaysBetween(wa, wallOf(b, zone)),
  };
}

/** Pasqua gregoriana (algoritmo di Meeus-Jones-Butcher). */
export function easter(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

export const HOLIDAYS = ['newyear', 'epiphany', 'easter', 'easterMonday', 'liberation', 'labour', 'republic', 'ferragosto', 'halloween', 'christmas', 'stephen', 'nye'] as const;
export type HolidayId = (typeof HOLIDAYS)[number];

function holidayDate(id: HolidayId, year: number): { month: number; day: number } {
  switch (id) {
    case 'newyear': return { month: 1, day: 1 };
    case 'epiphany': return { month: 1, day: 6 };
    case 'easter': return easter(year);
    case 'easterMonday': {
      const e = easter(year);
      const t = new Date(Date.UTC(year, e.month - 1, e.day + 1));
      return { month: t.getUTCMonth() + 1, day: t.getUTCDate() };
    }
    case 'liberation': return { month: 4, day: 25 };
    case 'labour': return { month: 5, day: 1 };
    case 'republic': return { month: 6, day: 2 };
    case 'ferragosto': return { month: 8, day: 15 };
    case 'halloween': return { month: 10, day: 31 };
    case 'christmas': return { month: 12, day: 25 };
    case 'stephen': return { month: 12, day: 26 };
    case 'nye': return { month: 12, day: 31 };
  }
}

/** Prossima occorrenza della ricorrenza, alle 00:00 del fuso: la prima il cui istante è dopo `now`. */
export function nextOccurrence(id: HolidayId, now: number, zone: Zone = 'local'): string {
  const year = wallOf(now, zone).y;
  for (let y = year; y <= year + 1; y++) {
    const { month, day } = holidayDate(id, y);
    const w: Wall = { y, m: month, d: day, h: 0, mi: 0, s: 0 };
    if (wallToMs(w, zone) > now) return formatWall(w);
  }
  /* c'è sempre una occorrenza nell'anno successivo */
  throw new Error('nextOccurrence: nessuna occorrenza');
}

// --- calendario (.ics) --------------------------------------------------------------------------------------

/** Testo di un valore iCalendar: escape di barra, punto e virgola, virgola e a capo (RFC 5545 §3.3.11). */
export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

/** Piega la riga a 75 ottetti, con continuazione che comincia da uno spazio (RFC 5545 §3.1). */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
      limit = 74; // lo spazio iniziale occupa un ottetto
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function icsStamp(w: Wall): string {
  return `${pad(w.y, 4)}${pad(w.m)}${pad(w.d)}T${pad(w.h)}${pad(w.mi)}${pad(w.s)}`;
}

/**
 * Evento di un'ora che inizia alla data indicata. Nel fuso locale l'orario è «fluttuante» (senza fuso, vale
 * quello del calendario di chi lo apre); con un fuso IANA è convertito in UTC.
 */
export function buildIcs(opts: { summary: string; wall: Wall; zone: Zone; now: number }): string {
  const { summary, wall, zone, now } = opts;
  let start: string;
  let end: string;
  if (zone === 'local') {
    start = icsStamp(wall);
    end = icsStamp(addDays({ ...wall, h: wall.h + 1 }, 0));
  } else {
    const ms = wallToMs(wall, zone);
    start = icsStamp(wallOf(ms, 'UTC')) + 'Z';
    end = icsStamp(wallOf(ms + MS_H, 'UTC')) + 'Z';
  }
  const stamp = icsStamp(wallOf(now, 'UTC')) + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//rrstudio Tools//Countdown//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${start}-${stamp}@rrstudio-tools`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
