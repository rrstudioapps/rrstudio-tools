// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

// ---------- tabella delle entità con nome ----------

/** Latin-1: da U+00A0 in poi, in ordine (HTML 4). */
const LATIN1 =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest ' +
  'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig ' +
  'agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml';

/** Resto di HTML 4 (caratteri speciali, greco, simboli, frecce, matematica), come "nome:codice". */
const OTHERS =
  'quot:34 amp:38 lt:60 gt:62 OElig:338 oelig:339 Scaron:352 scaron:353 Yuml:376 fnof:402 circ:710 tilde:732 ' +
  'Alpha:913 Beta:914 Gamma:915 Delta:916 Epsilon:917 Zeta:918 Eta:919 Theta:920 Iota:921 Kappa:922 Lambda:923 Mu:924 Nu:925 Xi:926 Omicron:927 Pi:928 Rho:929 Sigma:931 Tau:932 Upsilon:933 Phi:934 Chi:935 Psi:936 Omega:937 ' +
  'alpha:945 beta:946 gamma:947 delta:948 epsilon:949 zeta:950 eta:951 theta:952 iota:953 kappa:954 lambda:955 mu:956 nu:957 xi:958 omicron:959 pi:960 rho:961 sigmaf:962 sigma:963 tau:964 upsilon:965 phi:966 chi:967 psi:968 omega:969 thetasym:977 upsih:978 piv:982 ' +
  'ensp:8194 emsp:8195 thinsp:8201 zwnj:8204 zwj:8205 lrm:8206 rlm:8207 ndash:8211 mdash:8212 lsquo:8216 rsquo:8217 sbquo:8218 ldquo:8220 rdquo:8221 bdquo:8222 dagger:8224 Dagger:8225 bull:8226 hellip:8230 permil:8240 prime:8242 Prime:8243 lsaquo:8249 rsaquo:8250 oline:8254 frasl:8260 euro:8364 ' +
  'image:8465 weierp:8472 real:8476 trade:8482 alefsym:8501 larr:8592 uarr:8593 rarr:8594 darr:8595 harr:8596 crarr:8629 lArr:8656 uArr:8657 rArr:8658 dArr:8659 hArr:8660 ' +
  'forall:8704 part:8706 exist:8707 empty:8709 nabla:8711 isin:8712 notin:8713 ni:8715 prod:8719 sum:8721 minus:8722 lowast:8727 radic:8730 prop:8733 infin:8734 ang:8736 and:8743 or:8744 cap:8745 cup:8746 int:8747 there4:8756 sim:8764 cong:8773 asymp:8776 ne:8800 equiv:8801 le:8804 ge:8805 sub:8834 sup:8835 nsub:8836 sube:8838 supe:8839 oplus:8853 otimes:8855 perp:8869 sdot:8901 ' +
  'lceil:8968 rceil:8969 lfloor:8970 rfloor:8971 lang:10216 rang:10217 loz:9674 spades:9824 clubs:9827 hearts:9829 diams:9830';

/** Nomi HTML5 comuni, solo per la decodifica. */
const EXTRA =
  'apos:39 AMP:38 LT:60 GT:62 QUOT:34 COPY:169 REG:174 Tab:9 NewLine:10 excl:33 num:35 dollar:36 percnt:37 lpar:40 rpar:41 ast:42 plus:43 comma:44 period:46 sol:47 colon:58 semi:59 equals:61 quest:63 commat:64 ' +
  'lsqb:91 lbrack:91 bsol:92 rsqb:93 rbrack:93 Hat:94 lowbar:95 grave:96 lcub:123 lbrace:123 verbar:124 vert:124 rcub:125 rbrace:125 check:10003 checkmark:10003 cross:10007 star:9734 starf:9733 bigstar:9733 phone:9742 female:9792 male:9794 ' +
  'hyphen:8208 dash:8208 half:189 euro:8364 nbsp:160 ZeroWidthSpace:8203 NoBreak:8288 hairsp:8202 numsp:8199 puncsp:8200 emsp13:8196 emsp14:8197 ' +
  'rightarrow:8594 leftarrow:8592 uparrow:8593 downarrow:8595 leftrightarrow:8596 le:8804 ge:8805 neq:8800 approx:8776 infintie:10717';

const NAME_TO_CP = new Map<string, number>();
/** Codice → nome preferito, usato per scrivere (solo la tabella HTML 4). */
const CP_TO_NAME = new Map<number, string>();

LATIN1.split(' ').forEach((name, i) => {
  NAME_TO_CP.set(name, 160 + i);
  CP_TO_NAME.set(160 + i, name);
});
for (const item of OTHERS.split(' ')) {
  const [name, cp] = item.split(':');
  NAME_TO_CP.set(name, Number(cp));
  CP_TO_NAME.set(Number(cp), name);
}
for (const item of EXTRA.split(' ')) {
  const [name, cp] = item.split(':');
  if (!NAME_TO_CP.has(name)) NAME_TO_CP.set(name, Number(cp));
}

