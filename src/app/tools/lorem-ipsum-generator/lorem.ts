// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

export type Unit = 'paragraphs' | 'sentences' | 'words';
export type Format = 'text' | 'html';

export const LIMITS: Record<Unit, { min: number; max: number; default: number }> = {
  paragraphs: { min: 1, max: 100, default: 3 },
  sentences: { min: 1, max: 500, default: 5 },
  words: { min: 1, max: 5000, default: 50 },
};

/** La frase classica che apre quasi ogni Lorem ipsum (parole in minuscolo, con le virgole al loro posto). */
export const CLASSIC_SENTENCE =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

/** Le parole della frase classica, per cominciare "a parole" con lo stesso testo. */
const CLASSIC_WORDS = CLASSIC_SENTENCE.toLowerCase().replace(/[,.]/g, '').split(' ');

/** Vocabolario: il testo latino di Cicerone da cui deriva il Lorem ipsum (De finibus bonorum et malorum). */
export const VOCABULARY: readonly string[] = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in ' +
  'reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui ' +
  'officia deserunt mollit anim id est laborum at vero eos accusamus iusto odio dignissimos ducimus blanditiis praesentium ' +
  'voluptatum deleniti atque corrupti quos dolores quas molestias excepturi occaecati cupiditate provident similique mollitia ' +
  'animi perspiciatis unde omnis iste natus error voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ' +
  'ab illo inventore veritatis quasi architecto beatae vitae dicta explicabo nemo ipsam quia voluptas aspernatur aut odit fugit ' +
  'consequuntur magni ratione sequi nesciunt neque porro quisquam dolorem adipisci numquam eius modi tempora incidunt magnam ' +
  'quaerat minima nostrum exercitationem ullam corporis suscipit laboriosam aliquid commodi consequatur autem vel eum iure quam ' +
  'nihil molestiae illum quo'
)
  .split(' ')
  .filter((w, i, all) => all.indexOf(w) === i);

// ---------- generatore pseudo-casuale con seme ----------

/** Funzione hash di una stringa in un intero a 32 bit (xmur3). */
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Generatore deterministico (mulberry32): stesso seme, stessa sequenza, su qualsiasi browser. Restituisce numeri in [0, 1). */
export function createRng(seed: string | number): () => number {
  let a = hashSeed(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seme casuale (numero a 32 bit come testo) preso dal generatore crittografico del browser. */
export function randomSeed(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0]);
}

// ---------- testo ----------

type Rng = () => number;

function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pickWord(rng: Rng, prev: string | undefined): string {
  for (;;) {
    const w = VOCABULARY[Math.floor(rng() * VOCABULARY.length)];
    if (w !== prev) return w;
  }
}

function capitalize(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** Una frase di 5-15 parole, con zero, una o due virgole nelle frasi più lunghe. */
export function sentence(rng: Rng): string {
  const len = int(rng, 5, 15);
  const words: string[] = [];
  for (let i = 0; i < len; i++) words.push(pickWord(rng, words[i - 1]));
  const commaAfter = new Set<number>();
  if (len >= 8) {
    const n = rng() < 0.6 ? 1 : len >= 12 && rng() < 0.5 ? 2 : 0;
    for (let k = 0; k < n; k++) {
      const pos = int(rng, 2, len - 3);
      // niente virgole attaccate tra loro
      if (!commaAfter.has(pos) && !commaAfter.has(pos - 1) && !commaAfter.has(pos + 1)) commaAfter.add(pos);
    }
  }
  const text = words.map((w, i) => (commaAfter.has(i) ? w + ',' : w)).join(' ');
  return capitalize(text) + '.';
}

function paragraph(rng: Rng, first: boolean, classic: boolean): string {
  const n = int(rng, 4, 8);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(i === 0 && first && classic ? CLASSIC_SENTENCE : sentence(rng));
  return parts.join(' ');
}

export interface LoremOptions {
  unit: Unit;
  count: number;
  /** Comincia con «Lorem ipsum dolor sit amet…». */
  classicStart: boolean;
  format: Format;
  seed: string | number;
}

export function clampCount(unit: Unit, n: number): number {
  const { min, max, default: d } = LIMITS[unit];
  if (!Number.isFinite(n)) return d;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** Genera il testo. Con lo stesso seme e le stesse opzioni il risultato è sempre identico. */
export function generateLorem(o: LoremOptions): string {
  const rng = createRng(o.seed);
  const count = clampCount(o.unit, o.count);
  let blocks: string[];
  if (o.unit === 'paragraphs') {
    blocks = Array.from({ length: count }, (_, i) => paragraph(rng, i === 0, o.classicStart));
  } else if (o.unit === 'sentences') {
    const list = Array.from({ length: count }, (_, i) => (i === 0 && o.classicStart ? CLASSIC_SENTENCE : sentence(rng)));
    blocks = [list.join(' ')];
  } else {
    const words: string[] = [];
    if (o.classicStart) words.push(...CLASSIC_WORDS.slice(0, count));
    while (words.length < count) words.push(pickWord(rng, words[words.length - 1]));
    blocks = [capitalize(words.join(' '))];
  }
  if (o.format === 'html') return blocks.map((b) => `<p>${b}</p>`).join('\n');
  return blocks.join('\n\n');
}

/** Conta parole e caratteri del testo generato (senza i tag <p>). */
export function textStats(text: string): { words: number; chars: number } {
  const plain = text.replace(/<\/?p>/g, '');
  const words = plain.trim() === '' ? 0 : plain.trim().split(/\s+/).length;
  return { words, chars: plain.replace(/\s+/g, ' ').trim().length };
}
