// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  HARMONY_OFFSETS,
  SHADE_STEPS,
  cssVarName,
  harmony,
  hslToRgb,
  hwbToRgb,
  oklabToRgb,
  oklchInSrgb,
  oklchToRgb,
  parseColor,
  representations,
  rgbToCmyk,
  rgbToHsl,
  rgbToHwb,
  rgbToOklab,
  rgbToOklch,
  shadeScale,
  shadesToCss,
  shadesToJson,
  toHex,
  toOklchString,
} from './color-convert';

const rgb = (s: string) => {
  const p = parseColor(s);
  if (!p) throw new Error('non valido: ' + s);
  return p.rgb;
};

describe('OKLab/OKLCH: valori di riferimento', () => {
  it('bianco e nero', () => {
    const w = rgbToOklab({ r: 255, g: 255, b: 255 });
    expect(w.l).toBeCloseTo(1, 4);
    expect(w.a).toBeCloseTo(0, 4);
    expect(w.b).toBeCloseTo(0, 4);
    const k = rgbToOklab({ r: 0, g: 0, b: 0 });
    expect(k.l).toBeCloseTo(0, 6);
  });

  it('rosso, verde e blu primari (Ottosson)', () => {
    const r = rgbToOklab({ r: 255, g: 0, b: 0 });
    expect(r.l).toBeCloseTo(0.62796, 4);
    expect(r.a).toBeCloseTo(0.22486, 4);
    expect(r.b).toBeCloseTo(0.12585, 4);
    const rc = rgbToOklch({ r: 255, g: 0, b: 0 });
    expect(rc.c).toBeCloseTo(0.25768, 4);
    expect(rc.h).toBeCloseTo(29.23, 1);
    const g = rgbToOklch({ r: 0, g: 255, b: 0 });
    expect(g.l).toBeCloseTo(0.86644, 4);
    expect(g.c).toBeCloseTo(0.29483, 4);
    expect(g.h).toBeCloseTo(142.5, 0);
    const b = rgbToOklch({ r: 0, g: 0, b: 255 });
    expect(b.l).toBeCloseTo(0.45201, 4);
    expect(b.c).toBeCloseTo(0.31321, 4);
    expect(b.h).toBeCloseTo(264.05, 0);
  });

  it('un grigio ha croma nulla', () => {
    expect(rgbToOklch({ r: 128, g: 128, b: 128 }).c).toBe(0);
  });

  it('round-trip sRGB → OKLCH → sRGB su una griglia di colori', () => {
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const back = oklchToRgb(rgbToOklch({ r, g, b }));
          expect(back.clipped).toBe(false);
          expect(back.rgb).toEqual({ r, g, b });
        }
      }
    }
  });

  it('round-trip sRGB → OKLab → sRGB', () => {
    for (const c of ['#663399', '#ff8000', '#123456', '#fedcba']) {
      const o = rgb(c);
      expect(oklabToRgb(rgbToOklab(o)).rgb).toEqual({ r: o.r, g: o.g, b: o.b });
    }
  });
});

