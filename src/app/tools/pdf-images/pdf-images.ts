// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { unzlibSync, zlibSync } from 'fflate';
import type { PDFArray, PDFDict, PDFObject } from 'pdf-lib';
import { PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString, PDFHexString } from 'pdf-lib';
import { openForEdit } from '../pdf-common/pdf-file';
import { unpredict } from '../pdf-compress/pdf-compress';

/**
 * Estrae le immagini incorporate in un PDF, così come sono: i JPEG restano JPEG (nessuna perdita), JPEG 2000 resta .jp2,
 * le immagini a pixel (grigio, RGB, a palette, con trasparenza) diventano PNG. Non estrae le pagine disegnate in vettoriale
 * né le immagini con compressioni rare (CCITT, JBIG2) o a bit per componente diversi da 1, 2, 4, 8.
 */

export type ImageFormat = 'jpg' | 'png' | 'jp2';

export interface FoundImage {
  id: number;
  /** Pagina (da 1) che la usa direttamente, 0 se non si sa. */
  page: number;
  width: number;
  height: number;
  format: ImageFormat;
  bytes: Uint8Array;
  /** JPEG in CMYK: molti programmi lo mostrano con i colori sbagliati. */
  cmyk: boolean;
  /** Ha un canale di trasparenza (PNG RGBA o a toni di grigio con alfa). */
  alpha: boolean;
}

export type SkipReason = 'filter' | 'format' | 'mask';

export interface Extraction {
  images: FoundImage[];
  skipped: Partial<Record<SkipReason, number>>;
  /** Immagini troppo piccole per essere interessanti (icone, linee, maschere) non incluse. */
  tiny: number;
}

const nm = (s: string): PDFName => PDFName.of(s);
const num = (o: PDFObject | undefined): number | undefined => (o instanceof PDFNumber ? o.asNumber() : undefined);
const nameOf = (o: PDFObject | undefined): string | undefined => (o instanceof PDFName ? o.decodeText() : undefined);

// ---------------------------------------------------------------- PNG

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const be32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  out.set(be32(data.length), 0);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  out.set(be32(crc32(out.subarray(4, 8 + data.length))), 8 + data.length);
  return out;
}

/** PNG a 8 bit da pixel `channels` (1 grigio, 2 grigio+alfa, 3 RGB, 4 RGBA), righe senza filtro. */
export function encodePng(width: number, height: number, channels: 1 | 2 | 3 | 4, pixels: Uint8Array): Uint8Array {
  const stride = width * channels;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) raw.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const type = { 1: 0, 2: 4, 3: 2, 4: 6 }[channels];
  const ihdr = new Uint8Array([...be32(width), ...be32(height), 8, type, 0, 0, 0]);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlibSync(raw, { level: 6 })), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ---------------------------------------------------------------- lettura delle immagini

/** Pixel interi di un'immagine non compressa o Flate (anche con previsione PNG), `null` se non si sa leggere. */
function decodePixels(stream: PDFRawStream, width: number, height: number, comps: number, bpc: number): Uint8Array | null {
  const dict = stream.dict;
  const f = dict.lookup(nm('Filter'));
  const filter = f === undefined ? null : nameOf(f) ?? ((f as PDFArray).size?.() === 1 ? nameOf((f as PDFArray).lookup(0)) : undefined);
  if (filter !== null && filter !== 'FlateDecode') return null;
  let data = stream.getContents();
  if (filter === 'FlateDecode') {
    try {
      data = unzlibSync(data);
    } catch {
      return null;
    }
    const parms = dict.lookup(nm('DecodeParms')) as PDFDict | undefined;
    const predictor = num(parms?.lookup?.(nm('Predictor'))) ?? 1;
    const columns = num(parms?.lookup?.(nm('Columns'))) ?? width;
    if (predictor !== 1) {
      if (bpc !== 8) return null;
      const u = unpredict(data, columns, comps, 8, predictor);
      if (!u) return null;
      data = u;
    }
  }
  // porta a 8 bit per componente (1, 2 e 4 bit si scompongono riga per riga)
  if (bpc === 8) return data.length >= width * height * comps ? data : null;
  if (bpc !== 1 && bpc !== 2 && bpc !== 4) return null;
  const rowBytes = Math.ceil((width * comps * bpc) / 8);
  if (data.length < rowBytes * height) return null;
  const out = new Uint8Array(width * height * comps);
  const mask = (1 << bpc) - 1;
  for (let y = 0; y < height; y++) {
    for (let i = 0; i < width * comps; i++) {
      const bit = i * bpc;
      out[y * width * comps + i] = (data[y * rowBytes + (bit >> 3)] >> (8 - bpc - (bit & 7))) & mask;
    }
  }
  return out;
}

