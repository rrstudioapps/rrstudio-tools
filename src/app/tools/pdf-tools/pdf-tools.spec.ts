// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { dropPosition, moveItem, normalizeRotation } from './page-model';
import { parseRanges } from './page-ranges';
import { baseName, pdfName, splitNames, uniqueNames } from './pdf-names';
import { planSplit } from './split-plan';

const words = { page: 'pagina', pages: 'pagine', part: 'parte' };

describe('parseRanges', () => {
  it('legge intervalli e pagine singole', () => {
    const r = parseRanges('1-3, 5, 8-10', 10);
    expect(r).toEqual({ ok: true, ranges: [{ from: 1, to: 3 }, { from: 5, to: 5 }, { from: 8, to: 10 }] });
  });
  it('ignora spazi, virgole doppie e finali', () => {
    const r = parseRanges('  1 - 3 ,, 5 ,', 5);
    expect(r).toEqual({ ok: true, ranges: [{ from: 1, to: 3 }, { from: 5, to: 5 }] });
  });
  it('accetta il trattino lungo', () => {
    expect(parseRanges('2–4', 5)).toEqual({ ok: true, ranges: [{ from: 2, to: 4 }] });
  });
  it('mantiene separati gli intervalli sovrapposti', () => {
    const r = parseRanges('1-4, 3-6', 6);
    expect(r).toEqual({ ok: true, ranges: [{ from: 1, to: 4 }, { from: 3, to: 6 }] });
  });
  it('segnala testo vuoto', () => {
    expect(parseRanges('  , ', 5)).toMatchObject({ ok: false, error: { code: 'empty' } });
  });
  it('segnala pagine fuori range, zero compreso', () => {
    expect(parseRanges('1-9', 5)).toMatchObject({ ok: false, error: { code: 'outOfRange', token: '1-9', total: 5 } });
    expect(parseRanges('6', 5)).toMatchObject({ ok: false, error: { code: 'outOfRange' } });
    expect(parseRanges('0-2', 5)).toMatchObject({ ok: false, error: { code: 'outOfRange' } });
  });
  it('segnala gli intervalli al contrario', () => {
    expect(parseRanges('5-3', 9)).toMatchObject({ ok: false, error: { code: 'reversed', token: '5-3' } });
  });
  it('segnala sintassi non valida', () => {
    for (const t of ['a', '1-', '-3', '1-2-3', '1.5', '2 3', '-']) {
      expect(parseRanges(t, 9), t).toMatchObject({ ok: false, error: { code: 'syntax' } });
    }
  });
});

describe('planSplit', () => {
  it('una pagina per file', () => {
    expect(planSplit('each', 3, { every: 1, ranges: '' })).toEqual({ ok: true, groups: [[1], [2], [3]] });
  });
  it('ogni N pagine, con resto', () => {
    expect(planSplit('every', 7, { every: 3, ranges: '' })).toEqual({ ok: true, groups: [[1, 2, 3], [4, 5, 6], [7]] });
    expect(planSplit('every', 2, { every: 5, ranges: '' })).toEqual({ ok: true, groups: [[1, 2]] });
  });
  it('rifiuta N non valido', () => {
    for (const n of [0, -1, 1.5, NaN]) {
      expect(planSplit('every', 5, { every: n, ranges: '' })).toMatchObject({ ok: false, error: { code: 'every' } });
    }
  });
  it('per intervalli', () => {
    expect(planSplit('ranges', 10, { every: 1, ranges: '1-3, 5, 8-10' })).toEqual({
      ok: true,
      groups: [[1, 2, 3], [5], [8, 9, 10]],
    });
  });
  it('propaga gli errori degli intervalli', () => {
    expect(planSplit('ranges', 4, { every: 1, ranges: '2-9' })).toMatchObject({ ok: false, error: { code: 'outOfRange' } });
  });
  it('senza pagine non c\'è nulla da dividere', () => {
    expect(planSplit('each', 0, { every: 1, ranges: '' })).toMatchObject({ ok: false, error: { code: 'none' } });
  });
});

describe('nomi dei file', () => {
  it('toglie .pdf e i caratteri vietati', () => {
    expect(baseName('Contratto.PDF')).toBe('Contratto');
    expect(baseName('a/b:c*?.pdf')).toBe('a_b_c__');
    expect(baseName('.pdf')).toBe('documento');
    expect(baseName('  ..nascosto  .pdf')).toBe('nascosto');
  });
  it('compone nome e suffisso', () => {
    expect(pdfName('contratto', 'unito')).toBe('contratto-unito.pdf');
  });
  it('rende unici i nomi ignorando le maiuscole', () => {
    expect(uniqueNames(['a.pdf', 'A.pdf', 'a.pdf', 'b.pdf'])).toEqual(['a.pdf', 'A (2).pdf', 'a (3).pdf', 'b.pdf']);
  });
  it('nomi della divisione: singole, blocchi, gruppi sparsi', () => {
    expect(splitNames('doc', [[1], [2]], 12, words)).toEqual(['doc-pagina-01.pdf', 'doc-pagina-02.pdf']);
    expect(splitNames('doc', [[1, 2, 3], [5]], 10, words)).toEqual(['doc-pagine-01-03.pdf', 'doc-pagina-05.pdf']);
    expect(splitNames('doc', [[1, 3]], 3, words)).toEqual(['doc-parte-1.pdf']);
  });
  it('intervalli ripetuti non producono nomi duplicati', () => {
    expect(splitNames('doc', [[1, 2], [1, 2]], 5, words)).toEqual(['doc-pagine-1-2.pdf', 'doc-pagine-1-2 (2).pdf']);
  });
});

describe('modello delle pagine', () => {
  it('normalizza la rotazione', () => {
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
  });
  it('sposta un elemento', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b'], 0, 9)).toEqual(['b', 'a']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });
  it('posizione di rilascio prima o dopo una carta', () => {
    expect(dropPosition(0, 2, false)).toBe(1); // prima della terza: finisce seconda
    expect(dropPosition(0, 2, true)).toBe(2);
    expect(dropPosition(3, 1, false)).toBe(1);
    expect(dropPosition(3, 1, true)).toBe(2);
    expect(dropPosition(2, 2, true)).toBe(2);
  });
});
