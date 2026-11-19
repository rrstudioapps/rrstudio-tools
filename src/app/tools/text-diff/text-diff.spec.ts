// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, computeDiff, inlineDiff, normalizeLine, splitLines, toUnifiedDiff, tokenize } from './diff-core';
import { ScrollGeometry, lineCount, lineStartOffset, nextGroup, targetScrollTop } from './diff-nav';
import { SHARE_SCHEMA } from './text-diff.share';
import { SHARE_PREFIX, encodeState, parseHash, validateState } from '../../shared/share-state';
import { diffSequences, editDistance, matchRuns } from './myers';

const seq = (s: string): number[] => Array.from(s).map((c) => c.charCodeAt(0));

/** Lunghezza della sottosequenza comune più lunga, con la programmazione dinamica (riferimento). */
function lcs(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  return prev[b.length];
}

/** Ricostruisce B applicando lo script ad A. */
function applyOps(a: number[], b: number[], ops: ReturnType<typeof diffSequences>): number[] {
  const out: number[] = [];
  for (const op of ops) {
    if (op.type === 'eq') for (let k = 0; k < op.len; k++) out.push(a[op.a + k]);
    else if (op.type === 'ins') for (let k = 0; k < op.len; k++) out.push(b[op.b + k]);
  }
  return out;
}

/** Generatore pseudo-casuale deterministico (mulberry32). */
function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Myers', () => {
  it('esempio dell\'articolo di Myers: ABCABBA → CBABAC ha distanza 5 (LCS = 4)', () => {
    const a = seq('ABCABBA');
    const b = seq('CBABAC');
    const ops = diffSequences(a, b);
    expect(editDistance(ops)).toBe(5);
    expect(lcs(a, b)).toBe(4);
    expect(applyOps(a, b, ops)).toEqual(b);
  });
  it('sequenze uguali, vuote, una vuota, del tutto diverse', () => {
    expect(diffSequences(seq('abc'), seq('abc'))).toEqual([{ type: 'eq', a: 0, b: 0, len: 3 }]);
    expect(diffSequences([], [])).toEqual([]);
    expect(diffSequences([], seq('ab'))).toEqual([{ type: 'ins', a: 0, b: 0, len: 2 }]);
    expect(diffSequences(seq('ab'), [])).toEqual([{ type: 'del', a: 0, b: 0, len: 2 }]);
    expect(editDistance(diffSequences(seq('aaaa'), seq('bbbb')))).toBe(8);
  });
  it('casuale: lo script è minimo (N+M-2·LCS) e ricostruisce B', () => {
    const rand = rng(12345);
    for (let t = 0; t < 300; t++) {
      const alphabet = 2 + Math.floor(rand() * 5);
      const a = Array.from({ length: Math.floor(rand() * 40) }, () => Math.floor(rand() * alphabet));
      const b = Array.from({ length: Math.floor(rand() * 40) }, () => Math.floor(rand() * alphabet));
      const ops = diffSequences(a, b);
      expect(editDistance(ops), `t=${t}`).toBe(a.length + b.length - 2 * lcs(a, b));
      expect(applyOps(a, b, ops)).toEqual(b);
      let ai = 0;
      let bi = 0;
      for (const op of ops) {
        expect(op.a).toBe(ai);
        expect(op.b).toBe(bi);
        if (op.type !== 'ins') ai += op.len;
        if (op.type !== 'del') bi += op.len;
      }
      expect(ai).toBe(a.length);
      expect(bi).toBe(b.length);
    }
  });
  it('i tratti uguali sono davvero uguali', () => {
    const a = seq('il gatto sul tetto che scotta');
    const b = seq('il gatta sul letto che scotta molto');
    for (const r of matchRuns(a, b)) for (let k = 0; k < r.len; k++) expect(a[r.a + k]).toBe(b[r.b + k]);
  });
});