function stringBytes(o: PDFObject | undefined): Uint8Array | null {
  if (o instanceof PDFString || o instanceof PDFHexString) return o.asBytes();
  if (o instanceof PDFRawStream) return o.getContents();
  return null;
}

interface Space {
  comps: 1 | 3 | 4;
  /** Palette RGB espansa (Indexed). */
  palette?: Uint8Array;
}

function colorSpace(cs: PDFObject | undefined, depth = 0): Space | null {
  const n = nameOf(cs);
  if (n === 'DeviceGray' || n === 'CalGray' || n === 'G') return { comps: 1 };
  if (n === 'DeviceRGB' || n === 'CalRGB' || n === 'RGB') return { comps: 3 };
  if (n === 'DeviceCMYK' || n === 'CMYK') return { comps: 4 };
  const arr = cs as PDFArray | undefined;
  if (!arr || typeof arr.size !== 'function' || depth > 2) return null;
  const kind = nameOf(arr.lookup(0));
  if (kind === 'ICCBased') {
    const prof = arr.lookup(1) as PDFRawStream | undefined;
    const c = num(prof?.dict?.lookup(nm('N')));
    return c === 1 || c === 3 || c === 4 ? { comps: c } : null;
  }
  if (kind === 'Indexed' || kind === 'I') {
    const base = colorSpace(arr.lookup(1), depth + 1);
    const hival = num(arr.lookup(2));
    const table = stringBytes(arr.lookup(3));
    if (!base || hival === undefined || !table || base.comps === 4) return null;
    const pal = new Uint8Array((hival + 1) * 3);
    for (let i = 0; i <= hival; i++) {
      if (base.comps === 1) pal[i * 3] = pal[i * 3 + 1] = pal[i * 3 + 2] = table[i] ?? 0;
      else for (let k = 0; k < 3; k++) pal[i * 3 + k] = table[i * 3 + k] ?? 0;
    }
    return { comps: 3, palette: pal };
  }
  return null;
}

function alphaOf(sm: PDFObject | undefined, width: number, height: number): Uint8Array | null {
  if (!(sm instanceof PDFRawStream)) return null;
  const w = num(sm.dict.lookup(nm('Width')));
  const h = num(sm.dict.lookup(nm('Height')));
  const bpc = num(sm.dict.lookup(nm('BitsPerComponent'))) ?? 8;
  if (w !== width || h !== height) return null;
  const px = decodePixels(sm, w, h, 1, bpc);
  if (!px) return null;
  if (bpc === 8) return px.subarray(0, w * h);
  const max = (1 << bpc) - 1;
  return px.map((v) => Math.round((v * 255) / max));
}

/** Pagine (da 1) che usano direttamente ciascuna immagine (risorse XObject di primo livello). */
function pageOfImages(doc: Awaited<ReturnType<typeof openForEdit>>): Map<string, number> {
  const map = new Map<string, number>();
  doc.getPages().forEach((page, i) => {
    const res = page.node.Resources();
    const xo = res?.lookup(nm('XObject')) as PDFDict | undefined;
    if (!xo || typeof xo.entries !== 'function') return;
    for (const [, v] of xo.entries()) if (v instanceof PDFRef && !map.has(v.toString())) map.set(v.toString(), i + 1);
  });
  return map;
}

