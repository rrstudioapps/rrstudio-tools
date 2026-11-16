// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { IbanAnalysis, IbanIssue, analyzeIban, normalizeIban } from './iban';
import { VatAnalysis, VatIssue, analyzeVat } from './vat';

export type ValueKind = 'iban' | 'vat' | 'taxcode' | 'unknown';

const TAX_CODE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

/** Riconosce se un valore incollato è un IBAN, una partita IVA italiana o (per rimandare all'altro strumento) un codice fiscale. */
export function detectKind(raw: string): ValueKind {
  const v = normalizeIban(raw);
  if (!v) return 'unknown';
  if (TAX_CODE.test(v)) return 'taxcode';
  // 9-13 cifre (con o senza IT): partita IVA, anche se sbagliata nella lunghezza; l'IBAN italiano ha 27 caratteri
  if (/^(IT)?\d{9,13}$/.test(v)) return 'vat';
  if (/^[A-Z]{2}\d{2}[A-Z0-9]{4,}$/.test(v)) return 'iban';
  if (/^[A-Z]{2}[A-Z0-9]{2,}$/.test(v) && /\d/.test(v)) return 'iban';
  return 'unknown';
}

export interface ValueResult {
  /** Numero della riga (da 1) nell'elenco incollato. */
  line: number;
  input: string;
  kind: ValueKind;
  valid: boolean;
  /** Valore normalizzato (IBAN a gruppi di quattro, partita IVA con 11 cifre). */
  normalized: string;
  iban?: IbanAnalysis;
  vat?: VatAnalysis;
}

export type ValueIssue = IbanIssue | VatIssue | 'unknown-kind' | 'taxcode';

export function analyzeValue(raw: string, line = 1, kind: ValueKind = detectKind(raw)): ValueResult {
  const base = { line, input: raw.trim() };
  if (kind === 'iban') {
    const iban = analyzeIban(raw);
    return { ...base, kind, valid: iban.valid, normalized: iban.formatted, iban };
  }
  if (kind === 'vat') {
    const vat = analyzeVat(raw);
    return { ...base, kind, valid: vat.valid, normalized: vat.digits, vat };
  }
  return { ...base, kind, valid: false, normalized: '' };
}

/** Il primo problema di un risultato (codice), utile per le tabelle e l'export. */
export function firstIssue(r: ValueResult): ValueIssue | null {
  if (r.kind === 'iban') return r.iban!.issues[0] ?? null;
  if (r.kind === 'vat') return r.vat!.issues[0] ?? null;
  return r.kind === 'taxcode' ? 'taxcode' : 'unknown-kind';
}

export const MAX_BULK_LINES = 5000;

/** Una verifica per riga (righe vuote saltate; il numero di riga resta quello del testo incollato). */
export function analyzeBulk(text: string, forced: ValueKind | 'auto' = 'auto'): { results: ValueResult[]; truncated: boolean } {
  const results: ValueResult[] = [];
  const lines = text.split(/\r\n|\r|\n/);
  let truncated = false;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    if (results.length >= MAX_BULK_LINES) {
      truncated = true;
      break;
    }
    results.push(analyzeValue(lines[i], i + 1, forced === 'auto' ? undefined : forced));
  }
  return { results, truncated };
}

/** Cella CSV: virgolette raddoppiate; i valori che iniziano con = + - @ sono preceduti da un apice (formule di Excel). */
export function csvCell(value: string, sep: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return /["\r\n]/.test(v) || v.includes(sep) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

export function toCsv(rows: string[][], sep: string): string {
  return rows.map((r) => r.map((c) => csvCell(c, sep)).join(sep)).join('\r\n') + '\r\n';
}
