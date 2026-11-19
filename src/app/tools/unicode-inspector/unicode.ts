// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Ispettore Unicode: logica pura, senza tabelle grandi. Il nome Unicode è dato solo per i caratteri ASCII,
 * gli invisibili e gli spazi più comuni, le sillabe Hangul e gli ideogrammi CJK; per gli altri restano
 * categoria generale (da \p{…}) e blocco (da un elenco dei blocchi principali).
 */

export type InvisibleKind = 'zerowidth' | 'bidi' | 'space' | 'format' | 'control' | 'tag';

/** Invisibili e spazi particolari: code point → nome e tipo. */
const SPECIAL: Record<number, [string, InvisibleKind]> = {
  0x00ad: ['SOFT HYPHEN', 'format'],
  0x00a0: ['NO-BREAK SPACE', 'space'],
  0x034f: ['COMBINING GRAPHEME JOINER', 'format'],
  0x061c: ['ARABIC LETTER MARK', 'bidi'],
  0x115f: ['HANGUL CHOSEONG FILLER', 'format'],
  0x1160: ['HANGUL JUNGSEONG FILLER', 'format'],
  0x1680: ['OGHAM SPACE MARK', 'space'],
  0x180e: ['MONGOLIAN VOWEL SEPARATOR', 'format'],
  0x2000: ['EN QUAD', 'space'],
  0x2001: ['EM QUAD', 'space'],
  0x2002: ['EN SPACE', 'space'],
  0x2003: ['EM SPACE', 'space'],
  0x2004: ['THREE-PER-EM SPACE', 'space'],
  0x2005: ['FOUR-PER-EM SPACE', 'space'],
  0x2006: ['SIX-PER-EM SPACE', 'space'],
  0x2007: ['FIGURE SPACE', 'space'],
  0x2008: ['PUNCTUATION SPACE', 'space'],
  0x2009: ['THIN SPACE', 'space'],
  0x200a: ['HAIR SPACE', 'space'],
  0x200b: ['ZERO WIDTH SPACE', 'zerowidth'],
  0x200c: ['ZERO WIDTH NON-JOINER', 'zerowidth'],
  0x200d: ['ZERO WIDTH JOINER', 'zerowidth'],
  0x200e: ['LEFT-TO-RIGHT MARK', 'bidi'],
  0x200f: ['RIGHT-TO-LEFT MARK', 'bidi'],
  0x2028: ['LINE SEPARATOR', 'space'],
  0x2029: ['PARAGRAPH SEPARATOR', 'space'],
  0x202a: ['LEFT-TO-RIGHT EMBEDDING', 'bidi'],
  0x202b: ['RIGHT-TO-LEFT EMBEDDING', 'bidi'],
  0x202c: ['POP DIRECTIONAL FORMATTING', 'bidi'],
  0x202d: ['LEFT-TO-RIGHT OVERRIDE', 'bidi'],
  0x202e: ['RIGHT-TO-LEFT OVERRIDE', 'bidi'],
  0x202f: ['NARROW NO-BREAK SPACE', 'space'],
  0x205f: ['MEDIUM MATHEMATICAL SPACE', 'space'],
  0x2060: ['WORD JOINER', 'zerowidth'],
  0x2061: ['FUNCTION APPLICATION', 'format'],
  0x2062: ['INVISIBLE TIMES', 'format'],
  0x2063: ['INVISIBLE SEPARATOR', 'format'],
  0x2064: ['INVISIBLE PLUS', 'format'],
  0x2066: ['LEFT-TO-RIGHT ISOLATE', 'bidi'],
  0x2067: ['RIGHT-TO-LEFT ISOLATE', 'bidi'],
  0x2068: ['FIRST STRONG ISOLATE', 'bidi'],
  0x2069: ['POP DIRECTIONAL ISOLATE', 'bidi'],
  0x3000: ['IDEOGRAPHIC SPACE', 'space'],
  0x3164: ['HANGUL FILLER', 'format'],
  0xfeff: ['ZERO WIDTH NO-BREAK SPACE (BOM)', 'zerowidth'],
  0xffa0: ['HALFWIDTH HANGUL FILLER', 'format'],
};

