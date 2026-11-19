// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { FORMAT_MIME, prepareSvg, type OutFormat, type Size } from './svg-size';

/**
 * Disegna l'SVG sul canvas tramite <img> con un blob URL (gli script non girano e le risorse esterne non si caricano)
 * e lo codifica. `background` è un colore #rrggbb o null per la trasparenza; il JPEG, che non la ha, ripiega sul bianco.
 */
export async function renderSvg(svg: string, size: Size, format: OutFormat, background: string | null, quality: number): Promise<Blob> {
  const prepared = prepareSvg(svg, size);
  if (!prepared) throw new Error('svg');
  const url = URL.createObjectURL(new Blob([prepared], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error('decode');
    }
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    const fill = background ?? (format === 'jpeg' ? '#ffffff' : null);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, size.width, size.height);
    }
    ctx.drawImage(img, 0, 0, size.width, size.height);
    const mime = FORMAT_MIME[format];
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, format === 'png' ? undefined : Math.min(1, Math.max(0.01, quality / 100))));
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error('encode');
    // se il browser non sa codificare il formato (es. WebP) ripiega su PNG: va detto
    if (blob.type !== mime) throw new Error('format');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
