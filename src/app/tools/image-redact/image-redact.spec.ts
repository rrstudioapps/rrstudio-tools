// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import {
  MAX_PIXELS, MIN_BLOCK, applyRegions, applySafely, blurRegion, clampRect, fillRegion, hexToRgb, moveRect, outputName, pixelateRegion,
  pushHistory, redoHistory, rectFromPoints, resizeRect, sanitizeRegion, screenToImage, scaleRegions, tooLarge, undoHistory,
  type Region,
} from './image-redact';

/** Buffer RGBA w×h dove il canale R vale f(x, y), G=B=0 e alpha 255. */
function make(w: number, h: number, f: (x: number, y: number) => number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      d[i] = f(x, y);
      d[i + 3] = 255;
    }
  return d;
}
const red = (d: Uint8ClampedArray, w: number, x: number, y: number): number => d[(y * w + x) * 4];
const reg = (over: Partial<Region>): Region => ({ id: 1, rect: { x: 0, y: 0, w: 8, h: 8 }, effect: 'fill', color: '#ff0000', block: 8, blur: 4, ...over });

describe('rettangoli', () => {
  it('rectFromPoints accetta qualunque ordine', () => {
    expect(rectFromPoints(10, 20, 4, 5)).toEqual({ x: 4, y: 5, w: 6, h: 15 });
  });
  it('clampRect: intero, dentro i bordi, minimo 1×1', () => {
    expect(clampRect({ x: -5, y: 2.6, w: 0, h: 100 }, 10, 8)).toEqual({ x: 0, y: 3, w: 1, h: 5 });
    expect(clampRect({ x: 9, y: 9, w: 5, h: 5 }, 10, 10)).toEqual({ x: 9, y: 9, w: 1, h: 1 });
    expect(clampRect({ x: 5, y: 5, w: -3, h: 2 }, 10, 10)).toEqual({ x: 2, y: 5, w: 3, h: 2 });
    expect(clampRect({ x: NaN, y: Infinity, w: NaN, h: 4 }, 10, 10)).toEqual({ x: 0, y: 0, w: 1, h: 4 });
  });
  it('moveRect mantiene la dimensione dentro l\'immagine', () => {
    expect(moveRect({ x: 5, y: 5, w: 4, h: 4 }, 100, -100, 10, 10)).toEqual({ x: 6, y: 0, w: 4, h: 4 });
  });
  it('resizeRect con maniglie e ribaltamento', () => {
    const r = { x: 2, y: 2, w: 4, h: 4 };
    expect(resizeRect(r, 'se', 10, 10, 8, 8)).toEqual({ x: 2, y: 2, w: 6, h: 6 });
    expect(resizeRect(r, 'w', 1, 0, 8, 8)).toEqual({ x: 3, y: 2, w: 3, h: 4 });
    expect(resizeRect(r, 'e', -6, 0, 8, 8)).toEqual({ x: 0, y: 2, w: 2, h: 4 });
  });
  it('screenToImage converte e limita', () => {
    const box = { left: 100, top: 50, width: 200, height: 100 };
    expect(screenToImage(150, 75, box, 1000, 500)).toEqual({ x: 250, y: 125 });
    expect(screenToImage(0, 999, box, 1000, 500)).toEqual({ x: 0, y: 500 });
    expect(screenToImage(10, 10, { left: 0, top: 0, width: 0, height: 0 }, 10, 10)).toEqual({ x: 0, y: 0 });
  });
  it('tooLarge sul limite dei megapixel', () => {
    expect(tooLarge(MAX_PIXELS / 1000, 1000)).toBe(false);
    expect(tooLarge(MAX_PIXELS / 1000 + 1, 1000)).toBe(true);
  });
});

