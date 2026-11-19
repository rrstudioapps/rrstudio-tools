// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Passaggio del risultato di uno strumento a un altro ("Invia a…"): tipi e mappa di compatibilità.
 * Logica pura (niente Angular): il servizio che tiene il contenuto in memoria è in `tool-handoff.ts`.
 */
export type HandoffKind = 'text' | 'json' | 'csv' | 'svg' | 'image' | 'files';

export interface HandoffPayload {
  kind: HandoffKind;
  /** Contenuto per i tipi testuali (text, json, csv, svg). */
  text?: string;
  /** File (con nome e mime) per i tipi image e files. */
  files?: File[];
  /** Id dello strumento di partenza. */
  from: string;
}

/**
 * Quali tipi accetta ciascuno strumento. Un contenuto `json`, `csv` o `svg` è anche testo: lo prendono
 * anche gli strumenti che dichiarano `text` (vedi `accepts`). Gli strumenti assenti non ricevono nulla.
 */
export const HANDOFF_ACCEPTS: Readonly<Record<string, readonly HandoffKind[]>> = {
  'json-formatter': ['json', 'text'],
  'json-viewer': ['json', 'text'],
  'json-query': ['json', 'text'],
  'json-diff': ['json', 'text'],
  'yaml-json-converter': ['json', 'text'],
  'csv-json-converter': ['csv', 'json', 'text'],
  base64: ['text'],
  'subnet-calculator': ['text'],
  'docker-run-to-compose': ['text'],
  'jwt-decoder': ['text'],
  'url-parser': ['text'],
  'color-converter': ['text'],
  'cron-expression': ['text'],
  'iban-partita-iva': ['text'],
  'codice-fiscale': ['text'],
  'curl-converter': ['text'],
  'timestamp-converter': ['text'],
  'certificate-decoder': ['text'],
  'roman-numerals': ['text'],
  'date-calculator': ['text'],
  'uuid-generator': ['text'],
  'svg-optimizer': ['svg'],
  'csv-dashboard': ['csv', 'files'],
  'file-encrypt': ['files'],
  'pdf-tools': ['files'],
  'pdf-sign': ['files'],
  'pdf-metadata': ['files'],
  'pdf-page-text': ['files'],
  'pdf-compress': ['files'],
  'pdf-crop': ['files'],
  'pdf-images': ['files'],
  'pdf-form': ['files'],
  'pdf-redact': ['files'],
  'pdf-protect': ['files'],
  'pdf-to-images': ['files'],
  'pdf-to-text': ['files'],
  'url-encode': ['text'],
  'hash-generator': ['text', 'files'],
  'hmac-generator': ['text'],
  'word-counter': ['text'],
  'statistics-calculator': ['csv', 'text'],
  'unicode-inspector': ['text'],
  'time-calculator': ['text'],
  'morse-code': ['text'],
  'classic-ciphers': ['text'],
  'find-replace': ['text'],
  'sort-lines': ['text'],
  'case-converter': ['text'],
  'html-entities': ['text'],
  'xml-formatter': ['text'],
  'xml-viewer': ['text'],
  'xml-diff': ['text'],
  'xml-to-csv': ['text'],
  'xml-json-converter': ['json', 'text'],
  'html-dom-viewer': ['text'],
  'yaml-viewer': ['text'],
  'yaml-csv-diff': ['text', 'csv'],
  'json-schema-xsd': ['text', 'json'],
  'schema-test-data': ['text', 'json'],
  'xsd-validator': ['text'],
  'sql-formatter': ['text'],
  'text-diff': ['text'],
  'markdown-editor': ['text'],
  'qr-code-generator': ['text'],
  'image-watermark': ['image', 'files'],
  'image-color-picker': ['image'],
  'svg-to-png': ['svg', 'image'],
  'image-crop': ['image'],
  'image-compressor': ['image'],
  'image-converter': ['image'],
  'exif-viewer': ['image'],
  'favicon-generator': ['image'],
  'images-to-pdf': ['image'],
  'qr-code-reader': ['image'],
};

/** Vero se lo strumento sa ricevere contenuti di quel tipo. */
export function accepts(toolId: string, kind: HandoffKind): boolean {
  const list = HANDOFF_ACCEPTS[toolId];
  if (!list) return false;
  if (list.includes(kind)) return true;
  return (kind === 'json' || kind === 'csv' || kind === 'svg') && list.includes('text');
}

/** Id degli strumenti a cui si può inviare un contenuto di quel tipo, escluso quello di partenza. Ordine: quello di `order`. */
export function handoffTargets(kind: HandoffKind, fromId: string, order: readonly string[]): string[] {
  return order.filter((id) => id !== fromId && accepts(id, kind));
}

/** Un payload è consegnabile se ha il contenuto che il suo tipo richiede. */
export function isValidPayload(p: HandoffPayload): boolean {
  if (p.kind === 'text' || p.kind === 'json' || p.kind === 'csv' || p.kind === 'svg') return typeof p.text === 'string';
  return Array.isArray(p.files) && p.files.length > 0;
}
