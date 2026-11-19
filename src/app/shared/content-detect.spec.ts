// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { ContentType, bestType, detectContent, previewText } from './content-detect';

/** Tipi rilevati (senza il `text` finale). */
const types = (s: string): ContentType[] => detectContent(s).map((d) => d.type).filter((t) => t !== 'text');

describe('rilevatori: positivi', () => {
  it('JSON (oggetto e array, anche su più righe)', () => {
    expect(bestType('{"a":1,"b":[1,2,3]}')).toBe('json');
    expect(bestType('[1, 2, {"x": null}]')).toBe('json');
    expect(bestType('{\n  "nome": "Zoe",\n  "età": 7,\n  "tag": ["a", "b"]\n}')).toBe('json');
  });

  it('JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    expect(bestType(jwt)).toBe('jwt');
    expect(bestType('Bearer ' + jwt)).toBe('jwt');
    expect(bestType('eyJhbGciOiJub25lIn0.eyJhIjoxfQ.')).toBe('jwt');
  });

  it('URL', () => {
    expect(bestType('https://example.com/a/b?x=1#frag')).toBe('url');
    expect(bestType('http://localhost:4200/')).toBe('url');
    expect(bestType('ftp://files.example.org/x.zip')).toBe('url');
  });

  it('Base64 (testo e binario)', () => {
    expect(bestType('SGVsbG8sIHdvcmxkISBRdWVzdG8gZSB1biB0ZXN0Lg==')).toBe('base64');
    expect(bestType('SGVsbG8gd29ybGQh')).toBe('base64');
    // a capo MIME a 76 colonne
    expect(bestType('SGVsbG8sIHdvcmxkISBRdWVzdG8gZSB1biB0ZXN0IGRpIGJhc2U2NCBjb24gYSBj\nYXBvIGUgcGl1IHJpZ2hlLg==')).toBe('base64');
    expect(bestType('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')).toBe('base64');
  });

  it('colore CSS', () => {
    for (const c of ['#fff', '#FF8800', '#12345678', 'rgb(255, 0, 128)', 'rgba(0,0,0,.5)', 'hsl(210 50% 40%)', 'oklch(60% 0.2 250)', 'hwb(200 10% 20%)']) {
      expect(bestType(c), c).toBe('color');
    }
  });

  it('espressione cron', () => {
    for (const c of ['*/15 9-17 * * 1-5', '0 0 * * *', '30 4 1,15 * 5', '0 0 1 JAN MON', '0 */5 * * * *', '@daily', '@hourly', '0 0 L * *', '0 0 * * 5#2']) {
      expect(bestType(c), c).toBe('cron');
    }
  });

  it('IBAN (valido, con o senza spazi)', () => {
    expect(bestType('IT60X0542811101000000123456')).toBe('iban');
    expect(bestType('IT60 X054 2811 1010 0000 0123 456')).toBe('iban');
    expect(bestType('DE89 3704 0044 0532 0130 00')).toBe('iban');
    expect(bestType('GB82WEST12345698765432')).toBe('iban');
  });

  it('codice fiscale', () => {
    expect(bestType('RSSMRA85M01H501Q')).toBe('codice-fiscale');
    expect(bestType('rssmra85m01h501q')).toBe('codice-fiscale');
  });

  it('partita IVA', () => {
    expect(bestType('IT00743110157')).toBe('partita-iva');
    expect(bestType('00743110157')).toBe('partita-iva');
  });

  it('SVG', () => {
    expect(bestType('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')).toBe('svg');
    expect(bestType('<?xml version="1.0"?>\n<svg viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>\n')).toBe('svg');
  });

  it('comando curl e docker run', () => {
    expect(bestType("curl -X POST https://api.example.com/x -H 'Content-Type: application/json' -d '{\"a\":1}'")).toBe('curl');
    expect(bestType('$ curl https://example.com')).toBe('curl');
    expect(bestType('docker run -d -p 8080:80 --name web nginx:alpine')).toBe('docker-run');
    expect(bestType('sudo docker run --rm -it ubuntu bash')).toBe('docker-run');
    expect(bestType('docker container run alpine echo ciao')).toBe('docker-run');
  });

  it('CSV e TSV', () => {
    expect(bestType('nome,età,città\nAnna,30,Roma\nLuca,25,Milano')).toBe('csv');
    expect(bestType('nome;età\nAnna;30\nLuca;25\n')).toBe('csv');
    expect(bestType('a\tb\tc\n1\t2\t3\n4\t5\t6')).toBe('csv');
    expect(bestType('id|nome\n1|"Rossi, Mario"\n2|Bianchi')).toBe('csv');
    // virgola dentro le virgolette: non è un separatore
    expect(bestType('nome,nota\nAnna,"ciao, mondo"\nLuca,ok')).toBe('csv');
  });

  it('YAML', () => {
    expect(bestType('nome: Zoe\neta: 7\ntag:\n  - a\n  - b')).toBe('yaml');
    expect(bestType('---\nserver:\n  host: localhost\n  port: 8080\n')).toBe('yaml');
    expect(bestType('services:\n  web:\n    image: nginx\n    ports:\n      - "80:80"')).toBe('yaml');
  });

  it('XML e HTML', () => {
    expect(bestType('<?xml version="1.0"?><a><b>1</b></a>')).toBe('xml');
    expect(bestType('<!DOCTYPE html><html><body><p>ciao</p></body></html>')).toBe('xml');
    expect(bestType('<root><item id="1">x</item></root>')).toBe('xml');
    expect(bestType('<div class="a"><p>testo</p></div>')).toBe('xml');
    expect(detectContent('<!doctype html><html></html>')[0].info).toBe('html');
  });

  it('SQL', () => {
    expect(bestType('SELECT id, nome FROM utenti WHERE eta > 18 ORDER BY nome;')).toBe('sql');
    expect(bestType("insert into utenti (id, nome) values (1, 'Zoe')")).toBe('sql');
    expect(bestType("UPDATE utenti SET nome = 'x' WHERE id = 1")).toBe('sql');
    expect(bestType('DELETE FROM log WHERE data < now()')).toBe('sql');
    expect(bestType('CREATE TABLE t (id int primary key, nome text)')).toBe('sql');
    expect(bestType('-- commento\nSELECT * FROM t')).toBe('sql');
    expect(bestType('WITH x AS (SELECT 1) SELECT * FROM x')).toBe('sql');
  });

  it('timestamp Unix (secondi e millisecondi)', () => {
    expect(bestType('1700000000')).toBe('unix-timestamp');
    expect(bestType('1700000000123')).toBe('unix-timestamp');
    expect(bestType('1700000000.5')).toBe('unix-timestamp');
    expect(detectContent('1700000000')[0].info).toBe('s');
    expect(detectContent('1700000000123')[0].info).toBe('ms');
  });

  it('UUID', () => {
    expect(bestType('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid');
    expect(bestType('0190A1B2-C3D4-7E5F-8A6B-7C8D9E0F1A2B')).toBe('uuid');
    expect(bestType('{550e8400-e29b-41d4-a716-446655440000}')).toBe('uuid');
    expect(bestType('00000000-0000-0000-0000-000000000000')).toBe('uuid');
  });

  it('hash esadecimale con l\'algoritmo', () => {
    const md5 = 'd41d8cd98f00b204e9800998ecf8427e';
    const sha1 = 'da39a3ee5e6b4b0d3255bfef95601890afd80709';
    const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const sha512 = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
    expect(bestType(md5)).toBe('hash');
    expect(detectContent(md5)[0].info).toBe('md5');
    expect(detectContent(sha1)[0].info).toBe('sha1');
    expect(detectContent(sha256)[0].info).toBe('sha256');
    expect(detectContent(sha512)[0].info).toBe('sha512');
    expect(bestType('sha256: ' + sha256)).toBe('hash');
  });

  it('PEM (certificato, richiesta, chiave)', () => {
    const body = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\nabcdEFGH12345678abcdEFGH12345678abcdEFGH12345678\n';
    expect(bestType(`-----BEGIN CERTIFICATE-----\n${body}-----END CERTIFICATE-----`)).toBe('pem');
    expect(detectContent(`-----BEGIN CERTIFICATE REQUEST-----\n${body}-----END CERTIFICATE REQUEST-----\n`)[0].info).toBe('CERTIFICATE REQUEST');
    expect(bestType(`-----BEGIN PRIVATE KEY-----\n${body}-----END PRIVATE KEY-----`)).toBe('pem');
  });

  it('IP e CIDR (v4 e v6)', () => {
    expect(bestType('192.168.1.0/24')).toBe('ip');
    expect(detectContent('192.168.1.0/24')[0].info).toBe('cidr');
    expect(bestType('10.0.0.1')).toBe('ip');
    expect(bestType('2001:db8::/32')).toBe('ip');
    expect(bestType('fe80::1')).toBe('ip');
    expect(bestType('::1')).toBe('ip');
    expect(bestType('2001:0db8:0000:0000:0000:ff00:0042:8329')).toBe('ip');
  });

  it('numero romano', () => {
    expect(bestType('MMXXIV')).toBe('roman');
    expect(bestType('XLII')).toBe('roman');
    expect(bestType('MCMLXXXIV')).toBe('roman');
  });

  it('codice Morse', () => {
    expect(bestType('... --- ...')).toBe('morse');
    expect(bestType('.... . .-.. .-.. --- / .-- --- .-. .-.. -..')).toBe('morse');
  });

  it('data (ISO, gg/mm/aaaa, RFC 2822)', () => {
    expect(bestType('2024-02-29')).toBe('date');
    expect(bestType('2024-03-15T10:30:00Z')).toBe('date');
    expect(bestType('2024-03-15 10:30')).toBe('date');
    expect(bestType('15/03/2024')).toBe('date');
    expect(bestType('15.03.2024')).toBe('date');
    expect(bestType('Tue, 14 Nov 2023 22:13:20 GMT')).toBe('date');
  });
});

