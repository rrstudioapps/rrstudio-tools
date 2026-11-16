// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { encodeQr } from './qr-encoder';
import { decodeMatrix } from './qr-decoder.testing';
import { MAX_LOGO_FRACTION, contrastIssue, contrastRatio, logoBox, safeColor, toSvg } from './qr-render';

describe('contrasto', () => {
  it('nero su bianco = 21:1, uguali = 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });
  it('avvisa se basso o se il primo piano è più chiaro dello sfondo', () => {
    expect(contrastIssue('#000000', '#ffffff')).toBeNull();
    expect(contrastIssue('#777777', '#888888')).toBe('low');
    expect(contrastIssue('#ffffff', '#000000')).toBe('inverted');
  });
  it('safeColor accetta solo #rrggbb', () => {
    expect(safeColor('#ABCDEF', '#000000')).toBe('#abcdef');
    expect(safeColor('red"><script>', '#000000')).toBe('#000000');
  });
});

describe('SVG', () => {
  const q = encodeQr('https://example.com', { ecl: 'M' });
  it('viewBox = moduli + margine, sfondo e un solo path', () => {
    const svg = toSvg(q, { margin: 4, fg: '#112233', bg: '#ffeedd' });
    expect(svg).toContain(`viewBox="0 0 ${q.size + 8} ${q.size + 8}"`);
    expect(svg).toContain('fill="#ffeedd"');
    expect(svg).toContain('fill="#112233"');
    expect(svg.match(/<path /g)).toHaveLength(1);
    expect(svg).not.toContain('<image');
  });
  it('il path descrive esattamente i moduli scuri', () => {
    const svg = toSvg(q, { margin: 0, fg: '#000000', bg: '#ffffff' });
    const d = /d="([^"]+)"/.exec(svg)![1];
    let area = 0;
    for (const m of d.matchAll(/h(\d+)v1/g)) area += Number(m[1]);
    expect(area).toBe(q.modules.flat().filter(Boolean).length);
  });
  it('il logo non supera il 20% del lato e lascia il simbolo leggibile', () => {
    const h = encodeQr('https://example.com/con-logo', { ecl: 'H' });
    for (const fraction of [0.1, 0.2, 0.9]) {
      const b = logoBox(h, { dataUrl: 'data:image/png;base64,AAAA', fraction, width: 100, height: 50 });
      expect(b.box).toBeLessThanOrEqual(Math.floor(h.size * MAX_LOGO_FRACTION));
      expect(b.w).toBeLessThanOrEqual(b.box);
    }
    const svg = toSvg(h, { margin: 4, fg: '#000000', bg: '#ffffff', logo: { dataUrl: 'data:image/png;base64,AAAA', fraction: 0.2, width: 100, height: 100 } });
    expect(svg).toContain('<image');
    // i moduli sotto il logo spariscono: il decoder deve correggerli con il Reed-Solomon
    const b = logoBox(h, { dataUrl: '', fraction: 0.2, width: 1, height: 1 });
    const m = h.modules.map((r) => r.slice());
    const c = h.size / 2;
    for (let y = 0; y < h.size; y++) for (let x = 0; x < h.size; x++) if (Math.abs(x + 0.5 - c) <= b.box / 2 + 0.5 && Math.abs(y + 0.5 - c) <= b.box / 2 + 0.5) m[y][x] = false;
    expect(decodeMatrix(m).text).toBe('https://example.com/con-logo');
  });
});