const C0_NAMES = [
  'NULL', 'START OF HEADING', 'START OF TEXT', 'END OF TEXT', 'END OF TRANSMISSION', 'ENQUIRY', 'ACKNOWLEDGE', 'BELL',
  'BACKSPACE', 'CHARACTER TABULATION', 'LINE FEED', 'LINE TABULATION', 'FORM FEED', 'CARRIAGE RETURN', 'SHIFT OUT',
  'SHIFT IN', 'DATA LINK ESCAPE', 'DEVICE CONTROL ONE', 'DEVICE CONTROL TWO', 'DEVICE CONTROL THREE',
  'DEVICE CONTROL FOUR', 'NEGATIVE ACKNOWLEDGE', 'SYNCHRONOUS IDLE', 'END OF TRANSMISSION BLOCK', 'CANCEL',
  'END OF MEDIUM', 'SUBSTITUTE', 'ESCAPE', 'INFORMATION SEPARATOR FOUR', 'INFORMATION SEPARATOR THREE',
  'INFORMATION SEPARATOR TWO', 'INFORMATION SEPARATOR ONE',
];

const ASCII_PUNCT: Record<number, string> = {
  0x20: 'SPACE', 0x21: 'EXCLAMATION MARK', 0x22: 'QUOTATION MARK', 0x23: 'NUMBER SIGN', 0x24: 'DOLLAR SIGN',
  0x25: 'PERCENT SIGN', 0x26: 'AMPERSAND', 0x27: 'APOSTROPHE', 0x28: 'LEFT PARENTHESIS', 0x29: 'RIGHT PARENTHESIS',
  0x2a: 'ASTERISK', 0x2b: 'PLUS SIGN', 0x2c: 'COMMA', 0x2d: 'HYPHEN-MINUS', 0x2e: 'FULL STOP', 0x2f: 'SOLIDUS',
  0x3a: 'COLON', 0x3b: 'SEMICOLON', 0x3c: 'LESS-THAN SIGN', 0x3d: 'EQUALS SIGN', 0x3e: 'GREATER-THAN SIGN',
  0x3f: 'QUESTION MARK', 0x40: 'COMMERCIAL AT', 0x5b: 'LEFT SQUARE BRACKET', 0x5c: 'REVERSE SOLIDUS',
  0x5d: 'RIGHT SQUARE BRACKET', 0x5e: 'CIRCUMFLEX ACCENT', 0x5f: 'LOW LINE', 0x60: 'GRAVE ACCENT',
  0x7b: 'LEFT CURLY BRACKET', 0x7c: 'VERTICAL LINE', 0x7d: 'RIGHT CURLY BRACKET', 0x7e: 'TILDE', 0x7f: 'DELETE',
};
const DIGITS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

/** Nome Unicode quando ricavabile senza tabelle grandi, altrimenti null. */
export function unicodeName(cp: number): string | null {
  if (SPECIAL[cp]) return SPECIAL[cp][0];
  if (cp < 0x20) return C0_NAMES[cp];
  if (ASCII_PUNCT[cp]) return ASCII_PUNCT[cp];
  if (cp >= 0x30 && cp <= 0x39) return 'DIGIT ' + DIGITS[cp - 0x30];
  if (cp >= 0x41 && cp <= 0x5a) return 'LATIN CAPITAL LETTER ' + String.fromCharCode(cp);
  if (cp >= 0x61 && cp <= 0x7a) return 'LATIN SMALL LETTER ' + String.fromCharCode(cp - 32);
  if (cp >= 0x80 && cp <= 0x9f) return 'CONTROL';
  if (cp >= 0xac00 && cp <= 0xd7a3) return 'HANGUL SYLLABLE';
  if ((cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x20000 && cp <= 0x2a6df)) {
    return 'CJK UNIFIED IDEOGRAPH-' + cp.toString(16).toUpperCase();
  }
  if (cp >= 0xfe00 && cp <= 0xfe0f) return 'VARIATION SELECTOR-' + (cp - 0xfe00 + 1);
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return 'REGIONAL INDICATOR SYMBOL LETTER ' + String.fromCharCode(65 + cp - 0x1f1e6);
  if (cp >= 0xe0020 && cp <= 0xe007e) return 'TAG ' + (ASCII_PUNCT[cp - 0xe0000] ?? String.fromCharCode(cp - 0xe0000)).toUpperCase();
  if (cp === 0xe007f) return 'CANCEL TAG';
  return null;
}

