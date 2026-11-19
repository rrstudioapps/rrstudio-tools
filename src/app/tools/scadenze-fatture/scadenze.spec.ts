// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { parseIso, toIso } from '../calcolo-giorni-lavorativi/workdays';
import {
  Base,
  Installment,
  baseDueDate,
  computeSchedule,
  endOfMonth,
  foldLine,
  formatCents,
  icsStamp,
  nextWorkingDay,
  nonWorkingReason,
  parseTerms,
  splitCents,
  toCents,
  toCsv,
  toIcs,
  workOptions,
} from './scadenze';

const d = (s: string) => parseIso(s) as number;
const iso = toIso;
const input = (over: Partial<Parameters<typeof computeSchedule>[0]> = {}) => ({
  invoice: d('2026-01-15'),
  terms: [30],
  base: 'invoice' as Base,
  extra: 0,
  shift: false,
  saturdayWorking: false,
  total: null,
  ...over,
});
function run(over: Partial<Parameters<typeof computeSchedule>[0]> = {}): Installment[] {
  const r = computeSchedule(input(over));
  if ('error' in r) throw new Error(r.error);
  return r;
}

describe('termini', () => {
  it('formati', () => {
    expect(parseTerms('30')).toEqual([30]);
    expect(parseTerms('30-60-90')).toEqual([30, 60, 90]);
    expect(parseTerms('30, 60 ; 90')).toEqual([30, 60, 90]);
    expect(parseTerms('30/60/90')).toEqual([30, 60, 90]);
    expect(parseTerms('0')).toEqual([0]);
  });
  it('non validi', () => {
    for (const bad of ['', 'abc', '30 gg', '-30', '30-', '3.5', '99999', '4000']) expect(parseTerms(bad), bad).toBeNull();
    expect(parseTerms(Array(25).fill('30').join(' '))).toBeNull();
    expect(parseTerms(Array(24).fill('30').join(' '))).toHaveLength(24);
  });
});

describe('fine mese', () => {
  it('ultimo giorno del mese', () => {
    expect(iso(endOfMonth(d('2026-01-15')))).toBe('2026-01-31');
    expect(iso(endOfMonth(d('2026-02-01')))).toBe('2026-02-28');
    expect(iso(endOfMonth(d('2028-02-10')))).toBe('2028-02-29');
    expect(iso(endOfMonth(d('2026-12-31')))).toBe('2026-12-31');
    expect(iso(endOfMonth(d('2026-04-30')))).toBe('2026-04-30');
  });
});

describe('scadenza teorica', () => {
  const inv = d('2026-01-15');
  it('data fattura + giorni', () => {
    expect(iso(baseDueDate(inv, 30, 'invoice', 0))).toBe('2026-02-14');
    expect(iso(baseDueDate(inv, 60, 'invoice', 0))).toBe('2026-03-16');
    expect(iso(baseDueDate(inv, 0, 'invoice', 0))).toBe('2026-01-15');
    expect(iso(baseDueDate(d('2026-12-20'), 30, 'invoice', 0))).toBe('2027-01-19');
  });
  it('D.F.F.M.: si somma, poi si va a fine mese', () => {
    expect(iso(baseDueDate(inv, 30, 'dffm', 0))).toBe('2026-02-28');
    expect(iso(baseDueDate(inv, 60, 'dffm', 0))).toBe('2026-03-31');
    expect(iso(baseDueDate(d('2026-01-31'), 30, 'dffm', 0))).toBe('2026-03-31');
  });
  it('D.F.F.M. più N giorni: 10 del mese successivo', () => {
    expect(iso(baseDueDate(inv, 30, 'dffm', 10))).toBe('2026-03-10');
    expect(iso(baseDueDate(inv, 60, 'dffm', 5))).toBe('2026-04-05');
  });
  it('fine mese della fattura + giorni', () => {
    expect(iso(baseDueDate(inv, 30, 'fm', 0))).toBe('2026-03-02');
    expect(iso(baseDueDate(inv, 60, 'fm', 0))).toBe('2026-04-01');
  });
});

