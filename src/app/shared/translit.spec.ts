// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { transliterate } from './translit';

describe('transliterate', () => {
  it('toglie gli accenti italiani e francesi', () => {
    expect(transliterate('perché città più è à ò ù ì')).toBe('perche citta piu e a o u i');
    expect(transliterate('Crème brûlée à la française, Noël, ça')).toBe('Creme brulee a la francaise, Noel, ca');
  });
  it('lettere latine estese', () => {
    expect(transliterate('Straße ẞ Æsir œuvre Øresund Łódź Đà Lạt þórr Ħamrun ı İ ŋ')).toBe('Strasse SS Aesir oeuvre Oresund Lodz Da Lat thorr Hamrun i I ng');
  });
  it('spagnolo, portoghese, tedesco, polacco, ceco, turco, rumeno, vietnamese', () => {
    expect(transliterate('niño São Paulo Zürich Ärger Żółć Čeština Şişli Ğ ă ț Việt Nam')).toBe('nino Sao Paulo Zurich Arger Zolc Cestina Sisli G a t Viet Nam');
  });
  it('caratteri già composti e scomposti danno lo stesso risultato', () => {
    expect(transliterate('é')).toBe('e');
    expect(transliterate('é')).toBe('e');
  });
  it('punteggiatura tipografica', () => {
    expect(transliterate('“ciao” ‘a’ l’altro – x — y … a b')).toBe('"ciao" \'a\' l\'altro - x - y ... a b');
  });
  it('non tocca ASCII, numeri e altri alfabeti', () => {
    expect(transliterate('abc XYZ 123 !?')).toBe('abc XYZ 123 !?');
    expect(transliterate('Привет 日本')).toBe('Привет 日本');
    expect(transliterate('')).toBe('');
  });
  it('emoji intatte', () => {
    expect(transliterate('café ☕😀')).toBe('cafe ☕😀');
  });
});
