// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE, MAX_PREVIEW_MATCHES, Rule, buildRuleRegex, escapeRegex, highlightPieces, isActive, runRules } from './find-replace-core';

const rule = (o: Partial<Rule> = {}): Rule => ({ ...DEFAULT_RULE, ...o, flags: { ...DEFAULT_RULE.flags, ...(o.flags ?? {}) } });
const run = (text: string, rules: Rule[], previewRule = 0) => runRules({ text, rules, previewRule });

describe('testo semplice', () => {
  it('sostituisce tutte le occorrenze senza distinguere le maiuscole', () => {
    const r = run('Gatto gatto GATTO', [rule({ find: 'gatto', replace: 'cane' })]);
    expect(r.output).toBe('cane cane cane');
    expect(r.outcomes[0]).toMatchObject({ applied: true, count: 3, error: null });
  });
  it('sensibile alle maiuscole', () => {
    const r = run('Gatto gatto GATTO', [rule({ find: 'gatto', replace: 'cane', caseSensitive: true })]);
    expect(r.output).toBe('Gatto cane GATTO');
    expect(r.outcomes[0].count).toBe(1);
  });
  it('i caratteri speciali sono letterali e $ nella sostituzione non è speciale', () => {
    const r = run('a.b (c) [d] $1 a+b', [
      rule({ find: '.', replace: '$&$&' }),
      rule({ find: '(c)', replace: '$1' }),
      rule({ find: 'a+b', replace: '\\' }),
    ]);
    expect(r.output).toBe('a$&$&b $1 [d] $1 \\');
  });
  it('parola intera, anche con lettere accentate', () => {
    const r = run('città cittàdina la città. cit', [rule({ find: 'città', replace: 'X', wholeWord: true })]);
    expect(r.output).toBe('X cittàdina la X. cit');
    expect(run('pane panetto', [rule({ find: 'pane', replace: 'X', wholeWord: true })]).output).toBe('X panetto');
    expect(run('a_b a', [rule({ find: 'a', replace: 'X', wholeWord: true })]).output).toBe('a_b X');
  });
  it('emoji e caratteri fuori dal piano base', () => {
    expect(run('a😀b😀', [rule({ find: '😀', replace: ':)' })]).output).toBe('a:)b:)');
  });
  it('trova vuoto o regola disattivata non fanno nulla', () => {
    const r = run('abc', [rule({ find: '', replace: 'x' }), rule({ find: 'a', replace: 'x', enabled: false })]);
    expect(r.output).toBe('abc');
    expect(r.outcomes.every((o) => !o.applied)).toBe(true);
    expect(isActive(rule({ find: 'a' }))).toBe(true);
    expect(isActive(rule({ find: 'a', enabled: false }))).toBe(false);
  });
  it('si può sostituire con il testo vuoto (eliminare)', () => {
    expect(run('a-b-c', [rule({ find: '-', replace: '' })]).output).toBe('abc');
  });
});

describe('regex', () => {
  it('gruppi numerati e nominati', () => {
    const r = run('2026-11-17', [rule({ mode: 'regex', find: '(\\d+)-(\\d+)-(\\d+)', replace: '$3/$2/$1' })]);
    expect(r.output).toBe('17/11/2026');
    const n = run('2026-11-17', [rule({ mode: 'regex', find: '(?<y>\\d+)-(?<m>\\d+)-(?<d>\\d+)', replace: '$<d>.$<m>.$<y>' })]);
    expect(n.output).toBe('17.11.2026');
    expect(run('abc', [rule({ mode: 'regex', find: 'b', replace: '[$&]' })]).output).toBe('a[b]c');
  });
  it('senza il flag g sostituisce solo la prima', () => {
    const r = run('a a a', [rule({ mode: 'regex', find: 'a', replace: 'b', flags: { g: false, m: false, s: false, u: false } })]);
    expect(r.output).toBe('b a a');
    expect(r.outcomes[0].count).toBe(1);
  });
  it('flag m, s e i', () => {
    expect(run('a\nb', [rule({ mode: 'regex', find: '^b', replace: 'X', flags: { g: true, m: true, s: false, u: false } })]).output).toBe('a\nX');
    expect(run('a\nb', [rule({ mode: 'regex', find: '^b', replace: 'X' })]).output).toBe('a\nb');
    expect(run('a\nb', [rule({ mode: 'regex', find: 'a.b', replace: 'X', flags: { g: true, m: false, s: true, u: false } })]).output).toBe('X');
    expect(run('a\nb', [rule({ mode: 'regex', find: 'a.b', replace: 'X' })]).output).toBe('a\nb');
    expect(run('ABC', [rule({ mode: 'regex', find: 'b', replace: 'x', caseSensitive: true })]).output).toBe('ABC');
    expect(run('ABC', [rule({ mode: 'regex', find: 'b', replace: 'x' })]).output).toBe('AxC');
  });
  it('flag u: proprietà Unicode', () => {
    const r = run('Città 42', [rule({ mode: 'regex', find: '\\p{L}+', replace: 'W', flags: { g: true, m: false, s: false, u: true } })]);
    expect(r.output).toBe('W 42');
  });
  it('parola intera in modalità regex', () => {
    expect(run('cat concat cat.', [rule({ mode: 'regex', find: 'cat', replace: 'dog', wholeWord: true })]).output).toBe('dog concat dog.');
    // l'alternanza resta racchiusa nel gruppo
    expect(run('a ab abc', [rule({ mode: 'regex', find: 'a|ab', replace: 'X', wholeWord: true })]).output).toBe('X X abc');
  });
  it('regex non valida: errore e testo invariato', () => {
    const r = run('abc', [rule({ mode: 'regex', find: '(' }), rule({ find: 'b', replace: 'X' })]);
    expect(r.outcomes[0].error).toBeTruthy();
    expect(r.outcomes[0].applied).toBe(false);
    expect(r.output).toBe('aXc');
    expect(typeof buildRuleRegex(rule({ mode: 'regex', find: '[' }))).toBe('string');
  });
  it('corrispondenze vuote non causano cicli infiniti', () => {
    const r = run('abc', [rule({ mode: 'regex', find: 'x*', replace: '-' })]);
    expect(r.output).toBe('-a-b-c-');
    expect(r.outcomes[0].count).toBe(4);
  });
});

