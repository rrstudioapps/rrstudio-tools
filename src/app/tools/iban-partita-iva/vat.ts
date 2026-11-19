// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { VAT_OFFICES } from './vat-offices';

/**
 * Partita IVA italiana: 11 cifre = 7 di progressivo + 3 di codice dell'ufficio + 1 di controllo.
 * Algoritmo di controllo: stesso schema dell'algoritmo di Luhn (somma delle cifre in posizione dispari
 * più il doppio, ridotto di 9 se supera 9, di quelle in posizione pari; la somma deve essere multipla di 10).
 * Il formato non dice se la partita IVA è attiva: serve il servizio VIES o l'Agenzia delle Entrate.
 */

export type VatIssue = 'empty' | 'chars' | 'length' | 'progressive' | 'check';

export interface VatAnalysis {
  valid: boolean;
  /** Le sole cifre (senza prefisso IT). */
  digits: string;
  hadPrefix: boolean;
  issues: VatIssue[];
  expectedCheck?: number;
  progressive?: string;
  /** Codice dell'ufficio (cifre 8-10). */
  office?: string;
  /** Provincia dell'ufficio, solo per i codici storici 001-099 e se il numero è formalmente valido. */
  province?: { sigla: string; name: string };
}

export function normalizeVat(raw: string): { digits: string; hadPrefix: boolean } {
  const s = raw.toUpperCase().replace(/[\s\-. ]+/g, '');
  const m = /^IT(.*)$/.exec(s);
  return { digits: m ? m[1] : s, hadPrefix: !!m };
}

/** Cifra di controllo calcolata sulle prime dieci cifre. */
export function vatCheckDigit(first10: string): number {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const d = Number(first10[i]);
    if (i % 2 === 0) sum += d;
    else sum += d * 2 > 9 ? d * 2 - 9 : d * 2;
  }
  return (10 - (sum % 10)) % 10;
}

export function analyzeVat(raw: string): VatAnalysis {
  const { digits, hadPrefix } = normalizeVat(raw);
  const res: VatAnalysis = { valid: false, digits, hadPrefix, issues: [] };
  if (!digits) {
    res.issues.push('empty');
    return res;
  }
  if (!/^\d+$/.test(digits)) {
    res.issues.push('chars');
    return res;
  }
  if (digits.length !== 11) {
    res.issues.push('length');
    return res;
  }
  res.progressive = digits.slice(0, 7);
  res.office = digits.slice(7, 10);
  if (/^0+$/.test(res.progressive)) res.issues.push('progressive');
  res.expectedCheck = vatCheckDigit(digits.slice(0, 10));
  if (res.expectedCheck !== Number(digits[10])) res.issues.push('check');
  res.valid = res.issues.length === 0;
  const o = VAT_OFFICES[res.office];
  if (res.valid && o) res.province = { sigla: o[0], name: o[1] };
  return res;
}
