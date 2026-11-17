// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, MAX_LENGTH_LIMIT, SlugOptions, clampMaxLength, generateBulk, generateSlug, joinWithin, slugWords } from './slug';

const o = (x: Partial<SlugOptions> = {}): SlugOptions => ({ ...DEFAULT_OPTIONS, ...x });
const s = (text: string, x: Partial<SlugOptions> = {}) => generateSlug(text, o(x));

describe('generateSlug base', () => {
  it('testo semplice', () => {
    expect(s('Hello World')).toBe('hello-world');
    expect(s('  Molti   spazi \t e\ta capo\n')).toBe('molti-spazi-e-a-capo');
  });
  it('accenti italiani e lettere latine estese', () => {
    expect(s('Perché città più è così')).toBe('perche-citta-piu-e-cosi');
    expect(s('Straße Ærø Łódź Đà Lạt Çağrı Ñandú')).toBe('strasse-aero-lodz-da-lat-cagri-nandu');
  });
  it('punteggiatura, simboli e numeri', () => {
    expect(s('Tom & Jerry: 10 anni (1940-1950)!')).toBe('tom-jerry-10-anni-1940-1950');
    expect(s('C++ / C# / .NET')).toBe('c-c-net');
    expect(s('100% naturale — €5')).toBe('100-naturale-5');
  });
  it('apostrofi: tolti nelle contrazioni, separatori dopo le elisioni italiane', () => {
    expect(s("don't it's rock'n'roll")).toBe('dont-its-rocknroll');
    expect(s("l'amore dell'arte un'altra volta")).toBe('l-amore-dell-arte-un-altra-volta');
    expect(s('l’amore')).toBe('l-amore');
  });
  it('emoji e alfabeti non latini non producono caratteri strani', () => {
    expect(s('caffè ☕ 😀')).toBe('caffe');
    expect(s('Привет мир')).toBe('');
    expect(s('')).toBe('');
    expect(s('---')).toBe('');
  });
  it('separatori', () => {
    expect(s('Hello big World', { separator: '_' })).toBe('hello_big_world');
    expect(s('Hello big World', { separator: '.' })).toBe('hello.big.world');
  });
  it('maiuscole conservate su richiesta', () => {
    expect(s('Hello World', { lowercase: false })).toBe('Hello-World');
  });
  it('è idempotente', () => {
    const once = s('Ciò che è già uno slug-valido');
    expect(s(once)).toBe(once);
  });
  it('il risultato usa solo caratteri sicuri per un URL', () => {
    for (const t of ['a/b?c=d&e#f', '../../etc/passwd', '<script>alert(1)</script>', 'ünï cödé ✓ 日本', "O'Neil % 20", '%20 %2F']) {
      expect(s(t)).toMatch(/^[a-z0-9]*(-[a-z0-9]+)*$/);
    }
  });
});

describe('lunghezza massima', () => {
  const text = 'questo è un titolo molto lungo per un articolo';
  it('non taglia a metà parola', () => {
    // intero: questo-e-un-titolo-molto-lungo-per-un-articolo
    expect(s(text, { maxLength: 20 })).toBe('questo-e-un-titolo');
    expect(s(text, { maxLength: 18 })).toBe('questo-e-un-titolo');
    expect(s(text, { maxLength: 17 })).toBe('questo-e-un');
    expect(s(text, { maxLength: 6 })).toBe('questo');
  });
  it('il limite è incluso', () => {
    expect(s('abc def', { maxLength: 7 })).toBe('abc-def');
    expect(s('abc def', { maxLength: 6 })).toBe('abc');
  });
  it('se la prima parola è troppo lunga la taglia', () => {
    expect(s('supercalifragilistichespiralidoso x', { maxLength: 10 })).toBe('supercalif');
  });
  it('nessun limite con 0 e testi più corti del limite', () => {
    expect(s(text, { maxLength: 0 })).toBe('questo-e-un-titolo-molto-lungo-per-un-articolo');
    expect(s('ciao', { maxLength: 50 })).toBe('ciao');
  });
  it('non termina mai con un separatore', () => {
    for (let max = 1; max < 30; max++) expect(s(text, { maxLength: max })).not.toMatch(/-$/);
  });
  it('clampMaxLength', () => {
    expect(clampMaxLength(-5)).toBe(0);
    expect(clampMaxLength(NaN)).toBe(0);
    expect(clampMaxLength(12.7)).toBe(12);
    expect(clampMaxLength(99999)).toBe(MAX_LENGTH_LIMIT);
  });
  it('joinWithin', () => {
    expect(joinWithin(['ab', 'cd'], '-', 0)).toBe('ab-cd');
    expect(joinWithin(['ab', 'cd'], '-', 4)).toBe('ab');
  });
});

