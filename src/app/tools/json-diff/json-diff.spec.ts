// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { applyJsonPatch, compareTexts, compareValues, detectKey, differencesToText, escapePointerToken, parseIgnoreList, parseJsonOrYaml, parsePointer, toJsonPatch } from './json-diff';
import { filterDifferences, flattenTree } from './json-diff-view';
import { SAMPLE_A, SAMPLE_B } from './json-diff.sample';

const kinds = (a: unknown, b: unknown, o = {}) => compareValues(a, b, o).differences.map((d) => `${d.kind}:${d.pointer}`);

describe('json-diff: oggetti', () => {
  it('uguali: nessuna differenza, anche con chiavi in altro ordine', () => {
    const r = compareValues({ a: 1, b: { c: [1, 2], d: 'x' } }, { b: { d: 'x', c: [1, 2] }, a: 1 });
    expect(r.differences).toEqual([]);
    expect(r.root.status).toBe('same');
  });

  it('oggetti annidati: percorso JSON Pointer e forma leggibile', () => {
    const r = compareValues({ a: { b: [0, 1, { c: 1 }] } }, { a: { b: [0, 1, { c: 2 }] } });
    expect(r.differences).toEqual([{ pointer: '/a/b/2/c', path: 'a.b[2].c', kind: 'changed', oldValue: 1, newValue: 2 }]);
  });

  it('aggiunto e rimosso, con il valore mancante dal lato giusto', () => {
    const r = compareValues({ a: 1, b: { x: 1 } }, { a: 1, c: [1] });
    expect(r.differences).toEqual([
      { pointer: '/b', path: 'b', kind: 'removed', oldValue: { x: 1 } },
      { pointer: '/c', path: 'c', kind: 'added', newValue: [1] },
    ]);
    expect('newValue' in r.differences[0]).toBe(false);
    expect('oldValue' in r.differences[1]).toBe(false);
    expect(r.counts).toEqual({ added: 1, removed: 1, changed: 0, type: 0, total: 2 });
  });

  it('chiavi con spazi o simboli: forma leggibile fra parentesi', () => {
    const r = compareValues({ 'a b': { 'c-d': 1 } }, { 'a b': { 'c-d': 2 } });
    expect(r.differences[0].path).toBe('["a b"]["c-d"]');
  });

  it('radice diversa: percorso vuoto', () => {
    const r = compareValues(1, 2);
    expect(r.differences).toEqual([{ pointer: '', path: '', kind: 'changed', oldValue: 1, newValue: 2 }]);
  });

  it('una chiave __proto__ è un dato come gli altri', () => {
    const a = JSON.parse('{"__proto__": {"x": 1}}') as unknown;
    const b = JSON.parse('{"__proto__": {"x": 2}}') as unknown;
    expect(kinds(a, b)).toEqual(['changed:/__proto__/x']);
    expect(kinds({}, b)).toEqual(['added:/__proto__']);
  });
});

describe('json-diff: cambi di tipo, null e undefined', () => {
  it('numero contro stringa, oggetto contro array, null contro valore', () => {
    expect(kinds({ a: 1 }, { a: '1' })).toEqual(['type:/a']);
    expect(kinds({ a: {} }, { a: [] })).toEqual(['type:/a']);
    expect(kinds({ a: null }, { a: 0 })).toEqual(['type:/a']);
    expect(kinds({ a: null }, { a: false })).toEqual(['type:/a']);
    expect(kinds({ a: true }, { a: 'true' })).toEqual(['type:/a']);
  });

  it('null contro null è uguale; null contro assente è aggiunto/rimosso', () => {
    expect(kinds({ a: null }, { a: null })).toEqual([]);
    expect(kinds({ a: null }, {})).toEqual(['removed:/a']);
    expect(kinds({}, { a: null })).toEqual(['added:/a']);
  });

  it('undefined vale come chiave assente', () => {
    expect(kinds({ a: undefined, b: 1 }, { b: 1 })).toEqual([]);
    expect(kinds({ b: 1 }, { b: 1, a: undefined })).toEqual([]);
    expect(kinds({ a: undefined }, { a: null })).toEqual(['added:/a']);
    expect(kinds({ a: null }, { a: undefined })).toEqual(['removed:/a']);
  });

  it('valori semplici diversi: modificato', () => {
    expect(kinds({ a: 'x', b: true, c: 1 }, { a: 'y', b: false, c: 2 })).toEqual(['changed:/a', 'changed:/b', 'changed:/c']);
  });
});

