// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildJpeg, buildPng } from '../exif-viewer/exif-fixtures';
import { PreparedImage, buildImagesPdf } from './pdf-build';
import { LayoutOptions, MM, PAGE_SIZES, fitPageSize, layoutPages, pageCount } from './pdf-layout';
import { MAX_PIXELS, imageName, renderScale } from './pdf-render';

const base: LayoutOptions = { format: 'a4', orientation: 'auto', marginMm: 10, perPage: 1 };
const portrait = { width: 600, height: 800 };
const landscape = { width: 800, height: 600 };

describe('layoutPages', () => {
  it('A4 automatico: pagina verticale o orizzontale in base all\'immagine', () => {
    const [a, b] = layoutPages([portrait, landscape], base);
    expect(a.width).toBeCloseTo(PAGE_SIZES.a4.width);
    expect(a.height).toBeCloseTo(PAGE_SIZES.a4.height);
    expect(b.width).toBeCloseTo(PAGE_SIZES.a4.height);
    expect(b.height).toBeCloseTo(PAGE_SIZES.a4.width);
  });
  it('orientamento forzato', () => {
    expect(layoutPages([portrait], { ...base, orientation: 'landscape' })[0].width).toBeGreaterThan(800);
    expect(layoutPages([landscape], { ...base, orientation: 'portrait' })[0].height).toBeGreaterThan(800);
  });
  it('Letter', () => {
    const [p] = layoutPages([portrait], { ...base, format: 'letter' });
    expect([p.width, p.height]).toEqual([612, 792]);
  });
  it('un\'immagine per pagina: centrata dentro i margini, proporzioni intatte', () => {
    const [p] = layoutPages([landscape], { ...base, orientation: 'portrait' });
    const pl = p.placements[0];
    expect(pl.width / pl.height).toBeCloseTo(800 / 600);
    expect(pl.x).toBeGreaterThanOrEqual(10 * MM - 1e-6);
    expect(pl.x + pl.width).toBeLessThanOrEqual(p.width - 10 * MM + 1e-6);
    expect(pl.y + pl.height).toBeLessThanOrEqual(p.height - 10 * MM + 1e-6);
  });
  it('due per pagina: una sopra l\'altra in verticale, affiancate in orizzontale', () => {
    const v = layoutPages([portrait, portrait], { ...base, perPage: 2, orientation: 'portrait' })[0];
    expect(v.placements).toHaveLength(2);
    expect(v.placements[0].y).toBeGreaterThan(v.placements[1].y);
    const h = layoutPages([landscape, landscape], { ...base, perPage: 2, orientation: 'landscape' })[0];
    expect(h.placements[0].x).toBeLessThan(h.placements[1].x);
    expect(h.placements[0].y).toBeCloseTo(h.placements[1].y);
  });
  it('quattro per pagina in griglia 2x2, senza sovrapposizioni', () => {
    const p = layoutPages(Array(4).fill(portrait), { ...base, perPage: 4, orientation: 'portrait' })[0];
    expect(p.placements).toHaveLength(4);
    const [a, b, c, d] = p.placements;
    expect(a.x).toBeLessThan(b.x);
    expect(a.y).toBeGreaterThan(c.y);
    expect(c.y).toBeCloseTo(d.y);
    expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1e-6);
    expect(c.y + c.height).toBeLessThanOrEqual(a.y + 1e-6);
  });
  it('raggruppa in pagine e conta l\'ultima incompleta', () => {
    expect(layoutPages(Array(5).fill(portrait), { ...base, perPage: 2 })).toHaveLength(3);
    expect(pageCount(5, 2, 'a4')).toBe(3);
    expect(pageCount(5, 4, 'fit')).toBe(5);
  });
  it('"adatta": pagina proporzionale all\'immagine più i margini, una per pagina', () => {
    const plans = layoutPages([landscape, portrait], { ...base, format: 'fit', perPage: 4, marginMm: 0 });
    expect(plans).toHaveLength(2);
    expect(plans[0].width / plans[0].height).toBeCloseTo(800 / 600);
    expect(plans[0].placements[0]).toMatchObject({ x: 0, y: 0 });
    const big = fitPageSize({ width: 40000, height: 10000 }, 0);
    expect(Math.max(big.width, big.height)).toBeLessThanOrEqual(3000 + 1e-6);
  });
});

describe('buildImagesPdf', () => {
  const png = buildPng();
  const jpg = buildJpeg({ tiff: false });
  const images: PreparedImage[] = [
    { bytes: png, kind: 'png', width: 2, height: 2 },
    { bytes: jpg, kind: 'jpg', width: 2, height: 2 },
    { bytes: png, kind: 'png', width: 2, height: 2 },
  ];
  const sizes = images.map((i) => ({ width: i.width, height: i.height }));
  const load = async (i: number) => images[i];

  it('crea una pagina A4 per immagine', async () => {
    const out = await buildImagesPdf(sizes, load, base);
    const doc = await PDFDocument.load(out, { updateMetadata: false });
    expect(doc.getPageCount()).toBe(3);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(PAGE_SIZES.a4.width, 1);
    expect(height).toBeCloseTo(PAGE_SIZES.a4.height, 1);
    expect(doc.getProducer()).toBe('rrstudio tools');
  });
  it('due per pagina: 2 pagine; Letter orizzontale', async () => {
    const out = await buildImagesPdf(sizes, load, { ...base, format: 'letter', orientation: 'landscape', perPage: 2 });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(1).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([792, 612]);
  });
  it('"adatta all\'immagine": pagine della misura dell\'immagine', async () => {
    const out = await buildImagesPdf(sizes, load, { ...base, format: 'fit', marginMm: 0 });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(2 * (72 / 150), 3);
  });
  it('segnala l\'avanzamento', async () => {
    const steps: number[] = [];
    await buildImagesPdf(sizes, load, base, (d) => steps.push(d));
    expect(steps).toEqual([1, 2, 3]);
  });
});

describe('PDF in immagini', () => {
  it('scala dai dpi e riduce le pagine enormi', () => {
    expect(renderScale(595, 842, 72)).toEqual({ scale: 1, reduced: false });
    expect(renderScale(595, 842, 300).scale).toBeCloseTo(300 / 72);
    const huge = renderScale(5000, 5000, 300);
    expect(huge.reduced).toBe(true);
    expect(5000 * huge.scale * (5000 * huge.scale)).toBeLessThanOrEqual(MAX_PIXELS * 1.001);
  });
  it('nomi dei file con numerazione allineata', () => {
    expect(imageName('contratto', 'pagina', 3, 12, 'png')).toBe('contratto-pagina-03.png');
    expect(imageName('contratto', 'page', 3, 9, 'jpeg')).toBe('contratto-page-3.jpg');
  });
});
