// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

export type ColumnType = 'date' | 'number' | 'category' | 'text';

export interface ColumnInfo {
  name: string;
  type: ColumnType;
  /** Per le colonne data: i valori sono numeri seriali Excel (non testo). */
  serialDate: boolean;
}

export interface Dataset {
  /** Nome del file (titolo di default della dashboard). */
  name: string;
  columns: ColumnInfo[];
  /** Righe come array di stringhe, nello stesso ordine delle colonne. */
  rows: string[][];
}

export type Aggregation = 'sum' | 'avg' | 'count';
export type TimeChartType = 'line' | 'area' | 'bar';
export type CategoryChartType = 'bar' | 'hbar' | 'pie';
export type Granularity = 'day' | 'month';

export interface PeriodPoint {
  /** Chiave ordinabile: yyyy-mm-dd oppure yyyy-mm. */
  key: string;
  value: number;
}

export interface CategoryPoint {
  name: string;
  value: number;
}

/** Errori di caricamento file, con codice per scegliere il messaggio localizzato. */
export class FileError extends Error {
  constructor(
    readonly code: 'empty' | 'unsupported' | 'too-large' | 'failed',
    message?: string,
  ) {
    super(message ?? code);
  }
}
