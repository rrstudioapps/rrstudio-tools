// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Scomposizione di un URL con l'API `URL` del browser. Logica pura, senza DOM e senza Angular.
 * Il dominio principale si ricava con un'euristica semplice (nessuna Public Suffix List): vedi `splitHost`.
 */

export interface QueryParam {
  /** Identificatore stabile per la tabella. */
  id: number;
  key: string;
  value: string;
  /** Coppia originale (`a=b%20c`), conservata finché non si modifica la riga: così non si riscrive la codifica. */
  raw: string | null;
}

export interface HostParts {
  isIp: boolean;
  subdomain: string;
  /** Dominio senza sottodominio (es. `example.co.uk`). */
  domain: string;
  /** Suffisso (es. `co.uk`). */
  tld: string;
}

export interface Segment {
  raw: string;
  decoded: string;
}

export interface ParsedUrl {
  href: string;
  /** Il testo non aveva il protocollo: è stato aggiunto `https://`. */
  assumedScheme: boolean;
  protocol: string;
  username: string;
  password: string;
  /** Host come lo scrive l'URL API (punycode per i nomi internazionali). */
  hostAscii: string;
  /** Host decodificato (punycode → Unicode). */
  host: string;
  hostParts: HostParts;
  port: string;
  defaultPort: string;
  origin: string;
  pathRaw: string;
  path: string;
  segments: Segment[];
  search: string;
  params: QueryParam[];
  hashRaw: string;
  hash: string;
}

export type ParseOutcome = { ok: true; url: ParsedUrl } | { ok: false; error: 'empty' | 'invalid' };

const DEFAULT_PORTS: Record<string, string> = { http: '80', https: '443', ftp: '21', ws: '80', wss: '443' };
/** Schemi senza `//` che non vanno confusi con "host:porta". */
const OPAQUE_SCHEMES = /^(mailto|tel|sms|data|javascript|urn|blob|about|geo|magnet|file):/i;

// ---------- punycode (RFC 3492, solo decodifica) ----------

const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;

function adapt(delta: number, numPoints: number, first: boolean): number {
  delta = first ? Math.floor(delta / 700) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  let k = 0;
  while (delta > ((BASE - T_MIN) * T_MAX) >> 1) {
    delta = Math.floor(delta / (BASE - T_MIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - T_MIN + 1) * delta) / (delta + 38));
}

/** Decodifica la parte dopo `xn--` di un'etichetta; null se non è punycode valido. */
export function punycodeDecode(input: string): string | null {
  const out: number[] = [];
  const basic = input.lastIndexOf('-');
  for (let j = 0; j < Math.max(basic, 0); j++) {
    if (input.charCodeAt(j) >= 0x80) return null;
    out.push(input.charCodeAt(j));
  }
  let n = 128;
  let bias = 72;
  let i = 0;
  for (let idx = basic > 0 ? basic + 1 : 0; idx < input.length; ) {
    const oldi = i;
    for (let w = 1, k = BASE; ; k += BASE) {
      if (idx >= input.length) return null;
      const c = input.charCodeAt(idx++);
      const digit = c >= 48 && c <= 57 ? c - 22 : c >= 65 && c <= 90 ? c - 65 : c >= 97 && c <= 122 ? c - 97 : BASE;
      if (digit >= BASE) return null;
      i += digit * w;
      const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
    }
    const len = out.length + 1;
    bias = adapt(i - oldi, len, oldi === 0);
    n += Math.floor(i / len);
    i %= len;
    if (n > 0x10ffff) return null;
    out.splice(i++, 0, n);
  }
  return String.fromCodePoint(...out);
}

/** Nome di dominio in ASCII → Unicode (le etichette `xn--` non valide restano com'erano). */
export function domainToUnicode(host: string): string {
  return host
    .split('.')
    .map((l) => {
      if (!/^xn--/i.test(l)) return l;
      return punycodeDecode(l.slice(4)) ?? l;
    })
    .join('.');
}

