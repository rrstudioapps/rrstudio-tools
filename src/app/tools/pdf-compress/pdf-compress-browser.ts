// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { openPdf } from '../pdf-tools/pdf-thumbs';
import { PRODUCER } from '../pdf-common/pdf-file';
import type { Recoder } from './pdf-compress';

/** Parti di «Comprimi PDF» che dipendono dal browser (canvas, createImageBitmap, pdf.js). */

const toJpeg = (canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array | null> =>
  new Promise((res) => canvas.toBlob((b) => (b ? void b.arrayBuffer().then((a) => res(new Uint8Array(a))) : res(null)), 'image/jpeg', quality));

/** Riduce (se serve) e ricodifica in JPEG un'immagine del PDF. Lo sfondo trasparente diventa bianco. */
export const browserRecoder: Recoder = async (input, o) => {
  let source: ImageBitmap | HTMLCanvasElement;
  let w = input.width;
  let h = input.height;
  if (input.kind === 'jpeg') {
    const bmp = await createImageBitmap(new Blob([input.data as BlobPart], { type: 'image/jpeg' }));
    source = bmp;
    w = bmp.width;
    h = bmp.height;
  } else {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const n = w * h;
    if (input.components === 3) {
      for (let i = 0, j = 0, k = 0; i < n; i++, j += 3, k += 4) {
        d[k] = input.data[j];
        d[k + 1] = input.data[j + 1];
        d[k + 2] = input.data[j + 2];
        d[k + 3] = 255;
      }
    } else {
      for (let i = 0, k = 0; i < n; i++, k += 4) {
        d[k] = d[k + 1] = d[k + 2] = input.data[i];
        d[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    source = c;
  }
  const longest = Math.max(w, h);
  const k = o.maxSide > 0 && longest > o.maxSide ? o.maxSide / longest : 1;
  const tw = Math.max(1, Math.round(w * k));
  const th = Math.max(1, Math.round(h * k));
  const out = document.createElement('canvas');
  out.width = tw;
  out.height = th;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, tw, th);
  ctx.drawImage(source, 0, 0, tw, th);
  if ('close' in source) source.close();
  const bytes = await toJpeg(out, o.quality);
  out.width = out.height = 0;
  return bytes ? { bytes, width: tw, height: th } : null;
};

/**
 * Modo massimo: ogni pagina diventa un'immagine JPEG della stessa misura. Si perdono testo selezionabile, link e
 * vettori, ma i file di scansioni e tavole molto pesanti si riducono moltissimo.
 */
export async function rasterizePdf(bytes: Uint8Array, dpi: number, quality: number, onPage: (done: number, total: number) => void): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const src = await openPdf(bytes.slice());
  const out = await PDFDocument.create();
  try {
    for (let i = 1; i <= src.numPages; i++) {
      onPage(i - 1, src.numPages);
      const page = await src.getPage(i);
      try {
        const base = page.getViewport({ scale: 1 });
        let scale = dpi / 72;
        const longest = Math.max(base.width, base.height) * scale;
        if (longest > 4096) scale *= 4096 / longest;
        const vp = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(vp.width));
        canvas.height = Math.max(1, Math.floor(vp.height));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        await page.render({ canvas, viewport: vp }).promise;
        const jpg = await toJpeg(canvas, quality);
        canvas.width = canvas.height = 0;
        if (!jpg) throw new Error('jpeg');
        const img = await out.embedJpg(jpg);
        const p = out.addPage([base.width, base.height]);
        p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      } finally {
        page.cleanup();
      }
    }
    onPage(src.numPages, src.numPages);
  } finally {
    void src.loadingTask.destroy();
  }
  out.setProducer(PRODUCER);
  out.setCreator(PRODUCER);
  return out.save({ useObjectStreams: true });
}
