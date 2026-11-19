// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

// Logica pura di "SVG in PNG": lettura di dimensioni e viewBox, calcolo della dimensione di uscita,
// elenco delle risorse esterne, preparazione dell'SVG per il disegno su canvas e nomi dei file.
// L'unica dipendenza dal browser è DOMParser/XMLSerializer (presenti anche nei test).

export type OutFormat = 'png' | 'jpeg' | 'webp';
export const OUT_FORMATS: readonly OutFormat[] = ['png', 'jpeg', 'webp'];
export const FORMAT_MIME: Record<OutFormat, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
export const FORMAT_EXT: Record<OutFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' };

export const SCALES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
/** Lato massimo dell'immagine prodotta (px) e area massima (pixel). */
export const MAX_SIDE = 16384;
export const MAX_PIXELS = 100_000_000;
/** Dimensione di riserva dei browser per un SVG senza misure (CSS 300×150). */
export const FALLBACK_SIZE = { width: 300, height: 150 } as const;
/** Peso massimo del testo SVG accettato. */
export const MAX_SVG_BYTES = 10 * 1024 * 1024;

export interface Size {
  width: number;
  height: number;
}

export type SizeSource = 'attributes' | 'viewBox' | 'mixed' | 'fallback';

export interface SvgInfo {
  /** Dimensione naturale (px). */
  size: Size;
  /** Da dove viene: width/height, viewBox, entrambi (una misura + proporzioni del viewBox) o valore di riserva. */
  source: SizeSource;
  viewBox: { x: number; y: number; width: number; height: number } | null;
  /** Indirizzi di risorse esterne (non vengono caricate). */
  external: string[];
}

export type SvgError = 'empty' | 'notSvg' | 'parse' | 'tooBig';
export type SvgRead = { ok: true; info: SvgInfo } | { ok: false; error: SvgError };

const UNITS: Record<string, number> = { '': 1, px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96, q: 96 / 101.6, em: 16, rem: 16, ex: 8 };

/** Lunghezza SVG ("12", "3.5cm", "10pt") in pixel; null se manca, è una percentuale o non è valida. */
export function parseLength(value: string | null | undefined): number | null {
  if (value == null) return null;
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(value);
  if (!m) return null;
  const k = UNITS[m[2].toLowerCase()];
  const n = Number(m[1]) * (k ?? NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** viewBox "x y w h" (separatori spazio o virgola); null se non valido o con larghezza/altezza nulle. */
export function parseViewBox(value: string | null | undefined): SvgInfo['viewBox'] {
  if (!value) return null;
  const p = value.trim().split(/[\s,]+/).map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n)) || p[2] <= 0 || p[3] <= 0) return null;
  return { x: p[0], y: p[1], width: p[2], height: p[3] };
}

function parseDoc(text: string): Document | null {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  return doc;
}

/** Un riferimento è esterno se non è un frammento interno (#id) né un data: URI. */
function isExternalRef(v: string): boolean {
  const s = v.trim();
  if (s === '' || s.startsWith('#') || /^data:/i.test(s)) return false;
  return true;
}