/** Tipo di invisibile/carattere particolare, null se normale. */
export function invisibleKind(cp: number): InvisibleKind | null {
  if (SPECIAL[cp]) return SPECIAL[cp][1];
  if (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) return 'control';
  if (cp === 0x7f || (cp >= 0x80 && cp <= 0x9f)) return 'control';
  if (cp >= 0xe0000 && cp <= 0xe007f) return 'tag';
  return null;
}

const CATEGORIES = ['Lu', 'Ll', 'Lt', 'Lm', 'Lo', 'Mn', 'Mc', 'Me', 'Nd', 'Nl', 'No', 'Pc', 'Pd', 'Ps', 'Pe', 'Pi', 'Pf', 'Po', 'Sm', 'Sc', 'Sk', 'So', 'Zs', 'Zl', 'Zp', 'Cc', 'Cf', 'Cs', 'Co'] as const;
export type GeneralCategory = (typeof CATEGORIES)[number] | 'Cn';
const CATEGORY_RX = CATEGORIES.map((c) => [c, new RegExp(`^\\p{${c}}$`, 'u')] as const);

/** Categoria generale Unicode (Lu, Ll, Nd, Zs…) di un code point; Cn se non assegnato. */
export function generalCategory(cp: number): GeneralCategory {
  const ch = String.fromCodePoint(cp);
  for (const [c, rx] of CATEGORY_RX) if (rx.test(ch)) return c;
  return 'Cn';
}

/** Blocchi Unicode principali: intervalli e nomi. Fuori elenco → null. */
const BLOCKS: readonly [number, number, string][] = [
  [0x0000, 0x007f, 'Basic Latin'], [0x0080, 0x00ff, 'Latin-1 Supplement'], [0x0100, 0x017f, 'Latin Extended-A'],
  [0x0180, 0x024f, 'Latin Extended-B'], [0x0250, 0x02af, 'IPA Extensions'], [0x02b0, 0x02ff, 'Spacing Modifier Letters'],
  [0x0300, 0x036f, 'Combining Diacritical Marks'], [0x0370, 0x03ff, 'Greek and Coptic'], [0x0400, 0x04ff, 'Cyrillic'],
  [0x0500, 0x052f, 'Cyrillic Supplement'], [0x0530, 0x058f, 'Armenian'], [0x0590, 0x05ff, 'Hebrew'],
  [0x0600, 0x06ff, 'Arabic'], [0x0900, 0x097f, 'Devanagari'], [0x0e00, 0x0e7f, 'Thai'], [0x1100, 0x11ff, 'Hangul Jamo'],
  [0x1e00, 0x1eff, 'Latin Extended Additional'], [0x1f00, 0x1fff, 'Greek Extended'], [0x2000, 0x206f, 'General Punctuation'],
  [0x2070, 0x209f, 'Superscripts and Subscripts'], [0x20a0, 0x20cf, 'Currency Symbols'], [0x2100, 0x214f, 'Letterlike Symbols'],
  [0x2150, 0x218f, 'Number Forms'], [0x2190, 0x21ff, 'Arrows'], [0x2200, 0x22ff, 'Mathematical Operators'],
  [0x2300, 0x23ff, 'Miscellaneous Technical'], [0x2500, 0x257f, 'Box Drawing'], [0x2580, 0x259f, 'Block Elements'],
  [0x25a0, 0x25ff, 'Geometric Shapes'], [0x2600, 0x26ff, 'Miscellaneous Symbols'], [0x2700, 0x27bf, 'Dingbats'],
  [0x3000, 0x303f, 'CJK Symbols and Punctuation'], [0x3040, 0x309f, 'Hiragana'], [0x30a0, 0x30ff, 'Katakana'],
  [0x3400, 0x4dbf, 'CJK Unified Ideographs Extension A'], [0x4e00, 0x9fff, 'CJK Unified Ideographs'],
  [0xac00, 0xd7af, 'Hangul Syllables'], [0xe000, 0xf8ff, 'Private Use Area'], [0xfb00, 0xfb4f, 'Alphabetic Presentation Forms'],
  [0xfe00, 0xfe0f, 'Variation Selectors'], [0xfe70, 0xfeff, 'Arabic Presentation Forms-B / Specials'],
  [0xff00, 0xffef, 'Halfwidth and Fullwidth Forms'], [0xfff0, 0xffff, 'Specials'],
  [0x1d400, 0x1d7ff, 'Mathematical Alphanumeric Symbols'], [0x1f100, 0x1f1ff, 'Enclosed Alphanumeric Supplement'],
  [0x1f300, 0x1f5ff, 'Miscellaneous Symbols and Pictographs'], [0x1f600, 0x1f64f, 'Emoticons'],
  [0x1f680, 0x1f6ff, 'Transport and Map Symbols'], [0x1f900, 0x1f9ff, 'Supplemental Symbols and Pictographs'],
  [0x20000, 0x2a6df, 'CJK Unified Ideographs Extension B'], [0xe0000, 0xe007f, 'Tags'],
];

