// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import {
  DEFAULT_TO_LIST, PRESET_IDS, SEPARATORS, detectSeparator, formatItem, itemsToLine, lineToList, listToLine, presetOptions, separatorName,
  splitLines, unescapeSeparator, DEFAULT_TO_LINE, cleanItems, type PresetId, type ToLineOptions, type ToListOptions,
} from './list-converter';

const tl = (items: string[], o: Partial<ToLineOptions> = {}): string => itemsToLine(items, o);

describe('splitLines', () => {
  it('casi base', () => {
    expect(splitLines('')).toEqual([]);
    expect(splitLines('a\r\nb\rc\nd\n')).toEqual(['a', 'b', 'c', 'd']);
    expect(splitLines('a\n\nb')).toEqual(['a', '', 'b']);
  });
});

describe('da elenco a riga: separatori, apici, prefisso e suffisso', () => {
  const items = ['uno', 'due', 'tre'];
  it('separatori predefiniti', () => {
    expect(tl(items, { separator: SEPARATORS.comma })).toBe('uno,due,tre');
    expect(tl(items, { separator: SEPARATORS.commaSpace })).toBe('uno, due, tre');
    expect(tl(items, { separator: SEPARATORS.semicolon })).toBe('uno;due;tre');
    expect(tl(items, { separator: SEPARATORS.space })).toBe('uno due tre');
    expect(tl(items, { separator: SEPARATORS.tab })).toBe('uno\tdue\ttre');
    expect(tl(items, { separator: SEPARATORS.pipe })).toBe('uno|due|tre');
  });
  it('separatore personalizzato con caratteri speciali (usato alla lettera, mai come espressione)', () => {
    expect(tl(items, { separator: '$&' })).toBe('uno$&due$&tre');
    expect(tl(items, { separator: '.*' })).toBe('uno.*due.*tre');
    expect(tl(items, { separator: '\\' })).toBe('uno\\due\\tre');
    expect(tl(items, { separator: ' → ' })).toBe('uno → due → tre');
    expect(tl(items, { separator: '\n' })).toBe('uno\ndue\ntre');
    expect(tl(items, { separator: '' })).toBe('unoduetre');
  });
  it('unescapeSeparator', () => {
    expect(unescapeSeparator('\\n')).toBe('\n');
    expect(unescapeSeparator(',\\t')).toBe(',\t');
    expect(unescapeSeparator('\\\\n')).toBe('\\n');
    expect(unescapeSeparator('a b')).toBe('a b');
  });
  it('separatorName', () => {
    expect(separatorName(', ')).toBe('commaSpace');
    expect(separatorName('::')).toBeNull();
  });
  it('apici', () => {
    expect(tl(items, { quote: 'double' })).toBe('"uno", "due", "tre"');
    expect(tl(items, { quote: 'single' })).toBe("'uno', 'due', 'tre'");
    expect(tl(items, { quote: 'backtick' })).toBe('`uno`, `due`, `tre`');
  });
  it('prefisso, suffisso e virgola finale', () => {
    expect(tl(items, { prefix: '(', suffix: ')' })).toBe('(uno, due, tre)');
    expect(tl(items, { trailing: true })).toBe('uno, due, tre,');
    expect(tl(items, { trailing: true, separator: ';', prefix: '{', suffix: '}' })).toBe('{uno;due;tre;}');
    expect(tl(items, { trailing: true, separator: ' ' })).toBe('uno due tre ');
  });
  it('senza voci il risultato è vuoto (anche con prefisso)', () => {
    expect(tl([], { prefix: '(', suffix: ')' })).toBe('');
    expect(tl(['', '  '], { prefix: '(', suffix: ')' })).toBe('');
  });
  it('una sola voce: nessun separatore', () => {
    expect(tl(['x'], { quote: 'single' })).toBe("'x'");
  });
});

