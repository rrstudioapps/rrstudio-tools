// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { computeStats, csvColumns, histogram, parseCsvColumn, parseCsvRows, parseNumberList, percentileSorted, sturges } from './statistics';

describe('parseNumberList', () => {
  it('spazi, a capo e punto e virgola; virgola decimale in italiano', () => {
    const r = parseNumberList('1,5 2,5;3\n4,5', 'it');
    expect(r.values).toEqual([1.5, 2.5, 3, 4.5]);
    expect(r.invalidCount).toBe(0);
  });
  it('in inglese la virgola separa i valori ma 1,234 è un migliaio', () => {
    expect(parseNumberList('1,2,3', 'en').values).toEqual([1, 2, 3]);
    expect(parseNumberList('1,234 5.5', 'en').values).toEqual([1234, 5.5]);
  });
  it('voci non numeriche contate e riportate', () => {
    const r = parseNumberList('1 due 3 x', 'it');
    expect(r.values).toEqual([1, 3]);
    expect(r.invalidCount).toBe(2);
    expect(r.invalid).toEqual(['due', 'x']);
  });
  it('vuoto', () => expect(parseNumberList('  \n ', 'it').values).toEqual([]));
});

describe('CSV', () => {
  const csv = 'nome;voto\nAnna;7,5\nLuca;"8,0"\nMia;\nZoe;x';
  it('delimitatore e colonne', () => {
    expect(parseCsvRows(csv)[1]).toEqual(['Anna', '7,5']);
    expect(csvColumns(csv)).toBe(2);
  });
  it('colonna con intestazione, celle vuote saltate, non numeri segnalati', () => {
    const r = parseCsvColumn(csv, 1, true, 'it');
    expect(r.values).toEqual([7.5, 8]);
    expect(r.invalid).toEqual(['x']);
  });
  it('virgole come delimitatore e virgolette con delimitatore dentro', () => {
    expect(parseCsvRows('a,b\n"1,5",2')[1]).toEqual(['1,5', '2']);
    expect(parseCsvColumn('a,b\n1,2\n3,4', 1, true, 'en').values).toEqual([2, 4]);
  });
});

describe('percentile (metodo inclusivo)', () => {
  it('quartili di 1..9 e di 1..10', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect([25, 50, 75].map((p) => percentileSorted(a, p))).toEqual([3, 5, 7]);
    const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect([25, 50, 75].map((p) => percentileSorted(b, p))).toEqual([3.25, 5.5, 7.75]);
  });
  it('estremi e un solo valore', () => {
    expect(percentileSorted([4, 8], 0)).toBe(4);
    expect(percentileSorted([4, 8], 100)).toBe(8);
    expect(percentileSorted([4], 90)).toBe(4);
  });
});

describe('computeStats', () => {
  it('insieme classico 2 4 4 4 5 5 7 9', () => {
    const s = computeStats([2, 4, 4, 4, 5, 5, 7, 9])!;
    expect(s.count).toBe(8);
    expect(s.sum).toBe(40);
    expect(s.mean).toBe(5);
    expect(s.median).toBe(4.5);
    expect(s.mode).toEqual([4]);
    expect(s.modeCount).toBe(3);
    expect(s.varianceSample).toBeCloseTo(32 / 7, 10);
    expect(s.varianceSample).toBeCloseTo(4.5714285714, 8);
    expect(s.variancePopulation).toBe(4);
    expect(s.sdPopulation).toBe(2);
    expect(s.range).toBe(7);
  });
  it('moda assente se tutti i valori sono diversi; più mode se pari merito', () => {
    expect(computeStats([1, 2, 3])!.mode).toEqual([]);
    expect(computeStats([1, 1, 2, 2, 3])!.mode).toEqual([1, 2]);
  });
  it('un solo valore: deviazione campionaria assente', () => {
    const s = computeStats([5])!;
    expect(s.sdSample).toBeNull();
    expect(s.sdPopulation).toBe(0);
    expect(s.median).toBe(5);
  });
  it('outlier con la regola 1,5 IQR', () => {
    const s = computeStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 100])!;
    expect(s.quartiles.q1).toBe(3.25);
    expect(s.quartiles.q3).toBe(7.75);
    expect(s.quartiles.iqr).toBe(4.5);
    expect(s.fences.high).toBeCloseTo(14.5, 10);
    expect(s.outliers).toEqual([100]);
  });
  it('vuoto → null; decimali e negativi', () => {
    expect(computeStats([])).toBeNull();
    const s = computeStats([-1.5, 0, 1.5])!;
    expect(s.mean).toBe(0);
    expect(s.min).toBe(-1.5);
  });
  it('somma compensata: 0,1 dieci volte', () => {
    expect(computeStats(Array(10).fill(0.1))!.sum).toBeCloseTo(1, 15);
  });
});

describe('histogram', () => {
  it('conta tutti i valori, il massimo sta nell\'ultima classe', () => {
    const h = histogram([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
    expect(h.map((b) => b.count)).toEqual([3, 3, 4]);
    expect(h[2].to).toBe(10);
  });
  it('valori tutti uguali: una classe', () => expect(histogram([2, 2, 2], 5)).toEqual([{ from: 2, to: 2, count: 3 }]));
  it('Sturges', () => {
    expect(sturges(1)).toBe(1);
    expect(sturges(8)).toBe(4);
    expect(sturges(100)).toBe(8);
  });
  it('vuoto', () => expect(histogram([], 4)).toEqual([]));
});
