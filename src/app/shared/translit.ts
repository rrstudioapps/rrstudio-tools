// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Lettere latine che non si scompongono in lettera + segno: sostituzione esplicita. */
const SPECIAL: Record<string, string> = {
  ß: 'ss', ẞ: 'SS', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE', ø: 'o', Ø: 'O', đ: 'd', Đ: 'D', ð: 'd', Ð: 'D',
  þ: 'th', Þ: 'Th', ł: 'l', Ł: 'L', ħ: 'h', Ħ: 'H', ı: 'i', İ: 'I', ĳ: 'ij', Ĳ: 'IJ', ŋ: 'ng', Ŋ: 'NG',
  ŧ: 't', Ŧ: 'T', ĸ: 'k', ŉ: "'n", ſ: 's', ƒ: 'f', ǆ: 'dz', ǉ: 'lj', ǌ: 'nj', ƿ: 'w', ȷ: 'j',
  '‘': "'", '’': "'", '‚': ',', '“': '"', '”': '"', '„': '"',
  '–': '-', '—': '-', '−': '-', '…': '...', ' ': ' ', ' ': ' ',
};
const SPECIAL_RE = new RegExp('[' + Object.keys(SPECIAL).join('') + ']', 'g');

/**
 * Riduce un testo ai caratteri ASCII togliendo gli accenti e traslitterando le lettere latine estese
 * (è → e, ß → ss, ø → o, ł → l, æ → ae, œ → oe, đ → d…). Gli altri alfabeti (cirillico, greco, CJK) non si toccano.
 */
export function transliterate(text: string): string {
  return text
    .replace(SPECIAL_RE, (c, offset: number, all: string) => {
      const r = SPECIAL[c];
      // un digrafo maiuscolo seguito da una minuscola resta "capitalizzato": Æsir → Aesir, non AEsir
      return r.length === 2 && r === r.toUpperCase() && /\p{Ll}/u.test(all[offset + 1] ?? '') ? r[0] + r[1].toLowerCase() : r;
    })
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .normalize('NFC');
}