describe('da elenco a riga: pulizia', () => {
  it('spazi e vuote', () => {
    expect(tl(['  a ', '', ' ', 'b'])).toBe('a, b');
    expect(tl(['  a ', '', 'b'], { trim: false, dropEmpty: false, quote: 'double' })).toBe('"  a ", "", "b"');
  });
  it('doppioni', () => {
    expect(tl(['a', 'b', 'a', 'B'], { unique: true })).toBe('a, b, B');
  });
  it('maiuscole prima dei doppioni', () => {
    expect(tl(['a', 'A', 'b'], { caseMode: 'lower', unique: true })).toBe('a, b');
    expect(tl(['a', 'b'], { caseMode: 'upper' })).toBe('A, B');
  });
  it('ordine', () => {
    expect(tl(['b', 'c', 'a'], { sort: 'az' })).toBe('a, b, c');
    expect(tl(['b', 'c', 'a'], { sort: 'za' })).toBe('c, b, a');
  });
  it('ordine numerico: numeri per valore, il resto dopo in ordine alfabetico', () => {
    expect(cleanItems(['10', '9', '-2', '2,5', 'x', 'a', '2.5'], { sort: 'numeric' })).toEqual(['-2', '2,5', '2.5', '9', '10', 'a', 'x']);
  });
  it('input con dati strani non rompe nulla', () => {
    expect(cleanItems(['é', 'e', 'z', 'Z', 'a'], { sort: 'az', locale: 'it' })).toEqual(['a', 'e', 'é', 'z', 'Z']);
  });
});

describe('preset: escape corretti', () => {
  const opt = (id: PresetId): ToLineOptions => presetOptions(id);
  it('SQL: apici raddoppiati, parentesi, numeri senza apici', () => {
    expect(tl(["O'Brien", '12', '007', 'a\\b', '-1.5'], opt('sql'))).toBe("('O''Brien', 12, '007', 'a\\b', -1.5)");
  });
  it('SQL: un tentativo di iniezione resta dentro l\'apice', () => {
    expect(tl(["'; DROP TABLE x;--"], opt('sql'))).toBe("('''; DROP TABLE x;--')");
  });
  it('JSON: escape corretto, parsabile da JSON.parse', () => {
    const items = ['a"b', 'c\\d', 'x\ny', 'tab\tz', '\u0001', 'è😀', '12', '007', "l'apice"];
    const out = tl(items, opt('json'));
    expect(out).toBe('["a\\"b", "c\\\\d", "x\\ny", "tab\\tz", "\\u0001", "è😀", 12, "007", "l\'apice"]');
    expect(JSON.parse(out)).toEqual(['a"b', 'c\\d', 'x\ny', 'tab\tz', '\u0001', 'è😀', 12, '007', "l'apice"]);
  });
  it('JavaScript/Python: apici singoli con barra rovesciata', () => {
    expect(tl(["it's", 'a\\b', 'x\ny', 'q"q', '12'], opt('js'))).toBe("['it\\'s', 'a\\\\b', 'x\\ny', 'q\"q', '12']");
  });
  it('CSV: virgolette solo se servono', () => {
    expect(tl(['a', 'b,c', 'd"e', ' f', 'g h', 'i\nj'], { ...opt('csv'), trim: false })).toBe('a,"b,c","d""e"," f",g h,"i\nj"');
  });
  it('URL: encodeURIComponent, anche con surrogati spaiati', () => {
    expect(tl(['a b', 'c,d', 'è', '100%', 'x&y=z'], opt('url'))).toBe('a%20b,c%2Cd,%C3%A8,100%25,x%26y%3Dz');
    expect(() => tl(['\uD800x'], opt('url'))).not.toThrow();
    expect(tl(['\uD800x'], opt('url'))).toBe('%EF%BF%BDx');
  });
  it('riga di comando: apici singoli con escape shell', () => {
    expect(tl(["it's", 'a b', '$HOME', 'x"y', '`id`', 'a\\b'], opt('shell'))).toBe("'it'\\''s' 'a b' '$HOME' 'x\"y' '`id`' 'a\\b'");
  });
  it('ogni preset è completo e mantiene la pulizia scelta', () => {
    for (const id of PRESET_IDS) {
      const o = presetOptions(id, { unique: true, sort: 'az' });
      expect(o.unique).toBe(true);
      expect(o.sort).toBe('az');
    }
    expect(DEFAULT_TO_LINE.quote).toBe('none');
  });
  it('numeri senza apici solo se richiesto e solo se numeri JSON', () => {
    const o = { ...opt('js'), noQuoteNumbers: true };
    expect(tl(['1', '1.5', '-3', '2e5', '01', '1.', '.5', '0x1', '1,5'], o)).toBe("['1', '1.5', '-3', '2e5', '01', '1.', '.5', '0x1', '1,5']".replace(/'(1|1\.5|-3|2e5)'/g, '$1'));
  });
  it('formatItem con apici e senza escape', () => {
    const f = { ...DEFAULT_TO_LINE, quote: 'double' as const, escape: 'none' as const };
    expect(formatItem('a"b', f)).toBe('"a"b"');
  });
});

