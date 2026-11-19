// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { LayoutOptions, layoutPages } from './pdf-layout';

/** Immagine pronta da inserire: byte JPEG o PNG e dimensioni in pixel dopo l'orientamento EXIF. */
export interface PreparedImage {
  bytes: Uint8Array;
  kind: 'jpg' | 'png';
  width: number;
  height: number;
}

export const PRODUCER = 'rrstudio tools';

/**
 * Crea il PDF con pdf-lib (caricata solo alla prima richiesta). `load(i)` rende l'immagine i-esima solo
 * quando serve, così non si tengono in memoria tutte le immagini decodificate insieme.
 */
export async function buildImagesPdf(
  sizes: readonly { width: number; height: number }[],
  load: (index: number) => Promise<PreparedImage>,
  options: LayoutOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const plans = layoutPages(sizes, options);
  let done = 0;
  for (const plan of plans) {
    const page = doc.addPage([plan.width, plan.height]);
    for (const p of plan.placements) {
      const img = await load(p.index);
      const embedded = img.kind === 'png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
      page.drawImage(embedded, { x: p.x, y: p.y, width: p.width, height: p.height });
      onProgress?.(++done, sizes.length);
    }
  }
  doc.setProducer(PRODUCER);
  doc.setCreator(PRODUCER);
  const now = new Date();
  doc.setCreationDate(now);
  doc.setModificationDate(now);
  return doc.save({ useObjectStreams: true });
}
