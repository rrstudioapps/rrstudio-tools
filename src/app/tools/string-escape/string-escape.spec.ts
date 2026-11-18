// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { FORMATS, countChars, escapeString, lineCol, unescapeString, type EscapeFormat, type EscapeOptions } from './string-escape';

const un = (f: EscapeFormat, t: string, o: Partial<EscapeOptions> = {}): string => {
  const r = unescapeString(f, t, o);
  if (!r.ok) throw new Error('unescape fallito: ' + r.error);
  return r.value;
};
const err = (f: EscapeFormat, t: string, o: Partial<EscapeOptions> = {}) => {
  const r = unescapeString(f, t, o);
  if (r.ok) throw new Error('atteso un errore');
  return r;
};

describe('JSON', () => {
  it('escape: newline, tab, virgolette, backslash, controlli', () => {
    expect(escapeString('json', 'a"b\\c\nd\te\u0001')).toBe('a\\"b\\\\c\\nd\\te\\u0001');
  });
  it('emoji intatta, o come coppia di surrogati con ascii', () => {
    expect(escapeString('json', '😀')).toBe('😀');
    expect(escapeString('json', '😀 è', { ascii: true })).toBe('\\ud83d\\ude00 \\u00e8');
  });
  it('wrap aggiunge le virgolette', () => {
    expect(escapeString('json', 'x', { wrap: true })).toBe('"x"');
  });
  it('unescape con coppie surrogate', () => {
    expect(un('json', '\\ud83d\\ude00')).toBe('😀');
    expect(un('json', 'a\\/b\\n')).toBe('a/b\n');
  });
  it('unescape con wrap', () => {
    expect(un('json', ' "a\\"b" ', { wrap: true })).toBe('a"b');
    expect(err('json', 'senza', { wrap: true }).error).toBe('wrapMissing');
  });
  it('errori: \\u troncato, escape sconosciuto, virgolette non protette, a capo reale, backslash finale', () => {
    expect(err('json', 'ab\\u12')).toMatchObject({ error: 'badUnicode', position: 2 });
    expect(err('json', '\\q')).toMatchObject({ error: 'badEscape', position: 0 });
    expect(err('json', 'a"b')).toMatchObject({ error: 'unescapedQuote', position: 1 });
    expect(err('json', 'a\nb')).toMatchObject({ error: 'rawControl', position: 1 });
    expect(err('json', 'x\\')).toMatchObject({ error: 'trailingBackslash', position: 1 });
  });
});

describe('JavaScript', () => {
  it('apice scelto e ${ nei template', () => {
    expect(escapeString('js', `it's "q" \`b\` \${x}`, { quote: 'single' })).toBe(`it\\'s "q" \`b\` \${x}`);
    expect(escapeString('js', `it's "q"`, { quote: 'double' })).toBe(`it's \\"q\\"`);
    expect(escapeString('js', 'a`b${c}$d', { quote: 'backtick' })).toBe('a\\`b\\${c}$d');
  });
  it('non stampabili e wrap', () => {
    expect(escapeString('js', 'a\u2028\u200b\v', { quote: 'single', wrap: true })).toBe("'a\\u2028\\u200b\\v'");
  });
  it('unescape: x, u, u{}, coppie, continuazione di riga, \\0', () => {
    expect(un('js', '\\x41\\u0042\\u{43}\\u{1F600}\\uD83D\\uDE00')).toBe('ABC😀😀');
    expect(un('js', 'a\\\nb\\0c')).toBe('ab\0c');
    expect(un('js', '\\q\\$')).toBe('q$');
  });
  it('unescape con wrap di qualsiasi apice', () => {
    expect(un('js', '`a\\`b`', { wrap: true })).toBe('a`b');
  });
  it('errori: \\x non valido, \\u12, \\u{} fuori intervallo, ottale', () => {
    expect(err('js', 'a\\xZ1')).toMatchObject({ error: 'badHex', position: 1 });
    expect(err('js', '\\u12')).toMatchObject({ error: 'badUnicode', position: 0 });
    expect(err('js', '\\u{110000}').error).toBe('codePointRange');
    expect(err('js', '\\u{}').error).toBe('badUnicode');
    expect(err('js', 'x\\')).toMatchObject({ error: 'trailingBackslash' });
  });
});