describe('gamut', () => {
  it('rileva un OKLCH fuori da sRGB e lo riporta dentro riducendo la croma', () => {
    const wide = { l: 0.7, c: 0.4, h: 150 };
    expect(oklchInSrgb(wide)).toBe(false);
    const r = oklchToRgb(wide);
    expect(r.clipped).toBe(true);
    for (const v of Object.values(r.rgb)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
    // la luminosità resta (circa) quella richiesta
    expect(rgbToOklch(r.rgb).l).toBeCloseTo(0.7, 1);
  });

  it('un colore dentro il gamut non viene segnalato', () => {
    expect(oklchInSrgb({ l: 0.6, c: 0.1, h: 200 })).toBe(true);
    expect(parseColor('oklch(60% 0.1 200)')?.outOfGamut).toBe(false);
  });

  it('parseColor segnala outOfGamut per oklch() molto saturo', () => {
    const p = parseColor('oklch(70% 0.4 150)');
    expect(p?.outOfGamut).toBe(true);
    expect(p?.format).toBe('oklch');
  });
});

describe('HSL, HWB, CMYK', () => {
  it('HSL di colori noti', () => {
    expect(rgbToHsl({ r: 255, g: 128, b: 0 })).toMatchObject({ h: expect.closeTo(30.12, 1), s: 100, l: 50 });
    const p = rgbToHsl(rgb('rebeccapurple'));
    expect(Math.round(p.h)).toBe(270);
    expect(Math.round(p.s)).toBe(50);
    expect(Math.round(p.l)).toBe(40);
    expect(rgbToHsl({ r: 10, g: 10, b: 10 }).s).toBe(0);
  });

  it('HSL → RGB', () => {
    expect(hslToRgb(0, 100, 50).map(Math.round)).toEqual([255, 0, 0]);
    expect(hslToRgb(120, 100, 25).map(Math.round)).toEqual([0, 128, 0]);
    expect(hslToRgb(-120, 100, 50).map(Math.round)).toEqual([0, 0, 255]);
  });

  it('HWB di colori noti', () => {
    const p = rgbToHwb(rgb('rebeccapurple'));
    expect(Math.round(p.h)).toBe(270);
    expect(Math.round(p.w)).toBe(20);
    expect(Math.round(p.b)).toBe(40);
    expect(hwbToRgb(0, 0, 0).map(Math.round)).toEqual([255, 0, 0]);
    expect(hwbToRgb(270, 20, 40).map(Math.round)).toEqual([102, 51, 153]);
  });

  it('HWB con bianco + nero ≥ 100% diventa un grigio', () => {
    expect(hwbToRgb(0, 50, 50).map(Math.round)).toEqual([128, 128, 128]);
    expect(hwbToRgb(200, 100, 100).map(Math.round)).toEqual([128, 128, 128]);
  });

  it('CMYK indicativo', () => {
    expect(rgbToCmyk({ r: 255, g: 0, b: 0 })).toEqual({ c: 0, m: 100, y: 100, k: 0 });
    expect(rgbToCmyk({ r: 0, g: 0, b: 0 })).toEqual({ c: 0, m: 0, y: 0, k: 100 });
    expect(rgbToCmyk({ r: 255, g: 255, b: 255 })).toEqual({ c: 0, m: 0, y: 0, k: 0 });
  });

  it('round-trip RGB → HSL/HWB → RGB', () => {
    for (const c of ['#663399', '#ff8000', '#123456', '#fedcba', '#00ff7f']) {
      const o = rgb(c);
      const h = rgbToHsl(o);
      expect(hslToRgb(h.h, h.s, h.l).map(Math.round)).toEqual([o.r, o.g, o.b]);
      const w = rgbToHwb(o);
      expect(hwbToRgb(w.h, w.w, w.b).map(Math.round)).toEqual([o.r, o.g, o.b]);
    }
  });
});

describe('parseColor', () => {
  it('HEX 3, 4, 6 e 8 cifre, con e senza #', () => {
    expect(parseColor('#f80')?.rgb).toEqual({ r: 255, g: 136, b: 0, a: 1 });
    expect(parseColor('#f808')?.rgb.a).toBeCloseTo(0.5333, 3);
    expect(parseColor('FF8000')?.rgb).toEqual({ r: 255, g: 128, b: 0, a: 1 });
    expect(parseColor('#ff800080')?.rgb).toEqual({ r: 255, g: 128, b: 0, a: 0.502 });
    expect(parseColor('#ff80')?.format).toBe('hex');
  });

  it('hex di lunghezza sbagliata o non esadecimale', () => {
    expect(parseColor('#ff')).toBeNull();
    expect(parseColor('#fffff')).toBeNull();
    expect(parseColor('#ggg')).toBeNull();
  });

  it('nomi CSS, anche con maiuscole e spazi', () => {
    expect(parseColor('  RebeccaPurple ')?.rgb).toEqual({ r: 102, g: 51, b: 153, a: 1 });
    expect(parseColor('tomato')?.format).toBe('name');
    expect(parseColor('transparent')?.rgb.a).toBe(0);
    expect(parseColor('nonuncolore')).toBeNull();
  });

  it('rgb() con virgole, spazi, percentuali e alfa', () => {
    expect(parseColor('rgb(255, 128, 0)')?.rgb).toEqual({ r: 255, g: 128, b: 0, a: 1 });
    expect(parseColor('rgb(255 128 0 / 50%)')?.rgb).toEqual({ r: 255, g: 128, b: 0, a: 0.5 });
    expect(parseColor('rgba(100%, 0%, 0%, 0.25)')?.rgb).toEqual({ r: 255, g: 0, b: 0, a: 0.25 });
    expect(parseColor('rgb(300 -5 0)')?.rgb).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor('rgb(1 2)')).toBeNull();
  });

  it('hsl() con unità dell\'angolo', () => {
    expect(parseColor('hsl(30 100% 50%)')?.rgb).toEqual({ r: 255, g: 128, b: 0, a: 1 });
    expect(parseColor('hsl(0.5turn 100% 50%)')).toEqual(parseColor('hsl(180deg 100% 50%)'));
    expect(parseColor('hsla(120, 100%, 25%, 1)')?.rgb).toEqual({ r: 0, g: 128, b: 0, a: 1 });
  });

  it('hwb()', () => {
    expect(parseColor('hwb(270 20% 40%)')?.rgb).toEqual({ r: 102, g: 51, b: 153, a: 1 });
    expect(parseColor('hwb(0 0% 0% / 0.5)')?.rgb).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    expect(parseColor('hwb(0 0% 0%)')?.format).toBe('hwb');
  });

  it('oklch() e oklab() in numeri e percentuali', () => {
    const red = parseColor('oklch(62.8% 0.2577 29.23)')?.rgb;
    expect(red).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor('oklch(0.628 0.2577 29.23)')?.rgb).toEqual(red);
    expect(parseColor('oklab(62.796% 0.22486 0.12585)')?.rgb).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor('oklab(1 0 0)')?.rgb).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('oklab(1 0 0)')?.format).toBe('oklab');
  });

  it('input vuoto o assurdo', () => {
    expect(parseColor('')).toBeNull();
    expect(parseColor('   ')).toBeNull();
    expect(parseColor('rgb(a b c)')).toBeNull();
    expect(parseColor('oklch(50% x 10)')).toBeNull();
  });
});

