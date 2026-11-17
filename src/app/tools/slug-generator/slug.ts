// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { transliterate } from '../../shared/translit';

export type Separator = '-' | '_' | '.';
export type StopLang = 'none' | 'it' | 'en' | 'both';

export interface SlugOptions {
  separator: Separator;
  lowercase: boolean;
  /** Lunghezza massima in caratteri; 0 = nessun limite. */
  maxLength: number;
  stopWords: StopLang;
}

export const DEFAULT_OPTIONS: SlugOptions = { separator: '-', lowercase: true, maxLength: 0, stopWords: 'none' };
export const MAX_LENGTH_LIMIT = 200;

/** Parole vuote italiane, già senza accenti (si confrontano dopo la traslitterazione). */
export const STOP_WORDS_IT: ReadonlySet<string> = new Set(
  (
    'a ad al allo alla ai agli alle anche che chi ci col come con cui da dal dallo dalla dai dagli dalle dei del dello della degli delle ' +
    'di dove e ed gli ha ho i il in io la le lei lo loro lui ma mi mia mie mio ne nei nel nello nella negli nelle noi non nostra nostro o od ' +
    'per piu quale quali quando quella quelle quelli quello questa queste questi questo se si sono su sul sullo sulla sui sugli sulle suo sua sue suoi miei nostri nostre vostri vostre ' +
    'tra fra tu tua tue tuo tuoi tutti tutto un una uno vi voi vostra vostro l d dell all dall nell sull quell quest c m t v gl'
  ).split(' '),
);

/** Parole vuote inglesi. */
export const STOP_WORDS_EN: ReadonlySet<string> = new Set(
  (
    'a an the and or but nor of to in on at by for with from as is are was were be been being am it its this that these those ' +
    'i you he she we they me my your his her our their them us not so if then than into onto over under about up out off via vs per s'
  ).split(' '),
);

/** Prefissi italiani che si elidono davanti a una vocale: l'amore, dell'arte, un'altra… */
const ELISION = new Set('l d un dell all dall nell sull quell quest c m t s v gl nient'.split(' '));

function stopSet(lang: StopLang): ReadonlySet<string> | null {
  if (lang === 'it') return STOP_WORDS_IT;
  if (lang === 'en') return STOP_WORDS_EN;
  if (lang === 'both') return new Set([...STOP_WORDS_IT, ...STOP_WORDS_EN]);
  return null;
}

/** Parole di un testo: ASCII alfanumerico, dopo la traslitterazione. */
export function slugWords(text: string, lowercase = true): string[] {
  let t = transliterate(text);
  // apostrofo: dopo un'elisione italiana separa (l'amore → l amore), altrimenti si toglie (don't → dont)
  t = t.replace(/([A-Za-z]+)'(?=[A-Za-z])/g, (_m, pre: string) => (ELISION.has(pre.toLowerCase()) ? pre + ' ' : pre));
  t = t.replace(/'/g, '');
  if (lowercase) t = t.toLowerCase();
  return t.split(/[^A-Za-z0-9]+/).filter((w) => w !== '');
}

/** Unisce le parole entro `max` caratteri senza spezzarne nessuna; se la prima è già troppo lunga, la taglia. */
export function joinWithin(words: string[], sep: string, max: number): string {
  const full = words.join(sep);
  if (max <= 0 || full.length <= max) return full;
  let out = '';
  for (const w of words) {
    const next = out === '' ? w : out + sep + w;
    if (next.length > max) break;
    out = next;
  }
  return out !== '' ? out : words[0].slice(0, max);
}

/** Slug di un testo (anche su più righe: gli a capo sono separatori). */
export function generateSlug(text: string, opts: SlugOptions = DEFAULT_OPTIONS): string {
  let words = slugWords(text, opts.lowercase);
  const stops = stopSet(opts.stopWords);
  if (stops) {
    const kept = words.filter((w) => !stops.has(w.toLowerCase()));
    if (kept.length > 0) words = kept; // un testo fatto solo di parole vuote non deve dare uno slug vuoto
  }
  return joinWithin(words, opts.separator, opts.maxLength);
}

export interface BulkOptions extends SlugOptions {
  /** Rende unici gli slug uguali aggiungendo -2, -3… */
  unique: boolean;
}

/** Uno slug per ogni riga; le righe vuote restano vuote. */
export function generateBulk(text: string, opts: BulkOptions): string[] {
  const seen = new Map<string, number>();
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      const slug = generateSlug(line, opts);
      if (!opts.unique || slug === '') return slug;
      const n = (seen.get(slug) ?? 0) + 1;
      seen.set(slug, n);
      if (n === 1) return slug;
      const suffix = opts.separator + n;
      let base = slug;
      if (opts.maxLength > 0 && base.length + suffix.length > opts.maxLength) {
        base = base.slice(0, Math.max(1, opts.maxLength - suffix.length)).replace(/[-_.]+$/, '');
      }
      return base + suffix;
    });
}

export function clampMaxLength(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_LENGTH_LIMIT, Math.floor(n));
}
