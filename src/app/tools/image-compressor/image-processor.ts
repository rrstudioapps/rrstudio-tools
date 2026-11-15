// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { CompressorSettings, ENCODABLE_MIMES, computeSize } from './image-compressor';

/** Risultato dell'elaborazione di una immagine. */
export interface ProcessResult {
  blob: Blob;
  /** Dimensioni dell'immagine di partenza (dopo l'orientamento EXIF) e di quella prodotta. */
  srcWidth: number;
  srcHeight: number;
  width: number;
  height: number;
  /** Miniatura (solo se richiesta). */
  thumb?: Blob;
}

export interface ProcessRequest {
  file: Blob;
  settings: CompressorSettings;
  /** MIME di uscita già risolto. */
  mime: string;
  wantThumb: boolean;
}

const THUMB_SIZE = 160;

/** Canvas indipendente dal contesto: OffscreenCanvas (anche nel worker) oppure <canvas> sul main thread. */
interface Surface {
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  toBlob(type: string, quality?: number): Promise<Blob>;
}

function createSurface(width: number, height: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(width, height);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('canvas');
    return { ctx, toBlob: (type, quality) => c.convertToBlob({ type, quality }) };
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas');
  return {
    ctx,
    toBlob: (type, quality) =>
      new Promise((resolve, reject) =>
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, quality),
      ),
  };
}

function drawScaled(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  background: string | null,
): Surface {
  const s = createSurface(width, height);
  if (background) {
    s.ctx.fillStyle = background;
    s.ctx.fillRect(0, 0, width, height);
  }
  s.ctx.imageSmoothingEnabled = true;
  s.ctx.imageSmoothingQuality = 'high';
  s.ctx.drawImage(bitmap, 0, 0, width, height);
  return s;
}

/**
 * Decodifica (rispettando l'orientamento EXIF), ridimensiona e ricodifica. Il canvas non porta con sé i
 * metadati: EXIF (GPS compreso) viene scartato. Le GIF animate danno solo il primo fotogramma.
 */
export async function processImage(req: ProcessRequest): Promise<ProcessResult> {
  const { settings, mime } = req;
  const bitmap = await createImageBitmap(req.file, { imageOrientation: 'from-image' });
  try {
    const srcWidth = bitmap.width;
    const srcHeight = bitmap.height;
    const size = computeSize(srcWidth, srcHeight, settings.resizeMode, settings.resizeValue);
    // lo sfondo serve solo dove la trasparenza non esiste (JPEG)
    const bg = mime === 'image/jpeg' ? settings.background : null;
    const surface = drawScaled(bitmap, size.width, size.height, bg);
    const quality = mime === 'image/png' ? undefined : settings.quality / 100;
    const blob = await surface.toBlob(mime, quality);
    if (blob.type !== mime) throw new Error('encode');
    const result: ProcessResult = { blob, srcWidth, srcHeight, width: size.width, height: size.height };
    if (req.wantThumb) {
      const k = Math.min(1, THUMB_SIZE / Math.max(srcWidth, srcHeight));
      const tw = Math.max(1, Math.round(srcWidth * k));
      const th = Math.max(1, Math.round(srcHeight * k));
      const thumbSurface = drawScaled(bitmap, tw, th, null);
      result.thumb = await thumbSurface.toBlob('image/webp', 0.7);
    }
    return result;
  } finally {
    bitmap.close();
  }
}

/** Formati che questo browser sa produrre davvero (prova con una tela 1×1). Solo sul main thread. */
export async function detectEncodableFormats(): Promise<Set<string>> {
  const found = new Set<string>();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  canvas.getContext('2d')?.fillRect(0, 0, 1, 1);
  await Promise.all(
    ENCODABLE_MIMES.map(
      (m) =>
        new Promise<void>((resolve) => {
          try {
            canvas.toBlob((b) => {
              if (b && b.type === m) found.add(m);
              resolve();
            }, m, 0.8);
          } catch {
            resolve();
          }
        }),
    ),
  );
  return found;
}