describe('json-diff: array', () => {
  const A = { l: [1, 2, 3] };
  const B = { l: [3, 1, 2] };

  it('per indice: lo spostamento è una serie di modifiche', () => {
    expect(kinds(A, B)).toEqual(['changed:/l/0', 'changed:/l/1', 'changed:/l/2']);
  });

  it('per indice: elementi in più o in meno', () => {
    expect(kinds({ l: [1] }, { l: [1, 2, 3] })).toEqual(['added:/l/1', 'added:/l/2']);
    expect(kinds({ l: [1, 2, 3] }, { l: [1] })).toEqual(['removed:/l/1', 'removed:/l/2']);
  });

  it('come insiemi: l\'ordine non conta, i duplicati si contano', () => {
    expect(kinds(A, B, { arrayMode: 'set' })).toEqual([]);
    expect(kinds({ l: [1, 1, 2] }, { l: [1, 2] }, { arrayMode: 'set' })).toEqual(['removed:/l/1']);
    expect(kinds({ l: [1, 2] }, { l: [2, 3] }, { arrayMode: 'set' })).toEqual(['removed:/l/0', 'added:/l/1']);
  });

  it('come insiemi: elementi oggetto con chiavi in altro ordine sono uguali', () => {
    expect(kinds({ l: [{ a: 1, b: 2 }, { c: [1, { d: 1, e: 2 }] }] }, { l: [{ c: [1, { e: 2, d: 1 }] }, { b: 2, a: 1 }] }, { arrayMode: 'set' })).toEqual([]);
  });

  const users = (list: unknown[]) => ({ users: list });
  const u1 = { id: 1, name: 'Anna', role: 'admin' };
  const u2 = { id: 2, name: 'Luca', role: 'editor' };

  it('per chiave esplicita: lo spostamento non è una modifica', () => {
    expect(kinds(users([u1, u2]), users([u2, u1]), { arrayMode: 'key', key: 'id' })).toEqual([]);
  });

  it('per chiave: mostra solo i campi cambiati, con la chiave nel percorso leggibile', () => {
    const r = compareValues(users([u1, u2]), users([{ ...u2, role: 'viewer' }, u1, { id: 3, name: 'Sara' }]), { arrayMode: 'key', key: 'id' });
    expect(r.differences).toEqual([
      { pointer: '/users/1/role', path: 'users[id=2].role', kind: 'changed', oldValue: 'editor', newValue: 'viewer' },
      { pointer: '/users/2', path: 'users[id=3]', kind: 'added', newValue: { id: 3, name: 'Sara' } },
    ]);
  });

  it('per chiave: elemento rimosso e chiave stringa nel percorso', () => {
    const r = compareValues({ l: [{ key: 'a', v: 1 }, { key: 'b', v: 2 }] }, { l: [{ key: 'b', v: 2 }] }, { arrayMode: 'key' });
    expect(r.differences.map((d) => `${d.kind}:${d.path}`)).toEqual(['removed:l[key="a"]']);
  });

  it('per chiave: rilevamento automatico di id, _id, key e uuid', () => {
    expect(detectKey([{ id: 1 }], [{ id: 2 }])).toBe('id');
    expect(detectKey([{ _id: 'a', id: 1 }, { _id: 'b', id: 1 }], [])).toBe('_id'); // id ripetuto: scartato
    expect(detectKey([{ key: 'k' }], [{ key: 'z' }])).toBe('key');
    expect(detectKey([{ uuid: 'u1', name: 'x' }], [])).toBe('uuid');
    expect(detectKey([{ id: 1 }, { name: 'senza id' }], [])).toBeNull();
    expect(detectKey([1, 2], [])).toBeNull();
    expect(detectKey([], [])).toBeNull();
    // con la chiave automatica lo spostamento è riconosciuto
    expect(kinds(users([u1, u2]), users([u2, u1]), { arrayMode: 'key' })).toEqual([]);
  });

  it('per chiave: se non si trova una chiave si confronta per indice', () => {
    expect(kinds({ l: [1, 2] }, { l: [2, 1] }, { arrayMode: 'key' })).toEqual(['changed:/l/0', 'changed:/l/1']);
    // anche con un campo scelto, se nessun elemento lo ha
    expect(kinds({ l: [1, 2] }, { l: [2, 1] }, { arrayMode: 'key', key: 'id' })).toEqual(['changed:/l/0', 'changed:/l/1']);
  });

  it('per chiave: elementi senza la chiave risultano rimossi o aggiunti', () => {
    expect(kinds({ l: [{ id: 1 }, { x: 1 }] }, { l: [{ id: 1 }] }, { arrayMode: 'key', key: 'id' })).toEqual(['removed:/l/1']);
  });

  it('array annidati negli elementi accoppiati', () => {
    const a = { l: [{ id: 1, t: [1, 2] }] };
    const b = { l: [{ id: 1, t: [1, 3] }] };
    expect(kinds(a, b, { arrayMode: 'key', key: 'id' })).toEqual(['changed:/l/0/t/1']);
  });
});

