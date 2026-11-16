// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { MAX_BULK_LINES, analyzeBulk, analyzeValue, csvCell, detectKind, firstIssue, toCsv } from './detect';

describe('riconoscimento del tipo', () => {
  it.each([
    ['DE89 3704 0044 0532 0130 00', 'iban'],
    ['it60x0542811101000000123456', 'iban'],
    ['IBAN: GB82 WEST 1234 5698 7654 32', 'iban'],
    ['NO9386011117947', 'iban'],
    ['12345678903', 'vat'],
    ['IT12345678903', 'vat'],
    ['it 123 456 789 03', 'vat'],
    ['1234567890', 'vat'], // una cifra in meno: partita IVA sbagliata
    ['IT123456789012', 'vat'],
    ['RSSMRA80A01H501U', 'taxcode'],
    ['rssmra80a01h501u', 'taxcode'],
    ['ciao', 'unknown'],
    ['', 'unknown'],
    ['12', 'unknown'],
    ['123456789012345678', 'unknown'],
  ])('%s -> %s', (v, k) => expect(detectKind(v)).toBe(k));
});

describe('analisi di un valore', () => {
  it('IBAN e partita IVA', () => {
    const i = analyzeValue('de89 3704 0044 0532 0130 00', 3);
    expect(i).toMatchObject({ kind: 'iban', valid: true, line: 3, normalized: 'DE89 3704 0044 0532 0130 00' });
    const v = analyzeValue('IT12345678903');
    expect(v).toMatchObject({ kind: 'vat', valid: true, normalized: '12345678903' });
  });
  it('tipo forzato e primo problema', () => {
    const r = analyzeValue('12345678903', 1, 'iban');
    expect(r.kind).toBe('iban');
    expect(r.valid).toBe(false);
    expect(firstIssue(r)).toBe('country-format');
    expect(firstIssue(analyzeValue('ciao'))).toBe('unknown-kind');
    expect(firstIssue(analyzeValue('RSSMRA80A01H501U'))).toBe('taxcode');
    expect(firstIssue(analyzeValue('12345678903'))).toBeNull();
  });
});

describe('verifica di più valori', () => {
  const text = 'DE89370400440532013000\r\n\r\n  IT12345678903 \nDE89370400440532013001\nabc\n12345678900\n';
  it('una riga per valore, righe vuote saltate, numeri di riga originali', () => {
    const { results, truncated } = analyzeBulk(text);
    expect(truncated).toBe(false);
    expect(results.map((r) => [r.line, r.kind, r.valid])).toEqual([
      [1, 'iban', true],
      [3, 'vat', true],
      [4, 'iban', false],
      [5, 'unknown', false],
      [6, 'vat', false],
    ]);
    expect(results[1].input).toBe('IT12345678903');
  });
  it('tipo forzato', () => {
    const { results } = analyzeBulk('12345678903\nIT12345678903', 'vat');
    expect(results.every((r) => r.kind === 'vat' && r.valid)).toBe(true);
  });
  it('limite di righe', () => {
    const many = Array.from({ length: MAX_BULK_LINES + 5 }, () => 'DE89370400440532013000').join('\n');
    const { results, truncated } = analyzeBulk(many);
    expect(results).toHaveLength(MAX_BULK_LINES);
    expect(truncated).toBe(true);
  });
  it('testo vuoto', () => expect(analyzeBulk('  \n\n')).toEqual({ results: [], truncated: false }));
});

describe('CSV', () => {
  it('virgolette, separatori e a capo', () => {
    expect(csvCell('abc', ';')).toBe('abc');
    expect(csvCell('a;b', ';')).toBe('"a;b"');
    expect(csvCell('a;b', ',')).toBe('a;b');
    expect(csvCell('a,b', ',')).toBe('"a,b"');
    expect(csvCell('di "prova"', ';')).toBe('"di ""prova"""');
    expect(csvCell('due\nrighe', ';')).toBe('"due\nrighe"');
  });
  it('neutralizza le formule di Excel', () => {
    expect(csvCell('=1+1', ';')).toBe("'=1+1");
    expect(csvCell('+39', ';')).toBe("'+39");
    expect(csvCell('-5', ';')).toBe("'-5");
    expect(csvCell('@SUM(A1)', ';')).toBe("'@SUM(A1)");
  });
  it('righe con CRLF finale', () => {
    expect(toCsv([['riga', 'valore'], ['1', 'sì']], ';')).toBe('riga;valore\r\n1;sì\r\n');
  });
});
