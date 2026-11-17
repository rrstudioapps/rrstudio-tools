// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  ANCHORS,
  DEFAULT_SETTINGS,
  MAX_TILES,
  anchorCenter,
  clampField,
  cleanText,
  fontSize,
  hasContent,
  layout,
  logoSize,
  outputName,
  outputNames,
  pagesFromRanges,
  reference,
  rotatedBox,
  tileCenters,
} from './image-watermark';
import { rotateAround, watermarkPdf } from './image-watermark-pdf';
import { validateState } from '../../shared/share-state';
import { SHARE_SCHEMA } from './image-watermark.share';

describe('misure', () => {
  it('il riferimento è il lato corto', () => {
    expect(reference(800, 600)).toBe(600);
    expect(reference(600, 800)).toBe(600);
  });
  it('la dimensione del testo segue il lato corto, con un minimo', () => {
    expect(fontSize(10, 1000, 500)).toBe(50);
    expect(fontSize(1, 100, 100)).toBe(4);
  });
  it('il logo mantiene le proporzioni', () => {
    expect(logoSize(200, 100, 25, 1000, 400)).toEqual({ w: 100, h: 50 });
  });
  it('il riquadro ruotato', () => {
    expect(rotatedBox(100, 20, 0)).toEqual({ w: 100, h: 20 });
    const r = rotatedBox(100, 20, 90);
    expect(r.w).toBeCloseTo(20);
    expect(r.h).toBeCloseTo(100);
    const d = rotatedBox(100, 100, 45);
    expect(d.w).toBeCloseTo(141.42, 1);
  });
  it('limiti dei campi numerici', () => {
    expect(clampField('opacity', 500, 60)).toBe(100);
    expect(clampField('opacity', -4, 60)).toBe(1);
    expect(clampField('opacity', 'abc', 60)).toBe(60);
    expect(clampField('rotation', '-30', 0)).toBe(-30);
  });
  it('testo ripulito', () => {
    expect(cleanText('  a \n  b  ')).toBe('a b');
    expect(cleanText('x'.repeat(500))).toHaveLength(120);
  });
});

describe('posizione a 9 punti', () => {
  const W = 1000;
  const H = 600;
  const c = (a: (typeof ANCHORS)[number]) => anchorCenter(a, 200, 50, W, H, 30);
  it('angoli e centri rispettano il margine', () => {
    expect(c('tl')).toEqual({ cx: 130, cy: 55 });
    expect(c('tr')).toEqual({ cx: 870, cy: 55 });
    expect(c('bl')).toEqual({ cx: 130, cy: 545 });
    expect(c('br')).toEqual({ cx: 870, cy: 545 });
    expect(c('mc')).toEqual({ cx: 500, cy: 300 });
    expect(c('tc')).toEqual({ cx: 500, cy: 55 });
    expect(c('bc')).toEqual({ cx: 500, cy: 545 });
    expect(c('ml')).toEqual({ cx: 130, cy: 300 });
    expect(c('mr')).toEqual({ cx: 870, cy: 300 });
  });
  it('un riquadro troppo grande resta centrato su quell\'asse', () => {
    expect(anchorCenter('tl', 2000, 50, W, H, 30)).toEqual({ cx: 500, cy: 55 });
    expect(anchorCenter('br', 200, 900, W, H, 30)).toEqual({ cx: 870, cy: 300 });
  });
  it('tutti i riquadri stanno dentro la superficie', () => {
    for (const a of ANCHORS) {
      const p = anchorCenter(a, 200, 50, W, H, 30);
      expect(p.cx - 100).toBeGreaterThanOrEqual(0);
      expect(p.cx + 100).toBeLessThanOrEqual(W);
      expect(p.cy - 25).toBeGreaterThanOrEqual(0);
      expect(p.cy + 25).toBeLessThanOrEqual(H);
    }
  });
  it('layout usa il riquadro ruotato e il margine in percentuale', () => {
    // lato corto 600, margine 5% = 30; testo 200x50 ruotato di 90 gradi occupa 50x200
    const [p] = layout({ position: 'tl', rotation: 90, margin: 5, gap: 0 }, 200, 50, W, H);
    expect(p.cx).toBeCloseTo(30 + 25);
    expect(p.cy).toBeCloseTo(30 + 100);
  });
});

describe('mosaico', () => {
  it('copre la superficie e tutti i riquadri la toccano', () => {
    const pts = tileCenters(100, 40, 500, 300, 20);
    expect(pts.length).toBeGreaterThan(10);
    for (const p of pts) {
      expect(p.cx + 50).toBeGreaterThanOrEqual(0);
      expect(p.cx - 50).toBeLessThanOrEqual(500);
      expect(p.cy + 20).toBeGreaterThanOrEqual(0);
      expect(p.cy - 20).toBeLessThanOrEqual(300);
    }
  });
  it('è deterministico e ha una ripetizione al centro', () => {
    const a = tileCenters(100, 40, 500, 300, 20);
    expect(tileCenters(100, 40, 500, 300, 20)).toEqual(a);
    expect(a.some((p) => p.cx === 250 && p.cy === 150)).toBe(true);
  });
  it('le righe alternate sono sfalsate di mezzo passo', () => {
    const pts = tileCenters(100, 40, 500, 300, 20);
    const row0 = pts.filter((p) => p.cy === 150).map((p) => p.cx);
    const row1 = pts.filter((p) => p.cy === 150 + 60).map((p) => p.cx);
    expect(row1).toContain(250 + 60);
    expect(row0).not.toContain(250 + 60);
  });
  it('un testo minuscolo su una superficie grande non supera il tetto', () => {
    const pts = layout({ position: 'tile', rotation: 0, margin: 0, gap: 0 }, 6, 3, 6000, 4000);
    expect(pts.length).toBeLessThanOrEqual(MAX_TILES * 2);
  });
  it('senza spazio e con rotazione i centri restano finiti', () => {
    const pts = layout({ position: 'tile', rotation: 30, margin: 0, gap: 0 }, 120, 30, 800, 600);
    expect(pts.length).toBeGreaterThan(0);
    expect(pts.every((p) => Number.isFinite(p.cx) && Number.isFinite(p.cy))).toBe(true);
  });
});

