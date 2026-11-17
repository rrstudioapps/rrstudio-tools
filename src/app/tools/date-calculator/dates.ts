// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Calcoli sulle date di calendario (calendario gregoriano proletticato), indipendenti dal fuso orario e
 * dall'ora legale: ogni data è una terna anno-mese-giorno e i giorni si contano con un numero progressivo.
 * Regole di fine mese: aggiungere mesi a un giorno che nel mese di arrivo non esiste porta all'ultimo giorno
 * (31 gennaio + 1 mese = 28 o 29 febbraio); 29 febbraio + 1 anno = 28 febbraio.
 */

export interface Ymd {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
}

export const MIN_YEAR = 1;
export const MAX_YEAR = 9999;

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** Giorni dal 1970-01-01 (negativi prima), algoritmo del calendario civile di Howard Hinnant. */
export function toDays({ y, m, d }: Ymd): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromDays(z: number): Ymd {
  const n = z + 719468;
  const era = Math.floor(n / 146097);
  const doe = n - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

/** Giorno della settimana: 0 = domenica … 6 = sabato. */
export function weekday(date: Ymd): number {
  return (((toDays(date) + 4) % 7) + 7) % 7; // il 1970-01-01 era giovedì
}

/** "YYYY-MM-DD" (valore di <input type="date">) → data valida, altrimenti null. */
export function parseIso(s: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < MIN_YEAR || y > MAX_YEAR || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return { y, m: mo, d };
}

export function formatIso({ y, m, d }: Ymd): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function compareDates(a: Ymd, b: Ymd): number {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

export function addDays(date: Ymd, days: number): Ymd {
  return fromDays(toDays(date) + days);
}

/** Somma (o sottrae, se negativo) mesi interi con la regola di fine mese. */
export function addMonths(date: Ymd, months: number): Ymd {
  const total = date.y * 12 + (date.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = (((total % 12) + 12) % 12) + 1;
  return { y, m, d: Math.min(date.d, daysInMonth(y, m)) };
}

export interface Interval {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
}

export type AddError = 'range';

/**
 * Aggiunge (sign = 1) o toglie (sign = −1) un intervallo: prima anni e mesi, poi settimane e giorni.
 * Fuori dagli anni 1-9999 restituisce null.
 */
export function addInterval(date: Ymd, iv: Interval, sign: 1 | -1): Ymd | null {
  const months = ((iv.years ?? 0) * 12 + (iv.months ?? 0)) * sign;
  const days = ((iv.weeks ?? 0) * 7 + (iv.days ?? 0)) * sign;
  if (!Number.isFinite(months) || !Number.isFinite(days)) return null;
  const monthsOut = addMonths(date, months);
  if (monthsOut.y < MIN_YEAR || monthsOut.y > MAX_YEAR) return null;
  const out = addDays(monthsOut, days);
  return out.y < MIN_YEAR || out.y > MAX_YEAR ? null : out;
}

export interface Difference {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  /** Settimane intere e giorni che avanzano. */
  weeks: number;
  weekDays: number;
  /** Mesi interi in totale (anni × 12 + mesi). */
  totalMonths: number;
  /** La prima data è successiva alla seconda (le due sono state scambiate). */
  swapped: boolean;
}

/**
 * Differenza tra due date: anni, mesi e giorni di calendario più il totale dei giorni.
 * Si contano i mesi interi che si possono aggiungere alla data più vecchia restando entro la più recente (con la
 * regola di fine mese), poi i giorni che avanzano: 31 gennaio → 1 marzo = 1 mese e 1 giorno (non bisestile).
 * `inclusive` conta anche il giorno finale (+1 giorno, come per i giorni di calendario di un periodo).
 */
export function dateDifference(a: Ymd, b: Ymd, inclusive = false): Difference {
  const swapped = compareDates(a, b) > 0;
  const from = swapped ? b : a;
  const to = swapped ? a : b;
  const end = inclusive ? addDays(to, 1) : to;
  let k = (end.y - from.y) * 12 + (end.m - from.m);
  while (k > 0 && compareDates(addMonths(from, k), end) > 0) k--;
  const days = toDays(end) - toDays(addMonths(from, k));
  const totalDays = toDays(end) - toDays(from);
  return {
    years: Math.floor(k / 12),
    months: k % 12,
    days,
    totalDays,
    weeks: Math.floor(totalDays / 7),
    weekDays: totalDays % 7,
    totalMonths: k,
    swapped,
  };
}

export type AgeError = 'future';

export interface Age {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  /** Prossimo compleanno (oggi compreso, se è il compleanno). */
  nextBirthday: Ymd;
  /** Giorni al prossimo compleanno: 0 se è oggi. */
  daysToBirthday: number;
  /** Età che si compie al prossimo compleanno. */
  turning: number;
  isBirthdayToday: boolean;
}

/** Compleanno nell'anno `y`: chi è nato il 29 febbraio lo festeggia il 28 negli anni non bisestili. */
export function birthdayInYear(birth: Ymd, y: number): Ymd {
  return { y, m: birth.m, d: Math.min(birth.d, daysInMonth(y, birth.m)) };
}

export function computeAge(birth: Ymd, today: Ymd): Age | null {
  if (compareDates(birth, today) > 0) return null;
  const diff = dateDifference(birth, today);
  let next = birthdayInYear(birth, today.y);
  if (compareDates(next, today) < 0) next = birthdayInYear(birth, today.y + 1);
  return {
    years: diff.years,
    months: diff.months,
    days: diff.days,
    totalDays: diff.totalDays,
    nextBirthday: next,
    daysToBirthday: toDays(next) - toDays(today),
    turning: next.y - birth.y,
    isBirthdayToday: compareDates(next, today) === 0,
  };
}
