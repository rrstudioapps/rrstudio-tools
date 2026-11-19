// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { normalizeNewlines, parseXml } from '../xml-formatter/xml';
import {
  Doc, addChild, duplicateNode, editableText, escapeAttr, expandLevels, flatten, getNode, moveNode, nearestPath, removeAttr, removeNode,
  renameElement, rawNodes, reveal, ROW_H, scrollToRow, searchDoc, setAttr, setText, unescapeXml, visibleWindow, xmlStats, xpathOf,
} from './xml-tree';

const SRC = `<?xml version="1.0"?>
<!-- catalogo -->
<lib n="1">
  <book id="a"><t>Uno &amp; due</t></book>
  <book id="b"><t>Tre</t><![CDATA[x<y]]></book>
  <empty/>
</lib>`;

function load(src = SRC): Doc {
  const r = parseXml(normalizeNewlines(src));
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.nodes;
}
const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => {
  expect(r.ok).toBe(true);
  return r as Extract<T, { ok: true }>;
};
const LIB = [2];

describe('entità', () => {
  it('decodifica e ricodifica', () => {
    expect(unescapeXml('a &amp; b &lt;c&gt; &#233; &#x1F600; &mio;')).toBe('a & b <c> é 😀 &mio;');
    expect(escapeAttr('a"b<&', '"')).toBe('a&quot;b&lt;&amp;');
    expect(escapeAttr("it's", "'")).toBe('it&apos;s');
  });
});

describe('lettura', () => {
  const doc = load();
  it('percorsi XPath', () => {
    expect(xpathOf(doc, LIB)).toBe('/lib');
    expect(xpathOf(doc, [2, 1])).toBe('/lib/book[1]');
    expect(xpathOf(doc, [2, 3, 0])).toBe('/lib/book[2]/t');
    expect(xpathOf(doc, [2, 5])).toBe('/lib/empty');
    expect(xpathOf(doc, [1])).toBe('/comment()');
  });
  it('testo modificabile e statistiche', () => {
    expect(editableText(getNode(doc, [2, 1, 0])!)).toBe('Uno & due');
    expect(editableText(getNode(doc, LIB)!)).toBeNull();
    expect(xmlStats(doc)).toEqual({ elements: 6, attributes: 3, depth: 3 });
  });
  it('nearestPath risale se il nodo non esiste', () => {
    expect(getNode(doc, nearestPath(doc, [2, 99, 4]))).not.toBeNull();
  });
});

describe('albero visibile', () => {
  const doc = load();
  it('mostra gli elementi con solo testo su una riga e salta gli spazi', () => {
    const { rows } = flatten(doc, new Set(['2']));
    expect(rows.map((r) => r.depth)).toEqual([0, 0, 0, 1, 1, 1]);
    const t = flatten(doc, new Set(['2', '2.1'])).rows.find((r) => r.key === '2.1.0')!;
    expect(t.text).toBe('Uno & due');
  });
  it('apre per livelli e rivela gli antenati', () => {
    expect([...expandLevels(doc, 1)]).toEqual(['2']);
    expect([...reveal(new Set(), [2, 3, 0])].sort()).toEqual(['2', '2.3']);
  });
  it('cerca in nome, attributi e testo', () => {
    expect(searchDoc(doc, 'BOOK')).toEqual([[2, 1], [2, 3]]);
    expect(searchDoc(doc, 'uno &')).toEqual([[2, 1, 0]]);
    expect(searchDoc(doc, 'id')).toEqual([[2, 1], [2, 3]]);
    expect(searchDoc(doc, '')).toEqual([]);
  });
});

