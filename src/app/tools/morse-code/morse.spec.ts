// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { DEFAULT_FORMAT, formatMorse, morseTimeline, parseMorse, textToWords, totalMs, unitMs, wordsToText } from './morse';

const enc = (t: string) => formatMorse(textToWords(t).words);
const dec = (m: string) => wordsToText(parseMorse(m)).text;

describe('testo → Morse', () => {
  it('SOS', () => expect(enc('SOS')).toBe('... --- ...'));
  it('parole separate da /', () => expect(enc('ciao mondo')).toBe('-.-. .. .- --- / -- --- -. -.. ---'));
  it('cifre e punteggiatura', () => {
    expect(enc('2026')).toBe('..--- ----- ..--- -....');
    expect(enc('a.b?')).toBe('.- .-.-.- -... ..--..');
  });
  it('lettere accentate ITU', () => {
    expect(enc('è é ñ ö ü à')).toBe('.-..- / ..-.. / --.-- / ---. / ..-- / .--.-');
  });
  it('caratteri sconosciuti segnalati e saltati', () => {
    const r = textToWords('a€b');
    expect(r.unknown).toEqual(['€']);
    expect(formatMorse(r.words)).toBe('.- -...');
  });
  it('a capo e spazi multipli contano come separatore di parole', () => expect(enc('a\n\n  b')).toBe('.- / -...'));
  it('simboli e separatori configurabili', () => {
    const w = textToWords('ab cd').words;
    expect(formatMorse(w, { dot: '•', dash: '—', letterSep: '  ', wordSep: ' | ' })).toBe('•—  —••• | —•—•  —••');
    expect(formatMorse(w, { ...DEFAULT_FORMAT, letterSep: '', wordSep: '/' })).toBe('.--.../-.-.-..');
  });
});

describe('Morse → testo', () => {
  it('decodifica semplice', () => expect(dec('.... . .-.. .-.. --- / .-- --- .-. .-.. -..')).toBe('HELLO WORLD'));
  it('accetta • e — e tre spazi come parola', () => expect(dec('•—   —•••')).toBe('A B'));
  it('accetta la barra verticale e gli a capo', () => expect(dec('... | ---\n...')).toBe('S O S'));
  it('gruppi non validi diventano ?', () => {
    const r = wordsToText(parseMorse('.... ......... ..'));
    expect(r.text).toBe('H?I');
    expect(r.unknown).toEqual(['.........']);
  });
  it('andata e ritorno su tutti i caratteri non accentati', () => {
    const t = 'THE QUICK BROWN FOX 0123456789 .,?!/()&:;=+-_@';
    expect(dec(enc(t))).toBe(t);
  });
  it('codici condivisi: À e Å → À; Ä e Æ → Ä', () => {
    expect(dec('.--.- .-.-')).toBe('ÀÄ');
  });
});

describe('temporizzazione', () => {
  it('unità secondo PARIS: 20 WPM = 60 ms', () => expect(unitMs(20)).toBe(60));
  it('E = un punto', () => expect(morseTimeline(textToWords('e').words, 20)).toEqual([{ on: true, ms: 60 }]));
  it('A = punto, pausa 1, linea', () => {
    expect(morseTimeline(textToWords('a').words, 20)).toEqual([
      { on: true, ms: 60 }, { on: false, ms: 60 }, { on: true, ms: 180 },
    ]);
  });
  it('pause tra lettere (3) e tra parole (7)', () => {
    const t = morseTimeline(textToWords('e e').words, 20);
    expect(t).toEqual([{ on: true, ms: 60 }, { on: false, ms: 420 }, { on: true, ms: 60 }]);
    const t2 = morseTimeline([['.'], ['.']], 20);
    expect(t2[1]).toEqual({ on: false, ms: 420 });
    const t3 = morseTimeline([['.', '.']], 20);
    expect(t3[1]).toEqual({ on: false, ms: 180 });
  });
  it('durata totale di PARIS = 50 unità', () => {
    // PARIS + pausa di parola finale: 43 unità di segnale e pause interne + 7 = 50
    expect(totalMs(morseTimeline(textToWords('paris').words, 20))).toBe(43 * 60);
  });
  it('vuoto', () => expect(morseTimeline([], 20)).toEqual([]));
});
