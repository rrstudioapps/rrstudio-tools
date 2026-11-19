// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { safeFileName, saveBytes } from '../../shared/download';
import { PasswordProtectedError, openPdf } from '../pdf-tools/pdf-thumbs';

/** Base degli strumenti PDF a un solo file: lettura, controlli e salvataggio con lo stesso comportamento. */

export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const PRODUCER = 'rrstudio tools';

export interface LoadedPdf {
  /** Nome del file caricato. */
  name: string;
  /** Nome senza estensione, per i file prodotti. */
  base: string;
  bytes: Uint8Array;
  pages: number;
}

export type PdfLoadError = 'type' | 'size' | 'password' | 'encrypted' | 'invalid';
export type PdfLoadResult = { ok: true; pdf: LoadedPdf } | { ok: false; error: PdfLoadError };

export const baseNameOf = (name: string): string => safeFileName(name.replace(/\.pdf$/i, ''), 'documento');

/**
 * Legge un PDF: controlla tipo e dimensione, conta le pagine con pdf.js (riconosce le password) e verifica che pdf-lib
 * lo sappia riscrivere (i file cifrati si leggono ma non si riscrivono).
 */
export async function loadPdfFile(file: File): Promise<PdfLoadResult> {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') return { ok: false, error: 'type' };
  if (file.size > MAX_PDF_BYTES) return { ok: false, error: 'size' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  let pages: number;
  try {
    const doc = await openPdf(bytes.slice());
    pages = doc.numPages;
    void doc.loadingTask.destroy();
  } catch (e) {
    return { ok: false, error: e instanceof PasswordProtectedError ? 'password' : 'invalid' };
  }
  try {
    const { PDFDocument } = await import('pdf-lib');
    await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    return { ok: false, error: /encrypt/i.test(String((e as Error)?.name) + String((e as Error)?.message)) ? 'encrypted' : 'invalid' };
  }
  return { ok: true, pdf: { name: file.name, base: baseNameOf(file.name), bytes, pages } };
}

/** Scarica i byte come PDF con il nome `<base>-<suffisso>.pdf`. */
export function downloadPdf(bytes: Uint8Array, base: string, suffix: string): void {
  saveBytes(bytes, `${safeFileName(base, 'documento')}-${suffix}.pdf`, 'application/pdf');
}

/** Intestazione tipica di Producer/Creator, per i file che riscriviamo. */
export async function openForEdit(bytes: Uint8Array): Promise<import('pdf-lib').PDFDocument> {
  const { PDFDocument } = await import('pdf-lib');
  return PDFDocument.load(bytes, { updateMetadata: false });
}
