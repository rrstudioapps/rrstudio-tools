// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { PDFDocument, PDFName } from 'pdf-lib';
import { EMPTY_META, infoDict, readMeta, writeMeta } from './pdf-metadata';

async function sample(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  doc.setTitle('Contratto');
  doc.setAuthor('Mario Rossi');
  doc.setKeywords(['a', 'b']);
  doc.setCreationDate(new Date('2026-01-02T03:04:05Z'));
  infoDict(doc).set(PDFName.of('Personale'), doc.context.obj('segreto'));
  const xmp = doc.context.stream('<x:xmpmeta/>', { Type: 'Metadata', Subtype: 'XML' });
  doc.catalog.set(PDFName.of('Metadata'), doc.context.register(xmp));
  return doc.save();
}

describe('metadati PDF', () => {
  it('legge campi standard, date, XMP e chiavi personalizzate', async () => {
    const r = await readMeta(await sample());
    expect(r.meta.title).toBe('Contratto');
    expect(r.meta.author).toBe('Mario Rossi');
    expect(r.meta.created).toBe('2026-01-02T03:04:05.000Z');
    expect(r.hasXmp).toBe(true);
    expect(r.customKeys).toEqual(['Personale']);
    expect(r.pages).toBe(1);
  });
  it('modifica un campo e ne toglie un altro lasciandolo vuoto', async () => {
    const src = await sample();
    const info = await readMeta(src);
    const w = await writeMeta(src, { ...info.meta, title: 'Nuovo', author: '' }, { removeXmp: false, removeCustom: false });
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    const after = await readMeta(w.bytes);
    expect(after.meta.title).toBe('Nuovo');
    expect(after.meta.author).toBe('');
    expect(after.hasXmp).toBe(true);
    expect(after.customKeys).toEqual(['Personale']);
  });
  it('rimozione totale: nessun campo, niente XMP, niente chiavi personalizzate', async () => {
    const w = await writeMeta(await sample(), EMPTY_META, { removeXmp: true, removeCustom: true });
    if (!w.ok) throw new Error('write');
    const after = await readMeta(w.bytes);
    expect(after.meta).toEqual(EMPTY_META);
    expect(after.hasXmp).toBe(false);
    expect(after.customKeys).toEqual([]);
  });
  it('data non valida: errore sul campo', async () => {
    expect(await writeMeta(await sample(), { ...EMPTY_META, created: 'ieri' }, { removeXmp: false, removeCustom: false })).toEqual({ ok: false, field: 'created' });
  });
});
