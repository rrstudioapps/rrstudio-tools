// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { EMPTY_FIELDS, buildPayload, cleanPhone, escapeVCard, escapeWifi, geoPayload, mailtoPayload, normalizeUrl, parseCoordinate, smsPayload, vcardPayload, wifiPayload } from './qr-payload';

const f = (o: Partial<typeof EMPTY_FIELDS>) => ({ ...EMPTY_FIELDS, ...o });

describe('WiFi', () => {
  it('escape di \\ ; , : "', () => {
    expect(escapeWifi('a;b,c:d"e\\f')).toBe(String.raw`a\;b\,c\:d\"e\\f`);
  });
  it('WPA con password e rete nascosta', () => {
    expect(wifiPayload(f({ wifiSsid: 'Casa;Mia', wifiPassword: 'p:a"ss', wifiSecurity: 'WPA', wifiHidden: true }))).toBe(String.raw`WIFI:T:WPA;S:Casa\;Mia;P:p\:a\"ss;H:true;;`);
  });
  it('rete aperta: niente password; senza SSID niente payload', () => {
    expect(wifiPayload(f({ wifiSsid: 'Ospiti', wifiPassword: 'ignorata', wifiSecurity: 'nopass' }))).toBe('WIFI:T:nopass;S:Ospiti;;');
    expect(wifiPayload(f({}))).toBe('');
  });
  it('WEP', () => {
    expect(wifiPayload(f({ wifiSsid: 'x', wifiPassword: '12345', wifiSecurity: 'WEP' }))).toBe('WIFI:T:WEP;S:x;P:12345;;');
  });
});

describe('vCard 3.0', () => {
  it('contatto completo, righe CRLF', () => {
    const v = vcardPayload(f({ firstName: 'Anna', lastName: 'Verdi', phone: '+39 333 123 4567', contactEmail: 'anna@example.com', company: 'Verdi, Rossi & C.', website: 'https://example.com' }));
    expect(v).toBe(
      'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Verdi;Anna;;;\r\nFN:Anna Verdi\r\nORG:Verdi\\, Rossi & C.\r\nTEL;TYPE=CELL:+393331234567\r\nEMAIL:anna@example.com\r\nURL:https://example.com\r\nEND:VCARD',
    );
  });
  it('escape di ; , \\ e a capo; vuoto se non c\'è nulla', () => {
    expect(escapeVCard('a;b,c\\d\ne')).toBe(String.raw`a\;b\,c\\d\ne`);
    expect(vcardPayload(f({}))).toBe('');
  });
  it('solo azienda: FN ripiega sull\'azienda', () => {
    expect(vcardPayload(f({ company: 'Acme' }))).toContain('FN:Acme');
  });
});

describe('email, SMS, geo, URL', () => {
  it('mailto con oggetto e testo codificati', () => {
    expect(mailtoPayload(f({ emailTo: 'info@example.com', emailSubject: 'Ciao & grazie', emailBody: 'Riga 1\nè ok' }))).toBe('mailto:info@example.com?subject=Ciao%20%26%20grazie&body=Riga%201%0A%C3%A8%20ok');
    expect(mailtoPayload(f({ emailTo: 'a@b.it' }))).toBe('mailto:a@b.it');
    expect(mailtoPayload(f({}))).toBe('');
  });
  it('SMS', () => {
    expect(smsPayload(f({ smsNumber: '+39 (333) 111-2222', smsBody: 'Sì, arrivo' }))).toBe('sms:+393331112222?body=S%C3%AC%2C%20arrivo');
    expect(smsPayload(f({ smsNumber: '333' }))).toBe('sms:333');
  });
  it('geo: accetta la virgola decimale, rifiuta i valori fuori limite', () => {
    expect(geoPayload(f({ geoLat: '45,4642', geoLon: '9.19' }))).toBe('geo:45.4642,9.19');
    expect(geoPayload(f({ geoLat: '91', geoLon: '9' }))).toBe('');
    expect(geoPayload(f({ geoLat: '10', geoLon: '-181' }))).toBe('');
    expect(parseCoordinate('abc', 90)).toBeNull();
    expect(parseCoordinate('-90', 90)).toBe(-90);
  });
  it('URL: aggiunge https:// solo se manca lo schema', () => {
    expect(normalizeUrl('example.com/x')).toBe('https://example.com/x');
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
    expect(normalizeUrl('mailto:a@b.it')).toBe('mailto:a@b.it');
    expect(normalizeUrl('localhost:3000/x')).toBe('https://localhost:3000/x');
    expect(normalizeUrl('  ')).toBe('');
  });
  it('telefono ripulito e buildPayload per tipo', () => {
    expect(cleanPhone(' 06 1234-5678 ')).toBe('0612345678');
    expect(buildPayload('text', f({ text: 'ciao' }))).toBe('ciao');
    expect(buildPayload('url', f({ url: 'example.com' }))).toBe('https://example.com');
  });
});
