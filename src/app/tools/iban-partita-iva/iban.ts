// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * IBAN: normalizzazione, lunghezza per paese, controllo mod-97 (ISO 13616 / ISO 7064) e, per gli IBAN
 * italiani, scomposizione e verifica del CIN.
 *
 * Lunghezze e formati dei BBAN: registro IBAN della SWIFT ("IBAN Registry", rilasciato da SWIFT come
 * ente di registrazione ISO 13616), https://www.swift.com/standards/data-standards/iban-international-bank-account-number.
 * Notazione dei formati: "8n10n" = 8 cifre, poi 10 cifre; n = cifre, a = lettere maiuscole, c = lettere e cifre.
 * Paesi SEPA: elenco dei paesi dello schema SEPA dell'European Payments Council (EPC), indicativo.
 */

export interface IbanCountry {
  /** Lunghezza totale dell'IBAN. */
  length: number;
  /** Formato del BBAN (le cifre dopo i primi 4 caratteri), se noto. */
  bban?: string;
  sepa: boolean;
}

const S = true;
const N = false;
export const IBAN_COUNTRIES: Readonly<Record<string, IbanCountry>> = {
  AD: { length: 24, bban: '4n4n12c', sepa: S },
  AE: { length: 23, bban: '3n16n', sepa: N },
  AL: { length: 28, bban: '8n16c', sepa: N },
  AT: { length: 20, bban: '5n11n', sepa: S },
  AZ: { length: 28, bban: '4a20c', sepa: N },
  BA: { length: 20, bban: '3n3n8n2n', sepa: N },
  BE: { length: 16, bban: '3n7n2n', sepa: S },
  BG: { length: 22, bban: '4a4n2n8c', sepa: S },
  BH: { length: 22, bban: '4a14c', sepa: N },
  BR: { length: 29, bban: '8n5n10n1a1c', sepa: N },
  BY: { length: 28, bban: '4c4n16c', sepa: N },
  CH: { length: 21, bban: '5n12c', sepa: S },
  CR: { length: 22, bban: '4n14n', sepa: N },
  CY: { length: 28, bban: '3n5n16c', sepa: S },
  CZ: { length: 24, bban: '4n6n10n', sepa: S },
  DE: { length: 22, bban: '8n10n', sepa: S },
  DK: { length: 18, bban: '4n9n1n', sepa: S },
  DO: { length: 28, bban: '4c20n', sepa: N },
  EE: { length: 20, bban: '2n2n11n1n', sepa: S },
  EG: { length: 29, bban: '4n4n17n', sepa: N },
  ES: { length: 24, bban: '4n4n1n1n10n', sepa: S },
  FI: { length: 18, bban: '3n11n', sepa: S },
  FO: { length: 18, bban: '4n9n1n', sepa: N },
  FR: { length: 27, bban: '5n5n11c2n', sepa: S },
  GB: { length: 22, bban: '4a6n8n', sepa: S },
  GE: { length: 22, bban: '2a16n', sepa: N },
  GI: { length: 23, bban: '4a15c', sepa: S },
  GL: { length: 18, bban: '4n9n1n', sepa: N },
  GR: { length: 27, bban: '3n4n16c', sepa: S },
  GT: { length: 28, bban: '4c20c', sepa: N },
  HR: { length: 21, bban: '7n10n', sepa: S },
  HU: { length: 28, bban: '3n4n1n15n1n', sepa: S },
  IE: { length: 22, bban: '4a6n8n', sepa: S },
  IL: { length: 23, bban: '3n3n13n', sepa: N },
  IQ: { length: 23, bban: '4a3n12n', sepa: N },
  IS: { length: 26, bban: '4n2n6n10n', sepa: S },
  IT: { length: 27, bban: '1a5n5n12c', sepa: S },
  JO: { length: 30, bban: '4a4n18c', sepa: N },
  KW: { length: 30, bban: '4a22c', sepa: N },
  KZ: { length: 20, bban: '3n13c', sepa: N },
  LB: { length: 28, bban: '4n20c', sepa: N },
  LC: { length: 32, bban: '4a24c', sepa: N },
  LI: { length: 21, bban: '5n12c', sepa: S },
  LT: { length: 20, bban: '5n11n', sepa: S },
  LU: { length: 20, bban: '3n13c', sepa: S },
  LV: { length: 21, bban: '4a13c', sepa: S },
  LY: { length: 25, bban: '3n3n15n', sepa: N },
  MC: { length: 27, bban: '5n5n11c2n', sepa: S },
  MD: { length: 24, bban: '2c18c', sepa: N },
  ME: { length: 22, bban: '3n13n2n', sepa: N },
  MK: { length: 19, bban: '3n10c2n', sepa: N },
  MR: { length: 27, bban: '5n5n11n2n', sepa: N },
  MT: { length: 31, bban: '4a5n18c', sepa: S },
  MU: { length: 30, bban: '4a2n2n12n3n3a', sepa: N },
  NL: { length: 18, bban: '4a10n', sepa: S },
  NO: { length: 15, bban: '4n6n1n', sepa: S },
  PK: { length: 24, bban: '4a16c', sepa: N },
  PL: { length: 28, bban: '8n16n', sepa: S },
  PS: { length: 29, bban: '4a21c', sepa: N },
  PT: { length: 25, bban: '4n4n11n2n', sepa: S },
  QA: { length: 29, bban: '4a21c', sepa: N },
  RO: { length: 24, bban: '4a16c', sepa: S },
  RS: { length: 22, bban: '3n13n2n', sepa: N },
  RU: { length: 33, bban: '9n5n15c', sepa: N },
  SA: { length: 24, bban: '2n18c', sepa: N },
  SC: { length: 31, bban: '4a2n2n16n3a', sepa: N },
  SD: { length: 18, bban: '2n12n', sepa: N },
  SE: { length: 24, bban: '3n16n1n', sepa: S },
  SI: { length: 19, bban: '5n8n2n', sepa: S },
  SK: { length: 24, bban: '4n6n10n', sepa: S },
  SM: { length: 27, bban: '1a5n5n12c', sepa: S },
  ST: { length: 25, bban: '4n4n11n2n', sepa: N },
  SV: { length: 28, bban: '4a20n', sepa: N },
  TL: { length: 23, bban: '3n14n2n', sepa: N },
  TN: { length: 24, bban: '2n3n13n2n', sepa: N },
  TR: { length: 26, bban: '5n1n16c', sepa: N },
  UA: { length: 29, bban: '6n19c', sepa: N },
  VA: { length: 22, bban: '3n15n', sepa: S },
  VG: { length: 24, bban: '4a16n', sepa: N },
  XK: { length: 20, bban: '4n10n2n', sepa: N },
};

