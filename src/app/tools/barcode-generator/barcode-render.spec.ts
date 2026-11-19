// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { FORMATS, normalizeInput } from './barcode';
import { BarcodeRenderError, DEFAULT_STYLE, clampStyle, renderSvg } from './barcode-render';

describe('renderSvg (jsbarcode)', () => {
  it('produce un SVG per ogni formato con il suo esempio', async () => {
    for (const f of FORMATS) {
      const n = normalizeInput(f.id, f.example);
      if (!n.ok) throw new Error(f.id);
      const svg = await renderSvg(f.id, n.value, DEFAULT_STYLE);
      expect(svg, f.id).toContain('<svg');
      expect(svg, f.id).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg, f.id).toMatch(/<rect|<path/);
    }
  });
  it('mostra il testo solo se richiesto e usa i colori scelti', async () => {
    const withText = await renderSvg('CODE128', 'ABC123', { ...DEFAULT_STYLE, showText: true });
    const noText = await renderSvg('CODE128', 'ABC123', { ...DEFAULT_STYLE, showText: false });
    expect(withText).toContain('ABC123');
    expect(noText).not.toContain('<text');
    const colored = await renderSvg('CODE128', 'ABC123', { ...DEFAULT_STYLE, fg: '#aa0000', bg: '#eeeeee' });
    expect(colored.toLowerCase()).toContain('#aa0000');
    expect(colored.toLowerCase()).toContain('#eeeeee');
  });
  it('la larghezza cresce con la larghezza della barra', async () => {
    const w = async (barWidth: number) => {
      const svg = await renderSvg('CODE128', 'ABC123', { ...DEFAULT_STYLE, barWidth });
      return Number(/width="(\d+)px"/.exec(svg)?.[1] ?? /width="(\d+)"/.exec(svg)?.[1]);
    };
    expect(await w(3)).toBeGreaterThan(await w(1));
  });
  it('contenuto non valido per il formato: errore', async () => {
    await expect(renderSvg('EAN13', 'abc', DEFAULT_STYLE)).rejects.toBeInstanceOf(BarcodeRenderError);
    await expect(renderSvg('ITF', '123', DEFAULT_STYLE)).rejects.toBeInstanceOf(BarcodeRenderError);
  });
  it('il colore non valido torna al predefinito (niente iniezioni nell\'SVG)', () => {
    const s = clampStyle({ ...DEFAULT_STYLE, fg: '"/><script>', bg: 'red', barWidth: 99, height: 1, margin: -5, fontSize: NaN });
    expect(s.fg).toBe('#000000');
    expect(s.bg).toBe('#ffffff');
    expect(s.barWidth).toBe(6);
    expect(s.height).toBe(20);
    expect(s.margin).toBe(0);
    expect(s.fontSize).toBe(18);
  });
});
