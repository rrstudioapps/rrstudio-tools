// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { highlightParts, searchTree, stepMatch } from './json-search';

const doc = { utenti: [{ nome: 'Mario Rossi', eta: 34 }, { nome: 'Anna', note: null }], nomeFile: 'x', ok: true };

describe('searchTree', () => {
  it('trova chiavi e valori in ordine di documento', () => {
    const r = searchTree(doc, 'nome');
    expect(r.matches.map((m) => [m.id, m.field])).toEqual([
      ['/utenti/0/nome', 'key'],
      ['/utenti/1/nome', 'key'],
      ['/nomeFile', 'key'],
    ]);
  });
  it('trova anche nei valori, senza badare alle maiuscole', () => {
    const r = searchTree(doc, 'ROSSI');
    expect(r.matches).toEqual([{ path: ['utenti', 0, 'nome'], id: '/utenti/0/nome', field: 'value' }]);
  });
  it('cerca in numeri, booleani e null', () => {
    expect(searchTree(doc, '34').matches.map((m) => m.id)).toEqual(['/utenti/0/eta']);
    expect(searchTree(doc, 'true').matches.map((m) => m.id)).toEqual(['/ok']);
    expect(searchTree(doc, 'null').matches.map((m) => m.id)).toEqual(['/utenti/1/note']);
  });
  it('chiave e valore dello stesso nodo danno due risultati', () => {
    const r = searchTree({ ana: 'Ana' }, 'ana');
    expect(r.matches.map((m) => m.field)).toEqual(['key', 'value']);
  });
  it('gli indici degli array non sono chiavi', () => {
    expect(searchTree([10, 20, 30], '1').matches.map((m) => m.id)).toEqual(['/0']);
  });
  it('query vuota o senza risultati', () => {
    expect(searchTree(doc, '').matches).toEqual([]);
    expect(searchTree(doc, 'zzz')).toEqual({ matches: [], truncated: false });
  });
  it('si ferma al tetto e lo segnala', () => {
    const big = Array.from({ length: 100 }, () => 'aaa');
    const r = searchTree(big, 'a', 10);
    expect(r.matches).toHaveLength(10);
    expect(r.truncated).toBe(true);
    expect(searchTree(big, 'a', 100).truncated).toBe(true);
    expect(searchTree(big, 'a', 101).truncated).toBe(false);
  });
  it('radice semplice', () => {
    expect(searchTree('ciao', 'ia').matches).toEqual([{ path: [], id: '', field: 'value' }]);
  });
  it('percorsi con indici numerici e chiavi stringa', () => {
    const r = searchTree({ a: [{ b: 'x' }] }, 'x');
    expect(r.matches[0].path).toEqual(['a', 0, 'b']);
  });
});

describe('highlightParts', () => {
  it('marca le occorrenze', () => {
    expect(highlightParts('Mario Rossi', 'ri')).toEqual([
      { text: 'Ma', match: false },
      { text: 'ri', match: true },
      { text: 'o Rossi', match: false },
    ]);
  });
  it('più occorrenze e maiuscole', () => {
    const p = highlightParts('aAa', 'a');
    expect(p.filter((x) => x.match)).toHaveLength(3);
    expect(p.map((x) => x.text).join('')).toBe('aAa');
  });
  it('nessuna corrispondenza o query vuota: testo intero', () => {
    expect(highlightParts('abc', 'z')).toEqual([{ text: 'abc', match: false }]);
    expect(highlightParts('abc', '')).toEqual([{ text: 'abc', match: false }]);
  });
  it('ricompone sempre il testo originale', () => {
    for (const [t, q] of [['abcabc', 'bc'], ['xxxx', 'xx'], ['İstanbul', 'i']] as const)
      expect(highlightParts(t, q).map((x) => x.text).join('')).toBe(t);
  });
});

describe('stepMatch', () => {
  it('avanza e torna all\'inizio', () => {
    expect(stepMatch(-1, 3, 1)).toBe(0);
    expect(stepMatch(0, 3, 1)).toBe(1);
    expect(stepMatch(2, 3, 1)).toBe(0);
  });
  it('indietreggia circolarmente', () => {
    expect(stepMatch(-1, 3, -1)).toBe(2);
    expect(stepMatch(0, 3, -1)).toBe(2);
    expect(stepMatch(2, 3, -1)).toBe(1);
  });
  it('senza risultati', () => {
    expect(stepMatch(0, 0, 1)).toBe(-1);
  });
});
