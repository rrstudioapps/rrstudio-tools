// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Cambio irrevocabile fissato dal Regolamento (CE) n. 2866/98: 1 euro = 1936,27 lire. */
export const RATE_NUM = 193627n;
export const RATE_DEN = 100n;
export const RATE = 1936.27;

/** Divisione intera arrotondata al più vicino, con la metà verso l'alto (regola dei Reg. CE 1103/97 e 974/98). */
function divRound(num: bigint, den: bigint): bigint {
  return (2n * num + den) / (2n * den);
}

/** Importo digitato → centesimi (hundredths) come BigInt, null se non valido o troppo grande. */
export function toHundredths(x: number): bigint | null {
  if (!Number.isFinite(x) || x < 0 || x > 1e12) return null;
  return BigInt(Math.round(x * 100));
}

export interface Conversion {
  /** Valore arrotondato in centesimi (euro) o in lire intere. */
  rounded: bigint;
  /** Valore non arrotondato con 4 decimali, in decimillesimi. */
  exact: bigint;
}

/**
 * Lire → euro. `hundredths` = lire × 100. Euro esatti = lire / 1936,27;
 * arrotondato al centesimo: restituisce i centesimi di euro e il valore esatto in decimillesimi di euro.
 */
export function lireToEuro(hundredths: bigint): Conversion {
  // euro = (h/100) / (193627/100) = h / 193627
  return { rounded: divRound(hundredths * 100n, RATE_NUM), exact: divRound(hundredths * 10000n, RATE_NUM) };
}

/**
 * Euro → lire. `hundredths` = euro × 100. Lire = euro × 1936,27;
 * arrotondato alla lira intera, con il valore esatto in centesimi di lira.
 */
export function euroToLire(hundredths: bigint): Conversion {
  // lire = (h/100) * (193627/100) = h * 193627 / 10000
  return { rounded: divRound(hundredths * RATE_NUM, 10000n), exact: divRound(hundredths * RATE_NUM, 100n) };
}

/** BigInt con `decimals` cifre decimali implicite → testo italiano con migliaia («1.234,56»). */
export function formatScaled(v: bigint, decimals: number, lang: 'it' | 'en' = 'it'): string {
  const neg = v < 0n;
  const s = (neg ? -v : v).toString().padStart(decimals + 1, '0');
  const int = s.slice(0, s.length - decimals).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'it' ? '.' : ',');
  const frac = decimals > 0 ? s.slice(s.length - decimals) : '';
  return (neg ? '-' : '') + int + (frac ? (lang === 'it' ? ',' : '.') + frac : '');
}

export interface Denomination {
  /** Valore in lire. */
  lire: number;
  /** Soggetto: solo per le banconote. */
  subject?: string;
  /** Anno di inizio dell'ultima serie. */
  year?: number;
}

/** Banconote dell'ultima serie in circolazione fino al 2001-2002 (soggetto dell'ultima emissione). */
export const BANKNOTES: readonly Denomination[] = [
  { lire: 1000, subject: 'Maria Montessori', year: 1990 },
  { lire: 2000, subject: 'Guglielmo Marconi', year: 1990 },
  { lire: 5000, subject: 'Vincenzo Bellini', year: 1985 },
  { lire: 10000, subject: 'Alessandro Volta', year: 1984 },
  { lire: 50000, subject: 'Gian Lorenzo Bernini', year: 1990 },
  { lire: 100000, subject: 'Caravaggio', year: 1994 },
  { lire: 500000, subject: 'Raffaello', year: 1997 },
];

/** Monete in circolazione negli ultimi anni della lira. */
export const COINS: readonly Denomination[] = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].map((lire) => ({ lire }));

/** Valore in euro di un taglio, arrotondato al centesimo. */
export function denominationEuro(lire: number): bigint {
  return lireToEuro(BigInt(lire) * 100n).rounded;
}
