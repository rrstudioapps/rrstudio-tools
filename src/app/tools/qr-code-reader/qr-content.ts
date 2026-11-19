// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Riconoscimento del contenuto di un QR letto (URL, Wi-Fi, vCard, contatti, testo). Logica pura: nessun contenuto viene mai aperto da solo. */

export type ContentKind = 'url' | 'wifi' | 'vcard' | 'email' | 'phone' | 'sms' | 'geo' | 'otp' | 'event' | 'text';

export interface UrlInfo {
  href: string;
  scheme: string;
  host: string;
  /** Solo http e https si possono aprire dalla pagina. */
  openable: boolean;
  /** Motivi per cui l'indirizzo merita attenzione (chiavi: userinfo, punycode, ip, http, shortener, port, unsafeScheme). */
  warnings: UrlWarning[];
}
export type UrlWarning = 'userinfo' | 'punycode' | 'ip' | 'http' | 'shortener' | 'port' | 'unsafeScheme' | 'nonAscii';

export interface WifiInfo {
  ssid: string;
  password: string;
  /** WPA, WEP, nopass o il valore trovato. */
  security: string;
  hidden: boolean;
}

export interface VCardInfo {
  name: string;
  org: string;
  title: string;
  phones: string[];
  emails: string[];
  urls: string[];
  address: string;
  note: string;
}

export type Content =
  | { kind: 'url'; raw: string; url: UrlInfo }
  | { kind: 'wifi'; raw: string; wifi: WifiInfo }
  | { kind: 'vcard'; raw: string; vcard: VCardInfo }
  | { kind: 'email'; raw: string; to: string; subject: string; body: string }
  | { kind: 'phone'; raw: string; number: string }
  | { kind: 'sms'; raw: string; number: string; body: string }
  | { kind: 'geo'; raw: string; lat: string; lon: string }
  | { kind: 'otp'; raw: string; label: string; issuer: string }
  | { kind: 'event'; raw: string; summary: string; start: string; end: string; location: string }
  | { kind: 'text'; raw: string };

const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'shorturl.at', 'tiny.cc', 'rb.gy', 't.ly', 'lnkd.in', 'qr.io', 'qrco.de', 'v.gd',
]);

function isIpHost(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
}

