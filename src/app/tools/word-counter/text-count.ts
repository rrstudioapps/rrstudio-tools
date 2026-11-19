// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Conteggi di testo e conversioni delle maiuscole. Logica pura, senza dipendenze dal DOM.
 * Caratteri = grafemi (una emoji, anche composta, o una lettera accentata contano 1);
 * parole e frasi usano Intl.Segmenter dove c'è, con un ripiego a espressioni regolari.
 */

export type StopLang = 'it' | 'en';
export type StopChoice = 'auto' | StopLang | 'none';

export const WORDS_PER_MINUTE_READING = 200;
export const WORDS_PER_MINUTE_SPEAKING = 130;

interface SegmenterLike {
  segment(input: string): Iterable<{ segment: string; isWordLike?: boolean }>;
}
type SegmenterCtor = new (locale?: string, options?: { granularity: 'grapheme' | 'word' | 'sentence' }) => SegmenterLike;

function segmenter(granularity: 'grapheme' | 'word' | 'sentence', locale: string): SegmenterLike | null {
  const Ctor = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
  if (!Ctor) return null;
  try {
    return new Ctor(locale, { granularity });
  } catch {
    return null;
  }
}

const WORD_RE = /[\p{L}\p{N}\p{M}]+(?:['’.\-][\p{L}\p{N}\p{M}]+)*/gu;
const HAS_ALNUM = /[\p{L}\p{N}]/u;

/** Parole del testo, nell'ordine in cui compaiono. */
export function words(text: string, locale = 'it'): string[] {
  if (!text) return [];
  const seg = segmenter('word', locale);
  if (seg) {
    const out: string[] = [];
    // una parola con trattino ("well-known") conta come una sola, come nel ripiego a espressione regolare
    let joinNext = false;
    let lastWasWord = false;
    for (const s of seg.segment(text)) {
      if (s.isWordLike) {
        if (joinNext && out.length) out[out.length - 1] += '-' + s.segment;
        else out.push(s.segment);
        joinNext = false;
        lastWasWord = true;
      } else {
        joinNext = s.segment === '-' && lastWasWord;
        lastWasWord = false;
      }
    }
    return out;
  }
  return text.match(WORD_RE) ?? [];
}

/** Numero di caratteri visibili (grafemi): emoji e lettere con accento contano 1. */
export function countChars(text: string): number {
  if (!text) return 0;
  const seg = segmenter('grapheme', 'en');
  if (seg) {
    let n = 0;
    for (const _ of seg.segment(text)) n++;
    return n;
  }
  return Array.from(text).length;
}

/** Caratteri senza spazi (spazi, tabulazioni e a capo esclusi). */
export function countCharsNoSpaces(text: string): number {
  return countChars(text.replace(/\s+/gu, ''));
}

export function countSentences(text: string, locale = 'it'): number {
  if (!text.trim()) return 0;
  const seg = segmenter('sentence', locale);
  if (seg) {
    let n = 0;
    for (const s of seg.segment(text)) if (HAS_ALNUM.test(s.segment)) n++;
    return n;
  }
  return text.split(/(?<=[.!?…]+)\s+/u).filter((s) => HAS_ALNUM.test(s)).length;
}

/** Paragrafi: blocchi di testo separati da una o più righe vuote. */
export function countParagraphs(text: string): number {
  return text.split(/\n\s*\n/u).filter((p) => p.trim() !== '').length;
}

/** Righe: 0 per il testo vuoto, altrimenti il numero di righe (anche quelle vuote). */
export function countLines(text: string): number {
  return text === '' ? 0 : text.split(/\r\n|\r|\n/u).length;
}

export interface TextCounts {
  words: number;
  chars: number;
  charsNoSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
}

export function countText(text: string, locale = 'it'): TextCounts {
  return {
    words: words(text, locale).length,
    chars: countChars(text),
    charsNoSpaces: countCharsNoSpaces(text),
    sentences: countSentences(text, locale),
    paragraphs: countParagraphs(text),
    lines: countLines(text),
  };
}

/** Secondi per leggere o pronunciare `wordCount` parole alla velocità data (parole al minuto). */
export function durationSeconds(wordCount: number, wordsPerMinute: number): number {
  return wordCount <= 0 ? 0 : Math.max(1, Math.round((wordCount / wordsPerMinute) * 60));
}

/** "45 s", "2 min", "2 min 30 s", "1 h 05 min". */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0 s';
  if (seconds < 60) return `${seconds} s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

// ---- Stopword (elenchi essenziali, in minuscolo) ----

const STOP_IT = new Set(
  (
    'a ad al allo alla alle agli ai all anche avere ha ho hai hanno abbiamo aveva avevano che chi ci cioè come con contro così col coi ' +
    'da dal dallo dalla dalle dagli dai dall dei del dello della delle degli dell di dove e ed è era erano essere fa fra gli ha i il in ' +
    'io la le lei lo loro lui ma me mi mia mie miei mio molto ne nei nel nello nella nelle negli nell no noi non nostro nostra o per però ' +
    'perché più poco può quale quali quando quanto quella quelle quelli quello questa queste questi questo qui se sei si sia siamo sono ' +
    'sta su sul sullo sulla sulle sugli sui sull suo sua suoi sue ti tra tu tua tue tuo tuoi tutti tutto un una uno un unʼ vi voi più ' +
    'già ancora quindi dunque oppure ogni altro altra altri altre stato stata stati state sarà sarebbe fatto fare faccio ' +
    'l d c s m t v nè né sì'
  ).split(/\s+/u),
);

const STOP_EN = new Set(
  (
    'a about above after again all also am an and any are aren\'t as at be because been before being below between both but by can ' +
    'can\'t could did do does doing don\'t down during each few for from further had has have having he her here hers him his how i if ' +
    'in into is isn\'t it it\'s its itself just me more most my myself no nor not now of off on once only or other our ours out over own ' +
    'same she should so some such than that that\'s the their theirs them then there these they this those through to too under until up ' +
    'very was we were what when where which while who whom why will with would you your yours yourself s t d ll re ve m'
  ).split(/\s+/u),
);

export function isStopword(word: string, lang: StopLang): boolean {
  const w = word.toLowerCase().replace(/’/gu, "'");
  return (lang === 'it' ? STOP_IT : STOP_EN).has(w);
}

/** Lingua prevalente del testo (italiano o inglese) in base alle parole funzione che contiene. */
export function detectLang(ws: readonly string[]): StopLang {
  let it = 0;
  let en = 0;
  for (const w of ws) {
    const l = w.toLowerCase().replace(/’/gu, "'");
    if (STOP_IT.has(l) && !STOP_EN.has(l)) it++;
    else if (STOP_EN.has(l) && !STOP_IT.has(l)) en++;
  }
  return en > it ? 'en' : 'it';
}

export interface FrequentWord {
  word: string;
  count: number;
  /** Percentuale sul totale delle parole del testo. */
  percent: number;
}

/**
 * Parole più frequenti (minuscole, senza numeri puri), escluse le stopword della lingua scelta.
 * Parità di conteggio: ordine alfabetico, così il risultato non cambia da un calcolo all'altro.
 */
export function topWords(ws: readonly string[], choice: StopChoice, limit = 10): { lang: StopLang | null; items: FrequentWord[] } {
  const lang: StopLang | null = choice === 'none' ? null : choice === 'auto' ? detectLang(ws) : choice;
  const freq = new Map<string, number>();
  for (const raw of ws) {
    const w = raw.toLowerCase().replace(/’/gu, "'");
    if (/^[\p{N}.\-',]+$/u.test(w)) continue;
    if ([...w].length < 2) continue;
    if (lang && isStopword(w, lang)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const total = ws.length || 1;
  const items = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count, percent: (count / total) * 100 }));
  return { lang, items };
}

// ---- Limiti ----

export interface CharLimit {
  id: string;
  chars: number;
}

/** Limiti di lunghezza utili; il conteggio è in caratteri (grafemi), indicativo per le piattaforme. */
export const LIMITS: readonly CharLimit[] = [
  { id: 'sms', chars: 160 },
  { id: 'x', chars: 280 },
  { id: 'meta', chars: 155 },
  { id: 'title', chars: 60 },
  { id: 'ig', chars: 2200 },
];

export interface LimitStatus {
  limit: number;
  used: number;
  /** Positivo: caratteri ancora disponibili; negativo: caratteri di troppo. */
  remaining: number;
  over: boolean;
  /** Frazione usata, limitata a 1 per la barra. */
  fraction: number;
}

export function limitStatus(used: number, limit: number): LimitStatus {
  const remaining = limit - used;
  return { limit, used, remaining, over: remaining < 0, fraction: limit > 0 ? Math.min(1, used / limit) : 0 };
}

// ---- Conversioni ----

export type Conversion = 'upper' | 'lower' | 'title' | 'sentence' | 'invert' | 'spaces' | 'blank';

export function toTitleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
}

export function toSentenceCase(text: string): string {
  const lower = text.toLowerCase();
  return lower.replace(/(^|[.!?…]\s+|\n\s*)(\p{L})/gu, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
}

export function invertCase(text: string): string {
  let out = '';
  for (const ch of text) {
    const up = ch.toUpperCase();
    const low = ch.toLowerCase();
    out += ch === up && ch !== low ? low : ch === low && ch !== up ? up : ch;
  }
  return out;
}

/** Spazi e tabulazioni ripetuti ridotti a uno, spazi a fine riga tolti; gli a capo restano. */
export function collapseSpaces(text: string): string {
  return text.replace(/[^\S\r\n]{2,}/gu, ' ').replace(/[^\S\r\n]+(?=\r?\n|$)/gu, '');
}

/** Righe vuote (anche con soli spazi) eliminate. */
export function removeBlankLines(text: string): string {
  return text
    .split(/\r\n|\r|\n/u)
    .filter((l) => l.trim() !== '')
    .join('\n');
}

export function convert(text: string, how: Conversion): string {
  switch (how) {
    case 'upper':
      return text.toUpperCase();
    case 'lower':
      return text.toLowerCase();
    case 'title':
      return toTitleCase(text);
    case 'sentence':
      return toSentenceCase(text);
    case 'invert':
      return invertCase(text);
    case 'spaces':
      return collapseSpaces(text);
    case 'blank':
      return removeBlankLines(text);
  }
}
