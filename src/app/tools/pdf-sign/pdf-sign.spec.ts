// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { PDFDocument, degrees } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  EncryptedPdfError,
  MAX_TEXT_H,
  MIN_TEXT_H,
  MIN_W,
  applyPlacements,
  clampPlacement,
  contentBounds,
  countPageImages,
  fitMax,
  formatDate,
  hexToRgb,
  movePlacement,
  pageImageRefs,
  newDate,
  newSignature,
  normalizeRotation,
  placementToPdf,
  removeWhiteBackground,
  resizePlacement,
  safeColor,
  sanitizeText,
  scalePlacement,
  strokeWidthAt,
  visualSize,
  type PageBox,
  type Placement,
} from './pdf-sign';

// PNG 1×1 valido
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const A4 = 595 / 842;

describe('posizionamento', () => {
  it('una firma nuova ha le proporzioni dell\'immagine e sta dentro la pagina', () => {
    const p = newSignature(1, 0, 7, 3, A4);
    expect(p.kind).toBe('signature');
    expect(p.sigId).toBe(7);
    // altezza visiva = w * pageRatio / aspect
    expect(p.h).toBeCloseTo((p.w * A4) / 3, 9);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + p.w).toBeLessThanOrEqual(1);
    expect(p.y + p.h).toBeLessThanOrEqual(1);
  });
  it('una firma molto alta non esce dalla pagina', () => {
    const p = newSignature(1, 0, 1, 0.1, A4, 0.9);
    expect(p.h).toBeCloseTo(1, 6);
    expect(p.y).toBeGreaterThanOrEqual(0);
  });
  it('movePlacement non esce dai bordi', () => {
    const p = newSignature(1, 0, 1, 3, A4);
    const left = movePlacement(p, -5, -5, A4);
    expect(left.x).toBe(0);
    expect(left.y).toBe(0);
    const right = movePlacement(p, 5, 5, A4);
    expect(right.x + right.w).toBeCloseTo(1);
    expect(right.y + right.h).toBeCloseTo(1);
    expect(movePlacement(p, 0.01, 0, A4).x).toBeCloseTo(p.x + 0.01);
  });
  it('resizePlacement mantiene le proporzioni e il centro, entro i limiti', () => {
    const p: Placement = { id: 1, page: 0, kind: 'signature', sigId: 1, x: 0.4, y: 0.4, w: 0.2, h: (0.2 * A4) / 2 };
    const bigger = resizePlacement(p, 0.4, A4, 2);
    expect(bigger.w).toBeCloseTo(0.4);
    expect(bigger.h).toBeCloseTo((0.4 * A4) / 2);
    expect(bigger.x + bigger.w / 2).toBeCloseTo(0.5);
    expect(resizePlacement(p, 0.001, A4, 2).w).toBe(MIN_W);
    expect(resizePlacement(p, 5, A4, 2).w).toBeLessThanOrEqual(1);
  });
  it('scalePlacement scala la firma', () => {
    const p = newSignature(1, 0, 1, 2, A4, 0.2);
    expect(scalePlacement(p, 1.1, A4, 2).w).toBeCloseTo(0.22);
    expect(scalePlacement(p, 0.5, A4, 2).w).toBeCloseTo(0.1);
  });
  it('la data: corpo del testo limitato e dentro la pagina', () => {
    const d = newDate(2, 1, '17/11/2026', A4);
    expect(d.kind).toBe('date');
    expect(d.page).toBe(1);
    expect(scalePlacement(d, 100, A4, 1).h).toBe(MAX_TEXT_H);
    expect(scalePlacement(d, 0.0001, A4, 1).h).toBe(MIN_TEXT_H);
    const moved = movePlacement(d, 5, 5, A4);
    expect(moved.x).toBeLessThan(1);
    expect(moved.y + moved.h).toBeCloseTo(1);
  });
  it('clampPlacement', () => {
    const p = clampPlacement({ id: 1, page: 0, kind: 'signature', x: -1, y: 2, w: 0.3, h: 0.1 }, A4);
    expect(p.x).toBe(0);
    expect(p.y).toBeCloseTo(0.9);
  });
});