describe('da riga a elenco', () => {
  const tlist = (t: string, o: Partial<ToListOptions> = {}): string[] => lineToList(t, o);
  it('rileva il separatore', () => {
    expect(detectSeparator('a,b,c')).toBe(',');
    expect(detectSeparator('a;b;c')).toBe(';');
    expect(detectSeparator('a\tb\tc')).toBe('\t');
    expect(detectSeparator('a|b|c')).toBe('|');
    expect(detectSeparator('uno due tre')).toBe(' ');
    expect(detectSeparator('1,5;2,5;3')).toBe(';');
    expect(detectSeparator('solo')).toBe(',');
    expect(detectSeparator('"a,b"')).toBe(',');
    expect(detectSeparator('"a;b" , "c"')).toBe(',');
  });
  it('divide con ogni separatore, automatico o scelto', () => {
    expect(tlist('a, b ,c')).toEqual(['a', 'b', 'c']);
    expect(tlist('a;b;c')).toEqual(['a', 'b', 'c']);
    expect(tlist('a\tb')).toEqual(['a', 'b']);
    expect(tlist('a|b')).toEqual(['a', 'b']);
    expect(tlist('uno  due   tre')).toEqual(['uno', 'due', 'tre']);
    expect(tlist('a,b;c', { separator: ';' })).toEqual(['a,b', 'c']);
    expect(tlist('a::b::c', { separator: '::' })).toEqual(['a', 'b', 'c']);
    expect(tlist('a.*b', { separator: '.*' })).toEqual(['a', 'b']);
  });
  it('una virgola dentro gli apici non divide', () => {
    expect(tlist('"a,b", c, \'d,e\'')).toEqual(['a,b', 'c', 'd,e']);
    expect(tlist('"a,b", c', { stripQuotes: false })).toEqual(['"a,b"', 'c']);
  });
  it('apice doppio dentro gli apici', () => {
    expect(tlist('"say ""hi""", x')).toEqual(['say "hi"', 'x']);
    expect(tlist("'it''s', x")).toEqual(["it's", 'x']);
  });
  it('apici non chiusi o con testo attaccato restano testo', () => {
    expect(tlist("l'albero, il cane")).toEqual(["l'albero", 'il cane']);
    expect(tlist('"aperto, b')).toEqual(['"aperto', 'b']);
    expect(tlist('"a"b, c')).toEqual(['"a"b', 'c']);
  });
  it('più righe: ogni riga viene divisa', () => {
    expect(tlist('a, b\nc, d\r\ne')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(tlist('a,b\n')).toEqual(['a', 'b']);
    expect(tlist('a,b\n', { dropEmpty: false })).toEqual(['a', 'b']);
  });
  it('vuote, spazi e doppioni', () => {
    expect(tlist('a,,b, ,c,')).toEqual(['a', 'b', 'c']);
    expect(tlist('a,,b,', { dropEmpty: false })).toEqual(['a', '', 'b', '']);
    expect(tlist(' a , b ', { trim: false, separator: ',' })).toEqual([' a ', ' b ']);
    expect(tlist('b,a,b,c', { unique: true, sort: 'az' })).toEqual(['a', 'b', 'c']);
    expect(tlist('3,10,2', { sort: 'numeric' })).toEqual(['2', '3', '10']);
    expect(tlist('')).toEqual([]);
  });
  it('sequenze con barra rovesciata, solo se richiesto', () => {
    expect(tlist('"a\\"b", "c\\\\d", "x\\ny", "\\u00e8"', { backslash: true })).toEqual(['a"b', 'c\\d', 'x\ny', 'è']);
    expect(tlist('"a\\nb"', { backslash: false })).toEqual(['a\\nb']);
    expect(tlist('"\\q"', { backslash: true })).toEqual(['\\q']);
  });
  it('parentesi esterne, anche con JSON su più righe', () => {
    expect(tlist('["a", "b"]', { stripWrapper: true })).toEqual(['a', 'b']);
    expect(tlist("('a', 'b')", { stripWrapper: true })).toEqual(['a', 'b']);
    expect(tlist('[\n  "a",\n  "b"\n]', { stripWrapper: true })).toEqual(['a', 'b']);
    expect(tlist('[a, b]')).toEqual(['[a', 'b]']);
  });
  it('quoteChars limita gli apici riconosciuti', () => {
    expect(tlist("'a', b", { quoteChars: '"' })).toEqual(["'a'", 'b']);
  });
});

describe('andata e ritorno: lista → riga → lista identica', () => {
  const hard = [
    'a,b', 'say "hi"', "it's", 'back\\slash', '  lead', 'trail  ', 'semi;colon', 'pipe|x', 'tab\tx', '[brackets]', '(paren)',
    'ünï©ode 😀', '', '12', '007', '-1.5e3', 'x`y', ',', '"', "'", '""', "''", ', ', 'a, b', '\\', '\\"', '{x}',
  ];
  const withNewline = [...hard, 'new\nline', 'cr\rx'];
  const keep = { trim: false, dropEmpty: false } as const;

  const cases: { name: string; list: string[]; to: Partial<ToLineOptions>; back: Partial<ToListOptions> }[] = [
    { name: 'SQL', list: hard, to: presetOptions('sql'), back: { separator: ', ', quoteChars: "'", stripWrapper: true } },
    { name: 'JSON', list: withNewline, to: presetOptions('json'), back: { separator: ', ', quoteChars: '"', backslash: true, stripWrapper: true } },
    { name: 'JavaScript', list: withNewline, to: presetOptions('js'), back: { separator: ', ', quoteChars: "'", backslash: true, stripWrapper: true } },
    { name: 'CSV', list: hard, to: presetOptions('csv'), back: { separator: ',', quoteChars: '"' } },
    { name: 'doppi apici e punto e virgola', list: hard, to: { quote: 'double', escape: 'double', separator: ';' }, back: { separator: ';', quoteChars: '"' } },
    { name: 'apici ` e pipe', list: hard, to: { quote: 'backtick', escape: 'double', separator: '|' }, back: { separator: '|', quoteChars: '`' } },
    { name: 'tab', list: hard, to: { quote: 'double', escape: 'double', separator: '\t' }, back: { separator: '\t', quoteChars: '"' } },
    { name: 'separatore lungo personalizzato', list: hard, to: { quote: 'single', escape: 'backslash', separator: ' :: ' }, back: { separator: ' :: ', quoteChars: "'", backslash: true } },
  ];
  for (const c of cases) {
    it(c.name, () => {
      const line = itemsToLine(c.list, { ...c.to, ...keep });
      const back = lineToList(line, { ...DEFAULT_TO_LIST, ...keep, ...c.back });
      expect(back).toEqual(c.list);
    });
  }
  it('il separatore automatico ritrova la virgola con apici', () => {
    const list = ['a,b', 'c;d', 'e|f', 'g'];
    const line = itemsToLine(list, { quote: 'double', escape: 'double', separator: ',' });
    expect(lineToList(line)).toEqual(list);
  });
  it('lista semplice: riga → lista → riga', () => {
    const line = 'uno, due, tre';
    expect(listToLine(lineToList(line).join('\n'))).toBe(line);
  });
});

describe('prestazioni e limiti', () => {
  const N = 100_000;
  const items = Array.from({ length: N }, (_, i) => (i % 7 === 0 ? `it's "${i}", x` : `voce ${i}`));
  it('100.000 voci: lista → riga → lista in tempi ragionevoli', () => {
    const t0 = performance.now();
    const line = itemsToLine(items, { ...presetOptions('sql'), unique: true, sort: 'az' });
    const back = lineToList(line, { separator: ', ', quoteChars: "'", stripWrapper: true });
    const ms = performance.now() - t0;
    expect(back.length).toBe(N);
    expect(ms).toBeLessThan(5000);
  });
  it('100.000 voci con rilevamento automatico e input a più righe', () => {
    const t0 = performance.now();
    const text = items.map((s) => `"${s.replace(/"/g, '""')}",1`).join('\n');
    const back = lineToList(text);
    expect(back.length).toBe(N * 2);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
  it('stringhe patologiche da 100.000 caratteri', () => {
    for (const s of ['"'.repeat(N), "'".repeat(N), ','.repeat(N), 'a'.repeat(N), '"a'.repeat(N / 2), '"a",'.repeat(N / 4), '\\'.repeat(N), ' '.repeat(N)]) {
      const t0 = performance.now();
      lineToList(s, { backslash: true });
      lineToList(s);
      listToLine(s, presetOptions('json'));
      expect(performance.now() - t0).toBeLessThan(2000);
    }
  });
  it('listToLine con testo a righe', () => {
    expect(listToLine('a\nb\r\nc\n', { separator: '|' })).toBe('a|b|c');
  });
});

describe('scenario dello screenshot', () => {
  it('SQL con doppioni tolti e ritorno', () => {
    const o = { ...presetOptions('sql'), unique: true };
    const line = listToLine("mela\nO'Brien\n12\n007\nmela", o);
    expect(line).toBe("('mela', 'O''Brien', 12, '007')");
    expect(lineToList(line, { separator: ',', stripWrapper: true })).toEqual(['mela', "O'Brien", '12', '007']);
  });
});
