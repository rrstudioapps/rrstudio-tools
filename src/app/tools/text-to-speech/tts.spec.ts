// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  MAX_PITCH,
  MAX_RATE,
  MIN_RATE,
  VoiceLike,
  baseLang,
  clampPitch,
  clampRate,
  clampVolume,
  localVoices,
  pickVoice,
  sentenceAt,
  splitSentences,
  voiceLanguages,
} from './tts';

const v = (name: string, lang: string, localService: boolean, extra: Partial<VoiceLike> = {}): VoiceLike => ({ name, lang, localService, ...extra });

describe('voci: solo quelle locali', () => {
  const all = [
    v('Google italiano', 'it-IT', false),
    v('Alice', 'it-IT', true),
    v('Google US English', 'en-US', false),
    v('Samantha', 'en-US', true),
    v('Daniel', 'en-GB', true),
    v('Remota', 'fr-FR', false),
  ];
  it('scarta le voci di rete', () => {
    const l = localVoices(all);
    expect(l.map((x) => x.name)).toEqual(['Daniel', 'Samantha', 'Alice']);
    expect(l.every((x) => x.localService === true)).toBe(true);
  });
  it('scarta anche i valori non strettamente true (undefined, 1)', () => {
    const odd = [{ name: 'x', lang: 'it', localService: undefined as unknown as boolean }, { name: 'y', lang: 'it', localService: 1 as unknown as boolean }];
    expect(localVoices(odd)).toEqual([]);
  });
  it('senza voci locali l\'elenco è vuoto', () => {
    expect(localVoices(all.filter((x) => !x.localService))).toEqual([]);
    expect(localVoices([])).toEqual([]);
  });
  it('toglie i doppioni', () => {
    expect(localVoices([v('A', 'it-IT', true), v('A', 'it-IT', true)]).length).toBe(1);
  });
  it('lingue disponibili e voce predefinita', () => {
    const l = localVoices(all);
    expect(voiceLanguages(l)).toEqual(['en', 'it']);
    expect(baseLang('it_IT')).toBe('it');
    expect(baseLang('EN-us')).toBe('en');
    expect(pickVoice(l, 'it-IT')?.name).toBe('Alice');
    expect(pickVoice(l, 'en')?.name).toBe('Daniel');
    expect(pickVoice([v('A', 'en-US', true), v('B', 'en-US', true, { default: true })], 'en')?.name).toBe('B');
    // lingua assente: la prima disponibile
    expect(pickVoice(l, 'ja')?.name).toBe('Daniel');
    expect(pickVoice([], 'it')).toBeNull();
  });
});

describe('parametri', () => {
  it('velocità, tono e volume restano nei limiti', () => {
    expect(clampRate(5)).toBe(MAX_RATE);
    expect(clampRate(0)).toBe(MIN_RATE);
    expect(clampRate(NaN)).toBe(1);
    expect(clampPitch(9)).toBe(MAX_PITCH);
    expect(clampPitch(-1)).toBe(0);
    expect(clampVolume(3)).toBe(1);
    expect(clampVolume(0.4)).toBe(0.4);
  });
});

describe('frasi', () => {
  it('divide per punteggiatura e conserva le posizioni', () => {
    const text = 'Ciao a tutti. Come state? Bene!';
    const s = splitSentences(text, 'it');
    expect(s.map((x) => x.text)).toEqual(['Ciao a tutti.', 'Come state?', 'Bene!']);
    for (const x of s) expect(text.slice(x.start, x.end)).toBe(x.text);
  });
  it('testo senza punteggiatura, vuoto e solo spazi', () => {
    expect(splitSentences('una sola frase', 'it').map((x) => x.text)).toEqual(['una sola frase']);
    expect(splitSentences('', 'it')).toEqual([]);
    expect(splitSentences('  \n  ', 'it')).toEqual([]);
  });
  it('a capo e righe', () => {
    const s = splitSentences('Titolo\n\nPrima frase. Seconda frase.', 'en');
    expect(s.length).toBeGreaterThanOrEqual(2);
    expect(s.map((x) => x.text).join(' ')).toContain('Seconda frase.');
  });
  it('spezza le frasi lunghissime senza perdere testo', () => {
    const long = 'parola, '.repeat(200).trim();
    const s = splitSentences(long, 'it');
    expect(s.length).toBeGreaterThan(1);
    expect(s.every((x) => x.text.length <= 400)).toBe(true);
    expect(s.map((x) => x.text).join(' ').replace(/\s+/g, ' ')).toBe(long);
    for (const x of s) expect(long.slice(x.start, x.end)).toBe(x.text);
  });
  it('sentenceAt trova la frase corrente', () => {
    const s = splitSentences('Uno. Due. Tre.', 'it');
    expect(sentenceAt(s, 0)).toBe(0);
    expect(sentenceAt(s, 5)).toBe(1);
    expect(sentenceAt(s, 11)).toBe(2);
    expect(sentenceAt([], 3)).toBe(-1);
  });
});
