// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { compileJsonPath, jsonErrorPos, lineCol, parseJson, queryJsonPath, quoteName, sliceIndices } from './jsonpath';

/** Documento d'esempio dell'articolo di Goessner (2007), con le stesse quattro opere. */
const store = {
  store: {
    book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
      { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
      { category: 'fiction', author: 'J. R. R. Tolkien', title: 'The Lord of the Rings', isbn: '0-395-19395-8', price: 22.99 },
    ],
    bicycle: { color: 'red', price: 399 },
  },
  expensive: 10,
};

const vals = (doc: unknown, expr: string): unknown[] => {
  const r = queryJsonPath(doc, expr);
  if (!r.ok) throw new Error(`${expr}: ${r.error.code}@${r.error.pos}`);
  return r.nodes.map((n) => n.value);
};
const paths = (doc: unknown, expr: string): string[] => {
  const r = queryJsonPath(doc, expr);
  if (!r.ok) throw new Error(`${expr}: ${r.error.code}`);
  return r.nodes.map((n) => n.path);
};
const err = (expr: string) => {
  const r = queryJsonPath({}, expr);
  if (r.ok) throw new Error('atteso errore: ' + expr);
  return r.error;
};

describe('esempi di Goessner / RFC 9535', () => {
  it('$.store.book[*].author', () => {
    expect(vals(store, '$.store.book[*].author')).toEqual(['Nigel Rees', 'Evelyn Waugh', 'Herman Melville', 'J. R. R. Tolkien']);
  });
  it('$..author', () => {
    expect(vals(store, '$..author')).toHaveLength(4);
  });
  it('$.store.* (libri e bicicletta)', () => {
    expect(vals(store, '$.store.*')).toEqual([store.store.book, store.store.bicycle]);
  });
  it('$.store..price in ordine di documento', () => {
    expect(vals(store, '$.store..price')).toEqual([8.95, 12.99, 8.99, 22.99, 399]);
  });
  it('$..book[2] e $..book[-1:]', () => {
    expect(vals(store, '$..book[2].title')).toEqual(['Moby Dick']);
    expect(vals(store, '$..book[-1:].title')).toEqual(['The Lord of the Rings']);
  });
  it('$..book[0,1] e $..book[:2]', () => {
    expect(vals(store, '$..book[0,1].title')).toEqual(['Sayings of the Century', 'Sword of Honour']);
    expect(vals(store, '$..book[:2].title')).toEqual(['Sayings of the Century', 'Sword of Honour']);
  });
  it('$..book[?(@.isbn)]', () => {
    expect(vals(store, '$..book[?(@.isbn)].title')).toEqual(['Moby Dick', 'The Lord of the Rings']);
  });
  it('$..book[?(@.price<10)]', () => {
    expect(vals(store, '$..book[?(@.price<10)].title')).toEqual(['Sayings of the Century', 'Moby Dick']);
  });
  it('confronto con un valore del documento: $..book[?(@.price <= $.expensive)]', () => {
    expect(vals(store, '$..book[?(@.price <= $.expensive)].price')).toEqual([8.95, 8.99]);
  });
  it('$..* visita tutto il documento e $..[*] è equivalente', () => {
    expect(vals(store, '$..*').length).toBe(vals(store, '$..[*]').length);
    expect(vals(store, '$..*')).toHaveLength(28);
  });
  it('percorsi normalizzati', () => {
    expect(paths(store, '$..book[?(@.isbn)].title')).toEqual(["$['store']['book'][2]['title']", "$['store']['book'][3]['title']"]);
    expect(paths(store, '$')).toEqual(['$']);
  });
});

