// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  collapseSpaces,
  convert,
  countChars,
  countCharsNoSpaces,
  countLines,
  countParagraphs,
  countSentences,
  countText,
  detectLang,
  durationSeconds,
  formatDuration,
  invertCase,
  limitStatus,
  removeBlankLines,
  toSentenceCase,
  toTitleCase,
  topWords,
  words,
} from './text-count';

describe('conteggi', () => {
  it('testo vuoto: tutto a zero', () => {
    expect(countText('')).toEqual({ words: 0, chars: 0, charsNoSpaces: 0, sentences: 0, paragraphs: 0, lines: 0 });
  });
  it('parole con accenti, apostrofi e trattini', () => {
    expect(words("L'anno è già finito, perché città")).toHaveLength(6);
    expect(words('well-known state-of-the-art')).toHaveLength(2);
    expect(words('  uno   due\ttre\nquattro ')).toEqual(['uno', 'due', 'tre', 'quattro']);
    expect(words('... --- !!!')).toEqual([]);
  });
  it('emoji e lettere accentate contano 1 carattere', () => {
    expect(countChars('àèì')).toBe(3);
    expect(countChars('a😀b')).toBe(3);
    expect(countChars('👨‍👩‍👧‍👦')).toBe(1); // famiglia: sequenza ZWJ
    expect(countChars('👍🏽')).toBe(1); // con tono della pelle
    expect(countChars('🇮🇹')).toBe(1); // bandiera
    expect(countChars('é')).toBe(1); // e + accento combinato
    expect('😀'.length).toBe(2); // la lunghezza UTF-16 sarebbe sbagliata
  });
  it('caratteri senza spazi', () => {
    expect(countCharsNoSpaces('a b\tc\nd')).toBe(4);
    expect(countCharsNoSpaces('😀 😀')).toBe(2);
  });
  it('frasi, paragrafi, righe', () => {
    expect(countSentences('Ciao. Come stai? Bene!')).toBe(3);
    expect(countSentences('Pi greco vale 3.14 circa. Fine.')).toBe(2);
    expect(countSentences('   ')).toBe(0);
    expect(countParagraphs('uno\ndue\n\n\ntre\n \nquattro')).toBe(3);
    expect(countParagraphs('\n\n')).toBe(0);
    expect(countLines('a\nb\r\nc')).toBe(3);
    expect(countLines('a\n')).toBe(2);
    expect(countLines('')).toBe(0);
  });
});

describe('tempi', () => {
  it('lettura a 200 e parlato a 130 parole al minuto', () => {
    expect(durationSeconds(200, 200)).toBe(60);
    expect(durationSeconds(130, 130)).toBe(60);
    expect(durationSeconds(100, 200)).toBe(30);
    expect(durationSeconds(1, 200)).toBe(1);
    expect(durationSeconds(0, 200)).toBe(0);
  });
  it('formato leggibile', () => {
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(120)).toBe('2 min');
    expect(formatDuration(150)).toBe('2 min 30 s');
    expect(formatDuration(3900)).toBe('1 h 05 min');
  });
});

describe('parole frequenti', () => {
  const it1 = words('Il gatto e il cane giocano. Il gatto dorme, il cane no. Gatto gatto!');
  it('esclude le stopword italiane e ordina per frequenza', () => {
    const r = topWords(it1, 'it');
    expect(r.lang).toBe('it');
    expect(r.items[0]).toMatchObject({ word: 'gatto', count: 4 });
    expect(r.items[1]).toMatchObject({ word: 'cane', count: 2 });
    expect(r.items.map((i) => i.word)).not.toContain('il');
  });
  it('rilevamento automatico della lingua', () => {
    expect(detectLang(words('The quick brown fox jumps over the lazy dog and the cat'))).toBe('en');
    expect(detectLang(it1)).toBe('it');
    const en = topWords(words('The cat and the dog. The cat is on the mat.'), 'auto');
    expect(en.lang).toBe('en');
    expect(en.items[0].word).toBe('cat');
  });
  it('senza esclusione le stopword restano; i numeri puri no', () => {
    const r = topWords(words('il il il 2024 2024 gatto'), 'none');
    expect(r.lang).toBeNull();
    expect(r.items[0].word).toBe('il');
    expect(r.items.map((i) => i.word)).not.toContain('2024');
  });
  it('a parità, ordine alfabetico; percentuale sul totale', () => {
    const r = topWords(words('zeta alfa zeta alfa beta'), 'none');
    expect(r.items.map((i) => i.word)).toEqual(['alfa', 'zeta', 'beta']);
    expect(r.items[0].percent).toBeCloseTo(40);
  });
});

describe('limiti', () => {
  it('quanto manca e quanto si sfora', () => {
    expect(limitStatus(123, 160)).toMatchObject({ remaining: 37, over: false });
    expect(limitStatus(160, 160)).toMatchObject({ remaining: 0, over: false, fraction: 1 });
    expect(limitStatus(292, 280)).toMatchObject({ remaining: -12, over: true, fraction: 1 });
    expect(limitStatus(0, 155).fraction).toBe(0);
  });
});

describe('conversioni', () => {
  it('maiuscolo, minuscolo, iniziali, frase, inverti', () => {
    expect(convert('Città è già', 'upper')).toBe('CITTÀ È GIÀ');
    expect(convert('CITTÀ', 'lower')).toBe('città');
    expect(toTitleCase('il signor rossi è già qui')).toBe('Il Signor Rossi È Già Qui');
    expect(toTitleCase("l'anno scorso")).toBe("L'Anno Scorso");
    expect(toSentenceCase('CIAO A TUTTI. COME STAI? bene!\nnuova riga')).toBe('Ciao a tutti. Come stai? Bene!\nNuova riga');
    expect(invertCase('Ciao Èà')).toBe('cIAO èÀ');
  });
  it('spazi doppi e righe vuote', () => {
    expect(collapseSpaces('a  b\t\tc   \nd')).toBe('a b c\nd');
    expect(removeBlankLines('a\n\n  \nb\r\n\r\nc')).toBe('a\nb\nc');
    expect(convert('x   y', 'spaces')).toBe('x y');
    expect(convert('x\n\ny', 'blank')).toBe('x\ny');
  });
  it('le conversioni sono idempotenti dove atteso', () => {
    const t = 'Ciao  Mondo\n\nFine';
    expect(convert(convert(t, 'upper'), 'upper')).toBe('CIAO  MONDO\n\nFINE');
    expect(convert(convert(t, 'spaces'), 'spaces')).toBe(convert(t, 'spaces'));
  });
});
