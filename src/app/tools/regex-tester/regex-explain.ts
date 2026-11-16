// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Spiegazione a parole dei token di un'espressione regolare JavaScript (italiano e inglese).
 * Non è un parser completo: riconosce i costrutti comuni e, per il resto, mostra il testo com'è.
 */

export type ExplainLang = 'it' | 'en';

export interface ExplainItem {
  token: string;
  text: string;
  /** Profondità di annidamento dei gruppi, per il rientro. */
  depth: number;
}

type T = Record<ExplainLang, string>;

const CLASSES: Record<string, T> = {
  d: { it: 'una cifra (0-9)', en: 'a digit (0-9)' },
  D: { it: 'un carattere che non è una cifra', en: 'a character that is not a digit' },
  w: { it: 'una lettera ASCII, una cifra o il trattino basso', en: 'an ASCII letter, a digit or an underscore' },
  W: { it: 'un carattere che non è lettera ASCII, cifra o trattino basso', en: 'a character that is not an ASCII letter, digit or underscore' },
  s: { it: 'uno spazio bianco (spazio, tabulazione, a capo…)', en: 'a whitespace character (space, tab, newline…)' },
  S: { it: 'un carattere che non è uno spazio bianco', en: 'a non-whitespace character' },
  b: { it: 'un confine di parola', en: 'a word boundary' },
  B: { it: 'una posizione che non è un confine di parola', en: 'a position that is not a word boundary' },
  n: { it: 'un a capo', en: 'a newline' },
  r: { it: 'un ritorno a capo (CR)', en: 'a carriage return' },
  t: { it: 'una tabulazione', en: 'a tab' },
  f: { it: 'un avanzamento pagina', en: 'a form feed' },
  v: { it: 'una tabulazione verticale', en: 'a vertical tab' },
  '0': { it: 'il carattere nullo', en: 'the null character' },
};

const T_ANY: T = { it: 'un carattere qualsiasi (senza a capo, salvo il flag s)', en: 'any character (except newlines, unless the s flag is set)' };
const T_START: T = { it: "l'inizio del testo (o di ogni riga con il flag m)", en: 'the start of the text (or of each line with the m flag)' };
const T_END: T = { it: 'la fine del testo (o di ogni riga con il flag m)', en: 'the end of the text (or of each line with the m flag)' };
const T_ALT: T = { it: 'oppure', en: 'or' };

function quant(q: string, lazy: boolean, lang: ExplainLang): string {
  let base: string;
  if (q === '*') base = lang === 'it' ? 'zero o più volte' : 'zero or more times';
  else if (q === '+') base = lang === 'it' ? 'una o più volte' : 'one or more times';
  else if (q === '?') base = lang === 'it' ? 'opzionale (zero o una volta)' : 'optional (zero or one time)';
  else {
    const m = /^\{(\d+)(?:(,)(\d*))?\}$/.exec(q);
    const a = m ? +m[1] : 0;
    if (!m || !m[2]) base = lang === 'it' ? `esattamente ${a} volte` : `exactly ${a} times`;
    else if (m[3] === '') base = lang === 'it' ? `almeno ${a} volte` : `at least ${a} times`;
    else base = lang === 'it' ? `da ${a} a ${m[3]} volte` : `from ${a} to ${m[3]} times`;
  }
  if (!lazy) return base;
  return base + (lang === 'it' ? ', il meno possibile' : ', as few as possible');
}

function describeClass(body: string, negated: boolean, lang: ExplainLang): string {
  const parts: string[] = [];
  for (let i = 0; i < body.length; i++) {
    let c = body[i];
    if (c === '\\' && i + 1 < body.length) {
      const e = body[++i];
      const known = CLASSES[e];
      if (known && 'dDwWsS'.includes(e)) {
        parts.push(known[lang]);
        continue;
      }
      c = e === 'n' ? '↵' : e === 't' ? '⇥' : e;
    }
    if (body[i + 1] === '-' && i + 2 < body.length) {
      let hi = body[i + 2];
      let adv = 2;
      if (hi === '\\' && i + 3 < body.length) {
        hi = body[i + 3];
        adv = 3;
      }
      parts.push(`«${c}»-«${hi}»`);
      i += adv;
    } else parts.push(`«${c}»`);
  }
  const list = parts.join(', ');
  if (negated) return lang === 'it' ? `un carattere qualsiasi tranne: ${list}` : `any character except: ${list}`;
  return lang === 'it' ? `uno tra: ${list}` : `one of: ${list}`;
}

