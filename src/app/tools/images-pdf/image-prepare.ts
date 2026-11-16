// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { detectFormat, readOrientation } from '../exif-viewer/exif-parser';
import type { PreparedImage } from './pdf-build';

/** Lato massimo (pixel) di un'immagine ridisegnata: oltre si riduce, per non esaurire la memoria. */
export const MAX_SIDE = 8192;
export const THUMB_SIDE = 240;

export const isHeic = (file: File) => /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/.test(file.type);

/** JPG, PNG e WebP (dal tipo MIME o dall'estensione). */
export function isSupportedImage(file: File): boolean {
  return /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

export interface Inspected {
  width: number;
  height: number;
  thumbUrl: string;
}

function canvasToBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, quality));
}

function drawOpaque(bitmap: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const s = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bitmap.width * s));
  c.height = Math.max(1, Math.round(bitmap.height * s));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  return c;
}

/** Dimensioni (con orientamento EXIF applicato) e miniatura. Lancia se l'immagine non si decodifica. */
export async function inspectImage(file: File): Promise<Inspected> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const c = drawOpaque(bitmap, THUMB_SIDE);
    const blob = await canvasToBlob(c, 'image/jpeg', 0.8);
    c.width = c.height = 0;
    return { width: bitmap.width, height: bitmap.height, thumbUrl: URL.createObjectURL(blob) };
  } finally {
    bitmap.close();
  }
}

/**
 * Immagine pronta per il PDF. Con qualità 100 un JPEG o PNG senza rotazione EXIF si inserisce com'è
 * (nessuna perdita); in tutti gli altri casi si ridisegna su fondo bianco e si ricodifica in JPEG.
 */
export async function prepareImage(file: File, quality: number, size: { width: number; height: number }): Promise<PreparedImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectFormat(bytes);
  if (quality >= 100 && readOrientation(bytes) === 1) {
    if (format === 'jpeg') return { bytes, kind: 'jpg', ...size };
    if (format === 'png') return { bytes, kind: 'png', ...size };
  }
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]), { imageOrientation: 'from-image' });
  try {
    const c = drawOpaque(bitmap, MAX_SIDE);
    const blob = await canvasToBlob(c, 'image/jpeg', Math.min(1, Math.max(0.05, quality / 100)));
    const out: PreparedImage = { bytes: new Uint8Array(await blob.arrayBuffer()), kind: 'jpg', width: c.width, height: c.height };
    c.width = c.height = 0;
    return out;
  } finally {
    bitmap.close();
  }
}
