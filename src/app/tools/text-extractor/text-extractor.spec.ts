// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { KINDS, MAX_CHARS, arrange, countOf, extract, findAll, isValidDate, isValidIban, toCsv, toText, type Kind } from './text-extractor';

const values = (text: string, kind: Kind, o: Parameters<typeof extract>[2] = {}): string[] => extract(text, kind, o).items.map((i) => i.value);

describe('email', () => {
  it('trova gli indirizzi e li separa dalla punteggiatura', () => {
    expect(values('Scrivi a mario.rossi+x@example.com, oppure (info@sito.it).', 'email')).toEqual(['mario.rossi+x@example.com', 'info@sito.it']);
  });
  it('sottodomini e trattini', () => {
    expect(values('a_b@mail.my-dom.co.uk', 'email')).toEqual(['a_b@mail.my-dom.co.uk']);
  });
  it('non sono email', () => {
    expect(values('@mario, a@b, x@.it, a@b..it, mario@-x.it, solo@ qui, @@@', 'email')).toEqual([]);
  });
  it('indirizzo seguito da un punto di fine frase', () => {
    expect(values('Contatto: a@b.it.', 'email')).toEqual(['a@b.it']);
  });
});

describe('url', () => {
  it('toglie la punteggiatura finale', () => {
    expect(values('vedi https://a.it/x, poi http://b.it/y. Infine (https://c.it/z)!', 'url')).toEqual(['https://a.it/x', 'http://b.it/y', 'https://c.it/z']);
  });
  it('www senza schema', () => {
    expect(values('Visita www.esempio.it/pagina?x=1&y=2; ciao', 'url')).toEqual(['www.esempio.it/pagina?x=1&y=2']);
  });
  it('mantiene le parentesi bilanciate dentro l\'indirizzo', () => {
    expect(values('https://it.wikipedia.org/wiki/Foo_(bar)', 'url')).toEqual(['https://it.wikipedia.org/wiki/Foo_(bar)']);
    expect(values('(https://it.wikipedia.org/wiki/Foo_(bar))', 'url')).toEqual(['https://it.wikipedia.org/wiki/Foo_(bar)']);
  });
  it('non sono URL', () => {
    expect(values('http:// www. www.com ftp://x.it https', 'url')).toEqual([]);
  });
  it('non prende l\'indirizzo dentro un\'email', () => {
    expect(values('a@www.esempio.it', 'url')).toEqual([]);
  });
});

describe('ipv4 e ipv6', () => {
  it('ipv4 validi', () => {
    expect(values('Server 192.168.1.10 e 255.255.255.255, 0.0.0.0.', 'ipv4')).toEqual(['192.168.1.10', '255.255.255.255', '0.0.0.0']);
  });
  it('ipv4 non validi', () => {
    expect(values('256.1.1.1 1.2.3 1.2.3.4.5 01.02.03.04 999.999.999.999', 'ipv4')).toEqual([]);
  });
  it('ipv6 forma comune', () => {
    expect(values('IP 2001:db8::ff00:42:8329, ::1 e fe80::1.', 'ipv6')).toEqual(['2001:db8::ff00:42:8329', '::1', 'fe80::1']);
    expect(values('2001:0db8:85a3:0000:0000:8a2e:0370:7334', 'ipv6')).toEqual(['2001:0db8:85a3:0000:0000:8a2e:0370:7334']);
  });
  it('ipv6 non validi: orari, gruppi troppo lunghi, doppio «::»', () => {
    expect(values('ore 12:30:45 e 1:2:3:4:5:6:7 e 12345::1 e 1::2::3 e std::vector', 'ipv6')).toEqual([]);
  });
});

describe('numeri', () => {
  it('interi, decimali, segno e migliaia', () => {
    expect(values('Ho 42 mele, -7 pere, +3,5 kg, 1.234,56 euro, 1,234.56 USD e 0.5', 'number')).toEqual(['42', '-7', '+3,5', '1.234,56', '1,234.56', '0.5']);
  });
  it('un decimale lungo non si spezza', () => {
    expect(values('pi 3.14159 e 1234.5678', 'number')).toEqual(['3.14159', '1234.5678']);
  });
  it('numeri dentro una parola non contano; intervalli sì', () => {
    expect(values('COVID19 x5 2020-2021', 'number')).toEqual(['2020', '2021']);
  });
  it('nessun numero', () => {
    expect(values('niente da vedere, né 1, né 2'.replace(/\d/g, 'x'), 'number')).toEqual([]);
  });
});