describe('json-diff: opzioni di confronto', () => {
  it('ignora le maiuscole nelle stringhe, ma non nelle chiavi', () => {
    expect(kinds({ a: 'Roma' }, { a: 'ROMA' })).toEqual(['changed:/a']);
    expect(kinds({ a: 'Roma' }, { a: 'ROMA' }, { ignoreCase: true })).toEqual([]);
    expect(kinds({ a: 'Roma' }, { A: 'Roma' }, { ignoreCase: true })).toEqual(['removed:/a', 'added:/A']);
  });

  it('numeri con tolleranza (epsilon)', () => {
    expect(kinds({ a: 1.0004 }, { a: 1 })).toEqual(['changed:/a']);
    expect(kinds({ a: 1.0004 }, { a: 1 }, { epsilon: 0.001 })).toEqual([]);
    expect(kinds({ a: 1.002 }, { a: 1 }, { epsilon: 0.001 })).toEqual(['changed:/a']);
    expect(kinds({ a: 1.001 }, { a: 1 }, { epsilon: 0.001 })).toEqual([]); // il limite è incluso
    expect(kinds({ a: '1' }, { a: 1 }, { epsilon: 5 })).toEqual(['type:/a']); // la tolleranza non cambia i tipi
  });

  it('l\'epsilon vale anche dentro gli array come insiemi', () => {
    expect(kinds({ l: [1.0001, 2] }, { l: [2, 1] }, { arrayMode: 'set', epsilon: 0.01 })).toEqual([]);
  });

  it('percorsi ignorati: JSON Pointer esatto e sottoalbero', () => {
    const a = { meta: { t: 1, u: { x: 1 } }, v: 1 };
    const b = { meta: { t: 2, u: { x: 2 } }, v: 2 };
    expect(kinds(a, b, { ignore: ['/meta'] })).toEqual(['changed:/v']);
    expect(kinds(a, b, { ignore: ['/meta/t'] })).toEqual(['changed:/meta/u/x', 'changed:/v']);
    expect(kinds(a, b, { ignore: ['meta/t', '/v'] })).toEqual(['changed:/meta/u/x']); // "/" iniziale facoltativo
  });

  it('percorsi ignorati: glob * (un livello) e ** (qualsiasi profondità)', () => {
    const a = { meta: { t: 1, u: { x: 1 } }, items: [{ ts: 1, n: 1 }, { ts: 2, n: 2 }] };
    const b = { meta: { t: 2, u: { x: 2 } }, items: [{ ts: 9, n: 1 }, { ts: 8, n: 3 }] };
    expect(kinds(a, b, { ignore: ['/meta/*'] })).toEqual(['changed:/items/0/ts', 'changed:/items/1/ts', 'changed:/items/1/n']);
    expect(kinds(a, b, { ignore: ['/items/*/ts', '/meta/**'] })).toEqual(['changed:/items/1/n']);
    expect(kinds(a, b, { ignore: ['/**/ts', '/**/x'] })).toEqual(['changed:/meta/t', 'changed:/items/1/n']);
    expect(kinds(a, b, { ignore: ['/meta/t*'] })).toEqual(['changed:/meta/u/x', 'changed:/items/0/ts', 'changed:/items/1/ts', 'changed:/items/1/n']);
  });

  it('percorsi ignorati: la chiave con ~1 e ~0 si scrive escapata nel modello', () => {
    const a = { 'a/b': 1, 'c~d': 1, z: 1 };
    const b = { 'a/b': 2, 'c~d': 2, z: 2 };
    expect(kinds(a, b, { ignore: ['/a~1b', '/c~0d'] })).toEqual(['changed:/z']);
  });

  it('percorsi ignorati: valgono anche nel confronto come insiemi', () => {
    expect(kinds({ l: [{ id: 1, ts: 1 }] }, { l: [{ id: 1, ts: 2 }] }, { arrayMode: 'set', ignore: ['/l/*/ts'] })).toEqual([]);
  });

  it('elenco dei percorsi scritto dall\'utente', () => {
    expect(parseIgnoreList('/a/b\n  /c/*, /d\n\n# commento\n')).toEqual(['/a/b', '/c/*', '/d']);
  });
});

