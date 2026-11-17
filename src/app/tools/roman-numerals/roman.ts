// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Combinazione "linea sopra": moltiplica per mille la lettera che precede (vinculum). */
export const OVERLINE = '̅';

const PAIRS: readonly [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];
const VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
const CANONICAL = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/** Massimo senza e con vinculum. */
export const MAX_PLAIN = 3999;
export const MAX_EXTENDED = 3_999_999;

/** Forma canonica di 1–3999 (senza vinculum). */
function plain(n: number): string {
  let out = '';
  for (const [v, s] of PAIRS) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

/** Numero → numeri romani. null se fuori intervallo o non intero. Con `extended` fino a 3.999.999: le migliaia da 4000 in su portano la linea sopra. */
export function toRoman(n: number, extended = false): string | null {
  if (!Number.isInteger(n) || n < 1 || n > (extended ? MAX_EXTENDED : MAX_PLAIN)) return null;
  if (n <= MAX_PLAIN) return plain(n);
  const high = Math.floor(n / 1000);
  const low = n % 1000;
  const over = [...plain(high)].map((c) => c + OVERLINE).join('');
  return over + (low > 0 ? plain(low) : '');
}

export type RomanError = 'empty' | 'chars' | 'repeat' | 'repeatVLD' | 'subtract' | 'order' | 'needExtended';

export type RomanParse =
  | { ok: true; value: number }
  | { ok: false; error: RomanError; /** Forma corretta più probabile, se ricavabile. */ suggestion?: string; /** Frammento che ha causato l'errore. */ detail?: string };

/** Sottrazioni ammesse: I davanti a V e X, X davanti a L e C, C davanti a D e M. */
const SUBTRACT_OK = new Set(['IV', 'IX', 'XL', 'XC', 'CD', 'CM']);

/** Valore "permissivo" (regola della sottrazione davanti a una lettera maggiore), usato solo per suggerire la forma corretta. */
function lenientValue(s: string): number {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = VALUES[s[i]];
    const next = i + 1 < s.length ? VALUES[s[i + 1]] : 0;
    total += v < next ? -v : v;
  }
  return total;
}

/** Controlla una sequenza di lettere semplici (senza linea sopra) e spiega perché non è canonica. */
function diagnose(s: string): { error: RomanError; detail?: string } | null {
  if (CANONICAL.test(s) && s !== '') return null;
  const four = s.match(/(.)\1{3,}/);
  if (four) return { error: 'repeat', detail: four[0] };
  const vld = s.match(/([VLD]).*\1/);
  if (vld) return { error: 'repeatVLD', detail: vld[1] };
  for (let i = 0; i + 1 < s.length; i++) {
    if (VALUES[s[i]] < VALUES[s[i + 1]] && !SUBTRACT_OK.has(s[i] + s[i + 1])) return { error: 'subtract', detail: s[i] + s[i + 1] };
  }
  return { error: 'order' };
}

/** Numeri romani → numero, con errore descrittivo per le forme non canoniche (IIII, VX, IC, IIX…). */
export function fromRoman(input: string, extended = false): RomanParse {
  const s = input.trim().toUpperCase().replace(/\s+/g, '');
  if (s === '') return { ok: false, error: 'empty' };
  const m = s.match(/^((?:[IVXLCDM]̅)*)([IVXLCDM]*)$/);
  if (!m) return { ok: false, error: 'chars', detail: [...s].find((c) => !'IVXLCDM'.includes(c) && c !== OVERLINE) };
  const high = m[1].split(OVERLINE).join('');
  const low = m[2];
  if (high && !extended) return { ok: false, error: 'needExtended' };
  const parts = high ? [high, low] : [low];
  for (const p of parts) {
    if (p === '') continue;
    const d = diagnose(p);
    if (d) {
      const lv = lenientValue(p);
      // il suggerimento ha senso solo per le ripetizioni (IIII → IV); negli altri casi il valore è ambiguo
      const sugg = d.error === 'repeat' && lv >= 1 && lv <= MAX_PLAIN ? plain(lv) : undefined;
      return { ok: false, error: d.error, detail: d.detail, suggestion: sugg ? (p === high && high ? [...sugg].map((c) => c + OVERLINE).join('') + low : high ? high + sugg : sugg) : undefined };
    }
  }
  let value = 0;
  if (high) {
    const hv = lenientValue(high);
    if (hv > MAX_PLAIN) return { ok: false, error: 'order' };
    value = hv * 1000 + (low ? lenientValue(low) : 0);
    // sotto 4000 si scrive senza linea sopra; la parte bassa deve stare sotto mille
    if (low && lenientValue(low) >= 1000) return { ok: false, error: 'order', suggestion: toRoman(value, true) ?? undefined };
    if (value <= MAX_PLAIN) return { ok: false, error: 'order', suggestion: toRoman(value, true) ?? undefined };
  } else value = lenientValue(low);
  return { ok: true, value };
}