export type IbanIssue =
  | 'empty'
  | 'chars'
  | 'country-format'
  | 'country-unknown'
  | 'length'
  | 'check-format'
  | 'bban-format'
  | 'mod97'
  | 'cin';

export interface ItalianIban {
  cin: string;
  abi: string;
  cab: string;
  account: string;
  /** Il CIN calcolato su ABI, CAB e numero di conto. */
  expectedCin: string;
}

export interface IbanAnalysis {
  valid: boolean;
  /** Maiuscolo e senza spazi. */
  iban: string;
  /** A gruppi di quattro caratteri. */
  formatted: string;
  issues: IbanIssue[];
  country?: string;
  sepa?: boolean;
  expectedLength?: number;
  length: number;
  /** Posizione (da 1) del primo carattere non ammesso nel BBAN, se 'bban-format'. */
  badPosition?: number;
  /** Cifre di controllo (3º e 4º carattere) e se il mod-97 torna. */
  checkDigits?: string;
  mod97Ok?: boolean;
  it?: ItalianIban;
}

/** Toglie spazi, trattini, punti e l'eventuale etichetta "IBAN:", e porta in maiuscolo. */
export function normalizeIban(raw: string): string {
  return raw
    .replace(/^\s*iban\s*[:：]?/i, '')
    .replace(/[\s\-. ]+/g, '')
    .toUpperCase();
}

