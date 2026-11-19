// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import {
  breakdown, buildIcs, easter, escapeIcsText, foldIcsLine, formatWall, nextOccurrence, parseWall, wallOf, wallToMs, workingDaysBetween,
  type Wall, type Zone,
} from './countdown';

const ROME: Zone = 'Europe/Rome';
const at = (text: string, zone: Zone = ROME): number => wallToMs(parseWall(text)!, zone);

describe('parseWall / formatWall', () => {
  it('legge e riscrive una data valida', () => {
    expect(formatWall(parseWall('2026-12-25T08:30')!)).toBe('2026-12-25T08:30');
    expect(parseWall('2026-12-25T08:30:15')!.s).toBe(15);
  });
  it('rifiuta date inesistenti, fuori intervallo o malformate', () => {
    for (const t of ['', '2026-02-30T10:00', '2027-02-29T10:00', '2026-13-01T10:00', '2026-12-25T24:00', '2026-12-25', '1969-12-31T23:00', '2101-01-01T00:00', 'x']) {
      expect(parseWall(t), t).toBeNull();
    }
    expect(parseWall('2028-02-29T10:00')).not.toBeNull();
  });
});

describe('wallToMs / wallOf', () => {
  it('Roma: ora solare UTC+1 e ora legale UTC+2', () => {
    expect(at('2026-01-15T12:00')).toBe(Date.UTC(2026, 0, 15, 11, 0));
    expect(at('2026-07-15T12:00')).toBe(Date.UTC(2026, 6, 15, 10, 0));
  });
  it('è l\'inverso di wallOf, anche a New York e Sydney', () => {
    for (const z of ['America/New_York', 'Australia/Sydney', 'Asia/Tokyo', 'UTC', ROME]) {
      const w: Wall = { y: 2026, m: 11, d: 18, h: 9, mi: 5, s: 0 };
      expect(wallOf(wallToMs(w, z), z)).toEqual(w);
    }
  });
  it('ora inesistente (salto in avanti a Roma): dà l\'istante dopo il salto', () => {
    expect(at('2026-03-29T02:30')).toBe(Date.UTC(2026, 2, 29, 1, 30)); // 03:30 CEST
  });
  it('fusi diversi danno istanti diversi per la stessa ora civile', () => {
    expect(at('2026-01-15T12:00', 'UTC') - at('2026-01-15T12:00', 'America/New_York')).toBe(-5 * 3_600_000);
  });
});

describe('workingDaysBetween', () => {
  const d = (y: number, m: number, day: number) => ({ y, m, d: day });
  it('da venerdì a lunedì ne conta 1; stesso giorno 0; all\'indietro 0', () => {
    expect(workingDaysBetween(d(2026, 11, 20), d(2026, 11, 23))).toBe(1);
    expect(workingDaysBetween(d(2026, 11, 18), d(2026, 11, 18))).toBe(0);
    expect(workingDaysBetween(d(2026, 11, 23), d(2026, 11, 20))).toBe(0);
  });
  it('una settimana intera = 5, due = 10, mercoledì a mercoledì successivo = 5', () => {
    expect(workingDaysBetween(d(2026, 11, 16), d(2026, 11, 23))).toBe(5);
    expect(workingDaysBetween(d(2026, 11, 16), d(2026, 11, 30))).toBe(10);
    expect(workingDaysBetween(d(2026, 11, 18), d(2026, 11, 25))).toBe(5);
  });
  it('sabato a domenica 0, sabato a lunedì 1', () => {
    expect(workingDaysBetween(d(2026, 3, 28), d(2026, 3, 29))).toBe(0);
    expect(workingDaysBetween(d(2026, 3, 28), d(2026, 3, 30))).toBe(1);
  });
  it('un anno: 261 o 260 giorni lavorativi', () => {
    expect(workingDaysBetween(d(2025, 12, 31), d(2026, 12, 31))).toBe(261);
  });
});