describe('parole vuote', () => {
  it('italiano', () => {
    expect(s('Il nome della rosa e le sue storie', { stopWords: 'it' })).toBe('nome-rosa-storie');
    expect(s("L'isola del tesoro", { stopWords: 'it' })).toBe('isola-tesoro');
    expect(s("Storia dell'arte moderna", { stopWords: 'it' })).toBe('storia-arte-moderna');
  });
  it('inglese', () => {
    expect(s('The Lord of the Rings and the Return of the King', { stopWords: 'en' })).toBe('lord-rings-return-king');
    expect(s("It's the end of the world", { stopWords: 'en' })).toBe('end-world');
  });
  it('entrambe', () => {
    expect(s('The cat e il cane', { stopWords: 'both' })).toBe('cat-cane');
  });
  it('senza la lista le parole restano', () => {
    expect(s('The cat', { stopWords: 'none' })).toBe('the-cat');
  });
  it('un testo di sole parole vuote non diventa vuoto', () => {
    expect(s('The And Of', { stopWords: 'en' })).toBe('the-and-of');
    expect(s('Chi sono', { stopWords: 'it' })).toBe('chi-sono');
  });
  it('si applica prima del limite di lunghezza', () => {
    expect(s('il nome della rosa di umberto eco', { stopWords: 'it', maxLength: 14 })).toBe('nome-rosa');
  });
});

describe('in blocco', () => {
  it('uno slug per riga, righe vuote comprese', () => {
    expect(generateBulk('Primo Titolo\n\nSecondo è così\r\nTerzo', { ...o(), unique: false })).toEqual(['primo-titolo', '', 'secondo-e-cosi', 'terzo']);
  });
  it('duplicati resi unici', () => {
    expect(generateBulk('Ciao\nCiao!\nciao\nAltro', { ...o(), unique: true })).toEqual(['ciao', 'ciao-2', 'ciao-3', 'altro']);
    expect(generateBulk('a\na', { ...o({ separator: '_' }), unique: true })).toEqual(['a', 'a_2']);
  });
  it('senza unicità i duplicati restano', () => {
    expect(generateBulk('x\nx', { ...o(), unique: false })).toEqual(['x', 'x']);
  });
  it('l\'unicità rispetta la lunghezza massima', () => {
    const r = generateBulk('abcdefghij\nabcdefghij\nabcdefghij', { ...o({ maxLength: 10 }), unique: true });
    expect(r).toEqual(['abcdefghij', 'abcdefgh-2', 'abcdefgh-3']);
    expect(r.every((x) => x.length <= 10)).toBe(true);
  });
  it('slug vuoti non diventano unici', () => {
    expect(generateBulk('😀\n😀', { ...o(), unique: true })).toEqual(['', '']);
  });
});

describe('slugWords', () => {
  it('divide in parole ASCII', () => {
    expect(slugWords('Ciao, Mondo! 2026')).toEqual(['ciao', 'mondo', '2026']);
    expect(slugWords('Ciao Mondo', false)).toEqual(['Ciao', 'Mondo']);
  });
});

describe('generateBulk (unicità)', () => {
  const base = { ...DEFAULT_OPTIONS, unique: true };
  it('non produce duplicati quando un suffisso coincide con un altro slug', () => {
    const r = generateBulk('foo\nfoo\nfoo 2', base);
    expect(new Set(r).size).toBe(3);
  });
  it('resta unico anche con maxLength', () => {
    const r = generateBulk('abcdef\nabcdef\nabcdef\nabcdef', { ...base, maxLength: 6 });
    expect(new Set(r).size).toBe(4);
    r.forEach((s) => expect(s.length).toBeLessThanOrEqual(6));
  });
});