/** Nome del blocco Unicode se tra quelli principali, altrimenti null. */
export function blockName(cp: number): string | null {
  for (const [a, b, n] of BLOCKS) if (cp >= a && cp <= b) return n;
  return null;
}

const SCRIPTS = ['Latin', 'Cyrillic', 'Greek', 'Arabic', 'Hebrew', 'Armenian', 'Devanagari', 'Thai', 'Han', 'Hiragana', 'Katakana', 'Hangul'] as const;
export type ScriptName = (typeof SCRIPTS)[number];
const SCRIPT_RX = SCRIPTS.map((s) => [s, new RegExp(`^\\p{Script=${s}}$`, 'u')] as const);

/** Sistema di scrittura (solo i principali); null per segni comuni, numeri, spazi e il resto. */
export function scriptOf(cp: number): ScriptName | null {
  if (cp < 0x41) return null;
  const ch = String.fromCodePoint(cp);
  for (const [s, rx] of SCRIPT_RX) if (rx.test(ch)) return s;
  return null;
}

/** Lettere cirilliche e greche che si confondono con lettere latine. */
export const HOMOGLYPHS: Readonly<Record<string, string>> = {
  // cirillico minuscolo
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y',
  'і': 'i', 'ј': 'j', 'ѕ': 's', 'һ': 'h', 'ԛ': 'q', 'ԝ': 'w', 'ԁ': 'd',
  // cirillico maiuscolo
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O',
  'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'І': 'I', 'Ј': 'J', 'Ѕ': 'S',
  // greco
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K',
  'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X',
  'ο': 'o', 'ν': 'v',
};

/** Gruppi di scritture che si mescolano normalmente (giapponese): non contano come mescolanza sospetta. */
const JAPANESE: ReadonlySet<ScriptName> = new Set(['Han', 'Hiragana', 'Katakana']);

/** Scritture presenti in una parola, con il giapponese riunito in un solo gruppo. */
function wordScripts(word: string): Set<string> {
  const out = new Set<string>();
  for (const ch of word) {
    const s = scriptOf(ch.codePointAt(0)!);
    if (s) out.add(JAPANESE.has(s) ? 'Japanese' : s);
  }
  return out;
}

export interface InspectedChar {
  /** Indice del grafema (cluster) a cui appartiene. */
  grapheme: number;
  char: string;
  cp: number;
  hex: string;
  name: string | null;
  category: GeneralCategory;
  block: string | null;
  script: ScriptName | null;
  utf8: string;
  utf16: string;
  entity: string;
  js: string;
  css: string;
  invisible: InvisibleKind | null;
  /** Lettera latina di cui è un possibile omoglifo (solo in parole con scritture miste o tutte di sosia). */
  homoglyphOf: string | null;
}

