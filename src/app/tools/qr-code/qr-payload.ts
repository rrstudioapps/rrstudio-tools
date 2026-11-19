// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Costruzione del testo da codificare per ogni tipo di QR (WiFi, vCard, mailto, SMS, geo). */

export type QrType = 'text' | 'url' | 'wifi' | 'contact' | 'email' | 'sms' | 'geo';
export const QR_TYPES: readonly QrType[] = ['text', 'url', 'wifi', 'contact', 'email', 'sms', 'geo'];

export type WifiSecurity = 'WPA' | 'WEP' | 'nopass';

export interface QrFields {
  text: string;
  url: string;
  wifiSsid: string;
  wifiPassword: string;
  wifiSecurity: WifiSecurity;
  wifiHidden: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  contactEmail: string;
  company: string;
  website: string;
  emailTo: string;
  emailSubject: string;
  emailBody: string;
  smsNumber: string;
  smsBody: string;
  geoLat: string;
  geoLon: string;
}

export const EMPTY_FIELDS: QrFields = {
  text: '',
  url: '',
  wifiSsid: '',
  wifiPassword: '',
  wifiSecurity: 'WPA',
  wifiHidden: false,
  firstName: '',
  lastName: '',
  phone: '',
  contactEmail: '',
  company: '',
  website: '',
  emailTo: '',
  emailSubject: '',
  emailBody: '',
  smsNumber: '',
  smsBody: '',
  geoLat: '',
  geoLon: '',
};

/** Escape dei valori WiFi (formato "WIFI:"): backslash, punto e virgola, virgola, due punti e virgolette. */
export function escapeWifi(value: string): string {
  return value.replace(/[\\;,:"]/g, (c) => '\\' + c);
}

/** Escape dei valori di testo vCard 3.0: backslash, punto e virgola, virgola e a capo. */
export function escapeVCard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

/** Se manca lo schema aggiunge https:// (un indirizzo come "example.com/x" diventa un link cliccabile). */
export function normalizeUrl(input: string): string {
  const v = input.trim();
  if (!v) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(v) && !/^[a-z0-9.-]+:\d+(\/|$)/i.test(v) ? v : `https://${v}`;
}

/** Numero di telefono per tel:/sms: senza spazi, trattini e parentesi (resta il + iniziale). */
export function cleanPhone(input: string): string {
  const v = input.trim();
  return (v.startsWith('+') ? '+' : '') + v.replace(/\D/g, '');
}

export function wifiPayload(f: Pick<QrFields, 'wifiSsid' | 'wifiPassword' | 'wifiSecurity' | 'wifiHidden'>): string {
  if (!f.wifiSsid) return '';
  let s = `WIFI:T:${f.wifiSecurity};S:${escapeWifi(f.wifiSsid)};`;
  if (f.wifiSecurity !== 'nopass' && f.wifiPassword) s += `P:${escapeWifi(f.wifiPassword)};`;
  if (f.wifiHidden) s += 'H:true;';
  return s + ';';
}

export function vcardPayload(f: Pick<QrFields, 'firstName' | 'lastName' | 'phone' | 'contactEmail' | 'company' | 'website'>): string {
  const first = f.firstName.trim();
  const last = f.lastName.trim();
  const phone = cleanPhone(f.phone);
  const email = f.contactEmail.trim();
  const company = f.company.trim();
  const site = f.website.trim();
  if (!first && !last && !phone && !email && !company && !site) return '';
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  const full = [first, last].filter(Boolean).join(' ') || company || email || phone || site;
  lines.push(`N:${escapeVCard(last)};${escapeVCard(first)};;;`);
  lines.push(`FN:${escapeVCard(full)}`);
  if (company) lines.push(`ORG:${escapeVCard(company)}`);
  if (phone) lines.push(`TEL;TYPE=CELL:${phone}`);
  if (email) lines.push(`EMAIL:${escapeVCard(email)}`);
  if (site) lines.push(`URL:${site}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export function mailtoPayload(f: Pick<QrFields, 'emailTo' | 'emailSubject' | 'emailBody'>): string {
  const to = f.emailTo.trim();
  if (!to) return '';
  const params: string[] = [];
  if (f.emailSubject) params.push(`subject=${encodeURIComponent(f.emailSubject)}`);
  if (f.emailBody) params.push(`body=${encodeURIComponent(f.emailBody)}`);
  return `mailto:${to}${params.length ? '?' + params.join('&') : ''}`;
}

export function smsPayload(f: Pick<QrFields, 'smsNumber' | 'smsBody'>): string {
  const n = cleanPhone(f.smsNumber);
  if (!n) return '';
  return `sms:${n}${f.smsBody ? '?body=' + encodeURIComponent(f.smsBody) : ''}`;
}

/** Coordinate decimali con punto o virgola; null se fuori dai limiti (lat ±90, lon ±180). */
export function parseCoordinate(input: string, limit: number): number | null {
  const v = input.trim().replace(',', '.');
  if (!/^[+-]?\d+(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  return Math.abs(n) <= limit ? n : null;
}

export function geoPayload(f: Pick<QrFields, 'geoLat' | 'geoLon'>): string {
  const lat = parseCoordinate(f.geoLat, 90);
  const lon = parseCoordinate(f.geoLon, 180);
  if (lat === null || lon === null) return '';
  return `geo:${lat},${lon}`;
}

/** Testo da codificare per il tipo scelto ('' = dati mancanti o non validi). */
export function buildPayload(type: QrType, f: QrFields): string {
  switch (type) {
    case 'text': return f.text;
    case 'url': return normalizeUrl(f.url);
    case 'wifi': return wifiPayload(f);
    case 'contact': return vcardPayload(f);
    case 'email': return mailtoPayload(f);
    case 'sms': return smsPayload(f);
    case 'geo': return geoPayload(f);
  }
}
