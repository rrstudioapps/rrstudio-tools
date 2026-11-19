// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { accessibilityWarnings, fluidClamp, fluidScale, parseRatio, parseSize, scaleToCss, sizeAt, trimNumber } from './clamp';

const base = { minSize: 16, maxSize: 24, minVw: 320, maxVw: 1280, rootPx: 16 };
function ok(i = base) {
  const r = fluidClamp(i);
  if ('error' in r) throw new Error(r.error);
  return r;
}

describe('lunghezze e numeri', () => {
  it('parseSize', () => {
    expect(parseSize('16', 'px', 16)).toBe(16);
    expect(parseSize('16px', 'rem', 16)).toBe(16);
    expect(parseSize('1.5rem', 'px', 16)).toBe(24);
    expect(parseSize('1,5', 'rem', 16)).toBe(24);
    expect(parseSize('1.5 REM', 'px', 10)).toBe(15);
    expect(parseSize('.5rem', 'px', 16)).toBe(8);
    expect(parseSize('', 'px', 16)).toBeNull();
    expect(parseSize('0', 'px', 16)).toBeNull();
    expect(parseSize('-4', 'px', 16)).toBeNull();
    expect(parseSize('2em', 'px', 16)).toBeNull();
    expect(parseSize('abc', 'px', 16)).toBeNull();
  });
  it('trimNumber', () => {
    expect(trimNumber(0.83333333)).toBe('0.8333');
    expect(trimNumber(1)).toBe('1');
    expect(trimNumber(1.5)).toBe('1.5');
    expect(trimNumber(-0.00001)).toBe('0');
    expect(trimNumber(0)).toBe('0');
    expect(trimNumber(-0.5)).toBe('-0.5');
  });
  it('parseRatio', () => {
    expect(parseRatio('1,25')).toBe(1.25);
    expect(parseRatio('1.618')).toBe(1.618);
    expect(parseRatio('0.9')).toBeNull();
    expect(parseRatio('4')).toBeNull();
    expect(parseRatio('x')).toBeNull();
  });
});

describe('clamp fluido', () => {
  it('16px a 320 → 24px a 1280', () => {
    const r = ok();
    expect(r.css).toBe('clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)');
    expect(r.slopeVw).toBeCloseTo(0.83333, 4);
    expect(r.interceptPx).toBeCloseTo(13.3333, 4);
  });
  it('il valore calcolato tocca minimo e massimo agli estremi della viewport', () => {
    expect(sizeAt(base, 320)).toBeCloseTo(16, 6);
    expect(sizeAt(base, 1280)).toBeCloseTo(24, 6);
    expect(sizeAt(base, 800)).toBeCloseTo(20, 6);
    expect(sizeAt(base, 100)).toBe(16);
    expect(sizeAt(base, 3000)).toBe(24);
  });
  it('base root diversa da 16', () => {
    const r = ok({ ...base, rootPx: 10, minSize: 10, maxSize: 20, minVw: 400, maxVw: 1000 });
    expect(r.css).toBe('clamp(1rem, 0.3333rem + 1.6667vw, 2rem)');
  });
  it('intercetta negativa', () => {
    const r = ok({ minSize: 16, maxSize: 64, minVw: 320, maxVw: 1280, rootPx: 16 });
    expect(r.interceptPx).toBeCloseTo(0, 6);
    const n = ok({ minSize: 16, maxSize: 96, minVw: 480, maxVw: 960, rootPx: 16 });
    expect(n.interceptPx).toBeLessThan(0);
    expect(n.css).toBe('clamp(1rem, -4rem + 16.6667vw, 6rem)');
  });
  it('dimensione decrescente: gli estremi del clamp si scambiano', () => {
    const r = ok({ ...base, minSize: 24, maxSize: 16 });
    expect(r.decreasing).toBe(true);
    expect(r.css).toBe('clamp(1rem, 1.6667rem - 0.8333vw, 1.5rem)');
  });
  it('dimensioni uguali: valore fisso', () => {
    const r = ok({ ...base, maxSize: 16 });
    expect(r.constant).toBe(true);
    expect(r.css).toBe('1rem');
  });
  it('errori', () => {
    expect(fluidClamp({ ...base, minVw: 1280, maxVw: 320 })).toEqual({ error: 'viewport' });
    expect(fluidClamp({ ...base, minVw: 500, maxVw: 500 })).toEqual({ error: 'viewport' });
    expect(fluidClamp({ ...base, minSize: 0 })).toEqual({ error: 'size' });
    expect(fluidClamp({ ...base, rootPx: 0 })).toEqual({ error: 'root' });
  });
});

describe('accessibilità WCAG 1.4.4', () => {
  it('rapporto oltre 2,5 avvisa, fino a 2,5 no', () => {
    expect(accessibilityWarnings(ok({ ...base, minSize: 16, maxSize: 40 }))).toEqual([]);
    expect(accessibilityWarnings(ok({ ...base, minSize: 16, maxSize: 41 }))).toEqual(['ratio']);
    expect(accessibilityWarnings(ok({ ...base, minSize: 41, maxSize: 16 }))).toEqual(['ratio']);
  });
  it('testo piccolissimo', () => {
    expect(accessibilityWarnings(ok({ ...base, minSize: 10, maxSize: 12 }))).toEqual(['tiny']);
  });
});

describe('scala tipografica', () => {
  const sc = { ...base, minSize: 16, maxSize: 20, minRatio: 1.2, maxRatio: 1.25, from: -2, to: 5 };
  it('otto passi con nomi --step--2 … --step-5', () => {
    const s = fluidScale(sc);
    if ('error' in s) throw new Error(s.error);
    expect(s).toHaveLength(8);
    expect(s[0].name).toBe('--step--2');
    expect(s[2].name).toBe('--step-0');
    expect(s[7].name).toBe('--step-5');
  });
  it('il passo 0 è la dimensione base', () => {
    const s = fluidScale(sc);
    if ('error' in s) throw new Error(s.error);
    expect(s[2].minPx).toBe(16);
    expect(s[2].maxPx).toBe(20);
    expect(s[2].css).toBe(ok({ ...base, maxSize: 20 }).css);
  });
  it('i passi seguono il rapporto', () => {
    const s = fluidScale(sc);
    if ('error' in s) throw new Error(s.error);
    expect(s[3].minPx).toBeCloseTo(19.2, 6);
    expect(s[3].maxPx).toBeCloseTo(25, 6);
    expect(s[0].minPx).toBeCloseTo(16 / 1.44, 6);
    expect(s[0].maxPx).toBeCloseTo(20 / 1.5625, 6);
  });
  it('variabili CSS', () => {
    const s = fluidScale({ ...sc, from: 0, to: 1 });
    if ('error' in s) throw new Error(s.error);
    const css = scaleToCss(s);
    expect(css.startsWith(':root {\n  --step-0: clamp(')).toBe(true);
    expect(css.trimEnd().endsWith('}')).toBe(true);
    expect(css.split('\n').filter((l) => l.includes('--step-'))).toHaveLength(2);
  });
  it('prefisso personalizzato e errori', () => {
    const s = fluidScale({ ...sc, from: 0, to: 0, prefix: '--fs-' });
    if ('error' in s) throw new Error(s.error);
    expect(s[0].name).toBe('--fs-0');
    expect(fluidScale({ ...sc, from: 3, to: 1 })).toEqual({ error: 'steps' });
    expect(fluidScale({ ...sc, from: 0, to: 50 })).toEqual({ error: 'steps' });
    expect(fluidScale({ ...sc, minVw: 900, maxVw: 100 })).toEqual({ error: 'viewport' });
  });
});
