// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { DEFAULT_OPTIONS, NO_OPTIONS, cleanStats, cleanText, countLines, type CleanOptions } from './text-cleaner';

const only = (o: Partial<CleanOptions>): CleanOptions => ({ ...NO_OPTIONS, ...o });

describe('cleanText: casi generali', () => {
  it('testo vuoto', () => {
    expect(cleanText('', DEFAULT_OPTIONS)).toBe('');
  });
  it('nessuna opzione = testo identico (anche con CRLF e caratteri strani)', () => {
    const t = ' a ​b  “c”\r\n\r\n\r\n- d…\r\n';
    expect(cleanText(t, NO_OPTIONS)).toBe(t);
  });
  it('i default su un testo normale non lo cambiano', () => {
    expect(cleanText('Ciao mondo.\n\nSecondo paragrafo.', DEFAULT_OPTIONS)).toBe('Ciao mondo.\n\nSecondo paragrafo.');
  });
  it('CRLF: unisce le righe e mantiene CRLF', () => {
    expect(cleanText('una\r\nfrase\r\n\r\nnuova', only({ joinLines: true }))).toBe('una frase\r\n\r\nnuova');
  });
  it('CR isolato è trattato come a capo', () => {
    expect(cleanText('a\rb', only({ joinLines: true }))).toBe('a b');
  });
});

describe('unisci righe', () => {
  const o = only({ joinLines: true });
  it('a capo singolo diventa spazio, riga vuota resta', () => {
    expect(cleanText('uno\ndue\n\ntre\nquattro', o)).toBe('uno due\n\ntre quattro');
  });
  it('non raddoppia gli spazi esistenti', () => {
    expect(cleanText('uno \ndue\n  tre', o)).toBe('uno due  tre');
  });
  it('più righe vuote restano come sono', () => {
    expect(cleanText('a\n\n\nb', o)).toBe('a\n\n\nb');
  });
  it('riga con solo spazi conta come vuota', () => {
    expect(cleanText('a\n  \nb', o)).toBe('a\n  \nb');
  });
  it('a capo finale conservato', () => {
    expect(cleanText('a\nb\n', o)).toBe('a b\n');
  });
});

describe('parole con trattino a fine riga', () => {
  const o = only({ dehyphen: true });
  it('riunisce se la riga dopo comincia con minuscola', () => {
    expect(cleanText('un paro-\nla spezzata', o)).toBe('un parola spezzata');
  });
  it('non riunisce se comincia con maiuscola o cifra', () => {
    expect(cleanText('Nord-\nOvest', o)).toBe('Nord-\nOvest');
    expect(cleanText('anno-\n2026', o)).toBe('anno-\n2026');
  });
  it('serve una lettera prima del trattino', () => {
    expect(cleanText('10 -\nsotto', o)).toBe('10 -\nsotto');
    expect(cleanText('--\nsotto', o)).toBe('--\nsotto');
  });
  it('spazi dopo il trattino e unicode accentato', () => {
    expect(cleanText('perché-  \nò', o)).toBe('perchéò');
    expect(cleanText('Straße-\nüber', o)).toBe('Straßeüber');
  });
  it('catena di più righe', () => {
    expect(cleanText('a-\nb-\nc', o)).toBe('abc');
  });
  it('con unisci righe: parola riunita, il resto unito con spazio', () => {
    expect(cleanText('una paro-\nla e poi\nfine', only({ dehyphen: true, joinLines: true }))).toBe('una parola e poi fine');
  });
  it('senza l\'opzione il trattino resta', () => {
    expect(cleanText('paro-\nla', only({ joinLines: true }))).toBe('paro- la');
  });
});

describe('spazi', () => {
  it('riduce spazi e tabulazioni multipli', () => {
    expect(cleanText('a   b\t\tc \t d', only({ collapseSpaces: true }))).toBe('a b c d');
  });
  it('lascia un tab singolo', () => {
    expect(cleanText('a\tb', only({ collapseSpaces: true }))).toBe('a\tb');
  });
  it('trim di ogni riga', () => {
    expect(cleanText('  a  \n\t b\t\n', only({ trimLines: true }))).toBe('a\nb\n');
  });
  it('trim con CRLF', () => {
    expect(cleanText(' a \r\n b ', only({ trimLines: true }))).toBe('a\r\nb');
  });
});

describe('righe vuote', () => {
  it('una sola', () => {
    expect(cleanText('a\n\n\n\nb\n  \n\t\nc', only({ blankLines: 'single' }))).toBe('a\n\nb\n  \nc');
  });
  it('una sola: anche all\'inizio e alla fine', () => {
    expect(cleanText('\n\n\na\n\n\n', only({ blankLines: 'single' }))).toBe('\na\n');
  });
  it('nessuna', () => {
    expect(cleanText('a\n\n\nb\n  \nc\n', only({ blankLines: 'none' }))).toBe('a\nb\nc');
  });
  it('nessuna con CRLF', () => {
    expect(cleanText('a\r\n\r\nb', only({ blankLines: 'none' }))).toBe('a\r\nb');
  });
  it('testo di sole righe vuote', () => {
    expect(cleanText('\n\n\n', only({ blankLines: 'none' }))).toBe('');
  });
});

