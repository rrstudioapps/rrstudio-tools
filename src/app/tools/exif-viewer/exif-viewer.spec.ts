// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { unzlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { cleanImage, crc32, minimalTiff } from './exif-clean';
import {
  JPEG_SCAN,
  PNG_PIXELS,
  WEBP_IMAGE,
  buildJpeg,
  buildPng,
  buildTiff,
  buildWebp,
  sampleEntries,
} from './exif-fixtures';
import { buildGroups, formatAccuracy, formatCoords, formatExifDate, formatExposure, osmUrl, readGps, sensitiveFlags } from './exif-format';
import {
  UnsupportedImageError,
  countFields,
  detectFormat,
  jpegSegments,
  parseTiff,
  pngChunks,
  readMetadata,
  readOrientation,
  webpChunks,
} from './exif-parser';

const t = (k: string, p?: Record<string, string | number>) => (p ? `${k}:${JSON.stringify(p)}` : k);
const KEEP = { keepOrientation: false, orientation: 1 };

describe('parser EXIF/TIFF', () => {
  it('legge IFD0, Exif, GPS e la miniatura', () => {
    const r = parseTiff(buildTiff(sampleEntries()));
    const get = (ifd: string, tag: number) => r.tags.find((x) => x.ifd === ifd && x.tag === tag)?.value;
    expect(get('ifd0', 0x010f)).toBe('Marca Fittizia');
    expect(get('ifd0', 0x0110)).toBe('Prova Phone 1');
    expect(get('exif', 0x829a)).toBeCloseTo(1 / 250);
    expect(get('exif', 0x829d)).toBeCloseTo(1.8);
    expect(get('exif', 0xa431)).toBe('SN-000123');
    expect(get('gps', 0x0002)).toEqual([41, 53, 21.6]);
    expect(r.thumbnail).toEqual(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]));
  });
  it('rifiuta senza errori dati non TIFF o troncati', () => {
    expect(parseTiff(new Uint8Array(0)).tags).toEqual([]);
    expect(parseTiff(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9])).tags).toEqual([]);
    const full = buildTiff(sampleEntries());
    for (const n of [8, 12, 30, 60, 120]) expect(() => parseTiff(full.subarray(0, n))).not.toThrow();
  });
  it('regge un IFD che punta a se stesso', () => {
    const tiff = Uint8Array.from([0x49, 0x49, 42, 0, 8, 0, 0, 0, 0, 0, 8, 0, 0, 0]);
    expect(() => parseTiff(tiff)).not.toThrow();
  });
  it('legge anche il big endian', () => {
    const be = Uint8Array.from([0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0]);
    expect(parseTiff(be).tags[0]).toMatchObject({ tag: 0x0112, value: 6 });
  });
});

describe('lettura dei tre formati', () => {
  it('JPEG: EXIF, XMP, IPTC, commento e orientamento', () => {
    const m = readMetadata(buildJpeg({ xmp: true, iptc: true, comment: 'commento di prova', orientation: 6 }));
    expect(m.format).toBe('jpeg');
    expect(m.orientation).toBe(6);
    expect(m.xmp.map((p) => p.name)).toContain('xmp:CreatorTool');
    expect(m.xmp.find((p) => p.name === 'dc:subject')?.value).toBe('prova, esempio');
    expect(m.iptc.map((e) => e.name)).toEqual(['ObjectName', 'Keywords', 'Keywords', 'By-line', 'City']);
    expect(m.comments).toEqual(['commento di prova']);
    expect(m.thumbnail).not.toBeNull();
  });
  it('PNG: eXIf, iTXt XMP, tEXt e tIME', () => {
    const m = readMetadata(buildPng({ exif: sampleEntries(3), xmp: true, text: true, time: true }));
    expect(m.format).toBe('png');
    expect(m.orientation).toBe(3);
    expect(m.xmp.length).toBeGreaterThan(0);
    expect(m.textChunks.map((c) => c.keyword)).toEqual(['Author', 'Software']);
    expect(m.hasTime).toBe(true);
    expect(m.tags.find((x) => x.tag === 0x0110)?.value).toBe('Prova Phone 1');
  });
  it('WebP: chunk EXIF e XMP', () => {
    const m = readMetadata(buildWebp({ exif: sampleEntries(), xmp: true }));
    expect(m.format).toBe('webp');
    expect(m.tags.find((x) => x.tag === 0xa431)?.value).toBe('SN-000123');
    expect(m.xmp.length).toBeGreaterThan(0);
  });
  it('file senza metadati', () => {
    const m = readMetadata(buildPng());
    expect(countFields(m)).toBe(0);
    expect(m.orientation).toBe(1);
  });
  it('HEIC e file sconosciuti: errore dedicato', () => {
    const heic = Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectFormat(heic)).toBe('heic');
    expect(() => readMetadata(heic)).toThrow(UnsupportedImageError);
    expect(() => readMetadata(new TextEncoder().encode('non una foto'))).toThrow(UnsupportedImageError);
    expect(readOrientation(heic)).toBe(1);
  });
  it('JPEG troncato non manda in errore', () => {
    const full = buildJpeg({ xmp: true, iptc: true });
    for (const n of [4, 10, 50, 120, 300]) expect(() => readMetadata(full.subarray(0, n))).not.toThrow();
  });
});

