// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { CASE_IDS, CaseId, CaseOptions, DEFAULT_OPTIONS, convertCase, splitWords } from './case';

const opt = (o: Partial<CaseOptions> = {}): CaseOptions => ({ ...DEFAULT_OPTIONS, ...o });
const c = (text: string, id: CaseId, o: Partial<CaseOptions> = {}) => convertCase(text, id, opt(o));
const texts = (s: string) => splitWords(s).map((w) => w.text);

describe('splitWords', () => {
  it('separatori vari', () => {
    expect(texts('hello world_foo-bar.baz/qux\\x  y')).toEqual(['hello', 'world', 'foo', 'bar', 'baz', 'qux', 'x', 'y']);
  });
  it('camelCase, PascalCase e sigle', () => {
    expect(texts('helloWorld')).toEqual(['hello', 'World']);
    expect(texts('HelloWorld')).toEqual(['Hello', 'World']);
    expect(texts('XMLHttpRequest')).toEqual(['XML', 'Http', 'Request']);
    expect(texts('getHTTPResponse')).toEqual(['get', 'HTTP', 'Response']);
    expect(texts('parseURL')).toEqual(['parse', 'URL']);
  });
  it('cifre', () => {
    expect(texts('version2Beta')).toEqual(['version2', 'Beta']);
    expect(texts('H2O')).toEqual(['H2O']);
    expect(texts('top 10 list')).toEqual(['top', '10', 'list']);
    expect(texts('2nd')).toEqual(['2nd']);
  });
  it('lettere accentate e non latine', () => {
    expect(texts('perché ÈSempio')).toEqual(['perché', 'È', 'Sempio']);
    expect(texts('città_dell\'arte')).toEqual(['città', "dell'arte"]);
    expect(texts('привет мир')).toEqual(['привет', 'мир']);
  });
  it('apostrofi: dentro la parola sì, ai bordi no', () => {
    expect(texts("don't 'quoted' rock’n’roll")).toEqual(["don't", 'quoted', 'rock’n’roll']);
  });
  it('segni combinanti restano nella parola', () => {
    expect(texts('café au lait')).toEqual(['café', 'au', 'lait']);
  });
  it('testo vuoto o solo separatori', () => {
    expect(texts('')).toEqual([]);
    expect(texts(' -- __ ')).toEqual([]);
  });
  it('riconosce le sigle solo se c\'è anche testo minuscolo', () => {
    expect(splitWords('use HTTP now').map((w) => w.acronym)).toEqual([false, true, false]);
    expect(splitWords('USE HTTP NOW').map((w) => w.acronym)).toEqual([false, false, false]);
    expect(splitWords('A b').map((w) => w.acronym)).toEqual([false, false]);
  });
});

