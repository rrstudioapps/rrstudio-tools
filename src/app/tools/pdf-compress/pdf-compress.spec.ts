// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } from 'pdf-lib';
import { zlibSync } from 'fflate';
import { Recoder, compressImages, unpredict } from './pdf-compress';

const OPTS = { quality: 0.7, maxSide: 0 };

/** PDF con un'immagine: `filter` null = pixel RGB non compressi, 'Flate' = compressi, 'DCT' = byte finti di un JPEG. */
async function withImage(filter: null | 'Flate' | 'DCT', w = 120, h = 100, extra: Record<string, unknown> = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  let seed = 12345;
  const raw = new Uint8Array(w * h * 3).map(() => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 16) & 255); // quasi casuale: non si comprime
  const data = filter === 'Flate' ? zlibSync(raw) : filter === 'DCT' ? new Uint8Array(30_000).map((_, i) => (i * 13) % 256) : raw;
  const stream = doc.context.stream(data, {
    Type: 'XObject',
    Subtype: 'Image',
    Width: w,
    Height: h,
    ColorSpace: 'DeviceRGB',
    BitsPerComponent: 8,
    ...(filter ? { Filter: filter === 'Flate' ? 'FlateDecode' : 'DCTDecode' } : {}),
    ...extra,
  });
  const ref = doc.context.register(stream);
  page.node.Resources()?.set(PDFName.of('XObject'), doc.context.obj({ Im1: ref }));
  page.pushOperators();
  return doc.save();
}

async function firstImage(bytes: Uint8Array): Promise<{ width: number; filter: string; length: number }> {
  const doc = await PDFDocument.load(bytes);
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype'))?.toString() === '/Image') {
      return { width: (obj.dict.get(PDFName.of('Width')) as PDFNumber).asNumber(), filter: String(obj.dict.get(PDFName.of('Filter'))), length: obj.getContents().length };
    }
  }
  throw new Error('nessuna immagine');
}

const tiny: Recoder = async (inp) => ({ bytes: new Uint8Array(500), width: Math.round(inp.width / 2), height: Math.round(inp.height / 2) });

describe('compressImages', () => {
  it('JPEG: sostituisce con la versione più piccola e aggiorna le dimensioni', async () => {
    const r = await compressImages(await withImage('DCT'), tiny, OPTS);
    expect(r.report).toMatchObject({ images: 1, recoded: 1 });
    expect(await firstImage(r.bytes)).toMatchObject({ width: 60, filter: '/DCTDecode', length: 500 });
    expect(r.report.after).toBeLessThan(r.report.before);
  });
  it('pixel non compressi e Flate: decodificati e ricompressi', async () => {
    for (const f of [null, 'Flate'] as const) {
      const seen: number[] = [];
      const rec: Recoder = async (inp) => {
        seen.push(inp.data.length, inp.components);
        return { bytes: new Uint8Array(400), width: inp.width, height: inp.height };
      };
      const r = await compressImages(await withImage(f), rec, OPTS);
      expect(r.report.recoded).toBe(1);
      expect(seen).toEqual([120 * 100 * 3, 3]);
    }
  });
  it('se il risultato non è più piccolo, l\'immagine resta com\'è', async () => {
    const big: Recoder = async (inp) => ({ bytes: new Uint8Array(40_000), width: inp.width, height: inp.height });
    const r = await compressImages(await withImage('DCT'), big, OPTS);
    expect(r.report).toMatchObject({ recoded: 0, skipped: { bigger: 1 } });
    expect((await firstImage(r.bytes)).length).toBe(30_000);
  });
  it('immagini piccole, con maschera o con filtri non gestiti: saltate e contate', async () => {
    expect((await compressImages(await withImage('DCT', 40, 40), tiny, OPTS)).report.skipped).toEqual({ tiny: 1 });
    expect((await compressImages(await withImage('DCT', 120, 100, { Decode: [1, 0, 1, 0, 1, 0] }), tiny, OPTS)).report.skipped).toEqual({ mask: 1 });
    expect((await compressImages(await withImage('DCT', 120, 100, { Filter: 'CCITTFaxDecode' }), tiny, OPTS)).report.skipped).toEqual({ filter: 1 });
  });
  it('senza ricodificatore riscrive solo il file e non cambia le immagini', async () => {
    const src = await withImage('DCT');
    const r = await compressImages(src, null, OPTS);
    expect(r.report.recoded).toBe(0);
    expect((await firstImage(r.bytes)).length).toBe(30_000);
  });
  it('un ricodificatore che fallisce non rompe il PDF', async () => {
    const r = await compressImages(await withImage('DCT'), async () => { throw new Error('x'); }, OPTS);
    expect(r.report.skipped).toEqual({ failed: 1 });
    expect(PDFRef).toBeTruthy();
  });
});

describe('unpredict (filtri PNG)', () => {
  it('Up: ogni riga si somma alla precedente', () => {
    const data = new Uint8Array([0, 1, 2, 3, 2, 1, 1, 1]);
    expect(Array.from(unpredict(data, 1, 3, 8, 12)!)).toEqual([1, 2, 3, 2, 3, 4]);
  });
  it('Sub e Paeth', () => {
    expect(Array.from(unpredict(new Uint8Array([1, 5, 5, 5]), 3, 1, 8, 15)!)).toEqual([5, 10, 15]);
    expect(Array.from(unpredict(new Uint8Array([0, 10, 20, 4, 5, 5]), 2, 1, 8, 15)!)).toEqual([10, 20, 15, 25]);
  });
  it('predittore 1: nessuna modifica; formati non gestiti: null', () => {
    const d = new Uint8Array([1, 2, 3]);
    expect(unpredict(d, 3, 1, 8, 1)).toBe(d);
    expect(unpredict(d, 3, 1, 16, 12)).toBeNull();
  });
});
