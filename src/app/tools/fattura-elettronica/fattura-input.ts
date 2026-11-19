// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { unzipSync } from 'fflate';
import { Fattura, FatturaError, decodeXmlBytes, parseFattura } from './fattura-parser';
import { P7mError, decodeBase64Loose, extractP7m } from './p7m';

/** Un file fattura letto: il nome mostrato, l'XML e il modello. */
export interface LoadedInvoice {
  /** Nome del file (per gli ZIP "archivio.zip / fattura.xml"). */
  name: string;
  /** Nome del file XML da proporre al download. */
  xmlName: string;
  from: 'xml' | 'p7m';
  xmlBytes: Uint8Array;
  fattura: Fattura;
}

export type LoadErrorCode = 'unrecognized' | 'invalidXml' | 'notFattura' | 'p7m' | 'empty' | 'zip' | 'zipEmpty';

export interface LoadError {
  name: string;
  code: LoadErrorCode;
}

export interface LoadResult {
  items: LoadedInvoice[];
  errors: LoadError[];
}

/** Sopra questa dimensione si avvisa che l'apertura può essere lenta. */
export const LARGE_FILE_BYTES = 10 * 1024 * 1024;
/** Limite sul totale decompresso di uno ZIP (protegge la memoria). */
const MAX_UNZIPPED = 200 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 500;

const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4;

/** Primo byte significativo (salta BOM e spazi). */
function firstChar(b: Uint8Array): number {
  let i = 0;
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3;
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x0a || b[i] === 0x0d || b[i] === 0x09)) i++;
  return b[i] ?? -1;
}

const baseOf = (name: string) => name.replace(/\.(xml|p7m|zip)$/gi, '').replace(/\.(xml|p7m)$/gi, '');

function fromXml(name: string, xmlName: string, from: 'xml' | 'p7m', bytes: Uint8Array): LoadedInvoice {
  const fattura = parseFattura(decodeXmlBytes(bytes));
  return { name, xmlName, from, xmlBytes: bytes, fattura };
}

function loadOne(name: string, bytes: Uint8Array, out: LoadResult, inZip: boolean): void {
  if (bytes.length === 0) {
    out.errors.push({ name, code: 'empty' });
    return;
  }
  try {
    if (isZip(bytes)) {
      if (inZip) {
        out.errors.push({ name, code: 'unrecognized' });
        return;
      }
      loadZip(name, bytes, out);
      return;
    }
    if (firstChar(bytes) === 0x3c) {
      out.items.push(fromXml(name, /\.xml$/i.test(name) ? name : `${baseOf(name)}.xml`, 'xml', bytes));
      return;
    }
    // niente XML: si prova come busta firmata (DER, oppure Base64 di una busta)
    const looksCms = bytes[0] === 0x30 || decodeBase64Loose(new TextDecoder('latin1').decode(bytes.subarray(0, 4096)))?.[0] === 0x30;
    if (!looksCms) {
      out.errors.push({ name, code: 'unrecognized' });
      return;
    }
    let content: Uint8Array;
    try {
      content = extractP7m(bytes);
    } catch (e) {
      if (e instanceof P7mError) {
        out.errors.push({ name, code: 'p7m' });
        return;
      }
      throw e;
    }
    // l'XML dentro la busta può essere a sua volta in Base64
    if (firstChar(content) !== 0x3c) {
      const dec = decodeBase64Loose(new TextDecoder('latin1').decode(content));
      if (dec && firstChar(dec) === 0x3c) content = dec;
      else {
        out.errors.push({ name, code: 'p7m' });
        return;
      }
    }
    out.items.push(fromXml(name, `${baseOf(name)}.xml`, 'p7m', content));
  } catch (e) {
    if (e instanceof FatturaError) out.errors.push({ name, code: e.code });
    else out.errors.push({ name, code: 'unrecognized' });
  }
}

function loadZip(name: string, bytes: Uint8Array, out: LoadResult): void {
  let total = 0;
  let count = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        if (f.name.endsWith('/') || f.name.startsWith('__MACOSX/') || f.name.split('/').pop()!.startsWith('._')) return false;
        total += f.originalSize;
        return total <= MAX_UNZIPPED && ++count <= MAX_ZIP_ENTRIES;
      },
    });
  } catch {
    out.errors.push({ name, code: 'zip' });
    return;
  }
  const entries = Object.entries(files).filter(([n]) => /\.(xml|p7m)$/i.test(n));
  if (entries.length === 0) {
    out.errors.push({ name, code: 'zipEmpty' });
    return;
  }
  for (const [entry, data] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    loadOne(`${name} / ${entry}`, data, out, true);
    // il nome XML proposto resta quello della voce, senza cartelle
    const last = out.items[out.items.length - 1];
    if (last && last.name === `${name} / ${entry}`) last.xmlName = `${baseOf(entry.split('/').pop()!)}.xml`;
  }
}

/** Legge un file (XML, P7M DER/Base64 o ZIP) e rende le fatture trovate e gli errori. */
export function loadInvoiceFile(name: string, bytes: Uint8Array): LoadResult {
  const out: LoadResult = { items: [], errors: [] };
  loadOne(name, bytes, out, false);
  return out;
}
