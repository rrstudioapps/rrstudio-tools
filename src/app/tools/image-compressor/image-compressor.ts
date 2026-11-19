// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Formati di uscita scelti dall'utente ("original" = lo stesso formato del file di partenza). */
export type OutputFormat = 'original' | 'jpeg' | 'webp' | 'png' | 'avif';
export type ResizeMode = 'none' | 'width' | 'height' | 'percent';

export interface CompressorSettings {
  format: OutputFormat;
  /** 1-100, ignorata per PNG. */
  quality: number;
  resizeMode: ResizeMode;
  /** Pixel per larghezza/altezza massime, percentuale per "percent". */
  resizeValue: number;
  /** Colore (#rrggbb) che sostituisce la trasparenza quando l'uscita è JPEG. */
  background: string;
}

export const MAX_FILES = 50;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const DEFAULT_SETTINGS: CompressorSettings = {
  format: 'original',
  quality: 80,
  resizeMode: 'none',
  resizeValue: 1920,
  background: '#ffffff',
};

/** Valore iniziale sensato quando si cambia modalità di ridimensionamento. */
export const DEFAULT_RESIZE_VALUE: Record<ResizeMode, number> = {
  none: 0,
  width: 1920,
  height: 1080,
  percent: 50,
};

/** Tipi MIME in ingresso accettati. */
const INPUT_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/bmp'];
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
};
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
/** Formati che il canvas può in teoria produrre (la disponibilità reale si verifica nel browser). */
export const ENCODABLE_MIMES = ['image/jpeg', 'image/webp', 'image/png', 'image/avif'] as const;

export const FORMAT_MIME: Record<Exclude<OutputFormat, 'original'>, string> = {
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  png: 'image/png',
  avif: 'image/avif',
};

/** Tipo MIME dell'immagine in ingresso (dal tipo del file o, se manca, dall'estensione); null se non supportata. */
export function inputMime(file: { type: string; name: string }): string | null {
  const t = file.type.toLowerCase();
  if (INPUT_MIMES.includes(t)) return t;
  if (t === 'image/x-ms-bmp') return 'image/bmp';
  if (t !== '' && t !== 'application/octet-stream') return null;
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  return EXT_TO_MIME[ext] ?? null;
}

/** MIME di uscita: quello scelto, oppure l'originale (GIF, BMP e formati non codificabili diventano PNG). */
export function resolveOutputMime(
  source: string,
  format: OutputFormat,
  supported: ReadonlySet<string>,
): string {
  if (format !== 'original') return FORMAT_MIME[format];
  return supported.has(source) ? source : 'image/png';
}

export function extensionForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'png';
}

/** Dimensioni dopo il ridimensionamento: mantiene le proporzioni e non ingrandisce mai. */
export function computeSize(
  width: number,
  height: number,
  mode: ResizeMode,
  value: number,
): { width: number; height: number } {
  let scale = 1;
  if (width > 0 && height > 0 && Number.isFinite(value) && value > 0) {
    if (mode === 'width') scale = value / width;
    else if (mode === 'height') scale = value / height;
    else if (mode === 'percent') scale = value / 100;
  }
  scale = Math.min(1, scale);
  if (scale === 1) return { width, height };
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Nome del file di uscita: nome originale (senza estensione) con la nuova estensione. */
export function outputFileName(originalName: string, mime: string): string {
  const dot = originalName.lastIndexOf('.');
  const base = (dot > 0 ? originalName.slice(0, dot) : originalName).trim() || 'immagine';
  return `${base}.${extensionForMime(mime)}`;
}

/** Rende unici i nomi aggiungendo " (2)", " (3)"… prima dell'estensione (senza distinguere maiuscole). */
export function uniqueNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let candidate = name;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

/** Risparmio in percento intera (negativo se il file è cresciuto). */
export function savingPercent(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 100);
}

/** "−42%" oppure "+8%". */
export function formatSaving(percent: number): string {
  if (percent > 0) return `−${percent}%`;
  if (percent < 0) return `+${-percent}%`;
  return '0%';
}

export function clampQuality(q: number): number {
  if (!Number.isFinite(q)) return DEFAULT_SETTINGS.quality;
  return Math.min(100, Math.max(1, Math.round(q)));
}

/** Se il risultato non è più leggero e il formato è lo stesso, si tiene il file originale. */
export function shouldKeepOriginal(
  sourceMime: string,
  outputMime: string,
  originalBytes: number,
  resultBytes: number,
): boolean {
  return sourceMime === outputMime && resultBytes >= originalBytes;
}
