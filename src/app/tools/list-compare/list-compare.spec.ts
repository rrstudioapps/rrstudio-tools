// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { DEFAULT_OPTIONS, compareLists, duplicatesToText, splitLines, type CompareOptions } from './list-compare';

const opt = (o: Partial<CompareOptions> = {}): CompareOptions => ({ ...DEFAULT_OPTIONS, ...o });

describe('splitLines', () => {
  it('vuoto = nessuna riga', () => {
    expect(splitLines('')).toEqual([]);
  });
  it('CRLF, CR e LF; a capo finale ignorato', () => {
    expect(splitLines('a\r\nb\rc\nd\n')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('righe vuote in mezzo restano', () => {
    expect(splitLines('a\n\nb')).toEqual(['a', '', 'b']);
  });
});

describe('compareLists: basi', () => {
  it('insiemi vuoti', () => {
    const r = compareLists('', '');
    expect(r).toMatchObject({ countA: 0, countB: 0, union: [], common: [], onlyA: [], onlyB: [], dupA: [], dupB: [] });
  });
  it('A vuoto', () => {
    const r = compareLists('', 'x\ny');
    expect(r.onlyB).toEqual(['x', 'y']);
    expect(r.common).toEqual([]);
    expect(r.union).toEqual(['x', 'y']);
  });
  it('unione, comuni, solo A, solo B', () => {
    const r = compareLists('mela\npera\nkiwi', 'pera\nbanana\nkiwi\nfico');
    expect(r.union).toEqual(['mela', 'pera', 'kiwi', 'banana', 'fico']);
    expect(r.common).toEqual(['pera', 'kiwi']);
    expect(r.onlyA).toEqual(['mela']);
    expect(r.onlyB).toEqual(['banana', 'fico']);
    expect(r.countA).toBe(3);
    expect(r.countB).toBe(4);
  });
  it('elenchi identici', () => {
    const r = compareLists('a\nb', 'a\nb');
    expect(r.onlyA).toEqual([]);
    expect(r.onlyB).toEqual([]);
    expect(r.common).toEqual(['a', 'b']);
  });
  it('CRLF nei due elenchi', () => {
    const r = compareLists('a\r\nb\r\n', 'b\r\nc');
    expect(r.common).toEqual(['b']);
    expect(r.onlyA).toEqual(['a']);
  });
});

describe('doppioni', () => {
  it('solo doppioni', () => {
    const r = compareLists('x\nx\nx', 'y\ny');
    expect(r.dupA).toEqual([{ value: 'x', count: 3 }]);
    expect(r.dupB).toEqual([{ value: 'y', count: 2 }]);
    expect(r.countA).toBe(3);
    expect(r.uniqueA).toBe(1);
    expect(r.union).toEqual(['x', 'y']);
  });
  it('un doppione in A non rende la voce "comune" due volte', () => {
    const r = compareLists('a\na\nb', 'a');
    expect(r.common).toEqual(['a']);
    expect(r.onlyA).toEqual(['b']);
  });
  it('nessun doppione', () => {
    expect(compareLists('a\nb', 'c').dupA).toEqual([]);
  });
  it('testo dei doppioni', () => {
    expect(duplicatesToText([{ value: 'x', count: 3 }, { value: 'y', count: 2 }])).toBe('x\t3\ny\t2');
    expect(duplicatesToText([])).toBe('');
  });
});

describe('opzioni', () => {
  it('maiuscole distinte per default', () => {
    expect(compareLists('Mela', 'mela').common).toEqual([]);
  });
  it('ignora maiuscole: mostra la prima incontrata', () => {
    const r = compareLists('Mela\nMELA\nPera', 'mela\nPERA', opt({ ignoreCase: true }));
    expect(r.common).toEqual(['Mela', 'Pera']);
    expect(r.dupA).toEqual([{ value: 'Mela', count: 2 }]);
    expect(r.union).toEqual(['Mela', 'Pera']);
  });
  it('unicode: è e È', () => {
    expect(compareLists('è', 'È', opt({ ignoreCase: true })).common).toEqual(['è']);
  });
  it('spazi a inizio e fine voce', () => {
    expect(compareLists('  a  \nb', 'a\t\nb ').common).toEqual(['a', 'b']);
  });
  it('senza trim gli spazi contano', () => {
    const r = compareLists('a \nb', 'a\nb', opt({ trim: false }));
    expect(r.common).toEqual(['b']);
    expect(r.onlyA).toEqual(['a ']);
  });
  it('righe vuote ignorate (anche solo spazi)', () => {
    const r = compareLists('a\n\n  \nb', 'b', opt());
    expect(r.countA).toBe(2);
    expect(r.union).toEqual(['a', 'b']);
  });
  it('righe vuote come voci', () => {
    const r = compareLists('a\n\n\n', 'b\n\n', opt({ ignoreEmpty: false }));
    expect(r.common).toEqual(['']);
    expect(r.dupA).toEqual([{ value: '', count: 2 }]);
  });
});

describe('ordinamento', () => {
  it('A→Z con accenti e maiuscole', () => {
    const r = compareLists('zebra\nÈlla\nalfa\nBeta', '', opt({ sort: 'az' }));
    expect(r.union).toEqual(['alfa', 'Beta', 'Èlla', 'zebra']);
  });
  it('numerico naturale: 2 prima di 10', () => {
    const r = compareLists('10\n2\n1\nfile10\nfile9\nfile1', 'x', opt({ sort: 'natural' }));
    expect(r.onlyA).toEqual(['1', '2', '10', 'file1', 'file9', 'file10']);
  });
  it('A→Z puro mette 10 prima di 2', () => {
    expect(compareLists('2\n10', '', opt({ sort: 'az' })).union).toEqual(['10', '2']);
  });
  it('ordina anche i doppioni', () => {
    const r = compareLists('b\nb\na\na\na', '', opt({ sort: 'az' }));
    expect(r.dupA.map((d) => d.value)).toEqual(['a', 'b']);
  });
  it('ordine di apparizione per default', () => {
    expect(compareLists('c\nb\na', 'a\nd', opt()).union).toEqual(['c', 'b', 'a', 'd']);
  });
});

describe('prestazioni', () => {
  it('10.000 voci per elenco in tempi ragionevoli', () => {
    const mk = (from: number, n: number) => Array.from({ length: n }, (_, i) => `voce ${from + i}`).join('\n');
    const start = performance.now();
    const r = compareLists(mk(0, 10_000), mk(5_000, 10_000), opt({ sort: 'natural', ignoreCase: true }));
    expect(performance.now() - start).toBeLessThan(2000);
    expect(r.common.length).toBe(5_000);
    expect(r.union.length).toBe(15_000);
  });
  it('200.000 voci senza cicli annidati', () => {
    const a = Array.from({ length: 200_000 }, (_, i) => `k${i}`).join('\n');
    const b = Array.from({ length: 200_000 }, (_, i) => `k${i + 100_000}`).join('\n');
    const start = performance.now();
    const r = compareLists(a, b);
    expect(performance.now() - start).toBeLessThan(3000);
    expect(r.common.length).toBe(100_000);
  });
});
