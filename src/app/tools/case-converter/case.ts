// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { transliterate } from '../../shared/translit';

export type CaseId =
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'screaming'
  | 'kebab'
  | 'train'
  | 'dot'
  | 'path'
  | 'titleEn'
  | 'titleIt'
  | 'sentence'
  | 'upper'
  | 'lower'
  | 'alternating';

export const CASE_IDS: readonly CaseId[] = [
  'camel',
  'pascal',
  'snake',
  'screaming',
  'kebab',
  'train',
  'dot',
  'path',
  'titleEn',
  'titleIt',
  'sentence',
  'upper',
  'lower',
  'alternating',
];

export interface CaseOptions {
  /** Ogni riga è convertita da sola (e dà una riga); altrimenti tutto il testo è un unico blocco. */
  perLine: boolean;
  /** Le sigle in maiuscolo (HTTP, XML) restano tali in camel/Pascal/Train, Title e Sentence. */
  keepAcronyms: boolean;
  /** Toglie accenti e traslittera le lettere latine estese prima di convertire. */
  stripAccents: boolean;
}

export const DEFAULT_OPTIONS: CaseOptions = { perLine: true, keepAcronyms: true, stripAccents: false };

// ---------- parole ----------

export interface Word {
  text: string;
  /** Sigla: almeno due lettere tutte maiuscole in un testo che ha anche minuscole. */
  acronym: boolean;
}

type Cls = 'U' | 'L' | 'D';

function cls(c: string): Cls | 'M' | 'S' | 'A' {
  if (/\p{Lu}|\p{Lt}/u.test(c)) return 'U';
  if (/\p{L}/u.test(c)) return 'L';
  if (/\p{N}/u.test(c)) return 'D';
  if (/\p{M}/u.test(c)) return 'M';
  if (c === "'" || c === '’') return 'A';
  return 'S';
}

const CODE_POINT = /[\s\S]/gu;

/**
 * Divide in parole: separatori (spazi, _ - . / …), passaggi da minuscola a maiuscola (camelCase),
 * da cifra a maiuscola, e sigle seguite da una parola (XMLHttp → XML + Http). Un apostrofo tra lettere resta nella parola.
 */
export function splitWords(text: string): Word[] {
  const chars = text.match(CODE_POINT) ?? [];
  const classes = chars.map(cls);
  const hasLower = classes.includes('L');
  const raw: string[] = [];
  let cur = '';
  let last: Cls | '' = '';
  const flush = (): void => {
    if (cur) raw.push(cur);
    cur = '';
    last = '';
  };
  for (let i = 0; i < chars.length; i++) {
    const k = classes[i];
    if (k === 'S') {
      flush();
    } else if (k === 'A') {
      const n = classes[i + 1];
      if (cur && (n === 'U' || n === 'L')) cur += chars[i];
      else flush();
    } else if (k === 'M') {
      cur += chars[i];
    } else {
      if (cur) {
        if (last === 'L' && k === 'U') flush();
        else if (last === 'D' && k === 'U' && /\p{Ll}/u.test(cur)) flush(); // version2Beta sì, H2O no
        else if (last === 'U' && k === 'U' && classes[i + 1] === 'L') flush();
      }
      cur += chars[i];
      last = k;
    }
  }
  flush();
  return raw.map((w) => ({
    text: w,
    acronym: hasLower && /^\p{Lu}{2,}$/u.test(w.replace(/\p{M}/gu, '')),
  }));
}

function capitalize(w: string): string {
  const cps: string[] = w.match(CODE_POINT) ?? [];
  const [first, ...rest] = cps;
  return first === undefined ? w : first.toUpperCase() + rest.join('').toLowerCase();
}

