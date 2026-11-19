// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { loadPdfjs } from '../pdf-tools/pdf-thumbs';
import type { RawItem } from './pdf-to-text';

/** Il PDF chiede una password (`wrong`: quella data non è giusta). */
export class PasswordNeededError extends Error {
  constructor(readonly wrong: boolean) {
    super('password');
  }
}

/** Oltre questo numero di pagine il PDF si rifiuta (la lettura tiene in memoria gli elementi di tutte le pagine). */
export const MAX_PAGES = 1500;

export interface ReadResult {
  /** Elementi di testo di ogni pagina, nell'ordine delle pagine. */
  pages: RawItem[][];
}

/**
 * Legge gli elementi di testo di tutte le pagine con pdf.js (stesso worker locale e stessa configurazione degli altri
 * strumenti PDF). La password serve solo per aprire il file: non viene conservata e il documento viene chiuso a fine lettura.
 * `onProgress` riceve (pagine lette, pagine totali).
 */
export async function readPdfItems(bytes: Uint8Array, password: string | undefined, onProgress?: (done: number, total: number) => void): Promise<ReadResult> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: bytes,
    password,
    useWasm: false,
    enableXfa: false,
    verbosity: 0,
    standardFontDataUrl: new URL('pdfjs/standard_fonts/', document.baseURI).href,
  });
  try {
    const doc = await task.promise;
    if (doc.numPages > MAX_PAGES) throw new RangeError('too many pages');
    const pages: RawItem[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      try {
        const content = await page.getTextContent();
        const items: RawItem[] = [];
        for (const it of content.items) {
          if (!('str' in it)) continue; // contrassegni di contenuto marcato: nessun testo
          const t = it.transform as number[];
          items.push({ str: it.str, x: t[4], y: t[5], width: it.width, height: it.height || Math.abs(t[3]) || Math.hypot(t[0], t[1]) });
        }
        pages.push(items);
      } finally {
        page.cleanup();
      }
      onProgress?.(n, doc.numPages);
    }
    return { pages };
  } catch (e) {
    if ((e as { name?: string })?.name === 'PasswordException') throw new PasswordNeededError((e as { code?: number }).code === 2);
    throw e;
  } finally {
    void task.destroy();
  }
}
