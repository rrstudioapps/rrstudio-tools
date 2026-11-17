// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPTIONS,
  buildConfig,
  byteLength,
  clampPrecision,
  formatBytes,
  optimizeSvg,
  optimizedName,
  svgDataUrl,
  uniqueNames,
} from './svg-opt';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Created with an editor -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <metadata>editor data</metadata>
  <title>Icona</title>
  <g id="layer1">
    <path d="M 1.123456 2.123456 L 10.5 10.5" fill="none" stroke="#000000" stroke-width="1.00000"/>
  </g>
</svg>
`;

describe('optimizeSvg', () => {
  it('riduce la dimensione e restituisce i numeri del confronto', async () => {
    const r = await optimizeSvg(SAMPLE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.before).toBe(byteLength(SAMPLE));
    expect(r.after).toBe(byteLength(r.data));
    expect(r.after).toBeLessThan(r.before);
    expect(r.savedBytes).toBe(r.before - r.after);
    expect(r.savedPercent).toBeGreaterThan(30);
  });
  it('toglie commenti e metadati ma conserva il viewBox e il titolo', async () => {
    const r = await optimizeSvg(SAMPLE);
    if (!r.ok) throw new Error('atteso ok');
    expect(r.data).not.toContain('Created with');
    expect(r.data).not.toContain('<metadata');
    expect(r.data).toContain('viewBox="0 0 24 24"');
    expect(r.data).toContain('<title>Icona</title>');
  });
  it('la precisione cambia i decimali', async () => {
    const hi = await optimizeSvg(SAMPLE, { ...DEFAULT_OPTIONS, precision: 5 });
    const lo = await optimizeSvg(SAMPLE, { ...DEFAULT_OPTIONS, precision: 1 });
    if (!hi.ok || !lo.ok) throw new Error('atteso ok');
    expect(hi.data).toContain('1.12346');
    expect(lo.data).toContain('1.1');
    expect(lo.data).not.toContain('1.12');
  });
  it('rimuove il viewBox solo se richiesto', async () => {
    const r = await optimizeSvg(SAMPLE, { ...DEFAULT_OPTIONS, removeViewBox: true });
    if (!r.ok) throw new Error('atteso ok');
    expect(r.data).not.toContain('viewBox');
  });
  it('può tenere commenti e metadati', async () => {
    const r = await optimizeSvg(SAMPLE, { ...DEFAULT_OPTIONS, removeComments: false, removeMetadata: false });
    if (!r.ok) throw new Error('atteso ok');
    expect(r.data).toContain('<metadata>');
    expect(r.data).toContain('<!--');
  });
  it('può togliere il titolo', async () => {
    const r = await optimizeSvg(SAMPLE, { ...DEFAULT_OPTIONS, removeTitle: true });
    if (!r.ok) throw new Error('atteso ok');
    expect(r.data).not.toContain('<title');
  });
  it('può togliere width e height', async () => {
    const r = await optimizeSvg(SAMPLE, { ...DEFAULT_OPTIONS, removeDimensions: true });
    if (!r.ok) throw new Error('atteso ok');
    expect(r.data).not.toContain('width="24"');
    expect(r.data).toContain('viewBox');
  });
  it('indenta con pretty', async () => {
    const r = await optimizeSvg(SAMPLE, { ...DEFAULT_OPTIONS, pretty: true });
    if (!r.ok) throw new Error('atteso ok');
    expect(r.data).toContain('\n');
  });
  it('gli id non vengono rinominati di default', async () => {
    const src = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="miaSfumatura"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><rect width="10" height="10" fill="url(#miaSfumatura)"/></svg>';
    const keep = await optimizeSvg(src);
    const min = await optimizeSvg(src, { ...DEFAULT_OPTIONS, minifyIds: true });
    if (!keep.ok || !min.ok) throw new Error('atteso ok');
    expect(keep.data).toContain('miaSfumatura');
    expect(min.data).not.toContain('miaSfumatura');
  });
  it('accetta un BOM iniziale', async () => {
    const r = await optimizeSvg('﻿' + SAMPLE);
    expect(r.ok).toBe(true);
  });
  it('segnala gli errori', async () => {
    expect(await optimizeSvg('')).toMatchObject({ ok: false, error: 'empty' });
    expect(await optimizeSvg('   \n')).toMatchObject({ ok: false, error: 'empty' });
    expect(await optimizeSvg('ciao mondo')).toMatchObject({ ok: false, error: 'not-svg' });
    expect(await optimizeSvg('<html><body></body></html>')).toMatchObject({ ok: false, error: 'not-svg' });
    const bad = await optimizeSvg('<svg><g></svg>');
    expect(bad).toMatchObject({ ok: false, error: 'parse' });
  });
});

describe('configurazione', () => {
  it('usa il preset predefinito con precisione limitata', () => {
    const c = buildConfig({ ...DEFAULT_OPTIONS, precision: 99 });
    expect(c['floatPrecision']).toBe(8);
    expect(c['multipass']).toBe(true);
    expect(JSON.stringify(c['plugins'])).toContain('preset-default');
  });
  it('clampPrecision', () => {
    expect(clampPrecision(-3)).toBe(0);
    expect(clampPrecision(2.9)).toBe(2);
    expect(clampPrecision(NaN)).toBe(DEFAULT_OPTIONS.precision);
  });
});

describe('utilità', () => {
  it('URL data per <img>', () => {
    const u = svgDataUrl('<svg onload="alert(1)"/>');
    expect(u.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(u).not.toContain('<');
  });
  it('nome del file ottimizzato', () => {
    expect(optimizedName('logo.svg')).toBe('logo.min.svg');
    expect(optimizedName('LOGO.SVG')).toBe('LOGO.min.svg');
    expect(optimizedName('a/b:c.svg')).toBe('a_b_c.min.svg');
    expect(optimizedName('.svg')).toBe('image.min.svg');
  });
  it('nomi unici nello ZIP', () => {
    expect(uniqueNames(['a.svg', 'a.svg', 'A.svg', 'b.svg'])).toEqual(['a.svg', 'a-2.svg', 'A-3.svg', 'b.svg']);
  });
  it('formatta i byte', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.00 KB');
    expect(formatBytes(20480)).toBe('20.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB');
  });
});
