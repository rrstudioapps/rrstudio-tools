// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import {
  CompressorSettings,
  ResizeMode,
  clampQuality,
  computeSize,
  extensionForMime,
  formatSaving,
  inputMime,
  savingPercent,
  uniqueNames,
} from '../image-compressor/image-compressor';

// Logica pura del convertitore: scelta del formato, dimensioni, nomi dei file. Il disegno sul canvas e la
// codifica stanno in `image-processor` (condiviso con il compressore), qui non c'è nulla che tocchi il browser.
export { computeSize, formatSaving, inputMime, savingPercent, uniqueNames };
export type { ResizeMode };

export type ConvertFormat = 'png' | 'jpeg' | 'webp' | 'avif';

/** Formati di uscita nell'ordine in cui si mostrano. */
export const CONVERT_FORMATS: readonly ConvertFormat[] = ['png', 'jpeg', 'webp', 'avif'];

export const FORMAT_MIMES: Record<ConvertFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
};

export const FORMAT_LABELS: Record<ConvertFormat, string> = { png: 'PNG', jpeg: 'JPG', webp: 'WebP', avif: 'AVIF' };

export interface ConverterSettings {
  format: ConvertFormat;
  /** 1-100, ignorata per PNG. */
  quality: number;
  resizeMode: ResizeMode;
  /** Pixel per larghezza/altezza massime, percentuale per "percent". */
  resizeValue: number;
  /** Colore #rrggbb che sostituisce la trasparenza nei JPG. */
  background: string;
}

export const MAX_FILES = 50;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_RESIZE_PX = 20000;

export const DEFAULT_SETTINGS: ConverterSettings = {
  format: 'webp',
  quality: 85,
  resizeMode: 'none',
  resizeValue: 1920,
  background: '#ffffff',
};

/** Valore iniziale sensato quando si cambia modalità di ridimensionamento. */
export const DEFAULT_RESIZE_VALUE: Record<ResizeMode, number> = { none: 0, width: 1920, height: 1080, percent: 50 };

export const RESIZE_MODES: readonly ResizeMode[] = ['none', 'width', 'height', 'percent'];

export function isConvertFormat(v: unknown): v is ConvertFormat {
  return typeof v === 'string' && (CONVERT_FORMATS as readonly string[]).includes(v);
}

export function formatMime(format: ConvertFormat): string {
  return FORMAT_MIMES[format];
}

/** Formato corrispondente a un tipo MIME, o null. */
export function formatOfMime(mime: string): ConvertFormat | null {
  return CONVERT_FORMATS.find((f) => FORMAT_MIMES[f] === mime) ?? null;
}

/** Formati che il browser sa codificare davvero, dato l'insieme dei MIME rilevati. */
export function supportedFormats(mimes: ReadonlySet<string>): ConvertFormat[] {
  return CONVERT_FORMATS.filter((f) => mimes.has(FORMAT_MIMES[f]));
}

/** Formato da usare: quello voluto se il browser lo sa produrre, altrimenti PNG (sempre disponibile). */
export function resolveFormat(wanted: ConvertFormat, mimes: ReadonlySet<string>): ConvertFormat {
  return mimes.has(FORMAT_MIMES[wanted]) ? wanted : 'png';
}

/** La qualità vale solo per i formati con perdita. */
export function qualityApplies(format: ConvertFormat): boolean {
  return format !== 'png';
}

/** Lo sfondo serve solo dove la trasparenza non esiste (JPG). */
export function backgroundApplies(format: ConvertFormat): boolean {
  return format === 'jpeg';
}

export function clampResizeValue(mode: ResizeMode, v: number): number {
  if (mode === 'none' || !Number.isFinite(v)) return DEFAULT_RESIZE_VALUE[mode];
  const n = Math.round(v);
  return Math.min(mode === 'percent' ? 100 : MAX_RESIZE_PX, Math.max(1, n));
}

export function isHexColor(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

/** Nome del file di uscita: nome originale senza estensione, più quella del formato (jpeg → .jpg). */
export function outputName(originalName: string, format: ConvertFormat): string {
  const dot = originalName.lastIndexOf('.');
  const base = (dot > 0 ? originalName.slice(0, dot) : originalName).trim() || 'immagine';
  return `${base}.${extensionForMime(FORMAT_MIMES[format])}`;
}

/** Nomi di uscita per un elenco di file, senza duplicati (" (2)", " (3)"…). */
export function outputNames(originalNames: readonly string[], format: ConvertFormat): string[] {
  return uniqueNames(originalNames.map((n) => outputName(n, format)));
}

/** Impostazioni nella forma che si aspetta `processImage`. */
export function toProcessorSettings(s: ConverterSettings): CompressorSettings {
  return {
    format: s.format,
    quality: clampQuality(s.quality),
    resizeMode: s.resizeMode,
    resizeValue: s.resizeValue,
    background: isHexColor(s.background) ? s.background : DEFAULT_SETTINGS.background,
  };
}

/** Vero se il blob prodotto dal canvas è davvero del formato chiesto (altrimenti il browser è tornato al PNG). */
export function encodedAsRequested(blobType: string, mime: string): boolean {
  return blobType === mime;
}
