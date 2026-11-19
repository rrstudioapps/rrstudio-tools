// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { PDFDocument, PDFName, StandardFonts, degrees, rgb } from 'pdf-lib';

/**
 * Logica pura della firma grafica di un PDF: posizionamento (in frazioni della pagina vista a schermo),
 * conversione nelle coordinate del PDF (con rotazione e CropBox), pixel della firma ed esportazione con pdf-lib.
 * Si tratta di un'immagine inserita nella pagina, NON di una firma digitale.
 */

export type PlacementKind = 'signature' | 'date';

/** Elemento sulla pagina. x, y, w, h sono frazioni (0..1) della pagina vista a schermo, origine in alto a sinistra. */
export interface Placement {
  id: number;
  /** Pagina, da 0. */
  page: number;
  kind: PlacementKind;
  /** Firma usata (solo `signature`). */
  sigId?: number;
  /** Testo (solo `date`). */
  text?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Larghezza minima di una firma, in frazione della pagina. */
export const MIN_W = 0.04;
/** Altezza minima del testo della data, in frazione dell'altezza della pagina. */
export const MIN_TEXT_H = 0.012;
export const MAX_TEXT_H = 0.08;
/** Rapporto fra corpo del carattere e altezza del riquadro della data, e posizione della linea di base. */
export const TEXT_SIZE = 0.7;
export const TEXT_BASELINE = 0.22;
/** Larghezza media di un carattere (in em) usata solo per tenere la data dentro la pagina. */
const AVG_CHAR_EM = 0.55;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Larghezza stimata (frazione della pagina) del testo della data. */
export function textWidthFrac(text: string, h: number, pageRatio: number): number {
  return Math.min(1, (text.length * AVG_CHAR_EM * TEXT_SIZE * h) / pageRatio);
}

/** Larghezza (frazione) di un elemento, per tenerlo dentro la pagina. */
export function widthFrac(p: Placement, pageRatio: number): number {
  return p.kind === 'date' ? textWidthFrac(p.text ?? '', p.h, pageRatio) : p.w;
}

/** Porta l'elemento dentro la pagina. */
export function clampPlacement(p: Placement, pageRatio: number): Placement {
  const w = widthFrac(p, pageRatio);
  return { ...p, x: clamp(p.x, 0, Math.max(0, 1 - w)), y: clamp(p.y, 0, Math.max(0, 1 - p.h)) };
}

/** Nuova firma: larghezza data, proporzioni dell'immagine, in basso a destra. `pageRatio` = larghezza/altezza della pagina. */
export function newSignature(id: number, page: number, sigId: number, aspect: number, pageRatio: number, w = 0.28): Placement {
  const maxW = Math.min(w, 1, aspect / pageRatio); // non più alta della pagina
  const h = (maxW * pageRatio) / aspect;
  return clampPlacement({ id, page, kind: 'signature', sigId, x: 1 - maxW - 0.08, y: 1 - h - 0.08, w: maxW, h }, pageRatio);
}

/** Nuova data: testo in basso a sinistra. */
export function newDate(id: number, page: number, text: string, pageRatio: number, h = 0.025): Placement {
  return clampPlacement({ id, page, kind: 'date', text, x: 0.08, y: 1 - h - 0.08, w: 0, h }, pageRatio);
}

/** Sposta di (dx, dy) in frazioni di pagina, restando dentro. */
export function movePlacement(p: Placement, dx: number, dy: number, pageRatio: number): Placement {
  return clampPlacement({ ...p, x: p.x + dx, y: p.y + dy }, pageRatio);
}

/**
 * Cambia la dimensione: la firma mantiene le proporzioni dell'immagine (`aspect` = larghezza/altezza in pixel),
 * la data cambia il corpo del testo (`newW` è allora la nuova altezza del riquadro). Il centro resta fermo se possibile.
 */
export function resizePlacement(p: Placement, newW: number, pageRatio: number, aspect: number): Placement {
  if (p.kind === 'date') {
    const h = clamp(newW, MIN_TEXT_H, MAX_TEXT_H);
    return clampPlacement({ ...p, h }, pageRatio);
  }
  const maxW = Math.min(1, aspect / pageRatio);
  const w = clamp(newW, MIN_W, maxW);
  const h = (w * pageRatio) / aspect;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  return clampPlacement({ ...p, w, h, x: cx - w / 2, y: cy - h / 2 }, pageRatio);
}

/** Moltiplica la dimensione (firma: larghezza; data: corpo del testo). */
export function scalePlacement(p: Placement, factor: number, pageRatio: number, aspect: number): Placement {
  return resizePlacement(p, (p.kind === 'date' ? p.h : p.w) * factor, pageRatio, aspect);
}

/** Pagina di partenza per le coordinate: CropBox (o MediaBox) non ruotata e rotazione del PDF. */
export interface PageBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0, 90, 180 o 270 (in senso orario). */
  rotation: number;
}

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotazione antioraria in gradi, come `rotate` di pdf-lib. */
  rotate: number;
}

