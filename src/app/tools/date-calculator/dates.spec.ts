// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  Ymd,
  addDays,
  addInterval,
  addMonths,
  birthdayInYear,
  compareDates,
  computeAge,
  dateDifference,
  daysInMonth,
  formatIso,
  fromDays,
  isLeapYear,
  parseIso,
  toDays,
  weekday,
  ymdToUtcMs,
} from './dates';

const d = (s: string): Ymd => {
  const p = parseIso(s);
  if (!p) throw new Error('data non valida: ' + s);
  return p;
};
const iso = (x: Ymd | null) => (x ? formatIso(x) : null);

describe('anni bisestili e mesi', () => {
  it('regola gregoriana', () => {
    expect([1900, 2000, 2023, 2024, 2100, 2400].map(isLeapYear)).toEqual([false, true, false, true, false, true]);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2023, 4)).toBe(30);
    expect(daysInMonth(2023, 12)).toBe(31);
  });
});

describe('numero progressivo dei giorni', () => {
  it('epoca e date note', () => {
    expect(toDays(d('1970-01-01'))).toBe(0);
    expect(toDays(d('2000-03-01'))).toBe(11017);
    expect(toDays(d('1969-12-31'))).toBe(-1);
    expect(iso(fromDays(0))).toBe('1970-01-01');
  });
  it('andata e ritorno su un intervallo di secoli', () => {
    for (let z = -800000; z < 2800000; z += 997) expect(toDays(fromDays(z))).toBe(z);
  });
  it('giorno della settimana', () => {
    expect(weekday(d('1970-01-01'))).toBe(4); // giovedì
    expect(weekday(d('2024-02-29'))).toBe(4); // giovedì
    expect(weekday(d('2026-11-16'))).toBe(1); // lunedì
    expect(weekday(d('2000-01-01'))).toBe(6); // sabato
  });
});

describe('lettura delle date', () => {
  it('accetta solo date reali', () => {
    expect(parseIso('2024-02-29')).toEqual({ y: 2024, m: 2, d: 29 });
    expect(parseIso('2023-02-29')).toBeNull();
    expect(parseIso('2023-13-01')).toBeNull();
    expect(parseIso('2023-04-31')).toBeNull();
    expect(parseIso('2023-1-1')).toBeNull();
    expect(parseIso('')).toBeNull();
    expect(parseIso('0000-01-01')).toBeNull();
  });
});

describe('aggiungere mesi e anni, fine mese', () => {
  it('31 gennaio + 1 mese = ultimo giorno di febbraio', () => {
    expect(iso(addMonths(d('2023-01-31'), 1))).toBe('2023-02-28');
    expect(iso(addMonths(d('2024-01-31'), 1))).toBe('2024-02-29');
    expect(iso(addMonths(d('2023-01-31'), 3))).toBe('2023-04-30');
  });
  it('mesi negativi e cambio d\'anno', () => {
    expect(iso(addMonths(d('2023-03-31'), -1))).toBe('2023-02-28');
    expect(iso(addMonths(d('2023-01-15'), -2))).toBe('2022-11-15');
    expect(iso(addMonths(d('2023-11-30'), 3))).toBe('2024-02-29');
    expect(iso(addMonths(d('2023-12-31'), 12))).toBe('2024-12-31');
  });
  it('29 febbraio + 1 anno = 28 febbraio; + 4 anni = 29 febbraio', () => {
    expect(iso(addInterval(d('2024-02-29'), { years: 1 }, 1))).toBe('2025-02-28');
    expect(iso(addInterval(d('2024-02-29'), { years: 4 }, 1))).toBe('2028-02-29');
    expect(iso(addInterval(d('2024-02-29'), { years: 1 }, -1))).toBe('2023-02-28');
  });
});

