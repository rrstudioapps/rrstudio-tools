// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { FONT_CSS, MAX_PIXELS, cleanText, clamp, fontSize, layout, logoSize, type WatermarkSettings } from './image-watermark';

/** Decodifica l'immagine applicando l'orientamento EXIF. */
export function loadBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/**
 * Disegna la filigrana su un canvas già riempito con l'immagine. Le misure seguono il lato corto di `width`×`height`,
 * quindi lo stesso risultato vale per anteprima ridotta ed esportazione.
 */
export function paintWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, s: WatermarkSettings, logo: ImageBitmap | null): void {
  let w: number;
  let h: number;
  let draw: () => void;
  const text = cleanText(s.text);
  if (s.kind === 'image') {
    if (!logo) return;
    const sz = logoSize(logo.width, logo.height, s.logoScale, width, height);
    w = sz.w;
    h = sz.h;
    draw = () => {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(logo, -w / 2, -h / 2, w, h);
    };
  } else {
    if (!text) return;
    const px = fontSize(s.sizePct, width, height);
    ctx.font = `${s.bold ? 'bold ' : ''}${px}px ${FONT_CSS[s.font]}`;
    w = ctx.measureText(text).width;
    h = px * 1.15;
    draw = () => {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = s.color;
      ctx.fillText(text, 0, 0);
    };
  }
  ctx.save();
  ctx.globalAlpha = clamp(s.opacity, 1, 100) / 100;
  for (const p of layout(s, w, h, width, height)) {
    ctx.save();
    ctx.translate(p.cx, p.cy);
    ctx.rotate((s.rotation * Math.PI) / 180);
    draw();
    ctx.restore();
  }
  ctx.restore();
}

/** Anteprima: l'immagine ridotta a `maxSide` px con la filigrana sopra. Rende la dimensione del canvas. */
export function drawPreview(canvas: HTMLCanvasElement, source: CanvasImageSource & { width: number; height: number }, s: WatermarkSettings, logo: ImageBitmap | null, maxSide = 1000): void {
  const k = Math.min(1, maxSide / Math.max(source.width, source.height));
  canvas.width = Math.max(1, Math.round(source.width * k));
  canvas.height = Math.max(1, Math.round(source.height * k));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  paintWatermark(ctx, canvas.width, canvas.height, s, logo);
}

/** Immagine con filigrana a piena risoluzione, codificata nel formato richiesto (PNG se il browser non sa codificarlo). */
export async function renderImage(file: Blob, s: WatermarkSettings, logo: ImageBitmap | null, mime: string, quality: number): Promise<Blob> {
  const bmp = await loadBitmap(file);
  try {
    if (bmp.width * bmp.height > MAX_PIXELS) throw new Error('size');
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    // il JPEG non ha trasparenza: lo sfondo diventa bianco
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, bmp.width, bmp.height);
    }
    ctx.drawImage(bmp, 0, 0);
    paintWatermark(ctx, bmp.width, bmp.height, s, logo);
    const q = mime === 'image/png' ? undefined : clamp(quality, 1, 100) / 100;
    let blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, q));
    if (blob && blob.type !== mime) blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error('encode');
    return blob;
  } finally {
    bmp.close();
  }
}

/** Il logo come PNG (per incorporarlo nel PDF), ridotto se molto grande. */
export async function logoToPng(logo: ImageBitmap, maxSide = 1600): Promise<Uint8Array> {
  const k = Math.min(1, maxSide / Math.max(logo.width, logo.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(logo.width * k));
  canvas.height = Math.max(1, Math.round(logo.height * k));
  canvas.getContext('2d')!.drawImage(logo, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('encode');
  return new Uint8Array(await blob.arrayBuffer());
}
