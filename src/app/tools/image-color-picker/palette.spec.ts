// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  HISTORY_MAX,
  MAX_COLORS,
  MIN_COLORS,
  clampCount,
  colorValues,
  dominantPalette,
  lensOrigin,
  medianCut,
  moveCrosshair,
  paletteExport,
  paletteToCss,
  paletteToJson,
  pixelAt,
  pushHistory,
  roundPercents,
  samplePixels,
  toImageCoords,
  type Rgb,
} from './palette';

/** Immagine RGBA sintetica: una funzione dà il colore di ogni pixel. */
function image(w: number, h: number, f: (x: number, y: number) => [number, number, number, number?]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = f(x, y);
      d.set([r, g, b, a], (y * w + x) * 4);
    }
  }
  return d;
}

describe('lettura del pixel', () => {
  const d = image(3, 2, (x, y) => [x * 10, y * 100, 7, 255]);
  it('legge il pixel richiesto', () => {
    expect(pixelAt(d, 3, 2, 2, 1)).toEqual({ r: 20, g: 100, b: 7, a: 255 });
    expect(pixelAt(d, 3, 2, 0, 0)).toEqual({ r: 0, g: 0, b: 7, a: 255 });
  });
  it('fuori dall\'immagine si resta sul bordo', () => {
    expect(pixelAt(d, 3, 2, 99, 99)).toEqual({ r: 20, g: 100, b: 7, a: 255 });
    expect(pixelAt(d, 3, 2, -5, -5)).toEqual({ r: 0, g: 0, b: 7, a: 255 });
  });
  it('i valori nei quattro formati', () => {
    const v = colorValues({ r: 255, g: 0, b: 0, a: 255 });
    expect(v.hex).toBe('#ff0000');
    expect(v.rgb).toBe('rgb(255 0 0)');
    expect(v.hsl).toBe('hsl(0 100% 50%)');
    expect(v.oklch).toMatch(/^oklch\(62\.8/);
  });
  it('l\'alfa del pixel non entra nei valori mostrati', () => {
    expect(colorValues({ r: 10, g: 20, b: 30, a: 40 }).hex).toBe('#0a141e');
  });
});

describe('mirino da tastiera', () => {
  it('le frecce spostano di un passo, Maiusc di dieci', () => {
    expect(moveCrosshair(5, 5, 'ArrowRight', 1, false, 100, 100)).toEqual({ x: 6, y: 5 });
    expect(moveCrosshair(5, 5, 'ArrowUp', 1, true, 100, 100)).toEqual({ x: 5, y: 0 });
    expect(moveCrosshair(50, 50, 'ArrowDown', 2, true, 100, 100)).toEqual({ x: 50, y: 70 });
  });
  it('resta dentro l\'immagine', () => {
    expect(moveCrosshair(0, 0, 'ArrowLeft', 1, false, 10, 10)).toEqual({ x: 0, y: 0 });
    expect(moveCrosshair(9, 9, 'ArrowRight', 5, true, 10, 10)).toEqual({ x: 9, y: 9 });
    expect(moveCrosshair(4, 4, 'End', 1, false, 10, 10)).toEqual({ x: 9, y: 4 });
    expect(moveCrosshair(4, 4, 'Home', 1, false, 10, 10)).toEqual({ x: 0, y: 4 });
  });
  it('gli altri tasti non servono', () => {
    expect(moveCrosshair(4, 4, 'a', 1, false, 10, 10)).toBeNull();
  });
  it('da punto dello schermo a pixel, anche con l\'immagine ridotta o ingrandita', () => {
    const box = { left: 10, top: 20, width: 200, height: 100 };
    expect(toImageCoords(110, 70, box, 400, 200)).toEqual({ x: 200, y: 100 });
    expect(toImageCoords(0, 0, box, 400, 200)).toEqual({ x: 0, y: 0 });
    expect(toImageCoords(999, 999, box, 400, 200)).toEqual({ x: 399, y: 199 });
  });
  it('la lente è centrata sul pixel', () => {
    expect(lensOrigin(10, 10, 9)).toEqual({ sx: 6, sy: 6 });
  });
  it('lo storico non ha doppioni, tiene i più recenti in testa e ha un tetto', () => {
    let h: string[] = [];
    h = pushHistory(h, '#AABBCC');
    h = pushHistory(h, '#112233');
    h = pushHistory(h, '#aabbcc');
    expect(h).toEqual(['#aabbcc', '#112233']);
    for (let i = 0; i < 50; i++) h = pushHistory(h, '#' + i.toString(16).padStart(6, '0'));
    expect(h).toHaveLength(HISTORY_MAX);
    expect(h[0]).toBe('#000031');
  });
});

describe('campionamento', () => {
  it('salta i pixel trasparenti', () => {
    const d = image(2, 1, (x) => (x === 0 ? [1, 2, 3, 255] : [9, 9, 9, 0]));
    expect(samplePixels(d)).toEqual([[1, 2, 3]]);
  });
  it('riduce il numero di pixel e prende sempre lo stesso campione', () => {
    const d = image(400, 400, (x, y) => [x % 256, y % 256, 0]);
    const a = samplePixels(d, 1000);
    expect(a.length).toBeLessThanOrEqual(1000);
    expect(a.length).toBeGreaterThan(500);
    expect(samplePixels(d, 1000)).toEqual(a);
  });
});

describe('median cut', () => {
  it('vuoto: nessuna scatola', () => {
    expect(medianCut([], 5)).toEqual([]);
  });
  it('divide fino a k scatole che insieme contengono tutti i pixel', () => {
    const px: Rgb[] = [];
    for (let i = 0; i < 100; i++) px.push([i * 2, 255 - i, (i * 7) % 256]);
    const boxes = medianCut(px, 6);
    expect(boxes).toHaveLength(6);
    expect(boxes.reduce((n, b) => n + b.length, 0)).toBe(100);
    expect(boxes.every((b) => b.length > 0)).toBe(true);
  });
  it('un solo colore non si divide', () => {
    expect(medianCut(Array.from({ length: 50 }, () => [5, 5, 5] as Rgb), 8)).toHaveLength(1);
  });
});

describe('palette dominante', () => {
  const half = image(20, 10, (x) => (x < 15 ? [200, 30, 30] : [20, 40, 220]));
  const palette = dominantPalette(samplePixels(half), 5);

  it('trova i due colori e le loro quote (75% e 25%)', () => {
    expect(palette.map((c) => c.hex)).toEqual(['#c81e1e', '#1428dc']);
    expect(palette.map((c) => c.percent)).toEqual([75, 25]);
  });
  it('non inventa colori: con meno colori distinti di k restano solo quelli', () => {
    expect(palette.length).toBeLessThan(5);
  });
  it('le quote sommano 100 e sono in ordine decrescente', () => {
    const d = image(64, 64, (x, y) => [(x * 4) % 256, (y * 4) % 256, ((x + y) * 2) % 256]);
    const p = dominantPalette(samplePixels(d), 12);
    expect(p).toHaveLength(12);
    expect(Math.round(p.reduce((s, c) => s + c.percent, 0) * 10) / 10).toBe(100);
    for (let i = 1; i < p.length; i++) expect(p[i - 1].percent).toBeGreaterThanOrEqual(p[i].percent);
  });
  it('è deterministica', () => {
    const d = image(64, 64, (x, y) => [(x * 5) % 256, (y * 3) % 256, (x * y) % 256]);
    const a = dominantPalette(samplePixels(d), 8);
    const b = dominantPalette(samplePixels(d), 8);
    expect(b).toEqual(a);
  });
  it('separa un colore raro ma molto diverso', () => {
    const d = image(30, 30, (x, y) => (x < 3 && y < 3 ? [0, 255, 0] : [250, 250, 250]));
    const p = dominantPalette(samplePixels(d), 5);
    expect(p.map((c) => c.hex)).toEqual(['#fafafa', '#00ff00']);
    expect(p[1].percent).toBe(1);
  });
  it('immagine vuota o tutta trasparente: nessuna palette', () => {
    expect(dominantPalette([], 8)).toEqual([]);
    expect(dominantPalette(samplePixels(image(4, 4, () => [1, 2, 3, 0])), 8)).toEqual([]);
  });
  it('il numero di colori è limitato a 5-12', () => {
    expect(clampCount(2)).toBe(MIN_COLORS);
    expect(clampCount(40)).toBe(MAX_COLORS);
    expect(clampCount(NaN)).toBe(8);
  });
});

describe('percentuali', () => {
  it('sommano sempre 100', () => {
    expect(roundPercents([1, 1, 1], 3)).toEqual([33.4, 33.3, 33.3]);
    expect(roundPercents([5, 3, 2], 10)).toEqual([50, 30, 20]);
    expect(roundPercents([], 0)).toEqual([]);
  });
});

describe('esportazione', () => {
  const p = [
    { rgb: [200, 30, 30] as Rgb, hex: '#c81e1e', percent: 75, count: 3 },
    { rgb: [20, 40, 220] as Rgb, hex: '#1428dc', percent: 25, count: 1 },
  ];
  it('CSS con variabili numerate', () => {
    expect(paletteToCss(p, 'Mio Sito')).toBe(':root {\n  --mio-sito-1: #c81e1e;\n  --mio-sito-2: #1428dc;\n}');
  });
  it('JSON con hex e percentuale', () => {
    expect(JSON.parse(paletteToJson(p, 'palette'))).toEqual({ palette: [{ hex: '#c81e1e', percent: 75 }, { hex: '#1428dc', percent: 25 }] });
  });
  it('nome vuoto: "color"; il formato sceglie la funzione', () => {
    expect(paletteExport(p, '', 'css')).toContain('--color-1');
    expect(paletteExport(p, '', 'json')).toContain('"color"');
  });
});
