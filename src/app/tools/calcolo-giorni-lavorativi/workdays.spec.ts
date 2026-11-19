// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPTIONS,
  DayOptions,
  PATRONS,
  addWorkdays,
  countRange,
  easter,
  formatDate,
  fromDayNo,
  holidaysOfYear,
  nationalHolidays,
  parseIso,
  toDayNo,
  toIso,
  weekday,
} from './workdays';

const day = (iso: string): number => {
  const n = parseIso(iso);
  if (n === null) throw new Error('data non valida ' + iso);
  return n;
};
const opts = (o: Partial<DayOptions> = {}): DayOptions => ({ ...DEFAULT_OPTIONS, ...o });

describe('date', () => {
  it('giorno della settimana noto', () => {
    expect(weekday(day('1970-01-01'))).toBe(4); // giovedì
    expect(weekday(day('2026-11-16'))).toBe(1); // lunedì
    expect(weekday(day('2000-02-29'))).toBe(2); // martedì
    expect(weekday(day('1900-01-01'))).toBe(1); // lunedì
  });
  it('conversioni di andata e ritorno e date non valide', () => {
    expect(toIso(day('2024-02-29'))).toBe('2024-02-29');
    expect(fromDayNo(toDayNo(2026, 12, 31))).toEqual({ y: 2026, m: 12, d: 31 });
    expect(parseIso('2025-02-29')).toBeNull();
    expect(parseIso('2025-13-01')).toBeNull();
    expect(parseIso('1500-01-01')).toBeNull();
    expect(parseIso('')).toBeNull();
    expect(parseIso('2025-1-1')).toBeNull();
  });
});

describe('Pasqua', () => {
  const known: Record<number, string> = {
    2024: '2024-03-31',
    2025: '2025-04-20',
    2026: '2026-04-05',
    2027: '2027-03-28',
    2028: '2028-04-16',
    2029: '2029-04-01',
    2030: '2030-04-21',
  };
  for (const [y, iso] of Object.entries(known)) {
    it(`Pasqua ${y} = ${iso}`, () => {
      const e = easter(+y);
      expect(toIso(toDayNo(+y, e.m, e.d))).toBe(iso);
      expect(weekday(toDayNo(+y, e.m, e.d))).toBe(0); // sempre di domenica
    });
  }
  it('anni limite noti', () => {
    expect(easter(1961)).toEqual({ m: 4, d: 2 });
    expect(easter(2038)).toEqual({ m: 4, d: 25 }); // la più tarda del periodo
    expect(easter(2285)).toEqual({ m: 3, d: 22 }); // la più precoce possibile
  });
});

describe('festività nazionali', () => {
  it('12 festività con Pasqua e Lunedì dell’Angelo, in ordine', () => {
    const h = nationalHolidays(2026);
    expect(h).toHaveLength(12);
    expect(h.map((x) => toIso(x.day))).toEqual([
      '2026-01-01', '2026-01-06', '2026-04-05', '2026-04-06', '2026-04-25', '2026-05-01',
      '2026-06-02', '2026-08-15', '2026-11-01', '2026-12-08', '2026-12-25', '2026-12-26',
    ]);
    expect(h[3].name).toBe("Lunedì dell'Angelo");
  });
  for (let y = 2024; y <= 2030; y++) {
    it(`Lunedì dell'Angelo ${y} è un lunedì`, () => {
      const l = nationalHolidays(y).find((x) => x.name === "Lunedì dell'Angelo");
      expect(weekday(l!.day)).toBe(1);
    });
  }
});

describe('patroni', () => {
  it('ogni patrono ha una data valida e id unico', () => {
    expect(new Set(PATRONS.map((p) => p.id)).size).toBe(PATRONS.length);
    for (const p of PATRONS) expect(parseIso(`2024-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`), p.city).not.toBeNull();
    expect(PATRONS.length).toBe(21);
  });
  it('un patrono che coincide con una festività nazionale non si duplica', () => {
    const m = holidaysOfYear(2026, opts({ patron: 'venezia' }));
    expect(m.get(day('2026-04-25'))).toBe('Festa della Liberazione');
  });
  it('patrono e data libera si aggiungono alle festività', () => {
    const m = holidaysOfYear(2026, opts({ patron: 'milano', custom: '2026-03-10' }));
    expect(m.get(day('2026-12-07'))).toContain('Milano');
    expect(m.get(day('2026-03-10'))).toBe('Data libera');
    expect(holidaysOfYear(2027, opts({ custom: '2026-03-10' })).has(day('2026-03-10'))).toBe(false);
  });
});

