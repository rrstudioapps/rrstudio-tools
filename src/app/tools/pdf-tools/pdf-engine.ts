// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { PDFDocument } from 'pdf-lib';

/** Pagina da inserire nel PDF di uscita. `rotation` è la rotazione aggiunta a quella già presente nel file. */
export interface OutPage {
  sourceId: number;
  index: number;
  rotation: number;
}

export const PRODUCER = 'rrstudio Tools';

/**
 * Costruisce PDF con pdf-lib (caricata solo alla prima richiesta). Tiene in cache i documenti
 * d'origine finché non si chiama `dispose()`, così una divisione in tanti file non rilegge ogni volta.
 */
export class PdfBuilder {
  private readonly cache = new Map<number, Promise<PDFDocument>>();

  constructor(private readonly loadBytes: (sourceId: number) => Promise<Uint8Array>) {}

  private source(id: number): Promise<PDFDocument> {
    let doc = this.cache.get(id);
    if (!doc) {
      doc = (async () => {
        const { PDFDocument } = await import('pdf-lib');
        // updateMetadata false: così il titolo letto è quello vero del file
        return PDFDocument.load(await this.loadBytes(id), { updateMetadata: false });
      })();
      this.cache.set(id, doc);
    }
    return doc;
  }

  /**
   * Crea un PDF con le pagine date, nell'ordine dato. Producer/Creator "rrstudio Tools"; il titolo è
   * quello di `titleSourceId` (il primo file caricato), se ce l'ha.
   */
  async build(pages: readonly OutPage[], titleSourceId?: number): Promise<Uint8Array> {
    const { PDFDocument, degrees } = await import('pdf-lib');
    const out = await PDFDocument.create();
    // per ogni file d'origine una sola copyPages: le risorse condivise (font, immagini) non si duplicano
    const bySource = new Map<number, number[]>();
    for (const p of pages) {
      const list = bySource.get(p.sourceId) ?? [];
      list.push(p.index);
      bySource.set(p.sourceId, list);
    }
    const copied = new Map<string, ReturnType<PDFDocument['getPage']>>();
    for (const [id, indices] of bySource) {
      const src = await this.source(id);
      const unique = [...new Set(indices)];
      const result = await out.copyPages(src, unique);
      unique.forEach((idx, k) => copied.set(`${id}:${idx}`, result[k]));
    }
    const used = new Set<ReturnType<PDFDocument['getPage']>>();
    for (const p of pages) {
      let page = copied.get(`${p.sourceId}:${p.index}`)!;
      if (used.has(page)) {
        // stessa pagina usata due volte: copia separata
        const src = await this.source(p.sourceId);
        [page] = await out.copyPages(src, [p.index]);
      }
      used.add(page);
      const total = (page.getRotation().angle + p.rotation) % 360;
      page.setRotation(degrees(total));
      out.addPage(page);
    }
    const titleId = titleSourceId ?? pages[0]?.sourceId;
    if (titleId !== undefined) {
      const title = (await this.source(titleId)).getTitle();
      if (title) out.setTitle(title);
    }
    out.setProducer(PRODUCER);
    out.setCreator(PRODUCER);
    const now = new Date();
    out.setCreationDate(now);
    out.setModificationDate(now);
    return out.save({ useObjectStreams: true });
  }

  dispose(): void {
    this.cache.clear();
  }
}
