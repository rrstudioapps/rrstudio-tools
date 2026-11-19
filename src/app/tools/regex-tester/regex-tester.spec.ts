// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './regex-examples';
import { explainPattern } from './regex-explain';
import { MAX_MATCHES, buildRegex, groupNames, highlightPieces, normalizeFlags, runRegex } from './regex-core';

const run = (pattern: string, flags: string, text: string, replacement: string | null = null) => runRegex({ pattern, flags, text, replacement });
const ok = (r: ReturnType<typeof run>) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('esecuzione', () => {
  it('trova tutte le corrispondenze con g e solo la prima senza', () => {
    const a = ok(run('\\d+', 'g', 'a1 b22 c333'));
    expect(a.matches.map((m) => [m.index, m.text])).toEqual([[1, '1'], [4, '22'], [8, '333']]);
    expect(ok(run('\\d+', '', 'a1 b22')).matches).toHaveLength(1);
    expect(ok(run('\\d+', 'i', 'a1 b22')).matches).toHaveLength(1);
  });
  it('gruppi numerati, con nome e non partecipanti', () => {
    const r = ok(run('(?<y>\\d{4})-(\\d{2})(-(\\d{2}))?', 'g', 'data 2026-03 e 2027-04-15'));
    expect(r.groupCount).toBe(4);
    expect(r.matches[0].groups.map((g) => [g.index, g.name, g.text])).toEqual([[1, 'y', '2026'], [2, null, '03'], [3, null, null], [4, null, null]]);
    expect(r.matches[1].groups[3].text).toBe('15');
  });
  it('indici dei gruppi con il flag d', () => {
    const r = ok(run('(b+)', 'dg', 'aabbb'));
    expect(r.matches[0].groups[0]).toMatchObject({ start: 2, end: 5, text: 'bbb' });
    expect(ok(run('(b+)', 'g', 'aabbb')).matches[0].groups[0].start).toBeNull();
  });
  it('flag: i, m, s, u, y', () => {
    expect(ok(run('ciao', 'gi', 'CIAO Ciao')).matches).toHaveLength(2);
    expect(ok(run('^b', 'gm', 'a\nb\nb')).matches).toHaveLength(2);
    expect(ok(run('a.b', 's', 'a\nb')).matches).toHaveLength(1);
    expect(ok(run('a.b', '', 'a\nb')).matches).toHaveLength(0);
    expect(ok(run('^.$', 'u', '😀')).matches).toHaveLength(1);
    expect(ok(run('^.$', '', '😀')).matches).toHaveLength(0);
    // sticky: solo dove si guarda (indice 0)
    expect(ok(run('a', 'gy', 'aab')).matches).toHaveLength(2);
    expect(ok(run('b', 'gy', 'aab')).matches).toHaveLength(0);
  });
  it('corrispondenze vuote non bloccano il ciclo', () => {
    const r = ok(run('x*', 'g', 'axb'));
    expect(r.matches.map((m) => m.text)).toEqual(['', 'x', '', '']);
    expect(ok(run('', 'gu', '😀')).matches).toHaveLength(2); // prima e dopo la emoji, non nel mezzo
  });
  it('limita il numero di corrispondenze', () => {
    const r = ok(run('a', 'g', 'a'.repeat(MAX_MATCHES + 50)));
    expect(r.matches).toHaveLength(MAX_MATCHES);
    expect(r.truncated).toBe(true);
  });
  it('errori di sintassi con il messaggio del motore', () => {
    const r = run('(abc', 'g', 'x');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/Invalid regular expression|Unterminated group/i);
    const f = run('a', 'gg', 'x');
    expect(f.ok).toBe(true); // flag duplicati normalizzati
    expect(typeof buildRegex('[', '')).toBe('string');
    expect(buildRegex('a', 'z' as string)).toBeInstanceOf(RegExp);
  });
  it('flag normalizzati e deduplicati', () => {
    expect(normalizeFlags('ygig')).toBe('giy');
  });
});

describe('sostituzione', () => {
  it('$1, $<nome>, $& e $$', () => {
    expect(ok(run('(\\w+)@(\\w+)', 'g', 'a@b c@d', '$2:$1')).replaced).toBe('b:a d:c');
    expect(ok(run('(?<n>\\d+)', 'g', 'a1b22', '[$<n>]')).replaced).toBe('a[1]b[22]');
    expect(ok(run('\\d+', 'g', 'a1b22', '<$&>')).replaced).toBe('a<1>b<22>');
    expect(ok(run('\\d', 'g', 'a1', '$$')).replaced).toBe('a$');
    expect(ok(run('\\d+', '', 'a1b22', '#')).replaced).toBe('a#b22'); // senza g solo la prima
    expect(ok(run('a', 'g', 'aaa', null)).replaced).toBeNull();
  });
});