describe('breakdown', () => {
  it('scompone un futuro in giorni, ore, minuti e secondi', () => {
    const now = at('2026-11-18T10:00:00', 'UTC');
    const r = breakdown(at('2026-11-20T12:30:45', 'UTC'), now, 'UTC');
    expect(r).toMatchObject({ state: 'future', days: 2, hours: 2, minutes: 30, seconds: 45, totalHours: 50 });
    expect(r.weeks).toBe(0.3);
  });
  it('data uguale a ora: tutto zero, stato now', () => {
    const t = at('2026-11-18T10:00');
    expect(breakdown(t, t, ROME)).toMatchObject({ state: 'now', days: 0, hours: 0, minutes: 0, seconds: 0, totalHours: 0, workingDays: 0 });
  });
  it('passato: stessi valori in positivo, stato past', () => {
    const now = at('2026-11-20T12:30:45', 'UTC');
    const r = breakdown(at('2026-11-18T10:00:00', 'UTC'), now, 'UTC');
    expect(r).toMatchObject({ state: 'past', days: 2, hours: 2, minutes: 30, seconds: 45 });
  });
  it('un secondo prima e un secondo dopo', () => {
    const t = at('2026-11-18T10:00:00');
    expect(breakdown(t, t - 1000, ROME)).toMatchObject({ state: 'future', seconds: 1 });
    expect(breakdown(t, t + 1000, ROME)).toMatchObject({ state: 'past', seconds: 1 });
    expect(breakdown(t, t - 999, ROME).seconds).toBe(0);
  });
  it('anno bisestile: 28 febbraio -> 1 marzo = 2 giorni nel 2028, 1 nel 2027', () => {
    expect(breakdown(at('2028-03-01T00:00', 'UTC'), at('2028-02-28T00:00', 'UTC'), 'UTC').days).toBe(2);
    expect(breakdown(at('2027-03-01T00:00', 'UTC'), at('2027-02-28T00:00', 'UTC'), 'UTC').days).toBe(1);
    expect(breakdown(at('2029-02-28T00:00', 'UTC'), at('2028-02-29T00:00', 'UTC'), 'UTC').days).toBe(365);
  });
  it('cambio all\'ora legale (29 marzo 2026): da sabato a lunedì a mezzogiorno sono 2 giorni e 0 ore, ma 47 ore reali', () => {
    const r = breakdown(at('2026-03-30T12:00'), at('2026-03-28T12:00'), ROME);
    expect(r).toMatchObject({ days: 2, hours: 0, minutes: 0, totalHours: 47, workingDays: 1 });
  });
  it('cambio all\'ora solare (25 ottobre 2026): 2 giorni e 0 ore, ma 49 ore reali', () => {
    const r = breakdown(at('2026-10-26T12:00'), at('2026-10-24T12:00'), ROME);
    expect(r).toMatchObject({ days: 2, hours: 0, totalHours: 49 });
  });
  it('il giorno del cambio dura 23 ore a marzo e 25 a ottobre', () => {
    expect(breakdown(at('2026-03-29T12:00'), at('2026-03-28T12:00'), ROME)).toMatchObject({ days: 1, hours: 0, totalHours: 23 });
    expect(breakdown(at('2026-10-25T12:00'), at('2026-10-24T12:00'), ROME)).toMatchObject({ days: 1, hours: 0, totalHours: 25 });
    // dalle 13:00 a mezzogiorno del giorno dopo passano solo 22 ore reali, quindi 0 giorni
    expect(breakdown(at('2026-03-29T12:00'), at('2026-03-28T13:00'), ROME)).toMatchObject({ days: 0, hours: 22 });
  });
  it('lo stesso istante letto a Roma e a Tokyo ha la stessa distanza se non ci sono cambi d\'ora', () => {
    const now = at('2026-11-18T10:00', 'UTC');
    const t = at('2026-12-25T10:00', 'UTC');
    expect(breakdown(t, now, 'Asia/Tokyo').days).toBe(breakdown(t, now, 'UTC').days);
  });
});

describe('easter', () => {
  const known: Record<number, [number, number]> = {
    2024: [3, 31], 2025: [4, 20], 2026: [4, 5], 2027: [3, 28], 2028: [4, 16], 2029: [4, 1],
    2030: [4, 21], 2031: [4, 13], 2032: [3, 28], 2033: [4, 17], 2034: [4, 9], 2035: [3, 25],
  };
  for (const [year, [month, day]] of Object.entries(known)) {
    it(`Pasqua ${year}`, () => expect(easter(Number(year))).toEqual({ month, day }));
  }
});

