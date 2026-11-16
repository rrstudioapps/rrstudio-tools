// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { UnsupportedImageError, detectFormat, jpegSegments, pngChunks, webpChunks } from './exif-parser';

/**
 * Rimozione dei metadati SENZA ricompressione: si ricopiano i byte dell'immagine così come sono e si
 * scartano solo i blocchi di metadati, quindi i pixel restano identici.
 */
export interface CleanOptions {
  /**
   * Se l'immagine ha un orientamento EXIF diverso da 1, mantiene un blocco EXIF minimo con il solo
   * Orientation (altrimenti la foto si vedrebbe ruotata male). Con false l'orientamento si perde.
   */
  keepOrientation: boolean;
  /** Orientamento EXIF dell'immagine (1-8). */
  orientation: number;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Blocco TIFF (big endian) con la sola tag Orientation. */
export function minimalTiff(orientation: number): Uint8Array {
  return Uint8Array.from([
    0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, // intestazione, IFD0 a offset 8
    0, 1, // una voce
    0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, // Orientation, SHORT, 1 valore
    0, 0, 0, 0, // nessun IFD successivo
  ]);
}

// ---- JPEG ----

/** Segmenti scartati: APP1 (EXIF/XMP), APP13 (IPTC) e commenti. APP0, ICC (APP2) e il resto restano. */
const JPEG_DROP = new Set([0xe1, 0xed, 0xfe]);

function cleanJpeg(b: Uint8Array, o: CleanOptions): Uint8Array {
  const { segments, scanStart } = jpegSegments(b);
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  const kept = segments.filter((s) => !JPEG_DROP.has(s.marker));
  let inserted = !(o.keepOrientation && o.orientation !== 1);
  const exif = (): Uint8Array => {
    const tiff = minimalTiff(o.orientation);
    const len = 2 + 6 + tiff.length;
    return concat([Uint8Array.from([0xff, 0xe1, len >> 8, len & 255, 0x45, 0x78, 0x69, 0x66, 0, 0]), tiff]);
  };
  kept.forEach((s, i) => {
    parts.push(b.subarray(s.start, s.end));
    // il blocco EXIF minimo va dopo l'eventuale APP0 (JFIF) iniziale
    if (!inserted && i === 0 && s.marker === 0xe0) {
      parts.push(exif());
      inserted = true;
    }
  });
  if (!inserted) parts.splice(1, 0, exif());
  parts.push(b.subarray(scanStart));
  return concat(parts);
}

// ---- PNG ----

const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function cleanPng(b: Uint8Array, o: CleanOptions): Uint8Array {
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  const chunks = pngChunks(b);
  let wrote = !(o.keepOrientation && o.orientation !== 1);
  for (const c of chunks) {
    if (PNG_DROP.has(c.type)) continue;
    // eXIf va prima dei dati dell'immagine (IDAT)
    if (!wrote && c.type === 'IDAT') {
      parts.push(pngChunk('eXIf', minimalTiff(o.orientation)));
      wrote = true;
    }
    parts.push(b.subarray(c.start, c.end));
  }
  return concat(parts);
}

// ---- WebP ----

const FLAG_EXIF = 0x08;
const FLAG_XMP = 0x04;

function cleanWebp(b: Uint8Array, o: CleanOptions): Uint8Array {
  const chunks = webpChunks(b);
  const keepExif = o.keepOrientation && o.orientation !== 1;
  const parts: Uint8Array[] = [b.slice(0, 12)];
  let hasVp8x = false;
  for (const c of chunks) {
    if (c.type === 'EXIF' || c.type === 'XMP ') continue;
    const chunk = b.slice(c.start, c.end);
    if (c.type === 'VP8X') {
      hasVp8x = true;
      // flag: tolti EXIF e XMP, rimesso EXIF solo se se ne scrive uno nuovo
      chunk[8] = (chunk[8] & ~(FLAG_EXIF | FLAG_XMP)) | (keepExif ? FLAG_EXIF : 0);
    }
    parts.push(chunk);
  }
  if (keepExif && hasVp8x) {
    const tiff = minimalTiff(o.orientation);
    const head = Uint8Array.from([0x45, 0x58, 0x49, 0x46, tiff.length & 255, 0, 0, 0]);
    parts.push(head, tiff);
  }
  const out = concat(parts);
  new DataView(out.buffer).setUint32(4, out.length - 8, true);
  return out;
}

/** Copia dell'immagine senza metadati. Lancia UnsupportedImageError se il formato non è gestito. */
export function cleanImage(b: Uint8Array, o: CleanOptions): Uint8Array {
  switch (detectFormat(b)) {
    case 'jpeg':
      return cleanJpeg(b, o);
    case 'png':
      return cleanPng(b, o);
    case 'webp':
      return cleanWebp(b, o);
    case 'heic':
      throw new UnsupportedImageError('heic');
    default:
      throw new UnsupportedImageError('unknown');
  }
}
