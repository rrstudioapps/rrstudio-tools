// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Lettura dei metadati di una foto: EXIF/TIFF (JPEG APP1, PNG eXIf, WebP EXIF), XMP e IPTC.
 * Il parser è scritto per questo progetto, non esegue mai codice e controlla ogni lettura sui limiti.
 */

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'unknown';
export type IfdName = 'ifd0' | 'exif' | 'gps' | 'interop' | 'ifd1';
export type TagValue = string | number | number[];

export interface ExifTag {
  ifd: IfdName;
  tag: number;
  type: number;
  count: number;
  /** Stringa (ASCII), numero o elenco di numeri (razionali già divisi). */
  value: TagValue;
  /** Byte grezzi (solo per UNDEFINED/BYTE brevi: serve a UserComment, XP*, versioni). */
  bytes?: Uint8Array;
}

export interface IptcEntry {
  record: number;
  dataset: number;
  name: string;
  value: string;
}

export interface XmpProp {
  name: string;
  value: string;
}

export interface TextChunk {
  /** Tipo del chunk PNG (tEXt, zTXt, iTXt). */
  type: string;
  keyword: string;
  value: string;
}

export interface PhotoMeta {
  format: ImageFormat;
  tags: ExifTag[];
  /** Miniatura JPEG incorporata (IFD1), se presente. */
  thumbnail: Uint8Array | null;
  xmp: XmpProp[];
  /** Pacchetto XMP presente anche se non si è riusciti a leggerlo. */
  hasXmp: boolean;
  iptc: IptcEntry[];
  textChunks: TextChunk[];
  /** Chunk PNG tIME presente. */
  hasTime: boolean;
  /** Orientamento EXIF (1-8), 1 se assente. */
  orientation: number;
  /** Commenti JPEG (segmenti COM). */
  comments: string[];
}

export class UnsupportedImageError extends Error {
  constructor(readonly kind: 'heic' | 'unknown') {
    super(kind);
  }
}