describe('giorni tra due date', () => {
  it('una settimana piena senza festività: 5 lavorativi', () => {
    const r = countRange(day('2026-03-02'), day('2026-03-08'), true, opts())!;
    expect(r).toMatchObject({ calendarDays: 7, workdays: 5, weekendDays: 2 });
    expect(r.holidays).toEqual([]);
  });
  it('data finale esclusa', () => {
    const r = countRange(day('2026-03-02'), day('2026-03-06'), false, opts())!;
    expect(r).toMatchObject({ calendarDays: 4, workdays: 4 });
  });
  it('stessa data: 1 giorno se inclusa, 0 se esclusa', () => {
    expect(countRange(day('2026-03-04'), day('2026-03-04'), true, opts())).toMatchObject({ calendarDays: 1, workdays: 1 });
    expect(countRange(day('2026-03-04'), day('2026-03-04'), false, opts())).toMatchObject({ calendarDays: 0, workdays: 0 });
    expect(countRange(day('2026-03-07'), day('2026-03-07'), true, opts())).toMatchObject({ calendarDays: 1, workdays: 0, weekendDays: 1 });
  });
  it('data finale prima di quella iniziale: null', () => {
    expect(countRange(day('2026-03-05'), day('2026-03-04'), true, opts())).toBeNull();
  });
  it('intervallo con Pasqua 2026: Lunedì dell’Angelo e 25 aprile elencati, Pasqua (domenica) no', () => {
    const r = countRange(day('2026-04-01'), day('2026-04-30'), true, opts())!;
    expect(r.calendarDays).toBe(30);
    expect(r.weekendDays).toBe(8); // 4 sabati + 4 domeniche (4,5,11,12,18,19,25,26)
    expect(r.holidays.map((h) => toIso(h.day))).toEqual(['2026-04-06']); // il 25/4/2026 è sabato
    expect(r.workdays).toBe(30 - 8 - 1);
  });
  it('festività nei giorni feriali: 25 aprile 2024 (giovedì) e 1 maggio (mercoledì)', () => {
    const r = countRange(day('2024-04-22'), day('2024-05-03'), true, opts())!;
    expect(r.holidays.map((h) => toIso(h.day))).toEqual(['2024-04-25', '2024-05-01']);
    expect(r.workdays).toBe(10 - 2);
  });
  it('senza festività nazionali non si tolgono', () => {
    const r = countRange(day('2024-04-22'), day('2024-05-03'), true, opts({ national: false }))!;
    expect(r.holidays).toEqual([]);
    expect(r.workdays).toBe(10);
  });
  it('sabato lavorativo: il sabato conta, e una festività di sabato si toglie', () => {
    const a = countRange(day('2026-04-20'), day('2026-04-26'), true, opts({ excludeSaturday: false }))!;
    expect(a.weekendDays).toBe(1); // solo la domenica
    expect(a.holidays.map((h) => toIso(h.day))).toEqual(['2026-04-25']); // sabato festivo
    expect(a.workdays).toBe(7 - 1 - 1);
  });
  it('anche la domenica lavorativa: tutti i giorni contano tranne le festività', () => {
    const r = countRange(day('2026-04-04'), day('2026-04-07'), true, opts({ excludeSaturday: false, excludeSunday: false }))!;
    expect(r.weekendDays).toBe(0);
    expect(r.holidays.map((h) => toIso(h.day))).toEqual(['2026-04-05', '2026-04-06']);
    expect(r.workdays).toBe(2);
  });
  it('un anno intero (2025): 365 giorni, 261 feriali, festività su giorni feriali', () => {
    const r = countRange(day('2025-01-01'), day('2025-12-31'), true, opts({ national: false }))!;
    expect(r.calendarDays).toBe(365);
    expect(r.workdays).toBe(261);
    const n = countRange(day('2025-01-01'), day('2025-12-31'), true, opts())!;
    const onWeekdays = nationalHolidays(2025).filter((h) => weekday(h.day) !== 0 && weekday(h.day) !== 6);
    expect(n.holidays).toHaveLength(onWeekdays.length);
    expect(n.workdays).toBe(261 - onWeekdays.length);
  });
  it('anno bisestile e attraversamento d’anno', () => {
    const r = countRange(day('2024-12-30'), day('2025-01-02'), true, opts())!;
    expect(r.calendarDays).toBe(4);
    expect(r.holidays.map((h) => toIso(h.day))).toEqual(['2025-01-01']);
    expect(r.workdays).toBe(3);
    expect(countRange(day('2024-02-28'), day('2024-03-01'), true, opts())!.calendarDays).toBe(3);
  });
  it('santo patrono e data libera nel conteggio', () => {
    const r = countRange(day('2026-06-22'), day('2026-06-26'), true, opts({ patron: 'torino', custom: '2026-06-26' }))!;
    expect(r.holidays.map((h) => h.name)).toEqual(['Santo patrono di Torino (San Giovanni Battista)', 'Data libera']);
    expect(r.workdays).toBe(3);
  });
});

