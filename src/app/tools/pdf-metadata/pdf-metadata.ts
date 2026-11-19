// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { openForEdit } from '../pdf-common/pdf-file';

/** Lettura, modifica e rimozione dei metadati di un PDF (dizionario Info e flusso XMP). */

export interface PdfMeta {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  /** ISO 8601 (UTC), vuoto se assente. */
  created: string;
  modified: string;
}

export interface MetaInfo {
  meta: PdfMeta;
  /** Il file ha anche un flusso XMP (può contenere gli stessi dati e altri). */
  hasXmp: boolean;
  /** Chiavi del dizionario Info che questo strumento non mostra (personalizzate). */
  customKeys: string[];
  pages: number;
}

const STANDARD = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate', 'Trapped'];
/** Dizionario Info (nei tipi di pdf-lib è privato, ma c'è ed è stabile). */
export const infoDict = (doc: PDFDocument): PDFDict => (doc as unknown as { getInfoDict(): PDFDict }).getInfoDict();
const iso = (d: Date | undefined): string => (d && !Number.isNaN(d.getTime()) ? d.toISOString() : '');

export async function readMeta(bytes: Uint8Array): Promise<MetaInfo> {
  const doc = await openForEdit(bytes);
  const info = infoDict(doc);
  const custom = info
    .keys()
    .map((k) => k.decodeText())
    .filter((k) => !STANDARD.includes(k));
  return {
    meta: {
      title: doc.getTitle() ?? '',
      author: doc.getAuthor() ?? '',
      subject: doc.getSubject() ?? '',
      keywords: doc.getKeywords() ?? '',
      creator: doc.getCreator() ?? '',
      producer: doc.getProducer() ?? '',
      created: iso(doc.getCreationDate()),
      modified: iso(doc.getModificationDate()),
    },
    hasXmp: doc.catalog.has(PDFName.of('Metadata')),
    customKeys: custom,
    pages: doc.getPageCount(),
  };
}

export type WriteResult = { ok: true; bytes: Uint8Array } | { ok: false; field: 'created' | 'modified' };

/** Riscrive il PDF con i campi dati. Un campo vuoto viene tolto dal file. `removeXmp` toglie anche il flusso XMP. */
export async function writeMeta(bytes: Uint8Array, meta: PdfMeta, opts: { removeXmp: boolean; removeCustom: boolean }): Promise<WriteResult> {
  const doc = await openForEdit(bytes);
  const info = infoDict(doc);
  const created = meta.created.trim() === '' ? null : new Date(meta.created);
  const modified = meta.modified.trim() === '' ? null : new Date(meta.modified);
  if (created && Number.isNaN(created.getTime())) return { ok: false, field: 'created' };
  if (modified && Number.isNaN(modified.getTime())) return { ok: false, field: 'modified' };
  for (const k of STANDARD) info.delete(PDFName.of(k));
  if (opts.removeCustom) for (const k of info.keys()) info.delete(k);
  if (meta.title) doc.setTitle(meta.title);
  if (meta.author) doc.setAuthor(meta.author);
  if (meta.subject) doc.setSubject(meta.subject);
  if (meta.keywords) doc.setKeywords(meta.keywords.split(/\s*[,;]\s*/).filter(Boolean));
  if (meta.creator) doc.setCreator(meta.creator);
  if (meta.producer) doc.setProducer(meta.producer);
  if (created) doc.setCreationDate(created);
  if (modified) doc.setModificationDate(modified);
  if (opts.removeXmp) doc.catalog.delete(PDFName.of('Metadata'));
  return { ok: true, bytes: await doc.save({ useObjectStreams: true }) };
}

export const EMPTY_META: PdfMeta = { title: '', author: '', subject: '', keywords: '', creator: '', producer: '', created: '', modified: '' };