export const normalizeRotation = (r: number): 0 | 90 | 180 | 270 => ((((Math.round(r / 90) * 90) % 360) + 360) % 360) as 0 | 90 | 180 | 270;

/** Dimensioni della pagina come la vede l'utente (scambia i lati se ruotata di 90/270). */
export function visualSize(box: PageBox): { width: number; height: number } {
  const r = normalizeRotation(box.rotation);
  return r === 90 || r === 270 ? { width: box.height, height: box.width } : { width: box.width, height: box.height };
}

/** Punto in coordinate visive (punti, origine in alto a sinistra) → spazio utente della pagina (origine in basso a sinistra, non ruotata). */
function visualToUser(vx: number, vy: number, box: PageBox): { x: number; y: number } {
  const w = box.width;
  const h = box.height;
  switch (normalizeRotation(box.rotation)) {
    case 90:
      return { x: box.x + vy, y: box.y + vx };
    case 180:
      return { x: box.x + w - vx, y: box.y + vy };
    case 270:
      return { x: box.x + w - vy, y: box.y + h - vx };
    default:
      return { x: box.x + vx, y: box.y + h - vy };
  }
}

/**
 * Converte un rettangolo visivo (frazioni, origine in alto a sinistra) in posizione, dimensioni e rotazione del PDF:
 * (x, y) è l'angolo in basso a sinistra dell'elemento *come lo vede l'utente*.
 */
export function placementToPdf(p: Pick<Placement, 'x' | 'y' | 'w' | 'h'>, box: PageBox): PdfRect {
  const v = visualSize(box);
  const vx = p.x * v.width;
  const vy = (p.y + p.h) * v.height; // bordo inferiore a schermo
  const o = visualToUser(vx, vy, box);
  const rot = normalizeRotation(box.rotation);
  return { x: o.x, y: o.y, width: p.w * v.width, height: p.h * v.height, rotate: rot };
}

// ---------- data ----------

export type DateStyle = 'numeric' | 'iso' | 'long';

const pad = (n: number) => String(n).padStart(2, '0');

/** Data in testo: 17/11/2026, 2026-11-17 oppure 17 novembre 2026. */
export function formatDate(d: Date, style: DateStyle, locale: string): string {
  if (style === 'iso') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (style === 'numeric') return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/** Sostituisce con `?` i caratteri che il carattere standard del PDF (WinAnsi) non sa disegnare. */
export function sanitizeText(text: string, canEncode: (cp: number) => boolean): string {
  return [...text.replace(/\s+/g, ' ')].map((c) => (canEncode(c.codePointAt(0)!) ? c : '?')).join('');
}

// ---------- pixel della firma ----------

/**
 * Rende trasparente lo sfondo chiaro (fogli di carta, foto di una firma): sopra `threshold` (0-255, sul
 * canale più scuro) il pixel diventa trasparente, poco sotto sfuma, così i bordi del tratto restano morbidi.
 * Modifica `data` (RGBA) sul posto.
 */
export function removeWhiteBackground(data: Uint8ClampedArray, threshold: number): void {
  const t = clamp(threshold, 1, 255);
  const soft = Math.min(40, t - 1);
  for (let i = 0; i < data.length; i += 4) {
    const lowest = Math.min(data[i], data[i + 1], data[i + 2]);
    if (lowest >= t) data[i + 3] = 0;
    else if (soft > 0 && lowest > t - soft) data[i + 3] = Math.round((data[i + 3] * (t - lowest)) / soft);
  }
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Riquadro che contiene i pixel visibili (alfa sopra `alphaMin`), con un margine; null se l'immagine è vuota. */
export function contentBounds(data: Uint8ClampedArray, width: number, height: number, alphaMin = 8, margin = 0): Bounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > alphaMin) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const x = Math.max(0, minX - margin);
  const y = Math.max(0, minY - margin);
  return { x, y, w: Math.min(width, maxX + 1 + margin) - x, h: Math.min(height, maxY + 1 + margin) - y };
}

