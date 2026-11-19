// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Calcoli su reti IPv4 e IPv6. Logica pura, senza DOM né Angular.
 * IPv4 sta in un intero a 32 bit senza segno (number), IPv6 in un BigInt a 128 bit.
 */

// ---------- IPv4 ----------

const MAX32 = 0xffffffff;

/** Legge un indirizzo IPv4 "a.b.c.d" (quattro numeri 0-255, senza zeri iniziali ambigui). */
export function parseIpv4(s: string): number | null {
  const parts = s.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || (p.length > 1 && p[0] === '0')) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

export function formatIpv4(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

/** Maschera di rete a 32 bit per un prefisso 0-32. */
export function maskOf(prefix: number): number {
  return prefix === 0 ? 0 : (MAX32 << (32 - prefix)) >>> 0;
}

/** Prefisso di una maschera "255.255.255.0" (solo maschere contigue); null se non è valida. */
export function prefixOfMask(s: string): number | null {
  const m = parseIpv4(s);
  if (m === null) return null;
  let p = 0;
  while (p < 32 && ((m >>> (31 - p)) & 1) === 1) p++;
  return maskOf(p) === m ? p : null;
}

export interface Ipv4Input {
  ip: number;
  prefix: number;
}
export type ParseError = 'empty' | 'badAddress' | 'badPrefix' | 'badMask';

/** Riconosce "a.b.c.d/24", "a.b.c.d 255.255.255.0", "a.b.c.d/255.255.255.0" e "a.b.c.d" (= /32). */
export function parseIpv4Cidr(input: string): Ipv4Input | { error: ParseError } {
  const s = input.trim();
  if (s === '') return { error: 'empty' };
  const m = /^([^\s/]+)(?:\s*\/\s*(\S+)|\s+(\d+\.\d+\.\d+\.\d+))?$/.exec(s);
  if (!m) return { error: 'badAddress' };
  const ip = parseIpv4(m[1]);
  if (ip === null) return { error: 'badAddress' };
  const rest = m[2] ?? m[3];
  if (rest === undefined) return { ip, prefix: 32 };
  if (rest.includes('.')) {
    const p = prefixOfMask(rest);
    return p === null ? { error: 'badMask' } : { ip, prefix: p };
  }
  if (!/^\d{1,2}$/.test(rest) || Number(rest) > 32) return { error: 'badPrefix' };
  return { ip, prefix: Number(rest) };
}

export type Ipv4Kind =
  | 'unspecified'
  | 'private'
  | 'cgnat'
  | 'loopback'
  | 'linkLocal'
  | 'documentation'
  | 'benchmark'
  | 'multicast'
  | 'reserved'
  | 'broadcast'
  | 'public';

interface KindRange {
  kind: Ipv4Kind;
  base: string;
  prefix: number;
}
const KIND_RANGES: readonly KindRange[] = [
  { kind: 'broadcast', base: '255.255.255.255', prefix: 32 },
  { kind: 'unspecified', base: '0.0.0.0', prefix: 8 },
  { kind: 'private', base: '10.0.0.0', prefix: 8 },
  { kind: 'cgnat', base: '100.64.0.0', prefix: 10 },
  { kind: 'loopback', base: '127.0.0.0', prefix: 8 },
  { kind: 'linkLocal', base: '169.254.0.0', prefix: 16 },
  { kind: 'private', base: '172.16.0.0', prefix: 12 },
  { kind: 'documentation', base: '192.0.2.0', prefix: 24 },
  { kind: 'private', base: '192.168.0.0', prefix: 16 },
  { kind: 'benchmark', base: '198.18.0.0', prefix: 15 },
  { kind: 'documentation', base: '198.51.100.0', prefix: 24 },
  { kind: 'documentation', base: '203.0.113.0', prefix: 24 },
  { kind: 'multicast', base: '224.0.0.0', prefix: 4 },
  { kind: 'reserved', base: '240.0.0.0', prefix: 4 },
];

/** Tipo di un indirizzo IPv4 (RFC 1918, 6598, 3927, 5737, 2544, 1112…). */
export function ipv4Kind(ip: number): Ipv4Kind {
  for (const r of KIND_RANGES) {
    const base = parseIpv4(r.base) as number;
    if (((ip ^ base) & maskOf(r.prefix)) >>> 0 === 0) return r.kind;
  }
  return 'public';
}

/** Classe storica A-E in base ai primi bit. */
export function ipv4Class(ip: number): 'A' | 'B' | 'C' | 'D' | 'E' {
  const f = ip >>> 24;
  return f < 128 ? 'A' : f < 192 ? 'B' : f < 224 ? 'C' : f < 240 ? 'D' : 'E';
}

export interface Ipv4Info {
  ip: number;
  prefix: number;
  mask: number;
  wildcard: number;
  network: number;
  broadcast: number;
  firstHost: number;
  lastHost: number;
  /** Indirizzi totali (2^(32-prefisso)). */
  total: number;
  /** Host utilizzabili (con /31 sono 2 secondo RFC 3021, con /32 è 1). */
  hosts: number;
  kind: Ipv4Kind;
  /** Tipo anche della rete (se rete e indirizzo differiscono la rete può stare in un altro intervallo). */
  cls: 'A' | 'B' | 'C' | 'D' | 'E';
}

export function ipv4Info(ip: number, prefix: number): Ipv4Info {
  const mask = maskOf(prefix);
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  let firstHost = network + 1;
  let lastHost = broadcast - 1;
  let hosts = total - 2;
  if (prefix === 32) {
    firstHost = lastHost = network;
    hosts = 1;
  } else if (prefix === 31) {
    firstHost = network;
    lastHost = broadcast;
    hosts = 2;
  }
  return { ip, prefix, mask, wildcard: (~mask) >>> 0, network, broadcast, firstHost, lastHost, total, hosts, kind: ipv4Kind(ip), cls: ipv4Class(ip) };
}

/** I 32 bit di un indirizzo come stringa di '0' e '1'. */
export function bits32(n: number): string {
  return n.toString(2).padStart(32, '0');
}

/** Binario a gruppi di otto bit separati da punti, con il confine di rete: `{ net, host }` per ogni ottetto. */
export function binaryOctets(n: number, prefix: number): { net: string; host: string }[] {
  const b = bits32(n);
  const out: { net: string; host: string }[] = [];
  for (let o = 0; o < 4; o++) {
    const chunk = b.slice(o * 8, o * 8 + 8);
    const netBits = Math.max(0, Math.min(8, prefix - o * 8));
    out.push({ net: chunk.slice(0, netBits), host: chunk.slice(netBits) });
  }
  return out;
}

/** Vero se `ip` sta nella rete `network/prefix`. */
export function ipv4Contains(network: number, prefix: number, ip: number): boolean {
  return (((ip ^ network) & maskOf(prefix)) >>> 0) === 0;
}

// ---------- suddivisione ----------

export interface SubnetRow {
  network: number;
  prefix: number;
  firstHost: number;
  lastHost: number;
  broadcast: number;
  hosts: number;
}

function rowOf(network: number, prefix: number): SubnetRow {
  const i = ipv4Info(network, prefix);
  return { network: i.network, prefix, firstHost: i.firstHost, lastHost: i.lastHost, broadcast: i.broadcast, hosts: i.hosts };
}

/** Quante righe al massimo si elencano (il conteggio resta esatto). */
export const MAX_ROWS = 256;

export interface SplitResult {
  newPrefix: number;
  /** Numero di sottoreti ottenute (potenza di due: può superare quelle chieste). */
  count: number;
  rows: SubnetRow[];
  truncated: boolean;
}
export type SplitError = 'badCount' | 'tooMany' | 'badHosts' | 'tooBig';

/** Suddivide `network/prefix` in almeno `n` sottoreti uguali. */
export function splitByCount(network: number, prefix: number, n: number): SplitResult | { error: SplitError } {
  if (!Number.isInteger(n) || n < 1) return { error: 'badCount' };
  const extra = Math.ceil(Math.log2(n));
  if (prefix + extra > 32) return { error: 'tooMany' };
  return buildSplit(network, prefix, prefix + extra);
}

/** Suddivide in sottoreti uguali, ciascuna con almeno `hosts` host utilizzabili. */
export function splitByHosts(network: number, prefix: number, hosts: number): SplitResult | { error: SplitError } {
  if (!Number.isInteger(hosts) || hosts < 1) return { error: 'badHosts' };
  const np = prefixForHosts(hosts);
  if (np === null || np < prefix) return { error: 'tooBig' };
  return buildSplit(network, prefix, np);
}

function buildSplit(network: number, prefix: number, newPrefix: number): SplitResult {
  const base = (network & maskOf(prefix)) >>> 0;
  const count = 2 ** (newPrefix - prefix);
  const size = 2 ** (32 - newPrefix);
  const rows: SubnetRow[] = [];
  for (let i = 0; i < Math.min(count, MAX_ROWS); i++) rows.push(rowOf(base + i * size, newPrefix));
  return { newPrefix, count, rows, truncated: count > MAX_ROWS };
}

/** Prefisso più lungo che offre almeno `hosts` host utilizzabili (minimo /30 tranne per 1 host: /32 non serve in VLSM). */
export function prefixForHosts(hosts: number): number | null {
  if (!Number.isFinite(hosts) || hosts < 1 || hosts > 2 ** 32 - 2) return null;
  let p = 30;
  while (p > 0 && 2 ** (32 - p) - 2 < hosts) p--;
  return p;
}

export interface VlsmAllocation extends SubnetRow {
  /** Host richiesti da questa sottorete. */
  requested: number;
}
export interface VlsmResult {
  allocations: VlsmAllocation[];
  /** Richieste che non entrano più nella rete. */
  failed: number[];
  /** Indirizzi ancora liberi dopo l'ultima assegnazione. */
  free: number;
}

/** VLSM semplice: dal fabbisogno maggiore al minore, una dopo l'altra senza buchi (blocchi allineati). */
export function vlsm(network: number, prefix: number, requests: number[]): VlsmResult {
  const base = (network & maskOf(prefix)) >>> 0;
  const end = base + 2 ** (32 - prefix); // escluso
  let cursor = base;
  const allocations: VlsmAllocation[] = [];
  const failed: number[] = [];
  const sorted = [...requests].sort((a, b) => b - a);
  for (const need of sorted) {
    const p = prefixForHosts(need);
    if (p === null || p < prefix) {
      failed.push(need);
      continue;
    }
    const size = 2 ** (32 - p);
    const start = Math.ceil(cursor / size) * size; // allinea al blocco
    if (start + size > end) {
      failed.push(need);
      continue;
    }
    allocations.push({ ...rowOf(start, p), requested: need });
    cursor = start + size;
  }
  return { allocations, failed, free: Math.max(0, end - cursor) };
}

/** Elenco di fabbisogni "100, 50, 20" (separati da virgole, spazi o a capo); null se contiene altro. */
export function parseRequests(s: string): number[] | null {
  const parts = s.split(/[\s,;]+/).filter(Boolean);
  if (parts.length === 0) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,10}$/.test(p)) return null;
    const v = Number(p);
    if (v < 1) return null;
    out.push(v);
  }
  return out;
}

