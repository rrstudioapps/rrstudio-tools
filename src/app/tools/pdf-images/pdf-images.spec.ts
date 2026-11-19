// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { unzlibSync } from 'fflate';
import { PDFArray, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { encodePng, extractImages } from './pdf-images';

/** Legge un PNG prodotto da encodePng: dimensioni, tipo di colore e pixel (righe senza filtro). */
function readPng(png: Uint8Array): { w: number; h: number; type: number; px: Uint8Array } {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const w = dv.getUint32(16);
  const h = dv.getUint32(20);
  const type = png[25];
  const len = dv.getUint32(33);
  expect(String.fromCharCode(...png.subarray(37, 41))).toBe('IDAT');
  const raw = unzlibSync(png.subarray(41, 41 + len));
  const ch = { 0: 1, 4: 2, 2: 3, 6: 4 }[type] as number;
  const px = new Uint8Array(w * h * ch);
  for (let y = 0; y < h; y++) {
    expect(raw[y * (w * ch + 1)]).toBe(0);
    px.set(raw.subarray(y * (w * ch + 1) + 1, (y + 1) * (w * ch + 1)), y * w * ch);
  }
  return { w, h, type, px };
}

async function docWith(add: (doc: PDFDocument) => Promise<void> | void): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  await add(doc);
  return doc.save();
}

function rawImage(doc: PDFDocument, data: Uint8Array, dict: Record<string, unknown>, page: ReturnType<PDFDocument['addPage']>): void {
  const ref = doc.context.register(doc.context.stream(data, { Type: 'XObject', Subtype: 'Image', ...dict }));
  page.node.Resources()?.set(PDFName.of('XObject'), doc.context.obj({ Im1: ref }));
}

describe('encodePng', () => {
  it('scrive PNG validi per grigio, RGB e RGBA', () => {
    for (const ch of [1, 2, 3, 4] as const) {
      const px = new Uint8Array(4 * 3 * ch).map((_, i) => i * 5);
      const r = readPng(encodePng(4, 3, ch, px));
      expect([r.w, r.h]).toEqual([4, 3]);
      expect(Array.from(r.px)).toEqual(Array.from(px));
    }
  });
});

describe('extractImages', () => {
  it('PNG con trasparenza incorporato da pdf-lib: torna un PNG RGBA con gli stessi pixel', async () => {
    const px = new Uint8Array(20 * 20 * 4).map((_, i) => (i % 4 === 3 ? (i * 3) % 256 : (i * 7) % 256));
    const src = await docWith(async (doc) => {
      const img = await doc.embedPng(encodePng(20, 20, 4, px));
      doc.addPage([200, 200]).drawImage(img, { x: 10, y: 10, width: 100, height: 100 });
    });
    const r = await extractImages(src);
    expect(r.images).toHaveLength(1);
    const im = r.images[0];
    expect(im).toMatchObject({ format: 'png', width: 20, height: 20, alpha: true, page: 1 });
    expect(Array.from(readPng(im.bytes).px)).toEqual(Array.from(px));
  });
  it('JPEG: i byte restano identici', async () => {
    const jpeg = new Uint8Array(5000).map((_, i) => (i * 11) % 256);
    const src = await docWith((doc) => rawImage(doc, jpeg, { Width: 64, Height: 48, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode' }, doc.addPage()));
    const r = await extractImages(src);
    expect(r.images[0]).toMatchObject({ format: 'jpg', width: 64, height: 48, cmyk: false });
    expect(Array.from(r.images[0].bytes)).toEqual(Array.from(jpeg));
  });
  it('JPEG CMYK segnalato', async () => {
    const src = await docWith((doc) => rawImage(doc, new Uint8Array(100), { Width: 64, Height: 48, ColorSpace: 'DeviceCMYK', BitsPerComponent: 8, Filter: 'DCTDecode' }, doc.addPage()));
    expect((await extractImages(src)).images[0].cmyk).toBe(true);
  });
  it('palette a 1 bit: diventa RGB con i colori della tavolozza', async () => {
    // 16x16, righe da 2 byte: 0xAA = 10101010 (indici 1,0,1,0…)
    const data = new Uint8Array(32).fill(0xaa);
    const space = (doc: PDFDocument) => doc.context.obj(['Indexed', 'DeviceRGB', 1, PDFString.of('\xff\x00\x00\x00\x00\xff')]) as PDFArray;
    const src = await docWith((doc) => rawImage(doc, data, { Width: 16, Height: 16, ColorSpace: space(doc), BitsPerComponent: 1 }, doc.addPage()));
    const r = await extractImages(src);
    const png = readPng(r.images[0].bytes);
    expect(png.type).toBe(2);
    expect(Array.from(png.px.subarray(0, 6))).toEqual([0, 0, 255, 255, 0, 0]);
  });
  it('icone troppo piccole e maschere sono messe da parte; filtri rari contati', async () => {
    const src = await docWith((doc) => {
      const p = doc.addPage();
      const a = doc.context.register(doc.context.stream(new Uint8Array(10), { Type: 'XObject', Subtype: 'Image', Width: 4, Height: 4, ColorSpace: 'DeviceGray', BitsPerComponent: 8 }));
      const b = doc.context.register(doc.context.stream(new Uint8Array(10), { Type: 'XObject', Subtype: 'Image', Width: 40, Height: 40, ImageMask: true, BitsPerComponent: 1 }));
      const c = doc.context.register(doc.context.stream(new Uint8Array(10), { Type: 'XObject', Subtype: 'Image', Width: 40, Height: 40, ColorSpace: 'DeviceGray', BitsPerComponent: 1, Filter: 'CCITTFaxDecode' }));
      p.node.Resources()?.set(PDFName.of('XObject'), doc.context.obj({ A: a, B: b, C: c }));
    });
    const r = await extractImages(src);
    expect(r.images).toHaveLength(0);
    expect(r.tiny).toBe(1);
    expect(r.skipped).toEqual({ mask: 1, filter: 1 });
  });
});