describe('giorni non lavorativi', () => {
  const o = workOptions(false);
  it('motivo', () => {
    expect(nonWorkingReason(d('2026-03-07'), o)).toBe('saturday');
    expect(nonWorkingReason(d('2026-03-08'), o)).toBe('sunday');
    expect(nonWorkingReason(d('2026-03-09'), o)).toBeNull();
    expect(nonWorkingReason(d('2026-04-25'), o)).toBe('saturday'); // Liberazione cade di sabato nel 2026
    expect(nonWorkingReason(d('2026-06-02'), o)).toBe('Festa della Repubblica');
    expect(nonWorkingReason(d('2026-03-07'), workOptions(true))).toBeNull();
  });
  it('Pasqua e Lunedì dell\'Angelo (calcolati)', () => {
    expect(nonWorkingReason(d('2026-04-06'), o)).toBe("Lunedì dell'Angelo");
    expect(nonWorkingReason(d('2027-03-29'), o)).toBe("Lunedì dell'Angelo");
    expect(nonWorkingReason(d('2031-04-14'), o)).toBe("Lunedì dell'Angelo");
  });
  it('primo giorno lavorativo successivo', () => {
    expect(nextWorkingDay(d('2026-03-07'), o)).toEqual({ day: d('2026-03-09'), reason: 'saturday' });
    expect(nextWorkingDay(d('2026-03-10'), o)).toEqual({ day: d('2026-03-10'), reason: null });
    // 25 dicembre 2026 è venerdì, 26 sabato, 27 domenica → lunedì 28
    expect(iso((nextWorkingDay(d('2026-12-25'), o) as { day: number }).day)).toBe('2026-12-28');
    // Pasqua 2026 (5 aprile) + Lunedì dell'Angelo → martedì 7
    expect(iso((nextWorkingDay(d('2026-04-04'), o) as { day: number }).day)).toBe('2026-04-07');
  });
  it('con il sabato lavorativo', () => {
    expect(iso((nextWorkingDay(d('2026-03-07'), workOptions(true)) as { day: number }).day)).toBe('2026-03-07');
    expect(iso((nextWorkingDay(d('2026-03-08'), workOptions(true)) as { day: number }).day)).toBe('2026-03-09');
  });
});

describe('piano delle scadenze', () => {
  it('una scadenza a 30 giorni', () => {
    const r = run();
    expect(r).toHaveLength(1);
    expect(iso(r[0].due)).toBe('2026-02-14');
    expect(r[0].nonWorking).toBe('saturday');
    expect(r[0].shifted).toBe(false);
  });
  it('con lo spostamento il 14 febbraio (sabato) va a lunedì 16', () => {
    const r = run({ shift: true });
    expect(iso(r[0].theoretical)).toBe('2026-02-14');
    expect(iso(r[0].due)).toBe('2026-02-16');
    expect(r[0].shifted).toBe(true);
  });
  it('30-60-90 D.F.F.M. con importo diviso', () => {
    const r = run({ terms: [30, 60, 90], base: 'dffm', total: 10000n });
    expect(r.map((x) => iso(x.due))).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
    expect(r.map((x) => x.cents)).toEqual([3333n, 3333n, 3334n]);
    expect(r.reduce((a, x) => a + (x.cents ?? 0n), 0n)).toBe(10000n);
  });
  it('30-60-90 D.F.F.M. con spostamento', () => {
    const r = run({ terms: [30, 60, 90], base: 'dffm', shift: true });
    // 28 feb 2026 sabato → lun 2 marzo; 31 mar martedì; 30 apr giovedì
    expect(r.map((x) => iso(x.due))).toEqual(['2026-03-02', '2026-03-31', '2026-04-30']);
    expect(r.map((x) => x.shifted)).toEqual([true, false, false]);
  });
  it('fine mese + 10 giorni', () => {
    const r = run({ terms: [60], base: 'dffm', extra: 10 });
    expect(iso(r[0].due)).toBe('2026-04-10');
  });
  it('fuori dal calendario', () => {
    expect(computeSchedule(input({ invoice: d('9999-12-30'), terms: [30] }))).toEqual({ error: 'range' });
    expect(computeSchedule(input({ invoice: d('9999-12-31'), terms: [1] }))).toEqual({ error: 'range' });
  });
});

