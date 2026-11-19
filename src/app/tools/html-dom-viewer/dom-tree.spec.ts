// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { ancestorsOf, buildRows, cssPathOf, defaultOpen, domStats, parseHtml, runQuery, xpathOfNode } from './dom-tree';

const HTML = `<!DOCTYPE html><html><head><title>T</title></head><body>
<div id="main" class="a b"><p>Uno</p><p class="x">Due <b>forte</b></p><!-- nota --></div>
<ul><li>1</li><li>2</li><li>3</li></ul></body></html>`;
const doc = () => parseHtml(HTML);

describe('albero', () => {
  it('righe visibili secondo i nodi aperti, senza testi di soli spazi', () => {
    const d = doc();
    const all = new Set<number>(Array.from({ length: 200 }, (_, i) => i));
    const rows = buildRows(d, all).rows;
    expect(rows[0]).toMatchObject({ kind: 'doctype', depth: 0 });
    expect(rows.filter((r) => r.kind === 'el').map((r) => r.label).slice(0, 4)).toEqual(['html', 'head', 'title', 'body']);
    expect(rows.some((r) => r.kind === 'text' && r.label === '')).toBe(false);
    expect(rows.find((r) => r.kind === 'comment')?.label).toBe('nota');
    const closed = buildRows(d, new Set()).rows;
    expect(closed.map((r) => r.label)).toEqual(['<!DOCTYPE html>', 'html']);
    expect(closed[1].hasChildren).toBe(true);
    expect(closed[1].open).toBe(false);
  });
  it('apertura iniziale e antenati', () => {
    const d = doc();
    const open = defaultOpen(d, 2);
    const rows = buildRows(d, open).rows;
    expect(rows.some((r) => r.label === 'body')).toBe(true);
    expect(rows.some((r) => r.label === 'p')).toBe(false);
    const p = d.querySelector('p')!;
    const need = ancestorsOf(d, p);
    expect(buildRows(d, new Set(need)).rows.some((r) => r.node === p)).toBe(true);
  });
  it('tetto alle righe', () => {
    const d = parseHtml('<ul>' + '<li>x</li>'.repeat(50) + '</ul>');
    const r = buildRows(d, defaultOpen(d, 10), 20);
    expect(r.rows).toHaveLength(20);
    expect(r.truncated).toBe(true);
  });
  it('statistiche', () => {
    expect(domStats(doc())).toMatchObject({ elements: 12, ids: 1 });
  });
});

describe('percorsi', () => {
  it('selettore CSS con id o nth-of-type, e XPath', () => {
    const d = doc();
    expect(cssPathOf(d.querySelector('.x')!)).toBe('#main > p:nth-of-type(2)');
    expect(cssPathOf(d.querySelectorAll('li')[2])).toBe('html > body > ul > li:nth-of-type(3)');
    expect(xpathOfNode(d.querySelectorAll('li')[1])).toBe('/html/body/ul/li[2]');
    expect(d.evaluate('/html/body/ul/li[2]', d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue).toBe(d.querySelectorAll('li')[1]);
  });
});

describe('query', () => {
  it('CSS: nodi, nessun risultato e selettore non valido', () => {
    const d = doc();
    const r = runQuery(d, 'css', 'li');
    expect(r).toMatchObject({ ok: true, kind: 'nodes', total: 3 });
    expect(runQuery(d, 'css', '#main .x b')).toMatchObject({ total: 1 });
    expect(runQuery(d, 'css', 'nope')).toMatchObject({ ok: true, total: 0 });
    expect(runQuery(d, 'css', '[[')).toMatchObject({ ok: false });
    expect(runQuery(d, 'css', '  ')).toEqual({ ok: false, message: '' });
  });
  it('XPath: nodi, attributi e valori', () => {
    const d = doc();
    expect(runQuery(d, 'xpath', '//li')).toMatchObject({ ok: true, kind: 'nodes', total: 3 });
    expect(runQuery(d, 'xpath', '//div/@class')).toMatchObject({ kind: 'nodes', total: 1 });
    expect(runQuery(d, 'xpath', 'count(//li)')).toEqual({ ok: true, kind: 'value', value: '3' });
    expect(runQuery(d, 'xpath', '//li[')).toMatchObject({ ok: false });
  });
});