describe('json-diff: JSON Pointer (RFC 6901)', () => {
  it('~ e / nelle chiavi si escapano come ~0 e ~1', () => {
    expect(escapePointerToken('a/b~c')).toBe('a~1b~0c');
    expect(parsePointer('/a~1b~0c/0')).toEqual(['a/b~c', '0']);
    expect(parsePointer('')).toEqual([]);
    expect(parsePointer('/')).toEqual(['']);
    // "~01" è la chiave "~1", non "/"
    expect(parsePointer('/~01')).toEqual(['~1']);
  });

  it('i percorsi delle differenze usano l\'escape', () => {
    const r = compareValues({ 'a/b': { 'c~d': 1 }, '': 1 }, { 'a/b': { 'c~d': 2 }, '': 2 });
    expect(r.differences.map((d) => d.pointer)).toEqual(['/a~1b/c~0d', '/']);
    expect(r.differences[0].path).toBe('["a/b"]["c~d"]');
  });
});

describe('json-diff: JSON Patch (RFC 6902)', () => {
  const cases: [string, unknown, unknown][] = [
    ['identici', { a: 1 }, { a: 1 }],
    ['modifica e tipo', { a: 1, b: [1, 2] }, { a: '1', b: { x: 1 } }],
    ['chiavi aggiunte e rimosse', { a: 1, b: 2, c: { d: 1 } }, { a: 1, e: [1], c: {} }],
    ['array più lungo', { l: [1, 2] }, { l: [1, 2, { x: 1 }, 4] }],
    ['array più corto', { l: [1, 2, 3, 4, 5] }, { l: [1, 9] }],
    ['array annidati', { l: [[1, 2], [3]] }, { l: [[1, 5, 6], []] }],
    ['chiavi con / e ~', { 'a/b': 1, 'c~d': { 'e/f': 1 } }, { 'a/b': 2, 'c~d': { 'e/f': 1, 'g~h': 1 } }],
    ['chiave vuota', { '': 1 }, { '': 2 }],
    ['radice diversa', { a: 1 }, [1, 2]],
    ['radice scalare', 1, 'x'],
    ['null', { a: null, b: 1 }, { a: 1, b: null }],
    ['oggetti in array', { users: [{ id: 1 }, { id: 2 }] }, { users: [{ id: 2, x: 1 }] }],
    ['esempio dello strumento', JSON.parse(SAMPLE_A), JSON.parse(SAMPLE_B)],
  ];

  it.each(cases)('applicata ad A dà B: %s', (_name, a, b) => {
    const ops = toJsonPatch(a, b);
    expect(applyJsonPatch(a, ops)).toEqual(b);
    // la patch non modifica il documento di partenza
    expect(applyJsonPatch(a, [])).toEqual(a);
  });

  it('non fa nulla se i documenti sono uguali', () => {
    expect(toJsonPatch({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toEqual([]);
  });

  it('operazioni attese: add, remove, replace con pointer escapati', () => {
    expect(toJsonPatch({ 'a/b': 1, x: 1, l: [1, 2, 3] }, { 'a/b': 2, y: 1, l: [1] })).toEqual([
      { op: 'replace', path: '/a~1b', value: 2 },
      { op: 'remove', path: '/x' },
      { op: 'remove', path: '/l/2' },
      { op: 'remove', path: '/l/1' },
      { op: 'add', path: '/y', value: 1 },
    ]);
    expect(toJsonPatch({ l: [1] }, { l: [1, 2] })).toEqual([{ op: 'add', path: '/l/-', value: 2 }]);
    expect(toJsonPatch(1, 2)).toEqual([{ op: 'replace', path: '', value: 2 }]);
  });

  it('applyJsonPatch rifiuta percorsi inesistenti', () => {
    expect(() => applyJsonPatch({}, [{ op: 'remove', path: '/x' }])).toThrow();
    expect(() => applyJsonPatch({}, [{ op: 'replace', path: '/x/y', value: 1 }])).toThrow();
    expect(() => applyJsonPatch({ l: [] }, [{ op: 'remove', path: '/l/3' }])).toThrow();
  });
});

describe('json-diff: lettura di JSON e YAML', () => {
  it('JSON valido', () => {
    expect(parseJsonOrYaml('{"a": [1, 2]}')).toEqual({ ok: true, value: { a: [1, 2] }, format: 'json' });
  });

  it('YAML con oggetti e liste', () => {
    const r = parseJsonOrYaml('name: rr\ntags:\n  - a\n  - b\n');
    expect(r).toEqual({ ok: true, value: { name: 'rr', tags: ['a', 'b'] }, format: 'yaml' });
  });

  it('errore JSON con riga e colonna', () => {
    const r = parseJsonOrYaml('{\n  "a": 1,\n  "b": ,\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.format).toBe('json');
      expect(r.error.line).toBe(3);
      expect(r.error.column).toBeGreaterThan(0);
    }
  });

  it('un testo che inizia con { o [ non diventa YAML', () => {
    const r = parseJsonOrYaml('{"a": 1,}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.format).toBe('json');
  });

  it('un testo semplice non è un documento valido', () => {
    expect(parseJsonOrYaml('ciao').ok).toBe(false);
    expect(parseJsonOrYaml('42').ok).toBe(true); // JSON valido: un numero
  });

  it('errore YAML con riga', () => {
    const r = parseJsonOrYaml('a: 1\nb: [1, 2\nc: 3\n');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.format).toBe('yaml');
      expect(r.error.line).toBeGreaterThan(0);
    }
  });

  it('compareTexts: vuoto, errore, ok', () => {
    expect(compareTexts('', '{}')).toEqual({ state: 'empty' });
    const err = compareTexts('{', '{"a":1}');
    expect(err.state).toBe('error');
    if (err.state === 'error') {
      expect(err.a).toBeDefined();
      expect(err.b).toBeUndefined();
    }
    const ok = compareTexts('{"a":1,"b":[1]}', 'a: 2\nb:\n  - 1\n');
    expect(ok.state).toBe('ok');
    if (ok.state === 'ok') {
      expect(ok.formatA).toBe('json');
      expect(ok.formatB).toBe('yaml');
      expect(ok.result.differences.map((d) => d.pointer)).toEqual(['/a']);
      expect(applyJsonPatch({ a: 1, b: [1] }, ok.patch)).toEqual({ a: 2, b: [1] });
    }
  });
});

describe('json-diff: esempio e esportazione in testo', () => {
  it('l\'esempio ha differenze di ogni tipo; con chiave id lo spostamento non conta', () => {
    const a = JSON.parse(SAMPLE_A) as unknown;
    const b = JSON.parse(SAMPLE_B) as unknown;
    const byIndex = compareValues(a, b);
    expect(byIndex.counts.added).toBeGreaterThan(0);
    expect(byIndex.counts.removed).toBeGreaterThan(0);
    expect(byIndex.counts.changed).toBeGreaterThan(0);
    expect(byIndex.counts.type).toBe(1);
    const byKey = compareValues(a, b, { arrayMode: 'key', key: 'id' });
    expect(byKey.differences.map((d) => d.path)).toEqual(['version', 'port', 'tags[2]', 'owner.email', 'users[id=2].role', 'users[id=4]', 'legacy', 'meta']);
    expect(byKey.differences.every((d) => !d.path.startsWith('users[id=1]') && !d.path.startsWith('users[id=3]'))).toBe(true);
  });

  it('elenco in testo e in Markdown', () => {
    const r = compareValues({ a: 1, b: 'x', c: true }, { a: 2, c: 'no', d: [1] });
    const labels = { added: 'aggiunto', removed: 'rimosso', changed: 'modificato', type: 'tipo cambiato', root: '(radice)' };
    expect(differencesToText(r.differences, labels, false).split('\n')).toEqual([
      '~ a (modificato): 1 → 2',
      '- b (rimosso): "x"',
      '~ c (tipo cambiato): true → "no"',
      '+ d (aggiunto): [1]',
    ]);
    expect(differencesToText(r.differences, labels, true).split('\n')[0]).toBe('- **modificato** `a`: `1 → 2`');
    expect(differencesToText(compareValues(1, 2).differences, labels, false)).toBe('~ (radice) (modificato): 1 → 2');
  });
});

describe('json-diff: albero unito', () => {
  const a = { name: 'x', cfg: { a: 1, b: 2, c: 3, d: { e: 1 } }, l: [1, 2] };
  const b = { name: 'x', cfg: { a: 1, b: 9, c: 3, d: { e: 1 } }, l: [1, 2, 3] };

  it('con i rami invariati compressi restano le modifiche e righe "n invariati"', () => {
    const { rows } = flattenTree(compareValues(a, b).root, { hideSame: true, expanded: new Set() });
    expect(rows.map((r) => (r.fold ? `fold${r.fold.count}` : r.label || '(radice)'))).toEqual(['(radice)', 'fold1', 'cfg', 'fold1', 'b', 'fold2', 'l', 'fold2', '[2]']);
    expect(rows.filter((r) => r.group >= 0).map((r) => [r.group, r.status])).toEqual([
      [0, 'changed'],
      [1, 'added'],
    ]);
  });

  it('un gruppo compresso si apre per identificativo; senza compressione si vede tutto', () => {
    const root = compareValues(a, b).root;
    const closed = flattenTree(root, { hideSame: true, expanded: new Set() }).rows;
    const fold = closed.find((r) => r.fold)!;
    const opened = flattenTree(root, { hideSame: true, expanded: new Set([fold.id]) }).rows;
    expect(opened.length).toBeGreaterThan(closed.length - 1);
    const all = flattenTree(root, { hideSame: false, expanded: new Set() }).rows;
    expect(all.some((r) => r.fold)).toBe(false);
    expect(all.map((r) => r.label)).toContain('e');
  });

  it('i gruppi coincidono con l\'ordine dell\'elenco delle differenze', () => {
    const r = compareValues(a, b);
    const { rows } = flattenTree(r.root, { hideSame: false, expanded: new Set() });
    const byGroup = rows.filter((x) => x.group >= 0).map((x) => x.id);
    expect(byGroup).toEqual(r.differences.map((d) => d.pointer));
  });

  it('il tetto alle righe tronca senza errori', () => {
    const big = { l: Array.from({ length: 500 }, (_, i) => i) };
    const out = flattenTree(compareValues(big, big).root, { hideSame: false, expanded: new Set(), maxRows: 50 });
    expect(out.rows.length).toBe(50);
    expect(out.truncated).toBe(true);
  });

  it('filtro dei tipi per l\'elenco', () => {
    const r = compareValues({ a: 1, b: 1 }, { a: 2, c: 1 });
    expect(filterDifferences(r.differences, new Set(['added'])).map((d) => d.pointer)).toEqual(['/c']);
    expect(filterDifferences(r.differences, new Set()).length).toBe(0);
  });
});

describe('json-diff: prestazioni', () => {
  it('qualche migliaio di nodi in tempi brevi, anche come insiemi e per chiave', () => {
    const make = (shift: number) => Array.from({ length: 3000 }, (_, i) => ({ id: i, v: i % 7, tags: ['a', 'b', String(i)], o: { x: i + shift } }));
    const a = { items: make(0) };
    const b = { items: make(1).reverse() };
    for (const mode of ['set', 'key'] as const) {
      const t = performance.now();
      const r = compareValues(a, b, { arrayMode: mode, key: 'id' });
      expect(r.counts.total).toBeGreaterThan(0);
      expect(performance.now() - t).toBeLessThan(5000);
    }
  });
});
