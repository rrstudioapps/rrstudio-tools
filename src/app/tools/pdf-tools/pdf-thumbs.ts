// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { PDFDocumentProxy } from 'pdfjs-dist';

type PdfjsLib = typeof import('pdfjs-dist');

/** Il file è protetto da password (o ne richiede una). */
export class PasswordProtectedError extends Error {
  constructor() {
    super('password');
  }
}

/** Dimensione massima (px) del lato lungo delle miniature. */
export const THUMB_MAX = 360;

let lib: Promise<PdfjsLib> | null = null;

/**
 * Carica pdf.js alla prima richiesta. Worker, font standard e wasm vengono dallo stesso sito
 * (vedi gli asset in angular.json): nessuna richiesta a CDN.
 */
function loadPdfjs(): Promise<PdfjsLib> {
  lib ??= import('pdfjs-dist').then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.mjs', document.baseURI).href;
    return m;
  });
  return lib;
}

/** Apre un PDF per le miniature. I byte vengono passati a pdf.js (il worker li prende in carico). */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: bytes,
    // niente wasm (la CSP non lo permette) e niente scaricamenti da fuori
    useWasm: false,
    enableXfa: false,
    verbosity: 0,
    standardFontDataUrl: new URL('pdfjs/standard_fonts/', document.baseURI).href,
  });
  // una password richiesta equivale a "file non leggibile": si rifiuta subito
  task.onPassword = () => {
    void task.destroy();
  };
  try {
    return await task.promise;
  } catch (e) {
    void task.destroy();
    if ((e as { name?: string })?.name === 'PasswordException') throw new PasswordProtectedError();
    throw e;
  }
}

/** Disegna la pagina `index` (da 0) in una miniatura JPEG. Rende null se non riesce. */
export async function renderThumb(doc: PDFDocumentProxy, index: number): Promise<Blob | null> {
  const page = await doc.getPage(index + 1);
  try {
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(THUMB_MAX / base.width, THUMB_MAX / base.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
    canvas.width = canvas.height = 0;
    return blob;
  } finally {
    page.cleanup();
  }
}
