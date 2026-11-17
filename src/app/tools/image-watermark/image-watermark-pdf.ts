// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from 'pdf-lib';
import { EncryptedPdfError, hexToRgb, placementToPdf, sanitizeText, visualSize, type PageBox } from '../pdf-sign/pdf-sign';
import { cleanText, clamp, fontSize, layout, logoSize, type FontId, type WatermarkSettings } from './image-watermark';

const FONTS: Record<FontId, [StandardFonts, StandardFonts]> = {
  sans: [StandardFonts.Helvetica, StandardFonts.HelveticaBold],
  serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold],
  mono: [StandardFonts.Courier, StandardFonts.CourierBold],
};

/** Distanza della linea di base sotto il centro verticale del testo (in frazione del corpo): come la linea mediana del canvas. */
export const BASELINE_SHIFT = 0.32;

export interface PdfResult {
  bytes: Uint8Array;
  /** Vero se qualche carattere non esiste nei font standard del PDF ed è stato sostituito da «?». */
  replaced: boolean;
}

/** Punto della pagina (coordinate visive, origine in alto a sinistra) di un punto locale `(lx, ly)` del riquadro centrato in `c` e ruotato di `deg` gradi (senso orario). */
export function rotateAround(cx: number, cy: number, lx: number, ly: number, deg: number): { x: number; y: number } {
  const r = (deg * Math.PI) / 180;
  return { x: cx + lx * Math.cos(r) - ly * Math.sin(r), y: cy + lx * Math.sin(r) + ly * Math.cos(r) };
}

/**
 * Applica la filigrana alle pagine indicate (indici da 0, oppure una funzione che li ricava dal numero di pagine). Lancia EncryptedPdfError se il file è cifrato.
 * `logoPng` serve solo per la filigrana di immagine.
 */
export async function watermarkPdf(pdf: Uint8Array, s: WatermarkSettings, which: readonly number[] | ((total: number) => number[]), logoPng: Uint8Array | null): Promise<PdfResult> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdf);
  } catch (e) {
    if ((e as Error)?.name === 'EncryptedPDFError' || /encrypt/i.test((e as Error)?.message ?? '')) throw new EncryptedPdfError();
    throw e;
  }
  const pages = doc.getPages();
  const [cr, cg, cb] = hexToRgb(s.color);
  const opacity = clamp(s.opacity, 1, 100) / 100;
  let replaced = false;
  let font: PDFFont | null = null;
  let text = '';
  let image: Awaited<ReturnType<PDFDocument['embedPng']>> | null = null;
  if (s.kind === 'image') {
    if (!logoPng) throw new Error('logo');
    image = await doc.embedPng(logoPng);
  } else {
    font = await doc.embedFont(FONTS[s.font][s.bold ? 1 : 0]);
    const charset = new Set(font.getCharacterSet());
    const clean = cleanText(s.text);
    text = sanitizeText(clean, (cp) => charset.has(cp));
    replaced = text !== clean;
    if (!text) throw new Error('text');
  }
  const pageIndexes = typeof which === 'function' ? which(doc.getPageCount()) : which;
  for (const index of pageIndexes) {
    const page = pages[index];
    if (!page) continue;
    const cbx = page.getCropBox();
    const box: PageBox = { x: cbx.x, y: cbx.y, width: cbx.width, height: cbx.height, rotation: page.getRotation().angle };
    const v = visualSize(box);
    let w: number;
    let h: number;
    let size = 0;
    if (image) {
      const sz = logoSize(image.width, image.height, s.logoScale, v.width, v.height);
      w = sz.w;
      h = sz.h;
    } else {
      size = fontSize(s.sizePct, v.width, v.height);
      w = font!.widthOfTextAtSize(text, size);
      h = size * 1.15;
    }
    for (const p of layout(s, w, h, v.width, v.height)) {
      // angolo in basso a sinistra del riquadro (immagine) o inizio della linea di base (testo), in coordinate visive
      const local = image ? { x: -w / 2, y: h / 2 } : { x: -w / 2, y: size * BASELINE_SHIFT };
      const o = rotateAround(p.cx, p.cy, local.x, local.y, s.rotation);
      const at = placementToPdf({ x: o.x / v.width, y: o.y / v.height, w: 0, h: 0 }, box);
      // la pagina ruotata di R gradi in senso orario: nello spazio della pagina la rotazione antioraria è R meno quella visiva
      const rotate = degrees(at.rotate - s.rotation);
      if (image) page.drawImage(image, { x: at.x, y: at.y, width: w, height: h, rotate, opacity });
      else page.drawText(text, { x: at.x, y: at.y, size, font: font!, color: rgb(cr, cg, cb), rotate, opacity });
    }
  }
  return { bytes: await doc.save(), replaced };
}