describe('placementToPdf (rotazioni e CropBox)', () => {
  const r = { x: 0.1, y: 0.2, w: 0.3, h: 0.1 };
  const base: PageBox = { x: 0, y: 0, width: 600, height: 800, rotation: 0 };
  it('senza rotazione: origine in basso a sinistra', () => {
    expect(placementToPdf(r, base)).toEqual({ x: 60, y: 800 - 0.3 * 800, width: 180, height: 80, rotate: 0 });
  });
  it('rotazione 90: la pagina vista è 800×600', () => {
    const b = { ...base, rotation: 90 };
    expect(visualSize(b)).toEqual({ width: 800, height: 600 });
    const o = placementToPdf(r, b);
    // bordo inferiore a schermo = 0.3 * 600 = 180; da sinistra = 0.1 * 800 = 80 → x utente = 180, y utente = 80
    expect(o.x).toBeCloseTo(180);
    expect(o.y).toBeCloseTo(80);
    expect(o.width).toBeCloseTo(240);
    expect(o.height).toBeCloseTo(60);
    expect(o.rotate).toBe(90);
  });
  it('rotazione 180', () => {
    const o = placementToPdf(r, { ...base, rotation: 180 });
    expect(o.x).toBeCloseTo(600 - 60);
    expect(o.y).toBeCloseTo(0.3 * 800);
    expect(o.rotate).toBe(180);
  });
  it('rotazione 270', () => {
    const o = placementToPdf(r, { ...base, rotation: 270 });
    expect(o.x).toBeCloseTo(600 - 0.3 * 600);
    expect(o.y).toBeCloseTo(800 - 0.1 * 800);
    expect(o.rotate).toBe(270);
  });
  it('un angolo della pagina intera coincide con l\'angolo giusto per ogni rotazione', () => {
    // l'angolo in basso a sinistra a schermo (0,1) con elemento di altezza 0 → angolo visivo
    const corner = (rotation: number) => placementToPdf({ x: 0, y: 1, w: 0, h: 0 }, { ...base, rotation });
    expect(corner(0)).toMatchObject({ x: 0, y: 0 });
    expect(corner(90)).toMatchObject({ x: 600, y: 0 }); // il basso a sinistra visivo è l'angolo in basso a destra della pagina
    expect(corner(180)).toMatchObject({ x: 600, y: 800 });
    expect(corner(270)).toMatchObject({ x: 0, y: 800 });
  });
  it('tiene conto dell\'origine della CropBox', () => {
    const o = placementToPdf({ x: 0, y: 1, w: 0.5, h: 0 }, { x: 20, y: 30, width: 600, height: 800, rotation: 0 });
    expect(o).toMatchObject({ x: 20, y: 30, width: 300 });
  });
  it('normalizza le rotazioni anche negative o non multiple di 90', () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(0)).toBe(0);
  });
});

describe('data', () => {
  const d = new Date(2026, 10, 7, 12, 0, 0);
  it('formati numerico, ISO e lungo', () => {
    expect(formatDate(d, 'numeric', 'it-IT')).toBe('07/11/2026');
    expect(formatDate(d, 'iso', 'it-IT')).toBe('2026-11-07');
    expect(formatDate(d, 'long', 'it-IT')).toBe('7 novembre 2026');
    expect(formatDate(d, 'long', 'en-GB')).toBe('7 November 2026');
  });
  it('sanitizeText sostituisce i caratteri non disegnabili', () => {
    const ok = (cp: number) => cp < 0x100;
    expect(sanitizeText('Roma, 17 € ✓', ok)).toBe('Roma, 17 ? ?');
    expect(sanitizeText('a\nb\t c', ok)).toBe('a b c');
  });
});

describe('pixel della firma', () => {
  it('removeWhiteBackground rende trasparente il bianco e tiene l\'inchiostro', () => {
    const px = new Uint8ClampedArray([255, 255, 255, 255, 10, 10, 10, 255, 250, 250, 250, 255, 128, 128, 128, 255]);
    removeWhiteBackground(px, 240);
    expect(px[3]).toBe(0);
    expect(px[7]).toBe(255);
    expect(px[11]).toBe(0); // 250 >= 240
    expect(px[15]).toBe(255);
  });
  it('la soglia più alta tiene più grigi, quella bassa ne toglie di più', () => {
    const mk = () => new Uint8ClampedArray([200, 200, 200, 255]);
    const a = mk();
    removeWhiteBackground(a, 250);
    const b = mk();
    removeWhiteBackground(b, 180);
    expect(a[3]).toBeGreaterThan(b[3]);
    expect(b[3]).toBe(0);
  });
  it('sfuma i grigi vicini alla soglia', () => {
    const p = new Uint8ClampedArray([225, 225, 225, 255]);
    removeWhiteBackground(p, 240);
    expect(p[3]).toBeGreaterThan(0);
    expect(p[3]).toBeLessThan(255);
  });
  it('contentBounds trova il riquadro dell\'inchiostro, con margine', () => {
    const w = 10;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    for (const [x, y] of [[2, 3], [6, 5]]) data[(y * w + x) * 4 + 3] = 255;
    expect(contentBounds(data, w, h)).toEqual({ x: 2, y: 3, w: 5, h: 3 });
    expect(contentBounds(data, w, h, 8, 2)).toEqual({ x: 0, y: 1, w: 9, h: 7 });
  });
  it('contentBounds: immagine vuota → null; ignora l\'alfa quasi nullo', () => {
    expect(contentBounds(new Uint8ClampedArray(4 * 4 * 4), 4, 4)).toBeNull();
    const d = new Uint8ClampedArray(4 * 4 * 4);
    d[3] = 5;
    expect(contentBounds(d, 4, 4)).toBeNull();
  });
  it('fitMax', () => {
    expect(fitMax(3000, 1000, 1500)).toEqual({ width: 1500, height: 500 });
    expect(fitMax(100, 50, 1500)).toEqual({ width: 100, height: 50 });
  });
});