// ---------- host ----------

/** Secondi livelli molto usati sotto i domini nazionali (es. `co.uk`, `com.au`): euristica, non è la Public Suffix List. */
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'or', 'ne', 'go', 'gob', 'nom', 'mil', 'sch', 'ltd', 'plc']);

export function isIpAddress(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
}

/**
 * Sottodominio / dominio / suffisso con una regola semplice: il suffisso è l'ultima etichetta, oppure le ultime due
 * quando l'ultima è di due lettere e la penultima è un secondo livello comune (`co.uk`). Per i casi particolari
 * (`github.io`, `blogspot.com`, domini nuovi) il risultato può essere impreciso.
 */
export function splitHost(host: string): HostParts {
  if (host === '' || isIpAddress(host)) return { isIp: host !== '', subdomain: '', domain: host, tld: '' };
  const labels = host.split('.');
  if (labels.length === 1) return { isIp: false, subdomain: '', domain: host, tld: '' };
  let tldLen = 1;
  const last = labels[labels.length - 1];
  const prev = labels[labels.length - 2];
  if (labels.length >= 3 && last.length === 2 && SECOND_LEVEL.has(prev.toLowerCase())) tldLen = 2;
  const tld = labels.slice(-tldLen).join('.');
  const domain = labels.slice(-tldLen - 1).join('.');
  const subdomain = labels.slice(0, -tldLen - 1).join('.');
  return { isIp: false, subdomain, domain, tld };
}

// ---------- decodifica e codifica ----------

/** `decodeURIComponent` che non fallisce: se la sequenza non è valida lascia il testo com'è. */
export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    // decodifica solo le sequenze valide: si prova un carattere UTF-8 (1-4 byte) alla volta
    return s.replace(/(%[0-9a-fA-F]{2})+/g, (run) => {
      const parts = run.match(/%[0-9a-fA-F]{2}/g) ?? [];
      let out = '';
      for (let i = 0; i < parts.length; ) {
        let done = false;
        for (let n = 1; n <= 4 && i + n <= parts.length && !done; n++) {
          try {
            out += decodeURIComponent(parts.slice(i, i + n).join(''));
            i += n;
            done = true;
          } catch {
            // prova con un byte in più
          }
        }
        if (!done) out += parts[i++];
      }
      return out;
    });
  }
}

/** Codifica per chiavi e valori della query: come `encodeURIComponent`, ma lascia leggibili `: @ $ , /`. */
export function encodeQueryPart(s: string): string {
  return encodeURIComponent(s).replace(/%(3A|40|24|2C|2F)/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

let nextId = 1;

/** Coppie della query (senza `?`): `+` vale spazio, la parte dopo il primo `=` è il valore. */
export function parseQuery(search: string): QueryParam[] {
  const q = search.startsWith('?') ? search.slice(1) : search;
  if (q === '') return [];
  return q
    .split('&')
    .filter((p) => p !== '')
    .map((raw) => {
      const eq = raw.indexOf('=');
      const k = eq < 0 ? raw : raw.slice(0, eq);
      const v = eq < 0 ? '' : raw.slice(eq + 1);
      return { id: nextId++, key: safeDecode(k.replace(/\+/g, ' ')), value: safeDecode(v.replace(/\+/g, ' ')), raw };
    });
}

/** Testo della query dalle righe della tabella (le righe non modificate mantengono la codifica originale). */
export function buildQuery(params: readonly QueryParam[]): string {
  return params
    .filter((p) => p.key !== '' || p.value !== '')
    .map((p) => p.raw ?? (p.value === '' && p.key !== '' ? encodeQueryPart(p.key) + '=' : encodeQueryPart(p.key) + '=' + encodeQueryPart(p.value)))
    .join('&');
}

// ---------- parametri di tracciamento ----------

const TRACKING_EXACT = new Set([
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid', 'twclid', 'ttclid', 'li_fat_id', 'igshid', 'igsh', 'mc_cid', 'mc_eid',
  '_ga', '_gl', '_hsenc', '_hsmi', '__hstc', '__hssc', '__hsfp', 'mkt_tok', 'vero_id', 'wickedid', 'oly_enc_id', 'oly_anon_id', 's_cid', 'rb_clickid',
  'cmpid', 'ref_src', 'ref_url', 'srsltid', 'epik', 'scid', 'sc_cid', 'irclickid', 'ncid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
]);
const TRACKING_PREFIX = ['utm_', 'pk_', 'mtm_', 'hsa_', 'piwik_', 'stm_', 'ga_', 'mc_'];

export function isTrackingParam(key: string): boolean {
  const k = key.trim().toLowerCase();
  return TRACKING_EXACT.has(k) || TRACKING_PREFIX.some((p) => k.startsWith(p));
}

export function removeTracking(params: readonly QueryParam[]): QueryParam[] {
  return params.filter((p) => !isTrackingParam(p.key));
}

// ---------- scomposizione ----------

/** Se manca il protocollo (`example.com/x`, `localhost:3000`, `//cdn.it/a.js`) si aggiunge https://. */
export function withScheme(text: string): { text: string; assumed: boolean } {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) || OPAQUE_SCHEMES.test(text)) return { text, assumed: false };
  if (text.startsWith('//')) return { text: 'https:' + text, assumed: true };
  return { text: 'https://' + text, assumed: true };
}