describe('scrittura', () => {
  it('rappresentazioni del rosso', () => {
    const r = Object.fromEntries(representations({ r: 255, g: 0, b: 0, a: 1 }).map((x) => [x.key, x.value]));
    expect(r['hex']).toBe('#ff0000');
    expect(r['rgb']).toBe('rgb(255 0 0)');
    expect(r['hsl']).toBe('hsl(0 100% 50%)');
    expect(r['hwb']).toBe('hwb(0 0% 0%)');
    expect(r['oklch']).toBe('oklch(62.8% 0.2577 29.23)');
    expect(r['oklab']).toBe('oklab(62.8% 0.2249 0.1258)');
    expect(r['cmyk']).toBe('cmyk(0% 100% 100% 0%)');
  });

  it('con trasparenza l\'alfa compare in tutte le funzioni e nell\'HEX a 8 cifre', () => {
    const r = Object.fromEntries(representations({ r: 255, g: 0, b: 0, a: 0.5 }).map((x) => [x.key, x.value]));
    expect(r['hex']).toBe('#ff000080');
    expect(r['rgb']).toBe('rgb(255 0 0 / 0.5)');
    expect(r['oklch']).toContain('/ 0.5)');
  });

  it('il testo scritto si rilegge dando lo stesso colore (entro l\'arrotondamento della notazione)', () => {
    for (const c of ['#663399', '#ff8000', '#123456', '#00ff7f', '#fedcba']) {
      const o = rgb(c);
      for (const rep of representations(o)) {
        if (rep.key === 'cmyk') continue; // non è un formato CSS
        const back = parseColor(rep.value)!.rgb;
        // HSL e HWB sono arrotondati a interi: l'errore può arrivare a qualche unità; gli altri sono esatti o a ±1
        const tol = rep.key === 'hsl' || rep.key === 'hwb' ? 3 : rep.key === 'hex' || rep.key === 'rgb' ? 0 : 1;
        for (const ch of ['r', 'g', 'b'] as const) {
          expect(Math.abs(back[ch] - o[ch]), `${c} ${rep.key} ${ch}`).toBeLessThanOrEqual(tol);
        }
      }
    }
  });

  it('toHex e toOklchString', () => {
    expect(toHex({ r: 1, g: 2, b: 3, a: 1 })).toBe('#010203');
    expect(toOklchString({ r: 255, g: 255, b: 255, a: 1 })).toBe('oklch(100% 0 0)');
  });
});