describe('aggiungi e togli un intervallo', () => {
  it('giorni e settimane', () => {
    expect(iso(addInterval(d('2024-02-28'), { days: 2 }, 1))).toBe('2024-03-01');
    expect(iso(addInterval(d('2023-02-28'), { days: 2 }, 1))).toBe('2023-03-02');
    expect(iso(addInterval(d('2024-03-01'), { weeks: 2 }, -1))).toBe('2024-02-16');
    expect(iso(addInterval(d('2024-12-31'), { days: 1 }, 1))).toBe('2025-01-01');
    expect(iso(addDays(d('2024-01-01'), 366))).toBe('2025-01-01');
  });
  it('combinazione: prima anni e mesi, poi settimane e giorni', () => {
    // 31 gen + 1 mese = 28 feb (2023), poi + 1 giorno = 1 marzo
    expect(iso(addInterval(d('2023-01-31'), { months: 1, days: 1 }, 1))).toBe('2023-03-01');
    expect(iso(addInterval(d('2020-05-10'), { years: 1, months: 2, weeks: 1, days: 3 }, 1))).toBe('2021-07-20');
  });
  it('intervallo nullo e fuori dagli anni 1-9999', () => {
    expect(iso(addInterval(d('2024-05-05'), {}, 1))).toBe('2024-05-05');
    expect(addInterval(d('9999-12-31'), { days: 1 }, 1)).toBeNull();
    expect(addInterval(d('0001-01-01'), { days: 1 }, -1)).toBeNull();
    expect(addInterval(d('2024-01-01'), { years: 9000 }, 1)).toBeNull();
    expect(addInterval(d('2024-01-01'), { days: Infinity }, 1)).toBeNull();
  });
});

describe('differenza tra due date', () => {
  it('anni, mesi e giorni', () => {
    const r = dateDifference(d('2020-01-15'), d('2024-03-20'));
    expect([r.years, r.months, r.days]).toEqual([4, 2, 5]);
    expect(r.totalDays).toBe(1526);
    expect(r.weeks).toBe(218);
    expect(r.weekDays).toBe(0);
    expect(r.totalMonths).toBe(50);
  });
  it('stessa data: tutto zero', () => {
    const r = dateDifference(d('2024-05-05'), d('2024-05-05'));
    expect([r.years, r.months, r.days, r.totalDays]).toEqual([0, 0, 0, 0]);
  });
  it('un anno bisestile: 366 giorni da 1 gennaio a 1 gennaio', () => {
    const r = dateDifference(d('2024-01-01'), d('2025-01-01'));
    expect([r.years, r.months, r.days, r.totalDays]).toEqual([1, 0, 0, 366]);
    expect(dateDifference(d('2023-01-01'), d('2024-01-01')).totalDays).toBe(365);
  });
  it('fine mese: 31 gennaio → 28 febbraio è un mese; → 1 marzo è un mese e un giorno', () => {
    const a = dateDifference(d('2023-01-31'), d('2023-02-28'));
    expect([a.months, a.days]).toEqual([1, 0]);
    const b = dateDifference(d('2023-01-31'), d('2023-03-01'));
    expect([b.months, b.days]).toEqual([1, 1]);
    const c = dateDifference(d('2023-01-31'), d('2023-03-31'));
    expect([c.months, c.days]).toEqual([2, 0]);
  });
  it('29 febbraio → 28 febbraio dell\'anno dopo: un anno esatto (29 feb + 12 mesi = 28 feb)', () => {
    const r = dateDifference(d('2024-02-29'), d('2025-02-28'));
    expect(r.totalDays).toBe(365);
    expect([r.years, r.months]).toEqual([1, 0]); // 29 feb + 12 mesi = 28 feb 2025
    expect(r.days).toBe(0);
  });
  it('ordine invertito: stessi valori e flag swapped', () => {
    const r = dateDifference(d('2024-03-20'), d('2020-01-15'));
    expect(r.swapped).toBe(true);
    expect([r.years, r.months, r.days, r.totalDays]).toEqual([4, 2, 5, 1526]);
  });
  it('conteggio inclusivo aggiunge un giorno', () => {
    const r = dateDifference(d('2024-01-01'), d('2024-01-31'), true);
    expect(r.totalDays).toBe(31);
    expect([r.months, r.days]).toEqual([1, 0]);
    expect(dateDifference(d('2024-01-01'), d('2024-01-31')).totalDays).toBe(30);
  });
  it('settimane e giorni', () => {
    const r = dateDifference(d('2024-01-01'), d('2024-01-18'));
    expect([r.weeks, r.weekDays, r.totalDays]).toEqual([2, 3, 17]);
  });
  it('coerenza: data + differenza = data finale', () => {
    const pairs: [string, string][] = [
      ['2019-08-31', '2024-02-29'],
      ['2000-02-29', '2024-02-28'],
      ['1999-12-31', '2000-03-01'],
      ['2023-05-31', '2023-06-30'],
    ];
    for (const [a, b] of pairs) {
      const r = dateDifference(d(a), d(b));
      const back = addInterval(d(a), { months: r.totalMonths }, 1)!;
      expect(iso(addDays(back, r.days)), `${a}→${b}`).toBe(b);
    }
  });
});

