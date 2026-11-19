// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { PDFDocument, degrees } from 'pdf-lib';
import { MM, SIZES, rawMargins, transformPages } from './pdf-crop';

async function sample(sizes: [number, number, number?][] = [[300, 400]]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont('Helvetica');
  for (const [w, h, r] of sizes) {
    const p = doc.addPage([w, h]);
    p.drawText('x', { x: 10, y: 10, font }); // una pagina con contenuto (le pagine vuote non si incorporano)
    if (r) p.setRotation(degrees(r));
  }
  return doc.save();
}
const boxes = async (b: Uint8Array) => (await PDFDocument.load(b)).getPages().map((p) => ({ ...p.getMediaBox(), crop: p.getCropBox(), rot: p.getRotation().angle }));

describe('ritaglio', () => {
  it('toglie i margini da MediaBox e CropBox', async () => {
    const r = await transformPages(await sample(), { kind: 'crop', margins: { top: 10, right: 20, bottom: 30, left: 40 }, pages: '' });
    if (!r.ok) throw new Error('no');
    const [b] = await boxes(r.bytes);
    expect([b.x, b.y, b.width, b.height]).toEqual([40, 30, 240, 360]);
    expect([b.crop.x, b.crop.y, b.crop.width, b.crop.height]).toEqual([40, 30, 240, 360]);
  });
  it('pagina ruotata: i margini sono quelli che si vedono a schermo', async () => {
    expect(rawMargins(90, { top: 1, right: 2, bottom: 3, left: 4 })).toEqual({ top: 2, right: 3, bottom: 4, left: 1 });
    expect(rawMargins(180, { top: 1, right: 2, bottom: 3, left: 4 })).toEqual({ top: 3, right: 4, bottom: 1, left: 2 });
    expect(rawMargins(270, { top: 1, right: 2, bottom: 3, left: 4 })).toEqual({ top: 4, right: 1, bottom: 2, left: 3 });
    const r = await transformPages(await sample([[300, 400, 90]]), { kind: 'crop', margins: { top: 10, right: 0, bottom: 0, left: 0 }, pages: '' });
    if (!r.ok) throw new Error('no');
    const [b] = await boxes(r.bytes);
    expect([b.x, b.y, b.width, b.height]).toEqual([10, 0, 290, 400]); // il «sopra» a schermo è il lato sinistro della pagina vera
  });
  it('solo le pagine scelte; troppo ritaglio e intervallo errato danno errore', async () => {
    const src = await sample([[300, 400], [300, 400], [300, 400]]);
    const r = await transformPages(src, { kind: 'crop', margins: { top: 0, right: 0, bottom: 0, left: 50 }, pages: '2' });
    if (!r.ok) throw new Error('no');
    expect((await boxes(r.bytes)).map((b) => b.width)).toEqual([300, 250, 300]);
    expect(await transformPages(src, { kind: 'crop', margins: { top: 0, right: 200, bottom: 0, left: 120 }, pages: '' })).toMatchObject({ ok: false, error: { code: 'tooMuch', page: 1 } });
    expect(await transformPages(src, { kind: 'crop', margins: { top: 1, right: 1, bottom: 1, left: 1 }, pages: '9' })).toMatchObject({ ok: false, error: { code: 'range' } });
  });
});

describe('percentuale', () => {
  it('50% dimezza la pagina, fuori scala è un errore', async () => {
    const r = await transformPages(await sample(), { kind: 'scale', percent: 50, pages: '' });
    if (!r.ok) throw new Error('no');
    const [b] = await boxes(r.bytes);
    expect([b.width, b.height]).toEqual([150, 200]);
    expect(await transformPages(await sample(), { kind: 'scale', percent: 5, pages: '' })).toMatchObject({ ok: false, error: { code: 'percent' } });
  });
});

describe('adatta al formato', () => {
  it('pagine verticali e orizzontali diventano A4 con lo stesso orientamento', async () => {
    const r = await transformPages(await sample([[300, 400], [500, 300]]), { kind: 'fit', size: 'A4', margin: 0, pages: '' });
    if (!r.ok) throw new Error('no');
    const bs = await boxes(r.bytes);
    expect(bs[0].width).toBeCloseTo(SIZES.A4[0]);
    expect(bs[0].height).toBeCloseTo(SIZES.A4[1]);
    expect(bs[1].width).toBeCloseTo(SIZES.A4[1]);
    expect(bs[1].height).toBeCloseTo(SIZES.A4[0]);
  });
  it('pagina ruotata: rotazione conservata e formato a schermo corretto', async () => {
    const r = await transformPages(await sample([[300, 400, 90]]), { kind: 'fit', size: 'Letter', margin: 10, pages: '' });
    if (!r.ok) throw new Error('no');
    const [b] = await boxes(r.bytes);
    expect(b.rot).toBe(90);
    // a schermo la pagina era orizzontale (400x300): il Letter orizzontale è 792x612, e dentro la pagina «vera» è 612x792
    expect([b.width, b.height]).toEqual([612, 792]);
  });
  it('pagine non scelte restano com\'erano', async () => {
    const r = await transformPages(await sample([[300, 400], [300, 400]]), { kind: 'fit', size: 'A5', margin: 0, pages: '1' });
    if (!r.ok) throw new Error('no');
    const bs = await boxes(r.bytes);
    expect(bs[0].width).toBeCloseTo(SIZES.A5[0]);
    expect([bs[1].width, bs[1].height]).toEqual([300, 400]);
    expect(MM).toBeCloseTo(2.8346, 3);
  });
});
