// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { Change, diffXml, summarize } from './xml-diff';

const OPT = { ignoreWhitespace: true };
const diff = (a: string, b: string, o = OPT): Change[] => {
  const r = diffXml(a, b, o);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.changes;
};

describe('confronto XML', () => {
  it('documenti uguali, anche con attributi in ordine diverso e rientri diversi', () => {
    expect(diff('<a x="1" y="2"><b>t</b></a>', '<a y="2" x="1">\n  <b>\n t \n</b>\n</a>')).toEqual([]);
  });
  it('spazi significativi se richiesto', () => {
    expect(diff('<a>t</a>', '<a> t </a>', { ignoreWhitespace: false })).toHaveLength(1);
  });
  it('attributi: aggiunto, tolto, cambiato', () => {
    expect(diff('<a x="1" y="2"/>', '<a x="9" z="3"/>')).toEqual([
      { kind: 'attr-changed', xpath: '/a', name: 'x', before: '1', after: '9' },
      { kind: 'attr-removed', xpath: '/a', name: 'y', before: '2' },
      { kind: 'attr-added', xpath: '/a', name: 'z', after: '3' },
    ]);
  });
  it('testo cambiato, confrontato decodificato', () => {
    expect(diff('<a><b>x &amp; y</b></a>', '<a><b>x &amp; y</b></a>')).toEqual([]);
    expect(diff('<a><b>uno</b></a>', '<a><b>due</b></a>')).toEqual([{ kind: 'text', xpath: '/a/b', before: 'uno', after: 'due' }]);
  });
  it('elementi aggiunti e tolti, con indice tra fratelli omonimi', () => {
    const c = diff('<l><i id="1"/><i id="2"/></l>', '<l><i id="2"/><i id="3"/></l>');
    expect(c).toEqual([
      { kind: 'removed', xpath: '/l/i[1]' },
      { kind: 'added', xpath: '/l/i[2]' },
    ]);
  });
  it('un inserimento all\'inizio non sposta tutto: l\'allineamento usa l\'id', () => {
    const c = diff('<l><i id="1">a</i><i id="2">b</i></l>', '<l><i id="0">z</i><i id="1">a</i><i id="2">b</i></l>');
    expect(c).toEqual([{ kind: 'added', xpath: '/l/i[1]' }]);
  });
  it('senza id si allinea per nome e confronta nell\'ordine', () => {
    const c = diff('<l><i>a</i><i>b</i></l>', '<l><i>a</i><i>c</i></l>');
    expect(c).toEqual([{ kind: 'text', xpath: '/l/i[2]', before: 'b', after: 'c' }]);
  });
  it('radice rinominata', () => {
    expect(diff('<a/>', '<b/>')).toEqual([{ kind: 'renamed', xpath: '/b', before: 'a', after: 'b' }]);
  });
  it('errore di buona formazione: indica il lato', () => {
    const r = diffXml('<a>', '<a/>', OPT);
    expect(r.ok === false && r.side).toBe('a');
    const r2 = diffXml('<a/>', '<a><b></a>', OPT);
    expect(r2.ok === false && r2.side).toBe('b');
  });
  it('riepilogo', () => {
    expect(summarize(diff('<a x="1"><b/></a>', '<a x="2"><c/></a>'))).toEqual({ added: 1, removed: 1, changed: 1 });
  });
});
