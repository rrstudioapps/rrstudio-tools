// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Formati di codice a barre, validazione del contenuto, cifra di controllo e piano per la generazione in blocco. Logica pura. */

export type BarcodeFormat = 'EAN13' | 'EAN8' | 'UPC' | 'ITF14' | 'ITF' | 'CODE128' | 'CODE39' | 'codabar' | 'MSI' | 'pharmacode';

export interface FormatInfo {
  id: BarcodeFormat;
  /** Nome mostrato. */
  label: string;
  /** Cifre da digitare per i formati con cifra di controllo (la cifra mancante si calcola). */
  digits?: readonly number[];
  /** Esempio valido. */
  example: string;
  /** Chiave del dizionario con la descrizione del contenuto ammesso. */
  hintKey: string;
}

export const FORMATS: readonly FormatInfo[] = [
  { id: 'EAN13', label: 'EAN-13', digits: [12, 13], example: '590123412345', hintKey: 'bc.hint.EAN13' },
  { id: 'EAN8', label: 'EAN-8', digits: [7, 8], example: '9638507', hintKey: 'bc.hint.EAN8' },
  { id: 'UPC', label: 'UPC-A', digits: [11, 12], example: '03600029145', hintKey: 'bc.hint.UPC' },
  { id: 'CODE128', label: 'Code 128', example: 'rrstudio-2026', hintKey: 'bc.hint.CODE128' },
  { id: 'CODE39', label: 'Code 39', example: 'CODE-39', hintKey: 'bc.hint.CODE39' },
  { id: 'ITF14', label: 'ITF-14', digits: [13, 14], example: '1234567890123', hintKey: 'bc.hint.ITF14' },
  { id: 'ITF', label: 'ITF (Interleaved 2 of 5)', example: '123456', hintKey: 'bc.hint.ITF' },
  { id: 'codabar', label: 'Codabar', example: 'A123456A', hintKey: 'bc.hint.codabar' },
  { id: 'MSI', label: 'MSI', example: '1234567', hintKey: 'bc.hint.MSI' },
  { id: 'pharmacode', label: 'Pharmacode', example: '1234', hintKey: 'bc.hint.pharmacode' },
];