describe('effetti sui pixel', () => {
  it('hexToRgb', () => {
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0]);
    expect(hexToRgb('rosso')).toEqual([0, 0, 0]);
  });
  it('riquadro pieno: copre solo l\'area e rende opaco', () => {
    const d = make(8, 8, (x) => x * 10);
    d[3] = 0; // pixel (0,0) trasparente
    fillRegion(d, 8, 8, { x: 0, y: 0, w: 2, h: 2 }, [1, 2, 3]);
    expect([d[0], d[1], d[2], d[3]]).toEqual([1, 2, 3, 255]);
    expect(red(d, 8, 2, 0)).toBe(20);
    expect(red(d, 8, 1, 2)).toBe(10);
  });
  it('pixelatura: media dei blocchi calcolata a mano', () => {
    // R = x*10: colonne 0-3 -> media 15, colonne 4-7 -> media 55
    const d = make(8, 8, (x) => x * 10);
    pixelateRegion(d, 8, 8, { x: 0, y: 0, w: 8, h: 8 }, 4);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) expect(red(d, 8, x, y)).toBe(x < 4 ? 15 : 55);
    }
  });
  it('pixelatura con blocchi che non dividono l\'area e rettangolo parziale', () => {
    const d = make(8, 8, (x, y) => x + y * 8);
    const before = d.slice();
    pixelateRegion(d, 8, 8, { x: 2, y: 2, w: 3, h: 1 }, 2);
    // blocco 1: x=2,3 (y=2): valori 18, 19 -> 18.5 -> 19; blocco 2: x=4 (17+... =20) -> 20
    expect(red(d, 8, 2, 2)).toBe(19);
    expect(red(d, 8, 3, 2)).toBe(19);
    expect(red(d, 8, 4, 2)).toBe(20);
    // fuori dall'area non cambia nulla
    expect(red(d, 8, 1, 2)).toBe(before[(2 * 8 + 1) * 4]);
    expect(red(d, 8, 2, 3)).toBe(before[(3 * 8 + 2) * 4]);
  });
  it('pixelatura: nessun pixel originale sotto un blocco uniforme', () => {
    const d = make(16, 16, (x, y) => (x * 17 + y * 31) % 256);
    pixelateRegion(d, 16, 16, { x: 0, y: 0, w: 16, h: 16 }, 8);
    const vals = new Set<number>();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) vals.add(red(d, 16, x, y));
    expect(vals.size).toBe(1);
  });
  it('sfocatura: due passate con finestra ritagliata ai bordi (valori a mano)', () => {
    const d = make(5, 1, (x) => (x === 2 ? 90 : 0));
    blurRegion(d, 5, 1, { x: 0, y: 0, w: 5, h: 1 }, 1);
    expect([0, 1, 2, 3, 4].map((x) => red(d, 5, x, 0))).toEqual([0, 30, 30, 30, 0]);
  });
  it('sfocatura verticale e confinata nel rettangolo', () => {
    const d = make(3, 3, (x, y) => (x === 1 && y === 1 ? 90 : 0));
    blurRegion(d, 3, 3, { x: 1, y: 0, w: 1, h: 3 }, 1);
    // colonna centrale: [0,90,0] -> [45,30,45] (orizzontale su 1 px non cambia nulla)
    expect([red(d, 3, 1, 0), red(d, 3, 1, 1), red(d, 3, 1, 2)]).toEqual([45, 30, 45]);
    expect(red(d, 3, 0, 1)).toBe(0);
  });
  it('rettangolo completamente fuori o a larghezza 0: nessuna modifica e nessun errore', () => {
    const d = make(4, 4, (x) => x);
    const before = d.slice();
    pixelateRegion(d, 4, 4, { x: 10, y: 10, w: 4, h: 4 }, 2);
    blurRegion(d, 4, 4, { x: 1, y: 1, w: 0, h: 3 }, 2);
    fillRegion(d, 4, 4, { x: -9, y: -9, w: 3, h: 3 }, [9, 9, 9]);
    expect(d).toEqual(before);
  });
  it('rettangolo parzialmente fuori: agisce solo sulla parte visibile', () => {
    const d = make(4, 4, () => 100);
    fillRegion(d, 4, 4, { x: 2, y: 2, w: 10, h: 10 }, [0, 0, 0]);
    expect(red(d, 4, 3, 3)).toBe(0);
    expect(red(d, 4, 1, 3)).toBe(100);
  });
  it('ordine di sovrapposizione: l\'ultima regione sta sopra', () => {
    const d = make(8, 8, () => 100);
    applyRegions(d, 8, 8, [reg({ color: '#0a0000' }), reg({ id: 2, rect: { x: 0, y: 0, w: 4, h: 8 }, color: '#140000' })]);
    expect(red(d, 8, 1, 1)).toBe(20);
    expect(red(d, 8, 6, 1)).toBe(10);
  });
  it('un effetto lavora sul risultato del precedente', () => {
    const d = make(8, 8, (x) => x * 10);
    applyRegions(d, 8, 8, [
      reg({ effect: 'fill', rect: { x: 0, y: 0, w: 4, h: 8 }, color: '#640000' }),
      reg({ id: 2, effect: 'pixelate', rect: { x: 0, y: 0, w: 8, h: 8 }, block: 8 }),
    ]);
    // colonne 0-3 = 100, colonne 4-7 = 40..70 (media 55): media totale (400+220)/8 = 77.5 -> 78
    expect(red(d, 8, 0, 0)).toBe(78);
  });
});