function pickDefaultPort(protocolNoColon: string): string {
  return DEFAULT_PORTS[protocolNoColon] ?? '';
}

export function parseUrl(input: string): ParseOutcome {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: false, error: 'empty' };
  const { text, assumed } = withScheme(trimmed);
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  const protocol = u.protocol.replace(/:$/, '');
  const hostAscii = u.hostname;
  const host = domainToUnicode(hostAscii);
  const pathRaw = u.pathname;
  const segments: Segment[] = pathRaw
    .split('/')
    .filter((s, i) => !(i === 0 && s === ''))
    .filter((s, i, a) => !(s === '' && i === a.length - 1))
    .map((s) => ({ raw: s, decoded: safeDecode(s) }));
  return {
    ok: true,
    url: {
      href: u.href,
      assumedScheme: assumed,
      protocol,
      username: safeDecode(u.username),
      password: safeDecode(u.password),
      hostAscii,
      host,
      hostParts: splitHost(host),
      port: u.port,
      defaultPort: pickDefaultPort(protocol),
      origin: u.origin === 'null' ? '' : u.origin,
      pathRaw,
      path: safeDecode(pathRaw),
      segments,
      search: u.search,
      params: parseQuery(u.search),
      hashRaw: u.hash,
      hash: safeDecode(u.hash.replace(/^#/, '')),
    },
  };
}

/** URL ricostruito: l'indirizzo normalizzato con la query della tabella e lo stesso frammento. */
export function rebuildUrl(parsed: Pick<ParsedUrl, 'href'>, params: readonly QueryParam[]): string {
  const u = new URL(parsed.href);
  const hash = u.hash;
  u.hash = '';
  u.search = '';
  const q = buildQuery(params);
  return u.href + (q ? '?' + q : '') + hash;
}

// ---------- modifica della tabella ----------

export function newParam(key = '', value = ''): QueryParam {
  return { id: nextId++, key, value, raw: null };
}
export function moveParam(params: readonly QueryParam[], index: number, delta: -1 | 1): QueryParam[] {
  const to = index + delta;
  if (index < 0 || to < 0 || to >= params.length) return [...params];
  const out = [...params];
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}
export function updateParam(params: readonly QueryParam[], index: number, patch: { key?: string; value?: string }): QueryParam[] {
  return params.map((p, i) => (i === index ? { ...p, ...patch, raw: null } : p));
}