describe('importi', () => {
  it('divisione con l\'arrotondamento sull\'ultima rata', () => {
    expect(splitCents(10000n, 3)).toEqual([3333n, 3333n, 3334n]);
    expect(splitCents(10000n, 6)).toEqual([1666n, 1666n, 1666n, 1666n, 1666n, 1670n]);
    expect(splitCents(10000n, 1)).toEqual([10000n]);
    expect(splitCents(1n, 3)).toEqual([0n, 0n, 1n]);
    expect(splitCents(0n, 2)).toEqual([0n, 0n]);
  });
  it('la somma delle rate è sempre il totale', () => {
    for (const total of [1n, 99n, 12345n, 100000001n]) for (let n = 1; n <= 12; n++) expect(splitCents(total, n).reduce((a, b) => a + b, 0n)).toBe(total);
  });
  it('importi in centesimi', () => {
    expect(toCents(1234.56)).toBe(123456n);
    expect(toCents(0.1 + 0.2)).toBe(30n);
    expect(toCents(-1)).toBeNull();
    expect(toCents(NaN)).toBeNull();
    expect(formatCents(123456n, ',', '.')).toBe('1.234,56');
    expect(formatCents(5n, '.', '')).toBe('0.05');
  });
});

describe('CSV', () => {
  const inv = d('2026-01-15');
  const rows = run({ terms: [30, 60], base: 'dffm', shift: true, total: 10001n });
  const labels = { header: ['Rata', 'Giorni', 'Data fattura', 'Scadenza teorica', 'Scadenza', 'Spostata', 'Motivo', 'Importo'], reason: (r: string) => (r === 'saturday' ? 'sabato' : r) };
  it('intestazione e righe', () => {
    const csv = toCsv(rows, inv, labels);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('Rata,Giorni,Data fattura,Scadenza teorica,Scadenza,Spostata,Motivo,Importo');
    expect(lines[1]).toBe('1,30,2026-01-15,2026-02-28,2026-03-02,x,sabato,50.00');
    expect(lines[2]).toBe('2,60,2026-01-15,2026-03-31,2026-03-31,,,50.01');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
  it('campi con virgole o virgolette', () => {
    const csv = toCsv(rows.slice(0, 1), inv, { ...labels, reason: () => 'festa, "x"' });
    expect(csv).toContain('"festa, ""x"""');
  });
  it('senza importo la colonna è vuota', () => {
    const csv = toCsv(run(), inv, labels);
    expect(csv.trimEnd().split('\r\n')[1].endsWith(',')).toBe(true);
  });
});

describe('iCalendar', () => {
  const inv = d('2026-01-15');
  const rows = run({ terms: [30, 60], base: 'dffm', shift: true, total: 10000n });
  const opts = {
    reference: 'Fattura 12/2026, Rossi; srl',
    summary: (n: number, c: number, ref: string, amount: string | null) => `Scadenza ${n}/${c} ${ref}${amount ? ' ' + amount : ''}`,
    amount: (c: bigint) => formatCents(c, ',', '.') + ' €',
    description: 'Riga 1\nRiga 2',
    stamp: '20260115T100000Z',
  };
  const ics = toIcs(rows, inv, opts);
  it('struttura e un evento per scadenza', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260302\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20260303\r\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260331\r\n');
    expect(ics).toContain('DTSTAMP:20260115T100000Z');
  });
  it('testo con escape', () => {
    expect(ics).toContain('Fattura 12/2026\\, Rossi\; srl');
    expect(ics).toContain('DESCRIPTION:Riga 1\\nRiga 2');
  });
  it('UID unici', () => {
    const uids = ics.match(/UID:.*\r\n/g) ?? [];
    expect(new Set(uids).size).toBe(2);
  });
  it('righe di al massimo 75 byte e a capo CRLF', () => {
    const enc = new TextEncoder();
    const long = toIcs(rows, inv, { ...opts, reference: 'è'.repeat(80) });
    for (const line of long.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    expect(long.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });
  it('piegatura: la riga si ricompone', () => {
    const line = 'SUMMARY:' + 'àb'.repeat(60);
    const folded = foldLine(line);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
    expect(foldLine('corta')).toBe('corta');
  });
  it('timbro UTC', () => {
    expect(icsStamp(new Date(Date.UTC(2026, 0, 5, 9, 8, 7)))).toBe('20260105T090807Z');
  });
});