describe('virgolette, trattini, invisibili', () => {
  it('virgolette e apostrofi', () => {
    expect(cleanText('“ciao” ‘a’ l’ora „x‟ ‚y‛', only({ straightQuotes: true }))).toBe('"ciao" \'a\' l\'ora "x" \'y\'');
  });
  it('le virgolette « » restano', () => {
    expect(cleanText('«ciao»', only({ straightQuotes: true }))).toBe('«ciao»');
  });
  it('trattini e puntini', () => {
    expect(cleanText('a — b – c ― d … e ‑ f − g', only({ simpleDashes: true }))).toBe('a - b - c - d ... e - f - g');
  });
  it('invisibili e NBSP', () => {
    expect(cleanText('﻿a​b­c‎d‪e⁠f g h', only({ invisibles: true }))).toBe('abcdef g h');
  });
  it('ZWJ delle emoji composte resta', () => {
    const fam = '👨‍👩‍👧';
    expect(cleanText(fam, only({ invisibles: true }))).toBe(fam);
  });
});

describe('HTML', () => {
  const o = only({ stripHtml: true });
  it('toglie i tag, il testo resta', () => {
    expect(cleanText('<p class="x">Ciao <b>mondo</b></p><br/>', o)).toBe('Ciao mondo');
  });
  it('commenti e tag con attributi che contengono >', () => {
    expect(cleanText('a<!-- nota -->b', o)).toBe('ab');
  });
  it('decodifica solo le entità previste', () => {
    expect(cleanText('a &amp; b &lt;c&gt; &quot;d&quot;&nbsp;e &copy; &#39;', o)).toBe('a & b <c> "d" e &copy; &#39;');
  });
  it('non decodifica due volte', () => {
    expect(cleanText('&amp;lt;b&amp;gt;', o)).toBe('&lt;b&gt;');
  });
  it('un tag decodificato non viene tolto', () => {
    expect(cleanText('&lt;b&gt;x', o)).toBe('<b>x');
  });
  it('un "minore di" in una formula resta', () => {
    expect(cleanText('se a < b e c > d', o)).toBe('se a < b e c > d');
    expect(cleanText('3<4 e 5>2', o)).toBe('3<4 e 5>2');
  });
});

describe('elenchi', () => {
  const o = only({ stripBullets: true });
  it('toglie pallini e numeri', () => {
    expect(cleanText('• uno\n- due\n* tre\n1. quattro\n2) cinque\n  ◦ sei', o)).toBe('uno\ndue\ntre\nquattro\ncinque\nsei');
  });
  it('non tocca numeri e trattini attaccati', () => {
    expect(cleanText('-5 gradi\n3.14 pi\n2026. anno\nok', o)).toBe('-5 gradi\n3.14 pi\n2026. anno\nok');
  });
  it('con unisci righe le voci restano separate', () => {
    expect(cleanText('• uno\n• due\n  continua', only({ stripBullets: true, joinLines: true, trimLines: true }))).toBe('uno\ndue continua');
  });
});

describe('maiuscole', () => {
  it('minuscolo, anche unicode', () => {
    expect(cleanText('CIAO Èè ÀÉ', only({ caseMode: 'lower' }))).toBe('ciao èè àé');
  });
  it('prima lettera di ogni frase', () => {
    expect(cleanText('ciao. come stai? bene! è tardi… domani', only({ caseMode: 'sentence' }))).toBe('Ciao. Come stai? Bene! È tardi… Domani');
  });
  it('dopo riga vuota e dopo virgolette aperte; il resto non cambia', () => {
    expect(cleanText('uno\n\n«due». "tre" iPhone', only({ caseMode: 'sentence' }))).toBe('Uno\n\n«Due». "Tre" iPhone');
  });
  it('non maiuscola dopo un a capo singolo', () => {
    expect(cleanText('una frase\nspezzata', only({ caseMode: 'sentence' }))).toBe('Una frase\nspezzata');
  });
  it('testo già in maiuscolo o senza lettere', () => {
    expect(cleanText('123. 456', only({ caseMode: 'sentence' }))).toBe('123. 456');
  });
});

describe('combinazioni', () => {
  it('testo da PDF', () => {
    const t = '﻿  Il gat-\n  to dormiva sul   divano.\n\n\n\n“Che bello”,\ndisse.  ';
    const o: CleanOptions = { ...DEFAULT_OPTIONS, dehyphen: true };
    expect(cleanText(t, o)).toBe('Il gatto dormiva sul divano.\n\n"Che bello", disse.');
  });
  it('è idempotente con i default', () => {
    const once = cleanText('a  b\n c\n\n\n\nd “e”', DEFAULT_OPTIONS);
    expect(cleanText(once, DEFAULT_OPTIONS)).toBe(once);
  });
  it('tutte le opzioni insieme', () => {
    const t = '<p>• Primo  PUNTO — uno</p>\n<p>• secondo… “x”</p>';
    const o: CleanOptions = { ...DEFAULT_OPTIONS, stripHtml: true, stripBullets: true, simpleDashes: true, joinLines: true, caseMode: 'lower' };
    expect(cleanText(t, o)).toBe('primo punto - uno\nsecondo... "x"');
  });
  it('un milione di caratteri in tempi ragionevoli', () => {
    const t = 'parola  spezzata-\nfine riga <b>x</b>\n'.repeat(30_000);
    const start = performance.now();
    cleanText(t, { ...DEFAULT_OPTIONS, dehyphen: true, stripHtml: true, stripBullets: true, caseMode: 'sentence' });
    expect(performance.now() - start).toBeLessThan(3000);
  });
});

describe('statistiche', () => {
  it('conta le righe', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\r\nb\nc\rd')).toBe(4);
  });
  it('caratteri e righe tolti', () => {
    expect(cleanStats('a  b\n\n\nc', 'a b\n\nc')).toEqual({ charsRemoved: 2, linesRemoved: 1 });
  });
  it('mai negativi', () => {
    expect(cleanStats('a…', 'a...')).toEqual({ charsRemoved: 0, linesRemoved: 0 });
  });
});
