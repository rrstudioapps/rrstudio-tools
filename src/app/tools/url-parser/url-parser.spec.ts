// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  ParsedUrl,
  buildQuery,
  domainToUnicode,
  encodeQueryPart,
  isTrackingParam,
  moveParam,
  newParam,
  parseQuery,
  parseUrl,
  punycodeDecode,
  rebuildUrl,
  removeTracking,
  safeDecode,
  splitHost,
  updateParam,
  withScheme,
} from './url-parser';

function parse(s: string): ParsedUrl {
  const r = parseUrl(s);
  if (!r.ok) throw new Error(r.error);
  return r.url;
}

describe('parseUrl: componenti', () => {
  const u = parse('https://mario:p%40ss@www.example.co.uk:8443/a/b%20c/d.html?x=1&y=due%20parole#sezione-2');
  it('protocollo, utente, password, porta', () => {
    expect(u.protocol).toBe('https');
    expect(u.username).toBe('mario');
    expect(u.password).toBe('p@ss');
    expect(u.port).toBe('8443');
    expect(u.defaultPort).toBe('443');
    expect(u.assumedScheme).toBe(false);
  });
  it('host, sottodominio e dominio', () => {
    expect(u.host).toBe('www.example.co.uk');
    expect(u.hostParts).toEqual({ isIp: false, subdomain: 'www', domain: 'example.co.uk', tld: 'co.uk' });
    expect(u.origin).toBe('https://www.example.co.uk:8443');
  });
  it('percorso e segmenti decodificati', () => {
    expect(u.pathRaw).toBe('/a/b%20c/d.html');
    expect(u.path).toBe('/a/b c/d.html');
    expect(u.segments).toEqual([
      { raw: 'a', decoded: 'a' },
      { raw: 'b%20c', decoded: 'b c' },
      { raw: 'd.html', decoded: 'd.html' },
    ]);
  });
  it('query e frammento', () => {
    expect(u.search).toBe('?x=1&y=due%20parole');
    expect(u.params.map((p) => [p.key, p.value])).toEqual([
      ['x', '1'],
      ['y', 'due parole'],
    ]);
    expect(u.hash).toBe('sezione-2');
    expect(u.hashRaw).toBe('#sezione-2');
  });
  it('porta predefinita non compare', () => {
    expect(parse('https://example.com:443/').port).toBe('');
    expect(parse('http://example.com/').defaultPort).toBe('80');
  });
  it('percorso vuoto e radice senza segmenti', () => {
    expect(parse('https://example.com').segments).toEqual([]);
    expect(parse('https://example.com/').segments).toEqual([]);
    expect(parse('https://example.com/a/').segments.map((s) => s.raw)).toEqual(['a']);
  });
  it('errori', () => {
    expect(parseUrl('   ')).toEqual({ ok: false, error: 'empty' });
    expect(parseUrl('http://')).toEqual({ ok: false, error: 'invalid' });
    expect(parseUrl('https://exa mple.com')).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('protocollo mancante', () => {
  it('aggiunge https://', () => {
    const u = parse('example.com/x?a=1');
    expect(u.assumedScheme).toBe(true);
    expect(u.href).toBe('https://example.com/x?a=1');
  });
  it('host:porta non è uno schema', () => {
    const u = parse('localhost:3000/api');
    expect(u.host).toBe('localhost');
    expect(u.port).toBe('3000');
    expect(u.assumedScheme).toBe(true);
  });
  it('//cdn.example.com/a.js', () => {
    expect(parse('//cdn.example.com/a.js').href).toBe('https://cdn.example.com/a.js');
  });
  it('schemi senza // restano com\'erano', () => {
    const u = parse('mailto:mario@example.com?subject=Ciao%20a%20tutti');
    expect(u.protocol).toBe('mailto');
    expect(u.assumedScheme).toBe(false);
    expect(u.host).toBe('');
    expect(u.params).toMatchObject([{ key: 'subject', value: 'Ciao a tutti' }]);
  });
  it('withScheme', () => {
    expect(withScheme('ftp://a.it')).toEqual({ text: 'ftp://a.it', assumed: false });
    expect(withScheme('a.it')).toEqual({ text: 'https://a.it', assumed: true });
  });
});

describe('IDN e punycode', () => {
  it('punycodeDecode', () => {
    expect(punycodeDecode('mnchen-3ya')).toBe('münchen');
    expect(punycodeDecode('bcher-kva')).toBe('bücher');
    expect(punycodeDecode('e1afmkfd')).toBe('пример');
    expect(punycodeDecode('wgv71a119e')).toBe('日本語');
    expect(punycodeDecode('80ak6aa92e')).toBe('аррӏе');
    expect(punycodeDecode('!!!')).toBeNull();
  });
  it('domainToUnicode', () => {
    expect(domainToUnicode('xn--mnchen-3ya.de')).toBe('münchen.de');
    expect(domainToUnicode('www.xn--e1afmkfd.com')).toBe('www.пример.com');
    expect(domainToUnicode('xn--!!.it')).toBe('xn--!!.it');
    expect(domainToUnicode('example.com')).toBe('example.com');
  });
  it('un URL con nome internazionale mostra entrambe le forme', () => {
    const u = parse('https://münchen.de/straße');
    expect(u.hostAscii).toBe('xn--mnchen-3ya.de');
    expect(u.host).toBe('münchen.de');
    expect(u.hostParts.domain).toBe('münchen.de');
    expect(u.path).toBe('/straße');
    expect(u.pathRaw).toBe('/stra%C3%9Fe');
  });
});

describe('splitHost (euristica)', () => {
  it('casi comuni', () => {
    expect(splitHost('www.example.com')).toEqual({ isIp: false, subdomain: 'www', domain: 'example.com', tld: 'com' });
    expect(splitHost('a.b.example.it')).toEqual({ isIp: false, subdomain: 'a.b', domain: 'example.it', tld: 'it' });
    expect(splitHost('example.com')).toEqual({ isIp: false, subdomain: '', domain: 'example.com', tld: 'com' });
  });
  it('secondi livelli nazionali', () => {
    expect(splitHost('shop.example.co.uk')).toEqual({ isIp: false, subdomain: 'shop', domain: 'example.co.uk', tld: 'co.uk' });
    expect(splitHost('example.com.au')).toEqual({ isIp: false, subdomain: '', domain: 'example.com.au', tld: 'com.au' });
    // due etichette: "co.uk" da solo non è un dominio registrabile ma l'euristica non lo sa
    expect(splitHost('co.uk').domain).toBe('co.uk');
  });
  it('indirizzi IP, localhost, vuoto', () => {
    expect(splitHost('192.168.1.10')).toEqual({ isIp: true, subdomain: '', domain: '192.168.1.10', tld: '' });
    expect(splitHost('[::1]').isIp).toBe(true);
    expect(splitHost('localhost')).toEqual({ isIp: false, subdomain: '', domain: 'localhost', tld: '' });
    expect(splitHost('')).toEqual({ isIp: false, subdomain: '', domain: '', tld: '' });
  });
  it('limite dichiarato: github.io è trattato come un normale suffisso', () => {
    expect(splitHost('utente.github.io')).toEqual({ isIp: false, subdomain: 'utente', domain: 'github.io', tld: 'io' });
  });
});

describe('percent-encoding', () => {
  it('safeDecode non fallisce su sequenze non valide', () => {
    expect(safeDecode('a%20b')).toBe('a b');
    expect(safeDecode('100%')).toBe('100%');
    expect(safeDecode('%E0%A4%A')).toBe('%E0%A4%A');
    expect(safeDecode('ok%20%E0%A4%A%20x')).toBe('ok %E0%A4%A x');
    expect(safeDecode('%C3%A8')).toBe('è');
  });
  it('encodeQueryPart lascia leggibili alcuni caratteri', () => {
    expect(encodeQueryPart('a b&c=d')).toBe('a%20b%26c%3Dd');
    expect(encodeQueryPart('a,b:c@d/e$f')).toBe('a,b:c@d/e$f');
    expect(encodeQueryPart('è')).toBe('%C3%A8');
    expect(encodeQueryPart('#?+')).toBe('%23%3F%2B');
  });
});

describe('parseQuery / buildQuery', () => {
  it('più valori con la stessa chiave, chiave senza valore, + come spazio', () => {
    const p = parseQuery('?tag=a&tag=b&flag&q=uno+due&e=');
    expect(p.map((x) => [x.key, x.value])).toEqual([
      ['tag', 'a'],
      ['tag', 'b'],
      ['flag', ''],
      ['q', 'uno due'],
      ['e', ''],
    ]);
  });
  it('il valore può contenere = e la codifica originale si conserva', () => {
    const p = parseQuery('?a=b=c&q=uno+due&s=%C3%A8');
    expect(p[0].value).toBe('b=c');
    expect(buildQuery(p)).toBe('a=b=c&q=uno+due&s=%C3%A8');
  });
  it('le righe modificate si ricodificano', () => {
    let p = parseQuery('?a=1&q=uno+due');
    p = updateParam(p, 1, { value: 'tre quattro&' });
    expect(buildQuery(p)).toBe('a=1&q=tre%20quattro%26');
    p = updateParam(p, 0, { key: 'è' });
    expect(buildQuery(p)).toBe('%C3%A8=1&q=tre%20quattro%26');
  });
  it('righe vuote ignorate, chiave senza valore dopo la modifica', () => {
    expect(buildQuery([newParam(), newParam('k')])).toBe('k=');
    expect(buildQuery([])).toBe('');
  });
  it('query vuota o solo ?', () => {
    expect(parseQuery('')).toEqual([]);
    expect(parseQuery('?')).toEqual([]);
    expect(parseQuery('?&&a=1&')).toHaveLength(1);
  });
  it('sequenze % non valide non rompono nulla', () => {
    const p = parseQuery('?a=100%&b=%zz');
    expect(p.map((x) => x.value)).toEqual(['100%', '%zz']);
    expect(buildQuery(p)).toBe('a=100%&b=%zz');
  });
});

describe('parametri di tracciamento', () => {
  it('riconosce i più comuni, senza distinguere maiuscole', () => {
    for (const k of ['utm_source', 'UTM_Medium', 'utm_campaign', 'fbclid', 'gclid', 'msclkid', 'mc_cid', '_ga', 'igshid', 'pk_campaign', 'hsa_acc', 'srsltid']) expect(isTrackingParam(k), k).toBe(true);
    for (const k of ['q', 'page', 'id', 'utm', 'source', 'ref', 'sort']) expect(isTrackingParam(k), k).toBe(false);
  });
  it('removeTracking toglie solo quelli', () => {
    const p = parseQuery('?id=7&utm_source=nl&fbclid=abc&page=2&gclid=x');
    expect(removeTracking(p).map((x) => x.key)).toEqual(['id', 'page']);
  });
});

describe('rebuildUrl e modifica della tabella', () => {
  it('senza modifiche ripete la stessa query e lo stesso frammento', () => {
    const u = parse('https://example.com/p?b=2&a=1%2C2#top');
    expect(rebuildUrl(u, u.params)).toBe('https://example.com/p?b=2&a=1%2C2#top');
  });
  it('aggiunta, rimozione, riordino', () => {
    const u = parse('https://example.com/p?a=1&b=2#x');
    let p = [...u.params, newParam('c', 'tre quattro')];
    expect(rebuildUrl(u, p)).toBe('https://example.com/p?a=1&b=2&c=tre%20quattro#x');
    p = moveParam(p, 2, -1);
    expect(p.map((x) => x.key)).toEqual(['a', 'c', 'b']);
    p = moveParam(p, 0, -1);
    expect(p.map((x) => x.key)).toEqual(['a', 'c', 'b']);
    p = moveParam(p, 2, 1);
    expect(p.map((x) => x.key)).toEqual(['a', 'c', 'b']);
    p = p.filter((x) => x.key !== 'a');
    expect(rebuildUrl(u, p)).toBe('https://example.com/p?c=tre%20quattro&b=2#x');
  });
  it('senza parametri non resta il ?', () => {
    const u = parse('https://example.com/p?a=1');
    expect(rebuildUrl(u, [])).toBe('https://example.com/p');
  });
  it('rimuovi tracciamento in un URL reale', () => {
    const u = parse('https://shop.example.com/prodotto/42?utm_source=newsletter&utm_medium=email&colore=rosso&fbclid=IwAR0#recensioni');
    expect(rebuildUrl(u, removeTracking(u.params))).toBe('https://shop.example.com/prodotto/42?colore=rosso#recensioni');
  });
  it('moveParam non cambia l\'originale', () => {
    const p = parseQuery('?a=1&b=2');
    moveParam(p, 0, 1);
    expect(p.map((x) => x.key)).toEqual(['a', 'b']);
  });
});