describe('aggiungi o togli giorni lavorativi', () => {
  it('da lunedì +1 = martedì; +5 = lunedì dopo; venerdì +1 = lunedì', () => {
    expect(toIso(addWorkdays(day('2026-03-02'), 1, opts())!.result)).toBe('2026-03-03');
    expect(toIso(addWorkdays(day('2026-03-02'), 5, opts())!.result)).toBe('2026-03-09');
    expect(toIso(addWorkdays(day('2026-03-06'), 1, opts())!.result)).toBe('2026-03-09');
  });
  it('0 giorni restituisce la data di partenza', () => {
    const r = addWorkdays(day('2026-03-07'), 0, opts())!;
    expect(toIso(r.result)).toBe('2026-03-07');
    expect(r.startNotWorking).toBe(true);
  });
  it('salta le festività: 30 giorni lavorativi da inizio aprile 2026', () => {
    const r = addWorkdays(day('2026-04-01'), 3, opts())!;
    // 2 (gio), 3 (ven), 7 (mar, perché il 6 è Lunedì dell'Angelo)
    expect(toIso(r.result)).toBe('2026-04-07');
    expect(r.skipped.map((h) => toIso(h.day))).toEqual(['2026-04-06']);
  });
  it('indietro: da martedì 7 aprile 2026, -1 = venerdì 3 (il 6 è festivo)', () => {
    expect(toIso(addWorkdays(day('2026-04-07'), -1, opts())!.result)).toBe('2026-04-03');
    expect(toIso(addWorkdays(day('2026-03-09'), -1, opts())!.result)).toBe('2026-03-06');
  });
  it('coerenza: aggiungere n e contare dà n', () => {
    for (const n of [1, 7, 20, 100, 260]) {
      const start = day('2026-03-18');
      const end = addWorkdays(start, n, opts({ patron: 'roma' }))!.result;
      const r = countRange(start + 1, end, true, opts({ patron: 'roma' }))!;
      expect(r.workdays, `n=${n}`).toBe(n);
    }
  });
  it('indietro e avanti sono inverse su un giorno lavorativo', () => {
    const start = day('2026-05-13');
    const fwd = addWorkdays(start, 40, opts())!.result;
    expect(addWorkdays(fwd, -40, opts())!.result).toBe(start);
  });
  it('sabato lavorativo e oltre il fine anno', () => {
    expect(toIso(addWorkdays(day('2026-03-06'), 1, opts({ excludeSaturday: false }))!.result)).toBe('2026-03-07');
    // 24/12/2026 (giovedì) +1 → 25 e 26 festivi, 27 domenica → lunedì 28
    expect(toIso(addWorkdays(day('2026-12-24'), 1, opts())!.result)).toBe('2026-12-28');
  });
  it('input non valido', () => {
    expect(addWorkdays(day('2026-03-02'), 1.5, opts())).toBeNull();
    expect(addWorkdays(day('2026-03-02'), 1e9, opts())).toBeNull();
  });
});

describe('formato', () => {
  it('data in italiano', () => {
    expect(formatDate(day('2026-04-06'))).toBe('lunedì 6 aprile 2026');
    expect(formatDate(day('2024-02-29'), false)).toBe('29 febbraio 2024');
  });
});
