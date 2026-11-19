// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  FALLBACK_SIZE,
  MAX_PIXELS,
  MAX_SIDE,
  looksLikeSvg,
  outputFileName,
  outputSize,
  parseDimension,
  parseLength,
  parseViewBox,
  prepareSvg,
  readSvg,
  type SvgInfo,
} from './svg-size';
import { validateState } from '../../shared/share-state';
import { SHARE_SCHEMA } from './svg-to-png.share';

const info = (svg: string): SvgInfo => {
  const r = readSvg(svg);
  if (!r.ok) throw new Error('errore ' + r.error);
  return r.info;
};

describe('lunghezze e viewBox', () => {
  it('unità in pixel', () => {
    expect(parseLength('120')).toBe(120);
    expect(parseLength('120px')).toBe(120);
    expect(parseLength(' 1in ')).toBe(96);
    expect(parseLength('72pt')).toBeCloseTo(96);
    expect(parseLength('2.54cm')).toBeCloseTo(96);
    expect(parseLength('25.4mm')).toBeCloseTo(96);
    expect(parseLength('.5e2')).toBe(50);
  });
  it('percentuali, zero, negativi e testo non sono misure', () => {
    for (const v of ['100%', '0', '-5', 'auto', '', '12foo', null, undefined]) expect(parseLength(v as string)).toBeNull();
  });
  it('viewBox con spazi o virgole', () => {
    expect(parseViewBox('0 0 24 24')).toEqual({ x: 0, y: 0, width: 24, height: 24 });
    expect(parseViewBox(' -5,10 , 100 50 ')).toEqual({ x: -5, y: 10, width: 100, height: 50 });
  });
  it('viewBox non valido', () => {
    for (const v of ['0 0 24', '0 0 0 10', '0 0 a b', '0 0 -4 4', '', null]) expect(parseViewBox(v as string)).toBeNull();
  });
});

