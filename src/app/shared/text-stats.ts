// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

export interface TextStats {
  /** Caratteri (punti di codice Unicode, non unità UTF-16). */
  chars: number;
  /** Byte in UTF-8. */
  bytes: number;
}

/** Conta caratteri e byte UTF-8 di una stringa, senza allocare buffer. */
export function textStats(text: string): TextStats {
  let chars = 0;
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    chars++;
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const n = text.charCodeAt(i + 1);
      if (n >= 0xdc00 && n <= 0xdfff) {
        i++; // coppia surrogata: un carattere, 4 byte
        bytes += 4;
      } else bytes += 3;
    } else bytes += 3;
  }
  return { chars, bytes };
}

/** Dimensione leggibile (B, KB, MB) con separatore decimale della lingua. */
export function formatBytes(bytes: number, locale: string): string {
  const fmt = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${fmt(bytes / 1024)} KB`;
  return `${fmt(bytes / (1024 * 1024))} MB`;
}
