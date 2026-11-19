// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { zlibSync } from 'fflate';
import { crc32 } from './exif-clean';

/**
 * Costruttori di file immagine con metadati INVENTATI, usati solo nei test. I file sono strutturalmente
 * validi (segmenti, chunk e CRC corretti) ma non servono a essere mostrati: i dati d'immagine sono finti
 * per JPEG e WebP, reali (zlib) per PNG.
 */

export type Val =
  | { t: 2; v: string }
  | { t: 3; v: number[] }
  | { t: 4; v: number[] }
  | { t: 5; v: [number, number][] }
  | { t: 7; v: Uint8Array };

export interface Entry {
  tag: number;
  val: Val;
}

const TYPE_SIZE: Record<number, number> = { 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 };

function encodeValue(val: Val): { count: number; bytes: number[] } {
  switch (val.t) {
    case 2: {
      const b = Array.from(new TextEncoder().encode(val.v)).concat(0);
      return { count: b.length, bytes: b };
    }
    case 3:
      return { count: val.v.length, bytes: val.v.flatMap((n) => [n & 255, n >> 8]) };
    case 4:
      return { count: val.v.length, bytes: val.v.flatMap((n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]) };
    case 5:
      return {
        count: val.v.length,
        bytes: val.v.flatMap(([n, d]) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255, d & 255, (d >> 8) & 255, (d >> 16) & 255, (d >>> 24) & 255]),
      };
    case 7:
      return { count: val.v.length, bytes: Array.from(val.v) };
  }
}

export interface TiffSpec {
  ifd0?: Entry[];
  exif?: Entry[];
  gps?: Entry[];
  /** JPEG di miniatura (IFD1). */
  thumbnail?: Uint8Array;
}

const ifdSize = (n: number) => 2 + n * 12 + 4;

/** Blocco TIFF little endian. I puntatori ai sotto-IFD sono aggiunti da qui. */
export function buildTiff(spec: TiffSpec): Uint8Array {
  const ifd0 = [...(spec.ifd0 ?? [])];
  const exif = spec.exif ?? [];
  const gps = spec.gps ?? [];
  if (exif.length) ifd0.push({ tag: 0x8769, val: { t: 4, v: [0] } });
  if (gps.length) ifd0.push({ tag: 0x8825, val: { t: 4, v: [0] } });
  ifd0.sort((a, b) => a.tag - b.tag);
  const ifd1: Entry[] = spec.thumbnail
    ? [
        { tag: 0x0201, val: { t: 4, v: [0] } },
        { tag: 0x0202, val: { t: 4, v: [spec.thumbnail.length] } },
      ]
    : [];
  const offIfd0 = 8;
  const offExif = offIfd0 + ifdSize(ifd0.length);
  const offGps = offExif + (exif.length ? ifdSize(exif.length) : 0);
  const offIfd1 = offGps + (gps.length ? ifdSize(gps.length) : 0);
  const dataStart = offIfd1 + (ifd1.length ? ifdSize(ifd1.length) : 0);
  const data: number[] = [];
  const out: number[] = [0x49, 0x49, 42, 0, offIfd0, 0, 0, 0];
  const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];

  const writeIfd = (entries: Entry[], next: number) => {
    out.push(entries.length & 255, entries.length >> 8);
    for (const e of entries) {
      let { count, bytes } = encodeValue(e.val);
      // puntatori e miniatura: valori reali
      if (e.tag === 0x8769) bytes = u32(offExif);
      if (e.tag === 0x8825) bytes = u32(offGps);
      if (e.tag === 0x0201) bytes = u32(dataStart + data.length + 0); // sistemato sotto
      out.push(e.tag & 255, e.tag >> 8, e.val.t, 0, ...u32(count));
      if (bytes.length <= 4) out.push(...bytes, ...Array(4 - bytes.length).fill(0));
      else {
        out.push(...u32(dataStart + data.length));
        data.push(...bytes);
        if (bytes.length & 1) data.push(0);
      }
    }
    out.push(...u32(next));
  };

  writeIfd(ifd0, ifd1.length ? offIfd1 : 0);
  if (exif.length) writeIfd(exif, 0);
  if (gps.length) writeIfd(gps, 0);
  if (ifd1.length) {
    // la miniatura va in coda ai dati: si scrive la sua posizione nella tag 0x0201
    const thumbOffset = dataStart + data.length;
    const saved = out.length;
    writeIfd(ifd1, 0);
    // tag 0x0201 è la prima voce: valore a saved + 2 + 8
    const pos = saved + 2 + 8;
    out.splice(pos, 4, ...u32(thumbOffset));
    data.push(...spec.thumbnail!);
  }
  void TYPE_SIZE;
  return Uint8Array.from([...out, ...data]);
}

