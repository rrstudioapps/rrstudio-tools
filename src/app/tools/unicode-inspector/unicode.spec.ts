// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { blockName, cssEscape, generalCategory, graphemes, htmlEntity, inspectText, invisibleKind, jsEscape, normalizeText, removeInvisibles, scriptOf, unicodeName, utf16Hex, utf8Hex } from './unicode';

describe('rappresentazioni', () => {
  it('UTF-8 e UTF-16', () => {
    expect(utf8Hex(0x41)).toBe('41');
    expect(utf8Hex(0xe8)).toBe('C3 A8');
    expect(utf8Hex(0x20ac)).toBe('E2 82 AC');
    expect(utf8Hex(0x1f600)).toBe('F0 9F 98 80');
    expect(utf16Hex(0x41)).toBe('0041');
    expect(utf16Hex(0x1f600)).toBe('D83D DE00');
  });
  it('escape ed entità', () => {
    expect(jsEscape(0xe8)).toBe('\\u00E8');
    expect(jsEscape(0x1f600)).toBe('\\u{1F600}');
    expect(cssEscape(0x1f600)).toBe('\\1F600 ');
    expect(htmlEntity(0x26)).toBe('&amp;');
    expect(htmlEntity(0xa0)).toBe('&nbsp;');
    expect(htmlEntity(0xe8)).toBe('&#xE8;');
  });
  it('surrogato isolato: UTF-8 di sostituzione', () => expect(utf8Hex(0xd800)).toBe('EF BF BD'));
});

describe('nome, categoria, blocco, script', () => {
  it('nomi ASCII e speciali', () => {
    expect(unicodeName(0x41)).toBe('LATIN CAPITAL LETTER A');
    expect(unicodeName(0x7a)).toBe('LATIN SMALL LETTER Z');
    expect(unicodeName(0x35)).toBe('DIGIT FIVE');
    expect(unicodeName(0x20)).toBe('SPACE');
    expect(unicodeName(0x0a)).toBe('LINE FEED');
    expect(unicodeName(0x200b)).toBe('ZERO WIDTH SPACE');
    expect(unicodeName(0x4e2d)).toBe('CJK UNIFIED IDEOGRAPH-4E2D');
  });
  it('nome assente per i caratteri senza tabella', () => expect(unicodeName(0xe8)).toBeNull());
  it('categoria generale', () => {
    expect(generalCategory(0x41)).toBe('Lu');
    expect(generalCategory(0x61)).toBe('Ll');
    expect(generalCategory(0x35)).toBe('Nd');
    expect(generalCategory(0x20)).toBe('Zs');
    expect(generalCategory(0x20ac)).toBe('Sc');
    expect(generalCategory(0x301)).toBe('Mn');
    expect(generalCategory(0x200b)).toBe('Cf');
    expect(generalCategory(0x1f600)).toBe('So');
    expect(generalCategory(0x0a)).toBe('Cc');
  });
  it('blocchi', () => {
    expect(blockName(0x41)).toBe('Basic Latin');
    expect(blockName(0x430)).toBe('Cyrillic');
    expect(blockName(0x1f600)).toBe('Emoticons');
    expect(blockName(0x10ffff)).toBeNull();
  });
  it('script', () => {
    expect(scriptOf(0x61)).toBe('Latin');
    expect(scriptOf(0x430)).toBe('Cyrillic');
    expect(scriptOf(0x3b1)).toBe('Greek');
    expect(scriptOf(0x20)).toBeNull();
    expect(scriptOf(0x31)).toBeNull();
  });
});

describe('invisibili', () => {
  it('riconosce i tipi', () => {
    expect(invisibleKind(0x200b)).toBe('zerowidth');
    expect(invisibleKind(0x202e)).toBe('bidi');
    expect(invisibleKind(0xa0)).toBe('space');
    expect(invisibleKind(0xad)).toBe('format');
    expect(invisibleKind(0x07)).toBe('control');
    expect(invisibleKind(0xe0041)).toBe('tag');
    expect(invisibleKind(0x41)).toBeNull();
    expect(invisibleKind(0x0a)).toBeNull();
    expect(invisibleKind(0x09)).toBeNull();
  });
  it('rimozione: zero-width, bidi, soft hyphen; spazi strani diventano spazi', () => {
    expect(removeInvisibles('a​b‮c­d')).toBe('abcd');
    expect(removeInvisibles('a b c　d')).toBe('a b c d');
    expect(removeInvisibles('riga due')).toBe('riga\ndue');
    expect(removeInvisibles('a\tb\nc')).toBe('a\tb\nc');
  });
  it('lo ZWJ tra emoji resta, altrove va via', () => {
    const family = '👨‍👩‍👧';
    expect(removeInvisibles(family)).toBe(family);
    expect(removeInvisibles(family, { keepEmoji: false })).toBe('👨👩👧');
    expect(removeInvisibles('a‍b')).toBe('ab');
  });
  it('bandiera con tag (Scozia) conservata; tag isolati rimossi', () => {
    const scot = '🏴\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}';
    expect(removeInvisibles(scot)).toBe(scot);
    expect(removeInvisibles('a\u{e0041}b')).toBe('ab');
  });
});

describe('inspectText', () => {
  it('conteggi: grafemi, code point, UTF-16 e UTF-8', () => {
    const r = inspectText('é👨‍👩');
    expect(r.graphemeCount).toBe(2);
    expect(r.codePointCount).toBe(4);
    expect(r.utf16Length).toBe(6);
    expect(r.utf8Length).toBe(2 + 4 + 3 + 4);
  });
  it('e + accento combinante: due code point in un grafema', () => {
    const r = inspectText('é');
    expect(r.graphemeCount).toBe(1);
    expect(r.chars.map((c) => c.hex)).toEqual(['U+0065', 'U+0301']);
    expect(r.chars.every((c) => c.grapheme === 0)).toBe(true);
  });
  it('conta gli invisibili', () => {
    const r = inspectText('a​b c');
    expect(r.invisibleCount).toBe(2);
  });
  it('omoglifo: «а» cirillica dentro «pаypal»', () => {
    const r = inspectText('pаypal');
    expect(r.mixedWords).toEqual(['pаypal']);
    expect(r.homoglyphCount).toBe(1);
    expect(r.chars[1].homoglyphOf).toBe('a');
    expect(r.scripts).toEqual(['Latin', 'Cyrillic']);
  });
  it('testo cirillico normale: nessuna segnalazione', () => {
    const r = inspectText('привет мир');
    expect(r.homoglyphCount).toBe(0);
    expect(r.mixedWords).toEqual([]);
  });
  it('parola intera di sosia cirillici segnalata', () => {
    const r = inspectText('раураӏ'.slice(0, 5));
    expect(r.homoglyphCount).toBe(5);
  });
  it('giapponese misto non è una mescolanza sospetta', () => {
    expect(inspectText('日本語のテキスト').mixedWords).toEqual([]);
  });
  it('testo vuoto', () => {
    const r = inspectText('');
    expect(r.chars).toEqual([]);
    expect(r.graphemeCount).toBe(0);
  });
  it('graphemes: bandiera = 1 grafema', () => expect(graphemes('🇮🇹🇫🇷').length).toBe(2));
});

describe('normalizzazione', () => {
  it('NFC compone, NFKC scioglie le legature e i pedici', () => {
    expect(normalizeText('é', 'NFC')).toBe('é');
    expect(normalizeText('ﬁ', 'NFC')).toBe('ﬁ');
    expect(normalizeText('ﬁ H₂O Ａ', 'NFKC')).toBe('fi H2O A');
  });
});