/** Parole per gli identificatori: senza apostrofi. */
function idWords(line: string): Word[] {
  return splitWords(line).map((w) => ({ ...w, text: w.text.replace(/['’]/g, '') })).filter((w) => w.text !== '');
}

const WORD_RE = /[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu;

// ---------- Title Case ----------

/** Articoli, congiunzioni e preposizioni brevi che in inglese restano minuscole (regola AP). */
const MINOR_EN = new Set('a an the and but or nor for yet so as at by in of off on per to via vs v'.split(' '));
/** Lo stesso per l'italiano, comprese le preposizioni articolate. */
const MINOR_IT = new Set(
  (
    'il lo la i gli le l un uno una e ed o od ma né se che di a da in con su per tra fra ' +
    'del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle ' +
    'nel nello nella nei negli nelle sul sullo sulla sui sugli sulle col coi'
  ).split(' '),
);

function isAcronymText(w: string): boolean {
  return /^\p{Lu}{2,}$/u.test(w);
}

function titleCase(line: string, lang: 'en' | 'it', o: CaseOptions): string {
  const minor = lang === 'en' ? MINOR_EN : MINOR_IT;
  const hasLower = /\p{Ll}/u.test(line);
  const matches = [...line.matchAll(WORD_RE)];
  let out = '';
  let pos = 0;
  matches.forEach((m, idx) => {
    const word = m[0];
    const start = m.index;
    const gap = line.slice(pos, start);
    out += gap;
    pos = start + word.length;
    const first = idx === 0;
    const last = idx === matches.length - 1;
    const afterBreak = /[:?!.…]["'’”»)\]]*\s/.test(gap) || gap.includes('\n');
    const force = first || last || afterBreak;
    out += titleWord(word, force, minor, lang, o.keepAcronyms && hasLower);
  });
  return out + line.slice(pos);
}

function titleWord(word: string, force: boolean, minor: ReadonlySet<string>, lang: 'en' | 'it', keepAcr: boolean): string {
  if (keepAcr && isAcronymText(word)) return word;
  const apos = /['’]/.exec(word);
  if (apos && lang === 'it' && apos.index > 0) {
    // elisione: l'amore → l'Amore, dell'arte → dell'Arte (il prefisso resta minuscolo, salvo a inizio titolo)
    const prefix = word.slice(0, apos.index + 1);
    const rest = word.slice(apos.index + 1);
    const p = force ? capitalize(prefix) : prefix.toLowerCase();
    return p + (keepAcr && isAcronymText(rest) ? rest : capitalize(rest));
  }
  const lower = word.toLowerCase();
  if (!force && minor.has(lower)) return lower;
  return capitalize(word);
}

// ---------- Sentence case ----------

function sentenceCase(text: string, o: CaseOptions): string {
  const hasLower = /\p{Ll}/u.test(text);
  const matches = [...text.matchAll(WORD_RE)];
  let out = '';
  let pos = 0;
  matches.forEach((m, idx) => {
    const word = m[0];
    out += text.slice(pos, m.index);
    const gap = text.slice(pos, m.index);
    pos = m.index + word.length;
    const starts = idx === 0 || /[.!?…]["'’”»)\]]*\s/.test(gap);
    if (o.keepAcronyms && hasLower && isAcronymText(word)) out += word;
    else if (starts) out += capitalize(word);
    else out += word.toLowerCase();
  });
  return out + text.slice(pos);
}

// ---------- alternato ----------

function alternating(text: string): string {
  let i = 0;
  let out = '';
  for (const ch of text) {
    if (/\p{L}/u.test(ch)) out += i++ % 2 === 0 ? ch.toLowerCase() : ch.toUpperCase();
    else out += ch;
  }
  return out;
}

// ---------- API ----------

function convertLine(line: string, id: CaseId, o: CaseOptions): string {
  switch (id) {
    case 'upper':
      return line.toUpperCase();
    case 'lower':
      return line.toLowerCase();
    case 'alternating':
      return alternating(line);
    case 'sentence':
      return sentenceCase(line, o);
    case 'titleEn':
      return titleCase(line, 'en', o);
    case 'titleIt':
      return titleCase(line, 'it', o);
    default:
      break;
  }
  const words = idWords(line);
  const cap = (w: Word): string => (o.keepAcronyms && w.acronym ? w.text : capitalize(w.text));
  const low = (w: Word): string => w.text.toLowerCase();
  switch (id) {
    case 'camel':
      return words.map((w, i) => (i === 0 ? low(w) : cap(w))).join('');
    case 'pascal':
      return words.map(cap).join('');
    case 'snake':
      return words.map(low).join('_');
    case 'screaming':
      return words.map((w) => w.text.toUpperCase()).join('_');
    case 'kebab':
      return words.map(low).join('-');
    case 'train':
      return words.map(cap).join('-');
    case 'dot':
      return words.map(low).join('.');
    case 'path':
      return words.map(low).join('/');
    default:
      return line;
  }
}

/** Converte il testo nella forma richiesta (riga per riga o come blocco unico). */
export function convertCase(text: string, id: CaseId, opts: CaseOptions = DEFAULT_OPTIONS): string {
  const src = opts.stripAccents ? transliterate(text) : text;
  const normalized = src.replace(/\r\n?/g, '\n');
  if (opts.perLine) return normalized.split('\n').map((l) => convertLine(l, id, opts)).join('\n');
  // blocco unico: gli identificatori diventano una sola riga; i casi di testo mantengono gli a capo
  return convertLine(normalized, id, opts);
}