describe('Python', () => {
  it('escape: mnemonici, \\xNN, \\uXXXX, \\UXXXXXXXX', () => {
    expect(escapeString('python', 'a\nb\x07\x01', { quote: 'single' })).toBe('a\\nb\\a\\x01');
    expect(escapeString('python', 'è😀\u200b', { ascii: true })).toBe('\\xe8\\U0001f600\\u200b');
    expect(escapeString('python', `it's`, { quote: 'single', wrap: true })).toBe(`'it\\'s'`);
  });
  it('unescape', () => {
    expect(un('python', '\\x41\\u00e8\\U0001F600\\101\\n\\q')).toBe('Aè😀A\n\\q');
  });
  it('errori', () => {
    expect(err('python', '\\x4')).toMatchObject({ error: 'badHex', position: 0 });
    expect(err('python', 'ab\\U0011')).toMatchObject({ error: 'badUnicode', position: 2 });
    expect(err('python', '\\U00110000').error).toBe('codePointRange');
    expect(err('python', '\\N{DASH}').error).toBe('badEscape');
  });
});

describe('regex', () => {
  it('escape dei metacaratteri', () => {
    expect(escapeString('regex', 'a.b*c+d?(e)[f]{g}|h^i$j\\k-l/m')).toBe('a\\.b\\*c\\+d\\?\\(e\\)\\[f\\]\\{g\\}\\|h\\^i\\$j\\\\k\\-l\\/m');
  });
  it('il risultato come regex trova il testo letterale', () => {
    const t = 'a.b*(c)[d]{1}|^$ \\ - / 😀';
    expect(new RegExp('^' + escapeString('regex', t) + '$').test(t)).toBe(true);
  });
  it('unescape; gli altri escape restano', () => {
    expect(un('regex', '\\.\\*\\\\a\\d')).toBe('.*\\a\\d');
    expect(err('regex', 'a\\')).toMatchObject({ error: 'trailingBackslash', position: 1 });
  });
});

describe('shell', () => {
  it('escape con apici singoli', () => {
    expect(escapeString('shell', `it's $HOME "x"`)).toBe(`'it'\\''s $HOME "x"'`);
    expect(escapeString('shell', '')).toBe("''");
  });
  it('unescape', () => {
    expect(un('shell', `'it'\\''s a'`)).toBe("it's a");
    expect(un('shell', "''")).toBe('');
  });
  it('errori: apice non chiuso', () => {
    expect(err('shell', "'abc")).toMatchObject({ error: 'shellUnclosed', position: 0 });
    expect(err('shell', "'a'x\\")).toMatchObject({ error: 'trailingBackslash', position: 4 });
  });
});

describe('SQL', () => {
  it('apici raddoppiati, con e senza apici esterni', () => {
    expect(escapeString('sql', "O'Brien")).toBe("O''Brien");
    expect(escapeString('sql', "O'Brien", { wrap: true })).toBe("'O''Brien'");
  });
  it('unescape', () => {
    expect(un('sql', "O''Brien")).toBe("O'Brien");
    expect(un('sql', "'a''b'", { wrap: true })).toBe("a'b");
  });
  it('errori: apice dispari con posizione, apici esterni mancanti', () => {
    expect(err('sql', "ab'c")).toMatchObject({ error: 'sqlOddQuote', position: 2 });
    expect(err('sql', "'a'b'", { wrap: true })).toMatchObject({ error: 'sqlOddQuote', position: 2 });
    expect(err('sql', 'abc', { wrap: true }).error).toBe('wrapMissing');
  });
});