describe('date', () => {
  it('formati supportati', () => {
    expect(values('15/03/2024, 15-03-2024, 15.03.2024, 2024-03-15 e 5/3/2024', 'date')).toEqual(['15/03/2024', '15-03-2024', '15.03.2024', '2024-03-15', '5/3/2024']);
  });
  it('il 31/02 non è una data', () => {
    expect(values('31/02/2024 30/02/2024 31/04/2024 00/01/2024 15/13/2024 2024-02-30', 'date')).toEqual([]);
  });
  it('anni bisestili', () => {
    expect(isValidDate(2024, 2, 29)).toBe(true);
    expect(isValidDate(2023, 2, 29)).toBe(false);
    expect(isValidDate(1900, 2, 29)).toBe(false);
    expect(isValidDate(2000, 2, 29)).toBe(true);
  });
  it('separatori misti o cifre attaccate non sono date', () => {
    expect(values('15/03-2024 115/03/2024 15/03/20245', 'date')).toEqual([]);
  });
});

describe('telefoni', () => {
  it('formati italiani e internazionali', () => {
    const t = 'Chiama +39 333 1234567, 06 1234567, 0039 333 1234567, 333-123.4567 o (02) 1234 5678.';
    expect(values(t, 'phone')).toEqual(['+39 333 1234567', '06 1234567', '0039 333 1234567', '333-123.4567', '(02) 1234 5678']);
  });
  it('meno di 8 cifre, date e IP non sono telefoni', () => {
    expect(values('1234567 06 12345 2024-01-15 15.03.2024 192.168.1.1', 'phone')).toEqual([]);
  });
  it('troppe cifre: non è un telefono', () => {
    expect(values('1234567890123456789012345', 'phone')).toEqual([]);
  });
});

describe('hashtag e menzioni', () => {
  it('hashtag', () => {
    expect(values('Che #bella_giornata a #Roma! #2024 non lo è, né a#b né https://x.it/#top, ma #città sì', 'hashtag')).toEqual(['#bella_giornata', '#Roma', '#città']);
  });
  it('menzioni, non le email', () => {
    expect(values('Ciao @mario_rossi e @Anna! Scrivi a mario@x.it, @123 no', 'mention')).toEqual(['@mario_rossi', '@Anna']);
  });
  it('ignora maiuscole nei doppioni', () => {
    expect(values('#Roma #roma #ROMA', 'hashtag')).toEqual(['#Roma']);
    expect(values('#Roma #roma #ROMA', 'hashtag', { ignoreCase: false })).toEqual(['#Roma', '#roma', '#ROMA']);
    expect(values('A@x.it a@X.it', 'email')).toEqual(['A@x.it']);
  });
  it('per gli altri tipi le maiuscole contano sempre', () => {
    expect(values('#ABC #abc', 'color')).toEqual(['#ABC', '#abc']);
  });
});

describe('iban', () => {
  it('IBAN di esempio, compatto e con spazi', () => {
    expect(isValidIban('IT60X0542811101000000123456')).toBe(true);
    expect(isValidIban('it60 x054 2811 1010 0000 0123 456')).toBe(true);
    expect(values('Bonifico a IT60X0542811101000000123456 grazie', 'iban')).toEqual(['IT60X0542811101000000123456']);
    expect(values('IBAN: IT60 X054 2811 1010 0000 0123 456 per favore', 'iban')).toEqual(['IT60 X054 2811 1010 0000 0123 456']);
  });
  it('altri paesi', () => {
    expect(values('DE89 3704 0044 0532 0130 00 e GB82WEST12345698765432', 'iban')).toEqual(['DE89 3704 0044 0532 0130 00', 'GB82WEST12345698765432']);
  });
  it('cifra di controllo, lunghezza e paese sbagliati', () => {
    expect(isValidIban('IT61X0542811101000000123456')).toBe(false);
    expect(isValidIban('IT60X054281110100000012345')).toBe(false);
    expect(isValidIban('ZZ60X0542811101000000123456')).toBe(false);
    expect(values('IT61X0542811101000000123456 IT60X0542811101000000123456abc', 'iban')).toEqual([]);
  });
  it('stesso IBAN con spazi diversi è un doppione', () => {
    expect(values('IT60X0542811101000000123456 e IT60 X054 2811 1010 0000 0123 456', 'iban')).toEqual(['IT60X0542811101000000123456']);
  });
});

