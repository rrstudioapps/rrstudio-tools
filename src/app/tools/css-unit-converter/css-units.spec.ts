// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  CssContext,
  DEFAULT_CONTEXT,
  convert,
  convertAll,
  convertCssBlock,
  formatCssNumber,
  formatCssValue,
  quickTable,
  validContext,
} from './css-units';

const ctx = DEFAULT_CONTEXT;

describe('conversioni', () => {
  it('px ⇄ rem ed em', () => {
    expect(convert(16, 'px', 'rem', ctx)).toBe(1);
    expect(convert(24, 'px', 'rem', ctx)).toBe(1.5);
    expect(convert(2, 'rem', 'px', ctx)).toBe(32);
    expect(convert(10, 'px', 'em', { ...ctx, parentPx: 20 })).toBe(0.5);
    expect(convert(1.5, 'em', 'px', { ...ctx, parentPx: 20 })).toBe(30);
  });
  it('rem e em usano basi diverse', () => {
    const c: CssContext = { ...ctx, rootPx: 10, parentPx: 20 };
    expect(convert(1, 'rem', 'px', c)).toBe(10);
    expect(convert(1, 'em', 'px', c)).toBe(20);
    expect(convert(1, 'rem', 'em', c)).toBe(0.5);
  });
  it('unità assolute CSS', () => {
    expect(convert(1, 'in', 'px', ctx)).toBe(96);
    expect(convert(72, 'pt', 'in', ctx)).toBeCloseTo(1, 10);
    expect(convert(12, 'pt', 'px', ctx)).toBeCloseTo(16, 10);
    expect(convert(2.54, 'cm', 'in', ctx)).toBeCloseTo(1, 10);
    expect(convert(25.4, 'mm', 'in', ctx)).toBeCloseTo(1, 10);
    expect(convert(1, 'cm', 'mm', ctx)).toBeCloseTo(10, 10);
    expect(convert(1, 'pc', 'pt', ctx)).toBeCloseTo(12, 10);
  });
  it('vw, vh e percentuale', () => {
    const c: CssContext = { rootPx: 16, parentPx: 20, viewportW: 1000, viewportH: 500 };
    expect(convert(10, 'vw', 'px', c)).toBe(100);
    expect(convert(10, 'vh', 'px', c)).toBe(50);
    expect(convert(50, 'percent', 'px', c)).toBe(10);
    expect(convert(100, 'px', 'vw', c)).toBe(10);
    expect(convert(100, 'vw', 'vh', c)).toBe(200);
  });
  it('la stessa unità restituisce il valore invariato', () => {
    expect(convert(1.234, 'rem', 'rem', ctx)).toBe(1.234);
  });
  it('convertAll copre tutte le unità e conserva quella di partenza', () => {
    const r = convertAll(16, 'px', ctx);
    expect(r.px).toBe(16);
    expect(r.rem).toBe(1);
    expect(r.em).toBe(1);
    expect(r.pt).toBeCloseTo(12, 10);
    expect(r.percent).toBe(100);
    expect(r.vw).toBeCloseTo(1.25, 10);
    expect(r.vh).toBeCloseTo(16 / 7.2, 10);
    expect(r.in).toBeCloseTo(1 / 6, 10);
    expect(Object.keys(r)).toHaveLength(11);
  });
  it('contesto non valido', () => {
    expect(validContext(ctx)).toBe(true);
    expect(validContext({ ...ctx, rootPx: 0 })).toBe(false);
    expect(validContext({ ...ctx, viewportW: NaN })).toBe(false);
    expect(validContext({ ...ctx, parentPx: -1 })).toBe(false);
  });
});

describe('formattazione', () => {
  it('toglie gli zeri inutili', () => {
    expect(formatCssNumber(1)).toBe('1');
    expect(formatCssNumber(1.5)).toBe('1.5');
    expect(formatCssNumber(0.3333333)).toBe('0.3333');
    expect(formatCssNumber(0.00001)).toBe('0');
    expect(formatCssNumber(-0.00001)).toBe('0');
    expect(formatCssNumber(123456.789, 2)).toBe('123456.79');
    expect(formatCssNumber(1e21, 2)).toBe('');
    expect(formatCssNumber(NaN)).toBe('');
  });
  it('zero senza unità', () => {
    expect(formatCssValue(0, 'px')).toBe('0');
    expect(formatCssValue(1.5, 'rem')).toBe('1.5rem');
    expect(formatCssValue(50, 'percent')).toBe('50%');
  });
});

