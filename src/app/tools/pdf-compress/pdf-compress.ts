// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { unzlibSync } from 'fflate';
import type { PDFArray, PDFDict, PDFObject } from 'pdf-lib';
import { PDFName, PDFNumber, PDFRawStream, PDFRef } from 'pdf-lib';
import { openForEdit } from '../pdf-common/pdf-file';

/**
 * Riduce un PDF ricomprimendo le immagini incorporate (JPEG, e immagini non compresse o Flate in grigio/RGB a 8 bit) e,
 * facoltativamente, riscrivendo il file con gli oggetti compressi. Il testo e la grafica vettoriale non si toccano.
 * La ricodifica vera e propria (decodifica, riduzione, JPEG) dipende dal browser: arriva dall'esterno come `Recoder`.
 */

export interface RecodeInput {
  /** `jpeg`: byte di un file JPEG; `raw`: pixel 8 bit, riga per riga, senza filtri. */
  kind: 'jpeg' | 'raw';
  data: Uint8Array;
  width: number;
  height: number;
  /** Componenti per pixel dei dati `raw` (1 grigio, 3 RGB). */
  components: 1 | 3;
}

export interface RecodeOptions {
  /** 0.1 – 1. */
  quality: number;
  /** Lato lungo massimo in pixel (0 = non ridurre). */
  maxSide: number;
}

export type Recoder = (input: RecodeInput, o: RecodeOptions) => Promise<{ bytes: Uint8Array; width: number; height: number } | null>;

export type SkipReason = 'unsupported' | 'filter' | 'mask' | 'bigger' | 'failed' | 'tiny';

export interface CompressReport {
  images: number;
  recoded: number;
  skipped: Partial<Record<SkipReason, number>>;
  before: number;
  after: number;
}

const name = (s: string): PDFName => PDFName.of(s);
const num = (o: PDFObject | undefined): number | undefined => (o instanceof PDFNumber ? o.asNumber() : undefined);
const nameOf = (o: PDFObject | undefined): string | undefined => (o instanceof PDFName ? o.decodeText() : undefined);

/** Filtro unico dell'immagine (un elenco con un solo elemento vale come il singolo). */
function singleFilter(dict: PDFDict): string | null | undefined {
  const f = dict.lookup(name('Filter'));
  if (f === undefined) return null;
  if (f instanceof PDFName) return f.decodeText();
  const arr = f as PDFArray;
  if (typeof arr.size === 'function' && arr.size() === 1) return nameOf(arr.lookup(0));
  return undefined;
}

function components(dict: PDFDict): 1 | 3 | 4 | null {
  const cs = dict.lookup(name('ColorSpace'));
  const n = nameOf(cs);
  if (n === 'DeviceGray' || n === 'CalGray') return 1;
  if (n === 'DeviceRGB' || n === 'CalRGB') return 3;
  if (n === 'DeviceCMYK') return 4;
  const arr = cs as PDFArray | undefined;
  if (arr && typeof arr.size === 'function' && nameOf(arr.lookup(0)) === 'ICCBased') {
    const profile = arr.lookup(1) as { dict?: PDFDict } | undefined;
    const n2 = num(profile?.dict?.lookup(name('N')));
    if (n2 === 1 || n2 === 3 || n2 === 4) return n2;
  }
  return null;
}

/** Toglie i filtri di previsione PNG (Predictor 10–15) di un flusso Flate già decompresso. */
export function unpredict(data: Uint8Array, columns: number, colors: number, bpc: number, predictor: number): Uint8Array | null {
  if (predictor === 1) return data;
  if (predictor < 10 || bpc !== 8) return null;
  const bpp = colors;
  const stride = columns * colors;
  const rows = Math.floor(data.length / (stride + 1));
  const out = new Uint8Array(rows * stride);
  for (let r = 0; r < rows; r++) {
    const f = data[r * (stride + 1)];
    const src = r * (stride + 1) + 1;
    const dst = r * stride;
    for (let i = 0; i < stride; i++) {
      const x = data[src + i];
      const a = i >= bpp ? out[dst + i - bpp] : 0;
      const b = r > 0 ? out[dst - stride + i] : 0;
      const c = r > 0 && i >= bpp ? out[dst - stride + i - bpp] : 0;
      let v: number;
      switch (f) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: return null;
      }
      out[dst + i] = v & 255;
    }
  }
  return out;
}

