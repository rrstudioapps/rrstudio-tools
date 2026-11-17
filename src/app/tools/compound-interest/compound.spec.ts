// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { CompoundInput, CompoundResult, chartBars, computeCompound, csvRows, effectiveAnnualRate, roundCents, validate } from './compound';

const base: CompoundInput = {
  principal: 10000,
  contribution: 0,
  frequency: 'monthly',
  timing: 'end',
  ratePct: 5,
  compounding: 1,
  years: 10,
  inflationPct: 0,
  taxPct: 0,
};
function run(over: Partial<CompoundInput>): CompoundResult {
  const o = computeCompound({ ...base, ...over });
  if (!o.ok) throw new Error(o.error);
  return o.result;
}

describe('formule chiuse', () => {
  it('capitale unico, capitalizzazione annuale: P(1+r)^n', () => {
    const r = run({});
    expect(r.final).toBeCloseTo(10000 * Math.pow(1.05, 10), 6);
    expect(roundCents(r.final)).toBe(16288.95);
    expect(roundCents(r.interest)).toBe(6288.95);
    expect(r.deposited).toBe(10000);
  });
  it('capitale unico, capitalizzazione mensile: P(1+r/12)^(12n)', () => {
    const r = run({ compounding: 12 });
    expect(r.final).toBeCloseTo(10000 * Math.pow(1 + 0.05 / 12, 120), 6);
    expect(roundCents(r.final)).toBe(16470.09);
  });
  it('capitale unico, trimestrale e semestrale', () => {
    expect(run({ compounding: 4 }).final).toBeCloseTo(10000 * Math.pow(1.0125, 40), 6);
    expect(run({ compounding: 2 }).final).toBeCloseTo(10000 * Math.pow(1.025, 20), 6);
  });
  it('capitale unico, capitalizzazione giornaliera: equivale al tasso effettivo', () => {
    const r = run({ compounding: 365 });
    expect(r.final).toBeCloseTo(10000 * Math.pow(1 + 0.05 / 365, 3650), 4);
  });
  it('versamenti mensili a fine mese, capitalizzazione mensile: C((1+i)^N−1)/i', () => {
    // 200 €/mese, 6% annuo (0,5% al mese), 20 anni: montante 92.408,18 €
    const r = run({ principal: 0, contribution: 200, ratePct: 6, compounding: 12, years: 20 });
    const i = 0.005;
    expect(r.final).toBeCloseTo((200 * (Math.pow(1 + i, 240) - 1)) / i, 5);
    expect(roundCents(r.final)).toBe(92408.18);
    expect(r.deposited).toBe(48000);
    expect(roundCents(r.interest)).toBe(44408.18);
  });
  it('versamenti all\'inizio del mese: rendita anticipata, × (1+i)', () => {
    const end = run({ principal: 0, contribution: 200, ratePct: 6, compounding: 12, years: 20 });
    const start = run({ principal: 0, contribution: 200, ratePct: 6, compounding: 12, years: 20, timing: 'start' });
    expect(start.final).toBeCloseTo(end.final * 1.005, 6);
  });
  it('capitale più versamenti mensili', () => {
    const r = run({ principal: 5000, contribution: 100, ratePct: 3, compounding: 12, years: 10 });
    const i = 0.0025;
    const expected = 5000 * Math.pow(1 + i, 120) + (100 * (Math.pow(1 + i, 120) - 1)) / i;
    expect(r.final).toBeCloseTo(expected, 6);
    expect(r.deposited).toBe(5000 + 100 * 120);
  });
  it('versamenti annuali a fine anno, capitalizzazione annuale: C((1+r)^n−1)/r', () => {
    const r = run({ principal: 0, contribution: 1000, frequency: 'yearly', ratePct: 5, years: 10 });
    expect(r.final).toBeCloseTo((1000 * (Math.pow(1.05, 10) - 1)) / 0.05, 6);
    expect(roundCents(r.final)).toBe(12577.89);
    expect(r.deposited).toBe(10000);
  });
  it('versamenti annuali a inizio anno: rendita anticipata, × (1+r)', () => {
    const r = run({ principal: 0, contribution: 1000, frequency: 'yearly', timing: 'start', ratePct: 5, years: 10 });
    expect(r.final).toBeCloseTo((1000 * (Math.pow(1.05, 10) - 1) * 1.05) / 0.05, 6);
    expect(roundCents(r.final)).toBe(13206.79);
  });
  it('tasso zero: solo somma dei versamenti', () => {
    const r = run({ principal: 1000, contribution: 50, ratePct: 0, years: 3 });
    expect(r.final).toBe(1000 + 50 * 36);
    expect(r.interest).toBeCloseTo(0, 9);
    const y = run({ principal: 0, contribution: 300, frequency: 'yearly', ratePct: 0, years: 4 });
    expect(y.final).toBe(1200);
  });
});

describe('tasso effettivo', () => {
  it('formule note', () => {
    expect(effectiveAnnualRate(12, 12)).toBeCloseTo(0.126825030, 8);
    expect(effectiveAnnualRate(5, 1)).toBeCloseTo(0.05, 12);
    expect(effectiveAnnualRate(8, 4)).toBeCloseTo(0.08243216, 8);
    expect(run({ ratePct: 12, compounding: 12 }).effectiveRatePct).toBeCloseTo(12.682503, 5);
  });
});