describe('rilevatori: falsi positivi', () => {
  it('frasi e parole comuni restano testo', () => {
    for (const t of ['Ciao, come stai?', 'Il gatto dorme sul divano.', 'Prezzo: 12 euro', 'hello', 'internationalization', 'getElementsByTagName', 'password1234']) {
      expect(types(t), t).toEqual([]);
    }
  });

  it('JSON non valido o primitivo non è JSON', () => {
    expect(types('{"a":1,}')).not.toContain('json');
    expect(types('{non json}')).not.toContain('json');
    expect(types('[1, 2')).not.toContain('json');
    expect(types('123')).not.toContain('json');
    expect(types('"testo"')).not.toContain('json');
    expect(types('true')).not.toContain('json');
  });

  it('una frase con tre parti separate da punti non è un JWT', () => {
    expect(types('www.example.com')).not.toContain('jwt');
    expect(types('a.b.c')).not.toContain('jwt');
    expect(types('versione.1.2')).not.toContain('jwt');
    // tre segmenti base64 ma l'intestazione non è JSON
    expect(types('aGVsbG8.d29ybGQ.YWJj')).not.toContain('jwt');
  });

  it('URL: solo con schema e host, una frase con un indirizzo no', () => {
    expect(types('example.com')).not.toContain('url');
    expect(types('vai su https://example.com e guarda')).not.toContain('url');
    expect(types('http://')).not.toContain('url');
    expect(types('javascript:alert(1)')).not.toContain('url');
    expect(types('mailto:a@b.it')).not.toContain('url');
  });

  it('Base64: parole lunghe, numeri, hash e UUID non lo sono', () => {
    expect(types('Internationalization')).not.toContain('base64');
    expect(types('AbcdefghijklmnopqrstuvwxYZ')).not.toContain('base64');
    expect(types('123456789012345678')).not.toContain('base64');
    expect(types('d41d8cd98f00b204e9800998ecf8427e')).not.toContain('base64');
    expect(types('550e8400-e29b-41d4-a716-446655440000')).not.toContain('base64');
    expect(types('corto')).not.toContain('base64');
    expect(types('due parole qui')).not.toContain('base64');
    expect(types('SGVsbG8 gd29ybGQh')).not.toContain('base64');
  });

  it('colori: parole, hashtag senza esadecimale e funzioni non colore', () => {
    expect(types('red')).not.toContain('color');
    expect(types('#hashtag')).not.toContain('color');
    expect(types('#12')).not.toContain('color');
    expect(types('#12345')).not.toContain('color');
    expect(types('rgb(rosso)')).not.toContain('color');
    expect(types('calcola(1)')).not.toContain('color');
    expect(types('123456')).not.toContain('color');
  });

  it('cron: frasi e valori fuori intervallo non lo sono', () => {
    expect(types('questa è una frase di cinque')).not.toContain('cron');
    expect(types('61 * * * *')).not.toContain('cron');
    expect(types('* 25 * * *')).not.toContain('cron');
    expect(types('* * 32 * *')).not.toContain('cron');
    expect(types('* * * 13 *')).not.toContain('cron');
    expect(types('* * * *')).not.toContain('cron');
    expect(types('*/0 * * * *')).not.toContain('cron');
    // cinque numeri semplici: ammessi ma a bassa fiducia
    const weak = detectContent('1 2 3 4 5').find((d) => d.type === 'cron');
    expect(weak?.score ?? 0).toBeLessThan(50);
  });

  it('IBAN: checksum sbagliato o formato strano', () => {
    // una cifra cambiata ma formato italiano: proposto, con bassa fiducia
    expect(detectContent('IT61X0542811101000000123456').find((d) => d.type === 'iban')?.score ?? 0).toBeLessThan(70);
    expect(types('DE00370400440532013000')).not.toContain('iban');
    expect(types('AB12')).not.toContain('iban');
    expect(types('PRODOTTO2024ABCDEFGHI')).not.toContain('iban');
  });

  it('codice fiscale: formato giusto ma controllo sbagliato = bassa fiducia; stringhe simili no', () => {
    expect(detectContent('RSSMRA85M01H501X').find((d) => d.type === 'codice-fiscale')?.score ?? 0).toBeLessThan(70);
    expect(types('ABCDEFGHIJKLMNOP')).not.toContain('codice-fiscale');
    expect(types('RSSMRA85M01H501')).not.toContain('codice-fiscale');
  });

  it('partita IVA: undici cifre senza checksum valido non lo sono', () => {
    expect(types('00743110158')).not.toContain('partita-iva');
    expect(types('12345678901')).not.toContain('partita-iva');
    expect(types('00000000000')).not.toContain('partita-iva');
    expect(types('1234567890')).not.toContain('partita-iva');
  });

  it('SVG: un tag svg isolato o testo che lo cita no', () => {
    expect(types('<svg')).not.toContain('svg');
    expect(types('usa il tag <svg> per i disegni')).not.toContain('svg');
    expect(types('<svg viewBox="0 0 1 1">')).not.toContain('svg');
  });

  it('curl e docker: solo se sono il comando', () => {
    expect(types('curl')).not.toContain('curl');
    expect(types('il comando curl scarica pagine')).not.toContain('curl');
    expect(types('docker')).not.toContain('docker-run');
    expect(types('docker ps -a')).not.toContain('docker-run');
    expect(types('docker run')).not.toContain('docker-run');
    expect(types('docker-compose up')).not.toContain('docker-run');
  });

  it('CSV: prosa con qualche virgola e righe incoerenti no', () => {
    expect(types('Ciao, come stai?\nIo bene, grazie.')).not.toContain('csv');
    expect(types('una riga sola, con virgole')).not.toContain('csv');
    expect(types('a,b,c\n1,2\n3,4,5,6\n7')).not.toContain('csv');
    expect(types('Gentile cliente, la informiamo che il suo ordine, effettuato ieri, è stato spedito con corriere espresso.\nCordiali saluti, il team.')).not.toContain('csv');
  });

  it('JSON e XML non sono proposti come CSV o YAML', () => {
    const json = '{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}';
    expect(types(json)).toEqual(['json']);
    const xml = '<a>\n  <b>1</b>\n  <c>2</c>\n</a>';
    expect(types(xml)).toEqual(['xml']);
  });

  it('YAML: elenchi puntati, una riga con due punti e prosa no', () => {
    expect(types('- mele\n- pere\n- noci')).not.toContain('yaml');
    expect(types('Nota: ricordati il pane')).not.toContain('yaml');
    expect(types('Ciao a tutti,\nvi scrivo per dire che va bene.\nA presto')).not.toContain('yaml');
    expect(types('https://example.com')).not.toContain('yaml');
  });

  it('XML/HTML: tag non chiusi o testo con simboli no', () => {
    expect(types('<div>')).not.toContain('xml');
    expect(types('a < b e c > d')).not.toContain('xml');
    expect(types('<a>testo')).not.toContain('xml');
    expect(types('<1>x</1>')).not.toContain('xml');
  });

  it('SQL: parole sql dentro una frase no', () => {
    expect(types('Select the file to upload')).not.toContain('sql');
    expect(types('update ready')).not.toContain('sql');
    expect(types('delete')).not.toContain('sql');
    expect(types('create a new table for me')).not.toContain('sql');
    expect(types('with love, from me')).not.toContain('sql');
  });

  it('timestamp: solo 10 o 13 cifre in un intervallo di date sensato', () => {
    expect(types('12345')).not.toContain('unix-timestamp');
    expect(types('1234567890123456')).not.toContain('unix-timestamp');
    expect(types('0000000000')).not.toContain('unix-timestamp');
    expect(types('9999999999')).not.toContain('unix-timestamp');
    expect(types('123456789')).not.toContain('unix-timestamp');
  });

  it('UUID: lunghezze o versioni sbagliate no', () => {
    expect(types('550e8400-e29b-41d4-a716-44665544000')).not.toContain('uuid');
    expect(types('550e8400-e29b-91d4-a716-446655440000')).not.toContain('uuid');
    expect(types('550e8400e29b41d4a716446655440000')).not.toContain('uuid');
  });

  it('hash: lunghezza non standard, solo cifre o solo lettere no', () => {
    expect(types('d41d8cd98f00b204e9800998ecf8427')).not.toContain('hash');
    expect(types('12345678901234567890123456789012')).not.toContain('hash');
    expect(types('abcdefabcdefabcdefabcdefabcdefab')).not.toContain('hash');
    expect(types('g41d8cd98f00b204e9800998ecf8427e')).not.toContain('hash');
  });

  it('PEM: intestazione e fine devono coincidere', () => {
    expect(types('-----BEGIN CERTIFICATE-----\nabc')).not.toContain('pem');
    expect(types('-----BEGIN CERTIFICATE-----\nabc\n-----END PRIVATE KEY-----')).not.toContain('pem');
    expect(types('-----BEGIN CERTIFICATE-----')).not.toContain('pem');
  });

  it('IP: ottetti fuori intervallo, zeri iniziali, prefissi impossibili e orari no', () => {
    expect(types('256.1.1.1')).not.toContain('ip');
    expect(types('1.2.3')).not.toContain('ip');
    expect(types('1.2.3.4.5')).not.toContain('ip');
    expect(types('01.2.3.4')).not.toContain('ip');
    expect(types('10.0.0.0/33')).not.toContain('ip');
    expect(types('2001:db8::/129')).not.toContain('ip');
    expect(types('12:30:45')).not.toContain('ip');
    expect(types('1:2:3:4:5:6:7:8:9')).not.toContain('ip');
    expect(types('abc::def::1')).not.toContain('ip');
    expect(types('3.14')).not.toContain('ip');
  });

  it('numeri romani: non validi, minuscoli o lettere singole no', () => {
    expect(types('IIII')).not.toContain('roman');
    expect(types('VX')).not.toContain('roman');
    expect(types('mix')).not.toContain('roman');
    expect(types('mild')).not.toContain('roman');
    expect(types('X')).not.toContain('roman');
    expect(types('MMMM')).not.toContain('roman');
    expect(types('CIVIC')).not.toContain('roman');
    // la sigla di due lettere ha bassa fiducia
    expect(detectContent('XL').find((d) => d.type === 'roman')?.score ?? 0).toBeLessThan(60);
  });

  it('Morse: elenchi, linee e puntini di sospensione no', () => {
    expect(types('---')).not.toContain('morse');
    expect(types('- - -')).not.toContain('morse');
    expect(types('...')).not.toContain('morse');
    expect(types('. . .')).not.toContain('morse');
    expect(types('-----')).not.toContain('morse');
    expect(types('.......... ..........')).not.toContain('morse');
    expect(types('a - b')).not.toContain('morse');
  });

  it('date: giorni o mesi impossibili no', () => {
    expect(types('2024-02-30')).not.toContain('date');
    expect(types('2024-13-01')).not.toContain('date');
    expect(types('31/04/2024')).not.toContain('date');
    expect(types('2024-03-15T25:00:00Z')).not.toContain('date');
    expect(types('15/03/24')).not.toContain('date');
    expect(types('2024')).not.toContain('date');
    expect(types('12/25/2024').includes('date')).toBe(true); // mm/gg/aaaa americana: possibile ma con meno fiducia
    expect(detectContent('12/25/2024').find((d) => d.type === 'date')?.score ?? 0).toBeLessThan(80);
  });
});