describe('GPS e informazioni sensibili', () => {
  const m = readMetadata(buildJpeg());
  it('converte le coordinate e ne dà precisione e link', () => {
    const g = readGps(m)!;
    expect(g.lat).toBeCloseTo(41.88933, 4);
    expect(g.lon).toBeCloseTo(12.49233, 4);
    expect(g.altitude).toBeCloseTo(21);
    expect(formatCoords(g)).toBe('41.88933, 12.49233');
    expect(formatAccuracy(g, t, 'it-IT')).toContain('ex.gps.accuracy');
    expect(osmUrl(g)).toMatch(/^https:\/\/www\.openstreetmap\.org\/\?mlat=41\.88\d+&mlon=12\.49\d+#map=16\//);
  });
  it('usa i segni S e W', () => {
    const spec = sampleEntries();
    spec.gps![0] = { tag: 1, val: { t: 2, v: 'S' } };
    spec.gps![2] = { tag: 3, val: { t: 2, v: 'W' } };
    const g = readGps(readMetadata(buildJpeg(spec)))!;
    expect(g.lat).toBeLessThan(0);
    expect(g.lon).toBeLessThan(0);
  });
  it('segnala GPS, numero di serie e proprietario', () => {
    expect(sensitiveFlags(m).sort()).toEqual(['gps', 'owner', 'serial']);
    expect(sensitiveFlags(readMetadata(buildPng()))).toEqual([]);
  });
  it('raggruppa i campi leggibili', () => {
    const groups = buildGroups(m, t, 'it-IT');
    expect(groups.map((g) => g.id)).toEqual(['camera', 'datetime', 'shooting', 'software', 'author']);
    const camera = groups[0].rows;
    expect(camera.find((r) => r.value === 'Prova Phone 1')).toBeTruthy();
    expect(camera.find((r) => r.value === 'SN-000123')?.sensitive).toBe(true);
    expect(groups[2].rows.map((r) => r.value)).toContain('1/250 s');
  });
  it('formatta data ed esposizione', () => {
    expect(formatExifDate('2026:03:15 10:22:01', 'it-IT')).toContain('2026');
    expect(formatExifDate('boh', 'it-IT')).toBe('boh');
    expect(formatExposure(0.5)).toBe('1/2 s');
    expect(formatExposure(2)).toBe('2 s');
  });
});

/** Segmenti JPEG che non sono metadati, in ordine, più la scansione: devono essere identici dopo la pulizia. */
function jpegPixelBytes(b: Uint8Array): number[][] {
  const { segments, scanStart } = jpegSegments(b);
  return [...segments.filter((s) => ![0xe1, 0xed, 0xfe].includes(s.marker)).map((s) => Array.from(b.subarray(s.start, s.end))), Array.from(b.subarray(scanStart))];
}

describe('pulizia JPEG', () => {
  const src = buildJpeg({ xmp: true, iptc: true, comment: 'commento', orientation: 1 });
  it('toglie EXIF, XMP, IPTC e commenti e lascia identico il resto', () => {
    const out = cleanImage(src, KEEP);
    const m = readMetadata(out);
    expect(countFields(m)).toBe(0);
    expect(m.hasXmp).toBe(false);
    expect(out.length).toBeLessThan(src.length);
    expect(jpegPixelBytes(out)).toEqual(jpegPixelBytes(src));
    expect(Array.from(out.subarray(out.length - JPEG_SCAN.length - 2))).toEqual([...JPEG_SCAN, 0xff, 0xd9]);
    // il profilo colore (APP2) e il JFIF restano
    expect(jpegSegments(out).segments.map((s) => s.marker)).toEqual([0xe0, 0xe2, 0xdb, 0xc0]);
    // niente tracce testuali dei metadati
    const text = new TextDecoder('latin1').decode(out);
    for (const needle of ['Prova Phone', 'SN-000123', 'Autore Inventato', 'Exif', 'xpacket', 'commento']) expect(text).not.toContain(needle);
  });
  it('con orientamento diverso da 1 tiene un EXIF minimo col solo Orientation', () => {
    const rotated = buildJpeg({ orientation: 6, xmp: true });
    const out = cleanImage(rotated, { keepOrientation: true, orientation: 6 });
    const m = readMetadata(out);
    expect(m.orientation).toBe(6);
    expect(m.tags).toHaveLength(1);
    expect(countFields(m)).toBe(1);
    expect(m.xmp).toEqual([]);
    expect(jpegPixelBytes(out)).toEqual(jpegPixelBytes(rotated));
    // l'EXIF minimo viene dopo il JFIF
    expect(jpegSegments(out).segments.map((s) => s.marker).slice(0, 2)).toEqual([0xe0, 0xe1]);
  });
  it('con keepOrientation e orientamento 1 non aggiunge nulla', () => {
    expect(readMetadata(cleanImage(src, { keepOrientation: true, orientation: 1 })).tags).toHaveLength(0);
  });
  it('senza APP0 il blocco minimo va subito dopo SOI', () => {
    const noJfif = Uint8Array.from([0xff, 0xd8, ...Array.from(buildJpeg({ tiff: false })).slice(2 + 18)]);
    const out = cleanImage(noJfif, { keepOrientation: true, orientation: 8 });
    expect(readMetadata(out).orientation).toBe(8);
  });
  it('minimalTiff è un TIFF valido', () => {
    expect(parseTiff(minimalTiff(3)).tags[0]).toMatchObject({ tag: 0x112, value: 3 });
  });
});

function pngPixels(b: Uint8Array): number[] {
  const idat = pngChunks(b).filter((c) => c.type === 'IDAT');
  const joined = Uint8Array.from(idat.flatMap((c) => Array.from(b.subarray(c.dataStart, c.dataEnd))));
  return Array.from(unzlibSync(joined));
}

describe('pulizia PNG', () => {
  const src = buildPng({ exif: sampleEntries(1), xmp: true, text: true, time: true });
  it('toglie eXIf, tEXt, zTXt, iTXt e tIME; i pixel decodificati restano uguali', () => {
    const out = cleanImage(src, KEEP);
    expect(pngChunks(out).map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    expect(countFields(readMetadata(out))).toBe(0);
    expect(pngPixels(out)).toEqual(pngPixels(src));
    expect(pngPixels(out).filter((_, i) => i % 7 !== 0)).toEqual(PNG_PIXELS);
    // CRC e struttura intatti
    for (const c of pngChunks(out)) {
      const stored = new DataView(out.buffer, out.byteOffset).getUint32(c.dataEnd);
      expect(crc32(out.subarray(c.start + 4, c.dataEnd))).toBe(stored);
    }
    expect(new TextDecoder('latin1').decode(out)).not.toContain('Autore Inventato');
  });
  it('mantiene l\'orientamento in un eXIf minimo con CRC valido, prima di IDAT', () => {
    const out = cleanImage(buildPng({ exif: sampleEntries(8) }), { keepOrientation: true, orientation: 8 });
    expect(pngChunks(out).map((c) => c.type)).toEqual(['IHDR', 'eXIf', 'IDAT', 'IEND']);
    const m = readMetadata(out);
    expect(m.orientation).toBe(8);
    expect(m.tags).toHaveLength(1);
    const c = pngChunks(out)[1];
    expect(crc32(out.subarray(c.start + 4, c.dataEnd))).toBe(new DataView(out.buffer, out.byteOffset).getUint32(c.dataEnd));
  });
});

describe('pulizia WebP', () => {
  const src = buildWebp({ exif: sampleEntries(1), xmp: true });
  it('toglie EXIF e XMP, aggiorna VP8X e la dimensione RIFF, immagine identica', () => {
    const out = cleanImage(src, KEEP);
    const chunks = webpChunks(out);
    expect(chunks.map((c) => c.type)).toEqual(['VP8X', 'VP8L']);
    expect(out[20] & 0x0c).toBe(0); // flag EXIF e XMP spenti
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8);
    const image = chunks[1];
    expect(Array.from(out.subarray(image.dataStart, image.dataEnd))).toEqual(WEBP_IMAGE);
    expect(countFields(readMetadata(out))).toBe(0);
  });
  it('tiene l\'orientamento con il flag EXIF acceso', () => {
    const out = cleanImage(buildWebp({ exif: sampleEntries(6) }), { keepOrientation: true, orientation: 6 });
    expect(out[20] & 0x08).toBe(0x08);
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8);
    const m = readMetadata(out);
    expect(m.orientation).toBe(6);
    expect(m.tags).toHaveLength(1);
  });
});

describe('pulizia: errori', () => {
  it('rifiuta HEIC e formati sconosciuti', () => {
    expect(() => cleanImage(new TextEncoder().encode('testo'), KEEP)).toThrow(UnsupportedImageError);
  });
});
