// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { analyzeUrl, classify, parseVCard, parseWifi } from './qr-content';

describe('analyzeUrl', () => {
  it('un indirizzo https normale non ha avvisi', () => {
    const u = analyzeUrl('https://example.com/percorso?x=1')!;
    expect(u).toMatchObject({ scheme: 'https', host: 'example.com', openable: true, warnings: [] });
  });
  it('segnala http, IP, porta, link accorciati, punycode e credenziali', () => {
    expect(analyzeUrl('http://example.com')!.warnings).toEqual(['http']);
    expect(analyzeUrl('https://192.168.1.10/login')!.warnings).toContain('ip');
    expect(analyzeUrl('https://example.com:8443/')!.warnings).toContain('port');
    expect(analyzeUrl('https://bit.ly/abc')!.warnings).toContain('shortener');
    expect(analyzeUrl('https://www.bit.ly/abc')!.warnings).toContain('shortener');
    expect(analyzeUrl('https://xn--pypal-4ve.com/')!.warnings).toContain('punycode');
    const cred = analyzeUrl('https://paypal.com@evil.example/')!;
    expect(cred.warnings).toContain('userinfo');
    expect(cred.host).toBe('evil.example');
  });
  it('gli schemi diversi da http/https non si aprono mai', () => {
    for (const s of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'ftp://example.com/x', 'intent://scan/#Intent;end']) {
      const u = analyzeUrl(s)!;
      expect(u.openable, s).toBe(false);
      expect(u.warnings, s).toContain('unsafeScheme');
    }
  });
  it('non URL', () => {
    expect(analyzeUrl('ciao mondo')).toBeNull();
    expect(analyzeUrl('')).toBeNull();
    expect(analyzeUrl('www.example.com')).toBeNull();
  });
});

describe('parseWifi', () => {
  it('legge rete, password e sicurezza', () => {
    expect(parseWifi('WIFI:T:WPA;S:CasaMia;P:segreta123;;')).toEqual({ ssid: 'CasaMia', password: 'segreta123', security: 'WPA', hidden: false });
  });
  it('gestisce i caratteri con barra rovesciata e la rete nascosta', () => {
    expect(parseWifi('WIFI:S:a\\;b\\:c;T:WPA;P:p\\\\w\\"d;H:true;;')).toEqual({ ssid: 'a;b:c', password: 'p\\w"d', security: 'WPA', hidden: true });
  });
  it('rete aperta, campi in altro ordine e minuscole', () => {
    expect(parseWifi('wifi:S:Ospiti;T:nopass;;')).toMatchObject({ ssid: 'Ospiti', security: 'nopass', password: '' });
    expect(parseWifi('WIFI:P:x;S:Rete;;')).toMatchObject({ ssid: 'Rete', password: 'x' });
  });
  it('senza SSID non è una rete', () => {
    expect(parseWifi('WIFI:T:WPA;P:x;;')).toBeNull();
    expect(parseWifi('altro')).toBeNull();
  });
});

describe('parseVCard', () => {
  const card = 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Rossi;Mario;;;\r\nFN:Mario Rossi\r\nORG:Esempio S.r.l.\r\nTITLE:Responsabile\r\nTEL;TYPE=CELL:+39 333 1234567\r\nTEL;TYPE=WORK:+39 06 123456\r\nEMAIL:mario@example.com\r\nURL:https://example.com\r\nADR:;;Via Roma 1;Milano;;20100;Italia\r\nNOTE:Ciao\\, a presto\r\nEND:VCARD';
  it('estrae i campi principali', () => {
    expect(parseVCard(card)).toEqual({
      name: 'Mario Rossi',
      org: 'Esempio S.r.l.',
      title: 'Responsabile',
      phones: ['+39 333 1234567', '+39 06 123456'],
      emails: ['mario@example.com'],
      urls: ['https://example.com'],
      address: 'Via Roma 1, Milano, 20100, Italia',
      note: 'Ciao, a presto',
    });
  });
  it('senza FN usa N; riga ripiegata riunita', () => {
    const v = parseVCard('BEGIN:VCARD\nN:Bianchi;Anna;;;\nNOTE:una riga\n  lunga\nEND:VCARD')!;
    expect(v.name).toBe('Anna Bianchi');
    expect(v.note).toBe('una riga lunga');
  });
  it('non è una vCard', () => {
    expect(parseVCard('FN:Mario')).toBeNull();
  });
});

describe('classify', () => {
  it('riconosce i tipi', () => {
    expect(classify('https://example.com').kind).toBe('url');
    expect(classify('  https://example.com\n').kind).toBe('url');
    expect(classify('WIFI:T:WPA;S:x;P:y;;').kind).toBe('wifi');
    expect(classify('BEGIN:VCARD\nFN:A\nEND:VCARD').kind).toBe('vcard');
    expect(classify('tel:+390612345').kind).toBe('phone');
    expect(classify('geo:45.4642,9.19').kind).toBe('geo');
    expect(classify('otpauth://totp/Acme:luca?secret=ABC&issuer=Acme')).toMatchObject({ kind: 'otp', issuer: 'Acme', label: 'Acme:luca' });
    expect(classify('BEGIN:VEVENT\nSUMMARY:Cena\nDTSTART:20261120T200000Z\nLOCATION:Roma\nEND:VEVENT')).toMatchObject({ kind: 'event', summary: 'Cena', location: 'Roma' });
  });
  it('email e SMS', () => {
    expect(classify('mailto:a@example.com?subject=Ciao%20a%20te&body=Testo')).toMatchObject({ kind: 'email', to: 'a@example.com', subject: 'Ciao a te', body: 'Testo' });
    expect(classify('MATMSG:TO:b@example.com;SUB:Oggetto;BODY:Corpo;;')).toMatchObject({ kind: 'email', to: 'b@example.com', subject: 'Oggetto' });
    expect(classify('SMSTO:+39333111222:Ciao')).toMatchObject({ kind: 'sms', number: '+39333111222', body: 'Ciao' });
    expect(classify('sms:+39333111222?body=Salve')).toMatchObject({ kind: 'sms', body: 'Salve' });
  });
  it('testo semplice, anche se contiene un indirizzo in mezzo', () => {
    expect(classify('Ciao mondo').kind).toBe('text');
    expect(classify('vai su https://example.com adesso').kind).toBe('text');
    expect(classify('').kind).toBe('text');
  });
  it('javascript: resta un URL non apribile, mai trattato come testo cliccabile', () => {
    const c = classify('javascript:alert(1)');
    expect(c.kind).toBe('url');
    if (c.kind === 'url') expect(c.url.openable).toBe(false);
  });
  it('conserva il testo originale', () => {
    expect(classify(' x ').raw).toBe(' x ');
  });
});