// ---------- IPv6 ----------

const MAX128 = (1n << 128n) - 1n;

/** Legge un indirizzo IPv6 (anche con `::` e con coda IPv4 come `::ffff:192.0.2.1`); niente zone `%eth0`. */
export function parseIpv6(input: string): bigint | null {
  let s = input.trim().toLowerCase();
  if (s === '' || !/^[0-9a-f:.]+$/.test(s)) return null;
  // coda IPv4 = due gruppi
  const dot = s.lastIndexOf('.');
  if (dot >= 0) {
    const colon = s.lastIndexOf(':');
    if (colon < 0) return null;
    const v4 = parseIpv4(s.slice(colon + 1));
    if (v4 === null) return null;
    s = s.slice(0, colon + 1) + ((v4 >>> 16).toString(16) + ':' + (v4 & 0xffff).toString(16));
  }
  if (s.includes(':::')) return null;
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const toGroups = (h: string) => (h === '' ? [] : h.split(':'));
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  const all = [...head, ...tail];
  if (!all.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  if (halves.length === 1 ? head.length !== 8 : head.length + tail.length > 7) return null;
  const groups = halves.length === 1 ? head : [...head, ...Array<string>(8 - head.length - tail.length).fill('0'), ...tail];
  let n = 0n;
  for (const g of groups) n = (n << 16n) | BigInt(parseInt(g, 16));
  return n;
}

function groupsOf(n: bigint): number[] {
  const g: number[] = [];
  for (let i = 7; i >= 0; i--) g.push(Number((n >> BigInt(i * 16)) & 0xffffn));
  return g;
}

/** Forma estesa: otto gruppi da quattro cifre. */
export function expandIpv6(n: bigint): string {
  return groupsOf(n)
    .map((g) => g.toString(16).padStart(4, '0'))
    .join(':');
}

/** Forma compressa secondo RFC 5952: minuscolo, senza zeri iniziali, `::` sulla sequenza più lunga (almeno due gruppi; a parità la prima). */
export function compressIpv6(n: bigint): string {
  const g = groupsOf(n);
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (g[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && g[j] === 0) j++;
    if (j - i > bestLen) {
      bestStart = i;
      bestLen = j - i;
    }
    i = j;
  }
  const hex = g.map((x) => x.toString(16));
  if (bestLen < 2) return hex.join(':');
  return hex.slice(0, bestStart).join(':') + '::' + hex.slice(bestStart + bestLen).join(':');
}

export type Ipv6Kind = 'unspecified' | 'loopback' | 'ipv4Mapped' | 'nat64' | 'documentation' | 'ula' | 'linkLocal' | 'multicast' | 'global' | 'reserved';

interface Range6 {
  kind: Ipv6Kind;
  base: string;
  prefix: number;
}
const RANGES6: readonly Range6[] = [
  { kind: 'unspecified', base: '::', prefix: 128 },
  { kind: 'loopback', base: '::1', prefix: 128 },
  { kind: 'ipv4Mapped', base: '::ffff:0:0', prefix: 96 },
  { kind: 'nat64', base: '64:ff9b::', prefix: 96 },
  { kind: 'documentation', base: '2001:db8::', prefix: 32 },
  { kind: 'documentation', base: '3fff::', prefix: 20 },
  { kind: 'ula', base: 'fc00::', prefix: 7 },
  { kind: 'linkLocal', base: 'fe80::', prefix: 10 },
  { kind: 'multicast', base: 'ff00::', prefix: 8 },
  { kind: 'global', base: '2000::', prefix: 3 },
];

export function maskOf6(prefix: number): bigint {
  return prefix === 0 ? 0n : (MAX128 << BigInt(128 - prefix)) & MAX128;
}

export function ipv6Kind(ip: bigint): Ipv6Kind {
  for (const r of RANGES6) {
    const base = parseIpv6(r.base) as bigint;
    if (((ip ^ base) & maskOf6(r.prefix)) === 0n) return r.kind;
  }
  return 'reserved';
}

export interface Ipv6Info {
  ip: bigint;
  prefix: number;
  first: bigint;
  last: bigint;
  /** Numero di indirizzi (2^(128-prefisso)) come testo decimale esatto. */
  total: string;
  kind: Ipv6Kind;
  expanded: string;
  compressed: string;
  /** Prefisso di rete in forma compressa con la lunghezza, es. `2001:db8::/32`. */
  networkCidr: string;
}

export function ipv6Info(ip: bigint, prefix: number): Ipv6Info {
  const mask = maskOf6(prefix);
  const first = ip & mask;
  const last = first | (~mask & MAX128);
  return {
    ip,
    prefix,
    first,
    last,
    total: (1n << BigInt(128 - prefix)).toString(),
    kind: ipv6Kind(ip),
    expanded: expandIpv6(ip),
    compressed: compressIpv6(ip),
    networkCidr: `${compressIpv6(first)}/${prefix}`,
  };
}

/** "2001:db8::1/64" o solo l'indirizzo (= /128). */
export function parseIpv6Cidr(input: string): { ip: bigint; prefix: number } | { error: ParseError } {
  const s = input.trim();
  if (s === '') return { error: 'empty' };
  const slash = s.indexOf('/');
  const addr = slash < 0 ? s : s.slice(0, slash).trim();
  const ip = parseIpv6(addr);
  if (ip === null) return { error: 'badAddress' };
  if (slash < 0) return { ip, prefix: 128 };
  const p = s.slice(slash + 1).trim();
  if (!/^\d{1,3}$/.test(p) || Number(p) > 128) return { error: 'badPrefix' };
  return { ip, prefix: Number(p) };
}

export function ipv6Contains(network: bigint, prefix: number, ip: bigint): boolean {
  return ((ip ^ network) & maskOf6(prefix)) === 0n;
}

/** Riconoscimento automatico: i due punti indicano IPv6. */
export function isIpv6Text(s: string): boolean {
  return s.includes(':');
}

/** Testo con gli indirizzi con separatori delle migliaia (per 2^64 e simili) a mano, senza Intl. */
export function groupDigits(digits: string, sep: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}