export interface Inspection {
  chars: InspectedChar[];
  graphemeCount: number;
  codePointCount: number;
  utf16Length: number;
  utf8Length: number;
  /** Scritture presenti, in ordine di comparsa. */
  scripts: string[];
  /** Parole con più scritture (sospette). */
  mixedWords: string[];
  invisibleCount: number;
  homoglyphCount: number;
  /** Vero se il testo era più lungo del limite e l'elenco è stato troncato. */
  truncated: boolean;
}

const NAMED_ENTITIES: Record<number, string> = {
  0x26: '&amp;', 0x3c: '&lt;', 0x3e: '&gt;', 0x22: '&quot;', 0xa0: '&nbsp;', 0xa9: '&copy;', 0xae: '&reg;',
  0xad: '&shy;', 0x2013: '&ndash;', 0x2014: '&mdash;', 0x2026: '&hellip;', 0x20ac: '&euro;', 0x2002: '&ensp;',
  0x2003: '&emsp;', 0x2009: '&thinsp;', 0x200c: '&zwnj;', 0x200d: '&zwj;', 0x200e: '&lrm;', 0x200f: '&rlm;',
};

const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');

/** Entità HTML: nome se è tra le più comuni, altrimenti numerica esadecimale. */
export function htmlEntity(cp: number): string {
  return NAMED_ENTITIES[cp] ?? `&#x${cp.toString(16).toUpperCase()};`;
}
/** Escape JavaScript: \uXXXX o \u{X}. */
export function jsEscape(cp: number): string {
  return cp <= 0xffff ? `\\u${hex4(cp)}` : `\\u{${cp.toString(16).toUpperCase()}}`;
}
/** Escape CSS: \X seguito da uno spazio (che chiude la sequenza). */
export function cssEscape(cp: number): string {
  return `\\${cp.toString(16).toUpperCase()} `;
}

/** Byte UTF-8 di un code point, in esadecimale separati da spazio (un surrogato isolato diventa EF BF BD). */
export function utf8Hex(cp: number): string {
  const s = cp >= 0xd800 && cp <= 0xdfff ? '\ufffd' : String.fromCodePoint(cp);
  return [...new TextEncoder().encode(s)].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}
/** Unità UTF-16 di un code point (due per i caratteri oltre U+FFFF). */
export function utf16Hex(cp: number): string {
  if (cp <= 0xffff) return hex4(cp);
  const v = cp - 0x10000;
  return hex4(0xd800 + (v >> 10)) + ' ' + hex4(0xdc00 + (v & 0x3ff));
}

/** Grafemi (cluster percepiti come un carattere) con Intl.Segmenter; ripiego sui code point. */
export function graphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return [...new Seg(undefined, { granularity: 'grapheme' }).segment(text)].map((x) => x.segment);
  return [...text];
}

/** Limite di caratteri analizzati (oltre, l'elenco è troncato ma i conteggi restano). */
export const MAX_INSPECTED = 3000;

