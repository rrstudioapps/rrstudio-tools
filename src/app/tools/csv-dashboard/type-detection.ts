// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ColumnInfo, ColumnType } from './models';

/** Soglia di valori non vuoti compatibili per assegnare un tipo a una colonna. */
export const TYPE_THRESHOLD = 0.9;
export const MAX_DISTINCT_CATEGORIES = 50;

const CURRENCY = /[€$£¥₹]|\b(?:EUR|USD|GBP|CHF)\b/gi;

/**
 * Converte un testo in numero, gestendo formato italiano (1.234,56) e inglese (1,234.56),
 * simboli di valuta, percentuali e negativi tra parentesi. Restituisce null se non è un numero.
 * Casi ambigui: "1,234" è letto come migliaia (inglese); "1.234" come decimale; "1.234.567" come migliaia.
 */
export function parseNumber(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(CURRENCY, '').replace(/%/g, '').replace(/[\s  ']/g, '');
  if (s.startsWith('-') || s.startsWith('−')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  } else if (s.endsWith('-')) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (!s) return null;
  // Notazione scientifica
  if (/^\d+(\.\d+)?[eE][+-]?\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? (negative ? -n : n) : null;
  }
  if (!/^(\d+([.,]\d+)*|[.,]\d+)$/.test(s)) return null;
  // Zeri iniziali (codici, CAP, ecc.): non è un numero
  if (/^0\d/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandsSep = decimalSep === '.' ? ',' : '.';
    normalized = s.split(thousandsSep).join('').replace(decimalSep, '.');
  } else if (lastComma >= 0) {
    const parts = s.split(',');
    if (parts.length > 2 || (/^\d{1,3},\d{3}$/.test(s) && parts[0] !== '0')) {
      normalized = parts.join('');
    } else {
      normalized = s.replace(',', '.');
    }
  } else if (lastDot >= 0) {
    const parts = s.split('.');
    normalized = parts.length > 2 ? parts.join('') : s;
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function utc(y: number, m: number, d: number): Date | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1000 || y > 2999) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? date
    : null;
}

/**
 * Riconosce le date testuali: yyyy-mm-dd (anche con ora), dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy,
 * yyyy/mm/dd, yyyy-mm, yyyy/mm e timestamp Unix (secondi o millisecondi). Restituisce una Date UTC.
 */
export function parseDate(input: string | null | undefined): Date | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(s))) {
    return utc(+m[1], +m[2], +m[3]);
  }
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(s))) {
    return utc(+m[3], +m[2], +m[1]);
  }
  if ((m = /^(\d{4})[-/](\d{1,2})$/.exec(s))) {
    return utc(+m[1], +m[2], 1);
  }
  if (/^\d{10}$/.test(s)) {
    const n = Number(s);
    return n >= 315532800 && n <= 4102444800 ? new Date(n * 1000) : null; // 1980..2100
  }
  if (/^\d{13}$/.test(s)) {
    const n = Number(s);
    return n >= 315532800000 && n <= 4102444800000 ? new Date(n) : null;
  }
  return null;
}

/** Numero seriale Excel (sistema 1900) → Date UTC. */
export function excelSerialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400000));
}

/** Intestazione che fa pensare a una data (serve per interpretare i seriali Excel). */
export function headerLooksLikeDate(header: string): boolean {
  return /\b(data|date|giorno|day|mese|month|periodo|period|time|timestamp|anno|year)\b|^(data|date)|(data|date)$/i.test(
    header.trim(),
  );
}

/** Intervallo plausibile dei seriali Excel (≈ 1954–2064). */
function isPlausibleSerial(n: number): boolean {
  return Number.isInteger(n) ? n >= 20000 && n <= 60000 : n >= 20000 && n <= 60000.999;
}

/** Interpreta un valore come data, secondo la colonna (testo o seriale Excel). */
export function parseCellDate(value: string, serial: boolean): Date | null {
  if (serial) {
    const n = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(n) && isPlausibleSerial(n) ? excelSerialToDate(n) : null;
  }
  return parseDate(value);
}

/**
 * Rileva il tipo di una colonna. Un tipo vince se almeno il 90% dei valori non vuoti è compatibile.
 * Ordine: data, numero, categoria (≤ 50 valori distinti e ≤ 50% delle righe), testo.
 */
export function detectColumnType(header: string, values: readonly string[]): ColumnInfo {
  const filled = values.map((v) => (v ?? '').trim()).filter((v) => v !== '');
  const base = { name: header };
  if (filled.length === 0) return { ...base, type: 'text', serialDate: false };
  const need = Math.ceil(filled.length * TYPE_THRESHOLD);
  const count = (fn: (v: string) => boolean) => {
    let c = 0;
    for (const v of filled) if (fn(v)) c++;
    return c;
  };

  if (count((v) => parseDate(v) !== null) >= need) {
    return { ...base, type: 'date', serialDate: false };
  }
  if (headerLooksLikeDate(header)) {
    const isSerial = (v: string) => {
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) && isPlausibleSerial(n);
    };
    if (count(isSerial) >= need) return { ...base, type: 'date', serialDate: true };
  }
  if (count((v) => parseNumber(v) !== null) >= need) {
    return { ...base, type: 'number', serialDate: false };
  }
  const distinct = new Set(filled).size;
  if (distinct <= MAX_DISTINCT_CATEGORIES && distinct <= values.length * 0.5) {
    return { ...base, type: 'category', serialDate: false };
  }
  return { ...base, type: 'text', serialDate: false };
}

/** Rende unici e non vuoti i nomi delle intestazioni. */
export function normalizeHeaders(raw: readonly unknown[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    let name = (h == null ? '' : String(h)).trim() || `Colonna ${i + 1}`;
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    if (n > 1) name = `${name}_${n}`;
    return name;
  });
}

/** Costruisce un dataset da intestazioni e righe di testo, rilevando i tipi. */
export function buildDataset(
  name: string,
  headerRow: readonly unknown[],
  dataRows: readonly (readonly unknown[])[],
): { name: string; columns: ColumnInfo[]; rows: string[][] } {
  const headers = normalizeHeaders(headerRow);
  const rows = dataRows
    .map((r) => headers.map((_, i) => (r[i] == null ? '' : String(r[i]))))
    .filter((r) => r.some((c) => c.trim() !== ''));
  const columns = headers.map((h, i) =>
    detectColumnType(
      h,
      rows.map((r) => r[i]),
    ),
  );
  return { name, columns, rows };
}

export function isColumnType(t: string): t is ColumnType {
  return t === 'date' || t === 'number' || t === 'category' || t === 'text';
}

/** Parole che indicano una colonna "valore": le prime nell'elenco hanno la priorità. */
const VALUE_HINTS = [
  'ricavo',
  'revenue',
  'importo',
  'amount',
  'totale',
  'total',
  'fatturato',
  'vendite',
  'sales',
  'prezzo',
  'price',
];

/** Colonna valori di default: numerica col nome più "da importo", altrimenti la prima numerica. */
export function pickValueColumn(columns: readonly ColumnInfo[]): number | null {
  for (const hint of VALUE_HINTS) {
    const i = columns.findIndex((c) => c.type === 'number' && c.name.toLowerCase().includes(hint));
    if (i >= 0) return i;
  }
  const first = columns.findIndex((c) => c.type === 'number');
  return first >= 0 ? first : null;
}
