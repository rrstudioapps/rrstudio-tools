// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { THUMB_SIDE } from './image-prepare';

export type OutFormat = 'png' | 'jpeg';
export type Dpi = 72 | 150 | 300;

export const DPIS: readonly Dpi[] = [72, 150, 300];
/** Pagine per conversione: ogni immagine resta in memoria finché non si scarica. */
export const MAX_PAGES = 50;
/** Pixel massimi di una pagina (A4 a 300 dpi sono circa 8,7 milioni). */
export const MAX_PIXELS = 50_000_000;
export const JPEG_QUALITY = 0.92;

/** Fattore di scala per i dpi voluti, ridotto se la pagina supererebbe MAX_PIXELS. */
export function renderScale(pageWidthPt: number, pageHeightPt: number, dpi: number): { scale: number; reduced: boolean } {
  const wanted = dpi / 72;
  const pixels = pageWidthPt * wanted * (pageHeightPt * wanted);
  if (pixels <= MAX_PIXELS) return { scale: wanted, reduced: false };
  return { scale: wanted * Math.sqrt(MAX_PIXELS / pixels), reduced: true };
}

export interface RenderedPage {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
  reduced: boolean;
}

function toBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, quality));
}

/** Disegna la pagina `index` (da 0) con i dpi dati e la codifica nel formato scelto, più una miniatura. */
export async function renderPageImage(doc: PDFDocumentProxy, index: number, dpi: Dpi, format: OutFormat): Promise<RenderedPage> {
  const page = await doc.getPage(index + 1);
  try {
    const base = page.getViewport({ scale: 1 });
    const { scale, reduced } = renderScale(base.width, base.height, dpi);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    await page.render({ canvas, viewport, background: 'rgb(255,255,255)' }).promise;
    const blob = format === 'png' ? await toBlob(canvas, 'image/png') : await toBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    // miniatura per l'anteprima
    const k = Math.min(1, THUMB_SIDE / Math.max(canvas.width, canvas.height));
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(canvas.width * k));
    t.height = Math.max(1, Math.round(canvas.height * k));
    t.getContext('2d')!.drawImage(canvas, 0, 0, t.width, t.height);
    const thumb = await toBlob(t, 'image/jpeg', 0.8);
    const out = { blob, thumb, width: canvas.width, height: canvas.height, reduced };
    canvas.width = canvas.height = t.width = t.height = 0;
    return out;
  } finally {
    page.cleanup();
  }
}

/** "documento" + pagina 3 di 12 + png → "documento-pagina-03.png". */
export function imageName(base: string, word: string, page: number, total: number, format: OutFormat): string {
  const width = String(Math.max(total, 1)).length;
  return `${base}-${word}-${String(page).padStart(width, '0')}.${format === 'jpeg' ? 'jpg' : 'png'}`;
}
