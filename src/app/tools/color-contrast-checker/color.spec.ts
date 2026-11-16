// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { CSS_COLOR_NAMES } from './color-names';
import {
  Rgba,
  composite,
  contrastRatio,
  displayRatio,
  evaluate,
  hslToRgb,
  oklchToRgb,
  parseColor,
  relativeLuminance,
  rgbToOklch,
  suggestColor,
  toHex,
  toHslString,
  toOklchString,
  toRgbString,
} from './color';

const rgb = (r: number, g: number, b: number, a = 1): Rgba => ({ r, g, b, a });
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(255, 255, 255);

describe('luminanza e contrasto WCAG', () => {
  it('luminanza relativa: nero 0, bianco 1, rosso/verde/blu puri', () => {
    expect(relativeLuminance(BLACK)).toBe(0);
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 10);
    expect(relativeLuminance(rgb(255, 0, 0))).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance(rgb(0, 255, 0))).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance(rgb(0, 0, 255))).toBeCloseTo(0.0722, 4);
  });
  it('nero su bianco = 21:1, simmetrico, uguale = 1:1', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 10);
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 10);
    expect(contrastRatio(rgb(40, 90, 200), rgb(40, 90, 200))).toBe(1);
  });
  it('#777 su bianco ≈ 4,48 (non supera AA); #767676 = 4,54 (lo supera)', () => {
    expect(contrastRatio(rgb(0x77, 0x77, 0x77), WHITE)).toBeCloseTo(4.478, 3);
    const a = evaluate(rgb(0x77, 0x77, 0x77), WHITE);
    expect(displayRatio(a.ratio)).toBe(4.47);
    expect(a.checks).toEqual({ aaNormal: false, aaaNormal: false, aaLarge: true, aaaLarge: false, ui: true });
    const b = evaluate(rgb(0x76, 0x76, 0x76), WHITE);
    expect(displayRatio(b.ratio)).toBe(4.54);
    expect(b.checks.aaNormal).toBe(true);
  });
  it('altri casi noti', () => {
    // #0000ff su bianco = 8,59; #ff0000 su bianco = 4,0
    expect(contrastRatio(rgb(0, 0, 255), WHITE)).toBeCloseTo(8.59, 2);
    expect(contrastRatio(rgb(255, 0, 0), WHITE)).toBeCloseTo(4.0, 2);
    // grigio #595959 su bianco = 7,0 (soglia AAA)
    expect(contrastRatio(rgb(0x59, 0x59, 0x59), WHITE)).toBeCloseTo(7.0, 1);
  });
  it('le soglie usano il valore esatto, il rapporto mostrato non arrotonda per eccesso', () => {
    expect(displayRatio(4.499)).toBe(4.49);
    expect(displayRatio(4.5)).toBe(4.5);
    expect(displayRatio(21)).toBe(21);
    expect(displayRatio(7)).toBe(7);
  });
  it('AAA su nero/bianco passa tutto', () => {
    const e = evaluate(BLACK, WHITE);
    expect(Object.values(e.checks).every(Boolean)).toBe(true);
    const f = evaluate(WHITE, WHITE);
    expect(Object.values(f.checks).some(Boolean)).toBe(false);
  });
});

describe('trasparenza', () => {
  it('compone il colore sullo sfondo', () => {
    expect(composite(rgb(0, 0, 0, 0.5), WHITE)).toEqual(rgb(127.5, 127.5, 127.5));
    expect(composite(rgb(10, 20, 30, 1), WHITE)).toEqual(rgb(10, 20, 30));
    expect(composite(rgb(10, 20, 30, 0), rgb(200, 100, 50))).toEqual(rgb(200, 100, 50));
  });
  it('testo nero al 50% su bianco ≈ grigio 128 → 3,95:1', () => {
    const e = evaluate(rgb(0, 0, 0, 0.5), WHITE);
    expect(e.fg.r).toBeCloseTo(127.5, 5);
    expect(e.ratio).toBeCloseTo(3.95, 1);
  });
  it('sfondo trasparente: si compone sul bianco', () => {
    const e = evaluate(BLACK, rgb(0, 0, 0, 0));
    expect(e.bg).toEqual(WHITE);
    expect(e.ratio).toBeCloseTo(21, 10);
    // sfondo nero al 50%: grigio 127,5 → il testo nero ha un contrasto basso
    expect(evaluate(BLACK, rgb(0, 0, 0, 0.5)).ratio).toBeCloseTo(5.3, 1);
  });
});