/** Numero di entità con nome note (per le statistiche e i test). */
export const NAMED_COUNT = NAME_TO_CP.size;

/** Interpretazione HTML5 dei riferimenti numerici 0x80-0x9F (come Windows-1252). */
const WIN1252: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6,
  0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c,
  0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

// ---------- entità HTML ----------

export type HtmlScope = 'basic' | 'nonAscii' | 'all';
export type HtmlFormat = 'named' | 'decimal' | 'hex';

export interface HtmlEncodeOptions {
  /** basic: solo & < > " '; nonAscii: anche ogni carattere non ASCII; all: ogni carattere. */
  scope: HtmlScope;
  format: HtmlFormat;
}

function entityFor(cp: number, format: HtmlFormat): string {
  if (format === 'named') {
    const name = CP_TO_NAME.get(cp);
    if (name) return `&${name};`;
  }
  return format === 'hex' ? `&#x${cp.toString(16).toUpperCase()};` : `&#${cp};`;
}

/** Scrive in entità HTML. Gli a capo e le tabulazioni restano come sono; i caratteri fuori dal BMP sono un'unica entità. */
export function encodeHtml(text: string, o: HtmlEncodeOptions): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    if (cp === 10 || cp === 13 || cp === 9) out += ch;
    else if (cp === 38 || cp === 60 || cp === 62 || cp === 34) out += entityFor(cp, o.format);
    else if (cp === 39) out += o.format === 'hex' ? '&#x27;' : '&#39;';
    else if (o.scope === 'all' || (o.scope === 'nonAscii' && cp > 126) || (cp < 32 || cp === 127)) out += entityFor(cp, o.format);
    else out += ch;
  }
  return out;
}

export interface HtmlDecodeResult {
  text: string;
  /** Quante entità sono state sostituite. */
  replaced: number;
  /** Nomi sconosciuti lasciati invariati (senza duplicati). */
  unknown: string[];
}

function fromCodePoint(cp: number): string {
  if (cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '�';
  return String.fromCodePoint(WIN1252[cp] ?? cp);
}

/**
 * Decodifica le entità HTML (con nome, decimali ed esadecimali) senza passare dal DOM:
 * nessun markup viene interpretato. L'entità deve finire con «;».
 */
export function decodeHtml(text: string): HtmlDecodeResult {
  let replaced = 0;
  const unknown: string[] = [];
  const out = text.replace(/&(?:#([0-9]{1,8})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,31}));/g, (m, dec, hex, name) => {
    if (name !== undefined) {
      const cp = NAME_TO_CP.get(name);
      if (cp === undefined) {
        if (!unknown.includes(m)) unknown.push(m);
        return m;
      }
      replaced++;
      return String.fromCodePoint(cp);
    }
    replaced++;
    return fromCodePoint(dec !== undefined ? parseInt(dec, 10) : parseInt(hex, 16));
  });
  return { text: out, replaced, unknown };
}

// ---------- stringhe JavaScript / JSON ----------

export type JsQuote = 'double' | 'single' | 'backtick' | 'none';

export interface JsEncodeOptions {
  quote: JsQuote;
  /** Scrive ogni carattere non ASCII come \uXXXX. */
  asciiOnly: boolean;
}

const QUOTE_CHAR: Record<Exclude<JsQuote, 'none'>, string> = { double: '"', single: "'", backtick: '`' };

function hex4(n: number): string {
  return n.toString(16).padStart(4, '0');
}

/** Protegge il testo per metterlo in una stringa JavaScript (o, con `json`, JSON). */
export function escapeJs(text: string, o: JsEncodeOptions, json = false): string {
  const q = o.quote === 'none' ? '' : QUOTE_CHAR[o.quote];
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const code = text.charCodeAt(i);
    if (c === '\\') out += '\\\\';
    else if (c === '\n') out += '\\n';
    else if (c === '\r') out += '\\r';
    else if (c === '\t') out += '\\t';
    else if (c === '\b') out += '\\b';
    else if (c === '\f') out += '\\f';
    else if (c === '\v' && !json) out += '\\v';
    else if (code < 32 || code === 127) out += `\\u${hex4(code)}`;
    else if (q && c === q) out += '\\' + c;
    else if (!q && (c === '"' || (c === "'" && !json))) out += '\\' + c;
    else if (!json && o.quote === 'backtick' && c === '$' && text[i + 1] === '{') out += '\\$';
    else if (code === 0x2028 || code === 0x2029) out += `\\u${hex4(code)}`;
    else if (o.asciiOnly && code > 126) out += `\\u${hex4(code)}`;
    else out += c;
  }
  return q + out + q;
}

export interface UnescapeError {
  /** Chiave `ent.err.<code>`. */
  code: 'badEscape' | 'badHex' | 'badUnicode' | 'badCodePoint' | 'danglingBackslash' | 'unquoted' | 'badUrl';
  /** Indice del carattere (0-based) nel testo. */
  index: number;
  /** Testo dell'escape sbagliato, se serve a spiegare. */
  seq?: string;
}