describe('tabella rapida', () => {
  it('px → rem', () => {
    const t = quickTable('rem', ctx);
    expect(t.find((r) => r.px === 16)?.value).toBe(1);
    expect(t.find((r) => r.px === 24)?.value).toBe(1.5);
    expect(t.find((r) => r.px === 12)?.value).toBe(0.75);
  });
  it('segue la dimensione radice', () => {
    const t = quickTable('rem', { ...ctx, rootPx: 10 });
    expect(t.find((r) => r.px === 20)?.value).toBe(2);
  });
});

describe('conversione in blocco', () => {
  const toRem = { from: 'px', to: 'rem' } as const;
  it('converte tutte le px in rem', () => {
    const r = convertCssBlock('a { margin: 8px 16px; padding: 0 24px; font-size: 14px; }', ctx, toRem);
    expect(r.css).toBe('a { margin: 0.5rem 1rem; padding: 0 1.5rem; font-size: 0.875rem; }');
    expect(r.count).toBe(4);
  });
  it('zero resta 0 senza unità', () => {
    expect(convertCssBlock('a{margin:0px}', ctx, toRem).css).toBe('a{margin:0}');
  });
  it('gestisce negativi e decimali', () => {
    expect(convertCssBlock('a{margin:-8px .5px -0.5px}', ctx, toRem).css).toBe('a{margin:-0.5rem 0.0313rem -0.0313rem}');
  });
  it('rispetta la dimensione radice', () => {
    expect(convertCssBlock('a{width:100px}', { ...ctx, rootPx: 10 }, toRem).css).toBe('a{width:10rem}');
  });
  it('lascia stare commenti, stringhe, url e @media', () => {
    const css = '/* 10px */ a{content:"12px"; background:url(a-20px.png); width:10px}\n@media (min-width: 768px){b{height:32px}}';
    const r = convertCssBlock(css, ctx, toRem);
    expect(r.css).toBe('/* 10px */ a{content:"12px"; background:url(a-20px.png); width:0.625rem}\n@media (min-width: 768px){b{height:2rem}}');
    expect(r.count).toBe(2);
  });
  it('converte anche @media se richiesto', () => {
    const r = convertCssBlock('@media (min-width: 768px){b{height:32px}}', ctx, { ...toRem, convertMedia: true });
    expect(r.css).toBe('@media (min-width: 48rem){b{height:2rem}}');
  });
  it('non tocca identificatori e unità più lunghe', () => {
    const r = convertCssBlock('.w-10px{a:b} #c10px{} a{width:10pxx; x:calc(100% - 8px); y: 5px}', ctx, toRem);
    expect(r.css).toBe('.w-10px{a:b} #c10px{} a{width:10pxx; x:calc(100% - 0.5rem); y: 0.3125rem}');
  });
  it('mantiene 1px se richiesto', () => {
    const r = convertCssBlock('a{border:1px solid; margin:2px; top:-1px}', ctx, { ...toRem, keepHairline: true });
    expect(r.css).toBe('a{border:1px solid; margin:0.125rem; top:-1px}');
    expect(r.count).toBe(1);
  });
  it('converte in em usando il genitore', () => {
    expect(convertCssBlock('a{padding:10px}', { ...ctx, parentPx: 20 }, { from: 'px', to: 'em' }).css).toBe('a{padding:0.5em}');
  });
  it('direzione inversa rem → px', () => {
    expect(convertCssBlock('a{margin:1.5rem 0.25rem}', ctx, { from: 'rem', to: 'px' }).css).toBe('a{margin:24px 4px}');
  });
  it('le maiuscole dell\'unità sono accettate', () => {
    expect(convertCssBlock('a{margin:16PX}', ctx, toRem).css).toBe('a{margin:1rem}');
  });
  it('testo senza px non cambia', () => {
    const r = convertCssBlock('a{color:red;margin:1em}', ctx, toRem);
    expect(r.css).toBe('a{color:red;margin:1em}');
    expect(r.count).toBe(0);
  });
  it('limita i decimali', () => {
    expect(convertCssBlock('a{margin:5px}', ctx, { ...toRem, decimals: 2 }).css).toBe('a{margin:0.31rem}');
  });
});