/** Scorre il pattern e restituisce un elemento per token. */
export function explainPattern(pattern: string, lang: ExplainLang): ExplainItem[] {
  const out: ExplainItem[] = [];
  let depth = 0;
  let i = 0;
  let literal = '';

  const flushLiteral = (): void => {
    if (!literal) return;
    out.push({ token: literal, text: lang === 'it' ? `il testo «${literal}»` : `the text “${literal}”`, depth });
    literal = '';
  };
  const push = (token: string, text: string, d = depth): void => {
    flushLiteral();
    out.push({ token, text, depth: d });
  };
  /** Quantificatore subito dopo il token appena scritto. */
  const quantifier = (): boolean => {
    const m = /^(\*|\+|\?|\{\d+(?:,\d*)?\})(\?)?/.exec(pattern.slice(i));
    if (!m) return false;
    push(m[0], quant(m[1], !!m[2], lang));
    i += m[0].length;
    return true;
  };

  while (i < pattern.length) {
    const c = pattern[i];
    // un quantificatore si applica all'ultimo carattere letterale, non a tutta la sequenza
    if ('*+?{'.includes(c)) {
      const q = /^(\*|\+|\?|\{\d+(?:,\d*)?\})(\?)?/.exec(pattern.slice(i));
      if (q) {
        if (literal.length > 1) {
          const last = Array.from(literal).pop() as string;
          literal = literal.slice(0, literal.length - last.length);
          flushLiteral();
          literal = last;
        }
        flushLiteral();
        quantifier();
        continue;
      }
    }
    if (c === '\\') {
      const n = pattern[i + 1];
      if (n === undefined) {
        push('\\', lang === 'it' ? 'una barra inversa a fine pattern (non valida)' : 'a trailing backslash (invalid)');
        i++;
      } else if (n === 'u' && /^\\u(\{[0-9a-fA-F]+\}|[0-9a-fA-F]{4})/.test(pattern.slice(i))) {
        const tok = /^\\u(\{[0-9a-fA-F]+\}|[0-9a-fA-F]{4})/.exec(pattern.slice(i))![0];
        push(tok, lang === 'it' ? 'il carattere Unicode ' + tok.slice(2) : 'the Unicode character ' + tok.slice(2));
        i += tok.length;
      } else if (n === 'x' && /^\\x[0-9a-fA-F]{2}/.test(pattern.slice(i))) {
        push(pattern.slice(i, i + 4), lang === 'it' ? 'il carattere con codice ' + pattern.slice(i + 2, i + 4) : 'the character with code ' + pattern.slice(i + 2, i + 4));
        i += 4;
      } else if ((n === 'p' || n === 'P') && pattern[i + 2] === '{') {
        const end = pattern.indexOf('}', i);
        const tok = end > 0 ? pattern.slice(i, end + 1) : pattern.slice(i);
        const what = tok.slice(3, -1);
        push(tok, n === 'p' ? (lang === 'it' ? `un carattere Unicode della proprietà ${what}` : `a Unicode character with property ${what}`) : lang === 'it' ? `un carattere Unicode senza la proprietà ${what}` : `a Unicode character without property ${what}`);
        i += tok.length;
      } else if (n === 'k' && pattern[i + 2] === '<') {
        const end = pattern.indexOf('>', i);
        const tok = end > 0 ? pattern.slice(i, end + 1) : pattern.slice(i);
        push(tok, lang === 'it' ? `lo stesso testo del gruppo «${tok.slice(3, -1)}»` : `the same text as group “${tok.slice(3, -1)}”`);
        i += tok.length;
      } else if (/[1-9]/.test(n)) {
        const m = /^\\(\d+)/.exec(pattern.slice(i))!;
        push(m[0], lang === 'it' ? `lo stesso testo del gruppo ${m[1]}` : `the same text as group ${m[1]}`);
        i += m[0].length;
      } else if (CLASSES[n]) {
        push('\\' + n, CLASSES[n][lang]);
        i += 2;
      } else {
        // carattere speciale protetto da una barra inversa: è letterale
        literal += n;
        i += 2;
      }
      continue;
    }
    if (c === '[') {
      let j = i + 1;
      const negated = pattern[j] === '^';
      if (negated) j++;
      const start = j;
      if (pattern[j] === ']') j++; // un ] iniziale è letterale solo fuori dalla modalità v: caso raro
      while (j < pattern.length && pattern[j] !== ']') j += pattern[j] === '\\' ? 2 : 1;
      const tok = pattern.slice(i, j + 1);
      push(tok, describeClass(pattern.slice(start, j), negated, lang));
      i = j + 1;
      continue;
    }
    if (c === '(') {
      flushLiteral();
      const rest = pattern.slice(i);
      let m: RegExpExecArray | null;
      let text: string;
      let token: string;
      if ((m = /^\(\?<([A-Za-z_$][\w$]*)>/.exec(rest))) {
        token = m[0];
        text = lang === 'it' ? `inizio del gruppo con nome «${m[1]}» (catturato)` : `start of the named group “${m[1]}” (captured)`;
      } else if (rest.startsWith('(?:')) {
        token = '(?:';
        text = lang === 'it' ? 'inizio di un gruppo non catturante' : 'start of a non-capturing group';
      } else if (rest.startsWith('(?=')) {
        token = '(?=';
        text = lang === 'it' ? 'guarda avanti: deve seguire (senza consumarlo)' : 'lookahead: must follow (without consuming it)';
      } else if (rest.startsWith('(?!')) {
        token = '(?!';
        text = lang === 'it' ? 'guarda avanti negativo: non deve seguire' : 'negative lookahead: must not follow';
      } else if (rest.startsWith('(?<=')) {
        token = '(?<=';
        text = lang === 'it' ? 'guarda indietro: deve precedere' : 'lookbehind: must precede';
      } else if (rest.startsWith('(?<!')) {
        token = '(?<!';
        text = lang === 'it' ? 'guarda indietro negativo: non deve precedere' : 'negative lookbehind: must not precede';
      } else {
        token = '(';
        text = lang === 'it' ? 'inizio di un gruppo catturante' : 'start of a capturing group';
      }
      push(token, text);
      depth++;
      i += token.length;
      continue;
    }
    if (c === ')') {
      flushLiteral();
      depth = Math.max(0, depth - 1);
      push(')', lang === 'it' ? 'fine del gruppo' : 'end of the group');
      i++;
      quantifier();
      continue;
    }
    if (c === '|') {
      push('|', T_ALT[lang]);
      i++;
      continue;
    }
    if (c === '.') {
      push('.', T_ANY[lang]);
      i++;
      continue;
    }
    if (c === '^') {
      push('^', T_START[lang]);
      i++;
      continue;
    }
    if (c === '$') {
      push('$', T_END[lang]);
      i++;
      continue;
    }
    literal += c;
    i++;
  }
  flushLiteral();
  return out;
}
