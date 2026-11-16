// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { EXPAND_BUDGET, NodeRow, PAGE_SIZE, childCount, childrenSlice, expandToLevel, flattenTree, remapExpanded, revealPath } from './json-tree';

const doc = { utenti: [{ nome: 'Ada', tag: ['x', 'y'] }, { nome: 'Bo' }], n: 3, vuoto: {}, lista: [] };
const nodes = (rows: ReturnType<typeof flattenTree>) => rows.filter((r): r is NodeRow => r.kind === 'node');
const none = new Set<string>();
const noShown = new Map<string, number>();

describe('childCount / childrenSlice', () => {
  it('conta i figli', () => {
    expect(childCount(doc)).toBe(4);
    expect(childCount([1, 2])).toBe(2);
    expect(childCount('x')).toBe(0);
    expect(childCount(null)).toBe(0);
  });
  it('prende solo i primi N', () => {
    expect(childrenSlice([1, 2, 3, 4], 2)).toEqual([[0, 1], [1, 2]]);
    expect(childrenSlice({ a: 1, b: 2, c: 3 }, 2)).toEqual([['a', 1], ['b', 2]]);
    expect(childrenSlice(5, 2)).toEqual([]);
  });
});

describe('flattenTree', () => {
  it('con tutto chiuso c\'è solo la radice', () => {
    const rows = flattenTree(doc, none, noShown);
    expect(rows).toHaveLength(1);
    const r = rows[0] as NodeRow;
    expect(r.id).toBe('');
    expect(r.type).toBe('object');
    expect(r.count).toBe(4);
    expect(r.expanded).toBe(false);
    expect(r.parentType).toBeNull();
  });
  it('aperta la radice mostra i figli in ordine, con profondità e posizione', () => {
    const rows = nodes(flattenTree(doc, new Set(['']), noShown));
    expect(rows.map((r) => r.id)).toEqual(['', '/utenti', '/n', '/vuoto', '/lista']);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 1, 1]);
    expect(rows[2]).toMatchObject({ index: 1, size: 4, parentType: 'object', key: 'n', type: 'number' });
  });
  it('apre in profondità, in ordine di documento (preordine)', () => {
    const open = new Set(['', '/utenti', '/utenti/0', '/utenti/0/tag']);
    const rows = nodes(flattenTree(doc, open, noShown));
    expect(rows.map((r) => r.id)).toEqual([
      '', '/utenti', '/utenti/0', '/utenti/0/nome', '/utenti/0/tag', '/utenti/0/tag/0', '/utenti/0/tag/1',
      '/utenti/1', '/n', '/vuoto', '/lista',
    ]);
    expect(rows.find((r) => r.id === '/utenti/1')).toMatchObject({ parentType: 'array', index: 1, size: 2 });
  });
  it('un contenitore vuoto non risulta mai aperto', () => {
    const rows = nodes(flattenTree(doc, new Set(['', '/vuoto']), noShown));
    expect(rows.find((r) => r.id === '/vuoto')!.expanded).toBe(false);
  });
  it('paginazione: solo i primi PAGE_SIZE figli, poi la riga "mostra altri"', () => {
    const big = Array.from({ length: 250 }, (_, i) => i);
    const rows = flattenTree(big, new Set(['']), noShown);
    expect(rows).toHaveLength(1 + PAGE_SIZE + 1);
    const more = rows[rows.length - 1];
    expect(more).toMatchObject({ kind: 'more', parentId: '', remaining: 150, depth: 1 });
  });
  it('allargando la pagina compaiono altri figli', () => {
    const big = Array.from({ length: 250 }, (_, i) => i);
    const rows = flattenTree(big, new Set(['']), new Map([['', 200]]));
    expect(rows).toHaveLength(1 + 200 + 1);
    expect(rows[rows.length - 1]).toMatchObject({ kind: 'more', remaining: 50 });
    const all = flattenTree(big, new Set(['']), new Map([['', 300]]));
    expect(all).toHaveLength(251);
    expect(all.some((r) => r.kind === 'more')).toBe(false);
  });
  it('rende pigro: un array enorme chiuso o aperto produce poche righe', () => {
    const big = Array.from({ length: 200_000 }, (_, i) => ({ i }));
    const t0 = Date.now();
    expect(flattenTree(big, new Set(['']), noShown)).toHaveLength(PAGE_SIZE + 2);
    expect(Date.now() - t0).toBeLessThan(500);
  });
  it('la riga "mostra altri" sta dopo i figli del nodo e prima dei fratelli', () => {
    const d = { a: Array.from({ length: 150 }, (_, i) => i), b: 1 };
    const rows = flattenTree(d, new Set(['', '/a']), noShown);
    const idx = rows.findIndex((r) => r.kind === 'more');
    expect(rows[idx - 1]).toMatchObject({ id: '/a/99' });
    expect(rows[idx + 1]).toMatchObject({ id: '/b' });
  });
  it('nessuna ricorsione: regge un annidamento molto profondo', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 2_000; i++) deep = [deep];
    const open = new Set<string>(['']);
    let p = '';
    for (let i = 0; i < 1_999; i++) open.add((p += '/0'));
    expect(() => flattenTree(deep, open, noShown)).not.toThrow();
  });
  it('gli id sono unici anche con chiavi con barre', () => {
    const rows = nodes(flattenTree({ 'a/b': 1, a: { b: 2 } }, new Set(['', '/a']), noShown));
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });
});