describe('parseColor', () => {
  it('HEX 3, 4, 6, 8 cifre, con e senza #', () => {
    expect(parseColor('#fff')).toEqual(WHITE);
    expect(parseColor('#F00')).toEqual(rgb(255, 0, 0));
    expect(parseColor('#1c1c1e')).toEqual(rgb(28, 28, 30));
    expect(parseColor('#00000080')).toEqual(rgb(0, 0, 0, 0.502));
    expect(parseColor('#0f08')).toEqual(rgb(0, 255, 0, 0.5333));
    expect(parseColor('777')).toEqual(rgb(119, 119, 119));
    expect(parseColor('  #AbCdEf ')).toEqual(rgb(171, 205, 239));
  });
  it('rgb() e rgba(), con virgole o spazi, percentuali e alfa', () => {
    expect(parseColor('rgb(255, 128, 0)')).toEqual(rgb(255, 128, 0));
    expect(parseColor('rgb(255 128 0)')).toEqual(rgb(255, 128, 0));
    expect(parseColor('rgba(255, 128, 0, 0.5)')).toEqual(rgb(255, 128, 0, 0.5));
    expect(parseColor('rgb(255 128 0 / 25%)')).toEqual(rgb(255, 128, 0, 0.25));
    expect(parseColor('rgb(100%, 0%, 50%)')).toEqual(rgb(255, 0, 128));
    expect(parseColor('rgb(300, -5, 0)')).toEqual(rgb(255, 0, 0));
    expect(parseColor('RGB(1,2,3)')).toEqual(rgb(1, 2, 3));
  });
  it('hsl() e hsla()', () => {
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual(rgb(255, 0, 0));
    expect(parseColor('hsl(120 100% 25%)')).toEqual(rgb(0, 128, 0));
    expect(parseColor('hsl(240deg 100% 50% / 0.5)')).toEqual(rgb(0, 0, 255, 0.5));
    expect(parseColor('hsla(0.5turn, 100%, 50%, 1)')).toEqual(rgb(0, 255, 255));
    expect(parseColor('hsl(0 0% 100%)')).toEqual(WHITE);
    expect(parseColor('hsl(-120, 100%, 50%)')).toEqual(rgb(0, 0, 255));
  });
  it('nomi CSS, transparent, oklch()', () => {
    expect(parseColor('rebeccapurple')).toEqual(rgb(102, 51, 153));
    expect(parseColor('White')).toEqual(WHITE);
    expect(parseColor('transparent')).toEqual(rgb(0, 0, 0, 0));
    expect(parseColor('oklch(62.8% 0.2577 29.23)')).toEqual(rgb(255, 0, 0));
    expect(parseColor('oklch(1 0 0)')).toEqual(WHITE);
  });
  it('tabella dei nomi completa (148) e coerente', () => {
    expect(CSS_COLOR_NAMES.size).toBe(148);
    for (const hex of CSS_COLOR_NAMES.values()) expect(hex).toMatch(/^[0-9a-f]{6}$/);
  });
  it('non riconosce il resto', () => {
    for (const bad of ['', 'colore', '#12', '#12345', '#gggggg', 'rgb(1,2)', 'rgb(a,b,c)', 'rgb(1 2 3 4 5)', 'hsl(10, 50, )', 'rgb(1, 2, 3', 'oklch(abc)', 'rgb(10px 0 0)']) {
      expect(parseColor(bad), bad).toBeNull();
    }
  });
});

