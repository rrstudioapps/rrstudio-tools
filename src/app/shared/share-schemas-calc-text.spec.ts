// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { SHARE_SCHEMA as ASPECT } from '../tools/aspect-ratio-calculator/aspect-ratio-calculator.share';
import { SHARE_SCHEMA as CIPHERS } from '../tools/classic-ciphers/classic-ciphers.share';
import { SHARE_SCHEMA as LIRE } from '../tools/convertitore-lire-euro/convertitore-lire-euro.share';
import { SHARE_SCHEMA as MORSE } from '../tools/morse-code/morse-code.share';
import { SHARE_SCHEMA as ROMAN } from '../tools/roman-numerals/roman-numerals.share';
import { SHARE_SCHEMA as STATS } from '../tools/statistics-calculator/statistics-calculator.share';
import { SHARE_SCHEMA as UNICODE } from '../tools/unicode-inspector/unicode-inspector.share';
import { validateState } from './share-state';

describe('schemi di condivisione: calcolatori e strumenti di testo', () => {
  it('statistics-calculator: origine, colonna e percentile entro i limiti', () => {
    expect(validateState(STATS, { source: 'csv', input: 'a;b', column: 2, header: true, percentile: 90, bins: 0 })).toEqual({ source: 'csv', input: 'a;b', column: 2, header: true, percentile: 90, bins: 0 });
    expect(validateState(STATS, { source: 'xml', column: 0, percentile: 101, bins: 61 })).toBeNull();
  });
  it('aspect-ratio-calculator: modalità, lato e arrotondamento', () => {
    expect(validateState(ASPECT, { mode: 'solve', side: 'height', rounding: 'multiple8', value: '720' })).toEqual({ mode: 'solve', side: 'height', rounding: 'multiple8', value: '720' });
    expect(validateState(ASPECT, { mode: 'x', side: 'depth', rounding: 'floor' })).toBeNull();
  });
  it('roman-numerals', () => {
    expect(validateState(ROMAN, { input: 'MCMXCIV', extended: true })).toEqual({ input: 'MCMXCIV', extended: true });
    expect(validateState(ROMAN, { input: 'x'.repeat(101), extended: 'sì' })).toBeNull();
  });
  it('unicode-inspector: testo con limite', () => {
    expect(validateState(UNICODE, { input: 'ciao' })).toEqual({ input: 'ciao' });
    expect(validateState(UNICODE, { input: 'a'.repeat(3001) })).toBeNull();
  });
  it('morse-code: velocità e frequenza entro i limiti, formati ammessi', () => {
    expect(validateState(MORSE, { mode: 'decode', wpm: 20, freq: 700, symbols: 'dots', letterSep: 'double', wordSep: 'bar', input: '...' })).not.toBeNull();
    expect(validateState(MORSE, { wpm: 4, freq: 2000, symbols: 'x', wordSep: 'tab' })).toBeNull();
    expect(validateState(MORSE, { wpm: 15.5 })).toBeNull();
  });
  it('classic-ciphers: cifrario e spostamento', () => {
    expect(validateState(CIPHERS, { cipher: 'vigenere', decrypt: true, key: 'limone', shift: -3, input: 'x' })).toEqual({ cipher: 'vigenere', decrypt: true, key: 'limone', shift: -3, input: 'x' });
    expect(validateState(CIPHERS, { cipher: 'enigma', shift: 26 })).toBeNull();
  });
  it('convertitore-lire-euro', () => {
    expect(validateState(LIRE, { mode: 'toLire', amount: '1936,27' })).toEqual({ mode: 'toLire', amount: '1936,27' });
    expect(validateState(LIRE, { mode: 'toDollar' })).toBeNull();
  });
});
