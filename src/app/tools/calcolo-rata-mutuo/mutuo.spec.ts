// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { MortgageInput, MortgageResult, computeMortgage, constantPayment, parseRate, parseWhole, scheduleToCsv } from './mutuo';

function run(i: MortgageInput): MortgageResult {
  const o = computeMortgage(i);
  if (!o.ok) throw new Error(o.error);
  return o.result;
}

describe('rata costante (casi noti)', () => {
  it('100.000 € al 3% in 20 anni, rate mensili: 554,60 €', () => {
    const r = run({ capital: 10_000_000, tan: 3, months: 240, periodicity: 'monthly' });
    expect(r.payment).toBe(55460);
    expect(r.periods).toBe(240);
    expect(r.periodicRate).toBeCloseTo(0.25, 10);
  });
  it('200.000 € al 3,5% in 25 anni: 1.001,25 €', () => {
    expect(run({ capital: 20_000_000, tan: 3.5, months: 300, periodicity: 'monthly' }).payment).toBe(100125);
  });
  it('150.000 € al 5% in 30 anni: 805,23 €', () => {
    expect(run({ capital: 15_000_000, tan: 5, months: 360, periodicity: 'monthly' }).payment).toBe(80523);
  });
  it('rate trimestrali e semestrali usano il tasso proporzionale', () => {
    // 100.000 € al 4% in 10 anni, trimestrale: i = 1%, n = 40 -> 3.045,56 €
    const q = run({ capital: 10_000_000, tan: 4, months: 120, periodicity: 'quarterly' });
    expect(q.periods).toBe(40);
    expect(q.periodicRate).toBe(1);
    expect(q.payment).toBe(304556);
    // semestrale: i = 2%, n = 20 -> 6.115,67 €
    const s = run({ capital: 10_000_000, tan: 4, months: 120, periodicity: 'semiannual' });
    expect(s.periods).toBe(20);
    expect(s.payment).toBe(611567);
  });
  it('constantPayment è stabile con tassi minuscoli', () => {
    expect(constantPayment(10_000_000, 1e-12, 120)).toBe(83333);
  });
});

describe('TAN 0%', () => {
  it('rate uguali, zero interessi, ultima rata che chiude il residuo', () => {
    const r = run({ capital: 10_000_000, tan: 0, months: 120, periodicity: 'monthly' });
    expect(r.payment).toBe(83333);
    expect(r.totalInterest).toBe(0);
    expect(r.totalPaid).toBe(10_000_000);
    expect(r.schedule.at(-1)!.payment).toBe(83373);
    expect(r.schedule.at(-1)!.balance).toBe(0);
  });
});

describe('piano di ammortamento', () => {
  const r = run({ capital: 10_000_000, tan: 3, months: 240, periodicity: 'monthly' });
  it('prima rata: interessi 250,00 €, capitale 304,60 €', () => {
    expect(r.schedule[0]).toEqual({ n: 1, payment: 55460, interest: 25000, principal: 30460, balance: 9_969_540 });
  });
  it('il debito scende fino a zero e le quote capitale sommano al capitale', () => {
    expect(r.schedule).toHaveLength(240);
    expect(r.schedule.at(-1)!.balance).toBe(0);
    expect(r.schedule.reduce((s, x) => s + x.principal, 0)).toBe(10_000_000);
    for (let k = 1; k < r.schedule.length; k++) expect(r.schedule[k].balance).toBeLessThan(r.schedule[k - 1].balance);
  });
  it('ogni rata = interessi + capitale; totali coerenti', () => {
    for (const x of r.schedule) expect(x.payment).toBe(x.interest + x.principal);
    expect(r.totalInterest).toBe(r.schedule.reduce((s, x) => s + x.interest, 0));
    expect(r.totalPaid).toBe(r.schedule.reduce((s, x) => s + x.payment, 0));
    // 240 rate da 554,60 circa: interessi vicini a 33.104 €
    expect(r.totalInterest).toBeGreaterThan(3_310_400 - 300);
    expect(r.totalInterest).toBeLessThan(3_310_400 + 300);
  });
  it('l\'ultima rata differisce da quella costante solo di pochi centesimi', () => {
    expect(Math.abs(r.schedule.at(-1)!.payment - r.payment)).toBeLessThan(240);
  });
  it('durata di un solo periodo: una rata sola con interessi', () => {
    const one = run({ capital: 100000, tan: 12, months: 1, periodicity: 'monthly' });
    expect(one.schedule).toEqual([{ n: 1, payment: 101000, interest: 1000, principal: 100000, balance: 0 }]);
  });
});