describe('inflazione e tassazione', () => {
  it('valore reale = montante / (1+i)^anni', () => {
    const r = run({ inflationPct: 2 });
    expect(r.real).toBeCloseTo(r.final / Math.pow(1.02, 10), 8);
    expect(roundCents(r.real)).toBe(13362.61);
    expect(run({ inflationPct: 0 }).real).toBeCloseTo(r.final, 8);
  });
  it('ogni riga ha il suo valore reale', () => {
    const r = run({ inflationPct: 3, years: 5 });
    for (const row of r.rows) expect(row.real).toBeCloseTo(row.balance / Math.pow(1.03, row.year), 8);
  });
  it('tassazione sui rendimenti: solo sugli interessi, una volta', () => {
    const r = run({ taxPct: 20 });
    expect(r.tax).toBeCloseTo(r.interest * 0.2, 8);
    expect(r.netFinal).toBeCloseTo(10000 + r.interest * 0.8, 8);
    expect(r.netInterest).toBeCloseTo(r.interest * 0.8, 8);
    expect(run({}).tax).toBe(0);
  });
  it('valore reale netto', () => {
    const r = run({ taxPct: 25, inflationPct: 2 });
    expect(r.netReal).toBeCloseTo(r.netFinal / Math.pow(1.02, 10), 8);
  });
});

describe('tabella anno per anno', () => {
  it('una riga per anno, coerente con il totale', () => {
    const r = run({ principal: 1000, contribution: 100, ratePct: 4, compounding: 12, years: 7 });
    expect(r.rows).toHaveLength(7);
    expect(r.rows.map((x) => x.year)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const last = r.rows[6];
    expect(last.balance).toBe(r.final);
    expect(last.deposited).toBe(r.deposited);
    for (const x of r.rows) expect(x.balance).toBeCloseTo(x.deposited + x.interest, 8);
  });
  it('primo anno, versamenti mensili a fine mese, 12% mensile 1%: 100·((1,01)^12−1)/0,01', () => {
    const r = run({ principal: 0, contribution: 100, ratePct: 12, compounding: 12, years: 1 });
    expect(roundCents(r.rows[0].balance)).toBe(1268.25);
    expect(r.rows[0].deposited).toBe(1200);
  });
  it('crescita monotona', () => {
    const r = run({ contribution: 50, ratePct: 2, years: 30 });
    for (let k = 1; k < r.rows.length; k++) expect(r.rows[k].balance).toBeGreaterThan(r.rows[k - 1].balance);
  });
  it('CSV', () => {
    const csv = csvRows(run({ years: 2, ratePct: 0 }).rows).split('\n');
    expect(csv[0]).toBe('year,deposited,interest,balance,real');
    expect(csv[1]).toBe('1,10000.00,0.00,10000.00,10000.00');
    expect(csv).toHaveLength(3);
  });
});

describe('validazione', () => {
  const err = (over: Partial<CompoundInput>) => validate({ ...base, ...over });
  it('input validi', () => {
    expect(err({})).toBeNull();
    expect(err({ principal: 0, contribution: 10 })).toBeNull();
  });
  it('errori', () => {
    expect(err({ principal: 0 })).toBe('nothing');
    expect(err({ principal: -1 })).toBe('negative');
    expect(err({ contribution: -5 })).toBe('negative');
    expect(err({ ratePct: -1 })).toBe('rate');
    expect(err({ ratePct: 101 })).toBe('rate');
    expect(err({ years: 0 })).toBe('years');
    expect(err({ years: 101 })).toBe('years');
    expect(err({ years: 2.5 })).toBe('years');
    expect(err({ inflationPct: 150 })).toBe('inflation');
    expect(err({ taxPct: 120 })).toBe('tax');
    expect(err({ principal: NaN })).toBe('amount');
    expect(err({ principal: 1e13 })).toBe('amount');
    expect(computeCompound({ ...base, ratePct: -3 })).toEqual({ ok: false, error: 'rate' });
  });
});

describe('arrotondamento', () => {
  it('al centesimo, anche per metà esatte', () => {
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(2.675)).toBe(2.68);
    expect(roundCents(1234.5649)).toBe(1234.56);
    expect(roundCents(-1.005)).toBe(-1.01);
  });
});

describe('grafico', () => {
  it('barre impilate: il massimo occupa tutta l\'altezza', () => {
    const r = run({ principal: 1000, contribution: 0, ratePct: 10, years: 3 });
    const bars = chartBars(r.rows, 300, 100);
    expect(bars).toHaveLength(3);
    const last = bars[2];
    expect(last.depositedH + last.interestH).toBeCloseTo(100, 8);
    expect(last.interestY).toBeCloseTo(0, 8);
    expect(last.depositedY).toBeCloseTo(100 - last.depositedH, 8);
    expect(bars[0].x).toBeLessThan(bars[1].x);
    expect(bars[2].x + bars[2].width).toBeLessThanOrEqual(300);
    // la parte versata è la stessa in ogni barra con solo capitale iniziale
    expect(bars[0].depositedH).toBeCloseTo(last.depositedH, 8);
  });
  it('senza righe nessuna barra', () => {
    expect(chartBars([], 100, 100)).toEqual([]);
  });
  it('100 anni: nessuna barra esce dall\'area', () => {
    const bars = chartBars(run({ years: 100, contribution: 10 }).rows, 600, 200);
    expect(bars).toHaveLength(100);
    for (const b of bars) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(600 + 1e-9);
      expect(b.interestY).toBeGreaterThanOrEqual(-1e-9);
    }
  });
});
