// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  GRADIENT_PRESETS,
  MAX_SHADOWS,
  MAX_STOPS,
  SHADOW_PRESETS,
  Shadow,
  addStop,
  colorAt,
  cssColor,
  defaultGradient,
  gradientCss,
  gradientValue,
  hexToRgb,
  newShadow,
  normalizeAngle,
  normalizeHex,
  removeStop,
  shadowValue,
  shadowsCss,
  shadowsInline,
  updateShadow,
  updateStop,
} from './css-gen';

describe('colori', () => {
  it('legge hex corti e lunghi', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('1a2B3c')).toEqual({ r: 26, g: 43, b: 60 });
    expect(hexToRgb('#12345')).toBeNull();
    expect(hexToRgb('zzzzzz')).toBeNull();
    expect(hexToRgb('')).toBeNull();
  });
  it('normalizza', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('nope')).toBeNull();
  });
  it('colore opaco o con alfa', () => {
    expect(cssColor('#ff0000')).toBe('#ff0000');
    expect(cssColor('#ff0000', 1)).toBe('#ff0000');
    expect(cssColor('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(cssColor('#000', 0)).toBe('rgba(0, 0, 0, 0)');
    expect(cssColor('#000', 7)).toBe('#000000');
    expect(cssColor('#000', 0.12345)).toBe('rgba(0, 0, 0, 0.123)');
  });
});

describe('gradiente', () => {
  it('lineare', () => {
    expect(gradientValue(defaultGradient())).toBe('linear-gradient(135deg, #6366f1 0%, #ec4899 100%)');
    expect(gradientCss(defaultGradient())).toBe('background: linear-gradient(135deg, #6366f1 0%, #ec4899 100%);');
  });
  it('radiale con centro e forma', () => {
    const g = { ...defaultGradient(), kind: 'radial' as const, shape: 'ellipse' as const, cx: 30, cy: 70 };
    expect(gradientValue(g)).toBe('radial-gradient(ellipse at 30% 70%, #6366f1 0%, #ec4899 100%)');
  });
  it('conico con angolo di partenza', () => {
    const g = { ...defaultGradient(), kind: 'conic' as const, angle: 90 };
    expect(gradientValue(g)).toBe('conic-gradient(from 90deg at 50% 50%, #6366f1 0%, #ec4899 100%)');
  });
  it('ripetuto', () => {
    expect(gradientValue({ ...defaultGradient(), repeating: true })).toMatch(/^repeating-linear-gradient\(/);
  });
  it('ordina gli stop per posizione e usa l\'alfa', () => {
    const g = defaultGradient();
    g.stops = [
      { id: 1, color: '#000000', alpha: 0.5, pos: 80 },
      { id: 2, color: '#ffffff', alpha: 1, pos: 20 },
    ];
    expect(gradientValue(g)).toBe('linear-gradient(135deg, #ffffff 20%, rgba(0, 0, 0, 0.5) 80%)');
  });
  it('normalizza l\'angolo', () => {
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(NaN)).toBe(0);
    expect(gradientValue({ ...defaultGradient(), angle: 360 })).toContain('(0deg');
  });
  it('colore interpolato', () => {
    const s = defaultGradient().stops;
    s[0].color = '#000000';
    s[1].color = '#ffffff';
    expect(colorAt(s, 50).color).toBe('#808080');
    expect(colorAt(s, -10).color).toBe('#000000');
    expect(colorAt(s, 200).color).toBe('#ffffff');
    s[0].alpha = 0;
    expect(colorAt(s, 50).alpha).toBe(0.5);
  });
});

describe('stop', () => {
  it('aggiunge nel tratto più largo', () => {
    const s = addStop(defaultGradient().stops);
    expect(s).toHaveLength(3);
    expect(s[2].pos).toBe(50);
    expect(s[2].id).toBe(3);
    const t = addStop([...s, { id: 9, color: '#000000', alpha: 1, pos: 55 }]);
    expect([25, 75]).toContain(t[t.length - 1].pos);
  });
  it('aggiunge a una posizione data, limitata a 0-100', () => {
    expect(addStop(defaultGradient().stops, 30)[2].pos).toBe(30);
    expect(addStop(defaultGradient().stops, 300)[2].pos).toBe(100);
  });
  it('rispetta il massimo', () => {
    let s = defaultGradient().stops;
    for (let i = 0; i < 30; i++) s = addStop(s);
    expect(s).toHaveLength(MAX_STOPS);
  });
  it('ne lascia sempre almeno due', () => {
    const s = defaultGradient().stops;
    expect(removeStop(s, 1)).toHaveLength(2);
    expect(removeStop(addStop(s), 3)).toHaveLength(2);
  });
  it('aggiorna con limiti', () => {
    const s = updateStop(defaultGradient().stops, 1, { pos: 150, alpha: -1 });
    expect(s[0].pos).toBe(100);
    expect(s[0].alpha).toBe(0);
  });
  it('i preset sono validi', () => {
    for (const p of GRADIENT_PRESETS) {
      const g = p.gradient();
      expect(g.stops.length).toBeGreaterThanOrEqual(2);
      expect(gradientValue(g)).toMatch(/gradient\(/);
    }
  });
});

describe('box-shadow', () => {
  const base: Shadow = { id: 1, x: 0, y: 4, blur: 12, spread: 0, color: '#000000', alpha: 0.25, inset: false };
  it('una ombra', () => {
    expect(shadowValue(base)).toBe('0 4px 12px 0 rgba(0, 0, 0, 0.25)');
    expect(shadowsCss([base])).toBe('box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.25);');
  });
  it('inset e valori negativi', () => {
    expect(shadowValue({ ...base, inset: true, x: -2, spread: -3, alpha: 1 })).toBe('inset -2px 4px 12px -3px #000000');
  });
  it('più ombre', () => {
    const css = shadowsCss([base, { ...base, id: 2, y: 1, blur: 2 }]);
    expect(css).toBe('box-shadow:\n    0 4px 12px 0 rgba(0, 0, 0, 0.25),\n    0 1px 2px 0 rgba(0, 0, 0, 0.25);');
    expect(shadowsInline([base, { ...base, id: 2 }])).toContain('), 0 4px');
  });
  it('nessuna ombra', () => {
    expect(shadowsCss([])).toBe('box-shadow: none;');
    expect(shadowsInline([])).toBe('none');
  });
  it('il blur negativo diventa 0', () => {
    expect(shadowValue({ ...base, blur: -5 })).toContain(' 0 0 rgba');
    expect(updateShadow([base], 1, { blur: -4 })[0].blur).toBe(0);
  });
  it('aggiorna con limiti e valori non validi', () => {
    const r = updateShadow([base], 1, { alpha: 3, x: NaN })[0];
    expect(r.alpha).toBe(1);
    expect(r.x).toBe(0);
  });
  it('preset e valori predefiniti', () => {
    expect(newShadow(5).id).toBe(5);
    expect(MAX_SHADOWS).toBeGreaterThan(1);
    for (const p of SHADOW_PRESETS) expect(p.shadows().length).toBeGreaterThan(0);
  });
});