/** Riduce le dimensioni di un'immagine se il lato lungo supera `max`. */
export function fitMax(width: number, height: number, max: number): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

// ---------- tratti disegnati ----------

export interface Point {
  x: number;
  y: number;
  /** Pressione della penna (0..1); 0,5 se non disponibile. */
  p: number;
}
export interface Stroke {
  points: Point[];
  width: number;
  color: string;
  /** Tratto fatto con una penna (la pressione modula lo spessore). */
  pen: boolean;
}

/** Spessore del tratto in un punto: con la penna la pressione lo modula (da 40% a 140%). */
export function strokeWidthAt(base: number, pressure: number, pen: boolean): number {
  return pen ? base * (0.4 + clamp(pressure, 0, 1)) : base;
}

/** Colore ammesso per l'inchiostro (#rrggbb); altrimenti nero. */
export function safeColor(c: string): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? c : '#000000';
}

export function hexToRgb(hex: string): [number, number, number] {
  const c = safeColor(hex);
  return [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];
}

// ---------- esportazione ----------

export class EncryptedPdfError extends Error {
  constructor() {
    super('encrypted');
  }
}

export interface SignatureImage {
  /** PNG con trasparenza. */
  png: Uint8Array;
}

/**
 * Inserisce firme (immagini PNG) e date nel PDF. Rende i byte del nuovo PDF.
 * Lancia EncryptedPdfError se il file è cifrato (pdf-lib non sa decifrarlo).
 */
export async function applyPlacements(
  pdf: Uint8Array,
  images: ReadonlyMap<number, SignatureImage>,
  placements: readonly Placement[],
  textColor = '#000000',
): Promise<Uint8Array> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdf);
  } catch (e) {
    if ((e as Error)?.name === 'EncryptedPDFError' || /encrypt/i.test((e as Error)?.message ?? '')) throw new EncryptedPdfError();
    throw e;
  }
  const pages = doc.getPages();
  const embedded = new Map<number, Awaited<ReturnType<PDFDocument['embedPng']>>>();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const charset = new Set(font.getCharacterSet());
  const [cr, cg, cb] = hexToRgb(textColor);
  for (const p of placements) {
    const page = pages[p.page];
    if (!page) continue;
    const cb4 = page.getCropBox();
    const box: PageBox = { x: cb4.x, y: cb4.y, width: cb4.width, height: cb4.height, rotation: page.getRotation().angle };
    if (p.kind === 'signature') {
      const img = images.get(p.sigId ?? -1);
      if (!img) continue;
      let ref = embedded.get(p.sigId!);
      if (!ref) {
        ref = await doc.embedPng(img.png);
        embedded.set(p.sigId!, ref);
      }
      const r = placementToPdf(p, box);
      page.drawImage(ref, { x: r.x, y: r.y, width: r.width, height: r.height, rotate: degrees(r.rotate) });
    } else {
      const text = sanitizeText(p.text ?? '', (cp) => charset.has(cp));
      if (!text) continue;
      const v = visualSize(box);
      const vh = p.h * v.height;
      // la linea di base sta sopra il bordo inferiore del riquadro
      const r = placementToPdf({ x: p.x, y: p.y + p.h * (1 - TEXT_BASELINE), w: 0, h: 0 }, box);
      page.drawText(text, { x: r.x, y: r.y, size: vh * TEXT_SIZE, font, color: rgb(cr, cg, cb), rotate: degrees(r.rotate) });
    }
  }
  return doc.save();
}

/** Riferimenti (testo) degli XObject di una pagina: servono ai test per verificare inserimento e riuso delle immagini. */
export function pageImageRefs(doc: PDFDocument, pageIndex: number): string[] {
  const xo = doc.getPage(pageIndex).node.Resources()?.lookup(PDFName.of('XObject'));
  if (!xo || !('entries' in xo)) return [];
  return (xo as unknown as { entries(): [unknown, unknown][] }).entries().map(([, ref]) => String(ref));
}

/** Quante immagini (XObject) contiene una pagina. */
export function countPageImages(doc: PDFDocument, pageIndex: number): number {
  return pageImageRefs(doc, pageIndex).length;
}
