// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema } from '../../shared/share-state';
import { MAX_RULES, type Rule } from './find-replace-core';

const MAX_FIELD = 5000;
/** Ordine dei sette interruttori di una regola nella stringa di bit. */
const BITS = ['caseSensitive', 'wholeWord', 'g', 'm', 's', 'u', 'enabled'] as const;

/** Una regola diventa il testo JSON `[trova, sostituisci, "t"|"r", "0110101"]`. */
export function encodeRule(r: Rule): string {
  const flags = [r.caseSensitive, r.wholeWord, r.flags.g, r.flags.m, r.flags.s, r.flags.u, r.enabled];
  return JSON.stringify([r.find, r.replace, r.mode === 'regex' ? 'r' : 't', flags.map((b) => (b ? '1' : '0')).join('')]);
}

/** Legge una regola dal link; null se la forma non è quella attesa. */
export function decodeRule(item: string): Rule | null {
  try {
    const a: unknown = JSON.parse(item);
    if (!Array.isArray(a) || a.length !== 4) return null;
    const [find, replace, mode, bits] = a as unknown[];
    if (typeof find !== 'string' || typeof replace !== 'string' || find.length > MAX_FIELD || replace.length > MAX_FIELD) return null;
    if (mode !== 't' && mode !== 'r') return null;
    if (typeof bits !== 'string' || !/^[01]{7}$/.test(bits)) return null;
    const on = (k: (typeof BITS)[number]) => bits[BITS.indexOf(k)] === '1';
    return {
      find,
      replace,
      mode: mode === 'r' ? 'regex' : 'text',
      caseSensitive: on('caseSensitive'),
      wholeWord: on('wholeWord'),
      flags: { g: on('g'), m: on('m'), s: on('s'), u: on('u') },
      enabled: on('enabled'),
    };
  } catch {
    return null;
  }
}

/** Stato che finisce nel link: il testo e le regole (una stringa ciascuna). */
export const SHARE_SCHEMA: Schema = {
  text: { type: 'string', max: 100000 },
  rules: { type: 'strings', maxItems: MAX_RULES, maxLength: 2 * MAX_FIELD + 60, valid: (s) => decodeRule(s) !== null },
};
