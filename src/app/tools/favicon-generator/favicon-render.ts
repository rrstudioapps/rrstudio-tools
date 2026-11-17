// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { FitMode, Shape, clipText, cornerRadius, layoutImage, textFontSize } from './favicon';

export type FontFamily = 'sans' | 'serif' | 'mono';

const FONT_STACKS: Record<FontFamily, string> = {
  sans: '"Inter Tight", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
  serif: 'Georgia, "Times New Roman", serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"',
};

/** Immagine caricata dall'utente (PNG, JPG, SVG…), pronta da disegnare. */
export interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface RenderOptions {
  /** Colore di sfondo `#rrggbb`, o null per lo sfondo trasparente. */
  background: string | null;
  shape: Shape;
  /** Margine in % per lato (0-40). */
  padding: number;
  fit: FitMode;
  zoom: number;
}

export type RenderSource =
  | { kind: 'image'; image: LoadedImage }
  | { kind: 'text'; text: string; color: string; font: FontFamily; bold: boolean };

/** Carica un file immagine in un elemento <img> (anche SVG). Rifiuta se il browser non riesce a decodificarlo. */
export function loadImageFile(file: Blob): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // un SVG senza width/height può risultare 0×0: si ripiega su un quadrato di lavoro
      const w = img.naturalWidth || 512;
      const h = img.naturalHeight || 512;
      resolve({ source: img, width: w, height: h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}

function roundedRectPath(ctx: CanvasRenderingContext2D, size: number, r: number): void {
  ctx.beginPath();
  if (r <= 0) {
    ctx.rect(0, 0, size, size);
    return;
  }
  ctx.moveTo(r, 0);
  ctx.arcTo(size, 0, size, size, r);
  ctx.arcTo(size, size, 0, size, r);
  ctx.arcTo(0, size, 0, 0, r);
  ctx.arcTo(0, 0, size, 0, r);
  ctx.closePath();
}

/** Disegna la favicon su un canvas quadrato di lato `size`. */
export function drawFavicon(canvas: HTMLCanvasElement, size: number, src: RenderSource, opts: RenderOptions): void {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  roundedRectPath(ctx, size, cornerRadius(opts.shape, size));
  ctx.clip();
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (src.kind === 'image') {
    const l = layoutImage(src.image.width, src.image.height, size, opts.padding, opts.fit, opts.zoom);
    ctx.drawImage(src.image.source, l.sx, l.sy, l.sw, l.sh, l.dx, l.dy, l.dw, l.dh);
  } else {
    const text = clipText(src.text);
    if (text) {
      const inner = size * (1 - (2 * opts.padding) / 100);
      const px = Math.max(4, Math.round(textFontSize(text, size) * (inner / size)));
      ctx.fillStyle = src.color;
      ctx.font = `${src.bold ? 700 : 400} ${px}px ${FONT_STACKS[src.font]}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const m = ctx.measureText(text);
      const asc = m.actualBoundingBoxAscent || px * 0.75;
      const desc = m.actualBoundingBoxDescent || 0;
      ctx.fillText(text, size / 2, size / 2 + (asc - desc) / 2);
    }
  }
  ctx.restore();
}

/** Canvas → byte di un PNG. */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('png'));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}
