// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Cifrari classici: pura logica, solo lettere A–Z (maiuscole e minuscole); gli altri caratteri passano invariati. */

const A = 65;
const a = 97;

function shiftLetter(code: number, shift: number): number {
  if (code >= A && code <= A + 25) return A + (((code - A + shift) % 26) + 26) % 26;
  if (code >= a && code <= a + 25) return a + (((code - a + shift) % 26) + 26) % 26;
  return code;
}

/** Cesare: sposta ogni lettera di `shift` posizioni (anche negativo o oltre 26). */
export function caesar(text: string, shift: number): string {
  const n = Math.trunc(shift);
  let out = '';
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    out += c < 128 ? String.fromCharCode(shiftLetter(c, n)) : ch;
  }
  return out;
}

/** ROT13 è Cesare con spostamento 13 (cifra e decifra coincidono). */
export const rot13 = (text: string): string => caesar(text, 13);

/** ROT47: ruota i caratteri ASCII stampabili da «!» (33) a «~» (126) di 47 posizioni. */
export function rot47(text: string): string {
  let out = '';
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    out += c >= 33 && c <= 126 ? String.fromCharCode(33 + ((c - 33 + 47) % 94)) : ch;
  }
  return out;
}

/** Atbash: A↔Z, B↔Y… (cifra e decifra coincidono). */
export function atbash(text: string): string {
  let out = '';
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c >= A && c <= A + 25) out += String.fromCharCode(A + 25 - (c - A));
    else if (c >= a && c <= a + 25) out += String.fromCharCode(a + 25 - (c - a));
    else out += ch;
  }
  return out;
}

/** Chiave Vigenère ridotta alle sole lettere A–Z (gli accenti si tolgono), in numeri 0–25. */
export function vigenereKey(key: string): number[] {
  return [...key.normalize('NFD').toUpperCase()].filter((c) => c >= 'A' && c <= 'Z').map((c) => c.charCodeAt(0) - A);
}

/**
 * Vigenère: la chiave scorre solo sulle lettere del testo (spazi e segni non la fanno avanzare).
 * Con chiave vuota restituisce il testo invariato.
 */
export function vigenere(text: string, key: string, decrypt = false): string {
  const k = vigenereKey(key);
  if (k.length === 0) return text;
  let i = 0;
  let out = '';
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    const isLetter = (c >= A && c <= A + 25) || (c >= a && c <= a + 25);
    if (!isLetter) {
      out += ch;
      continue;
    }
    const s = k[i++ % k.length];
    out += String.fromCharCode(shiftLetter(c, decrypt ? -s : s));
  }
  return out;
}

/** Forza bruta su Cesare: i 25 spostamenti possibili (1–25) applicati al testo cifrato. */
export function caesarBruteForce(text: string): { shift: number; text: string }[] {
  return Array.from({ length: 25 }, (_, i) => ({ shift: i + 1, text: caesar(text, -(i + 1)) }));
}