describe('righe', () => {
  it('splitLines: CRLF, CR, a capo finale', () => {
    expect(splitLines('a\r\nb\nc\rd\n')).toEqual(['a', 'b', 'c', 'd']);
    expect(splitLines('')).toEqual([]);
    expect(splitLines('\n')).toEqual(['']);
  });
  it('testi uguali: nessuna differenza', () => {
    const m = computeDiff('uno\ndue\ntre', 'uno\ndue\ntre');
    expect(m.stats.identical).toBe(true);
    expect(m.rows.every((r) => r.kind === 'eq')).toBe(true);
  });
  it('aggiunta, rimozione e modifica con conteggi (+/− come git)', () => {
    const m = computeDiff('uno\ndue\ntre\nquattro', 'uno\ndue modificato\ntre\ncinque\nsei');
    // "due" → "due modificato" (1 modificata), "quattro" → "cinque" (1 modificata), "sei" nuova
    expect(m.stats).toEqual({ added: 3, removed: 2, modified: 2, groups: 2, identical: false });
    expect(m.rows.map((r) => r.kind)).toEqual(['eq', 'mod', 'eq', 'mod', 'ins']);
    expect(m.rows[1].aNo).toBe(2);
    expect(m.rows[1].bNo).toBe(2);
    expect(m.rows[4].bNo).toBe(5);
    expect(m.rows[4].aNo).toBeUndefined();
  });
  it('riga solo cancellata e solo aggiunta', () => {
    const m = computeDiff('a\nb\nc', 'a\nc');
    expect(m.rows.map((r) => r.kind)).toEqual(['eq', 'del', 'eq']);
    expect(m.stats).toMatchObject({ added: 0, removed: 1, modified: 0, groups: 1 });
    const n = computeDiff('a\nc', 'a\nb\nc');
    expect(n.rows.map((r) => r.kind)).toEqual(['eq', 'ins', 'eq']);
  });
  it('opzioni: ignora spazi, maiuscole, righe vuote', () => {
    const base = { ...DEFAULT_OPTIONS };
    expect(computeDiff('a  b\nc', 'a b\n c', base).stats.identical).toBe(false);
    expect(computeDiff('a  b\nc', 'a b\n c', { ...base, ignoreWhitespace: true }).stats.identical).toBe(true);
    expect(computeDiff('Ciao Mondo', 'ciao mondo', base).stats.identical).toBe(false);
    expect(computeDiff('Ciao Mondo', 'ciao mondo', { ...base, ignoreCase: true }).stats.identical).toBe(true);
    expect(computeDiff('a\n\n\nb', 'a\nb', base).stats.identical).toBe(false);
    const blank = computeDiff('a\n\n\nb', 'a\nb', { ...base, ignoreBlank: true });
    expect(blank.stats.identical).toBe(true);
    // i numeri di riga restano quelli originali
    expect(blank.rows[1].aNo).toBe(4);
    expect(blank.rows[1].bNo).toBe(2);
  });
  it('normalizeLine', () => {
    expect(normalizeLine('  A   B ', { ...DEFAULT_OPTIONS, ignoreWhitespace: true, ignoreCase: true })).toBe('a b');
  });
});

describe('differenze dentro la riga', () => {
  it('per parola: evidenzia solo la parola cambiata', () => {
    const r = inlineDiff('Il gatto dorme sul divano', 'Il cane dorme sul divano', DEFAULT_OPTIONS)!;
    expect(r.aSegs).toEqual([
      { text: 'Il ', changed: false },
      { text: 'gatto', changed: true },
      { text: ' dorme sul divano', changed: false },
    ]);
    expect(r.bSegs.find((s) => s.changed)?.text).toBe('cane');
  });
  it('per carattere: evidenzia le lettere', () => {
    const r = inlineDiff('gatto', 'gatta', { ...DEFAULT_OPTIONS, granularity: 'char' })!;
    expect(r.aSegs).toEqual([{ text: 'gatt', changed: false }, { text: 'o', changed: true }]);
    expect(r.bSegs).toEqual([{ text: 'gatt', changed: false }, { text: 'a', changed: true }]);
  });
  it('righe troppo diverse: nessuna evidenziazione interna', () => {
    expect(inlineDiff('abcdefgh', 'zzzzzzzz', DEFAULT_OPTIONS)).toBeNull();
  });
  it('tokenize: parole accentate, numeri e simboli', () => {
    expect(tokenize('Città, 42 perché', 'word')).toEqual(['Città', ',', ' ', '42', ' ', 'perché']);
  });
  it('i pezzi ricompongono la riga originale', () => {
    const r = inlineDiff('x = foo(1, 2) + 3;', 'x = bar(1, 2, 4) + 3;', DEFAULT_OPTIONS)!;
    expect(r.aSegs.map((s) => s.text).join('')).toBe('x = foo(1, 2) + 3;');
    expect(r.bSegs.map((s) => s.text).join('')).toBe('x = bar(1, 2, 4) + 3;');
  });
});