describe('pagine e nomi', () => {
  it('senza intervallo tutte le pagine', () => {
    expect(pagesFromRanges(null, 3)).toEqual([0, 1, 2]);
  });
  it('intervalli sovrapposti senza duplicati e in ordine', () => {
    expect(
      pagesFromRanges(
        [
          { from: 3, to: 5 },
          { from: 1, to: 1 },
          { from: 4, to: 6 },
        ],
        10,
      ),
    ).toEqual([0, 2, 3, 4, 5]);
  });
  it('nome di uscita con suffisso ed estensione del formato', () => {
    expect(outputName('foto.JPG', 'image/png', 'filigrana')).toBe('foto-filigrana.png');
    expect(outputName('doc.pdf', 'application/pdf', 'watermark')).toBe('doc-watermark.pdf');
    expect(outputName('', 'image/webp', 'x')).toBe('immagine-x.webp');
  });
  it('nomi unici', () => {
    expect(
      outputNames(
        [
          { name: 'a.png', mime: 'image/png' },
          { name: 'a.jpg', mime: 'image/png' },
        ],
        'w',
      ),
    ).toEqual(['a-w.png', 'a-w (2).png']);
  });
  it('contenuto: testo vuoto o logo mancante', () => {
    expect(hasContent({ kind: 'text', text: '  ' }, true)).toBe(false);
    expect(hasContent({ kind: 'text', text: 'x' }, false)).toBe(true);
    expect(hasContent({ kind: 'image', text: 'x' }, false)).toBe(false);
    expect(hasContent({ kind: 'image', text: '' }, true)).toBe(true);
  });
});

describe('PDF', () => {
  it('rotateAround ruota in senso orario con y verso il basso', () => {
    const p = rotateAround(0, 0, 10, 0, 90);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });
  async function makePdf(pages: number, rotate = 0): Promise<Uint8Array> {
    const d = await PDFDocument.create();
    for (let i = 0; i < pages; i++) {
      const pg = d.addPage([400, 600]);
      if (rotate) pg.setRotation({ type: 'degrees' as never, angle: rotate } as never);
    }
    return d.save();
  }
  it('mette la filigrana solo sulle pagine scelte e il file resta valido', async () => {
    const src = await makePdf(3);
    const res = await watermarkPdf(src, { ...DEFAULT_SETTINGS, position: 'mc', rotation: 45 }, [0, 2], null);
    const out = await PDFDocument.load(res.bytes);
    expect(out.getPageCount()).toBe(3);
    expect(res.replaced).toBe(false);
    // la pagina marcata ha contenuto in più rispetto a quella intatta
    const size = (i: number) => out.getPage(i).node.Contents()?.toString().length ?? 0;
    expect(size(0)).toBeGreaterThan(0);
    expect(out.getPage(1).node.Contents()?.toString()).not.toEqual(out.getPage(0).node.Contents()?.toString());
  });
  it('segnala i caratteri che il PDF non sa scrivere', async () => {
    const src = await makePdf(1);
    const res = await watermarkPdf(src, { ...DEFAULT_SETTINGS, text: 'Ciao 日本', position: 'tile' }, [0], null);
    expect(res.replaced).toBe(true);
    await PDFDocument.load(res.bytes);
  });
  it('funziona su pagine ruotate di 90 gradi', async () => {
    const src = await makePdf(1, 90);
    const res = await watermarkPdf(src, { ...DEFAULT_SETTINGS, position: 'tl' }, [0], null);
    await PDFDocument.load(res.bytes);
  });
  it('senza logo la filigrana di immagine dà errore', async () => {
    const src = await makePdf(1);
    await expect(watermarkPdf(src, { ...DEFAULT_SETTINGS, kind: 'image' }, [0], null)).rejects.toThrow('logo');
  });
});

describe('link di condivisione', () => {
  it('accetta le opzioni del testo e scarta i valori fuori dai limiti', () => {
    expect(validateState(SHARE_SCHEMA, { text: 'Bozza', position: 'tile', opacity: 40, color: '#ff0000', font: 'serif' })).toEqual({
      text: 'Bozza',
      position: 'tile',
      opacity: 40,
      color: '#ff0000',
      font: 'serif',
    });
    expect(validateState(SHARE_SCHEMA, { text: 'x', opacity: 500, position: 'altrove', color: 'rosso', font: 'comic' })).toEqual({ text: 'x' });
  });
  it('non prevede campi per immagini, logo o PDF', () => {
    expect(validateState(SHARE_SCHEMA, { logo: 'data:image/png;base64,AAAA', files: ['a.pdf'], text: 'x' })).toEqual({ text: 'x' });
  });
});