describe('forme per il codice', () => {
  const src = 'hello big World';
  it.each([
    ['camel', 'helloBigWorld'],
    ['pascal', 'HelloBigWorld'],
    ['snake', 'hello_big_world'],
    ['screaming', 'HELLO_BIG_WORLD'],
    ['kebab', 'hello-big-world'],
    ['train', 'Hello-Big-World'],
    ['dot', 'hello.big.world'],
    ['path', 'hello/big/world'],
  ] as [CaseId, string][])('%s', (id, expected) => {
    expect(c(src, id)).toBe(expected);
  });
  it('si parte da qualsiasi forma e si ottiene lo stesso risultato', () => {
    for (const s of ['userProfileId', 'UserProfileId', 'user_profile_id', 'USER_PROFILE_ID', 'user-profile-id', 'User-Profile-Id', 'user.profile.id', 'user/profile/id', 'user profile id', 'User Profile ID']) {
      expect(c(s, 'snake'), s).toBe('user_profile_id');
      expect(c(s, 'camel', { keepAcronyms: false }), s).toBe('userProfileId');
    }
  });
  it('acronimi mantenuti o no', () => {
    expect(c('parse the XML Http request', 'camel')).toBe('parseTheXMLHttpRequest');
    expect(c('parse the XML Http request', 'camel', { keepAcronyms: false })).toBe('parseTheXmlHttpRequest');
    expect(c('get HTTP response', 'pascal')).toBe('GetHTTPResponse');
    expect(c('get HTTP response', 'train')).toBe('Get-HTTP-Response');
    expect(c('get HTTP response', 'snake')).toBe('get_http_response');
  });
  it('un testo tutto maiuscolo non ha sigle', () => {
    expect(c('HELLO WORLD', 'camel')).toBe('helloWorld');
    expect(c('HELLO WORLD', 'pascal')).toBe('HelloWorld');
  });
  it('il primo termine di camelCase è sempre minuscolo, anche se sigla', () => {
    expect(c('HTTP server', 'camel')).toBe('httpServer');
  });
  it('apostrofi tolti, cifre mantenute', () => {
    expect(c("don't stop 2nd time", 'snake')).toBe('dont_stop_2nd_time');
    expect(c('version 2 beta', 'camel')).toBe('version2Beta');
  });
  it('accenti: mantenuti o rimossi', () => {
    expect(c('Perché è così', 'snake')).toBe('perché_è_così');
    expect(c('Perché è così', 'snake', { stripAccents: true })).toBe('perche_e_cosi');
    expect(c('Straße größe', 'pascal', { stripAccents: true })).toBe('StrasseGrosse');
    expect(c('città universitaria', 'camel')).toBe('cittàUniversitaria');
  });
  it('maiuscole accentate in PascalCase', () => {
    expect(c('élan vital', 'pascal')).toBe('ÉlanVital');
  });
  it('alfabeti non latini', () => {
    expect(c('привет мир', 'pascal')).toBe('ПриветМир');
  });
  it('emoji e punteggiatura come separatori', () => {
    expect(c('a 😀 b!c', 'snake')).toBe('a_😀_b_c'.replace('😀_', ''));
  });
  it('input vuoto o solo separatori', () => {
    expect(c('', 'camel')).toBe('');
    expect(c('---', 'snake')).toBe('');
  });
});

describe('riga per riga', () => {
  it('ogni riga è una conversione', () => {
    expect(c('hello world\nfoo bar\n\nlast one', 'snake')).toBe('hello_world\nfoo_bar\n\nlast_one');
    expect(c('a b\r\nc d', 'camel')).toBe('aB\ncD');
  });
  it('blocco unico: un solo identificatore', () => {
    expect(c('hello world\nfoo bar', 'snake', { perLine: false })).toBe('hello_world_foo_bar');
    expect(c('hello world\nfoo bar', 'camel', { perLine: false })).toBe('helloWorldFooBar');
  });
  it('blocco unico per i casi di testo mantiene gli a capo', () => {
    expect(c('Ab\ncd', 'upper', { perLine: false })).toBe('AB\nCD');
  });
});

describe('MAIUSCOLO, minuscolo, alternato', () => {
  it('maiuscolo e minuscolo con accenti e ß', () => {
    expect(c('Perché è così', 'upper')).toBe('PERCHÉ È COSÌ');
    expect(c('PERCHÉ È COSÌ', 'lower')).toBe('perché è così');
    expect(c('Straße', 'upper')).toBe('STRASSE');
  });
  it('alternato conta solo le lettere', () => {
    expect(c('hello world', 'alternating')).toBe('hElLo WoRlD');
    expect(c('a-b 1 c', 'alternating')).toBe('a-B 1 c');
  });
});

