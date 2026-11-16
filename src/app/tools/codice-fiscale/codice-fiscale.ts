// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Codice fiscale delle persone fisiche: calcolo e verifica.
 * Regole: DM 23 dicembre 1976 (Ministero delle Finanze) e successive circolari dell'Agenzia delle Entrate
 * (omocodia: circolare n. 14/E del 1° giugno 2007). Il codice calcolato è quello "teorico": quello vero lo
 * assegna l'Agenzia delle Entrate, che in caso di omocodia ne cambia alcuni caratteri.
 */
import type { Place, PlacesIndex } from './places';

export type Sex = 'M' | 'F';

/** Lettere dei mesi: gennaio=A ... dicembre=T (mancano I, F, G, N, O, Q, U, V, Z). */
export const MONTH_LETTERS = 'ABCDEHLMPRST';
/** Sostituzione delle cifre nell'omocodia: 0..9 → L M N P Q R S T U V. */
export const OMOCODIA_LETTERS = 'LMNPQRSTUV';
/** Posizioni (da 0) delle sette cifre che l'omocodia può sostituire: anno (2), giorno (2), codice catastale (3). */
export const NUMERIC_POSITIONS = [6, 7, 9, 10, 12, 13, 14] as const;

const ODD: Record<string, number> = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const SPECIAL: Record<string, string> = { ß: 'SS', æ: 'AE', œ: 'OE', ø: 'O', đ: 'D', ł: 'L', ð: 'D', þ: 'TH' };