describe('selettori', () => {
  const doc = { a: [10, 20, 30, 40, 50], 'una chiave': 1, 'it\'s': 2, o: { x: 1, y: 2 } };
  it('radice, nome tra apici singoli e doppi, caratteri speciali', () => {
    expect(vals(doc, '$')).toEqual([doc]);
    expect(vals(doc, "$['una chiave']")).toEqual([1]);
    expect(vals(doc, '$["una chiave"]')).toEqual([1]);
    expect(vals(doc, "$['it\\'s']")).toEqual([2]);
    expect(paths(doc, "$['it\\'s']")).toEqual(["$['it\\'s']"]);
  });
  it('indici positivi, negativi e fuori intervallo', () => {
    expect(vals(doc, '$.a[0]')).toEqual([10]);
    expect(vals(doc, '$.a[-1]')).toEqual([50]);
    expect(vals(doc, '$.a[-5]')).toEqual([10]);
    expect(vals(doc, '$.a[5]')).toEqual([]);
    expect(vals(doc, '$.a[-6]')).toEqual([]);
  });
  it('indice su un oggetto e nome su un array: nessun risultato', () => {
    expect(vals(doc, '$.o[0]')).toEqual([]);
    expect(vals(doc, '$.a.x')).toEqual([]);
    expect(vals(doc, '$.nonesiste.x')).toEqual([]);
  });
  it('jolly su array, oggetto e primitivo', () => {
    expect(vals(doc, '$.a[*]')).toEqual([10, 20, 30, 40, 50]);
    expect(vals(doc, '$.o.*')).toEqual([1, 2]);
    expect(vals(doc, '$.a[0].*')).toEqual([]);
  });
  it('unione con duplicati: si mantengono, nell\'ordine indicato', () => {
    expect(vals(doc, '$.a[1,0,1]')).toEqual([20, 10, 20]);
    expect(vals(doc, "$.o['y','x']")).toEqual([2, 1]);
  });
  it('discesa ricorsiva con nome, indice e jolly', () => {
    const d = { a: { b: [{ b: 1 }, { c: { b: 2 } }] } };
    expect(vals(d, '$..b')).toEqual([[{ b: 1 }, { c: { b: 2 } }], 1, 2]);
    expect(vals([[1, 2], [3]], '$..[0]')).toEqual([[1, 2], 1, 3]);
  });
  it('nome con trattino e unicode in forma abbreviata', () => {
    expect(vals({ 'my-key': 1, città: 2, $x: 3 }, '$.my-key')).toEqual([1]);
    expect(vals({ città: 2 }, '$.città')).toEqual([2]);
    expect(vals({ $x: 3 }, '$.$x')).toEqual([3]);
  });
  it('chiavi come __proto__, constructor e toString non risalgono la catena', () => {
    expect(vals({}, '$.constructor')).toEqual([]);
    expect(vals({}, '$.toString')).toEqual([]);
    expect(vals({}, "$['__proto__']")).toEqual([]);
    const own = JSON.parse('{"__proto__": 5}');
    expect(vals(own, '$.__proto__')).toEqual([5]);
  });
  it('spazi tollerati tra i segmenti e nelle parentesi', () => {
    expect(vals(doc, ' $ .a [ 0 ] ')).toEqual([10]);
    expect(vals(doc, '$.a[ 1 , 2 ]')).toEqual([20, 30]);
  });
});

describe('slice', () => {
  const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  it.each([
    ['$[1:3]', [1, 2]],
    ['$[5:]', [5, 6, 7, 8, 9]],
    ['$[1:5:2]', [1, 3]],
    ['$[5:1:-2]', [5, 3]],
    ['$[::-1]', [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]],
    ['$[-3:]', [7, 8, 9]],
    ['$[:-7]', [0, 1, 2]],
    ['$[::3]', [0, 3, 6, 9]],
    ['$[::0]', []],
    ['$[8:100]', [8, 9]],
    ['$[-100:2]', [0, 1]],
    ['$[3:3]', []],
    ['$[7:2]', []],
    ['$[:]', a],
  ])('%s', (expr, expected) => {
    expect(vals(a, expr)).toEqual(expected);
  });
  it('slice su un non-array e sliceIndices diretto', () => {
    expect(vals({ a: 1 }, '$[0:1]')).toEqual([]);
    expect(sliceIndices(0, null, null, null)).toEqual([]);
    expect(sliceIndices(5, 3, 0, -1)).toEqual([3, 2, 1]);
  });
  it('slice con troppi due punti è un errore', () => {
    expect(err('$[1:2:3:4]').code).toBe('bad-slice');
  });
});