describe('nextOccurrence', () => {
  const now = at('2026-11-18T10:00');
  it('le ricorrenze fisse sono nell\'anno in corso o nel successivo, alle 00:00', () => {
    expect(nextOccurrence('christmas', now, ROME)).toBe('2026-12-25T00:00');
    expect(nextOccurrence('stephen', now, ROME)).toBe('2026-12-26T00:00');
    expect(nextOccurrence('nye', now, ROME)).toBe('2026-12-31T00:00');
    expect(nextOccurrence('newyear', now, ROME)).toBe('2027-01-01T00:00');
    expect(nextOccurrence('epiphany', now, ROME)).toBe('2027-01-06T00:00');
    expect(nextOccurrence('liberation', now, ROME)).toBe('2027-04-25T00:00');
    expect(nextOccurrence('labour', now, ROME)).toBe('2027-05-01T00:00');
    expect(nextOccurrence('republic', now, ROME)).toBe('2027-06-02T00:00');
    expect(nextOccurrence('ferragosto', now, ROME)).toBe('2027-08-15T00:00');
    expect(nextOccurrence('halloween', now, ROME)).toBe('2027-10-31T00:00');
  });
  it('Pasqua e Pasquetta: quest\'anno se non sono passate, altrimenti l\'anno dopo', () => {
    expect(nextOccurrence('easter', now, ROME)).toBe('2027-03-28T00:00');
    expect(nextOccurrence('easterMonday', now, ROME)).toBe('2027-03-29T00:00');
    expect(nextOccurrence('easter', at('2026-01-02T10:00'), ROME)).toBe('2026-04-05T00:00');
    expect(nextOccurrence('easterMonday', at('2026-01-02T10:00'), ROME)).toBe('2026-04-06T00:00');
  });
  it('il giorno stesso, a mezzanotte passata, passa all\'anno dopo; un attimo prima no', () => {
    expect(nextOccurrence('christmas', at('2026-12-25T00:00'), ROME)).toBe('2027-12-25T00:00');
    expect(nextOccurrence('christmas', at('2026-12-25T00:00') - 1, ROME)).toBe('2026-12-25T00:00');
  });
  it('rispetta il fuso scelto: a Tokyo è già il 19 novembre', () => {
    expect(nextOccurrence('christmas', at('2026-12-24T20:00', 'UTC'), 'Asia/Tokyo')).toBe('2027-12-25T00:00');
    expect(nextOccurrence('christmas', at('2026-12-24T20:00', 'UTC'), 'UTC')).toBe('2026-12-25T00:00');
  });
});

describe('iCalendar', () => {
  const now = Date.UTC(2026, 10, 18, 9, 0, 0);
  it('escape di barra, virgola, punto e virgola e a capo', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\;c\\\\d\\ne');
  });
  it('piega le righe a 75 ottetti anche con caratteri multibyte', () => {
    const folded = foldIcsLine('SUMMARY:' + 'è'.repeat(80));
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    const enc = new TextEncoder();
    parts.forEach((p, i) => {
      expect(enc.encode(p).length).toBeLessThanOrEqual(75);
      if (i > 0) expect(p.startsWith(' ')).toBe(true);
    });
    expect(folded.replace(/\r\n /g, '')).toBe('SUMMARY:' + 'è'.repeat(80));
  });
  it('evento nel fuso locale: ora fluttuante, righe con CRLF e fine con CRLF', () => {
    const ics = buildIcs({ summary: 'Cena, con Anna; ore 20', wall: parseWall('2026-12-25T23:30')!, zone: 'local', now });
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.split('\r\n').length - 1).toBe(ics.split('\n').length - 1);
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('DTSTART:20261225T233000\r\n');
    expect(ics).toContain('DTEND:20261226T003000\r\n');
    expect(ics).toContain('DTSTAMP:20261118T090000Z\r\n');
    expect(ics).toContain('SUMMARY:Cena\\, con Anna\; ore 20\r\n');
  });
  it('evento con fuso: convertito in UTC', () => {
    const ics = buildIcs({ summary: 'X', wall: parseWall('2026-07-01T12:00')!, zone: ROME, now });
    expect(ics).toContain('DTSTART:20260701T100000Z\r\n');
    expect(ics).toContain('DTEND:20260701T110000Z\r\n');
  });
});
