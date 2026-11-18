// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Scadenze di pagamento delle fatture: termini in giorni, "data fattura" o "fine mese" (D.F.F.M.), rate multiple,
 * spostamento opzionale al primo giorno lavorativo ed esportazione CSV e iCalendar. Logica pura.
 * Le date sono numeri interi di giorni (vedi `calcolo-giorni-lavorativi/workdays.ts`, da cui arrivano anche i festivi).
 */
import { DEFAULT_OPTIONS, DayNo, DayOptions, MAX_YEAR, fromDayNo, holidaysOfYear, toDayNo, toIso, weekday } from '../calcolo-giorni-lavorativi/workdays';

/** Come si conta il termine. */
export type Base =
  /** Data fattura + N giorni. */
  | 'invoice'
  /** D.F.F.M.: data fattura + N giorni, poi si va a fine mese (più i giorni extra). */
  | 'dffm'
  /** Fine mese della fattura + N giorni. */
  | 'fm';

export const MAX_TERM = 3650;
export const MAX_INSTALLMENTS = 24;
export const MAX_EXTRA = 60;

/** Giorni di termine: "30", "30-60-90", "30, 60, 90", "30/60/90"; null se vuoto o non valido. */
export function parseTerms(input: string): number[] | null {
  const t = input.trim();
  if (!/^\d.*\d$|^\d$/.test(t)) return null;
  const parts = t.split(/[\s,;/\-–]+/).filter(Boolean);
  if (parts.length === 0 || parts.length > MAX_INSTALLMENTS) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,4}$/.test(p)) return null;
    const n = Number(p);
    if (n > MAX_TERM) return null;
    out.push(n);
  }
  return out;
}

/** Ultimo giorno del mese che contiene `day`. */
export function endOfMonth(day: DayNo): DayNo {
  const { y, m } = fromDayNo(day);
  return toDayNo(y, m + 1, 0);
}

/** Scadenza teorica, prima di ogni spostamento. */
export function baseDueDate(invoice: DayNo, term: number, base: Base, extra: number): DayNo {
  if (base === 'invoice') return invoice + term;
  if (base === 'dffm') return endOfMonth(invoice + term) + extra;
  return endOfMonth(invoice) + term;
}

/** Perché un giorno non è lavorativo: 'saturday', 'sunday', il nome della festività, o null se lo è. */
export function nonWorkingReason(day: DayNo, opts: DayOptions): string | null {
  const w = weekday(day);
  if (w === 0 && opts.excludeSunday) return 'sunday';
  if (w === 6 && opts.excludeSaturday) return 'saturday';
  return holidaysOfYear(fromDayNo(day).y, opts).get(day) ?? null;
}

/** Primo giorno lavorativo dal giorno dato in poi (il giorno stesso se lo è); null se si esce dal calendario. */
export function nextWorkingDay(day: DayNo, opts: DayOptions): { day: DayNo; reason: string | null } | null {
  const reason = nonWorkingReason(day, opts);
  let d = day;
  while (nonWorkingReason(d, opts) !== null) {
    d++;
    if (fromDayNo(d).y > MAX_YEAR) return null;
  }
  return { day: d, reason };
}

/** Opzioni dei giorni lavorativi: festivi nazionali e domenica sempre fuori, il sabato a scelta (di norma no per le banche). */
export function workOptions(saturdayWorking: boolean): DayOptions {
  return { ...DEFAULT_OPTIONS, excludeSaturday: !saturdayWorking };
}

// ---------- importi ----------

/** Importo in centesimi da un numero con al massimo due decimali (già letto); null se negativo o troppo grande. */
export function toCents(n: number): bigint | null {
  if (!Number.isFinite(n) || n < 0 || n > 1e12) return null;
  return BigInt(Math.round(n * 100));
}

/** Divide in `n` rate: le prime sono uguali e arrotondate per difetto al centesimo, l'ultima prende la differenza. */
export function splitCents(total: bigint, n: number): bigint[] {
  if (n <= 1) return [total];
  const each = total / BigInt(n);
  const rows = Array<bigint>(n - 1).fill(each);
  rows.push(total - each * BigInt(n - 1));
  return rows;
}

