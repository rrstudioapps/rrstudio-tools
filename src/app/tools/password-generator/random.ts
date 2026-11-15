// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Sorgente di numeri casuali: riempie l'array con valori uniformi a 32 bit. */
export type RandomSource = (buf: Uint32Array<ArrayBuffer>) => void;

/** Unica sorgente di casualità usata dallo strumento: crypto.getRandomValues (CSPRNG del browser). */
export const cryptoSource: RandomSource = (buf) => {
  crypto.getRandomValues(buf);
};

const TWO_32 = 0x1_0000_0000;

/**
 * Intero uniforme in [0, max) senza bias (rejection sampling): si scartano i valori a 32 bit
 * che cadrebbero nell'ultimo "blocco" incompleto, così ogni resto ha la stessa probabilità.
 * Mai un modulo diretto su un valore qualsiasi.
 */
export function randomInt(max: number, src: RandomSource = cryptoSource): number {
  if (!Number.isInteger(max) || max < 1 || max > TWO_32) throw new RangeError('max fuori intervallo');
  if (max === 1) return 0;
  const limit = TWO_32 - (TWO_32 % max); // multiplo di max più grande contenuto in 2^32
  const buf = new Uint32Array(1);
  for (;;) {
    src(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

/** Elemento casuale (uniforme) di un array o di una stringa di simboli. */
export function randomChar(chars: string, src: RandomSource = cryptoSource): string {
  return chars[randomInt(chars.length, src)];
}
