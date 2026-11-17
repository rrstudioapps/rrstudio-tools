// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Alfabeto Morse: lettere, cifre, punteggiatura ITU (Raccomandazione ITU-R M.1677) e lettere accentate
 * (À/Å, Ä, È, É, Ö, Ü, Ñ, Ç, ß: estensioni diffuse, non tutte nella tabella ITU di base).
 * Il primo carattere con un dato codice è quello usato in decodifica.
 */
const TABLE: readonly [string, string][] = [
  ['A', '.-'], ['B', '-...'], ['C', '-.-.'], ['D', '-..'], ['E', '.'], ['F', '..-.'], ['G', '--.'], ['H', '....'],
  ['I', '..'], ['J', '.---'], ['K', '-.-'], ['L', '.-..'], ['M', '--'], ['N', '-.'], ['O', '---'], ['P', '.--.'],
  ['Q', '--.-'], ['R', '.-.'], ['S', '...'], ['T', '-'], ['U', '..-'], ['V', '...-'], ['W', '.--'], ['X', '-..-'],
  ['Y', '-.--'], ['Z', '--..'],
  ['0', '-----'], ['1', '.----'], ['2', '..---'], ['3', '...--'], ['4', '....-'], ['5', '.....'], ['6', '-....'],
  ['7', '--...'], ['8', '---..'], ['9', '----.'],
  ['.', '.-.-.-'], [',', '--..--'], ['?', '..--..'], ["'", '.----.'], ['!', '-.-.--'], ['/', '-..-.'],
  ['(', '-.--.'], [')', '-.--.-'], ['&', '.-...'], [':', '---...'], [';', '-.-.-.'], ['=', '-...-'],
  ['+', '.-.-.'], ['-', '-....-'], ['_', '..--.-'], ['"', '.-..-.'], ['$', '...-..-'], ['@', '.--.-.'],
  ['À', '.--.-'], ['Å', '.--.-'], ['Ä', '.-.-'], ['Æ', '.-.-'], ['È', '.-..-'], ['É', '..-..'], ['Ö', '---.'],
  ['Ø', '---.'], ['Ü', '..--'], ['Ñ', '--.--'], ['Ç', '-.-..'], ['ß', '...--..'],
];

const ENCODE = new Map<string, string>(TABLE);
const DECODE = new Map<string, string>();
for (const [ch, code] of TABLE) if (!DECODE.has(code)) DECODE.set(code, ch);

/** Elenco dei caratteri supportati (per la tabella di riferimento), senza i doppioni accentati. */
export const MORSE_TABLE: readonly [string, string][] = TABLE.filter(([c]) => !['Å', 'Æ', 'Ø'].includes(c));

/** Parole in codice: ogni parola è un elenco di lettere, ogni lettera una stringa di punti e linee. */
export type MorseWords = string[][];

export interface EncodeResult {
  words: MorseWords;
  /** Caratteri senza codice Morse (saltati). */
  unknown: string[];
}

/** Maiuscolo del carattere, con ripiego: lettera accentata non in tabella → base senza accento (ò → O non è ITU: la segnaliamo). */
function lookup(ch: string): string | undefined {
  const up = ch.toLocaleUpperCase('it');
  return ENCODE.get(up) ?? ENCODE.get(up.normalize('NFC'));
}

/** Testo → parole in codice. Gli a capo contano come spazio tra parole. */
export function textToWords(text: string): EncodeResult {
  const unknown: string[] = [];
  const words: MorseWords = [];
  for (const raw of text.normalize('NFC').split(/\s+/)) {
    if (raw === '') continue;
    const letters: string[] = [];
    for (const ch of raw) {
      const code = lookup(ch);
      if (code) letters.push(code);
      else if (!unknown.includes(ch)) unknown.push(ch);
    }
    if (letters.length) words.push(letters);
  }
  return { words, unknown };
}

export interface FormatOptions {
  dot: string;
  dash: string;
  /** Tra le lettere. */
  letterSep: string;
  /** Tra le parole. */
  wordSep: string;
}

export const DEFAULT_FORMAT: FormatOptions = { dot: '.', dash: '-', letterSep: ' ', wordSep: ' / ' };

/** Parole in codice → testo Morse con i simboli e i separatori scelti. */
export function formatMorse(words: MorseWords, o: FormatOptions = DEFAULT_FORMAT): string {
  const sym = (code: string) => [...code].map((c) => (c === '.' ? o.dot : o.dash)).join('');
  return words.map((w) => w.map(sym).join(o.letterSep)).join(o.wordSep);
}

/** Simboli tipografici comuni normalizzati a punto e linea. */
function canonical(s: string): string {
  return s.replace(/[•·∙●⋅]/g, '.').replace(/[—–−‒―]/g, '-');
}

/**
 * Testo Morse → parole in codice. Le parole si dividono con «/», con una barra verticale, con tre o più spazi
 * o con un a capo; le lettere con uno spazio (o più). Accetta anche • · e — – come punto e linea.
 */
export function parseMorse(input: string): MorseWords {
  const words: MorseWords = [];
  for (const line of canonical(input).split(/\r?\n/)) {
    for (const w of line.split(/\s*[/|]\s*|\s{3,}/)) {
      const letters = w.split(/\s+/).filter((t) => t !== '');
      if (letters.length) words.push(letters);
    }
  }
  return words;
}

export interface DecodeResult {
  text: string;
  /** Gruppi che non sono un carattere Morse noto (resi con «?»). */
  unknown: string[];
}

/** Parole in codice → testo (maiuscolo). */
export function wordsToText(words: MorseWords): DecodeResult {
  const unknown: string[] = [];
  const out = words.map((w) =>
    w
      .map((code) => {
        const ch = /^[.-]+$/.test(code) ? DECODE.get(code) : undefined;
        if (ch) return ch;
        if (!unknown.includes(code)) unknown.push(code);
        return '?';
      })
      .join(''),
  );
  return { text: out.join(' '), unknown };
}

/** Un segmento della riproduzione: acceso o spento per `ms` millisecondi. */
export interface Tone {
  on: boolean;
  ms: number;
}

/** Durata dell'unità (un punto) in ms secondo la regola PARIS: 1200 / WPM. */
export function unitMs(wpm: number): number {
  return 1200 / wpm;
}

/**
 * Sequenza di accensioni: punto = 1 unità, linea = 3, pausa tra i segni = 1, tra le lettere = 3, tra le parole = 7.
 * Le pause sono voci `on: false` consecutive già sommate (nessuna pausa in coda).
 */
export function morseTimeline(words: MorseWords, wpm: number): Tone[] {
  const u = unitMs(wpm);
  const out: Tone[] = [];
  const pause = (n: number) => {
    const last = out[out.length - 1];
    if (last && !last.on) last.ms += n * u;
    else if (last) out.push({ on: false, ms: n * u });
  };
  words.forEach((w, wi) => {
    if (wi > 0) pause(7);
    w.forEach((code, li) => {
      if (li > 0) pause(3);
      [...code].forEach((c, si) => {
        if (si > 0) pause(1);
        out.push({ on: true, ms: (c === '.' ? 1 : 3) * u });
      });
    });
  });
  return out;
}

/** Durata totale in ms. */
export function totalMs(tones: Tone[]): number {
  return tones.reduce((a, t) => a + t.ms, 0);
}
