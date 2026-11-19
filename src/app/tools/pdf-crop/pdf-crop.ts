// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { PDFPage } from 'pdf-lib';
import { openForEdit, PRODUCER } from '../pdf-common/pdf-file';
import { planPages } from '../pdf-page-text/pdf-page-text';
import type { RangeError } from '../pdf-tools/page-ranges';

/**
 * Ritaglia i margini, ridimensiona in percentuale o adatta le pagine a un formato (A5, A4, A3, Letter, Legal).
 * - Ritaglio: cambia MediaBox e CropBox; il contenuto fuori dal riquadro resta nel file (non è una rimozione).
 * - Percentuale: ingrandisce o riduce pagina e contenuto, link compresi.
 * - Adatta al formato: ricostruisce la pagina nella misura scelta, centrata; i link della pagina si perdono.
 */

export const MM = 72 / 25.4;
export const SIZES = {
  A5: [419.53, 595.28],
  A4: [595.28, 841.89],
  A3: [841.89, 1190.55],
  Letter: [612, 792],
  Legal: [612, 1008],
} as const;
export type SizeName = keyof typeof SIZES;

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type Op =
  | { kind: 'crop'; margins: Margins; pages: string }
  | { kind: 'scale'; percent: number; pages: string }
  | { kind: 'fit'; size: SizeName; margin: number; pages: string };

export type OpError = { code: 'range'; error: RangeError } | { code: 'tooMuch'; page: number } | { code: 'percent' } | { code: 'noPages' };
export type OpResult = { ok: true; bytes: Uint8Array; pages: number } | { ok: false; error: OpError };

/** Dimensioni a schermo (tenendo conto della rotazione) in punti. */
export function visualSize(page: PDFPage): { width: number; height: number } {
  const b = page.getMediaBox();
  const r = page.getRotation().angle % 180 !== 0;
  return r ? { width: b.height, height: b.width } : { width: b.width, height: b.height };
}

/** Margini visivi (in alto/destra/in basso/a sinistra) riportati sui lati della pagina «vera». */
export function rawMargins(rotation: number, m: Margins): Margins {
  switch (((rotation % 360) + 360) % 360) {
    case 90: return { top: m.right, right: m.bottom, bottom: m.left, left: m.top };
    case 180: return { top: m.bottom, right: m.left, bottom: m.top, left: m.right };
    case 270: return { top: m.left, right: m.top, bottom: m.right, left: m.bottom };
    default: return m;
  }
}

export async function transformPages(bytes: Uint8Array, op: Op): Promise<OpResult> {
  const doc = await openForEdit(bytes);
  const total = doc.getPageCount();
  const plan = planPages(total, { pages: op.pages, skipFirst: false });
  if (!plan.ok) return { ok: false, error: { code: 'range', error: plan.error } };
  if (plan.indices.length === 0) return { ok: false, error: { code: 'noPages' } };

  if (op.kind === 'crop') {
    for (const i of plan.indices) {
      const page = doc.getPage(i);
      const rot = page.getRotation().angle;
      const v = visualSize(page);
      if (op.margins.left + op.margins.right >= v.width - 10 || op.margins.top + op.margins.bottom >= v.height - 10) return { ok: false, error: { code: 'tooMuch', page: i + 1 } };
      const m = rawMargins(rot, op.margins);
      const b = page.getMediaBox();
      const x = b.x + m.left;
      const y = b.y + m.bottom;
      const w = b.width - m.left - m.right;
      const h = b.height - m.top - m.bottom;
      page.setMediaBox(x, y, w, h);
      page.setCropBox(x, y, w, h);
    }
    return { ok: true, bytes: await doc.save({ useObjectStreams: true }), pages: plan.indices.length };
  }

  if (op.kind === 'scale') {
    if (!(op.percent >= 10 && op.percent <= 400)) return { ok: false, error: { code: 'percent' } };
    const k = op.percent / 100;
    for (const i of plan.indices) doc.getPage(i).scale(k, k);
    return { ok: true, bytes: await doc.save({ useObjectStreams: true }), pages: plan.indices.length };
  }

  // fit: nuovo documento, pagine scelte ricostruite nella misura del formato (orientamento come l'originale)
  const { PDFDocument, degrees } = await import('pdf-lib');
  const out = await PDFDocument.create();
  const selected = new Set(plan.indices);
  for (let i = 0; i < total; i++) {
    const src = doc.getPage(i);
    if (!selected.has(i)) {
      const [copy] = await out.copyPages(doc, [i]);
      out.addPage(copy);
      continue;
    }
    const rot = src.getRotation().angle;
    const v = visualSize(src);
    const [a, b] = SIZES[op.size];
    const landscape = v.width > v.height;
    const tw = landscape ? b : a;
    const th = landscape ? a : b;
    const s = Math.min((tw - 2 * op.margin) / v.width, (th - 2 * op.margin) / v.height);
    // lavoriamo nello spazio «vero» della pagina: la rotazione dell'originale viene riapplicata alla nuova pagina
    const swap = rot % 180 !== 0;
    const rawW = swap ? th : tw;
    const rawH = swap ? tw : th;
    const page = out.addPage([rawW, rawH]);
    if (rot) page.setRotation(degrees(rot));
    // una pagina senza contenuto (bianca) non si può incorporare: resta bianca nella misura nuova
    if (!src.node.Contents()) continue;
    const emb = await out.embedPage(src);
    const dw = emb.width * s;
    const dh = emb.height * s;
    page.drawPage(emb, { x: (rawW - dw) / 2, y: (rawH - dh) / 2, width: dw, height: dh });
  }
  out.setProducer(PRODUCER);
  out.setCreator(PRODUCER);
  const title = doc.getTitle();
  if (title) out.setTitle(title);
  return { ok: true, bytes: await out.save({ useObjectStreams: true }), pages: plan.indices.length };
}
