// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { fromRoman, toRoman } from './roman';

describe('toRoman', () => {
  it('casi noti', () => {
    expect([1, 4, 9, 14, 40, 90, 400, 1994, 2024, 3999].map((n) => toRoman(n))).toEqual([
      'I', 'IV', 'IX', 'XIV', 'XL', 'XC', 'CD', 'MCMXCIV', 'MMXXIV', 'MMMCMXCIX',
    ]);
  });
  it('fuori intervallo', () => {
    expect(toRoman(0)).toBeNull();
    expect(toRoman(4000)).toBeNull();
    expect(toRoman(1.5)).toBeNull();
    expect(toRoman(-3)).toBeNull();
  });
  it('vinculum: le migliaia da 4000 portano la linea sopra', () => {
    expect(toRoman(4000, true)).toBe('I̅V̅');
    expect(toRoman(1_000_000, true)).toBe('M̅');
    expect(toRoman(4001, true)).toBe('I̅V̅I');
    expect(toRoman(3_999_999, true)).toBe('M̅M̅M̅C̅M̅X̅C̅I̅X̅CMXCIX');
    expect(toRoman(4_000_000, true)).toBeNull();
    expect(toRoman(3999, true)).toBe('MMMCMXCIX');
  });
});

describe('fromRoman', () => {
  it('forme canoniche, anche in minuscolo e con spazi', () => {
    expect(fromRoman('MCMXCIV')).toEqual({ ok: true, value: 1994 });
    expect(fromRoman(' mmxxvi ')).toEqual({ ok: true, value: 2026 });
    expect(fromRoman('IV')).toEqual({ ok: true, value: 4 });
  });
  it('andata e ritorno su tutto 1–3999', () => {
    for (let n = 1; n <= 3999; n++) expect(fromRoman(toRoman(n)!)).toEqual({ ok: true, value: n });
  });
  it('IIII: ripetizione, con suggerimento IV', () => {
    expect(fromRoman('IIII')).toMatchObject({ ok: false, error: 'repeat', suggestion: 'IV' });
  });
  it('VV, LL, DD: V, L e D non si ripetono', () => {
    expect(fromRoman('VV')).toMatchObject({ ok: false, error: 'repeatVLD' });
    expect(fromRoman('VIV')).toMatchObject({ ok: false, error: 'repeatVLD' });
  });
  it('VX, IC, IL, XM: sottrazioni non ammesse', () => {
    expect(fromRoman('VX')).toMatchObject({ ok: false, error: 'subtract', detail: 'VX' });
    expect(fromRoman('IC')).toMatchObject({ ok: false, error: 'subtract', detail: 'IC' });
    expect(fromRoman('IL')).toMatchObject({ ok: false, error: 'subtract' });
    expect(fromRoman('XM')).toMatchObject({ ok: false, error: 'subtract' });
  });
  it('IIX e simili: ordine non canonico', () => {
    expect(fromRoman('IIX')).toMatchObject({ ok: false, error: 'order' });
    expect(fromRoman('IXI')).toMatchObject({ ok: false });
  });
  it('MMMM è una ripetizione', () => {
    expect(fromRoman('MMMM')).toMatchObject({ ok: false, error: 'repeat' });
  });
  it('vuoto e caratteri estranei', () => {
    expect(fromRoman('  ')).toEqual({ ok: false, error: 'empty' });
    expect(fromRoman('XAV')).toMatchObject({ ok: false, error: 'chars', detail: 'A' });
  });
  it('vinculum solo in modalità estesa', () => {
    expect(fromRoman('I̅V̅')).toMatchObject({ ok: false, error: 'needExtended' });
    expect(fromRoman('I̅V̅', true)).toEqual({ ok: true, value: 4000 });
    expect(fromRoman('M̅M̅X̅X̅VI', true)).toEqual({ ok: true, value: 2_020_006 });
  });
  it('estesa: andata e ritorno su campioni', () => {
    for (const n of [4000, 4001, 5000, 12345, 999_999, 1_000_000, 3_999_999]) expect(fromRoman(toRoman(n, true)!, true)).toEqual({ ok: true, value: n });
  });
  it('estesa: sotto 4000 con linea sopra non è canonica', () => {
    expect(fromRoman('M̅', true)).toEqual({ ok: true, value: 1_000_000 });
    expect(fromRoman('X̅X̅', true)).toEqual({ ok: true, value: 20000 });
  });
});
