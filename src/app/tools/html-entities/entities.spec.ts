// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { NAMED_COUNT, decodeHtml, decodeUrl, encodeHtml, encodeUrl, escapeJs, lineColumn, unescapeJs } from './entities';

describe('encodeHtml', () => {
  it('basic: solo i caratteri speciali', () => {
    expect(encodeHtml(`<a href="x">Tom & 'Jerry'</a> è`, { scope: 'basic', format: 'named' })).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt; è',
    );
  });
  it('nonAscii con nomi: usa il nome quando c\'è, altrimenti il numero', () => {
    expect(encodeHtml('caffè © 2026 € ☕ 😀', { scope: 'nonAscii', format: 'named' })).toBe('caff&egrave; &copy; 2026 &euro; &#9749; &#128512;');
  });
  it('decimale ed esadecimale', () => {
    expect(encodeHtml('è<', { scope: 'nonAscii', format: 'decimal' })).toBe('&#232;&#60;');
    expect(encodeHtml('è<', { scope: 'nonAscii', format: 'hex' })).toBe('&#xE8;&#x3C;');
    expect(encodeHtml("'", { scope: 'basic', format: 'hex' })).toBe('&#x27;');
  });
  it('all: ogni carattere, a capo esclusi', () => {
    expect(encodeHtml('Ab 1\nz', { scope: 'all', format: 'decimal' })).toBe('&#65;&#98;&#32;&#49;\n&#122;');
  });
  it('un carattere fuori dal BMP è una sola entità (non due metà)', () => {
    expect(encodeHtml('😀', { scope: 'nonAscii', format: 'hex' })).toBe('&#x1F600;');
  });
  it('caratteri di controllo come entità numeriche', () => {
    expect(encodeHtml('a\u0001b', { scope: 'basic', format: 'named' })).toBe('a&#1;b');
  });
  it('testo vuoto', () => {
    expect(encodeHtml('', { scope: 'all', format: 'named' })).toBe('');
  });
});

describe('decodeHtml', () => {
  it('nomi, decimali ed esadecimali', () => {
    const r = decodeHtml('&lt;p&gt;caff&egrave; &#233; &#xE9; &#XE9; &copy; &euro; &hearts;&lt;/p&gt;');
    expect(r.text).toBe('<p>caffè é é é © € ♥</p>');
    expect(r.replaced).toBe(11);
    expect(r.unknown).toEqual([]);
  });
  it('distingue maiuscole e minuscole', () => {
    expect(decodeHtml('&Eacute;&eacute;&Alpha;&alpha;').text).toBe('ÉéΑα');
  });
  it('lascia invariate le entità sconosciute e le elenca', () => {
    const r = decodeHtml('a &foo; b &foo; &bar; &amp;');
    expect(r.text).toBe('a &foo; b &foo; &bar; &');
    expect(r.unknown).toEqual(['&foo;', '&bar;']);
    expect(r.replaced).toBe(1);
  });
  it('non decodifica due volte', () => {
    expect(decodeHtml('&amp;lt;').text).toBe('&lt;');
  });
  it('richiede il punto e virgola e ignora gli "&" isolati', () => {
    expect(decodeHtml('R&D &amp x &#65').text).toBe('R&D &amp x &#65');
  });
  it('riferimenti numerici non validi diventano U+FFFD', () => {
    expect(decodeHtml('&#0;&#1114112;&#55357;').text).toBe('���');
  });
  it('0x80-0x9F come Windows-1252 (HTML5)', () => {
    expect(decodeHtml('&#150;&#128;&#147;x&#148;').text).toBe('–€“x”');
  });
  it('caratteri fuori dal BMP', () => {
    expect(decodeHtml('&#128512; &#x1F600;').text).toBe('😀 😀');
  });
  it('non interpreta mai il markup', () => {
    const r = decodeHtml('&lt;img src=x onerror=alert(1)&gt; <b>ok</b>');
    expect(r.text).toBe('<img src=x onerror=alert(1)> <b>ok</b>');
  });
  it('è l\'inverso di encodeHtml per ogni scope e formato', () => {
    const samples = ['<a href="x">Tom & \'J\'</a>', 'caffè © € ☕ 😀 ½ Ω → ≠', 'tab\there\nnewline'];
    for (const s of samples)
      for (const scope of ['basic', 'nonAscii', 'all'] as const)
        for (const format of ['named', 'decimal', 'hex'] as const)
          expect(decodeHtml(encodeHtml(s, { scope, format })).text, `${scope}/${format}`).toBe(s);
  });
  it('la tabella ha le entità di HTML 4', () => {
    expect(NAMED_COUNT).toBeGreaterThan(250);
    expect(decodeHtml('&nbsp;&yuml;&thorn;').text).toBe(' ÿþ');
  });
});