describe('uuid, colori, euro', () => {
  it('uuid', () => {
    expect(values('id 123e4567-e89b-12d3-a456-426614174000, 123E4567-E89B-12D3-A456-426614174000 e 123e4567-e89b-12d3-a456-42661417400', 'uuid')).toEqual([
      '123e4567-e89b-12d3-a456-426614174000',
      '123E4567-E89B-12D3-A456-426614174000',
    ]);
  });
  it('colori esadecimali', () => {
    expect(values('#fff, #1A2b3C; #12345 #ggg #1234567 &#123; x#fff', 'color')).toEqual(['#fff', '#1A2b3C']);
  });
  it('importi in euro', () => {
    const t = 'Paga € 1.234,56 e 1234,56 € poi EUR 12, 7,5€ e 3 euro. Costa 12 dollari, 1.234,56.';
    expect(values(t, 'euro')).toEqual(['€ 1.234,56', '1234,56 €', 'EUR 12', '7,5€', '3 euro']);
  });
  it('un numero senza simbolo non è un importo', () => {
    expect(values('Ne ho 12 e 3,5 ma EURO è una parola: europa', 'euro')).toEqual([]);
  });
});

describe('opzioni: doppioni, ordine, conteggi', () => {
  const text = 'b@x.it a@x.it b@x.it c@x.it b@x.it a@x.it';
  it('senza doppioni (predefinito) in ordine di apparizione', () => {
    const r = extract(text, 'email');
    expect(r.items.map((i) => i.value)).toEqual(['b@x.it', 'a@x.it', 'c@x.it']);
    expect(r.items.map((i) => i.count)).toEqual([3, 2, 1]);
    expect(r.total).toBe(6);
  });
  it('con i doppioni', () => {
    expect(values(text, 'email', { unique: false })).toHaveLength(6);
  });
  it('A → Z', () => {
    expect(values(text, 'email', { sort: 'az' })).toEqual(['a@x.it', 'b@x.it', 'c@x.it']);
    expect(values('#10 #9 #b #a', 'hashtag', { sort: 'az' })).toEqual(['#a', '#b']);
    expect(values('v10 v9 v2'.replace(/v/g, ''), 'number', { sort: 'az' })).toEqual(['2', '9', '10']);
  });
  it('per frequenza decrescente, a parità per apparizione', () => {
    expect(values('c@x.it a@x.it b@x.it b@x.it a@x.it b@x.it', 'email', { sort: 'frequency' })).toEqual(['b@x.it', 'a@x.it', 'c@x.it']);
    const r = extract('x@y.it z@y.it', 'email', { sort: 'frequency' });
    expect(r.items.map((i) => i.value)).toEqual(['x@y.it', 'z@y.it']);
  });
  it('frequenza con i doppioni tiene vicine le voci uguali', () => {
    expect(values('c@x.it a@x.it c@x.it a@x.it c@x.it', 'email', { sort: 'frequency', unique: false })).toEqual(['c@x.it', 'c@x.it', 'c@x.it', 'a@x.it', 'a@x.it']);
  });
  it('countOf segue l\'opzione dei doppioni', () => {
    const m = findAll(text, 'email');
    expect(countOf(m, 'email')).toBe(3);
    expect(countOf(m, 'email', { unique: false })).toBe(6);
  });
});

