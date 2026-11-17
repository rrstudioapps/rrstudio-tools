// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { atbash, caesar, caesarBruteForce, rot13, rot47, vigenere, vigenereKey } from './ciphers';

describe('Cesare e ROT13', () => {
  it('ROT13 e il suo inverso', () => {
    expect(rot13('Hello, World!')).toBe('Uryyb, Jbeyq!');
    expect(rot13(rot13('Ciao Mondo 123'))).toBe('Ciao Mondo 123');
  });
  it('Cesare con spostamento 3', () => {
    expect(caesar('ABC xyz', 3)).toBe('DEF abc');
    expect(caesar('DEF abc', -3)).toBe('ABC xyz');
  });
  it('spostamenti oltre 26 e negativi', () => {
    expect(caesar('abc', 29)).toBe('def');
    expect(caesar('abc', -27)).toBe('zab');
    expect(caesar('abc', 0)).toBe('abc');
  });
  it('lettere accentate e simboli passano invariati', () => {
    expect(caesar('È già: 5€!', 1)).toBe('È hjà: 5€!');
  });
  it('forza bruta: 25 voci, tra cui il testo originale', () => {
    const list = caesarBruteForce(caesar('attacco al tramonto', 7));
    expect(list.length).toBe(25);
    expect(list.find((x) => x.shift === 7)?.text).toBe('attacco al tramonto');
    expect(list[0].shift).toBe(1);
  });
});

describe('ROT47', () => {
  it('esempio noto', () => {
    expect(rot47('Hello, World!')).toBe('w6==@[ (@C=5P');
  });
  it('è il suo inverso, lascia spazi e non ASCII', () => {
    expect(rot47(rot47('Prova ~ 42 è!'))).toBe('Prova ~ 42 è!');
    expect(rot47(' è')).toBe(' è');
  });
});

describe('Atbash', () => {
  it('A↔Z', () => {
    expect(atbash('Hello')).toBe('Svool');
    expect(atbash(atbash('Ciao, Mondo!'))).toBe('Ciao, Mondo!');
  });
});

describe('Vigenère', () => {
  it('esempio classico ATTACKATDAWN / LEMON', () => {
    expect(vigenere('ATTACKATDAWN', 'LEMON')).toBe('LXFOPVEFRNHR');
    expect(vigenere('LXFOPVEFRNHR', 'LEMON', true)).toBe('ATTACKATDAWN');
  });
  it('la chiave avanza solo sulle lettere e le maiuscole si mantengono', () => {
    const c = vigenere('Attack at Dawn!', 'lemon');
    expect(c).toBe('Lxfopv ef Rnhr!');
    expect(vigenere(c, 'LEMON', true)).toBe('Attack at Dawn!');
  });
  it('chiave con accenti e simboli ridotta alle lettere', () => {
    expect(vigenereKey('Le-món 1')).toEqual([11, 4, 12, 14, 13]);
  });
  it('chiave senza lettere: testo invariato', () => {
    expect(vigenere('abc', '123')).toBe('abc');
  });
});