describe('modifica', () => {
  const doc = load();
  it('rinomina un elemento e rifiuta nomi non validi', () => {
    const r = ok(renameElement(doc, [2, 1], 'libro'));
    expect(rawNodes(r.doc)).toContain('<libro id="a"><t>Uno &amp; due</t></libro>');
    expect(renameElement(doc, [2, 1], '1x')).toEqual({ ok: false, error: 'invalid' });
    expect(doc).toBe(doc);
    expect(rawNodes(doc)).toContain('<book id="a">');
  });
  it('attributi: modifica, aggiunge, rifiuta doppi, elimina', () => {
    const a = ok(setAttr(doc, [2, 1], 0, 'id', 'x"y&'));
    expect(rawNodes(a.doc)).toContain('id="x&quot;y&amp;"');
    const b = ok(setAttr(a.doc, [2, 1], -1, 'lang', 'it'));
    expect(rawNodes(b.doc)).toContain('lang="it"');
    expect(setAttr(b.doc, [2, 1], -1, 'lang', 'en')).toEqual({ ok: false, error: 'duplicate' });
    expect(rawNodes(ok(removeAttr(b.doc, [2, 1], 0)).doc)).toContain('<book lang="it">');
  });
  it('testo: elemento, commento, CDATA', () => {
    const a = ok(setText(doc, [2, 1, 0], 'a < b & c'));
    expect(rawNodes(a.doc)).toContain('<t>a &lt; b &amp; c</t>');
    expect(setText(doc, [2, 1], 'q').ok).toBe(false); // ha un elemento figlio
    expect(rawNodes(ok(setText(doc, [1], ' nuovo ')).doc)).toContain('<!-- nuovo -->');
    expect(setText(doc, [1], 'a--b')).toEqual({ ok: false, error: 'invalid' });
    expect(rawNodes(ok(setText(doc, [2, 5], 'pieno')).doc)).toContain('<empty>pieno</empty>');
    expect(rawNodes(ok(setText(ok(setText(doc, [2, 5], 'pieno')).doc, [2, 5], '')).doc)).toContain('<empty/>');
  });
  it('aggiunge figli e rende l\'elemento non più autochiuso', () => {
    const r = ok(addChild(doc, [2, 5], 'el', 'nuovo'));
    expect(rawNodes(r.doc)).toContain('<empty><nuovo/></empty>');
    expect(getNode(r.doc, r.path)).toMatchObject({ t: 'el', name: 'nuovo' });
    expect(addChild(doc, [1], 'el').ok).toBe(false);
    expect(rawNodes(ok(addChild(doc, [2, 5], 'comment')).doc)).toContain('<!-- commento -->');
  });
  it('elimina, duplica e sposta', () => {
    expect(removeNode(doc, LIB)).toEqual({ ok: false, error: 'root' });
    expect(duplicateNode(doc, LIB)).toEqual({ ok: false, error: 'root' });
    const rm = ok(removeNode(doc, [2, 1]));
    expect(rawNodes(rm.doc)).not.toContain('id="a"');
    expect(getNode(rm.doc, rm.path)).not.toBeNull();
    const dup = ok(duplicateNode(doc, [2, 1]));
    expect(rawNodes(dup.doc).match(/id="a"/g)).toHaveLength(2);
    const mv = ok(moveNode(doc, [2, 1], 1));
    expect(rawNodes(mv.doc).indexOf('id="b"')).toBeLessThan(rawNodes(mv.doc).indexOf('id="a"'));
    expect(getNode(mv.doc, mv.path)).toMatchObject({ attrs: [{ name: 'id', value: 'a' }] });
    expect(moveNode(doc, [2, 5], 1)).toEqual({ ok: false, error: 'notfound' });
  });
  it('l\'originale non cambia e inner resta coerente', () => {
    const before = rawNodes(doc);
    const r = ok(setText(doc, [2, 1, 0], 'z'));
    expect(rawNodes(doc)).toBe(before);
    const lib = r.doc[2] as Extract<(typeof r.doc)[number], { t: 'el' }>;
    expect(lib.inner).toBe(rawNodes(lib.children));
  });
});

describe('file grandi: rendering a finestra', () => {
  const big = (n: number): Doc => load(`<r>${Array.from({ length: n }, (_, i) => `<i id="${i}">v${i}</i>`).join('')}</r>`);

  it('oltre le vecchie 4000 righe l\'albero non si tronca', () => {
    const doc = big(30_000);
    const open = expandLevels(doc, 1);
    const f = flatten(doc, open);
    expect(f.truncated).toBe(false);
    expect(f.rows.length).toBe(30_001);
    expect(f.rows[30_000].node).toMatchObject({ t: 'el', attrs: [{ name: 'id', value: '29999' }] });
  });
  it('il tetto di sicurezza tronca e lo segnala', () => {
    const f = flatten(big(500), expandLevels(big(500), 1), 100);
    expect(f.rows.length).toBe(100);
    expect(f.truncated).toBe(true);
  });
  it('centomila nodi si appiattiscono in tempi accettabili', () => {
    const doc = big(100_000);
    const t0 = performance.now();
    const f = flatten(doc, expandLevels(doc, 1));
    expect(f.rows.length).toBe(100_000);
    expect(f.truncated).toBe(true);
    expect(performance.now() - t0).toBeLessThan(3000);
  });
  it('visibleWindow: righe visibili più il margine, sempre nei limiti', () => {
    expect(visibleWindow(0, 0, 500)).toEqual({ start: 0, end: 0 });
    expect(visibleWindow(1000, 0, 280, ROW_H, 4)).toEqual({ start: 0, end: 14 });
    expect(visibleWindow(1000, 28 * 100, 280, ROW_H, 4)).toEqual({ start: 96, end: 114 });
    const last = visibleWindow(1000, 28 * 990, 280, ROW_H, 4);
    expect(last.end).toBe(1000);
    expect(last.start).toBeLessThan(1000);
    expect(visibleWindow(5, 99999, 280).end).toBe(5);
  });
  it('visibleWindow: poche righe in cima, molte nel DOM solo se visibili', () => {
    const w = visibleWindow(100_000, 28 * 50_000, 520);
    expect(w.end - w.start).toBeLessThan(40);
  });
  it('scrollToRow: sposta il minimo necessario', () => {
    expect(scrollToRow(5, 0, 280)).toBe(0); // già visibile
    expect(scrollToRow(20, 0, 280)).toBe(20 * ROW_H + ROW_H - 280); // sotto: allinea in basso
    expect(scrollToRow(2, 28 * 50, 280)).toBe(28 * 2); // sopra: allinea in alto
  });
});