const ascii = (b: Uint8Array, start: number, end: number) => {
  let s = '';
  for (let i = start; i < end && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
};

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** Riconosce il formato dai primi byte. */
export function detectFormat(b: Uint8Array): ImageFormat {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length > 8 && startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (b.length > 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp';
  if (b.length > 12 && ascii(b, 4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis|avif)/.test(ascii(b, 8, 12))) return 'heic';
  return 'unknown';
}

// ---------------------------------------------------------------------------------------------
// Contenitori
// ---------------------------------------------------------------------------------------------

export interface JpegSegment {
  marker: number;
  /** Posizione del byte 0xFF iniziale e fine (esclusa) del segmento, lunghezza inclusa. */
  start: number;
  end: number;
}

/** Segmenti JPEG fino all'inizio dei dati dell'immagine (SOS, escluso: da lì in poi si copia tutto). */
export function jpegSegments(b: Uint8Array): { segments: JpegSegment[]; scanStart: number } {
  const segments: JpegSegment[] = [];
  let pos = 2;
  while (pos + 4 <= b.length) {
    if (b[pos] !== 0xff) break;
    let marker = b[pos + 1];
    let start = pos;
    while (marker === 0xff && pos + 2 < b.length) {
      // byte di riempimento 0xFF prima del marcatore
      pos++;
      marker = b[pos + 1];
      start = pos;
    }
    if (marker === 0xda) return { segments, scanStart: start };
    if (marker === 0xd9) return { segments, scanStart: start };
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      segments.push({ marker, start, end: start + 2 });
      pos = start + 2;
      continue;
    }
    const len = (b[start + 2] << 8) | b[start + 3];
    const end = start + 2 + len;
    if (len < 2 || end > b.length) break;
    segments.push({ marker, start, end });
    pos = end;
  }
  return { segments, scanStart: b.length };
}

const EXIF_ID = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"
const XMP_ID = 'http://ns.adobe.com/xap/1.0/\0';
const PS_ID = 'Photoshop 3.0\0';

export const isExifSegment = (b: Uint8Array, s: JpegSegment) => s.marker === 0xe1 && startsWith(b, EXIF_ID, s.start + 4);
export const isXmpSegment = (b: Uint8Array, s: JpegSegment) => s.marker === 0xe1 && ascii(b, s.start + 4, s.start + 4 + XMP_ID.length) === XMP_ID;

interface Containers {
  tiff: Uint8Array | null;
  xmp: Uint8Array | null;
  iptc: Uint8Array | null;
  textChunks: TextChunk[];
  hasTime: boolean;
  comments: string[];
}

function fromJpeg(b: Uint8Array): Containers {
  const out: Containers = { tiff: null, xmp: null, iptc: null, textChunks: [], hasTime: false, comments: [] };
  const { segments } = jpegSegments(b);
  for (const s of segments) {
    if (isExifSegment(b, s) && !out.tiff) out.tiff = b.subarray(s.start + 10, s.end);
    else if (isXmpSegment(b, s) && !out.xmp) out.xmp = b.subarray(s.start + 4 + XMP_ID.length, s.end);
    else if (s.marker === 0xed && ascii(b, s.start + 4, s.start + 4 + PS_ID.length) === PS_ID && !out.iptc) {
      out.iptc = findIptc(b.subarray(s.start + 4 + PS_ID.length, s.end));
    } else if (s.marker === 0xfe) {
      const text = new TextDecoder('utf-8').decode(b.subarray(s.start + 4, s.end)).replace(/\0+$/, '').trim();
      if (text) out.comments.push(text);
    }
  }
  return out;
}

export interface PngChunk {
  type: string;
  start: number;
  end: number;
  dataStart: number;
  dataEnd: number;
}

export function pngChunks(b: Uint8Array): PngChunk[] {
  const list: PngChunk[] = [];
  let pos = 8;
  while (pos + 12 <= b.length) {
    const len = ((b[pos] << 24) | (b[pos + 1] << 16) | (b[pos + 2] << 8) | b[pos + 3]) >>> 0;
    const end = pos + 12 + len;
    if (end > b.length) break;
    list.push({ type: ascii(b, pos + 4, pos + 8), start: pos, end, dataStart: pos + 8, dataEnd: pos + 8 + len });
    pos = end;
  }
  return list;
}

function readPngText(b: Uint8Array, c: PngChunk): TextChunk | null {
  const data = b.subarray(c.dataStart, c.dataEnd);
  const nul = data.indexOf(0);
  if (nul < 1) return null;
  const keyword = ascii(data, 0, nul);
  if (c.type === 'tEXt') return { type: c.type, keyword, value: ascii(data, nul + 1, data.length) };
  if (c.type === 'zTXt') return { type: c.type, keyword, value: '' };
  if (c.type === 'iTXt') {
    // keyword\0 compressione(1) metodo(1) lingua\0 chiave tradotta\0 testo
    const compressed = data[nul + 1] === 1;
    let p = nul + 3;
    for (let n = 0; n < 2; n++) {
      const z = data.indexOf(0, p);
      if (z < 0) return null;
      p = z + 1;
    }
    return { type: c.type, keyword, value: compressed ? '' : new TextDecoder('utf-8').decode(data.subarray(p)) };
  }
  return null;
}

function fromPng(b: Uint8Array): Containers {
  const out: Containers = { tiff: null, xmp: null, iptc: null, textChunks: [], hasTime: false, comments: [] };
  for (const c of pngChunks(b)) {
    if (c.type === 'eXIf') out.tiff ??= b.subarray(c.dataStart, c.dataEnd);
    else if (c.type === 'tIME') out.hasTime = true;
    else if (c.type === 'tEXt' || c.type === 'zTXt' || c.type === 'iTXt') {
      const t = readPngText(b, c);
      if (!t) continue;
      if (c.type === 'iTXt' && t.keyword === 'XML:com.adobe.xmp') out.xmp ??= new TextEncoder().encode(t.value);
      else out.textChunks.push(t);
    }
  }
  return out;
}

export interface WebpChunk {
  type: string;
  start: number;
  end: number;
  dataStart: number;
  dataEnd: number;
}

export function webpChunks(b: Uint8Array): WebpChunk[] {
  const list: WebpChunk[] = [];
  let pos = 12;
  while (pos + 8 <= b.length) {
    const len = (b[pos + 4] | (b[pos + 5] << 8) | (b[pos + 6] << 16) | (b[pos + 7] << 24)) >>> 0;
    const dataEnd = pos + 8 + len;
    if (dataEnd > b.length) break;
    const end = Math.min(b.length, dataEnd + (len & 1));
    list.push({ type: ascii(b, pos, pos + 4), start: pos, end, dataStart: pos + 8, dataEnd });
    pos = end;
  }
  return list;
}

function fromWebp(b: Uint8Array): Containers {
  const out: Containers = { tiff: null, xmp: null, iptc: null, textChunks: [], hasTime: false, comments: [] };
  for (const c of webpChunks(b)) {
    if (c.type === 'EXIF') {
      let d = b.subarray(c.dataStart, c.dataEnd);
      if (startsWith(d, EXIF_ID)) d = d.subarray(6);
      out.tiff ??= d;
    } else if (c.type === 'XMP ') out.xmp ??= b.subarray(c.dataStart, c.dataEnd);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// TIFF / EXIF
// ---------------------------------------------------------------------------------------------

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
const MAX_TAGS = 2000;

export interface TiffResult {
  tags: ExifTag[];
  thumbnail: Uint8Array | null;
}

/** Legge un blocco TIFF (intestazione II/MM, IFD0, sotto-IFD Exif/GPS/Interop e IFD1). */
export function parseTiff(t: Uint8Array): TiffResult {
  const res: TiffResult = { tags: [], thumbnail: null };
  if (t.length < 8) return res;
  const little = t[0] === 0x49 && t[1] === 0x49;
  if (!little && !(t[0] === 0x4d && t[1] === 0x4d)) return res;
  const dv = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const u16 = (o: number) => dv.getUint16(o, little);
  const u32 = (o: number) => dv.getUint32(o, little);
  if (u16(2) !== 42) return res;
  const visited = new Set<number>();

  const readValue = (type: number, count: number, valueOffset: number): { value: TagValue; bytes?: Uint8Array } | null => {
    const size = (TYPE_SIZE[type] ?? 0) * count;
    if (size === 0 || count > 0x100000) return null;
    const off = size <= 4 ? valueOffset : u32(valueOffset);
    if (off + size > t.length) return null;
    switch (type) {
      case 2: {
        let s = '';
        for (let i = 0; i < count; i++) {
          const c = t[off + i];
          if (c === 0) break;
          s += String.fromCharCode(c);
        }
        // gli ASCII sono quasi sempre UTF-8 in pratica
        try {
          return { value: new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(s, (ch) => ch.charCodeAt(0))).trim() };
        } catch {
          return { value: s.trim() };
        }
      }
      case 7:
      case 1:
      case 6: {
        const bytes = t.slice(off, off + Math.min(count, 4096));
        const arr = Array.from(bytes.subarray(0, 16)).map((v) => (type === 6 && v > 127 ? v - 256 : v));
        return { value: count === 1 ? arr[0] : arr, bytes };
      }
      default: {
        const vals: number[] = [];
        const n = Math.min(count, 64);
        for (let i = 0; i < n; i++) {
          const o = off + i * TYPE_SIZE[type];
          switch (type) {
            case 3: vals.push(u16(o)); break;
            case 8: vals.push(dv.getInt16(o, little)); break;
            case 4: vals.push(u32(o)); break;
            case 9: vals.push(dv.getInt32(o, little)); break;
            case 5: { const d = u32(o + 4); vals.push(d === 0 ? 0 : u32(o) / d); break; }
            case 10: { const d = dv.getInt32(o + 4, little); vals.push(d === 0 ? 0 : dv.getInt32(o, little) / d); break; }
            case 11: vals.push(dv.getFloat32(o, little)); break;
            case 12: vals.push(dv.getFloat64(o, little)); break;
          }
        }
        return { value: count === 1 ? vals[0] : vals };
      }
    }
  };

  const readIfd = (offset: number, ifd: IfdName): number => {
    if (offset < 8 || offset + 2 > t.length || visited.has(offset)) return 0;
    visited.add(offset);
    const n = u16(offset);
    let jpegOffset = -1;
    let jpegLength = 0;
    for (let i = 0; i < n && res.tags.length < MAX_TAGS; i++) {
      const e = offset + 2 + i * 12;
      if (e + 12 > t.length) break;
      const tag = u16(e);
      const type = u16(e + 2);
      const count = u32(e + 4);
      const v = readValue(type, count, e + 8);
      if (!v) continue;
      if (ifd === 'ifd1') {
        if (tag === 0x0201) jpegOffset = Number(v.value);
        if (tag === 0x0202) jpegLength = Number(v.value);
      }
      res.tags.push({ ifd, tag, type, count, value: v.value, bytes: v.bytes });
      if (ifd === 'ifd0' && tag === 0x8769) readIfd(Number(v.value), 'exif');
      else if (ifd === 'ifd0' && tag === 0x8825) readIfd(Number(v.value), 'gps');
      else if (ifd === 'exif' && tag === 0xa005) readIfd(Number(v.value), 'interop');
    }
    if (ifd === 'ifd1' && jpegOffset > 0 && jpegLength > 0 && jpegOffset + jpegLength <= t.length) {
      res.thumbnail = t.slice(jpegOffset, jpegOffset + jpegLength);
    }
    const nextPos = offset + 2 + n * 12;
    return nextPos + 4 <= t.length ? u32(nextPos) : 0;
  };

  const next = readIfd(u32(4), 'ifd0');
  if (next) readIfd(next, 'ifd1');
  return res;
}

// ---------------------------------------------------------------------------------------------
// IPTC e XMP
// ---------------------------------------------------------------------------------------------

const IPTC_NAMES: Record<number, string> = {
  5: 'ObjectName', 25: 'Keywords', 55: 'DateCreated', 60: 'TimeCreated', 80: 'By-line', 85: 'By-lineTitle', 90: 'City',
  92: 'Sub-location', 95: 'Province-State', 101: 'Country', 105: 'Headline', 110: 'Credit', 115: 'Source',
  116: 'CopyrightNotice', 120: 'Caption-Abstract', 122: 'Writer-Editor',
};

/** Dentro il blocco "Photoshop 3.0": cerca la risorsa 8BIM 0x0404 (IPTC-NAA). */
function findIptc(b: Uint8Array): Uint8Array | null {
  let p = 0;
  while (p + 12 <= b.length && ascii(b, p, p + 4) === '8BIM') {
    const id = (b[p + 4] << 8) | b[p + 5];
    const nameLen = b[p + 6];
    let q = p + 7 + nameLen;
    if ((1 + nameLen) % 2 === 1) q++; // nome Pascal allineato a numero pari di byte
    if (q + 4 > b.length) return null;
    const size = ((b[q] << 24) | (b[q + 1] << 16) | (b[q + 2] << 8) | b[q + 3]) >>> 0;
    q += 4;
    if (q + size > b.length) return null;
    if (id === 0x0404) return b.subarray(q, q + size);
    p = q + size + (size & 1);
  }
  return null;
}

export function parseIptc(b: Uint8Array): IptcEntry[] {
  const out: IptcEntry[] = [];
  let p = 0;
  while (p + 5 <= b.length && b[p] === 0x1c) {
    const record = b[p + 1];
    const dataset = b[p + 2];
    const size = (b[p + 3] << 8) | b[p + 4];
    if (size & 0x8000 || p + 5 + size > b.length) break;
    if (record === 2) {
      const value = new TextDecoder('utf-8').decode(b.subarray(p + 5, p + 5 + size)).trim();
      if (value) out.push({ record, dataset, name: IPTC_NAMES[dataset] ?? `2:${dataset}`, value });
    }
    p += 5 + size;
  }
  return out;
}

const MAX_XMP_PROPS = 120;

/** Proprietà "semplici" di un pacchetto XMP (attributi e valori di testo, elenchi uniti da virgola). */
export function parseXmp(bytes: Uint8Array): XmpProp[] {
  const text = new TextDecoder('utf-8').decode(bytes);
  const start = text.indexOf('<');
  const end = text.lastIndexOf('>');
  if (start < 0 || end <= start) return [];
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(text.slice(start, end + 1), 'application/xml');
  } catch {
    return [];
  }
  if (doc.getElementsByTagName('parsererror').length > 0) return [];
  const props: XmpProp[] = [];
  const push = (name: string, value: string) => {
    const v = value.replace(/\s+/g, ' ').trim();
    if (v && props.length < MAX_XMP_PROPS) props.push({ name, value: v.length > 300 ? v.slice(0, 300) + '…' : v });
  };
  const label = (n: Element | Attr) => (n.prefix ? `${n.prefix}:${n.localName}` : n.localName);
  for (const d of Array.from(doc.getElementsByTagNameNS('*', 'Description'))) {
    for (const a of Array.from(d.attributes)) {
      if (a.prefix === 'xmlns' || a.name === 'xmlns' || a.prefix === 'rdf' || a.localName === 'xmlns') continue;
      push(label(a), a.value);
    }
    for (const c of Array.from(d.children)) {
      const items = Array.from(c.getElementsByTagNameNS('*', 'li'));
      if (items.length > 0) push(label(c), items.map((li) => li.textContent ?? '').join(', '));
      else if (c.children.length === 0) push(label(c), c.textContent ?? '');
    }
  }
  return props;
}

// ---------------------------------------------------------------------------------------------
// Insieme
// ---------------------------------------------------------------------------------------------

/** Legge tutti i metadati. Lancia UnsupportedImageError per HEIC e formati sconosciuti. */
export function readMetadata(b: Uint8Array): PhotoMeta {
  const format = detectFormat(b);
  if (format === 'heic' || format === 'unknown') throw new UnsupportedImageError(format);
  const c = format === 'jpeg' ? fromJpeg(b) : format === 'png' ? fromPng(b) : fromWebp(b);
  let tiff: TiffResult = { tags: [], thumbnail: null };
  try {
    if (c.tiff) tiff = parseTiff(c.tiff);
  } catch {
    /* blocco EXIF danneggiato: si mostra quello che c'è */
  }
  let xmp: XmpProp[] = [];
  try {
    if (c.xmp) xmp = parseXmp(c.xmp);
  } catch {
    /* XMP non leggibile */
  }
  const o = tiff.tags.find((t) => t.ifd === 'ifd0' && t.tag === 0x0112);
  const orientation = typeof o?.value === 'number' && o.value >= 1 && o.value <= 8 ? o.value : 1;
  return {
    format,
    tags: tiff.tags,
    thumbnail: tiff.thumbnail,
    xmp,
    hasXmp: c.xmp !== null,
    iptc: c.iptc ? parseIptc(c.iptc) : [],
    textChunks: c.textChunks,
    hasTime: c.hasTime,
    orientation,
    comments: c.comments,
  };
}

/** Orientamento EXIF (1-8) di un file, 1 se assente o illeggibile. Non lancia mai. */
export function readOrientation(b: Uint8Array): number {
  try {
    return readMetadata(b).orientation;
  } catch {
    return 1;
  }
}

/**
 * Numero di campi di metadati: tag EXIF (miniatura esclusa), proprietà XMP, voci IPTC, testi PNG,
 * commenti JPEG e il chunk tIME. È il numero mostrato "prima" e "dopo" la pulizia.
 */
export function countFields(m: PhotoMeta): number {
  return (
    // i puntatori ai sotto-IFD (Exif, GPS, Interop) non sono campi veri e propri
    m.tags.filter((t) => t.ifd !== 'ifd1' && ![0x8769, 0x8825, 0xa005].includes(t.tag)).length +
    m.xmp.length +
    (m.xmp.length === 0 && m.hasXmp ? 1 : 0) +
    m.iptc.length +
    m.textChunks.length +
    m.comments.length +
    (m.hasTime ? 1 : 0)
  );
}