describe('palette', () => {
  it('scala 50-950 con 11 gradini, luminosità decrescente e un solo gradino base', () => {
    const base = rgb('#3b82f6');
    const scale = shadeScale(base);
    expect(scale.map((s) => s.name)).toEqual(SHADE_STEPS.map(String));
    const ls = scale.map((s) => rgbToOklch(rgb(s.hex)).l);
    for (let i = 1; i < ls.length; i++) expect(ls[i]).toBeLessThan(ls[i - 1]);
    expect(scale.filter((s) => s.base)).toHaveLength(1);
    expect(scale.find((s) => s.base)?.hex).toBe('#3b82f6');
  });

  it('la tinta resta (circa) quella di partenza', () => {
    const base = rgb('#3b82f6');
    const h0 = rgbToOklch(base).h;
    for (const s of shadeScale(base)) {
      const o = rgbToOklch(rgb(s.hex));
      if (o.c > 0.02) expect(Math.abs(o.h - h0)).toBeLessThan(12);
    }
  });

  it('un grigio dà una scala di grigi', () => {
    for (const s of shadeScale(rgb('#808080'))) {
      const c = rgb(s.hex);
      expect(Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)).toBeLessThanOrEqual(1);
    }
  });

  it('armonie: numero di campioni e tinte ruotate', () => {
    const base = rgb('#e11d48');
    const h0 = rgbToOklch(base).h;
    expect(harmony(base, 'complementary')).toHaveLength(2);
    expect(harmony(base, 'analogous')).toHaveLength(3);
    expect(harmony(base, 'triadic')).toHaveLength(3);
    expect(harmony(base, 'analogous')[1].base).toBe(true);
    const comp = rgbToOklch(rgb(harmony(base, 'complementary')[1].hex));
    const diff = Math.abs(((comp.h - h0 + 360) % 360) - 180);
    expect(diff).toBeLessThan(8);
    expect(HARMONY_OFFSETS.triadic).toEqual([120, 240]);
  });
});

describe('esportazione', () => {
  const shades = shadeScale(rgb('#3b82f6'));
  it('variabili CSS', () => {
    const css = shadesToCss(shades, 'Brand Blue');
    expect(css.startsWith(':root {\n  --brand-blue-50: #')).toBe(true);
    expect(css).toContain('--brand-blue-950: #');
    expect(css.split('\n')).toHaveLength(13);
  });
  it('JSON', () => {
    const j = JSON.parse(shadesToJson(shades, 'brand'));
    expect(Object.keys(j.brand)).toEqual(SHADE_STEPS.map(String));
    expect(j.brand['500']).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('nome di variabile sicuro', () => {
    expect(cssVarName('  Blu Notte! ')).toBe('blu-notte');
    expect(cssVarName('')).toBe('color');
    expect(cssVarName('1a')).toBe('c-1a');
    expect(cssVarName('}; x{')).toBe('x');
  });
});