describe('più regole in sequenza', () => {
  it('ogni regola lavora sul risultato della precedente', () => {
    const r = run('uno due', [rule({ find: 'uno', replace: 'due' }), rule({ find: 'due', replace: 'tre' })]);
    expect(r.output).toBe('tre tre');
    expect(r.outcomes.map((o) => o.count)).toEqual([1, 2]);
  });
  it('l\'anteprima riguarda il testo che la regola scelta riceve', () => {
    const rules = [rule({ find: 'uno', replace: 'due' }), rule({ find: 'due', replace: 'tre' })];
    const p0 = run('uno due', rules, 0);
    expect(p0.previewText).toBe('uno due');
    expect(p0.previewMatches).toEqual([{ index: 0, end: 3 }]);
    const p1 = run('uno due', rules, 1);
    expect(p1.previewText).toBe('due due');
    expect(p1.previewMatches).toEqual([{ index: 0, end: 3 }, { index: 4, end: 7 }]);
  });
  it('limita le posizioni dell\'anteprima ma conta tutto', () => {
    const text = 'a'.repeat(MAX_PREVIEW_MATCHES + 50);
    const r = run(text, [rule({ find: 'a', replace: 'b' })]);
    expect(r.previewMatches.length).toBe(MAX_PREVIEW_MATCHES);
    expect(r.previewTruncated).toBe(true);
    expect(r.outcomes[0].count).toBe(MAX_PREVIEW_MATCHES + 50);
  });
  it('nessuna regola: output uguale all\'input', () => {
    expect(run('abc', []).output).toBe('abc');
    expect(run('', [rule({ find: 'a', replace: 'b' })]).output).toBe('');
  });
});

describe('highlightPieces e escapeRegex', () => {
  it('divide in frammenti', () => {
    expect(highlightPieces('abcabc', [{ index: 1, end: 2 }, { index: 4, end: 5 }])).toEqual([
      { text: 'a', match: false },
      { text: 'b', match: true },
      { text: 'ca', match: false },
      { text: 'b', match: true },
      { text: 'c', match: false },
    ]);
    expect(highlightPieces('abc', [])).toEqual([{ text: 'abc', match: false }]);
    expect(highlightPieces('', [])).toEqual([]);
  });
  it('escapeRegex', () => {
    const s = '.*+?^${}()|[]\\';
    expect(new RegExp(escapeRegex(s), 'u').test(s)).toBe(true);
  });
});

describe('regex: parola intera Unicode e segnaposto', () => {
  it('parola intera con lettere accentate (stessi confini della modalità testo)', () => {
    const r = run('città cittàdina la città.', [rule({ mode: 'regex', find: 'città', replace: 'X', wholeWord: true })]);
    expect(r.output).toBe('X cittàdina la X.');
    expect(r.outcomes[0].count).toBe(2);
  });
  it('parola intera con pattern non valido con u: errore del motore, nessun crash', () => {
    const r = run('abc', [rule({ mode: 'regex', find: '\\q', replace: 'X', wholeWord: true })]);
    expect(r.outcomes[0].error).not.toBeNull();
    expect(r.output).toBe('abc');
  });
  it('i segnaposto della sostituzione si espandono come in String.replace', () => {
    const text = 'ab-cd ef-gh';
    for (const rep of ['$2$1', '[$&]', '$$', '$`|$\'', '$<x>', '$12', '$0']) {
      const find = rep === '$<x>' ? '(?<x>[a-z]+)-(?<y>[a-z]+)' : '([a-z]+)-([a-z]+)';
      const r = run(text, [rule({ mode: 'regex', find, replace: rep })]);
      expect(r.output).toBe(text.replace(new RegExp(find, 'gi'), rep));
    }
  });
  it('conteggio e posizioni in un solo passaggio', () => {
    const r = run('a b a', [rule({ mode: 'regex', find: 'a', replace: 'X' })]);
    expect(r.outcomes[0].count).toBe(2);
    expect(r.previewMatches).toEqual([{ index: 0, end: 1 }, { index: 4, end: 5 }]);
  });
});
