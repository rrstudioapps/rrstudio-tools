// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  ALL_SIZES,
  DEFAULT_SITE,
  ICO_SIZES,
  PNG_FILES,
  SizedPngs,
  buildPackage,
  clipText,
  cornerRadius,
  encodeIco,
  htmlSnippet,
  layoutImage,
  manifestJson,
  readableOn,
  textFontSize,
} from './favicon';

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** PNG finto ma con la firma giusta, di lunghezza nota. */
function fakePng(size: number, extra = 0): Uint8Array {
  const a = new Uint8Array(20 + extra);
  a.set(PNG_SIG, 0);
  a[8] = size & 255;
  return a;
}

describe('encodeIco', () => {
  it('scrive intestazione, voci e dati', () => {
    const imgs = [16, 32, 48].map((s, i) => ({ size: s, png: fakePng(s, i * 5) }));
    const ico = encodeIco(imgs);
    const v = new DataView(ico.buffer);
    expect(v.getUint16(0, true)).toBe(0);
    expect(v.getUint16(2, true)).toBe(1);
    expect(v.getUint16(4, true)).toBe(3);
    let expectedOffset = 6 + 16 * 3;
    imgs.forEach((img, i) => {
      const p = 6 + 16 * i;
      expect(ico[p]).toBe(img.size);
      expect(ico[p + 1]).toBe(img.size);
      expect(v.getUint16(p + 4, true)).toBe(1);
      expect(v.getUint16(p + 6, true)).toBe(32);
      expect(v.getUint32(p + 8, true)).toBe(img.png.length);
      expect(v.getUint32(p + 12, true)).toBe(expectedOffset);
      expect(Array.from(ico.subarray(expectedOffset, expectedOffset + 8))).toEqual(PNG_SIG);
      expect(Array.from(ico.subarray(expectedOffset, expectedOffset + img.png.length))).toEqual(Array.from(img.png));
      expectedOffset += img.png.length;
    });
    expect(ico.length).toBe(expectedOffset);
  });
  it('256 si scrive come 0', () => {
    const ico = encodeIco([{ size: 256, png: fakePng(0) }]);
    expect(ico[6]).toBe(0);
    expect(ico[7]).toBe(0);
  });
  it('rifiuta input non valido', () => {
    expect(() => encodeIco([])).toThrow();
    expect(() => encodeIco([{ size: 300, png: fakePng(1) }])).toThrow();
    expect(() => encodeIco([{ size: 0, png: fakePng(1) }])).toThrow();
  });
});

describe('layoutImage', () => {
  it('cover ritaglia un quadrato centrale', () => {
    const l = layoutImage(200, 100, 32, 0, 'cover');
    expect(l).toMatchObject({ sx: 50, sy: 0, sw: 100, sh: 100, dx: 0, dy: 0, dw: 32, dh: 32 });
  });
  it('contain mantiene le proporzioni e centra', () => {
    const l = layoutImage(200, 100, 100, 0, 'contain');
    expect(l).toMatchObject({ sx: 0, sy: 0, sw: 200, sh: 100, dx: 0, dy: 25, dw: 100, dh: 50 });
  });
  it('il margine riduce l\'area', () => {
    const l = layoutImage(100, 100, 100, 10, 'cover');
    expect(l.dx).toBe(10);
    expect(l.dw).toBe(80);
  });
  it('limita margine e zoom', () => {
    expect(layoutImage(100, 100, 100, 99, 'cover').dw).toBeCloseTo(20);
    expect(layoutImage(100, 100, 100, -5, 'cover').dw).toBe(100);
    expect(layoutImage(100, 100, 100, 0, 'cover', 100).sw).toBe(25);
    expect(layoutImage(100, 100, 100, 0, 'cover', 0.1).sw).toBe(100);
  });
  it('sorgente vuota non produce NaN', () => {
    const l = layoutImage(0, 0, 32, 0, 'cover');
    expect(Number.isFinite(l.dw)).toBe(true);
    expect(l.sw).toBe(1);
  });
});

describe('forme e testo', () => {
  it('raggi', () => {
    expect(cornerRadius('square', 100)).toBe(0);
    expect(cornerRadius('rounded', 100)).toBe(22);
    expect(cornerRadius('circle', 100)).toBe(50);
  });
  it('dimensione del carattere', () => {
    expect(textFontSize('A', 100)).toBe(72);
    expect(textFontSize('AB', 100)).toBe(52);
    expect(textFontSize('ABC', 100)).toBe(38);
    expect(textFontSize('🚀', 100)).toBe(72);
    expect(textFontSize('', 100)).toBe(72);
  });
  it('taglia il testo a tre caratteri veri', () => {
    expect(clipText('  ABCDE ')).toBe('ABC');
    expect(clipText('🚀🚀🚀🚀')).toBe('🚀🚀🚀');
    expect(clipText('')).toBe('');
  });
  it('testo leggibile', () => {
    expect(readableOn('#ffffff')).toBe('#000000');
    expect(readableOn('#000000')).toBe('#ffffff');
    expect(readableOn('#6366f1')).toBe('#ffffff');
    expect(readableOn('rosso')).toBe('#000000');
  });
});

describe('manifest e snippet', () => {
  it('manifest valido con icone 192 e 512', () => {
    const m = JSON.parse(manifestJson({ name: 'Il mio sito', shortName: 'Sito', themeColor: '#112233', backgroundColor: '#ffffff' }));
    expect(m.name).toBe('Il mio sito');
    expect(m.short_name).toBe('Sito');
    expect(m.theme_color).toBe('#112233');
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512']);
    expect(m.display).toBe('standalone');
  });
  it('valori mancanti o colori errati usano i predefiniti', () => {
    const m = JSON.parse(manifestJson({ name: '', shortName: '', themeColor: 'rosso', backgroundColor: '#fff' }));
    expect(m.name).toBe(DEFAULT_SITE.name);
    expect(m.short_name).toBe(DEFAULT_SITE.name);
    expect(m.theme_color).toBe('#ffffff');
    expect(m.background_color).toBe('#ffffff');
  });
  it('lo snippet cita tutti i file', () => {
    const s = htmlSnippet({ ...DEFAULT_SITE, themeColor: '#abcdef' });
    for (const f of ['favicon.ico', 'favicon-32x32.png', 'favicon-16x16.png', 'apple-touch-icon.png', 'site.webmanifest']) expect(s).toContain(f);
    expect(s).toContain('content="#abcdef"');
  });
});

describe('buildPackage', () => {
  const pngs: SizedPngs = Object.fromEntries(ALL_SIZES.map((s) => [s, fakePng(s)]));
  it('contiene tutti i file attesi', () => {
    const files = buildPackage(pngs, DEFAULT_SITE);
    expect(Object.keys(files).sort()).toEqual(
      ['README.txt', 'favicon.ico', 'site.webmanifest', ...Object.values(PNG_FILES)].sort(),
    );
    const v = new DataView(files['favicon.ico'].buffer);
    expect(v.getUint16(4, true)).toBe(ICO_SIZES.length);
  });
  it('fallisce se manca una dimensione', () => {
    const partial = { ...pngs };
    delete partial[180];
    expect(() => buildPackage(partial, DEFAULT_SITE)).toThrow(/180/);
  });
});