describe('lettura dell\'SVG', () => {
  it('width e height', () => {
    const i = info('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="1" height="1"/></svg>');
    expect(i.size).toEqual({ width: 200, height: 100 });
    expect(i.source).toBe('attributes');
    expect(i.viewBox).toBeNull();
  });
  it('senza width e height usa il viewBox', () => {
    const i = info('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24"/>');
    expect(i.size).toEqual({ width: 48, height: 24 });
    expect(i.source).toBe('viewBox');
  });
  it('una sola misura: l\'altra segue le proporzioni del viewBox', () => {
    const w = info('<svg xmlns="http://www.w3.org/2000/svg" width="100" viewBox="0 0 50 25"/>');
    expect(w.size).toEqual({ width: 100, height: 50 });
    expect(w.source).toBe('mixed');
    const h = info('<svg xmlns="http://www.w3.org/2000/svg" height="30" viewBox="0 0 60 15"/>');
    expect(h.size).toEqual({ width: 120, height: 30 });
  });
  it('percentuali con viewBox: vale il viewBox', () => {
    expect(info('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 10 20"/>').size).toEqual({ width: 10, height: 20 });
  });
  it('nessuna misura: valore di riserva', () => {
    const i = info('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    expect(i.size).toEqual(FALLBACK_SIZE);
    expect(i.source).toBe('fallback');
  });
  it('errori', () => {
    expect(readSvg('  ')).toEqual({ ok: false, error: 'empty' });
    expect(readSvg('<svg><g></svg>')).toEqual({ ok: false, error: 'parse' });
    expect(readSvg('<html xmlns="http://www.w3.org/1999/xhtml"/>')).toEqual({ ok: false, error: 'notSvg' });
    expect(readSvg('x'.repeat(11 * 1024 * 1024))).toEqual({ ok: false, error: 'tooBig' });
  });
});

describe('risorse esterne', () => {
  const ext = (body: string) => info(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10">${body}</svg>`).external;
  it('nessuna se tutto è interno o in data:', () => {
    expect(ext('<defs><linearGradient id="a"/></defs><rect fill="url(#a)"/><use href="#a"/><image href="data:image/png;base64,AAAA"/>')).toEqual([]);
  });
  it('image, use e xlink:href verso l\'esterno', () => {
    expect(ext('<image href="https://example.com/a.png"/><image xlink:href="//cdn.example.com/b.jpg"/><use href="sprite.svg#x"/>')).toEqual([
      'https://example.com/a.png',
      '//cdn.example.com/b.jpg',
      'sprite.svg#x',
    ]);
  });
  it('url() e @import negli stili', () => {
    const r = ext('<style>@import url("https://fonts.example.com/f.css"); .a{background:url(http://x.test/i.png)}</style><rect style="fill:url(https://x.test/p.svg#g)"/>');
    expect(r).toEqual(['https://fonts.example.com/f.css', 'http://x.test/i.png', 'https://x.test/p.svg#g']);
  });
  it('senza doppioni', () => {
    expect(ext('<image href="https://a.test/x.png"/><image href="https://a.test/x.png"/>')).toEqual(['https://a.test/x.png']);
  });
});

describe('dimensione di uscita', () => {
  const nat = { width: 100, height: 50 };
  it('scala', () => {
    expect(outputSize(nat, { mode: 'scale', scale: 4, value: 0 })).toEqual({ width: 400, height: 200, clamped: false });
    expect(outputSize({ width: 24.5, height: 24.5 }, { mode: 'scale', scale: 2, value: 0 })).toMatchObject({ width: 49, height: 49 });
  });
  it('larghezza o altezza date, proporzioni mantenute', () => {
    expect(outputSize(nat, { mode: 'width', scale: 1, value: 1000 })).toEqual({ width: 1000, height: 500, clamped: false });
    expect(outputSize(nat, { mode: 'height', scale: 1, value: 300 })).toEqual({ width: 600, height: 300, clamped: false });
  });
  it('le misure non scendono sotto 1 pixel', () => {
    expect(outputSize({ width: 1000, height: 1 }, { mode: 'width', scale: 1, value: 10 })).toMatchObject({ width: 10, height: 1 });
  });
  it('oltre il lato massimo viene ridotta, con le stesse proporzioni', () => {
    const r = outputSize({ width: 1000, height: 10 }, { mode: 'width', scale: 1, value: 100000 });
    expect(r.clamped).toBe(true);
    expect(r.width).toBe(MAX_SIDE);
    expect(r.height).toBe(Math.round(MAX_SIDE / 100));
  });
  it('oltre l\'area massima viene ridotta', () => {
    const r = outputSize({ width: 2000, height: 2000 }, { mode: 'scale', scale: 8, value: 0 });
    expect(r.clamped).toBe(true);
    expect(r.width * r.height).toBeLessThanOrEqual(MAX_PIXELS * 1.001);
  });
  it('dimensione dai campi di testo', () => {
    expect(parseDimension(' 640 ')).toBe(640);
    for (const v of ['', '0', '-3', '12.5', 'abc', '1e3']) expect(parseDimension(v)).toBeNull();
  });
});

describe('preparazione per il disegno', () => {
  it('aggiunge xmlns, imposta la dimensione e dà un viewBox agli SVG che ne sono privi', () => {
    const out = prepareSvg('<svg width="20" height="10"><rect width="20" height="10"/></svg>', { width: 80, height: 40 })!;
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain('viewBox="0 0 20 10"');
    expect(out).toContain('width="80"');
    expect(out).toContain('height="40"');
  });
  it('senza width e height conserva il viewBox', () => {
    const out = prepareSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 12"><path d="M0 0"/></svg>', { width: 240, height: 120 })!;
    expect(out).toContain('viewBox="0 0 24 12"');
    expect(out).toContain('width="240"');
  });
  it('toglie script, foreignObject e gestori di eventi', () => {
    const out = prepareSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5" onload="x()"><script>alert(1)</script><foreignObject><div/></foreignObject><rect onclick="y()" width="1" height="1"/></svg>',
      { width: 5, height: 5 },
    )!;
    expect(out).not.toMatch(/script|foreignObject|onload|onclick/i);
    expect(out).toContain('<rect');
  });
  it('testo non valido o non SVG: null', () => {
    expect(prepareSvg('<svg><g></svg>', { width: 1, height: 1 })).toBeNull();
    expect(prepareSvg('<div xmlns="http://www.w3.org/1999/xhtml"/>', { width: 1, height: 1 })).toBeNull();
  });
});

describe('nomi e riconoscimento', () => {
  it('nome di uscita', () => {
    expect(outputFileName('logo.svg', 'png')).toBe('logo.png');
    expect(outputFileName('Icona.SVG', 'jpeg')).toBe('Icona.jpg');
    expect(outputFileName('a/b:c.svg', 'webp')).toBe('a_b_c.webp');
    expect(outputFileName('', 'png')).toBe('immagine.png');
  });
  it('riconosce un SVG nel testo', () => {
    expect(looksLikeSvg('<?xml version="1.0"?>\n<svg xmlns="x"/>')).toBe(true);
    expect(looksLikeSvg('<svg>')).toBe(true);
    expect(looksLikeSvg('<svgfoo>')).toBe(false);
    expect(looksLikeSvg('ciao')).toBe(false);
  });
});

describe('link di condivisione', () => {
  it('SVG e opzioni valide', () => {
    const st = { svg: '<svg/>', mode: 'width', scale: 4, value: 512, format: 'webp', quality: 80, transparent: false, background: '#00ff00' };
    expect(validateState(SHARE_SCHEMA, st)).toEqual(st);
  });
  it('scarta scale, formati e colori non ammessi', () => {
    expect(validateState(SHARE_SCHEMA, { svg: '<svg/>', scale: 9, format: 'gif', background: 'verde', value: 0 })).toEqual({ svg: '<svg/>' });
  });
});
