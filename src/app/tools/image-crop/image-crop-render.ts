// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { MAX_SIDE, MIME, limitSize, rotatedSize, type OutFormat, type Rect, type Size } from './image-crop';

/** Decodifica l'immagine applicando l'orientamento EXIF (il browser ruota i pixel in decodifica). */
export function loadBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/** Trasformazione scelta dall'utente (rotazione totale in gradi e riflessi, visti a schermo). */
export interface View {
  angle: number;
  flipH: boolean;
  flipV: boolean;
}

/** Dimensione dell'immagine trasformata (riquadro che contiene l'immagine ruotata, ridotto se oltre MAX_SIDE) e fattore di scala. */
export function transformedSize(bitmap: Size, angle: number): { size: Size; k: number } {
  const raw = rotatedSize(bitmap.width, bitmap.height, angle);
  const size = limitSize(raw, MAX_SIDE);
  return { size, k: size.width / raw.width };
}

/** Disegna l'immagine trasformata nel sistema di coordinate corrente del contesto (origine in alto a sinistra dell'immagine trasformata). */
export function paintTransformed(ctx: CanvasRenderingContext2D, bitmap: ImageBitmap, view: View): Size {
  const { size, k } = transformedSize(bitmap, view.angle);
  ctx.save();
  ctx.translate(size.width / 2, size.height / 2);
  ctx.scale(view.flipH ? -1 : 1, view.flipV ? -1 : 1);
  ctx.rotate((view.angle * Math.PI) / 180);
  ctx.scale(k, k);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  ctx.restore();
  return size;
}

/** Disegna l'anteprima (lato lungo al massimo `maxSide` px) e rende la dimensione dell'immagine trasformata. */
export function drawPreview(canvas: HTMLCanvasElement, bitmap: ImageBitmap, view: View, maxSide = 1400): Size {
  const { size } = transformedSize(bitmap, view.angle);
  const s = Math.min(1, maxSide / Math.max(size.width, size.height));
  canvas.width = Math.max(1, Math.round(size.width * s));
  canvas.height = Math.max(1, Math.round(size.height * s));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(canvas.width / size.width, canvas.height / size.height);
  paintTransformed(ctx, bitmap, view);
  ctx.restore();
  return size;
}

/** Ritaglia, ridimensiona ed esporta. Nessun metadato viene copiato: i pixel sono ridisegnati da zero. */
export async function exportCrop(
  bitmap: ImageBitmap,
  view: View,
  crop: Rect,
  out: Size,
  format: OutFormat,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  // il JPEG non ha trasparenza: gli angoli vuoti diventano bianchi
  if (format === 'jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.save();
  ctx.scale(out.width / crop.w, out.height / crop.h);
  ctx.translate(-crop.x, -crop.y);
  paintTransformed(ctx, bitmap, view);
  ctx.restore();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, MIME[format], Math.min(1, Math.max(0.01, quality / 100))));
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error('encode');
  // se il browser non sa codificare il formato (es. WebP) ripiega su PNG: va detto
  if (blob.type !== MIME[format]) throw new Error('format');
  return blob;
}
