// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { contentBounds, fitMax, removeWhiteBackground, strokeWidthAt, type Stroke } from './pdf-sign';

/** Larghezza interna (px) della pagina disegnata: l'anteprima si adatta via CSS. */
export const PAGE_RENDER_WIDTH = 1000;
/** Lato massimo (px) dell'immagine della firma: abbastanza per una stampa nitida, poco peso nel PDF. */
export const SIGNATURE_MAX_SIDE = 1200;

/** Dimensioni (rapporto larghezza/altezza) di ogni pagina, come le vede l'utente (rotazione compresa). */
export async function pageRatios(doc: PDFDocumentProxy): Promise<number[]> {
  const out: number[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const v = page.getViewport({ scale: 1 });
    out.push(v.width / v.height);
    page.cleanup();
  }
  return out;
}

let active: RenderTask | null = null;

/** Disegna la pagina `index` (da 0) nel canvas; una richiesta nuova annulla la precedente. */
export async function renderPage(doc: PDFDocumentProxy, index: number, canvas: HTMLCanvasElement): Promise<boolean> {
  active?.cancel();
  const page = await doc.getPage(index + 1);
  try {
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PAGE_RENDER_WIDTH / base.width });
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const task = page.render({ canvas, viewport });
    active = task;
    try {
      await task.promise;
      return true;
    } catch (e) {
      if ((e as { name?: string })?.name === 'RenderingCancelledException') return false;
      throw e;
    } finally {
      if (active === task) active = null;
    }
  } finally {
    page.cleanup();
  }
}

// ---------- firma disegnata ----------

/** Ridisegna tutti i tratti (curve morbide fra i punti medi). */
export function drawStrokes(canvas: HTMLCanvasElement, strokes: readonly Stroke[], scale: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    const pts = s.points;
    if (pts.length === 0) continue;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, (s.width * scale) / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const prevMid = i === 1 ? a : { x: (pts[i - 2].x + a.x) / 2, y: (pts[i - 2].y + a.y) / 2 };
      ctx.lineWidth = strokeWidthAt(s.width, (a.p + b.p) / 2, s.pen) * scale;
      ctx.beginPath();
      ctx.moveTo(prevMid.x, prevMid.y);
      ctx.quadraticCurveTo(a.x, a.y, mid.x, mid.y);
      ctx.stroke();
    }
    const last = pts[pts.length - 1];
    const lastMid = { x: (pts[pts.length - 2].x + last.x) / 2, y: (pts[pts.length - 2].y + last.y) / 2 };
    ctx.lineWidth = strokeWidthAt(s.width, last.p, s.pen) * scale;
    ctx.beginPath();
    ctx.moveTo(lastMid.x, lastMid.y);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
}

// ---------- firma digitata ----------

export type TypedStyle = 'script' | 'serif' | 'sans' | 'mono';
/** Font di sistema (nessun font scaricato): ognuno si disegna in corsivo, anche sintetico se manca la variante. */
export const TYPED_FONTS: Record<TypedStyle, string> = {
  script: '"Segoe Script", "Snell Roundhand", "Brush Script MT", "Apple Chancery", "URW Chancery L", "Z003", cursive',
  serif: 'Georgia, "Times New Roman", "Liberation Serif", serif',
  sans: '"Inter Tight Variable", "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono", "Courier New", monospace',
};
export const TYPED_STYLES = Object.keys(TYPED_FONTS) as TypedStyle[];

/** Disegna il testo in corsivo su un canvas trasparente. */
export function typedCanvas(text: string, style: TypedStyle, color: string): HTMLCanvasElement {
  const size = 150;
  const font = `italic ${size}px ${TYPED_FONTS[style]}`;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const width = Math.ceil(probe.measureText(text).width) + size;
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(8000, Math.max(200, width));
  canvas.height = Math.round(size * 2);
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, size / 2, size * 1.3);
  return canvas;
}

// ---------- da canvas a PNG ----------

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/png'));
}

export interface BuiltSignature {
  png: Uint8Array;
  url: string;
  /** Larghezza / altezza. */
  aspect: number;
}

/** Ritaglia il contenuto visibile del canvas (margine di pochi pixel), lo riduce se serve e lo converte in PNG trasparente. */
export async function canvasToSignature(canvas: HTMLCanvasElement): Promise<BuiltSignature | null> {
  const ctx = canvas.getContext('2d')!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const b = contentBounds(data.data, canvas.width, canvas.height, 8, 6);
  if (!b) return null;
  const size = fitMax(b.w, b.h, SIGNATURE_MAX_SIDE);
  const out = document.createElement('canvas');
  out.width = size.width;
  out.height = size.height;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(canvas, b.x, b.y, b.w, b.h, 0, 0, size.width, size.height);
  const blob = await toBlob(out);
  const result: BuiltSignature = { png: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob), aspect: size.width / size.height };
  out.width = out.height = 0;
  return result;
}

/** Firma da un'immagine (foto o scansione), con sfondo chiaro reso trasparente se richiesto. */
export async function imageToCanvas(file: Blob, removeBg: boolean, threshold: number): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const size = fitMax(bmp.width, bmp.height, SIGNATURE_MAX_SIDE * 2);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, size.width, size.height);
    if (removeBg) {
      const img = ctx.getImageData(0, 0, size.width, size.height);
      removeWhiteBackground(img.data, threshold);
      ctx.putImageData(img, 0, 0);
    }
    return canvas;
  } finally {
    bmp.close();
  }
}