/** Analizza un indirizzo e ne elenca i segnali sospetti. Restituisce null se non è un URL assoluto. */
export function analyzeUrl(text: string): UrlInfo | null {
  const raw = text.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const scheme = u.protocol.replace(/:$/, '').toLowerCase();
  const warnings: UrlWarning[] = [];
  const web = scheme === 'http' || scheme === 'https';
  if (!web) warnings.push('unsafeScheme');
  if (web) {
    if (scheme === 'http') warnings.push('http');
    if (u.username || u.password) warnings.push('userinfo');
    const host = u.hostname.toLowerCase();
    if (host.split('.').some((l) => l.startsWith('xn--'))) warnings.push('punycode');
    if (isIpHost(host)) warnings.push('ip');
    if (SHORTENERS.has(host.replace(/^www\./, ''))) warnings.push('shortener');
    if (u.port) warnings.push('port');
    if (/[^\x00-\x7f]/.test(raw.split(/[/?#]/)[2] ?? '')) warnings.push('nonAscii');
  }
  return { href: u.href, scheme, host: u.hostname, openable: web, warnings };
}

// ---- Wi-Fi: WIFI:T:WPA;S:rete;P:password;H:true;; (con \ davanti a ; , : \ ") ----

function splitEscaped(body: string): string[] {
  const parts: string[] = [];
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\' && i + 1 < body.length) {
      cur += ch + body[i + 1];
      i++;
    } else if (ch === ';') {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}
const unescapeWifi = (s: string): string => s.replace(/\\([\\;,:"])/g, '$1');

export function parseWifi(text: string): WifiInfo | null {
  const m = /^WIFI:(.*)$/is.exec(text.trim());
  if (!m) return null;
  const info: WifiInfo = { ssid: '', password: '', security: 'nopass', hidden: false };
  let found = false;
  for (const part of splitEscaped(m[1])) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const key = part.slice(0, i).toUpperCase();
    const value = unescapeWifi(part.slice(i + 1));
    if (key === 'S') {
      info.ssid = value;
      found = true;
    } else if (key === 'P') info.password = value;
    else if (key === 'T') info.security = value || 'nopass';
    else if (key === 'H') info.hidden = value.toLowerCase() === 'true';
  }
  return found ? info : null;
}

// ---- vCard ----

function unfold(text: string): string[] {
  return text.replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}
const unescapeVcard = (s: string): string => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

export function parseVCard(text: string): VCardInfo | null {
  if (!/^\s*BEGIN:VCARD/i.test(text)) return null;
  const v: VCardInfo = { name: '', org: '', title: '', phones: [], emails: [], urls: [], address: '', note: '' };
  let structured = '';
  for (const line of unfold(text)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const prop = line.slice(0, i).split(';')[0].toUpperCase().replace(/^ITEM\d+\./, '');
    const value = line.slice(i + 1).trim();
    if (!value) continue;
    switch (prop) {
      case 'FN':
        v.name = unescapeVcard(value);
        break;
      case 'N':
        structured = value.split(';').map((p) => unescapeVcard(p)).filter(Boolean).reverse().join(' ');
        break;
      case 'ORG':
        v.org = value.split(';').map(unescapeVcard).filter(Boolean).join(', ');
        break;
      case 'TITLE':
        v.title = unescapeVcard(value);
        break;
      case 'TEL':
        v.phones.push(value);
        break;
      case 'EMAIL':
        v.emails.push(value);
        break;
      case 'URL':
        v.urls.push(value);
        break;
      case 'ADR':
        v.address = value.split(';').map(unescapeVcard).filter(Boolean).join(', ');
        break;
      case 'NOTE':
        v.note = unescapeVcard(value);
        break;
    }
  }
  if (!v.name) v.name = structured;
  return v;
}

// ---- riconoscimento generale ----

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

function icalValue(text: string, prop: string): string {
  const m = new RegExp(`^${prop}(?:;[^:\\n]*)?:(.*)$`, 'im').exec(text);
  return m ? m[1].trim() : '';
}

export function classify(rawText: string): Content {
  const raw = rawText;
  const text = rawText.trim();
  const wifi = parseWifi(text);
  if (wifi) return { kind: 'wifi', raw, wifi };
  const vcard = parseVCard(text);
  if (vcard) return { kind: 'vcard', raw, vcard };
  if (/^BEGIN:VEVENT/i.test(text) || /^BEGIN:VCALENDAR/i.test(text)) {
    return { kind: 'event', raw, summary: icalValue(text, 'SUMMARY'), start: icalValue(text, 'DTSTART'), end: icalValue(text, 'DTEND'), location: icalValue(text, 'LOCATION') };
  }
  const mailto = /^mailto:([^?]*)(?:\?(.*))?$/i.exec(text);
  if (mailto) {
    const q = new URLSearchParams(mailto[2] ?? '');
    return { kind: 'email', raw, to: safeDecode(mailto[1]), subject: q.get('subject') ?? '', body: q.get('body') ?? '' };
  }
  const matmsg = /^MATMSG:(.*);;$/is.exec(text);
  if (matmsg) {
    const f = (k: string) => new RegExp(`(?:^|;)${k}:([^;]*)`, 'i').exec(matmsg[1])?.[1] ?? '';
    return { kind: 'email', raw, to: f('TO'), subject: f('SUB'), body: f('BODY') };
  }
  const tel = /^tel:(.+)$/i.exec(text);
  if (tel) return { kind: 'phone', raw, number: safeDecode(tel[1]) };
  const sms = /^sms(?:to)?:([^:?]*)(?::(.*)|\?body=(.*))?$/is.exec(text);
  if (sms) return { kind: 'sms', raw, number: sms[1], body: safeDecode(sms[2] ?? sms[3] ?? '') };
  const geo = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i.exec(text);
  if (geo) return { kind: 'geo', raw, lat: geo[1], lon: geo[2] };
  if (/^otpauth:\/\//i.test(text)) {
    let label = '';
    let issuer = '';
    try {
      const u = new URL(text);
      label = decodeURIComponent(u.pathname.replace(/^\//, ''));
      issuer = u.searchParams.get('issuer') ?? '';
    } catch {
      /* resta il testo */
    }
    return { kind: 'otp', raw, label, issuer };
  }
  if (!/\s/.test(text)) {
    const url = analyzeUrl(text);
    if (url && url.scheme.length > 1) return { kind: 'url', raw, url };
  }
  return { kind: 'text', raw };
}