describe('nomi dei gruppi', () => {
  it('ignora lookaround, classi e parentesi protette', () => {
    expect(groupNames('(a)(?<x>b)(?:c)(?=d)(?<!e)(?<y>f)\\(g\\)[(]')).toEqual([null, 'x', 'y']);
  });
});

describe('evidenziazione', () => {
  it('parti normali e corrispondenze, salta le vuote', () => {
    const text = 'ab12cd345';
    const r = ok(run('\\d+', 'g', text));
    expect(highlightPieces(text, r.matches)).toEqual([
      { text: 'ab', match: null },
      { text: '12', match: 0 },
      { text: 'cd', match: null },
      { text: '345', match: 1 },
    ]);
    expect(highlightPieces('abc', ok(run('x*', 'g', 'abc')).matches)).toEqual([{ text: 'abc', match: null }]);
    expect(highlightPieces('', [])).toEqual([]);
  });
});

describe('spiegazione', () => {
  it('token comuni in italiano', () => {
    const e = explainPattern('^(\\d{3})-[a-z]+$', 'it');
    expect(e.map((x) => x.token)).toEqual(['^', '(', '\\d', '{3}', ')', '-', '[a-z]', '+', '$']);
    expect(e[2].text).toBe('una cifra (0-9)');
    expect(e[3].text).toBe('esattamente 3 volte');
    expect(e[1].depth).toBe(0);
    expect(e[2].depth).toBe(1);
    expect(e[4].depth).toBe(0);
  });
  it('in inglese e con gruppi con nome, lookahead, classi negate, lazy, alternanza', () => {
    const e = explainPattern('(?<id>a|b)(?=c)[^x-z]+?', 'en');
    expect(e.map((x) => x.token)).toEqual(['(?<id>', 'a', '|', 'b', ')', '(?=', 'c', ')', '[^x-z]', '+?']);
    expect(e[0].text).toContain('named group “id”');
    expect(e[2].text).toBe('or');
    expect(e[8].text).toBe('any character except: «x»-«z»');
    expect(e[9].text).toBe('one or more times, as few as possible');
  });
  it('il quantificatore si applica all’ultimo carattere del testo letterale', () => {
    const e = explainPattern('abc+', 'it');
    expect(e.map((x) => x.token)).toEqual(['ab', 'c', '+']);
    expect(e[0].text).toBe('il testo «ab»');
  });
  it('escape letterali, backreference, unicode, graffe non quantificatori', () => {
    expect(explainPattern('\\.\\1\\u00e8\\p{L}', 'en').map((x) => x.token)).toEqual(['.', '\\1', '\\u00e8', '\\p{L}']);
    expect(explainPattern('a{,3}', 'it').map((x) => x.token)).toEqual(['a{,3}']);
    expect(explainPattern('x{2,}', 'it')[1].text).toBe('almeno 2 volte');
    expect(explainPattern('x{2,5}', 'it')[1].text).toBe('da 2 a 5 volte');
    expect(explainPattern('', 'it')).toEqual([]);
  });
  it('non solleva mai eccezioni su pattern strani', () => {
    for (const p of ['(', ')', '[', '\\', '(?<', '[a-', '{', '}}', '(?<n', '\\k<', '\\u', '\\p{', 'a**', '(?']) {
      expect(() => explainPattern(p, 'it')).not.toThrow();
    }
  });
});

describe('esempi', () => {
  for (const ex of EXAMPLES) {
    it(`l'esempio «${ex.name.en}» è valido e trova qualcosa`, () => {
      const r = ok(run(ex.pattern, ex.flags, ex.text, ex.replacement));
      expect(r.matches.length, ex.id).toBeGreaterThan(0);
    });
  }
  it('conteggi attesi sugli esempi', () => {
    const by = (id: string) => ok(run(EXAMPLES.find((e) => e.id === id)!.pattern, EXAMPLES.find((e) => e.id === id)!.flags, EXAMPLES.find((e) => e.id === id)!.text));
    expect(by('email').matches.map((m) => m.text)).toEqual(['mario.rossi@example.com', 'info+ordini@esempio.it']);
    expect(by('date').matches.map((m) => m.text)).toEqual(['05/03/2026', '17-11-2027']);
    expect(by('cap').matches.map((m) => m.text)).toEqual(['00100', '20100']);
    expect(by('cf').matches).toHaveLength(1);
    expect(by('iban').matches).toHaveLength(1);
    expect(by('url').matches).toHaveLength(3);
  });
});