describe('ordine e struttura del risultato', () => {
  it('il testo senza formato ha solo il tipo "text"', () => {
    expect(detectContent('ciao a tutti')).toEqual([{ type: 'text', score: 1 }]);
  });

  it('vuoto e spazi non danno nulla', () => {
    expect(detectContent('')).toEqual([]);
    expect(detectContent('   \n  ')).toEqual([]);
  });

  it('la lista è ordinata per punteggio e finisce sempre con "text"', () => {
    const r = detectContent('2024-03-15');
    const scores = r.map((d) => d.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(r[r.length - 1].type).toBe('text');
  });

  it('un SVG è anche XML ma il primo è SVG', () => {
    const r = types('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>');
    expect(r[0]).toBe('svg');
    expect(r).toContain('xml');
  });

  it('ignora lo spazio ai bordi e il BOM', () => {
    expect(bestType('﻿  {"a":1}\n')).toBe('json');
  });

  it('non va in errore su input enormi o strani', () => {
    expect(() => detectContent('a'.repeat(3_000_000))).not.toThrow();
    expect(() => detectContent('{'.repeat(10000))).not.toThrow();
    expect(() => detectContent('\u0000‮\uD800')).not.toThrow();
  });
});

describe('anteprima sicura', () => {
  it('limita righe e lunghezza e segnala il taglio', () => {
    const p = previewText('a\nb\nc\nd\ne\nf');
    expect(p.split('\n').length).toBeLessThanOrEqual(4);
    expect(p.endsWith('…')).toBe(true);
    expect(previewText('x'.repeat(1000)).length).toBeLessThanOrEqual(241);
    expect(previewText('breve')).toBe('breve');
  });

  it('non cambia il testo normale e non interpreta HTML (resta testo)', () => {
    expect(previewText('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>');
  });

  it('toglie i caratteri di controllo e di direzione', () => {
    const p = previewText('abc‮def\u0000g​h');
    expect(p).not.toMatch(/[‮\u0000​]/);
    expect(p).toContain('abc');
  });

  it('non mostra il corpo di una chiave privata', () => {
    const p = previewText('-----BEGIN RSA PRIVATE KEY-----\nSEGRETISSIMO\n-----END RSA PRIVATE KEY-----');
    expect(p).not.toContain('SEGRETISSIMO');
    expect(p).toContain('BEGIN RSA PRIVATE KEY');
  });
});
