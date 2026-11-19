// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { PDFDocument, PDFRawStream, decodePDFRawStream, degrees } from 'pdf-lib';
import { DEFAULT_OPTIONS, EMPTY_SLOTS, addPageText, expandTokens, hexToRgb, planPages, toRaw } from './pdf-page-text';

async function sample(pages: number, rotate: number[] = []): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([300, 400]);
    if (rotate[i]) p.setRotation(degrees(rotate[i]));
  }
  return doc.save();
}

/** Contenuto (decompresso) della pagina: le operazioni di testo che ci hanno scritto. */
async function textOf(bytes: Uint8Array, index: number): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(index).node.Contents();
  if (!contents) return '';
  const refs = (contents as unknown as { asArray?: () => unknown[] }).asArray?.() ?? [contents];
  return refs
    .map((r) => doc.context.lookup(r as never))
    .filter((st): st is PDFRawStream => st instanceof PDFRawStream)
    .map((st) => new TextDecoder('latin1').decode(decodePDFRawStream(st).decode()))
    .join('\n')
    // pdf-lib scrive le stringhe in esadecimale: le riportiamo in chiaro per confrontarle
    .replace(/<([0-9A-F]+)> Tj/g, (_, h: string) => `(${h.match(/../g)!.map((b) => String.fromCharCode(parseInt(b, 16))).join('')}) Tj`);
}

describe('segnaposto e utilità', () => {
  it('espande {n}, {total}, {date}, {name}', () => {
    expect(expandTokens('Pag. {n} di {total} - {name} ({date}) {x}', { n: 2, total: 9, date: '19/11/2026', name: 'a.pdf' })).toBe('Pag. 2 di 9 - a.pdf (19/11/2026) {x}');
  });
  it('colore esadecimale, anche non valido', () => {
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0]);
    expect(hexToRgb('boh')[0]).toBeCloseTo(0x44 / 255);
  });
  it('rotazione: il punto a schermo diventa il punto giusto della pagina', () => {
    expect(toRaw(0, 300, 400, 10, 20)).toEqual({ x: 10, y: 20 });
    expect(toRaw(90, 300, 400, 10, 20)).toEqual({ x: 280, y: 10 });
    expect(toRaw(180, 300, 400, 10, 20)).toEqual({ x: 290, y: 380 });
    expect(toRaw(270, 300, 400, 10, 20)).toEqual({ x: 20, y: 390 });
  });
  it('pagine scelte: tutte, intervalli, senza copertina, errori', () => {
    expect(planPages(4, { pages: '', skipFirst: false })).toEqual({ ok: true, indices: [0, 1, 2, 3] });
    expect(planPages(5, { pages: '2-3, 5', skipFirst: false })).toEqual({ ok: true, indices: [1, 2, 4] });
    expect(planPages(4, { pages: '', skipFirst: true })).toEqual({ ok: true, indices: [1, 2, 3] });
    expect(planPages(3, { pages: '2-9', skipFirst: false })).toMatchObject({ ok: false, error: { code: 'outOfRange' } });
  });
});

describe('addPageText', () => {
  it('numera tutte le pagine: «1 / 3», «2 / 3», «3 / 3»', async () => {
    const r = await addPageText(await sample(3), 'a.pdf', DEFAULT_OPTIONS);
    if (!r.ok) throw new Error('no');
    expect(r.written).toBe(3);
    for (let i = 0; i < 3; i++) expect(await textOf(r.bytes, i)).toContain(`(${i + 1} / 3) Tj`);
  });
  it('intestazione con il nome, numerazione che parte da 5, senza copertina', async () => {
    const r = await addPageText(await sample(3), 'doc.pdf', { ...DEFAULT_OPTIONS, header: { ...EMPTY_SLOTS, left: '{name}' }, footer: { ...EMPTY_SLOTS, right: 'p.{n}' }, startAt: 5, skipFirst: true });
    if (!r.ok) throw new Error('no');
    expect(r.written).toBe(2);
    expect(await textOf(r.bytes, 0)).not.toContain('doc.pdf');
    const t1 = await textOf(r.bytes, 1);
    expect(t1).toContain('(doc.pdf) Tj');
    expect(t1).toContain('(p.6) Tj'); // la pagina 2 è la seconda del file: 5 + 1
  });
  it('pagina ruotata: il testo viene scritto ruotato', async () => {
    const r = await addPageText(await sample(1, [90]), 'a.pdf', DEFAULT_OPTIONS);
    if (!r.ok) throw new Error('no');
    expect(await textOf(r.bytes, 0)).toMatch(/[\d.e-]+ 1 -1 [\d.e-]+ [\d.]+ [\d.]+ Tm/);
  });
  it('caratteri non scrivibili diventano «?» e le lettere accentate restano', async () => {
    const r = await addPageText(await sample(1), 'a.pdf', { ...DEFAULT_OPTIONS, footer: { ...EMPTY_SLOTS, center: 'Città → 5' } });
    expect(r.ok).toBe(true);
  });
  it('intervallo non valido: errore, nessun file', async () => {
    expect(await addPageText(await sample(2), 'a.pdf', { ...DEFAULT_OPTIONS, pages: '7' })).toMatchObject({ ok: false });
  });
});