function bump(r: CompressReport, k: SkipReason): void {
  r.skipped[k] = (r.skipped[k] ?? 0) + 1;
}

export interface CompressResult {
  bytes: Uint8Array;
  report: CompressReport;
}

/** Ricomprime le immagini del PDF con `recode`; se `recode` è null riscrive solo il file (oggetti compressi). */
export async function compressImages(bytes: Uint8Array, recode: Recoder | null, o: RecodeOptions): Promise<CompressResult> {
  const doc = await openForEdit(bytes);
  const report: CompressReport = { images: 0, recoded: 0, skipped: {}, before: bytes.length, after: 0 };
  if (recode) {
    for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream) || !(ref instanceof PDFRef)) continue;
      const dict = obj.dict;
      if (nameOf(dict.lookup(name('Subtype'))) !== 'Image') continue;
      report.images++;
      const width = num(dict.lookup(name('Width')));
      const height = num(dict.lookup(name('Height')));
      const bpc = num(dict.lookup(name('BitsPerComponent'))) ?? 8;
      const original = obj.getContents();
      if (!width || !height || dict.lookup(name('ImageMask')) !== undefined) {
        bump(report, 'unsupported');
        continue;
      }
      if (dict.has(name('Mask')) || dict.has(name('Decode'))) {
        bump(report, 'mask');
        continue;
      }
      if (width * height < 10_000 || original.length < 8_000) {
        bump(report, 'tiny');
        continue;
      }
      const filter = singleFilter(dict);
      const comps = components(dict);
      let input: RecodeInput | null = null;
      if (filter === 'DCTDecode' && comps !== null) {
        input = { kind: 'jpeg', data: original, width, height, components: comps === 1 ? 1 : 3 };
      } else if ((filter === null || filter === 'FlateDecode') && (comps === 1 || comps === 3) && bpc === 8) {
        let raw: Uint8Array | null = null;
        try {
          raw = filter === 'FlateDecode' ? unzlibSync(original) : original;
        } catch {
          raw = null;
        }
        if (raw && filter === 'FlateDecode') {
          const parms = dict.lookup(name('DecodeParms')) as PDFDict | undefined;
          const predictor = num(parms?.lookup?.(name('Predictor'))) ?? 1;
          const columns = num(parms?.lookup?.(name('Columns'))) ?? width;
          raw = unpredict(raw, columns, comps, bpc, predictor);
        }
        if (raw && raw.length >= width * height * comps) input = { kind: 'raw', data: raw, width, height, components: comps };
      }
      if (!input) {
        bump(report, filter === null || filter === 'FlateDecode' || filter === 'DCTDecode' ? 'unsupported' : 'filter');
        continue;
      }
      let out: { bytes: Uint8Array; width: number; height: number } | null = null;
      try {
        out = await recode(input, o);
      } catch {
        out = null;
      }
      if (!out) {
        bump(report, 'failed');
        continue;
      }
      if (out.bytes.length >= original.length) {
        bump(report, 'bigger');
        continue;
      }
      const d = doc.context.obj({
        Type: 'XObject',
        Subtype: 'Image',
        Width: out.width,
        Height: out.height,
        ColorSpace: 'DeviceRGB',
        BitsPerComponent: 8,
        Filter: 'DCTDecode',
        Length: out.bytes.length,
      });
      const sm = dict.get(name('SMask'));
      if (sm) d.set(name('SMask'), sm);
      doc.context.assign(ref, PDFRawStream.of(d, out.bytes));
      report.recoded++;
    }
  }
  const saved = await doc.save({ useObjectStreams: true });
  report.after = saved.length;
  return { bytes: saved, report };
}