describe('tratto e colori', () => {
  it('lo spessore con la penna segue la pressione, col mouse è costante', () => {
    expect(strokeWidthAt(4, 0.5, false)).toBe(4);
    expect(strokeWidthAt(4, 1, true)).toBeGreaterThan(strokeWidthAt(4, 0.1, true));
    expect(strokeWidthAt(4, 5, true)).toBeCloseTo(4 * 1.4);
  });
  it('safeColor e hexToRgb', () => {
    expect(safeColor('#1A2B3C')).toBe('#1A2B3C');
    expect(safeColor('red')).toBe('#000000');
    expect(safeColor('url(x)')).toBe('#000000');
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0]);
  });
});

describe('applyPlacements', () => {
  async function makePdf(pages: number, rotatedPage = -1): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) {
      const p = doc.addPage([600, 800]);
      if (i === rotatedPage) p.setRotation(degrees(90));
    }
    return doc.save();
  }
  const images = new Map([[1, { png: PNG }]]);

  it('inserisce la firma solo nella pagina scelta', async () => {
    const pdf = await makePdf(3);
    const out = await applyPlacements(pdf, images, [newSignature(1, 1, 1, 2, 600 / 800)]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
    expect(countPageImages(doc, 0)).toBe(0);
    expect(countPageImages(doc, 1)).toBe(1);
    expect(countPageImages(doc, 2)).toBe(0);
  });
  it('più firme e date su più pagine; la stessa immagine non si incorpora due volte', async () => {
    const pdf = await makePdf(2);
    const out = await applyPlacements(pdf, images, [
      newSignature(1, 0, 1, 2, 0.75),
      newSignature(2, 1, 1, 2, 0.75),
      newDate(3, 0, '17/11/2026', 0.75),
    ]);
    const doc = await PDFDocument.load(out);
    expect(countPageImages(doc, 0)).toBe(1);
    expect(countPageImages(doc, 1)).toBe(1);
    expect(pageImageRefs(doc, 0)).toEqual(pageImageRefs(doc, 1));
  });
  it('funziona su pagine ruotate', async () => {
    const pdf = await makePdf(1, 0);
    const out = await applyPlacements(pdf, images, [newSignature(1, 0, 1, 2, 800 / 600), newDate(2, 0, 'ok', 800 / 600)]);
    const doc = await PDFDocument.load(out);
    expect(countPageImages(doc, 0)).toBe(1);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
  });
  it('ignora pagine inesistenti e firme sconosciute', async () => {
    const pdf = await makePdf(1);
    const out = await applyPlacements(pdf, images, [newSignature(1, 5, 1, 2, 0.75), newSignature(2, 0, 99, 2, 0.75)]);
    expect(countPageImages(await PDFDocument.load(out), 0)).toBe(0);
  });
  it('una data con caratteri non supportati non fa fallire l\'esportazione', async () => {
    const pdf = await makePdf(1);
    const out = await applyPlacements(pdf, images, [newDate(1, 0, 'Roma ✓ 17/11', 0.75)]);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });
  it('un PDF cifrato dà un errore chiaro', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.context.trailerInfo.Encrypt = doc.context.register(doc.context.obj({ Filter: 'Standard' }));
    const bytes = await doc.save();
    await expect(applyPlacements(bytes, images, [])).rejects.toBeInstanceOf(EncryptedPdfError);
  });
  it('un file che non è un PDF fallisce', async () => {
    await expect(applyPlacements(new TextEncoder().encode('non sono un pdf'), images, [])).rejects.toThrow();
  });
});
