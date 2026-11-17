// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { CLASSIC_SENTENCE, LIMITS, LoremOptions, VOCABULARY, clampCount, createRng, generateLorem, sentence, textStats } from './lorem';

const base: LoremOptions = { unit: 'paragraphs', count: 3, classicStart: true, format: 'text', seed: 'abc' };
const gen = (o: Partial<LoremOptions> = {}) => generateLorem({ ...base, ...o });

describe('createRng', () => {
  it('stesso seme, stessa sequenza', () => {
    const a = createRng('seme');
    const b = createRng('seme');
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });
  it('seme di tipo numero e testo equivalenti', () => {
    expect(createRng(42)()).toBe(createRng('42')());
  });
  it('semi diversi, sequenze diverse', () => {
    expect(createRng('a')()).not.toBe(createRng('b')());
    expect(createRng('')()).not.toBe(createRng('0')());
  });
  it('valori in [0, 1) e distribuiti', () => {
    const r = createRng('x');
    let sum = 0;
    const buckets = new Array(10).fill(0);
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
      buckets[Math.floor(v * 10)]++;
    }
    expect(sum / n).toBeGreaterThan(0.48);
    expect(sum / n).toBeLessThan(0.52);
    for (const b of buckets) expect(b).toBeGreaterThan(n / 10 - 400);
  });
  it('valore noto (la sequenza non deve cambiare tra versioni)', () => {
    const r = createRng('lorem');
    expect([r(), r(), r()].map((v) => Math.floor(v * 1e6))).toEqual([757067, 634009, 452307]);
    expect(generateLorem({ ...base, unit: 'words', count: 12, classicStart: false, seed: 'lorem' })).toBe(
      'Aut aperiam praesentium deserunt ipsa incididunt praesentium quas atque porro iste sequi',
    );
  });
});

describe('generateLorem', () => {
  it('è deterministico con lo stesso seme e cambia con un altro', () => {
    expect(gen()).toBe(gen());
    expect(gen({ seed: 'altro' })).not.toBe(gen());
  });
  it('conta i paragrafi', () => {
    for (const n of [1, 2, 7, 100]) expect(gen({ count: n }).split('\n\n')).toHaveLength(n);
  });
  it('conta le frasi', () => {
    for (const n of [1, 3, 40]) {
      const t = gen({ unit: 'sentences', count: n });
      expect(t.match(/\./g)).toHaveLength(n);
      expect(t.includes('\n')).toBe(false);
    }
  });
  it('conta le parole', () => {
    for (const n of [1, 5, 50, 1234]) {
      expect(gen({ unit: 'words', count: n }).trim().split(/\s+/)).toHaveLength(n);
      expect(gen({ unit: 'words', count: n, classicStart: false }).trim().split(/\s+/)).toHaveLength(n);
    }
  });
  it('inizia con il testo classico, se richiesto', () => {
    expect(gen().startsWith(CLASSIC_SENTENCE)).toBe(true);
    expect(gen({ unit: 'sentences', count: 2 }).startsWith(CLASSIC_SENTENCE + ' ')).toBe(true);
    expect(gen({ unit: 'words', count: 5 })).toBe('Lorem ipsum dolor sit amet');
    expect(gen({ unit: 'words', count: 3, classicStart: true })).toBe('Lorem ipsum dolor');
    expect(gen({ unit: 'words', count: 30 }).startsWith('Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod')).toBe(true);
  });
  it('solo il primo paragrafo comincia col testo classico', () => {
    const [, ...rest] = gen({ count: 6 }).split('\n\n');
    for (const p of rest) expect(p.startsWith(CLASSIC_SENTENCE)).toBe(false);
  });
  it('senza inizio classico non comincia sempre uguale', () => {
    const starts = new Set<string>();
    for (let i = 0; i < 30; i++) starts.add(gen({ classicStart: false, seed: 's' + i, count: 1 }).slice(0, 30));
    expect(starts.size).toBeGreaterThan(20);
  });
  it('HTML: un <p> per paragrafo', () => {
    const t = gen({ format: 'html', count: 4 });
    expect(t.split('\n')).toHaveLength(4);
    for (const line of t.split('\n')) expect(line).toMatch(/^<p>[^<>]+<\/p>$/);
  });
  it('HTML con frasi e parole: un solo <p>', () => {
    expect(gen({ unit: 'sentences', format: 'html', count: 3 })).toMatch(/^<p>[^<>]+<\/p>$/);
    expect(gen({ unit: 'words', format: 'html', count: 3 })).toBe('<p>Lorem ipsum dolor</p>');
  });
  it('il testo non contiene mai markup né caratteri strani', () => {
    expect(gen({ count: 100, seed: 'x' })).toMatch(/^[A-Za-z ,.\n]+$/);
  });
  it('limiti: valori fuori scala vengono riportati nell\'intervallo', () => {
    expect(gen({ count: 0 }).split('\n\n')).toHaveLength(1);
    expect(gen({ count: 1e9 }).split('\n\n')).toHaveLength(LIMITS.paragraphs.max);
    expect(gen({ unit: 'words', count: -3 }).split(' ')).toHaveLength(1);
    expect(gen({ unit: 'words', count: NaN }).split(' ')).toHaveLength(LIMITS.words.default);
  });
  it('il seme vuoto è un seme come un altro', () => {
    expect(gen({ seed: '' })).toBe(gen({ seed: '' }));
  });
});

describe('sentence', () => {
  it('forma di una frase: maiuscola, punto, 5-15 parole, parole del vocabolario, mai due uguali di fila', () => {
    const rng = createRng('frasi');
    const vocab = new Set(VOCABULARY);
    for (let i = 0; i < 500; i++) {
      const s = sentence(rng);
      expect(s).toMatch(/^[A-Z][a-z ,]+\.$/);
      const words = s.slice(0, -1).replace(/,/g, '').split(' ');
      expect(words.length).toBeGreaterThanOrEqual(5);
      expect(words.length).toBeLessThanOrEqual(15);
      for (let k = 0; k < words.length; k++) {
        expect(vocab.has(words[k].toLowerCase())).toBe(true);
        if (k > 0) expect(words[k]).not.toBe(words[k - 1].toLowerCase());
      }
      expect(s).not.toMatch(/,,|, ,|,\./);
    }
  });
  it('le virgole compaiono ma non nelle frasi brevi', () => {
    const rng = createRng('virgole');
    let withComma = 0;
    for (let i = 0; i < 300; i++) {
      const s = sentence(rng);
      if (s.includes(',')) withComma++;
      if (s.split(' ').length < 8) expect(s).not.toContain(',');
    }
    expect(withComma).toBeGreaterThan(50);
  });
});

describe('vocabolario e utilità', () => {
  it('parole uniche e abbastanza numerose', () => {
    expect(new Set(VOCABULARY).size).toBe(VOCABULARY.length);
    expect(VOCABULARY.length).toBeGreaterThan(150);
  });
  it('clampCount', () => {
    expect(clampCount('paragraphs', 5.9)).toBe(5);
    expect(clampCount('sentences', 9999)).toBe(500);
    expect(clampCount('words', Infinity)).toBe(50);
  });
  it('textStats ignora i tag', () => {
    expect(textStats('<p>Ciao a tutti.</p>\n<p>Due</p>')).toEqual({ words: 4, chars: 17 });
    expect(textStats('')).toEqual({ words: 0, chars: 0 });
  });
});
