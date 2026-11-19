// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { PctResult, applyPercent, percentChange, percentOf, reversePercent, whatPercent } from './percentage';

const val = (r: PctResult): number => (r.ok ? r.value : NaN);

describe('X% di Y', () => {
  it('casi semplici', () => {
    expect(val(percentOf(20, 150))).toBe(30);
    expect(val(percentOf(50, 80))).toBe(40);
    expect(val(percentOf(0, 80))).toBe(0);
    expect(val(percentOf(100, 7))).toBe(7);
  });
  it('percentuali sopra il 100% e negative', () => {
    expect(val(percentOf(150, 40))).toBe(60);
    expect(val(percentOf(-10, 50))).toBe(-5);
  });
  it('decimali', () => {
    expect(val(percentOf(7.5, 200))).toBeCloseTo(15, 10);
    expect(val(percentOf(22, 100))).toBe(22);
  });
});

describe('X è che % di Y', () => {
  it('casi noti', () => {
    expect(val(whatPercent(30, 150))).toBe(20);
    expect(val(whatPercent(1, 4))).toBe(25);
    expect(val(whatPercent(200, 100))).toBe(200);
    expect(val(whatPercent(0, 9))).toBe(0);
  });
  it('divisione per zero', () => {
    expect(whatPercent(5, 0)).toEqual({ ok: false, error: 'divZero' });
  });
});

describe('variazione percentuale', () => {
  it('aumento e calo', () => {
    expect(val(percentChange(100, 120))).toBe(20);
    expect(val(percentChange(120, 100))).toBeCloseTo(-16.6667, 3);
    expect(val(percentChange(50, 50))).toBe(0);
    expect(val(percentChange(80, 0))).toBe(-100);
  });
  it('partendo da un valore negativo il segno resta sensato', () => {
    // da -50 a -25 è un aumento
    expect(val(percentChange(-50, -25))).toBe(50);
    expect(val(percentChange(-50, -100))).toBe(-100);
  });
  it('partendo da zero non è definita', () => {
    expect(percentChange(0, 10)).toEqual({ ok: false, error: 'divZero' });
  });
});

describe('aggiunta e sconto', () => {
  it('sconto del 20% su 80 = 64; aumento del 22% su 100 = 122', () => {
    expect(val(applyPercent(80, 20, -1))).toBe(64);
    expect(val(applyPercent(100, 22, 1))).toBe(122);
  });
  it('sconto del 100% azzera, oltre il 100% va in negativo', () => {
    expect(val(applyPercent(50, 100, -1))).toBe(0);
    expect(val(applyPercent(50, 150, -1))).toBe(-25);
  });
  it('sconti non si sommano: -10% poi +10% non torna al punto di partenza', () => {
    const down = val(applyPercent(100, 10, -1));
    expect(val(applyPercent(down, 10, 1))).toBeCloseTo(99, 10);
  });
});

describe('percentuale inversa', () => {
  it('prezzo finito 80 dopo -20%: partiva da 100', () => {
    expect(val(reversePercent(80, 20, -1))).toBe(100);
  });
  it('prezzo con IVA 122 al 22%: imponibile 100', () => {
    expect(val(reversePercent(122, 22, 1))).toBe(100);
  });
  it('è l\'inverso di applyPercent', () => {
    const f = val(applyPercent(37.5, 15, -1));
    expect(val(reversePercent(f, 15, -1))).toBeCloseTo(37.5, 10);
  });
  it('sconto del 100%: non ricavabile; -100% in aumento sì', () => {
    expect(reversePercent(0, 100, -1)).toEqual({ ok: false, error: 'rate100' });
    expect(reversePercent(0, 100, 1)).toEqual({ ok: true, value: 0 });
  });
});
