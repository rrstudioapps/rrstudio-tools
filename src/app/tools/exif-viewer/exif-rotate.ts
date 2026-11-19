// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ImageFormat } from './exif-parser';

const MIME: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/**
 * Ruota davvero i pixel secondo l'orientamento EXIF (il browser lo applica in decodifica) e
 * ricodifica nello stesso formato: così l'immagine esce dritta e senza alcun metadato.
 * L'immagine viene ricompressa (JPEG e WebP con qualità 0,92), quindi può perdere un po' di qualità.
 */
export async function rotatePixels(bytes: Uint8Array, format: ImageFormat): Promise<Uint8Array> {
  const mime = MIME[format];
  if (!mime) throw new Error('formato non supportato');
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]), { imageOrientation: 'from-image' });
  try {
    const c = document.createElement('canvas');
    c.width = bitmap.width;
    c.height = bitmap.height;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), mime, 0.92),
    );
    c.width = c.height = 0;
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}
