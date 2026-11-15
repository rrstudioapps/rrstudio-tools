// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { Injectable } from '@angular/core';
import { Dataset, FileError } from './models';
import { buildDataset } from './type-detection';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['csv', 'tsv', 'txt', 'xlsx', 'xls'] as const;
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',');

const SAMPLE_URL = 'samples/vendite-demo.csv';

/** Decodifica UTF-8; se non valido ripiega su windows-1252 (tipico dei CSV esportati da Excel). */
export function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** Nome file senza estensione. */
export function baseName(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, '');
}

@Injectable({ providedIn: 'root' })
export class FileParserService {
  /** Legge e analizza un file CSV/TSV/TXT/XLSX/XLS interamente nel browser. */
  async parseFile(file: File): Promise<Dataset> {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
      throw new FileError('unsupported');
    }
    if (file.size > MAX_FILE_BYTES) throw new FileError('too-large');
    if (file.size === 0) throw new FileError('empty');
    const buffer = await file.arrayBuffer();
    return ext === 'xlsx' || ext === 'xls'
      ? this.parseSpreadsheet(buffer, baseName(file.name))
      : this.parseCsv(decodeText(buffer), baseName(file.name));
  }

  /** Carica il file di esempio dallo stesso sito (stessa origine). */
  async loadSample(): Promise<Dataset> {
    const res = await fetch(SAMPLE_URL);
    if (!res.ok) throw new FileError('failed');
    return this.parseCsv(decodeText(await res.arrayBuffer()), 'vendite-demo');
  }

  /** CSV/TSV/TXT con PapaParse: il delimitatore (`,` `;` tab `|`) viene rilevato da solo. */
  async parseCsv(text: string, name: string): Promise<Dataset> {
    const Papa = (await import('papaparse')).default;
    const result = Papa.parse<string[]>(text, {
      header: false,
      dynamicTyping: false,
      skipEmptyLines: 'greedy',
      delimitersToGuess: [',', ';', '\t', '|'],
    });
    return this.toDataset(name, result.data);
  }

  /** Excel: primo foglio, prima riga come intestazione. */
  async parseSpreadsheet(buffer: ArrayBuffer, name: string): Promise<Dataset> {
    const XLSX = await import('xlsx');
    let table: unknown[][];
    try {
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new FileError('empty');
      table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
    } catch (e) {
      throw e instanceof FileError ? e : new FileError('failed');
    }
    // Le celle data arrivano come Date: si converte in yyyy-mm-dd (arrotondando al giorno)
    const text = table.map((row) =>
      row.map((cell) =>
        cell instanceof Date
          ? new Date(cell.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10)
          : cell,
      ),
    );
    return this.toDataset(name, text);
  }

  private toDataset(name: string, table: readonly (readonly unknown[])[]): Dataset {
    const nonEmpty = table.filter((r) => r.some((c) => c != null && String(c).trim() !== ''));
    if (nonEmpty.length < 2) throw new FileError('empty');
    const [header, ...rows] = nonEmpty;
    return buildDataset(name, header, rows);
  }
}
