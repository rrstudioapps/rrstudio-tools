// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { cssAspectRatio, cssPaddingTop, gcd, nearestPreset, reduceRatio, roundDimension, solveSide } from './aspect-ratio';

describe('rapporto ridotto', () => {
  it('gcd', () => {
    expect(gcd(1920, 1080)).toBe(120);
    expect(gcd(7, 13)).toBe(1);
    expect(gcd(0, 5)).toBe(5);
  });
  it('1920×1080 → 16:9', () => {
    const r = reduceRatio(1920, 1080)!;
    expect([r.w, r.h]).toEqual([16, 9]);
    expect(r.decimal).toBeCloseTo(1.7778, 4);
  });
  it('1366×768 → 683:384 e vicino a 16:9', () => {
    const r = reduceRatio(1366, 768)!;
    expect([r.w, r.h]).toEqual([683, 384]);
    const n = nearestPreset(r.decimal)!;
    expect(n.preset.id).toBe('16-9');
    expect(n.flipped).toBe(false);
    expect(n.error).toBeLessThan(0.001);
  });
  it('dimensioni decimali: solo il valore decimale', () => {
    const r = reduceRatio(100.5, 50)!;
    expect(r.w).toBeNull();
    expect(r.decimal).toBeCloseTo(2.01, 10);
  });
  it('non validi', () => {
    expect(reduceRatio(0, 10)).toBeNull();
    expect(reduceRatio(-1, 10)).toBeNull();
    expect(reduceRatio(NaN, 10)).toBeNull();
  });
  it('preset capovolto: 1080×1920 → 9:16 (preset diretto)', () => {
    expect(nearestPreset(1080 / 1920)!.preset.id).toBe('9-16');
    expect(nearestPreset(2 / 3)!.preset.id).toBe('3-2');
    expect(nearestPreset(2 / 3)!.flipped).toBe(true);
    expect(nearestPreset(1.9)).toBeNull();
  });
  it('A4 riconosciuto', () => expect(nearestPreset(297 / 210)!.preset.id).toBe('a4'));
});

describe('arrotondamento', () => {
  it('modalità', () => {
    expect(roundDimension(100.4, 'integer')).toBe(100);
    expect(roundDimension(101.4, 'even')).toBe(102);
    expect(roundDimension(99, 'multiple8')).toBe(96);
    expect(roundDimension(102, 'multiple8')).toBe(104);
    expect(roundDimension(1.234, 'none')).toBe(1.23);
  });
  it('minimi', () => {
    expect(roundDimension(0.2, 'integer')).toBe(1);
    expect(roundDimension(2, 'multiple8')).toBe(8);
  });
});

describe('solveSide', () => {
  it('16:9 da larghezza 1280 → 720', () => {
    expect(solveSide(16, 9, 'width', 1280, 'integer')).toMatchObject({ width: 1280, height: 720, errorPercent: 0 });
  });
  it('da altezza', () => {
    expect(solveSide(4, 3, 'height', 600, 'integer')).toMatchObject({ width: 800, height: 600 });
  });
  it('arrotondamento intero con scarto', () => {
    const s = solveSide(16, 9, 'width', 1000, 'integer')!;
    expect(s.height).toBe(563);
    expect(Math.abs(s.errorPercent)).toBeLessThan(0.1);
  });
  it('multipli di 8: entrambi i lati', () => {
    const s = solveSide(16, 9, 'width', 1000, 'multiple8')!;
    expect(s.width % 8).toBe(0);
    expect(s.height % 8).toBe(0);
    expect(s).toMatchObject({ width: 1000, height: 560 });
  });
  it('pari', () => {
    const s = solveSide(16, 9, 'width', 1001, 'even')!;
    expect(s.width % 2).toBe(0);
    expect(s.height % 2).toBe(0);
  });
  it('A4: larghezza 210 → altezza 297', () => {
    expect(solveSide(1, Math.SQRT2, 'width', 210, 'integer')).toMatchObject({ width: 210, height: 297 });
  });
  it('input non validi', () => {
    expect(solveSide(0, 9, 'width', 100, 'integer')).toBeNull();
    expect(solveSide(16, 9, 'width', -5, 'integer')).toBeNull();
  });
});

describe('CSS', () => {
  it('aspect-ratio con interi ridotti', () => {
    expect(cssAspectRatio(1920, 1080)).toBe('aspect-ratio: 16 / 9;');
    expect(cssAspectRatio(1, 1)).toBe('aspect-ratio: 1 / 1;');
  });
  it('decimale quando non intero', () => expect(cssAspectRatio(Math.SQRT2, 1)).toBe('aspect-ratio: 1.4142;'));
  it('padding-top di ripiego', () => expect(cssPaddingTop(16, 9)).toBe('padding-top: 56.25%;'));
});