/** Applica un unified diff (solo i casi generati da toUnifiedDiff) a un elenco di righe. */
function applyPatch(lines: string[], patch: string): string[] {
  const out: string[] = [];
  let pos = 0; // indice nella sorgente
  const p = patch.split('\n');
  for (let i = 2; i < p.length; i++) {
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@$/.exec(p[i]);
    if (!m) continue;
    const aStart = Number(m[2] === '0' ? m[1] : Number(m[1]) - 1);
    while (pos < aStart) out.push(lines[pos++]);
    for (i++; i < p.length && !p[i].startsWith('@@') && p[i] !== ''; i++) {
      const t = p[i][0];
      const text = p[i].slice(1);
      if (t === ' ') {
        expect(lines[pos]).toBe(text);
        out.push(lines[pos++]);
      } else if (t === '-') {
        expect(lines[pos]).toBe(text);
        pos++;
      } else out.push(text);
    }
    i--;
  }
  while (pos < lines.length) out.push(lines[pos++]);
  return out;
}

describe('unified diff', () => {
  it('formato: intestazione, hunk con intervalli e contesto di 3 righe', () => {
    const a = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].join('\n');
    const b = ['1', '2', '3', '4', 'cinque', '6', '7', '8', '9', '10'].join('\n');
    const patch = toUnifiedDiff(computeDiff(a, b), 'a/x.txt', 'b/x.txt');
    expect(patch).toBe(['--- a/x.txt', '+++ b/x.txt', '@@ -2,7 +2,7 @@', ' 2', ' 3', ' 4', '-5', '+cinque', ' 6', ' 7', ' 8', ''].join('\n'));
  });
  it('nessuna differenza: patch vuota', () => {
    expect(toUnifiedDiff(computeDiff('a', 'a'))).toBe('');
  });
  it('aggiunta in testa e in coda, file vuoto', () => {
    expect(toUnifiedDiff(computeDiff('', 'x\ny'))).toContain('@@ -0,0 +1,2 @@');
    expect(toUnifiedDiff(computeDiff('x\ny', ''))).toContain('@@ -1,2 +0,0 @@');
    expect(toUnifiedDiff(computeDiff('a', 'a\nb'))).toContain('@@ -1 +1,2 @@');
  });
  it('andata e ritorno: applicare la patch ad A dà B (casuale)', () => {
    const rand = rng(777);
    for (let t = 0; t < 120; t++) {
      const a = Array.from({ length: Math.floor(rand() * 30) }, () => 'riga ' + Math.floor(rand() * 6));
      const b = Array.from({ length: Math.floor(rand() * 30) }, () => 'riga ' + Math.floor(rand() * 6));
      const patch = toUnifiedDiff(computeDiff(a.join('\n'), b.join('\n')));
      if (patch === '') {
        expect(a).toEqual(b);
        continue;
      }
      expect(applyPatch(a, patch), `t=${t}`).toEqual(b);
    }
  });
});

describe('prestazioni', () => {
  const makeLines = (n: number, tag: string): string[] => Array.from({ length: n }, (_, i) => `${tag} riga numero ${i} con del testo di esempio per fare volume`);

  it('due testi da 5.000 righe con ~5% di modifiche: pochi ms', () => {
    const a = makeLines(5000, 'x');
    const b = a.slice();
    for (let i = 0; i < 5000; i += 20) b[i] = 'modificata ' + i;
    for (let i = 7; i < 5000; i += 53) b.splice(i, 1);
    const t0 = performance.now();
    const m = computeDiff(a.join('\n'), b.join('\n'));
    const ms = performance.now() - t0;
    expect(m.stats.groups).toBeGreaterThan(100);
    expect(ms).toBeLessThan(3000);
  });
  it('due testi da 5.000 righe completamente diversi (caso peggiore, D = 10.000)', () => {
    const a = makeLines(5000, 'a').join('\n');
    const b = makeLines(5000, 'b').join('\n');
    const t0 = performance.now();
    const m = computeDiff(a, b);
    const ms = performance.now() - t0;
    expect(m.stats).toMatchObject({ added: 5000, removed: 5000, modified: 5000 });
    expect(ms).toBeLessThan(10000);
  });
});