// ---- voci di esempio ----

/** Foto inventata: telefono "Prova Phone 1", GPS a Roma, serial e proprietario. */
export function sampleEntries(orientation = 1): TiffSpec {
  return {
    ifd0: [
      { tag: 0x010f, val: { t: 2, v: 'Marca Fittizia' } },
      { tag: 0x0110, val: { t: 2, v: 'Prova Phone 1' } },
      { tag: 0x0112, val: { t: 3, v: [orientation] } },
      { tag: 0x0131, val: { t: 2, v: 'Software di prova 9.1' } },
      { tag: 0x0132, val: { t: 2, v: '2026:03:15 10:22:01' } },
      { tag: 0x013b, val: { t: 2, v: 'Autore Inventato' } },
      { tag: 0x8298, val: { t: 2, v: '(c) Autore Inventato' } },
    ],
    exif: [
      { tag: 0x829a, val: { t: 5, v: [[1, 250]] } },
      { tag: 0x829d, val: { t: 5, v: [[18, 10]] } },
      { tag: 0x8827, val: { t: 3, v: [100] } },
      { tag: 0x9003, val: { t: 2, v: '2026:03:15 10:22:01' } },
      { tag: 0x920a, val: { t: 5, v: [[51, 10]] } },
      { tag: 0xa430, val: { t: 2, v: 'Proprietario Inventato' } },
      { tag: 0xa431, val: { t: 2, v: 'SN-000123' } },
      { tag: 0xa434, val: { t: 2, v: 'Obiettivo di prova 5.1mm' } },
    ],
    gps: [
      { tag: 0x0001, val: { t: 2, v: 'N' } },
      { tag: 0x0002, val: { t: 5, v: [[41, 1], [53, 1], [2160, 100]] } },
      { tag: 0x0003, val: { t: 2, v: 'E' } },
      { tag: 0x0004, val: { t: 5, v: [[12, 1], [29, 1], [3240, 100]] } },
      { tag: 0x0006, val: { t: 5, v: [[210, 10]] } },
      { tag: 0x001f, val: { t: 5, v: [[35, 10]] } },
    ],
    thumbnail: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
  };
}

export const XMP_SAMPLE = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmp:CreatorTool="Editor di prova">
<dc:creator><rdf:Seq><rdf:li>Autore Inventato</rdf:li></rdf:Seq></dc:creator>
<dc:subject><rdf:Bag><rdf:li>prova</rdf:li><rdf:li>esempio</rdf:li></rdf:Bag></dc:subject>
</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

/** Blocco IPTC-NAA dentro una risorsa Photoshop 8BIM 0x0404. */
export function iptcBlock(): Uint8Array {
  const ds = (n: number, text: string) => {
    const v = new TextEncoder().encode(text);
    return [0x1c, 2, n, v.length >> 8, v.length & 255, ...v];
  };
  const iptc = [...ds(5, 'Titolo di prova'), ...ds(25, 'parola1'), ...ds(25, 'parola2'), ...ds(80, 'Autore Inventato'), ...ds(90, 'Roma')];
  const padded = iptc.length & 1 ? [...iptc, 0] : iptc;
  const ps = new TextEncoder().encode('Photoshop 3.0\0');
  const n = iptc.length;
  const res = [0x38, 0x42, 0x49, 0x4d, 0x04, 0x04, 0, 0, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255, ...padded];
  return Uint8Array.from([...ps, ...res]);
}

// ---- JPEG ----

const seg = (marker: number, data: number[] | Uint8Array) => {
  const len = data.length + 2;
  return [0xff, marker, len >> 8, len & 255, ...data];
};

export interface JpegSpec extends TiffSpec {
  tiff?: boolean;
  xmp?: boolean;
  iptc?: boolean;
  comment?: string;
}

/** Dati finti della scansione: devono restare identici dopo la pulizia. */
export const JPEG_SCAN = [0x12, 0x34, 0xff, 0x00, 0x56, 0x78, 0x9a];

