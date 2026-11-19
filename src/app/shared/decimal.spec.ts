// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { formatNumber, parseDecimal } from './decimal';

describe('parseDecimal', () => {
  it('italiano: virgola decimale, punto delle migliaia', () => {
    expect(parseDecimal('1,5', 'it')).toBe(1.5);
    expect(parseDecimal('1.234,56', 'it')).toBe(1234.56);
    expect(parseDecimal('1.500', 'it')).toBe(1500);
    expect(parseDecimal('1.5', 'it')).toBe(1.5);
    expect(parseDecimal('1.234.567', 'it')).toBe(1234567);
  });
  it('inglese: punto decimale, virgola delle migliaia', () => {
    expect(parseDecimal('1.5', 'en')).toBe(1.5);
    expect(parseDecimal('1,234.56', 'en')).toBe(1234.56);
    expect(parseDecimal('1,500', 'en')).toBe(1500);
    expect(parseDecimal('1,5', 'en')).toBe(1.5);
  });
  it('segno, spazi, percentuale ed esponente', () => {
    expect(parseDecimal('-3,5', 'it')).toBe(-3.5);
    expect(parseDecimal('−3.5', 'en')).toBe(-3.5);
    expect(parseDecimal('+7', 'en')).toBe(7);
    expect(parseDecimal(' 12 % ', 'it')).toBe(12);
    expect(parseDecimal('1e3', 'en')).toBe(1000);
    expect(parseDecimal('2,5E-2', 'it')).toBe(0.025);
    expect(parseDecimal(',5', 'it')).toBe(0.5);
  });
  it('errori', () => {
    for (const s of ['', ' ', 'abc', '1,2,3', '1.2.3', '-', '1..2', '12a', '1,234.5,6', 'e5']) {
      expect(parseDecimal(s, 'it'), s).toBeNull();
    }
    expect(parseDecimal('1e999', 'en')).toBeNull();
  });
});

describe('formatNumber', () => {
  it('raggruppa le migliaia e usa i separatori della lingua', () => {
    expect(formatNumber(1234.5, 'it')).toBe('1.234,5');
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
    expect(formatNumber(1234567, 'it')).toBe('1.234.567');
    expect(formatNumber(-1234.5, 'en')).toBe('-1,234.5');
  });
  it('toglie il rumore della virgola mobile e gli zeri finali', () => {
    expect(formatNumber(0.1 + 0.2, 'en')).toBe('0.3');
    expect(formatNumber(2.5, 'en')).toBe('2.5');
    expect(formatNumber(100, 'en')).toBe('100');
  });
  it('limite dei decimali e zero negativo', () => {
    expect(formatNumber(1 / 3, 'en', 4)).toBe('0.3333');
    expect(formatNumber(-0.00001, 'en', 4)).toBe('0');
    expect(formatNumber(0, 'it')).toBe('0');
  });
  it('notazione scientifica per valori estremi', () => {
    expect(formatNumber(1.5e-9, 'en')).toBe('1.5e-9');
    expect(formatNumber(2e20, 'it')).toBe('2e20');
    expect(formatNumber(1.25e-8, 'it')).toBe('1,25e-8');
  });
  it('valori non finiti', () => {
    expect(formatNumber(Infinity, 'en')).toBe('Infinity');
  });
});