export type UnescapeResult = { ok: true; text: string } | { ok: false; error: UnescapeError };

const SIMPLE_ESC: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '"': '"', "'": "'", '`': '`', '\\': '\\', '/': '/' };

/** Toglie le virgolette esterne se circondano tutto il testo e dentro non ce n'è una uguale non protetta. */
function stripQuotes(text: string): { body: string; offset: number } {
  const t = text.trim();
  const lead = text.length - text.trimStart().length;
  const q = t[0];
  if (t.length >= 2 && (q === '"' || q === "'" || q === '`') && t[t.length - 1] === q) {
    let i = 1;
    for (; i < t.length - 1; i++) {
      if (t[i] === '\\') i++;
      else if (t[i] === q) return { body: text, offset: 0 };
    }
    if (i === t.length - 1) return { body: t.slice(1, -1), offset: lead + 1 };
  }
  return { body: text, offset: 0 };
}

/**
 * Riporta alla forma originale una stringa JavaScript (o JSON, con `json` = true: solo gli escape che JSON ammette).
 * Le virgolette esterne, se ci sono, si tolgono.
 */
export function unescapeJs(text: string, json = false): UnescapeResult {
  const { body, offset } = stripQuotes(text);
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c !== '\\') {
      out += c;
      continue;
    }
    const at = offset + i;
    const e = body[i + 1];
    if (e === undefined) return { ok: false, error: { code: 'danglingBackslash', index: at } };
    if (e === 'u') {
      if (body[i + 2] === '{' && !json) {
        const end = body.indexOf('}', i + 3);
        const hex = end === -1 ? '' : body.slice(i + 3, end);
        if (!/^[0-9a-fA-F]{1,6}$/.test(hex)) return { ok: false, error: { code: 'badUnicode', index: at, seq: body.slice(i, i + 10) } };
        const cp = parseInt(hex, 16);
        if (cp > 0x10ffff) return { ok: false, error: { code: 'badCodePoint', index: at, seq: body.slice(i, end + 1) } };
        out += String.fromCodePoint(cp);
        i = end;
      } else {
        const hex = body.slice(i + 2, i + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) return { ok: false, error: { code: 'badUnicode', index: at, seq: body.slice(i, i + 6) } };
        out += String.fromCharCode(parseInt(hex, 16));
        i += 5;
      }
    } else if (e === 'x' && !json) {
      const hex = body.slice(i + 2, i + 4);
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) return { ok: false, error: { code: 'badHex', index: at, seq: body.slice(i, i + 4) } };
      out += String.fromCharCode(parseInt(hex, 16));
      i += 3;
    } else if (e === '0' && !json && !/[0-9]/.test(body[i + 2] ?? '')) {
      out += '\0';
      i += 1;
    } else if (e === '\n' && !json) {
      i += 1; // continuazione di riga
    } else if (e === '\r' && !json) {
      i += body[i + 2] === '\n' ? 2 : 1;
    } else if (e in SIMPLE_ESC && (!json || '"\\/bfnrt'.includes(e))) {
      out += SIMPLE_ESC[e];
      i += 1;
    } else if (!json && e !== undefined && !/[0-9]/.test(e)) {
      out += e; // \q = q (come in JavaScript, fuori dal modo strict)
      i += 1;
    } else return { ok: false, error: { code: 'badEscape', index: at, seq: body.slice(i, i + 2) } };
  }
  return { ok: true, text: out };
}

// ---------- URL ----------

export interface UrlOptions {
  /** Spazio come "+" (form) invece di %20. */
  plus: boolean;
}

export function encodeUrl(text: string, o: UrlOptions): string {
  // encodeURIComponent lascia ! ' ( ) * ~ : si proteggono quelli che RFC 3986 riserva
  const enc = encodeURIComponent(text.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '\uFFFD')).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return o.plus ? enc.replace(/%20/g, '+') : enc;
}

export function decodeUrl(text: string, o: UrlOptions): UnescapeResult {
  const src = o.plus ? text.replace(/\+/g, ' ') : text;
  try {
    return { ok: true, text: decodeURIComponent(src) };
  } catch {
    // trova la prima sequenza %XX (anche consecutiva) che non è UTF-8 valido o il % non seguito da due cifre
    const re = /(?:%[0-9a-fA-F]{2})+|%/g;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      try {
        if (m[0] === '%') throw new Error('x');
        decodeURIComponent(m[0]);
      } catch {
        return { ok: false, error: { code: 'badUrl', index: m.index, seq: m[0].slice(0, 12) } };
      }
    }
    return { ok: false, error: { code: 'badUrl', index: 0 } };
  }
}

/** Riga e colonna (1-based) di un indice di carattere. */
export function lineColumn(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index).split('\n');
  return { line: before.length, column: before[before.length - 1].length + 1 };
}