export function formatCents(cents: bigint, decimal: string, group: string): string {
  const a = cents < 0n ? -cents : cents;
  const int = (a / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${cents < 0n ? '-' : ''}${int}${decimal}${(a % 100n).toString().padStart(2, '0')}`;
}

// ---------- calcolo ----------

export interface ScheduleInput {
  invoice: DayNo;
  terms: number[];
  base: Base;
  /** Giorni dopo la fine del mese (solo D.F.F.M.). */
  extra: number;
  /** Sposta le scadenze che cadono in un giorno non lavorativo al primo lavorativo successivo. */
  shift: boolean;
  saturdayWorking: boolean;
  /** Importo totale in centesimi, o null. */
  total: bigint | null;
}

export interface Installment {
  n: number;
  term: number;
  /** Scadenza prima dello spostamento. */
  theoretical: DayNo;
  due: DayNo;
  shifted: boolean;
  /** Perché il giorno teorico non è lavorativo ('saturday', 'sunday' o il nome della festività), anche se non si sposta. */
  nonWorking: string | null;
  cents: bigint | null;
}

export type ScheduleError = 'range';

export function computeSchedule(i: ScheduleInput): Installment[] | { error: ScheduleError } {
  const opts = workOptions(i.saturdayWorking);
  const amounts = i.total === null ? null : splitCents(i.total, i.terms.length);
  const out: Installment[] = [];
  for (let k = 0; k < i.terms.length; k++) {
    const theoretical = baseDueDate(i.invoice, i.terms[k], i.base, i.extra);
    if (fromDayNo(theoretical).y > MAX_YEAR) return { error: 'range' };
    const reason = nonWorkingReason(theoretical, opts);
    let due = theoretical;
    if (i.shift && reason !== null) {
      const n = nextWorkingDay(theoretical, opts);
      if (!n) return { error: 'range' };
      due = n.day;
    }
    out.push({ n: k + 1, term: i.terms[k], theoretical, due, shifted: due !== theoretical, nonWorking: reason, cents: amounts ? amounts[k] : null });
  }
  return out;
}

// ---------- esportazione ----------

function csvField(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvLabels {
  header: string[];
  /** Testo per il motivo dello spostamento ('saturday', 'sunday' o nome festività). */
  reason: (r: string) => string;
}

/** CSV con virgola e a capo CRLF; date ISO e importi con il punto decimale. Righe: rata, giorni, data fattura, scadenza teorica, scadenza, spostata, motivo, importo. */
export function toCsv(rows: Installment[], invoice: DayNo, labels: CsvLabels): string {
  const lines = [labels.header.map(csvField).join(',')];
  for (const r of rows) {
    lines.push(
      [
        String(r.n),
        String(r.term),
        toIso(invoice),
        toIso(r.theoretical),
        toIso(r.due),
        r.shifted ? 'x' : '',
        r.nonWorking ? labels.reason(r.nonWorking) : '',
        r.cents === null ? '' : formatCents(r.cents, '.', ''),
      ]
        .map(csvField)
        .join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\;').replace(/,/g, '\\,');
}

/** Piega le righe a 75 byte come richiede la RFC 5545 (continuazione con CRLF + spazio), senza spezzare i caratteri. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      parts.push(cur);
      cur = '';
      bytes = 0;
      limit = 74; // lo spazio iniziale della continuazione conta
    }
    cur += ch;
    bytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

const ymd = (day: DayNo) => toIso(day).replace(/-/g, '');

export interface IcsOptions {
  /** Riferimento della fattura (numero, cliente) per il titolo. */
  reference: string;
  /** Titolo dell'evento: riceve numero rata, numero rate e riferimento. */
  summary: (n: number, count: number, reference: string, amount: string | null) => string;
  /** Importo già formattato, per la descrizione, o null. */
  amount: (cents: bigint) => string;
  description: string;
  /** Data e ora UTC dell'esportazione, `AAAAMMGGTHHMMSSZ`. */
  stamp: string;
}

/** File iCalendar (.ics) con un evento di tutto il giorno per scadenza. */
export function toIcs(rows: Installment[], invoice: DayNo, o: IcsOptions): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//rrstudio Tools//Scadenze fatture//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const r of rows) {
    const amount = r.cents === null ? null : o.amount(r.cents);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ymd(invoice)}-${r.n}-${rows.length}-${r.term}-${ymd(r.due)}@rrstudio-tools`,
      `DTSTAMP:${o.stamp}`,
      `DTSTART;VALUE=DATE:${ymd(r.due)}`,
      `DTEND;VALUE=DATE:${ymd(r.due + 1)}`,
      `SUMMARY:${icsEscape(o.summary(r.n, rows.length, o.reference, amount))}`,
      `DESCRIPTION:${icsEscape(o.description)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** `AAAAMMGGTHHMMSSZ` in UTC da una data. */
export function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
