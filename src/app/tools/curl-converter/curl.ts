// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Parser di comandi curl scritto a mano (niente librerie): tokenizzazione in stile shell
 * (virgolette singole e doppie, `$'...'`, continuazioni con `\` e `^`) e interpretazione delle opzioni più usate.
 * Logica pura, senza DOM e senza Angular.
 */

import { tokenize } from '../../shared/shell-tokenize';
export { tokenize };
export type { Tokenized } from '../../shared/shell-tokenize';

export interface CurlHeader {
  name: string;
  value: string;
}
export interface FormField {
  name: string;
  value: string;
  /** Il valore è il percorso di un file (`-F nome=@file`). */
  file: boolean;
  type?: string;
}
export type CurlBody = { kind: 'raw'; data: string } | { kind: 'form'; fields: FormField[] };

/** Avviso con un codice (tradotto dall'interfaccia) e un parametro opzionale. */
export interface CurlWarning {
  code: string;
  param?: string;
}

export interface CurlRequest {
  url: string;
  method: string;
  headers: CurlHeader[];
  body: CurlBody | null;
  basicAuth: { user: string; password: string } | null;
  insecure: boolean;
  follow: boolean;
  compressed: boolean;
  warnings: CurlWarning[];
}

export type ParseError = 'empty' | 'notCurl' | 'unterminatedQuote' | 'noUrl';
export type ParseResult = { ok: true; request: CurlRequest } | { ok: false; error: ParseError };

// ---------- tokenizzazione ----------

/** Cmd di Windows: `^` fa da escape e da continuazione di riga. Si toglie prima della tokenizzazione. */
export function unescapeCmd(input: string): string {
  if (!/\^(\r?\n|")/.test(input)) return input;
  return input.replace(/\^\r?\n[ \t]*/g, '').replace(/\^([\s\S])/g, '$1');
}

// ---------- opzioni ----------

/** Opzioni brevi con argomento → nome lungo. */
const SHORT_ARG: Record<string, string> = {
  X: 'request', H: 'header', d: 'data', F: 'form', u: 'user', b: 'cookie', A: 'user-agent', e: 'referer', o: 'output', T: 'upload-file',
  m: 'max-time', x: 'proxy', w: 'write-out', c: 'cookie-jar', K: 'config', E: 'cert', Q: 'quote', y: 'speed-time', Y: 'speed-limit',
  z: 'time-cond', r: 'range', C: 'continue-at', D: 'dump-header', t: 'telnet-option', U: 'proxy-user', P: 'ftp-port',
};
/** Opzioni brevi senza argomento → nome lungo. */
const SHORT_FLAG: Record<string, string> = {
  s: 'silent', S: 'show-error', v: 'verbose', i: 'include', f: 'fail', L: 'location', k: 'insecure', G: 'get', g: 'globoff', N: 'no-buffer',
  I: 'head', O: 'remote-name', J: 'remote-header-name', q: 'disable', '4': 'ipv4', '6': 'ipv6', '#': 'progress-bar', '0': 'http1.0',
  '1': 'tlsv1', '2': 'sslv2', '3': 'sslv3', p: 'proxytunnel', B: 'use-ascii', l: 'list-only', n: 'netrc', R: 'remote-time', a: 'append', j: 'junk-session-cookies',
};

/** Opzioni lunghe con argomento che interessano al convertitore o che si ignorano segnalandolo. */
const LONG_ARG = new Set([
  'request', 'header', 'data', 'data-raw', 'data-binary', 'data-ascii', 'data-urlencode', 'json', 'form', 'form-string', 'user', 'cookie',
  'user-agent', 'referer', 'url', 'oauth2-bearer', 'output', 'upload-file', 'max-time', 'connect-timeout', 'proxy', 'write-out', 'cookie-jar',
  'config', 'cert', 'key', 'cacert', 'capath', 'retry', 'retry-delay', 'retry-max-time', 'limit-rate', 'proxy-user', 'resolve', 'interface',
  'range', 'dump-header', 'speed-time', 'speed-limit', 'time-cond', 'continue-at', 'quote', 'telnet-option', 'ftp-port', 'max-redirs',
  'connect-to', 'dns-servers', 'local-port', 'keepalive-time', 'expect100-timeout', 'cert-type', 'key-type', 'pass', 'ciphers', 'tls-max',
  'proxy-header', 'unix-socket', 'user-agent', 'etag-save', 'etag-compare', 'trace', 'trace-ascii', 'stderr', 'variable', 'aws-sigv4',
]);
/** Opzioni lunghe senza argomento che non cambiano il risultato della richiesta. */
const LONG_FLAG_SILENT = new Set([
  'silent', 'show-error', 'verbose', 'include', 'fail', 'globoff', 'no-buffer', 'disable', 'ipv4', 'ipv6', 'progress-bar', 'http1.0', 'http1.1',
  'http2', 'http2-prior-knowledge', 'http3', 'tlsv1', 'tlsv1.0', 'tlsv1.1', 'tlsv1.2', 'tlsv1.3', 'sslv2', 'sslv3', 'remote-name', 'remote-header-name',
  'no-keepalive', 'path-as-is', 'fail-with-body', 'basic', 'tcp-nodelay', 'tr-encoding', 'proxytunnel', 'use-ascii', 'list-only', 'netrc', 'remote-time',
  'append', 'junk-session-cookies', 'fail-early', 'styled-output', 'no-progress-meter', 'show-headers', 'ssl-no-revoke', 'http0.9', 'negotiate-off',
]);
/** Opzioni con effetto reale non traducibile: si ignorano ma si avvisa. */
const IGNORED_WITH_EFFECT = new Set([
  'output', 'upload-file', 'max-time', 'connect-timeout', 'proxy', 'write-out', 'cookie-jar', 'config', 'cert', 'key', 'cacert', 'capath',
  'retry', 'retry-delay', 'retry-max-time', 'limit-rate', 'proxy-user', 'resolve', 'interface', 'range', 'dump-header', 'max-redirs', 'connect-to',
  'unix-socket', 'proxytunnel', 'netrc', 'cert-type', 'key-type', 'pass', 'ciphers', 'proxy-header', 'aws-sigv4', 'quote',
]);
const AUTH_TYPES = new Set(['digest', 'ntlm', 'negotiate', 'anyauth']);

function b64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
/** Codifica percent di `--data-urlencode` (tutto tranne i caratteri non riservati). */
function urlencodeValue(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function hasHeader(headers: CurlHeader[], name: string): boolean {
  return headers.some((h) => h.name.toLowerCase() === name.toLowerCase());
}

/** Valore di `-F`: `nome=testo`, `nome=@file[;type=…]`, `nome=<file`. */
function parseFormField(spec: string, forceText: boolean, warnings: CurlWarning[]): FormField | null {
  const eq = spec.indexOf('=');
  if (eq < 0) return null;
  const name = spec.slice(0, eq);
  let value = spec.slice(eq + 1);
  if (forceText) return { name, value, file: false };
  let file = false;
  let type: string | undefined;
  if (value.startsWith('@') || value.startsWith('<')) {
    if (value.startsWith('<')) warnings.push({ code: 'formFileText', param: value.slice(1) });
    file = true;
    value = value.slice(1);
  } else if (value.startsWith('"') && value.indexOf('"', 1) > 0) {
    // nome="testo con ; dentro"
    const end = value.indexOf('"', 1);
    const rest = value.slice(end + 1);
    value = value.slice(1, end);
    const t = /;type=([^;]+)/.exec(rest);
    return { name, value, file: false, type: t?.[1] };
  }
  const t = /;type=([^;]+)/.exec(value);
  if (t) {
    type = t[1];
    value = value.replace(/;type=[^;]+/, '');
  }
  value = value.replace(/;filename=.*$/, '');
  return { name, value, file, type };
}

/** Interpreta un comando curl. */
export function parseCurl(input: string): ParseResult {
  const text = unescapeCmd(input.trim());
  if (text === '') return { ok: false, error: 'empty' };
  const tk = tokenize(text);
  if (tk.unterminated) return { ok: false, error: 'unterminatedQuote' };
  const tokens = tk.tokens;
  // un eventuale prompt ("$ curl …") e il comando stesso
  if (tokens[0] === '$' || tokens[0] === '>' || tokens[0] === '%') tokens.shift();
  if (tokens.length === 0) return { ok: false, error: 'empty' };
  if (!/^curl(\.exe)?$/i.test(tokens[0].replace(/^.*[\\/]/, ''))) return { ok: false, error: 'notCurl' };
  tokens.shift();

  const warnings: CurlWarning[] = [];
  if (tk.stoppedAt) warnings.push({ code: 'shellTail', param: tk.stoppedAt });
  const warned = new Set<string>();
  const warnOnce = (code: string, param: string) => {
    if (!warned.has(code + param)) {
      warned.add(code + param);
      warnings.push({ code, param });
    }
  };

  let url = '';
  const extra: string[] = [];
  let explicitMethod = '';
  let head = false;
  let get = false;
  let follow = false;
  let insecure = false;
  let compressed = false;
  let upload = false;
  const headers: CurlHeader[] = [];
  const dataParts: string[] = [];
  let jsonParts: string[] | null = null;
  const formFields: FormField[] = [];
  let auth: { user: string; password: string } | null = null;

  const addHeader = (raw: string) => {
    const colon = raw.indexOf(':');
    const semi = raw.indexOf(';');
    if (colon < 0 && !(semi >= 0 && semi === raw.length - 1)) {
      warnOnce('badHeader', raw);
      return;
    }
    if (colon < 0) {
      headers.push({ name: raw.slice(0, semi).trim(), value: '' }); // "Nome;" = intestazione vuota
      return;
    }
    const name = raw.slice(0, colon).trim();
    const value = raw.slice(colon + 1).trim();
    if (name === '') return;
    if (value === '') {
      // "Nome:" toglie l'intestazione predefinita/precedente
      for (let k = headers.length - 1; k >= 0; k--) if (headers[k].name.toLowerCase() === name.toLowerCase()) headers.splice(k, 1);
      return;
    }
    headers.push({ name, value });
  };
  const addData = (value: string, kind: string) => {
    if (kind !== 'data-raw' && value.startsWith('@')) warnOnce('dataFile', value);
    dataParts.push(value);
  };
  const addUrlencoded = (spec: string) => {
    const eq = spec.indexOf('=');
    const at = spec.indexOf('@');
    if (eq < 0 && at > 0) {
      warnOnce('dataFile', spec.slice(at));
      dataParts.push(spec);
    } else if (eq < 0) dataParts.push(urlencodeValue(spec));
    else dataParts.push(eq === 0 ? urlencodeValue(spec.slice(1)) : spec.slice(0, eq) + '=' + urlencodeValue(spec.slice(eq + 1)));
  };

  const apply = (opt: string, val: string | null, shown: string) => {
    switch (opt) {
      case 'request':
        explicitMethod = val ?? '';
        break;
      case 'header':
        addHeader(val ?? '');
        break;
      case 'data':
      case 'data-raw':
      case 'data-binary':
      case 'data-ascii':
        addData(val ?? '', opt);
        break;
      case 'data-urlencode':
        addUrlencoded(val ?? '');
        break;
      case 'json':
        (jsonParts ??= []).push(val ?? '');
        break;
      case 'form':
      case 'form-string': {
        const f = parseFormField(val ?? '', opt === 'form-string', warnings);
        if (f) formFields.push(f);
        else warnOnce('badForm', val ?? '');
        break;
      }
      case 'user': {
        const v = val ?? '';
        const c = v.indexOf(':');
        auth = c < 0 ? { user: v, password: '' } : { user: v.slice(0, c), password: v.slice(c + 1) };
        break;
      }
      case 'oauth2-bearer':
        headers.push({ name: 'Authorization', value: 'Bearer ' + (val ?? '') });
        break;
      case 'cookie':
        if ((val ?? '').includes('=')) headers.push({ name: 'Cookie', value: val ?? '' });
        else warnOnce('cookieFile', val ?? '');
        break;
      case 'user-agent':
        headers.push({ name: 'User-Agent', value: val ?? '' });
        break;
      case 'referer':
        headers.push({ name: 'Referer', value: val ?? '' });
        break;
      case 'url':
        if (url === '') url = val ?? '';
        else extra.push(val ?? '');
        break;
      case 'location':
      case 'location-trusted':
        follow = true;
        break;
      case 'insecure':
        insecure = true;
        break;
      case 'get':
        get = true;
        break;
      case 'head':
        head = true;
        break;
      case 'compressed':
        compressed = true;
        break;
      default:
        if (opt === 'upload-file') {
          upload = true;
          warnOnce('ignored', shown);
        } else if (AUTH_TYPES.has(opt)) warnOnce('authType', shown);
        else if (IGNORED_WITH_EFFECT.has(opt) || LONG_ARG.has(opt)) warnOnce('ignored', shown);
        else if (!LONG_FLAG_SILENT.has(opt)) warnOnce('unknownOption', shown);
    }
  };

  let onlyPositional = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (onlyPositional || t === '-' || !t.startsWith('-')) {
      if (url === '') url = t;
      else extra.push(t);
      continue;
    }
    if (t === '--') {
      onlyPositional = true;
      continue;
    }
    if (t.startsWith('--')) {
      let name = t.slice(2);
      let inline: string | null = null;
      const eq = name.indexOf('=');
      if (eq > 0) {
        inline = name.slice(eq + 1);
        name = name.slice(0, eq);
      }
      if (LONG_ARG.has(name)) {
        const v = inline ?? tokens[++i];
        apply(name, v ?? '', '--' + name);
      } else apply(name, null, '--' + name);
      continue;
    }
    // opzioni brevi, anche raggruppate: -sSL, -XPOST, -H'…'
    for (let k = 1; k < t.length; k++) {
      const ch = t[k];
      if (ch in SHORT_ARG) {
        const rest = t.slice(k + 1);
        const v = rest !== '' ? rest : tokens[++i];
        apply(SHORT_ARG[ch], v ?? '', '-' + ch);
        break;
      }
      if (ch in SHORT_FLAG) apply(SHORT_FLAG[ch], null, '-' + ch);
      else warnOnce('unknownOption', '-' + ch);
    }
  }

  if (url === '') return { ok: false, error: 'noUrl' };
  if (extra.length > 0) warnings.push({ code: 'extraArgs', param: extra.join(' ') });

  // corpo
  let body: CurlBody | null = null;
  if (jsonParts) {
    body = { kind: 'raw', data: (jsonParts as string[]).join('') };
    if (!hasHeader(headers, 'Content-Type')) headers.push({ name: 'Content-Type', value: 'application/json' });
    if (!hasHeader(headers, 'Accept')) headers.push({ name: 'Accept', value: 'application/json' });
    if (dataParts.length > 0) warnOnce('jsonAndData', '');
  } else if (formFields.length > 0) {
    body = { kind: 'form', fields: formFields };
    if (dataParts.length > 0) warnOnce('dataAndForm', '');
  } else if (dataParts.length > 0) {
    body = { kind: 'raw', data: dataParts.join('&') };
    if (!get && !hasHeader(headers, 'Content-Type')) headers.push({ name: 'Content-Type', value: 'application/x-www-form-urlencoded' });
  }

  // -G: i dati vanno nell'indirizzo
  if (get && body?.kind === 'raw') {
    url += (url.includes('?') ? '&' : '?') + body.data;
    body = null;
  }

  // indirizzo senza protocollo: curl usa http://
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    warnings.push({ code: 'urlScheme', param: url });
    url = 'http://' + url.replace(/^\/\//, '');
  }

  const method = explicitMethod || (body ? 'POST' : head ? 'HEAD' : upload ? 'PUT' : 'GET');

  return {
    ok: true,
    request: { url, method, headers, body, basicAuth: auth, insecure, follow, compressed, warnings },
  };
}

/** Intestazione `Authorization: Basic …` equivalente alle credenziali di `-u` (per i linguaggi che la richiedono). */
export function basicHeaderValue(a: { user: string; password: string }): string {
  return 'Basic ' + b64Utf8(a.user + ':' + a.password);
}
