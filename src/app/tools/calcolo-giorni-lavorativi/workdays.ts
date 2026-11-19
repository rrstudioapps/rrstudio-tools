// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Giorni lavorativi e festività italiane. Logica pura: le date sono numeri interi di giorni dal
 * 1970-01-01 (UTC), così nessun fuso orario né ora legale può spostare un giorno.
 * Indicativo: i giorni festivi aziendali e i contratti collettivi possono prevedere altro.
 */

export type DayNo = number;
export const MIN_YEAR = 1583; // inizio del calendario gregoriano: l'algoritmo di Pasqua vale da qui
export const MAX_YEAR = 9999;
const MS_DAY = 86400000;

/** Giorni dal 1970-01-01 (UTC) di una data del calendario; mese 1-12. */
export function toDayNo(y: number, m: number, d: number): DayNo {
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  t.setUTCHours(0, 0, 0, 0);
  return Math.round(t.getTime() / MS_DAY);
}

export interface Ymd {
  y: number;
  m: number;
  d: number;
}

export function fromDayNo(n: DayNo): Ymd {
  const t = new Date(n * MS_DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** 0 = domenica … 6 = sabato. */
export function weekday(n: DayNo): number {
  return (((n + 4) % 7) + 7) % 7;
}

/** Legge "AAAA-MM-GG" (come l'input date): null se non è una data reale tra il 1583 e il 9999. */
export function parseIso(s: string): DayNo | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  if (y < MIN_YEAR || y > MAX_YEAR || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const n = toDayNo(y, mo, d);
  const back = fromDayNo(n);
  return back.y === y && back.m === mo && back.d === d ? n : null;
}

export function toIso(n: DayNo): string {
  const { y, m, d } = fromDayNo(n);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Domenica di Pasqua (calendario gregoriano) con l'algoritmo di Gauss nella forma di Meeus/Jones/Butcher.
 * Valido dal 1583.
 */
export function easter(year: number): { m: number; d: number } {
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
  return { m: month, d: day };
}

export interface Holiday {
  day: DayNo;
  name: string;
}

/** Festività nazionali italiane dell'anno (Legge 260/1949 e successive), con Pasqua e Lunedì dell'Angelo. */
export function nationalHolidays(year: number): Holiday[] {
  const e = easter(year);
  const pasqua = toDayNo(year, e.m, e.d);
  const fixed: [number, number, string][] = [
    [1, 1, 'Capodanno'],
    [1, 6, 'Epifania'],
    [4, 25, 'Festa della Liberazione'],
    [5, 1, 'Festa del Lavoro'],
    [6, 2, 'Festa della Repubblica'],
    [8, 15, 'Assunzione (Ferragosto)'],
    [11, 1, 'Ognissanti'],
    [12, 8, 'Immacolata Concezione'],
    [12, 25, 'Natale'],
    [12, 26, 'Santo Stefano'],
  ];
  const list: Holiday[] = fixed.map(([m, d, name]) => ({ day: toDayNo(year, m, d), name }));
  list.push({ day: pasqua, name: 'Pasqua' }, { day: pasqua + 1, name: "Lunedì dell'Angelo" });
  return list.sort((a, b) => a.day - b.day);
}

export interface Patron {
  id: string;
  city: string;
  saint: string;
  month: number;
  day: number;
}

/**
 * Santo patrono dei capoluoghi di regione (e di provincia autonoma). FONTE: ricorrenze patronali
 * di uso comune per i comuni; l'elenco è INDICATIVO e DA VERIFICARE: il giorno di festa che vale ai fini
 * lavorativi è quello deliberato dal comune e dal contratto applicato (di solito vale solo nel comune
 * stesso). Venezia (25/4) e Bolzano (15/8) coincidono con una festività nazionale.
 */
export const PATRONS: readonly Patron[] = [
  { id: 'ancona', city: 'Ancona', saint: 'San Ciriaco', month: 5, day: 4 },
  { id: 'aosta', city: 'Aosta', saint: 'San Grato', month: 9, day: 7 },
  { id: 'bari', city: 'Bari', saint: 'San Nicola', month: 12, day: 6 },
  { id: 'bologna', city: 'Bologna', saint: 'San Petronio', month: 10, day: 4 },
  { id: 'bolzano', city: 'Bolzano', saint: 'Maria Assunta', month: 8, day: 15 },
  { id: 'cagliari', city: 'Cagliari', saint: 'San Saturnino', month: 10, day: 30 },
  { id: 'campobasso', city: 'Campobasso', saint: 'San Giorgio', month: 4, day: 23 },
  { id: 'catanzaro', city: 'Catanzaro', saint: 'San Vitaliano', month: 7, day: 16 },
  { id: 'firenze', city: 'Firenze', saint: 'San Giovanni Battista', month: 6, day: 24 },
  { id: 'genova', city: 'Genova', saint: 'San Giovanni Battista', month: 6, day: 24 },
  { id: 'laquila', city: "L'Aquila", saint: "San Massimo d'Aveia", month: 6, day: 10 },
  { id: 'milano', city: 'Milano', saint: 'Sant\'Ambrogio', month: 12, day: 7 },
  { id: 'napoli', city: 'Napoli', saint: 'San Gennaro', month: 9, day: 19 },
  { id: 'palermo', city: 'Palermo', saint: 'Santa Rosalia', month: 7, day: 15 },
  { id: 'perugia', city: 'Perugia', saint: 'San Costanzo', month: 1, day: 29 },
  { id: 'potenza', city: 'Potenza', saint: 'San Gerardo', month: 5, day: 30 },
  { id: 'roma', city: 'Roma', saint: 'Santi Pietro e Paolo', month: 6, day: 29 },
  { id: 'torino', city: 'Torino', saint: 'San Giovanni Battista', month: 6, day: 24 },
  { id: 'trento', city: 'Trento', saint: 'San Vigilio', month: 6, day: 26 },
  { id: 'trieste', city: 'Trieste', saint: 'San Giusto', month: 11, day: 3 },
  { id: 'venezia', city: 'Venezia', saint: 'San Marco', month: 4, day: 25 },
];

export interface DayOptions {
  /** Il sabato non è lavorativo. */
  excludeSaturday: boolean;
  /** La domenica non è lavorativa. */
  excludeSunday: boolean;
  /** Festività nazionali non lavorative. */
  national: boolean;
  /** Id del santo patrono (vedi PATRONS) o '' per nessuno. */
  patron: string;
  /** Data libera extra "AAAA-MM-GG" non lavorativa, o ''. */
  custom: string;
}

export const DEFAULT_OPTIONS: DayOptions = { excludeSaturday: true, excludeSunday: true, national: true, patron: '', custom: '' };

/** Festività (di ogni tipo attivo) dell'anno, per giorno. Se due coincidono resta la prima (nazionale). */
export function holidaysOfYear(year: number, opts: DayOptions): Map<DayNo, string> {
  const map = new Map<DayNo, string>();
  if (opts.national) for (const h of nationalHolidays(year)) map.set(h.day, h.name);
  const p = PATRONS.find((x) => x.id === opts.patron);
  if (p) {
    const day = toDayNo(year, p.month, p.day);
    if (!map.has(day)) map.set(day, `Santo patrono di ${p.city} (${p.saint})`);
  }
  const c = parseIso(opts.custom);
  if (c !== null && fromDayNo(c).y === year && !map.has(c)) map.set(c, 'Data libera');
  return map;
}

class HolidayCache {
  private readonly years = new Map<number, Map<DayNo, string>>();
  constructor(private readonly opts: DayOptions) {}
  get(day: DayNo): string | undefined {
    const y = fromDayNo(day).y;
    let m = this.years.get(y);
    if (!m) {
      m = holidaysOfYear(y, this.opts);
      this.years.set(y, m);
    }
    return m.get(day);
  }
}

function isExcludedWeekend(day: DayNo, opts: DayOptions): boolean {
  const w = weekday(day);
  return (w === 6 && opts.excludeSaturday) || (w === 0 && opts.excludeSunday);
}

export interface HolidayHit {
  day: DayNo;
  name: string;
}

export interface RangeResult {
  calendarDays: number;
  workdays: number;
  /** Sabati e domeniche esclusi che cadono nell'intervallo. */
  weekendDays: number;
  /** Festività cadute in giorni che sarebbero lavorativi. */
  holidays: HolidayHit[];
}

/**
 * Giorni tra due date. La data iniziale è sempre inclusa; quella finale solo se `includeEnd`.
 * Con `end < start` restituisce null.
 */
export function countRange(start: DayNo, end: DayNo, includeEnd: boolean, opts: DayOptions): RangeResult | null {
  if (end < start) return null;
  const last = includeEnd ? end : end - 1;
  const cache = new HolidayCache(opts);
  let calendarDays = 0;
  let weekendDays = 0;
  let workdays = 0;
  const holidays: HolidayHit[] = [];
  for (let d = start; d <= last; d++) {
    calendarDays++;
    if (isExcludedWeekend(d, opts)) {
      weekendDays++;
      continue;
    }
    const name = cache.get(d);
    if (name) {
      holidays.push({ day: d, name });
      continue;
    }
    workdays++;
  }
  return { calendarDays, workdays, weekendDays, holidays };
}

export interface AddResult {
  result: DayNo;
  /** Festività saltate lungo il percorso (cadute in giorni altrimenti lavorativi). */
  skipped: HolidayHit[];
  /** Vero se la data di partenza non è lavorativa (il conteggio parte comunque dal giorno dopo/prima). */
  startNotWorking: boolean;
}

export const MAX_ADD = 20000;

/**
 * Aggiunge (n > 0) o toglie (n < 0) `n` giorni lavorativi a una data. La data di partenza non si conta
 * (come WORKDAY di Excel): da lunedì, +1 dà martedì. Con n = 0 restituisce la data di partenza.
 */
export function addWorkdays(start: DayNo, n: number, opts: DayOptions): AddResult | null {
  if (!Number.isInteger(n) || Math.abs(n) > MAX_ADD) return null;
  const cache = new HolidayCache(opts);
  const working = (d: DayNo): boolean => !isExcludedWeekend(d, opts) && !cache.get(d);
  const step = n >= 0 ? 1 : -1;
  const skipped: HolidayHit[] = [];
  let left = Math.abs(n);
  let d = start;
  while (left > 0) {
    d += step;
    if (isExcludedWeekend(d, opts)) continue;
    const name = cache.get(d);
    if (name) {
      skipped.push({ day: d, name });
      continue;
    }
    left--;
    // fuori dai limiti del calendario gestito
    if (fromDayNo(d).y > MAX_YEAR || fromDayNo(d).y < MIN_YEAR) return null;
  }
  return { result: d, skipped, startNotWorking: !working(start) };
}

const WEEKDAYS_IT = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export function weekdayName(n: DayNo): string {
  return WEEKDAYS_IT[weekday(n)];
}

const MONTHS_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
/** "lunedì 6 aprile 2026" (senza Intl: il risultato è identico in ogni browser). */
export function formatDate(n: DayNo, withWeekday = true): string {
  const { y, m, d } = fromDayNo(n);
  const base = `${d} ${MONTHS_IT[m - 1]} ${y}`;
  return withWeekday ? `${weekdayName(n)} ${base}` : base;
}