/** Indirizzi esterni citati nell'SVG: href di image/use/…, url() e @import negli stili. Senza doppioni, al massimo 20. */
export function externalRefs(root: Element): string[] {
  const out = new Set<string>();
  const add = (v: string): void => {
    if (out.size < 20 && isExternalRef(v)) out.add(v.trim());
  };
  const scanCss = (css: string): void => {
    for (const m of css.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)) add(m[2]);
    for (const m of css.matchAll(/@import\s+(?:url\(\s*)?(['"])([^'"]+)\1/gi)) add(m[2]);
  };
  const all = [root, ...Array.from(root.getElementsByTagName('*'))];
  for (const el of all) {
    for (const a of Array.from(el.attributes)) {
      const name = a.name.toLowerCase();
      if (name === 'href' || name === 'xlink:href' || name === 'src') add(a.value);
      else if (name === 'style') scanCss(a.value);
      else if (/^(fill|stroke|filter|clip-path|mask|marker-start|marker-mid|marker-end)$/.test(name)) scanCss(a.value);
    }
    if (el.localName.toLowerCase() === 'style') scanCss(el.textContent ?? '');
  }
  return [...out];
}

/** Legge dimensioni, viewBox e risorse esterne di un SVG. */
export function readSvg(text: string): SvgRead {
  if (text.trim() === '') return { ok: false, error: 'empty' };
  if (text.length > MAX_SVG_BYTES) return { ok: false, error: 'tooBig' };
  const doc = parseDoc(text);
  if (!doc) return { ok: false, error: 'parse' };
  const root = doc.documentElement;
  if (!root || root.localName.toLowerCase() !== 'svg') return { ok: false, error: 'notSvg' };
  const w = parseLength(root.getAttribute('width'));
  const h = parseLength(root.getAttribute('height'));
  const vb = parseViewBox(root.getAttribute('viewBox'));
  let size: Size;
  let source: SizeSource;
  if (w && h) {
    size = { width: w, height: h };
    source = 'attributes';
  } else if (vb && (w || h)) {
    size = w ? { width: w, height: (w * vb.height) / vb.width } : { width: (h! * vb.width) / vb.height, height: h! };
    source = 'mixed';
  } else if (vb) {
    size = { width: vb.width, height: vb.height };
    source = 'viewBox';
  } else {
    size = { ...FALLBACK_SIZE };
    source = 'fallback';
  }
  return { ok: true, info: { size, source, viewBox: vb, external: externalRefs(root) } };
}

export type SizeMode = 'scale' | 'width' | 'height';

export interface SizeOptions {
  mode: SizeMode;
  /** Moltiplicatore (1-8) per la modalità `scale`. */
  scale: number;
  /** Larghezza o altezza in pixel per le altre modalità. */
  value: number;
}

export interface OutputSize extends Size {
  /** Vero se la dimensione chiesta è stata ridotta per rispettare i limiti. */
  clamped: boolean;
}

/** Numero intero positivo da un campo di testo; null se vuoto o non valido. */
export function parseDimension(v: string): number | null {
  const t = v.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? n : null;
}

/** Dimensione di uscita: scala sulla naturale, oppure larghezza/altezza date con proporzioni mantenute. Entro MAX_SIDE e MAX_PIXELS. */
export function outputSize(natural: Size, o: SizeOptions): OutputSize {
  const ratio = natural.width / natural.height;
  let w: number;
  let h: number;
  if (o.mode === 'scale') {
    const k = Math.min(8, Math.max(0.1, o.scale));
    w = natural.width * k;
    h = natural.height * k;
  } else if (o.mode === 'width') {
    w = o.value;
    h = o.value / ratio;
  } else {
    h = o.value;
    w = o.value * ratio;
  }
  let clamped = false;
  const fit = Math.min(1, MAX_SIDE / Math.max(w, h), Math.sqrt(MAX_PIXELS / (w * h)));
  if (fit < 1) {
    w *= fit;
    h *= fit;
    clamped = true;
  }
  return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)), clamped };
}

const NS = 'http://www.w3.org/2000/svg';
const fmt = (n: number): string => String(Math.round(n * 1000) / 1000);

/**
 * SVG pronto per essere disegnato come immagine alla dimensione `size`: radice con xmlns, viewBox (se mancava, quello
 * dedotto da width/height) e width/height in pixel; script, gestori di eventi e foreignObject vengono tolti.
 * Rende null se il testo non è un SVG valido.
 */
export function prepareSvg(text: string, size: Size): string | null {
  const doc = parseDoc(text);
  if (!doc || doc.documentElement.localName.toLowerCase() !== 'svg') return null;
  const root = doc.documentElement;
  const info = readSvg(text);
  if (!info.ok) return null;
  if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', NS);
  if (!parseViewBox(root.getAttribute('viewBox'))) {
    const n = info.info.size;
    root.setAttribute('viewBox', `0 0 ${fmt(n.width)} ${fmt(n.height)}`);
  }
  root.setAttribute('width', fmt(size.width));
  root.setAttribute('height', fmt(size.height));
  for (const el of [root, ...Array.from(root.getElementsByTagName('*'))]) {
    const name = el.localName.toLowerCase();
    if (el !== root && (name === 'script' || name === 'foreignobject')) {
      el.remove();
      continue;
    }
    for (const a of Array.from(el.attributes)) if (/^on/i.test(a.name)) el.removeAttribute(a.name);
  }
  return new XMLSerializer().serializeToString(doc);
}

/** Nome del file di uscita: nome dell'SVG senza estensione e quella del formato. */
export function outputFileName(original: string, format: OutFormat): string {
  const base = original.replace(/\.svgz?$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().replace(/^\.+/, '');
  return `${base || 'immagine'}.${FORMAT_EXT[format]}`;
}

/** Colore #rrggbb valido. */
export const isHexColor = (v: string): boolean => /^#[0-9a-f]{6}$/i.test(v);

/** Vero se il testo ha l'aspetto di un SVG (per i testi arrivati da altri strumenti). */
export const looksLikeSvg = (t: string): boolean => /<svg[\s>]/i.test(t);