/** Analizza un testo carattere per carattere. */
export function inspectText(text: string): Inspection {
  const gs = graphemes(text);
  const chars: InspectedChar[] = [];
  const scripts: string[] = [];
  let codePointCount = 0;
  let invisibleCount = 0;
  let homoglyphCount = 0;
  const mixedWords: string[] = [];

  // parole (sequenze senza spazi) con più scritture, per le segnalazioni di omoglifi
  const mixedSet = new Set<string>();
  const wordHomoglyph = new Map<string, boolean>();
  for (const w of text.split(/[\s\u00a0\u200b-\u200f\u2060\ufeff]+/)) {
    if (w === '') continue;
    const sc = wordScripts(w);
    const mixed = sc.size > 1;
    if (mixed && !mixedSet.has(w)) {
      mixedSet.add(w);
      mixedWords.push(w);
    }
    // parola tutta di sosia (es. «раураl» con lettere cirilliche): sospetta anche senza mescolanza
    const letters = [...w].filter((c) => /\p{L}/u.test(c));
    const allLookalike = letters.length >= 2 && letters.every((c) => c in HOMOGLYPHS) && sc.size === 1 && !sc.has('Latin');
    wordHomoglyph.set(w, mixed || allLookalike);
  }

  // per ogni code point, la parola in cui cade
  const wordAt = new Map<number, string>();
  const rx = /[^\s\u00a0\u200b-\u200f\u2060\ufeff]+/gu;
  for (let m = rx.exec(text); m; m = rx.exec(text)) {
    for (let i = m.index; i < m.index + m[0].length; i++) wordAt.set(i, m[0]);
  }

  let utf16Pos = 0;
  gs.forEach((g, gi) => {
    for (const ch of g) {
      codePointCount++;
      const cp = ch.codePointAt(0)!;
      const script = scriptOf(cp);
      if (script) {
        const label = JAPANESE.has(script) ? 'Japanese' : script;
        if (!scripts.includes(label)) scripts.push(label);
      }
      const invisible = invisibleKind(cp);
      if (invisible) invisibleCount++;
      const w = wordAt.get(utf16Pos);
      const homo = HOMOGLYPHS[ch] && w && wordHomoglyph.get(w) ? HOMOGLYPHS[ch] : null;
      if (homo) homoglyphCount++;
      if (chars.length < MAX_INSPECTED) {
        chars.push({
          grapheme: gi,
          char: ch,
          cp,
          hex: 'U+' + hex4(cp),
          name: unicodeName(cp),
          category: generalCategory(cp),
          block: blockName(cp),
          script,
          utf8: utf8Hex(cp),
          utf16: utf16Hex(cp),
          entity: htmlEntity(cp),
          js: jsEscape(cp),
          css: cssEscape(cp),
          invisible,
          homoglyphOf: homo,
        });
      }
      utf16Pos += ch.length;
    }
  });

  return {
    chars,
    graphemeCount: gs.length,
    codePointCount,
    utf16Length: text.length,
    utf8Length: new TextEncoder().encode(text).length,
    scripts,
    mixedWords,
    invisibleCount,
    homoglyphCount,
    truncated: codePointCount > MAX_INSPECTED,
  };
}

const EMOJI_RX = /\p{Extended_Pictographic}/u;

export interface CleanOptions {
  /** Tiene lo ZWJ e il selettore di variazione tra emoji (sequenze come 👨‍👩‍👧) e i tag di una bandiera. Predefinito: sì. */
  keepEmoji?: boolean;
}

/**
 * Rimuove i caratteri invisibili (zero-width, bidi, formato come soft hyphen, controlli tranne tab e a capo, tag)
 * e sostituisce gli spazi particolari (NBSP, spazi stretti, ideografico…) con uno spazio normale.
 * Con `keepEmoji` conserva lo ZWJ tra due emoji e i tag che seguono la bandiera nera 🏴.
 */
export function removeInvisibles(text: string, o: CleanOptions = {}): string {
  const keep = o.keepEmoji ?? true;
  const cps = [...text];
  let out = '';
  let afterBlackFlag = false;
  for (let i = 0; i < cps.length; i++) {
    const ch = cps[i];
    const cp = ch.codePointAt(0)!;
    const kind = invisibleKind(cp);
    if (cp === 0x1f3f4) afterBlackFlag = true;
    else if (!(cp >= 0xe0000 && cp <= 0xe007f)) afterBlackFlag = false;
    if (!kind) {
      out += ch;
      continue;
    }
    if (kind === 'space') {
      // gli spazi particolari diventano spazi normali; i separatori di riga/paragrafo diventano a capo
      out += cp === 0x2028 || cp === 0x2029 ? '\n' : ' ';
      continue;
    }
    if (keep && cp === 0x200d && i > 0 && i + 1 < cps.length && EMOJI_RX.test(cps[i - 1] === '\ufe0f' ? (cps[i - 2] ?? '') : cps[i - 1]) && EMOJI_RX.test(cps[i + 1])) {
      out += ch;
      continue;
    }
    if (keep && kind === 'tag' && afterBlackFlag) {
      out += ch;
      continue;
    }
  }
  return out;
}

/** Normalizzazione Unicode: NFC (composta) o NFKC (composta + compatibilità: ﬁ → fi, ² → 2, Ａ → A). */
export function normalizeText(text: string, form: 'NFC' | 'NFKC'): string {
  return text.normalize(form);
}
