// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { Cell, guessDelimiter } from './convert';

/** Lettura e scrittura di CSV (PapaParse) ed Excel (SheetJS), caricate solo quando servono. */

export type Delimiter = ',' | ';' | '\t' | '|';

/** Decodifica UTF-8; se non valido ripiega su windows-1252 (tipico dei CSV esportati da Excel). */
export function decodeText(buffer: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder('windows-1252').decode(buffer);
  }
  return text.replace(/^﻿/, '');
}

export interface CsvParsed {
  rows: string[][];
  delimiter: Delimiter;
}

/** CSV → righe di testo. Con `delimiter` vuoto il separatore viene riconosciuto. */
export async function parseCsv(text: string, delimiter: Delimiter | 'auto'): Promise<CsvParsed> {
  const Papa = (await import('papaparse')).default;
  const delim: Delimiter = delimiter === 'auto' ? guessDelimiter(text) : delimiter;
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ''), { header: false, dynamicTyping: false, skipEmptyLines: 'greedy', delimiter: delim });
  return { rows: result.data, delimiter: delim };
}

/** Righe → testo CSV (a capo CRLF come da RFC 4180). */
export async function unparseCsv(rows: string[][], delimiter: Delimiter, quoteAll: boolean): Promise<string> {
  const Papa = (await import('papaparse')).default;
  return Papa.unparse(rows, { delimiter, quotes: quoteAll, newline: '\r\n' });
}

export interface Workbook {
  sheets: string[];
  /** Righe di ogni foglio, con numeri e booleani tipizzati e le date in ISO yyyy-mm-dd. */
  read(index: number): Cell[][];
}

/** Apre un file Excel (xlsx/xls) e restituisce i nomi dei fogli e le righe del foglio richiesto. */
export async function readWorkbook(buffer: ArrayBuffer): Promise<Workbook> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  return {
    sheets: wb.SheetNames,
    read(index: number): Cell[][] {
      const sheet = wb.Sheets[wb.SheetNames[index]];
      if (!sheet) return [];
      const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
      return table.map((row) =>
        row.map((cell): Cell => {
          if (cell instanceof Date) return new Date(cell.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
          if (cell === null || cell === undefined) return '';
          if (typeof cell === 'number' || typeof cell === 'boolean' || typeof cell === 'string') return cell;
          return String(cell);
        }),
      );
    },
  };
}

/** Righe tipizzate → file xlsx (un foglio). */
export async function writeXlsx(rows: Cell[][], sheetName = 'Foglio1'): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map((c) => (c === null ? '' : c))));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(out);
}