export function formatInfo(id: BarcodeFormat): FormatInfo {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

export const MAX_BULK = 300;
export const MAX_LENGTH = 80;

export type BarcodeError = 'empty' | 'digits' | 'length' | 'check' | 'chars' | 'range' | 'tooLong' | 'even';

export type Normalized =
  | { ok: true; value: string; /** Cifra di controllo, se il formato ne ha una calcolata dallo strumento. */ checkDigit: string | null; /** La cifra è stata aggiunta (non c'era nel testo digitato). */ added: boolean }
  | { ok: false; error: BarcodeError; /** Per l'errore 'check': la cifra che sarebbe corretta. */ expected?: string; /** Cifre ammesse per l'errore 'length'. */ lengths?: readonly number[] };

/** Cifra di controllo GTIN/EAN/UPC (modulo 10, pesi 3 e 1 a partire dall'ultima cifra dei dati). */
export function gtinCheckDigit(data: string): string {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const digit = data.charCodeAt(data.length - 1 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
}

/** La stringa di cifre ha una cifra di controllo GTIN corretta? */
export function hasValidGtin(digits: string): boolean {
  return digits.length >= 2 && gtinCheckDigit(digits.slice(0, -1)) === digits.slice(-1);
}

const CODE39_RE = /^[0-9A-Z\-. $/+%]+$/;
const CODABAR_RE = /^[A-D][0-9\-$:./+]+[A-D]$/;

/** Controlla e prepara il contenuto per il formato scelto (aggiunge la cifra di controllo dove manca). */
export function normalizeInput(format: BarcodeFormat, raw: string): Normalized {
  const text = raw.replace(/[\r\n]+/g, '');
  const info = formatInfo(format);
  if (text.trim() === '' && format !== 'CODE128') return { ok: false, error: 'empty' };
  if (text === '') return { ok: false, error: 'empty' };
  if (text.length > MAX_LENGTH) return { ok: false, error: 'tooLong' };

  if (info.digits) {
    const t = text.replace(/[\s-]/g, '');
    if (t === '') return { ok: false, error: 'empty' };
    if (!/^[0-9]+$/.test(t)) return { ok: false, error: 'digits' };
    const [short, full] = info.digits;
    if (t.length !== short && t.length !== full) return { ok: false, error: 'length', lengths: info.digits };
    if (t.length === short) {
      const cd = gtinCheckDigit(t);
      return { ok: true, value: t + cd, checkDigit: cd, added: true };
    }
    const expected = gtinCheckDigit(t.slice(0, -1));
    if (expected !== t.slice(-1)) return { ok: false, error: 'check', expected };
    return { ok: true, value: t, checkDigit: t.slice(-1), added: false };
  }

  switch (format) {
    case 'CODE128':
      if (!/^[\x00-\x7f]+$/.test(text)) return { ok: false, error: 'chars' };
      return { ok: true, value: text, checkDigit: null, added: false };
    case 'CODE39': {
      const t = text.toUpperCase();
      if (!CODE39_RE.test(t)) return { ok: false, error: 'chars' };
      return { ok: true, value: t, checkDigit: null, added: false };
    }
    case 'ITF': {
      const t = text.replace(/\s/g, '');
      if (!/^[0-9]+$/.test(t)) return { ok: false, error: 'digits' };
      if (t.length % 2 !== 0) return { ok: false, error: 'even' };
      return { ok: true, value: t, checkDigit: null, added: false };
    }
    case 'codabar': {
      const t = text.replace(/\s/g, '').toUpperCase();
      if (!CODABAR_RE.test(t)) return { ok: false, error: 'chars' };
      return { ok: true, value: t, checkDigit: null, added: false };
    }
    case 'MSI': {
      const t = text.replace(/\s/g, '');
      if (!/^[0-9]+$/.test(t)) return { ok: false, error: 'digits' };
      return { ok: true, value: t, checkDigit: null, added: false };
    }
    case 'pharmacode': {
      const t = text.replace(/\s/g, '');
      if (!/^[0-9]+$/.test(t)) return { ok: false, error: 'digits' };
      const n = Number(t);
      if (n < 3 || n > 131070) return { ok: false, error: 'range' };
      return { ok: true, value: String(n), checkDigit: null, added: false };
    }
    default:
      return { ok: true, value: text, checkDigit: null, added: false };
  }
}

// ---- generazione in blocco ----

export interface BulkEntry {
  /** Numero di riga (da 1) nell'elenco originale. */
  line: number;
  input: string;
  result: Normalized;
  /** Nome del file (senza estensione), solo per le righe valide. */
  name: string | null;
}

/** Nome di file sicuro derivato dal contenuto del codice. */
export function bulkFileName(value: string): string {
  const cleaned = value
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 40);
  return cleaned || 'codice';
}

/** Legge l'elenco (una voce per riga, righe vuote ignorate), valida ogni riga e assegna nomi di file unici. */
export function planBulk(format: BarcodeFormat, text: string): { entries: BulkEntry[]; tooMany: boolean } {
  const lines = text.split(/\r\n|\r|\n/);
  const entries: BulkEntry[] = [];
  const used = new Set<string>();
  let tooMany = false;
  lines.forEach((input, i) => {
    if (input.trim() === '') return;
    if (entries.length >= MAX_BULK) {
      tooMany = true;
      return;
    }
    const result = normalizeInput(format, input.trim());
    let name: string | null = null;
    if (result.ok) {
      const base = `${String(entries.length + 1).padStart(3, '0')}-${bulkFileName(result.value)}`;
      name = base;
      let n = 2;
      while (used.has(name)) name = `${base}-${n++}`;
      used.add(name);
    }
    entries.push({ line: i + 1, input: input.trim(), result, name });
  });
  return { entries, tooMany };
}
