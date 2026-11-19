// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

import { Base64Error, base64ToBytes, bytesToBase64 } from '../../shared/base64';

export { Base64Error, base64ToBytes, bytesToBase64 };

/** Codifica un testo in UTF-8 e poi in Base64. */
export function encodeText(text: string, urlSafe = false): string {
  return bytesToBase64(new TextEncoder().encode(text), urlSafe);
}

/** Testo UTF-8 valido oppure null (i byte non sono testo). */
export function bytesToText(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Vero se il testo decodificato contiene caratteri di controllo (tranne tab e a capo): quasi certamente binario. */
export function hasControlChars(text: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text);
}

export interface FileKind {
  mime: string;
  ext: string;
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'image/svg+xml': 'svg',
  'text/plain': 'txt',
  'text/html': 'html',
  'text/css': 'css',
  'text/csv': 'csv',
  'application/json': 'json',
};

/** Estensione di un tipo MIME ("bin" se sconosciuto). */
export function extensionForMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] ?? 'bin';
}

const startsWith = (b: Uint8Array, sig: number[], offset = 0) =>
  b.length >= offset + sig.length && sig.every((v, i) => b[offset + i] === v);

/** Riconosce png, jpg, gif, webp, pdf e zip dai primi byte. */
export function detectFileKind(bytes: Uint8Array): FileKind | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png' };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return { mime: 'image/gif', ext: 'gif' };
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return { mime: 'application/pdf', ext: 'pdf' };
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return { mime: 'application/zip', ext: 'zip' };
  return null;
}

export interface ParsedDataUrl {
  mime: string;
  bytes: Uint8Array;
}

const DATA_URL = /^\s*data:([^,;]*)((?:;[^,;]*)*),([\s\S]*)$/i;

/** True se la stringa inizia come un data URL. */
export function isDataUrl(input: string): boolean {
  return /^\s*data:/i.test(input);
}

/** Estrae tipo MIME e byte da un data URL (base64 o percent-encoded). */
export function parseDataUrl(input: string): ParsedDataUrl {
  const m = DATA_URL.exec(input);
  if (!m) throw new Base64Error('dataurl');
  const mime = (m[1] || 'text/plain').trim().toLowerCase();
  const isB64 = /;\s*base64\s*(;|$)/i.test(m[2]);
  if (isB64) return { mime, bytes: base64ToBytes(decodeURIComponentSafe(m[3])) };
  try {
    const raw = decodeURIComponent(m[3]);
    return { mime, bytes: new TextEncoder().encode(raw) };
  } catch {
    throw new Base64Error('dataurl');
  }
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Costruisce un data URL dai byte di un file. */
export function toDataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime || 'application/octet-stream'};base64,${bytesToBase64(bytes)}`;
}

export interface DecodeResult {
  bytes: Uint8Array;
  /** Tipo MIME dal data URL o dai magic bytes (null se sconosciuto). */
  mime: string | null;
  /** Testo UTF-8 mostrabile, oppure null se i dati sono binari. */
  text: string | null;
  /** Estensione suggerita per il download. */
  ext: string;
  /** Vero se il risultato va offerto come file (binario o data URL non testuale). */
  asFile: boolean;
}

/** Decodifica un input in decodifica: data URL oppure Base64 puro. */
export function decodeInput(input: string): DecodeResult {
  let bytes: Uint8Array;
  let mime: string | null = null;
  const fromDataUrl = isDataUrl(input);
  if (fromDataUrl) {
    const p = parseDataUrl(input);
    bytes = p.bytes;
    mime = p.mime;
  } else {
    bytes = base64ToBytes(input);
  }
  const kind = detectFileKind(bytes);
  if (kind && (!mime || mime === 'application/octet-stream')) mime = kind.mime;
  const decoded = bytesToText(bytes);
  const text = decoded !== null && !hasControlChars(decoded) ? decoded : null;
  const textMime = mime === null || mime.startsWith('text/') || mime === 'application/json';
  const showText = text !== null && textMime && !kind;
  return {
    bytes,
    mime,
    text: showText ? text : null,
    ext: kind?.ext ?? (mime ? extensionForMime(mime) : 'bin'),
    asFile: !showText || fromDataUrl,
  };
}