describe('testo vuoto e limiti', () => {
  it('testo vuoto: nessuna voce per nessun tipo', () => {
    for (const k of KINDS) expect(extract('', k)).toEqual({ items: [], total: 0 });
  });
  it('testo senza voci', () => {
    for (const k of KINDS) expect(extract('niente di speciale qui, solo parole', k).items).toEqual([]);
  });
  it('oltre il limite non estrae', () => {
    expect(extract('a@b.it '.repeat(Math.ceil(MAX_CHARS / 7) + 1), 'email').items).toEqual([]);
  });
});

describe('esportazione', () => {
  const items = arrange(['a', 'b', 'a', 'c;d'], 'hashtag', { unique: true }).items;
  it('separatori', () => {
    expect(toText(items)).toBe('a\nb\nc;d');
    expect(toText(items, 'comma')).toBe('a, b, c;d');
    expect(toText(items, 'semicolon')).toBe('a; b; c;d');
    expect(toText(items, 'newline', true)).toBe('a (2)\nb (1)\nc;d (1)');
  });
  it('csv voce;conteggio, con virgolette quando servono, una riga per voce distinta', () => {
    const all = arrange(['a', 'b', 'a'], 'hashtag', { unique: false }).items;
    expect(toCsv(all)).toBe('﻿a;2\r\nb;1\r\n');
    expect(toCsv(items)).toContain('"c;d";1');
    expect(toCsv([])).toBe('﻿');
  });
});

describe('robustezza: stringhe patologiche da 100.000 caratteri', () => {
  const N = 100_000;
  const patho: Record<string, string> = {
    lettere: 'a'.repeat(N),
    cifre: '1'.repeat(N),
    'cifre e spazi': '1 '.repeat(N / 2),
    'cifre e punti': '1.'.repeat(N / 2),
    'cifre e virgole': '1,'.repeat(N / 2),
    chiocciole: '@'.repeat(N),
    'a@': 'a@'.repeat(N / 2),
    'a@b.': 'a@b.'.repeat(N / 4),
    'due punti': ':'.repeat(N),
    'esadecimali e due punti': 'a:'.repeat(N / 2),
    cancelletti: '#'.repeat(N),
    'cancelletti e lettere': '#a'.repeat(N / 2),
    schemi: 'http://'.repeat(N / 7),
    'www.': 'www.'.repeat(N / 4),
    'url e parentesi': 'http://a' + ')'.repeat(N),
    'trattini e cifre': '1-'.repeat(N / 2),
    euro: '€'.repeat(N),
    'euro e cifre': '€ ' + '1'.repeat(N),
    'cifre seguite da euro mancante': '1'.repeat(N) + 'x',
    'sigle': 'IT60'.repeat(N / 4),
    'sigle con spazi': 'IT60 '.repeat(N / 5),
    'uuid parziali': '12345678-'.repeat(N / 9),
    esadecimali: 'f'.repeat(N),
    'date parziali': '12/'.repeat(N / 3),
    parentesi: '('.repeat(N),
  };
  for (const [name, text] of Object.entries(patho)) {
    it(`${name}: tutti i tipi in meno di un secondo`, () => {
      for (const kind of KINDS) {
        const t0 = performance.now();
        findAll(text, kind);
        const ms = performance.now() - t0;
        expect(ms, `${kind} su «${name}»: ${ms.toFixed(0)} ms`).toBeLessThan(1000);
      }
    });
  }
});

describe('testo misto realistico', () => {
  const t = 'Scrivi a mario.rossi@example.com o a info@sito.it (copia: Mario.Rossi@example.com). Vedi https://sito.it/x, poi www.esempio.it. Fattura del 15/03/2024 e del 31/02/2024, IBAN IT60X0542811101000000123456, tel. +39 333 1234567.';
  it('conteggi per tipo', () => {
    expect(values(t, 'email')).toEqual(['mario.rossi@example.com', 'info@sito.it']);
    expect(values(t, 'url')).toEqual(['https://sito.it/x', 'www.esempio.it']);
    expect(values(t, 'date')).toEqual(['15/03/2024']);
    expect(values(t, 'iban')).toEqual(['IT60X0542811101000000123456']);
    expect(values(t, 'phone')).toEqual(['+39 333 1234567']);
  });
});