describe('sicurezza', () => {
  it('sanitizeRegion alza il blocco al minimo e limita il rettangolo', () => {
    const s = sanitizeRegion(reg({ block: 2, blur: 0, color: 'xx', rect: { x: -3, y: 0, w: 99, h: 0 } }), 10, 10);
    expect(s.block).toBe(MIN_BLOCK);
    expect(s.blur).toBeGreaterThanOrEqual(4);
    expect(s.color).toBe('#000000');
    expect(s.rect).toEqual({ x: 0, y: 0, w: 10, h: 1 });
  });
  it('applySafely: con blocco 1 richiesto si usa comunque 8 (nessun pixel originale riconoscibile)', () => {
    const d = make(8, 8, (x, y) => x * 20 + y);
    applySafely(d, 8, 8, [reg({ effect: 'pixelate', block: 1 })]);
    const vals = new Set<number>();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) vals.add(red(d, 8, x, y));
    expect(vals.size).toBe(1);
  });
  it('il riquadro pieno non lascia nemmeno un valore originale', () => {
    const d = make(8, 8, (x, y) => x * 20 + y);
    applySafely(d, 8, 8, [reg({ color: '#010101' })]);
    for (let i = 0; i < d.length; i += 4) expect([d[i], d[i + 3]]).toEqual([1, 255]);
  });
});

describe('varie', () => {
  it('scaleRegions per l\'anteprima', () => {
    const [s] = scaleRegions([reg({ rect: { x: 100, y: 50, w: 10, h: 1 }, block: 16, blur: 20 })], 0.5);
    expect(s.rect).toEqual({ x: 50, y: 25, w: 5, h: 1 });
    expect([s.block, s.blur]).toEqual([8, 10]);
  });
  it('outputName', () => {
    expect(outputName('foto vacanza.JPG', 'oscurata', 'png')).toBe('foto vacanza-oscurata.png');
    expect(outputName('C:\\x\\a.b.png', 'redacted', 'jpeg')).toBe('a.b-redacted.jpg');
    expect(outputName('.png', 'x', 'png')).toBe('immagine-x.png');
  });
  it('cronologia annulla/ripristina', () => {
    let h = pushHistory<string>({ past: [], future: [] }, 'A');
    h = pushHistory(h, 'B');
    const u = undoHistory(h, 'C')!;
    expect(u.value).toBe('B');
    const r = redoHistory(u.history, u.value)!;
    expect(r.value).toBe('C');
    expect(undoHistory({ past: [], future: [] }, 'x')).toBeNull();
    expect(redoHistory({ past: [], future: [] }, 'x')).toBeNull();
    // una nuova azione cancella il ripristino
    expect(pushHistory(u.history, 'D').future).toEqual([]);
  });
});
