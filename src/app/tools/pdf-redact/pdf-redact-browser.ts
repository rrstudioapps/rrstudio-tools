// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PRODUCER, openForEdit } from '../pdf-common/pdf-file';
import { Areas, TextItem, countAreas } from './pdf-redact';

/** Parti dell'oscuramento che dipendono dal browser: disegno delle pagine con pdf.js e ricostruzione del PDF. */

/** Disegna la pagina `index` (da 0) con la larghezza data (in pixel); rende le misure in punti come si vede la pagina. */
export async function renderPage(doc: PDFDocumentProxy, index: number, canvas: HTMLCanvasElement, widthPx: number): Promise<{ width: number; height: number; rotation: number }> {
  const page = await doc.getPage(index + 1);
  try {
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: widthPx / base.width });
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    await page.render({ canvas, viewport: vp }).promise;
    return { width: base.width, height: base.height, rotation: page.rotate };
  } finally {
    page.cleanup();
  }
}

/** Elementi di testo di una pagina e le sue misure (in punti); pagine ruotate: nessun elemento. */
export async function pageText(doc: PDFDocumentProxy, index: number): Promise<{ items: TextItem[]; width: number; height: number; rotated: boolean }> {
  const page = await doc.getPage(index + 1);
  try {
    const vp = page.getViewport({ scale: 1 });
    if (page.rotate % 360 !== 0) return { items: [], width: vp.width, height: vp.height, rotated: true };
    const content = await page.getTextContent();
    const items = content.items.filter((i): i is typeof i & { str: string; transform: number[]; width: number; height: number } => 'str' in i).map((i) => ({ str: i.str, transform: i.transform, width: i.width, height: i.height }));
    return { items, width: vp.width, height: vp.height, rotated: false };
  } finally {
    page.cleanup();
  }
}

export type ImageFormat = 'jpeg' | 'png';

const toBytes = (canvas: HTMLCanvasElement, type: string, q: number): Promise<Uint8Array | null> =>
  new Promise((res) => canvas.toBlob((b) => (b ? void b.arrayBuffer().then((a) => res(new Uint8Array(a))) : res(null)), type, q));

/**
 * Crea il PDF oscurato: le pagine con aree diventano immagini (con i rettangoli neri già dentro), le altre sono copiate.
 * Un PDF con più di `maxPx` pixel per lato viene ridotto per non esaurire la memoria.
 */
export async function redactPdf(
  pdfjsDoc: PDFDocumentProxy,
  bytes: Uint8Array,
  areas: Areas,
  o: { dpi: number; format: ImageFormat },
  onPage: (done: number, total: number) => void,
): Promise<{ bytes: Uint8Array; pages: number; areas: number }> {
  const { PDFDocument } = await import('pdf-lib');
  const src = await openForEdit(bytes);
  const out = await PDFDocument.create();
  const total = src.getPageCount();
  const maxPx = 5000;
  for (let i = 0; i < total; i++) {
    onPage(i, total);
    const rects = areas[i] ?? [];
    if (rects.length === 0) {
      const [copy] = await out.copyPages(src, [i]);
      out.addPage(copy);
      continue;
    }
    const page = await pdfjsDoc.getPage(i + 1);
    try {
      const base = page.getViewport({ scale: 1 });
      let scale = o.dpi / 72;
      const longest = Math.max(base.width, base.height) * scale;
      if (longest > maxPx) scale *= maxPx / longest;
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(vp.width));
      canvas.height = Math.max(1, Math.floor(vp.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport: vp }).promise;
      ctx.fillStyle = '#000';
      for (const r of rects) ctx.fillRect(Math.floor(r.x * canvas.width), Math.floor(r.y * canvas.height), Math.ceil(r.w * canvas.width) + 1, Math.ceil(r.h * canvas.height) + 1);
      const data = await toBytes(canvas, o.format === 'png' ? 'image/png' : 'image/jpeg', 0.92);
      canvas.width = canvas.height = 0;
      if (!data) throw new Error('image');
      const img = o.format === 'png' ? await out.embedPng(data) : await out.embedJpg(data);
      const p = out.addPage([base.width, base.height]);
      p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
    } finally {
      page.cleanup();
    }
  }
  onPage(total, total);
  out.setProducer(PRODUCER);
  out.setCreator(PRODUCER);
  const title = src.getTitle();
  if (title) out.setTitle(title);
  const c = countAreas(areas);
  return { bytes: await out.save({ useObjectStreams: true }), pages: c.pages, areas: c.areas };
}