describe('expandToLevel', () => {
  it('livello 1: solo la radice; 2: anche i suoi figli contenitori', () => {
    expect([...expandToLevel(doc, 1).ids]).toEqual(['']);
    expect([...expandToLevel(doc, 2).ids].sort()).toEqual(['', '/utenti']);
    expect([...expandToLevel(doc, 3).ids].sort()).toEqual(['', '/utenti', '/utenti/0', '/utenti/1']);
  });
  it('livello 0 non apre nulla; i valori semplici non si aprono', () => {
    expect(expandToLevel(doc, 0).ids.size).toBe(0);
    expect(expandToLevel(5, 3).ids.size).toBe(0);
  });
  it('"tutto" (livello alto) apre tutti i contenitori non vuoti', () => {
    expect([...expandToLevel(doc, 99).ids].sort()).toEqual(['', '/utenti', '/utenti/0', '/utenti/0/tag', '/utenti/1']);
  });
  it('rispetta il tetto di nodi, tenendo i livelli alti', () => {
    const wide = Array.from({ length: 50 }, () => [[1], [2]]);
    const r = expandToLevel(wide, 99, 10);
    expect(r.truncated).toBe(true);
    expect(r.ids.size).toBe(10);
    expect(r.ids.has('')).toBe(true);
    expect(expandToLevel(doc, 99).truncated).toBe(false);
  });
  it('il tetto di default è finito', () => {
    const big = Array.from({ length: 100 }, () => Array.from({ length: 100 }, () => [1]));
    const r = expandToLevel(big, 99);
    expect(r.ids.size).toBeLessThanOrEqual(EXPAND_BUDGET);
  });
});

describe('revealPath', () => {
  it('apre tutti gli antenati e non il nodo stesso', () => {
    const r = revealPath(doc, ['utenti', 0, 'tag', 1], none, noShown);
    expect([...r.expanded].sort()).toEqual(['', '/utenti', '/utenti/0', '/utenti/0/tag']);
  });
  it('allarga la pagina fino a includere l\'elemento', () => {
    const big = { lista: Array.from({ length: 1000 }, (_, i) => i) };
    const r = revealPath(big, ['lista', 537], none, noShown);
    expect(r.shown.get('/lista')).toBe(600);
    const rows = nodes(flattenTree(big, r.expanded, r.shown));
    expect(rows.some((x) => x.id === '/lista/537')).toBe(true);
  });
  it('funziona anche con le chiavi di un oggetto grande', () => {
    const o = Object.fromEntries(Array.from({ length: 300 }, (_, i) => ['k' + i, i]));
    const r = revealPath(o, ['k250'], none, noShown);
    expect(r.shown.get('')).toBe(300);
  });
  it('non riduce una pagina già più grande e non muta gli argomenti', () => {
    const ex = new Set(['']);
    const sh = new Map([['', 500]]);
    const r = revealPath(Array.from({ length: 1000 }, (_, i) => i), [3], ex, sh);
    expect(r.shown.get('')).toBe(500);
    expect(ex.size).toBe(1);
    expect(r.expanded).not.toBe(ex);
  });
});

describe('remapExpanded', () => {
  it('sposta il nodo e i suoi discendenti, non i vicini simili', () => {
    const out = remapExpanded(new Set(['', '/a', '/a/b', '/ab', '/c']), '/a', '/z');
    expect([...out].sort()).toEqual(['', '/ab', '/c', '/z', '/z/b']);
  });
});