describe('CSV', () => {
  it('quando serve: virgolette, separatore, a capo', () => {
    expect(escapeString('csv', 'ciao')).toBe('ciao');
    expect(escapeString('csv', 'a,b')).toBe('"a,b"');
    expect(escapeString('csv', 'a;b')).toBe('a;b');
    expect(escapeString('csv', 'a;b', { separator: ';' })).toBe('"a;b"');
    expect(escapeString('csv', 'dice "sì"\nfine')).toBe('"dice ""sì""\nfine"');
  });
  it('sempre tra virgolette con wrap', () => {
    expect(escapeString('csv', 'x', { wrap: true })).toBe('"x"');
  });
  it('unescape', () => {
    expect(un('csv', '"a ""b"", c\nd"')).toBe('a "b", c\nd');
    expect(un('csv', 'semplice')).toBe('semplice');
    expect(un('csv', '""')).toBe('');
  });
  it('errori: non chiuso, testo dopo la chiusura', () => {
    expect(err('csv', '"abc').error).toBe('csvUnclosed');
    expect(err('csv', '"a"b')).toMatchObject({ error: 'csvTrailing', position: 3 });
  });
});

describe('Java/C#', () => {
  it('escape e unescape', () => {
    expect(escapeString('java', 'a"b\\\n\t\u0001', { wrap: true })).toBe('"a\\"b\\\\\\n\\t\\u0001"');
    expect(un('java', '\\u00e8\\ud83d\\ude00\\t\\101\\0')).toBe('è😀\tA\0');
  });
  it('errori', () => {
    expect(err('java', '\\u00')).toMatchObject({ error: 'badUnicode' });
    expect(err('java', '\\x41').error).toBe('badEscape');
  });
});

describe('PHP', () => {
  it('apici singoli: solo \\\' e \\\\', () => {
    expect(escapeString('php', "a'b\\c\n$x", { quote: 'single' })).toBe("a\\'b\\\\c\n$x");
    expect(un('php', "a\\'b\\\\c\\n", { quote: 'single' })).toBe("a'b\\c\\n");
  });
  it('doppi apici', () => {
    expect(escapeString('php', 'a"b$c\n\t\u001b', { quote: 'double' })).toBe('a\\"b\\$c\\n\\t\\e');
    expect(escapeString('php', 'è😀', { quote: 'double', ascii: true })).toBe('\\u{00e8}\\u{1f600}');
    expect(un('php', '\\x41\\u{1F600}\\101\\$\\q\\x', { quote: 'double' })).toBe('A😀A$\\q\\x');
  });
});

describe('round trip', () => {
  const tests = [
    '', 'semplice', 'a\nb\r\nc\td', 'C:\\dir\\sub\\', '\\', '\\\\n', `it's "mixed" \`bt\` \${x} $y`,
    '😀 e 👨‍👩‍👧', 'è à ü', '\u0000\u0001\u001f\u007f\u0085\u2028\u2029\ufeff\u200b', 'a.b*c+d?(e)[f]{g}|h^i$j-k/l',
  ];
  const optionSets: Partial<EscapeOptions>[] = [
    {}, { wrap: true }, { ascii: true }, { ascii: true, wrap: true },
    { quote: 'single', wrap: true }, { quote: 'double' }, { quote: 'backtick', wrap: true },
    { separator: ';' },
  ];
  for (const f of FORMATS) {
    it(f, () => {
      for (const t of tests) {
        for (const o of optionSets) {
          const e = escapeString(f, t, o);
          const r = unescapeString(f, e, o);
          if (!r.ok) throw new Error(`${f} ${JSON.stringify(o)} ${JSON.stringify(t)}: ${r.error}`);
          if (r.value !== t) throw new Error(`${f} ${JSON.stringify(o)} ${JSON.stringify(t)} -> ${JSON.stringify(e)} -> ${JSON.stringify(r.value)}`);
        }
      }
    });
  }
  it('surrogato spaiato in JSON, JS e Java', () => {
    for (const f of ['json', 'js', 'java'] as const) {
      expect(un(f, escapeString(f, 'a\ud800b'))).toBe('a\ud800b');
    }
  });
});

describe('lineCol', () => {
  it('riga e colonna da 1', () => {
    expect(lineCol('ab\ncd', 0)).toEqual({ line: 1, col: 1 });
    expect(lineCol('ab\ncd', 4)).toEqual({ line: 2, col: 2 });
  });
});

describe('countChars', () => {
  it('conta i code point', () => {
    expect(countChars('a😀b')).toBe(3);
    expect(countChars('')).toBe(0);
    expect(countChars('\ud800')).toBe(1);
  });
});