/** Solo lettere A-Z maiuscole: toglie accenti, apostrofi, spazi, trattini e ogni altro carattere. */
export function lettersOnly(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ßæœøđłðþ]/g, (c) => SPECIAL[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

const isVowel = (c: string): boolean => 'AEIOU'.includes(c);

function split(letters: string): { cons: string; vowels: string } {
  let cons = '';
  let vowels = '';
  for (const c of letters) {
    if (isVowel(c)) vowels += c;
    else cons += c;
  }
  return { cons, vowels };
}

/** Tre caratteri del cognome: consonanti, poi vocali, poi X. */
export function surnameCode(surname: string): string {
  const { cons, vowels } = split(lettersOnly(surname));
  return (cons + vowels + 'XXX').slice(0, 3);
}

/** Tre caratteri del nome: con 4 o più consonanti si usano la 1ª, la 3ª e la 4ª; altrimenti come il cognome. */
export function nameCode(name: string): string {
  const { cons, vowels } = split(lettersOnly(name));
  if (cons.length >= 4) return cons[0] + cons[2] + cons[3];
  return (cons + vowels + 'XXX').slice(0, 3);
}

/** Carattere di controllo (16º) calcolato sui primi 15 caratteri. */
export function checkChar(first15: string): string {
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const c = first15[i];
    if (i % 2 === 0) sum += ODD[c];
    else sum += /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65;
  }
  return String.fromCharCode(65 + (sum % 26));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isRealDate(year: number, month: number, day: number): boolean {
  return Number.isInteger(year) && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export interface CfInput {
  surname: string;
  name: string;
  sex: Sex;
  year: number;
  month: number;
  day: number;
  /** Codice catastale del comune o codice Z dello Stato estero. */
  placeCode: string;
}

export interface CfParts {
  surname: string;
  name: string;
  year: string;
  month: string;
  day: string;
  place: string;
  check: string;
}

export type CfComputeError = 'surname' | 'name' | 'sex' | 'date' | 'place';

export type CfComputeResult =
  | { ok: true; code: string; parts: CfParts }
  | { ok: false; errors: CfComputeError[] };

const PLACE_RE = /^[A-Z]\d{3}$/;

export function computeCodiceFiscale(input: CfInput): CfComputeResult {
  const errors: CfComputeError[] = [];
  if (!lettersOnly(input.surname)) errors.push('surname');
  if (!lettersOnly(input.name)) errors.push('name');
  if (input.sex !== 'M' && input.sex !== 'F') errors.push('sex');
  if (!(input.year >= 1800 && input.year <= 2999) || !isRealDate(input.year, input.month, input.day)) errors.push('date');
  const place = input.placeCode.trim().toUpperCase();
  if (!PLACE_RE.test(place)) errors.push('place');
  if (errors.length) return { ok: false, errors };

  const parts: Omit<CfParts, 'check'> = {
    surname: surnameCode(input.surname),
    name: nameCode(input.name),
    year: String(input.year % 100).padStart(2, '0'),
    month: MONTH_LETTERS[input.month - 1],
    day: String(input.day + (input.sex === 'F' ? 40 : 0)).padStart(2, '0'),
    place,
  };
  const first15 = parts.surname + parts.name + parts.year + parts.month + parts.day + parts.place;
  const check = checkChar(first15);
  return { ok: true, code: first15 + check, parts: { ...parts, check } };
}

/** Normalizza un codice incollato: toglie spazi e simboli, maiuscolo. */
export function normalizeCode(s: string): string {
  return s.toUpperCase().replace(/[\s\-.,_/]+/g, '');
}

/** Cifre sostituite da lettere (omocodia): riporta la lettera alla cifra, lascia stare il resto. */
function digitOf(c: string): string | null {
  if (/\d/.test(c)) return c;
  const i = OMOCODIA_LETTERS.indexOf(c);
  return i === -1 ? null : String(i);
}

/** I codici omocodici possibili (livelli 1-7, da destra verso sinistra) di un codice valido, con il controllo ricalcolato. */
export function omocodiaVariants(code: string): string[] {
  const base = normalizeCode(code);
  if (base.length !== 16) return [];
  const chars = base.slice(0, 15).split('');
  for (const p of NUMERIC_POSITIONS) {
    const d = digitOf(chars[p]);
    if (d === null) return [];
    chars[p] = d;
  }
  const out: string[] = [];
  for (let level = 1; level <= NUMERIC_POSITIONS.length; level++) {
    const c = [...chars];
    for (const p of NUMERIC_POSITIONS.slice(-level)) c[p] = OMOCODIA_LETTERS[Number(c[p])];
    const first15 = c.join('');
    out.push(first15 + checkChar(first15));
  }
  return out;
}

export type CfIssue =
  | 'empty'
  | 'length'
  | 'is-vat'
  | 'chars'
  | 'surname'
  | 'name'
  | 'year'
  | 'month'
  | 'day'
  | 'date'
  | 'place'
  | 'check';

export interface BirthDate {
  year: number;
  month: number;
  day: number;
}

export interface CfAnalysis {
  /** Valido formalmente: lunghezza, struttura e carattere di controllo. */
  valid: boolean;
  code: string;
  issues: CfIssue[];
  /** Carattere di controllo atteso (se il codice ha 16 caratteri e la parte iniziale è ben formata). */
  expectedCheck?: string;
  sex?: Sex;
  /** Data più plausibile (l'ultima non nel futuro) e, se l'altro secolo è possibile, l'alternativa. */
  birth?: BirthDate;
  birthAlt?: BirthDate;
  placeCode?: string;
  /** Luoghi con quel codice (vuoto se l'elenco non è caricato o il codice non c'è). */
  places?: Place[];
  /** Numero di caratteri del codice che sono lettere al posto di cifre (0 = non omocodico). */
  omocodiaLevel: number;
  /** Le lettere-cifra non sono le ultime n da destra, come le assegna l'Agenzia delle Entrate. */
  omocodiaNonStandard: boolean;
  /** Il codice con le cifre originali (senza omocodia) e il suo carattere di controllo. */
  baseCode?: string;
}

const STRUCT_LETTERS = /^[A-Z]{6}/;

/**
 * Analizza un codice fiscale. `today` serve a scegliere il secolo più plausibile (deve essere passato per
 * i test); `places` è facoltativo: senza elenco il luogo non viene decodificato.
 */
export function analyzeCodiceFiscale(raw: string, today: Date = new Date(), places?: PlacesIndex | null): CfAnalysis {
  const code = normalizeCode(raw);
  const res: CfAnalysis = { valid: false, code, issues: [], omocodiaLevel: 0, omocodiaNonStandard: false };
  if (!code) {
    res.issues.push('empty');
    return res;
  }
  if (!/^[A-Z0-9]+$/.test(code)) {
    res.issues.push('chars');
    return res;
  }
  if (code.length !== 16) {
    res.issues.push(/^\d{11}$/.test(code) ? 'is-vat' : 'length');
    return res;
  }
  const issues = res.issues;
  if (!STRUCT_LETTERS.test(code.slice(0, 6))) {
    if (!/^[A-Z]{3}/.test(code)) issues.push('surname');
    if (!/^[A-Z]{3}/.test(code.slice(3))) issues.push('name');
  }
  // cifre (eventualmente sostituite da lettere) nelle sette posizioni numeriche
  const digits: Record<number, string> = {};
  let letterPositions: number[] = [];
  for (const p of NUMERIC_POSITIONS) {
    const d = digitOf(code[p]);
    if (d === null) {
      const field = p < 8 ? 'year' : p < 11 ? 'day' : 'place';
      if (!issues.includes(field)) issues.push(field);
    } else {
      digits[p] = d;
      if (!/\d/.test(code[p])) letterPositions.push(p);
    }
  }
  res.omocodiaLevel = letterPositions.length;
  if (letterPositions.length) {
    const rightmost = NUMERIC_POSITIONS.slice(-letterPositions.length);
    res.omocodiaNonStandard = !letterPositions.every((p, i) => p === rightmost[i]);
  }
  const monthIdx = MONTH_LETTERS.indexOf(code[8]);
  if (monthIdx === -1) issues.push('month');
  if (!/[A-Z]/.test(code[11])) issues.push('place');
  if (!/[A-Z]/.test(code[15])) issues.push('check');

  const expected = checkChar(code.slice(0, 15).replace(/[^A-Z0-9]/g, '')); // il codice è già alfanumerico
  if (!issues.includes('check') && expected !== code[15]) issues.push('check');
  if (/^[A-Z0-9]{15}$/.test(code.slice(0, 15))) res.expectedCheck = expected;

  // decodifica, anche se il carattere di controllo non torna (utile a capire l'errore)
  const hasDate = monthIdx !== -1 && [6, 7, 9, 10].every((p) => digits[p] !== undefined);
  if (hasDate) {
    const yy = Number(digits[6] + digits[7]);
    let dd = Number(digits[9] + digits[10]);
    let sex: Sex = 'M';
    if (dd > 40) {
      sex = 'F';
      dd -= 40;
    }
    const month = monthIdx + 1;
    // i due secoli possibili: 1900 e 2000 (un'età oltre i 100 anni è rara, ma il secolo scorso resta l'alternativa)
    const cands = [2000 + yy, 1900 + yy].filter((y) => isRealDate(y, month, dd));
    if (!cands.length) {
      issues.push(dd < 1 || dd > 31 ? 'day' : 'date');
    } else {
      const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const notFuture = cands.filter((y) => Date.UTC(y, month - 1, dd) <= t);
      const best = notFuture[0] ?? cands[cands.length - 1];
      // l'altro secolo è un'alternativa solo se quella data è già passata
      const alt = notFuture.find((y) => y !== best);
      res.sex = sex;
      res.birth = { year: best, month, day: dd };
      if (alt !== undefined) res.birthAlt = { year: alt, month, day: dd };
    }
  } else if (digits[9] !== undefined && digits[10] !== undefined) {
    const dd = Number(digits[9] + digits[10]);
    if ((dd < 1 || dd > 31) && (dd < 41 || dd > 71)) issues.push('day');
  }

  if ([12, 13, 14].every((p) => digits[p] !== undefined) && /[A-Z]/.test(code[11])) {
    res.placeCode = code[11] + digits[12] + digits[13] + digits[14];
    if (places) res.places = places.byCatastale(res.placeCode);
  }
  if (res.placeCode !== undefined && res.valid === false && !issues.length) res.valid = true;
  if (!issues.length) {
    res.valid = true;
    // codice senza omocodia: cifre originali e controllo ricalcolato
    if (res.omocodiaLevel) {
      const chars = code.slice(0, 15).split('');
      for (const p of NUMERIC_POSITIONS) chars[p] = digits[p];
      const first15 = chars.join('');
      res.baseCode = first15 + checkChar(first15);
    }
  }
  return res;
}