describe('età e compleanno', () => {
  it('età in anni, mesi e giorni', () => {
    const a = computeAge(d('1990-06-15'), d('2026-11-16'))!;
    expect([a.years, a.months, a.days]).toEqual([36, 5, 1]);
    expect(iso(a.nextBirthday)).toBe('2027-06-15');
    expect(a.turning).toBe(37);
    expect(a.daysToBirthday).toBe(211);
    expect(a.isBirthdayToday).toBe(false);
  });
  it('il giorno del compleanno: 0 giorni e festeggiato oggi', () => {
    const a = computeAge(d('1990-11-16'), d('2026-11-16'))!;
    expect(a.years).toBe(36);
    expect(a.daysToBirthday).toBe(0);
    expect(a.isBirthdayToday).toBe(true);
    expect(a.turning).toBe(36);
  });
  it('compleanno già passato quest\'anno: il prossimo è l\'anno dopo', () => {
    const a = computeAge(d('1990-01-01'), d('2026-11-16'))!;
    expect(iso(a.nextBirthday)).toBe('2027-01-01');
    expect(a.daysToBirthday).toBe(46);
  });
  it('nato il 29 febbraio: compleanno il 28 negli anni non bisestili', () => {
    expect(iso(birthdayInYear(d('2000-02-29'), 2025))).toBe('2025-02-28');
    expect(iso(birthdayInYear(d('2000-02-29'), 2028))).toBe('2028-02-29');
    const a = computeAge(d('2000-02-29'), d('2026-11-16'))!;
    expect(iso(a.nextBirthday)).toBe('2027-02-28');
    expect(a.turning).toBe(27);
    // il 28 febbraio 2025 ha già compiuto 25 anni
    const b = computeAge(d('2000-02-29'), d('2025-02-28'))!;
    expect(b.years).toBe(25);
    expect(b.isBirthdayToday).toBe(true);
  });
  it('nato oggi e data futura', () => {
    const a = computeAge(d('2026-11-16'), d('2026-11-16'))!;
    expect([a.years, a.months, a.days, a.totalDays]).toEqual([0, 0, 0, 0]);
    expect(computeAge(d('2030-01-01'), d('2026-11-16'))).toBeNull();
    expect(compareDates(d('2024-01-01'), d('2024-01-02'))).toBeLessThan(0);
  });
});

describe('ymdToUtcMs', () => {
  it('gestisce gli anni 1-99 senza spostarli al 1900', () => {
    const dt = new Date(ymdToUtcMs({ y: 50, m: 3, d: 7 }));
    expect(dt.getUTCFullYear()).toBe(50);
    expect(dt.getUTCMonth()).toBe(2);
    expect(dt.getUTCDate()).toBe(7);
  });
});