describe('errori di input', () => {
  const ok: MortgageInput = { capital: 10_000_000, tan: 3, months: 120, periodicity: 'monthly' };
  const err = (o: Partial<MortgageInput>) => {
    const r = computeMortgage({ ...ok, ...o });
    return r.ok ? null : r.error;
  };
  it('capitale non valido', () => {
    expect(err({ capital: 0 })).toBe('capital');
    expect(err({ capital: -5 })).toBe('capital');
    expect(err({ capital: 1.5 })).toBe('capital');
    expect(err({ capital: 1e15 })).toBe('capital');
  });
  it('TAN fuori scala', () => {
    expect(err({ tan: -1 })).toBe('tan');
    expect(err({ tan: 101 })).toBe('tan');
    expect(err({ tan: NaN })).toBe('tan');
  });
  it('durata nulla, troppo lunga o non multipla della periodicità', () => {
    expect(err({ months: 0 })).toBe('duration');
    expect(err({ months: 601 })).toBe('duration');
    expect(err({ months: 62, periodicity: 'quarterly' })).toBe('multiple');
    expect(err({ months: 9, periodicity: 'semiannual' })).toBe('multiple');
    expect(err({ months: 60, periodicity: 'semiannual' })).toBeNull();
  });
});

describe('lettura dei numeri', () => {
  it('parseRate', () => {
    expect(parseRate('3,25')).toBe(3.25);
    expect(parseRate('3.25%')).toBe(3.25);
    expect(parseRate('0')).toBe(0);
    expect(parseRate('2,875')).toBe(2.875);
    expect(parseRate('')).toBeNull();
    expect(parseRate('abc')).toBeNull();
    expect(parseRate('3,2555')).toBeNull();
    expect(parseRate('150')).toBeNull();
    expect(parseRate('-1')).toBeNull();
  });
  it('parseWhole', () => {
    expect(parseWhole('')).toBe(0);
    expect(parseWhole(' 20 ')).toBe(20);
    expect(parseWhole('2,5')).toBeNull();
    expect(parseWhole('-3')).toBeNull();
  });
});

describe('esportazione CSV', () => {
  const rows = [{ n: 1, payment: 55460, interest: 25000, principal: 30460, balance: 9_969_540 }];
  const head = ['N', 'Rata', 'Interessi', 'Capitale', 'Residuo'] as const;
  it('italiano: punto e virgola e virgola decimale', () => {
    expect(scheduleToCsv(rows, head, 'it')).toBe('﻿N;Rata;Interessi;Capitale;Residuo\r\n1;554,60;250,00;304,60;99695,40\r\n');
  });
  it('inglese: virgola e punto decimale', () => {
    expect(scheduleToCsv(rows, head, 'en')).toBe('﻿N,Rata,Interessi,Capitale,Residuo\r\n1,554.60,250.00,304.60,99695.40\r\n');
  });
  it('importi sotto un euro mantengono lo zero davanti', () => {
    expect(scheduleToCsv([{ n: 2, payment: 5, interest: 0, principal: 5, balance: 0 }], head, 'en')).toContain('2,0.05,0.00,0.05,0.00');
  });
});

describe('capitali piccoli e durate lunghe', () => {
  it('nessuna rata negativa, piano completo fino alla scadenza, residuo finale zero', () => {
    for (const tan of [0, 1, 17, 100]) {
      for (const capital of [1, 100, 1000, 5555]) {
        const r = run({ capital, tan, months: 600, periodicity: 'monthly' });
        expect(r.schedule.length).toBe(600);
        expect(r.schedule.every((row) => row.principal >= 0 && row.payment >= 0 && row.balance >= 0)).toBe(true);
        expect(r.schedule[599].balance).toBe(0);
        // il debito non si azzera prima della scadenza (se il capitale in centesimi lo permette)
        if (capital > 1) expect(r.schedule.slice(0, 599).every((row) => row.balance > 0)).toBe(true);
        expect(r.schedule.reduce((a, row) => a + row.principal, 0)).toBe(capital);
      }
    }
  });
});