describe('escapeJs / unescapeJs', () => {
  it('protegge virgolette, backslash e a capo', () => {
    expect(escapeJs('a "b" \'c\'\n\t\\', { quote: 'double', asciiOnly: false })).toBe('"a \\"b\\" \'c\'\\n\\t\\\\"');
    expect(escapeJs('a "b" \'c\'', { quote: 'single', asciiOnly: false })).toBe("'a \"b\" \\'c\\''");
    expect(escapeJs('a `b` ${x}', { quote: 'backtick', asciiOnly: false })).toBe('`a \\`b\\` \\${x}`');
  });
  it('senza virgolette protegge entrambe', () => {
    expect(escapeJs('"\'', { quote: 'none', asciiOnly: false })).toBe('\\"\\\'');
  });
  it('asciiOnly scrive \\uXXXX (coppie surrogate comprese)', () => {
    expect(escapeJs('è😀', { quote: 'none', asciiOnly: true })).toBe('\\u00e8\\ud83d\\ude00');
    expect(escapeJs('è😀', { quote: 'none', asciiOnly: false })).toBe('è😀');
  });
  it('caratteri di controllo e separatori di riga', () => {
    expect(escapeJs('\u0001 ', { quote: 'none', asciiOnly: false })).toBe('\\u0001\\u2028');
  });
  it('JSON: niente \\v né apici protetti', () => {
    expect(escapeJs("it's \v", { quote: 'double', asciiOnly: false }, true)).toBe('"it\'s \\u000b"');
  });
  it('il risultato di JSON è quello di JSON.stringify', () => {
    const s = 'a "b" \\ \n è 😀 \u0007';
    expect(escapeJs(s, { quote: 'double', asciiOnly: false }, true)).toBe(JSON.stringify(s));
  });
  it('unescape: escape semplici, \\x, \\u, \\u{}', () => {
    const r = unescapeJs('a\\nb\\t\\x41\\u00e8\\u{1F600}\\\\\\\'\\"\\0');
    expect(r).toEqual({ ok: true, text: "a\nb\tAè😀\\'\"\0" });
  });
  it('unescape toglie le virgolette esterne', () => {
    expect(unescapeJs('"ciao \\"mondo\\""')).toEqual({ ok: true, text: 'ciao "mondo"' });
    expect(unescapeJs("  'a\\'b'  ")).toEqual({ ok: true, text: "a'b" });
    expect(unescapeJs('`x`')).toEqual({ ok: true, text: 'x' });
  });
  it('non toglie virgolette che non racchiudono tutto', () => {
    expect(unescapeJs('"a" e "b"')).toEqual({ ok: true, text: '"a" e "b"' });
    expect(unescapeJs('"')).toEqual({ ok: true, text: '"' });
  });
  it('continuazione di riga', () => {
    expect(unescapeJs('a\\\nb')).toEqual({ ok: true, text: 'ab' });
  });
  it('errori con posizione', () => {
    expect(unescapeJs('ab\\u12')).toEqual({ ok: false, error: { code: 'badUnicode', index: 2, seq: '\\u12' } });
    expect(unescapeJs('\\xZZ')).toMatchObject({ ok: false, error: { code: 'badHex', index: 0 } });
    expect(unescapeJs('x\\')).toMatchObject({ ok: false, error: { code: 'danglingBackslash', index: 1 } });
    expect(unescapeJs('\\u{110000}')).toMatchObject({ ok: false, error: { code: 'badCodePoint' } });
    expect(unescapeJs('\\u{}')).toMatchObject({ ok: false, error: { code: 'badUnicode' } });
    expect(unescapeJs('\\1')).toMatchObject({ ok: false, error: { code: 'badEscape' } });
  });
  it('JSON rifiuta gli escape che JSON non ha', () => {
    expect(unescapeJs('\\x41', true)).toMatchObject({ ok: false });
    expect(unescapeJs('\\\'', true)).toMatchObject({ ok: false });
    expect(unescapeJs('\\u{41}', true)).toMatchObject({ ok: false });
    expect(unescapeJs('"a\\u00e8\\/"', true)).toEqual({ ok: true, text: 'aè/' });
  });
  it('è l\'inverso di escapeJs', () => {
    const s = 'riga1\nriga2\t"q" \'s\' \\ è 😀 \u0001 ${x} `';
    for (const quote of ['double', 'single', 'backtick', 'none'] as const)
      for (const asciiOnly of [false, true])
        expect(unescapeJs(escapeJs(s, { quote, asciiOnly })), `${quote}/${asciiOnly}`).toEqual({ ok: true, text: s });
    expect(unescapeJs(JSON.stringify(s), true)).toEqual({ ok: true, text: s });
  });
});

describe('URL', () => {
  it('codifica come componente', () => {
    expect(encodeUrl('a b&c=d/è?', { plus: false })).toBe('a%20b%26c%3Dd%2F%C3%A8%3F');
    expect(encodeUrl("a b!'()*", { plus: true })).toBe('a+b%21%27%28%29%2A');
  });
  it('decodifica, con "+" come spazio se richiesto', () => {
    expect(decodeUrl('a%20b+c%C3%A8', { plus: false })).toEqual({ ok: true, text: 'a b+cè' });
    expect(decodeUrl('a%20b+c', { plus: true })).toEqual({ ok: true, text: 'a b c' });
  });
  it('indica dove sta la sequenza sbagliata', () => {
    expect(decodeUrl('ab%zz', { plus: false })).toMatchObject({ ok: false, error: { code: 'badUrl', index: 2 } });
    expect(decodeUrl('100%', { plus: false })).toMatchObject({ ok: false, error: { index: 3 } });
    expect(decodeUrl('x%E0%A4%A y', { plus: false })).toMatchObject({ ok: false, error: { index: 1 } });
    expect(decodeUrl('ok %C3%28 no', { plus: false })).toMatchObject({ ok: false, error: { index: 3 } });
  });
  it('round trip con caratteri non BMP', () => {
    const s = 'a 😀 è/&=?#';
    expect(decodeUrl(encodeUrl(s, { plus: false }), { plus: false })).toEqual({ ok: true, text: s });
  });
  it('surrogati isolati non fanno crollare la codifica', () => {
    expect(encodeUrl('\ud800', { plus: false })).toBe('%EF%BF%BD');
  });
});

describe('lineColumn', () => {
  it('calcola riga e colonna', () => {
    expect(lineColumn('ab\ncd', 4)).toEqual({ line: 2, column: 2 });
    expect(lineColumn('ab', 0)).toEqual({ line: 1, column: 1 });
  });
});