describe('filtri', () => {
  const items = [
    { id: 1, prezzo: 5, tipo: 'x', tags: ['a', 'b'], nome: 'Alfa' },
    { id: 2, prezzo: 15, tipo: 'x', tags: [], nome: 'Beta' },
    { id: 3, prezzo: 25, tipo: 'y', nome: 'gamma' },
    { id: 4, prezzo: '30', tipo: 'x', nome: 'Delta', extra: null },
  ];
  const ids = (e: string) => (vals(items, e) as { id: number }[]).map((x) => x.id);
  it('confronti numerici e con stringhe', () => {
    expect(ids('$[?(@.prezzo > 10)]')).toEqual([2, 3]);
    expect(ids('$[?(@.prezzo >= 15)]')).toEqual([2, 3]);
    expect(ids('$[?(@.prezzo < 15)]')).toEqual([1]);
    expect(ids('$[?(@.prezzo <= 15)]')).toEqual([1, 2]);
    expect(ids("$[?(@.tipo == 'x')]")).toEqual([1, 2, 4]);
    expect(ids('$[?(@.tipo != "x")]')).toEqual([3]);
  });
  it('tipi diversi non si ordinano ma si distinguono con ==', () => {
    expect(ids("$[?(@.prezzo == '30')]")).toEqual([4]);
    expect(ids('$[?(@.prezzo == 30)]')).toEqual([]);
    expect(ids("$[?(@.prezzo > 'a')]")).toEqual([4].filter(() => false));
  });
  it('&&, || e ! con la precedenza giusta', () => {
    expect(ids("$[?(@.prezzo > 10 && @.tipo == 'x')]")).toEqual([2]);
    expect(ids("$[?(@.id == 1 || @.id == 3)]")).toEqual([1, 3]);
    expect(ids("$[?(@.id == 1 || @.id == 2 && @.tipo == 'y')]")).toEqual([1]);
    expect(ids("$[?((@.id == 1 || @.id == 2) && @.prezzo > 10)]")).toEqual([2]);
    expect(ids("$[?(!(@.tipo == 'x'))]")).toEqual([3]);
    expect(ids('$[?!@.tags]')).toEqual([3, 4]);
  });
  it('! non si confonde con !=', () => {
    expect(ids('$[?(@.id!=1 && !@.extra)]')).toEqual([2, 3]);
  });
  it('test di esistenza: una proprietà null esiste', () => {
    expect(ids('$[?(@.extra)]')).toEqual([4]);
    expect(ids('$[?(@.tags)]')).toEqual([1, 2]);
  });
  it('proprietà assente: == null è falso, != null è vero', () => {
    expect(ids('$[?(@.extra == null)]')).toEqual([4]);
    expect(ids('$[?(@.extra != null)]')).toEqual([1, 2, 3]);
    expect(ids('$[?(@.zzz == @.yyy)]')).toEqual([1, 2, 3, 4]);
  });
  it('confronto di array e oggetti per valore', () => {
    expect(ids("$[?(@.tags == $[0].tags)]")).toEqual([1]);
    expect(vals([{ a: { x: 1 } }, { a: { x: 2 } }], '$[?(@.a == $[0].a)]')).toHaveLength(1);
  });
  it('regex =~ con flag', () => {
    expect(ids('$[?(@.nome =~ /^a/i)]')).toEqual([1]);
    expect(ids('$[?(@.nome =~ /a$/)]')).toEqual([1, 2, 3, 4]);
    expect(ids('$[?(@.nome =~ /^[A-Z]/)]')).toEqual([1, 2, 4]);
    expect(ids('$[?(@.prezzo =~ /3/)]')).toEqual([4]);
    expect(ids('$[?(@.id =~ /1/)]')).toEqual([]);
  });
  it('regex con la barra dentro una classe e con escape', () => {
    expect(vals([{ p: 'a/b' }, { p: 'ab' }], '$[?(@.p =~ /a[/]b/)]')).toHaveLength(1);
    expect(vals([{ p: 'a/b' }, { p: 'ab' }], '$[?(@.p =~ /a\\/b/)]')).toHaveLength(1);
  });
  it('funzioni length, count, match, search, value', () => {
    expect(ids('$[?(length(@.nome) == 4)]')).toEqual([1, 2]);
    expect(ids('$[?(length(@.tags) > 0)]')).toEqual([1]);
    expect(ids('$[?(count(@.tags[*]) == 0)]')).toEqual([2, 3, 4]);
    expect(ids("$[?match(@.nome, 'A.f.')]")).toEqual([1]);
    expect(ids("$[?search(@.nome, 'et')]")).toEqual([2]);
    expect(ids("$[?(value(@.tipo) == 'y')]")).toEqual([3]);
  });
  it('length conta i punti di codice e gli oggetti', () => {
    expect(vals([{ s: '😀😀' }], '$[?(length(@.s) == 2)]')).toHaveLength(1);
    expect(vals([{ o: { a: 1, b: 2 } }], '$[?(length(@.o) == 2)]')).toHaveLength(1);
    expect(vals([{ n: 5 }], '$[?(length(@.n) == 5)]')).toHaveLength(0);
  });
  it('filtro su oggetto (valori) e su primitivo (niente)', () => {
    expect(vals({ a: { v: 1 }, b: { v: 2 } }, '$[?(@.v > 1)]')).toEqual([{ v: 2 }]);
    expect(vals([1, 2, 3], '$[?(@ > 1)]')).toEqual([2, 3]);
    expect(vals(5, '$[?(@ > 1)]')).toEqual([]);
  });
  it('filtro senza parentesi e annidato', () => {
    expect(vals([[1, 2], [3]], '$[?@[1]]')).toEqual([[1, 2]]);
    expect(vals([{ a: [1, 2] }, { a: [3] }], '$[?(@.a[?(@ > 2)])]')).toEqual([{ a: [3] }]);
  });
  it('più selettori insieme: filtro e indice', () => {
    expect(vals([1, 2, 3, 4], '$[0, ?(@ > 3)]')).toEqual([1, 4]);
  });
  it('numeri negativi, decimali e con esponente nei filtri', () => {
    expect(vals([-2, -0.5, 1.5e2], '$[?(@ < -1)]')).toEqual([-2]);
    expect(vals([-2, -0.5, 1.5e2], '$[?(@ > 1e2)]')).toEqual([150]);
  });
  it('apici e a capo nelle stringhe dei filtri', () => {
    expect(vals([{ s: "l'a" }, { s: 'x' }], "$[?(@.s == 'l\\'a')]")).toHaveLength(1);
    expect(vals([{ s: 'a\nb' }], "$[?(@.s == 'a\\nb')]")).toHaveLength(1);
    expect(vals([{ s: 'é' }], "$[?(@.s == '\\u00e9')]")).toHaveLength(1);
  });
});