describe('conversioni', () => {
  it('HSL → RGB e ritorno via stringhe', () => {
    expect(hslToRgb(0, 1, 0.5).map(Math.round)).toEqual([255, 0, 0]);
    expect(toHslString(rgb(255, 0, 0))).toBe('hsl(0 100% 50%)');
    expect(toHslString(rgb(119, 119, 119))).toBe('hsl(0 0% 47%)');
    expect(toHslString(rgb(0, 0, 255, 0.5))).toBe('hsl(240 100% 50% / 0.5)');
  });
  it('HEX e rgb()', () => {
    expect(toHex(rgb(28, 28, 30))).toBe('#1c1c1e');
    expect(toHex(rgb(0, 0, 0, 0.5))).toBe('#00000080');
    expect(toRgbString(rgb(1, 2, 3))).toBe('rgb(1 2 3)');
    expect(toRgbString(rgb(1, 2, 3, 0.25))).toBe('rgb(1 2 3 / 0.25)');
  });
  it('OKLCH: valori noti', () => {
    const red = rgbToOklch(rgb(255, 0, 0));
    expect(red.l).toBeCloseTo(0.6279, 3);
    expect(red.c).toBeCloseTo(0.2577, 3);
    expect(red.h).toBeCloseTo(29.23, 1);
    const blue = rgbToOklch(rgb(0, 0, 255));
    expect(blue.l).toBeCloseTo(0.452, 3);
    expect(blue.h).toBeCloseTo(264.05, 1);
    expect(rgbToOklch(WHITE).l).toBeCloseTo(1, 4);
    expect(rgbToOklch(WHITE).c).toBe(0);
    expect(rgbToOklch(BLACK).l).toBeCloseTo(0, 6);
    expect(toOklchString(rgb(255, 0, 0))).toBe('oklch(62.8% 0.258 29.2)');
  });
  it('andata e ritorno RGB → OKLCH → RGB su molti colori', () => {
    for (let r = 0; r < 256; r += 51) for (let g = 0; g < 256; g += 51) for (let b = 0; b < 256; b += 51) {
      const o = rgbToOklch(rgb(r, g, b));
      expect(oklchToRgb(o.l, o.c, o.h)).toEqual({ r, g, b });
    }
  });
  it('fuori gamma: riduce la croma senza uscire da 0-255', () => {
    const c = oklchToRgb(0.7, 0.4, 150);
    for (const v of [c.r, c.g, c.b]) expect(v >= 0 && v <= 255).toBe(true);
    expect(rgbToOklch(c).l).toBeCloseTo(0.7, 1);
  });
});

describe('suggerimento', () => {
  it('il grigio #777 su bianco: il più vicino che raggiunge AA, scurendo', () => {
    const s = suggestColor('fg', rgb(0x77, 0x77, 0x77), WHITE, 4.5);
    expect(s.already).toBe(false);
    expect(s.color).not.toBeNull();
    expect(contrastRatio(s.color!, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(s.deltaL).toBeLessThan(0);
    // molto vicino all'originale: il noto #767676 è il primo grigio a passare
    expect(s.color!.r).toBeLessThanOrEqual(0x76);
    expect(s.color!.r).toBeGreaterThanOrEqual(0x70);
  });
  it('AAA: raggiunge 7:1 e verifica dopo l\'arrotondamento', () => {
    const s = suggestColor('fg', rgb(0x77, 0x77, 0x77), WHITE, 7);
    expect(s.ratio).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(s.color!, WHITE)).toBeGreaterThanOrEqual(7);
  });
  it('già conforme: nessun cambiamento', () => {
    const s = suggestColor('fg', BLACK, WHITE, 7);
    expect(s).toMatchObject({ already: true, deltaL: 0 });
  });
  it('mantiene la tinta: un arancio chiaro su bianco diventa un arancio scuro', () => {
    const start = rgb(255, 153, 51);
    const s = suggestColor('fg', start, WHITE, 4.5);
    expect(s.color).not.toBeNull();
    expect(s.ratio).toBeGreaterThanOrEqual(4.5);
    const h0 = rgbToOklch(start).h;
    const h1 = rgbToOklch(s.color!).h;
    expect(Math.abs(h1 - h0)).toBeLessThan(8);
  });
  it('sfondo scuro: schiarisce il testo; e si può modificare lo sfondo', () => {
    const dark = rgb(30, 30, 40);
    const t = suggestColor('fg', rgb(90, 90, 110), dark, 4.5);
    expect(t.deltaL).toBeGreaterThan(0);
    expect(contrastRatio(t.color!, dark)).toBeGreaterThanOrEqual(4.5);
    const b = suggestColor('bg', rgb(0x77, 0x77, 0x77), WHITE, 4.5);
    expect(b.color).not.toBeNull();
    expect(contrastRatio(rgb(0x77, 0x77, 0x77), b.color!)).toBeGreaterThanOrEqual(4.5);
  });
  it('obiettivo irraggiungibile: nessun colore', () => {
    // sullo sfondo grigio medio il testo non arriva a 7:1 nemmeno con nero o bianco
    const s = suggestColor('fg', rgb(120, 120, 120), rgb(119, 119, 119), 7);
    expect(s.color).toBeNull();
  });
  it('con trasparenza: il risultato soddisfa il rapporto sul colore composto', () => {
    const fg = rgb(120, 120, 120, 0.9);
    const s = suggestColor('fg', fg, WHITE, 4.5);
    expect(s.color).not.toBeNull();
    expect(evaluate(s.color!, WHITE).ratio).toBeGreaterThanOrEqual(4.5);
    expect(s.color!.a).toBe(0.9);
    // nero al 45% su bianco non arriva a 4,5:1 qualunque sia la luminosità
    expect(suggestColor('fg', rgb(0, 0, 0, 0.45), WHITE, 4.5).color).toBeNull();
  });
});