export function buildJpeg(spec: JpegSpec & { orientation?: number } = {}): Uint8Array {
  const enc = new TextEncoder();
  const parts: number[] = [0xff, 0xd8];
  parts.push(...seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0])); // JFIF
  if (spec.tiff !== false) parts.push(...seg(0xe1, [...enc.encode('Exif\0\0'), ...buildTiff(spec.ifd0 || spec.exif || spec.gps ? spec : sampleEntries(spec.orientation ?? 1))]));
  if (spec.xmp) parts.push(...seg(0xe1, [...enc.encode('http://ns.adobe.com/xap/1.0/\0'), ...enc.encode(XMP_SAMPLE)]));
  parts.push(...seg(0xe2, [...enc.encode('ICC_PROFILE\0'), 1, 1, 9, 9, 9])); // profilo colore: deve restare
  if (spec.iptc) parts.push(...seg(0xed, iptcBlock()));
  if (spec.comment) parts.push(...seg(0xfe, enc.encode(spec.comment)));
  parts.push(...seg(0xdb, Array(65).fill(7))); // tabella di quantizzazione finta
  parts.push(...seg(0xc0, [8, 0, 2, 0, 2, 1, 1, 0x11, 0]));
  parts.push(...seg(0xda, [1, 1, 0, 0, 63, 0]), ...JPEG_SCAN, 0xff, 0xd9);
  return Uint8Array.from(parts);
}

// ---- PNG ----

export const PNG_PIXELS = [255, 0, 0, 0, 255, 0, 0, 0, 255, 250, 250, 20]; // 2x2 RGB

function pngChunk(type: string, data: Uint8Array): number[] {
  const body = Uint8Array.from([...enc(type), ...data]);
  const c = crc32(body);
  const len = data.length;
  return [(len >>> 24) & 255, (len >> 16) & 255, (len >> 8) & 255, len & 255, ...body, (c >>> 24) & 255, (c >> 16) & 255, (c >> 8) & 255, c & 255];
}

const enc = (s: string) => new TextEncoder().encode(s);

export function buildPng(spec: { exif?: TiffSpec; xmp?: boolean; text?: boolean; time?: boolean } = {}): Uint8Array {
  const out: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  out.push(...pngChunk('IHDR', Uint8Array.from([0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0])));
  if (spec.text) {
    out.push(...pngChunk('tEXt', enc('Author\0Autore Inventato')));
    out.push(...pngChunk('tEXt', enc('Software\0Software di prova')));
  }
  if (spec.time) out.push(...pngChunk('tIME', Uint8Array.from([0x07, 0xea, 3, 15, 10, 22, 1])));
  if (spec.xmp) out.push(...pngChunk('iTXt', Uint8Array.from([...enc('XML:com.adobe.xmp'), 0, 0, 0, 0, 0, ...enc(XMP_SAMPLE)])));
  if (spec.exif) out.push(...pngChunk('eXIf', buildTiff(spec.exif)));
  const raw = Uint8Array.from([0, ...PNG_PIXELS.slice(0, 6), 0, ...PNG_PIXELS.slice(6)]);
  out.push(...pngChunk('IDAT', zlibSync(raw)));
  out.push(...pngChunk('IEND', new Uint8Array(0)));
  return Uint8Array.from(out);
}

// ---- WebP ----

export const WEBP_IMAGE = [0x2f, 0x00, 0x00, 0x00, 0x00, 0x07, 0x11]; // 7 byte (dispari: serve il padding)

function riffChunk(type: string, data: Uint8Array | number[]): number[] {
  const d = Array.from(data);
  const len = d.length;
  return [...enc(type), len & 255, (len >> 8) & 255, (len >> 16) & 255, (len >>> 24) & 255, ...d, ...(len & 1 ? [0] : [])];
}

export function buildWebp(spec: { exif?: TiffSpec; xmp?: boolean } = {}): Uint8Array {
  const flags = (spec.exif ? 0x08 : 0) | (spec.xmp ? 0x04 : 0);
  const body = [
    ...enc('WEBP'),
    ...riffChunk('VP8X', [flags, 0, 0, 0, 1, 0, 0, 1, 0, 0]),
    ...riffChunk('VP8L', WEBP_IMAGE),
    ...(spec.exif ? riffChunk('EXIF', buildTiff(spec.exif)) : []),
    ...(spec.xmp ? riffChunk('XMP ', enc(XMP_SAMPLE)) : []),
  ];
  const len = body.length;
  return Uint8Array.from([...enc('RIFF'), len & 255, (len >> 8) & 255, (len >> 16) & 255, (len >>> 24) & 255, ...body]);
}