export const MAX_IMAGES = 1000;
const MIN_SIDE = 16;

export async function extractImages(bytes: Uint8Array): Promise<Extraction> {
  const doc = await openForEdit(bytes);
  const pages = pageOfImages(doc);
  const out: Extraction = { images: [], skipped: {}, tiny: 0 };
  // i canali di trasparenza (SMask) sono immagini a parte, ma fanno parte di un'altra: non vanno elencati
  const softMasks = new Set<string>();
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const sm = obj instanceof PDFRawStream ? obj.dict.get(nm('SMask')) : undefined;
    if (sm instanceof PDFRef) softMasks.add(sm.toString());
  }
  const skip = (k: SkipReason): void => void (out.skipped[k] = (out.skipped[k] ?? 0) + 1);
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) || !(ref instanceof PDFRef)) continue;
    const d = obj.dict;
    if (nameOf(d.lookup(nm('Subtype'))) !== 'Image' || softMasks.has(ref.toString())) continue;
    const width = num(d.lookup(nm('Width'))) ?? 0;
    const height = num(d.lookup(nm('Height'))) ?? 0;
    if (!width || !height) continue;
    if (d.lookup(nm('ImageMask')) !== undefined) {
      skip('mask');
      continue;
    }
    if (width < MIN_SIDE || height < MIN_SIDE) {
      out.tiny++;
      continue;
    }
    if (out.images.length >= MAX_IMAGES) break;
    const f = d.lookup(nm('Filter'));
    const filter = f === undefined ? null : nameOf(f) ?? ((f as PDFArray).size?.() === 1 ? nameOf((f as PDFArray).lookup(0)) : undefined);
    const space = colorSpace(d.lookup(nm('ColorSpace')));
    const base = { id: out.images.length + 1, page: pages.get(ref.toString()) ?? 0, width, height };
    if (filter === 'DCTDecode') {
      out.images.push({ ...base, format: 'jpg', bytes: obj.getContents(), cmyk: space?.comps === 4, alpha: false });
    } else if (filter === 'JPXDecode') {
      out.images.push({ ...base, format: 'jp2', bytes: obj.getContents(), cmyk: false, alpha: false });
    } else if ((filter === null || filter === 'FlateDecode') && space) {
      const bpc = num(d.lookup(nm('BitsPerComponent'))) ?? 8;
      const comps = space.palette ? 1 : space.comps;
      const px = space.comps === 4 ? null : decodePixels(obj, width, height, comps, bpc);
      if (!px) {
        skip('format');
        continue;
      }
      let rgb = px;
      if (space.palette) {
        rgb = new Uint8Array(width * height * 3);
        for (let i = 0; i < width * height; i++) {
          const idx = Math.min(px[i], space.palette.length / 3 - 1);
          rgb.set(space.palette.subarray(idx * 3, idx * 3 + 3), i * 3);
        }
      } else if (bpc !== 8) {
        const max = (1 << bpc) - 1;
        rgb = px.map((v) => Math.round((v * 255) / max));
      }
      const alpha = alphaOf(d.lookup(nm('SMask')), width, height);
      const ch = space.comps === 1 && !space.palette ? 1 : 3;
      let png: Uint8Array;
      if (alpha) {
        const n = width * height;
        const merged = new Uint8Array(n * (ch + 1));
        for (let i = 0; i < n; i++) {
          for (let k = 0; k < ch; k++) merged[i * (ch + 1) + k] = rgb[i * ch + k];
          merged[i * (ch + 1) + ch] = alpha[i];
        }
        png = encodePng(width, height, (ch + 1) as 2 | 4, merged);
      } else png = encodePng(width, height, ch as 1 | 3, rgb);
      out.images.push({ ...base, format: 'png', bytes: png, cmyk: false, alpha: !!alpha });
    } else {
      skip(filter && filter !== 'DCTDecode' ? 'filter' : 'format');
    }
  }
  return out;
}