describe('stato condiviso: "a capo"', () => {
  it('wrap è un booleano; i link vecchi (senza wrap) restano validi', () => {
    expect(validateState(SHARE_SCHEMA, { textA: 'a', textB: 'b', view: 'inline', wrap: false })).toEqual({ textA: 'a', textB: 'b', view: 'inline', wrap: false });
    expect(validateState(SHARE_SCHEMA, { textA: 'a', textB: 'b', view: 'side', collapse: true })).toEqual({ textA: 'a', textB: 'b', view: 'side', collapse: true });
    expect(validateState(SHARE_SCHEMA, { textA: 'a', wrap: 'no' })).toEqual({ textA: 'a' });
  });

  it('andata e ritorno nell\'hash, e un vecchio link non toglie il valore predefinito', async () => {
    const hash = SHARE_PREFIX + (await encodeState('text-diff', { textA: 'x', wrap: false }));
    const parsed = await parseHash('text-diff', SHARE_SCHEMA, hash);
    expect(parsed).toMatchObject({ kind: 'ok', state: { textA: 'x', wrap: false } });
    const old = SHARE_PREFIX + (await encodeState('text-diff', { textA: 'x', view: 'side' }));
    const p2 = await parseHash('text-diff', SHARE_SCHEMA, old);
    expect(p2.kind).toBe('ok');
    if (p2.kind === 'ok') expect(Object.hasOwn(p2.state, 'wrap')).toBe(false);
  });
});

describe('navigazione nel contenitore', () => {
  const base: ScrollGeometry = { scrollTop: 0, containerTop: 100, elTop: 600, elHeight: 20, containerHeight: 600, stickyHeight: 60, maxScroll: 5000 };

  it('la riga finisce sotto la barra sticky, circa a un terzo', () => {
    const t = targetScrollTop(base);
    // riga a 500px dall'inizio del contenitore; margine = (540-20)/3 ≈ 173; barra 60
    expect(t).toBe(Math.round(500 - 60 - (540 - 20) / 3));
    expect(t).toBeGreaterThan(0);
  });

  it('tiene conto dello scorrimento attuale e dei limiti', () => {
    expect(targetScrollTop({ ...base, scrollTop: 300, elTop: 150 })).toBe(Math.round(300 + 50 - 60 - (540 - 20) / 3));
    expect(targetScrollTop({ ...base, elTop: 110 })).toBe(0);
    expect(targetScrollTop({ ...base, elTop: 9000, maxScroll: 1200 })).toBe(1200);
    expect(targetScrollTop({ ...base, maxScroll: 0 })).toBe(0);
  });

  it('nextGroup gira in avanti e indietro', () => {
    expect(nextGroup(-1, 1, 3)).toBe(0);
    expect(nextGroup(-1, -1, 3)).toBe(2);
    expect(nextGroup(2, 1, 3)).toBe(0);
    expect(nextGroup(0, -1, 3)).toBe(2);
    expect(nextGroup(0, 1, 0)).toBe(-1);
  });

  it('lineStartOffset: inizio della riga N con qualunque terminatore', () => {
    expect(lineStartOffset('a\nbb\nccc', 1)).toBe(0);
    expect(lineStartOffset('a\nbb\nccc', 2)).toBe(2);
    expect(lineStartOffset('a\nbb\nccc', 3)).toBe(5);
    expect(lineStartOffset('a\r\nbb\rccc', 3)).toBe(6);
    expect(lineStartOffset('a\nb', 9)).toBe(3);
    expect(lineStartOffset('', 1)).toBe(0);
  });

  it('lineCount', () => {
    expect(lineCount('')).toBe(0);
    expect(lineCount('a')).toBe(1);
    expect(lineCount('a\nb\n')).toBe(3);
  });
});