describe('errori con posizione', () => {
  it('espressione vuota o senza $', () => {
    expect(err('')).toMatchObject({ code: 'empty' });
    expect(err('   ')).toMatchObject({ code: 'empty' });
    expect(err('store.book')).toMatchObject({ code: 'start', pos: 0 });
    expect(err('.a')).toMatchObject({ code: 'start' });
  });
  it('carattere inatteso', () => {
    expect(err('$.a#')).toMatchObject({ code: 'unexpected-char', pos: 3, detail: '#' });
    expect(err('$.')).toMatchObject({ code: 'unexpected-end' });
    expect(err('$..')).toMatchObject({ code: 'unexpected-end' });
    expect(err('$.a.')).toMatchObject({ code: 'unexpected-end' });
    expect(err('$[a]')).toMatchObject({ code: 'unexpected-char', pos: 2 });
  });
  it('parentesi e stringhe non chiuse', () => {
    expect(err('$[0')).toMatchObject({ code: 'expected-bracket' });
    expect(err("$['abc")).toMatchObject({ code: 'unterminated-string', pos: 2 });
    expect(err("$['a\\q']")).toMatchObject({ code: 'bad-escape' });
    expect(err("$['\\u12']")).toMatchObject({ code: 'bad-escape' });
    expect(err('$[?(@.a > 1]')).toMatchObject({ code: 'unexpected-char' });
  });
  it('indici non validi', () => {
    expect(err('$[01]').code).toBe('bad-index');
    expect(err('$[-0]').code).toBe('bad-index');
    expect(err('$[99999999999999999999]').code).toBe('bad-index');
    expect(err('$[-]').code).toBe('bad-index');
  });
  it('script alla Goessner non supportati', () => {
    expect(err('$.a[(@.length-1)]')).toMatchObject({ code: 'unexpected-char', detail: '(' });
  });
  it('filtri: funzione sconosciuta, argomenti, non singolare, test non valido', () => {
    expect(err('$[?(foo(@.a))]')).toMatchObject({ code: 'unknown-function', detail: 'foo' });
    expect(err('$[?(length(@.a, 1) > 1)]').code).toBe('function-args');
    expect(err('$[?(@.* == 1)]').code).toBe('non-singular');
    expect(err('$[?(@..a == 1)]').code).toBe('non-singular');
    expect(err("$[?(@['a','b'] == 1)]").code).toBe('non-singular');
    expect(err('$[?(@.a[0:1] == 1)]').code).toBe('non-singular');
    expect(err('$[?(length(@.a))]').code).toBe('not-a-test');
    expect(err('$[?(1)]').code).toBe('not-a-test');
    expect(err('$[?(@.a == )]').code).toBe('unexpected-char');
    expect(err('$[?(@.a == tru)]').code).toBe('bad-literal');
    expect(err('$[?(@.a == 1.)]').code).toBe('unexpected-char');
  });
  it('regex non valide o pericolose', () => {
    expect(err('$[?(@.a =~ /(/)]').code).toBe('bad-regex');
    expect(err('$[?(@.a =~ /abc)]').code).toBe('bad-regex');
    expect(err('$[?(@.a =~ abc)]').code).toBe('bad-regex');
    expect(err('$[?(@.a =~ /a/g)]').code).toBe('bad-regex');
    expect(err('$[?(@.a =~ /(a+)+$/)]').code).toBe('regex-unsafe');
    expect(err('$[?(@.a =~ /(x*y*)*/)]').code).toBe('regex-unsafe');
    expect(err(`$[?(@.a =~ /${'a'.repeat(250)}/)]`).code).toBe('regex-unsafe');
  });
  it('match con regex pericolosa o non valida non risulta e non si blocca', () => {
    const r = queryJsonPath([{ a: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!' }], "$[?match(@.a, '(a+)+$')]");
    expect(r).toMatchObject({ ok: true, total: 0 });
    expect(queryJsonPath([{ a: 'x' }], "$[?match(@.a, '(')]")).toMatchObject({ ok: true, total: 0 });
  });
  it('filtri troppo annidati', () => {
    expect(err('$[?' + '('.repeat(40) + '@.a' + ')'.repeat(40) + ']').code).toBe('too-deep');
  });
  it('compileJsonPath riusabile su più documenti', () => {
    const c = compileJsonPath('$.a');
    expect(c.ok).toBe(true);
  });
});

describe('limiti', () => {
  it('troncamento dei risultati', () => {
    const doc = Array.from({ length: 50 }, (_, i) => i);
    const r = queryJsonPath(doc, '$[*]', 10);
    expect(r).toMatchObject({ ok: true, total: 50, truncated: true });
    if (r.ok) expect(r.nodes).toHaveLength(10);
  });
  it('documenti molto profondi non fanno overflow dello stack', () => {
    let d: unknown = 1;
    for (let i = 0; i < 5000; i++) d = [d];
    const r = queryJsonPath(d, '$..*');
    expect(r.ok).toBe(true);
  });
  it('il tetto sulle visite ferma le espressioni esplosive', () => {
    const doc = Array.from({ length: 200 }, () => Array.from({ length: 200 }, () => [1, 2, 3, 4, 5]));
    const r = queryJsonPath(doc, '$..*..*..*..*');
    expect(r.ok).toBe(false);
  });
});

describe('quoteName e lettura del JSON', () => {
  it('quoteName', () => {
    expect(quoteName('a')).toBe("'a'");
    expect(quoteName("l'a")).toBe("'l\\'a'");
    expect(quoteName('a\\b')).toBe("'a\\\\b'");
    expect(quoteName('a\nb\u0001')).toBe("'a\\nb\\u0001'");
  });
  it('parseJson: valore corretto', () => {
    expect(parseJson('{"a":[1,2]}')).toEqual({ ok: true, value: { a: [1, 2] } });
  });
  it('parseJson: errore con posizione, riga e colonna', () => {
    const r = parseJson('{\n  "a": 1,\n  "b": ,\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.line).toBe(3);
      expect(r.col).toBe(8);
      expect(r.pos).toBe(19);
    }
  });
  it('parseJson: fine inattesa punta alla fine del testo', () => {
    const r = parseJson('{"a": ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.pos).toBe(6);
  });
  it('jsonErrorPos individua l\'errore e riconosce i JSON validi', () => {
    for (const ok of ['1', '"a"', 'null', '[]', '{}', '[1, 2.5e3, -0, "x\\u00e9"]', '{"a": {"b": [true, false, null]}}', ' \n{ } ']) {
      expect(jsonErrorPos(ok), ok).toBe(-1);
      expect(() => JSON.parse(ok)).not.toThrow();
    }
    expect(jsonErrorPos('{"a":1,}')).toBe(7);
    expect(jsonErrorPos('[1,2,]')).toBe(5);
    expect(jsonErrorPos("{'a':1}")).toBe(1);
    expect(jsonErrorPos('{"a" 1}')).toBe(5);
    expect(jsonErrorPos('[1 2]')).toBe(3);
    expect(jsonErrorPos('{"a":1} x')).toBe(8);
    expect(jsonErrorPos('"abc')).toBe(4);
    expect(jsonErrorPos('"a\nb"')).toBe(2);
    expect(jsonErrorPos('"\\q"')).toBe(2);
    expect(jsonErrorPos('[01]')).toBe(2);
    expect(jsonErrorPos('[tru]')).toBe(1);
    expect(jsonErrorPos('')).toBe(0);
    expect(jsonErrorPos('{"a":')).toBe(5);
  });
  it('jsonErrorPos regge un annidamento profondo', () => {
    expect(jsonErrorPos('['.repeat(20000) + ']'.repeat(20000))).toBe(-1);
  });
  it('lineCol', () => {
    expect(lineCol('ab\ncd', 4)).toEqual({ line: 2, col: 2 });
    expect(lineCol('ab', 0)).toEqual({ line: 1, col: 1 });
    expect(lineCol('ab', 99)).toEqual({ line: 1, col: 3 });
  });
});