export function formatIban(iban: string): string {
  return iban.replace(/(.{4})(?=.)/g, '$1 ');
}

/** Resto della divisione per 97 dell'IBAN con le prime quattro cifre spostate in fondo e le lettere in numeri (A=10 ... Z=35). */
export function mod97(iban: string): number {
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem;
}

/** Cifre di controllo (2 caratteri) per un paese e un BBAN: serve solo ai test e alla documentazione. */
export function ibanCheckDigits(country: string, bban: string): string {
  const rem = mod97(country + '00' + bban);
  return String(98 - rem).padStart(2, '0');
}

const ODD: Record<string, number> = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

/** CIN (Codice di Controllo Interno) italiano: lettera calcolata su ABI + CAB + numero di conto (22 caratteri). */
export function italianCin(abiCabAccount: string): string {
  let sum = 0;
  [...abiCabAccount].forEach((c, i) => {
    sum += i % 2 === 0 ? ODD[c] : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65;
  });
  return String.fromCharCode(65 + (sum % 26));
}

/** Posizione (da 0) del primo carattere del BBAN che non rispetta il formato, oppure -1. */
export function bbanMismatch(bban: string, format: string): number {
  let pos = 0;
  for (const [, count, kind] of format.matchAll(/(\d+)([nac])/g)) {
    const re = kind === 'n' ? /\d/ : kind === 'a' ? /[A-Z]/ : /[A-Z0-9]/;
    for (let i = 0; i < Number(count); i++, pos++) {
      if (!re.test(bban[pos] ?? '')) return pos;
    }
  }
  return -1;
}

export function analyzeIban(raw: string): IbanAnalysis {
  const iban = normalizeIban(raw);
  const res: IbanAnalysis = { valid: false, iban, formatted: formatIban(iban), issues: [], length: iban.length };
  if (!iban) {
    res.issues.push('empty');
    return res;
  }
  if (!/^[A-Z0-9]+$/.test(iban)) {
    res.issues.push('chars');
    return res;
  }
  if (!/^[A-Z]{2}/.test(iban)) {
    res.issues.push('country-format');
    return res;
  }
  const country = iban.slice(0, 2);
  res.country = country;
  const spec = IBAN_COUNTRIES[country];
  if (!spec) {
    res.issues.push('country-unknown');
    return res;
  }
  res.sepa = spec.sepa;
  res.expectedLength = spec.length;
  if (iban.length !== spec.length) res.issues.push('length');
  if (iban.length >= 4) {
    res.checkDigits = iban.slice(2, 4);
    if (!/^\d{2}$/.test(res.checkDigits)) res.issues.push('check-format');
  } else if (!res.issues.includes('length')) res.issues.push('length');
  // formato del BBAN: solo con la lunghezza giusta, altrimenti l'errore è già la lunghezza
  if (!res.issues.length && spec.bban) {
    const bad = bbanMismatch(iban.slice(4), spec.bban);
    if (bad !== -1) {
      res.issues.push('bban-format');
      res.badPosition = bad + 5;
    }
  }
  if (!res.issues.includes('length') && !res.issues.includes('check-format')) {
    res.mod97Ok = mod97(iban) === 1;
    if (!res.mod97Ok) res.issues.push('mod97');
  }
  if (country === 'IT' && iban.length === 27 && /^[A-Z]\d{10}[A-Z0-9]{12}$/.test(iban.slice(4))) {
    const bban = iban.slice(4);
    const expectedCin = italianCin(bban.slice(1));
    res.it = { cin: bban[0], abi: bban.slice(1, 6), cab: bban.slice(6, 11), account: bban.slice(11), expectedCin };
    if (expectedCin !== bban[0]) res.issues.push('cin');
  }
  res.valid = res.issues.length === 0;
  return res;
}