describe('Sentence case', () => {
  it('prima parola di ogni frase', () => {
    expect(c('HELLO THERE. how ARE you? fine! ok', 'sentence', { perLine: false, keepAcronyms: false })).toBe('Hello there. How are you? Fine! Ok');
    expect(c('HELLO THERE. HOW ARE YOU?', 'sentence')).toBe('Hello there. How are you?');
  });
  it('ogni riga comincia con la maiuscola', () => {
    expect(c('primo test\nSECONDO TEST', 'sentence')).toBe('Primo test\nSecondo test');
  });
  it('conserva le sigle quando c\'è testo normale', () => {
    expect(c('the NASA and ESA launch', 'sentence')).toBe('The NASA and ESA launch');
    expect(c('the NASA and ESA launch', 'sentence', { keepAcronyms: false })).toBe('The nasa and esa launch');
  });
  it('salta punteggiatura iniziale e gestisce accenti', () => {
    expect(c('"è così," disse. perché?', 'sentence')).toBe('"È così," disse. Perché?');
    expect(c('- elenco puntato', 'sentence')).toBe('- Elenco puntato');
  });
  it('un punto dentro un numero non apre una frase', () => {
    expect(c('costa 3.50 euro', 'sentence')).toBe('Costa 3.50 euro');
  });
});

describe('Title Case inglese', () => {
  it('articoli, congiunzioni e preposizioni brevi in minuscolo', () => {
    expect(c('the lord of the rings and the return of the king', 'titleEn')).toBe('The Lord of the Rings and the Return of the King');
  });
  it('prima e ultima parola sempre maiuscole', () => {
    expect(c('what are you up to', 'titleEn')).toBe('What Are You Up To');
    expect(c('a tale of two cities', 'titleEn')).toBe('A Tale of Two Cities');
  });
  it('dopo i due punti si ricomincia', () => {
    expect(c('star wars: a new hope', 'titleEn')).toBe('Star Wars: A New Hope');
  });
  it('preposizioni di quattro lettere o più in maiuscolo', () => {
    expect(c('walking with dogs from home', 'titleEn')).toBe('Walking With Dogs From Home');
  });
  it('parole con trattino e contrazioni', () => {
    expect(c("mother-in-law's well-known don't", 'titleEn')).toBe("Mother-in-Law's Well-Known Don't");
  });
  it('maiuscole originali irrilevanti, sigle mantenute', () => {
    expect(c('BREAKING NEWS FROM THE NASA', 'titleEn')).toBe('Breaking News From the Nasa');
    expect(c('breaking news from the NASA team', 'titleEn')).toBe('Breaking News From the NASA Team');
  });
  it('ogni riga è un titolo', () => {
    expect(c('the first\nthe second', 'titleEn')).toBe('The First\nThe Second');
  });
});

describe('Title Case italiano', () => {
  it('articoli e preposizioni (anche articolate) in minuscolo', () => {
    expect(c('il nome della rosa', 'titleIt')).toBe('Il Nome della Rosa');
    expect(c('la storia di una città sul mare', 'titleIt')).toBe('La Storia di una Città sul Mare');
  });
  it('elisioni', () => {
    expect(c("l'isola del tesoro", 'titleIt')).toBe("L'Isola del Tesoro");
    expect(c("storia dell'arte moderna", 'titleIt')).toBe("Storia dell'Arte Moderna");
    expect(c("un'altra storia", 'titleIt')).toBe("Un'Altra Storia");
  });
  it('ultima parola sempre maiuscola, anche se è una preposizione', () => {
    expect(c('cosa ci sta dietro e da', 'titleIt')).toBe('Cosa Ci Sta Dietro e Da');
  });
  it('accenti', () => {
    expect(c('perché la città è così', 'titleIt')).toBe('Perché la Città È Così');
  });
});

describe('tutte le forme', () => {
  it('non lanciano e danno una stringa su testi strani', () => {
    for (const id of CASE_IDS) {
      for (const s of ['', ' ', '😀', 'a\n\nb', '\uD800', '___', "'", 'X', 'ǅ ǆ', 'İstanbul']) {
        for (const o of [opt(), opt({ perLine: false, stripAccents: true, keepAcronyms: false })]) {
          expect(typeof convertCase(s, id, o), `${id} ${JSON.stringify(s)}`).toBe('string');
        }
      }
    }
  });
});
