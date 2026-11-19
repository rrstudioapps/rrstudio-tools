// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Estrazione del contenuto da un file .p7m (CMS SignedData, CAdES) con un piccolo lettore ASN.1/DER.
 * La firma NON viene verificata: si legge soltanto il contenuto incapsulato.
 */

export class P7mError extends Error {}

interface Node {
  /** Classe del tag: 0 universale, 1 applicazione, 2 contestuale, 3 privato. */
  cls: number;
  constructed: boolean;
  tag: number;
  /** Inizio dell'intero elemento (primo byte del tag). */
  begin: number;
  /** Inizio e fine del contenuto (la fine esclude i due zeri finali delle lunghezze indefinite). */
  start: number;
  end: number;
  /** Posizione del primo byte dopo l'elemento (zeri di fine inclusi). */
  next: number;
  children: Node[];
}

const MAX_DEPTH = 32;
const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';

function readNode(b: Uint8Array, begin: number, limit: number, depth: number): Node {
  if (depth > MAX_DEPTH) throw new P7mError('struttura troppo annidata');
  let pos = begin;
  if (pos + 2 > limit) throw new P7mError('struttura troncata');
  const first = b[pos++];
  const cls = first >> 6;
  const constructed = (first & 0x20) !== 0;
  let tag = first & 0x1f;
  if (tag === 0x1f) {
    tag = 0;
    let more = true;
    while (more) {
      if (pos >= limit) throw new P7mError('tag troncato');
      const t = b[pos++];
      tag = tag * 128 + (t & 0x7f);
      more = (t & 0x80) !== 0;
    }
  }
  if (pos >= limit) throw new P7mError('lunghezza mancante');
  const l0 = b[pos++];
  let len = -1; // -1: lunghezza indefinita
  if (l0 < 0x80) len = l0;
  else if (l0 !== 0x80) {
    const n = l0 & 0x7f;
    if (n > 4 || pos + n > limit) throw new P7mError('lunghezza non valida');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[pos++];
  } else if (!constructed) {
    throw new P7mError('lunghezza indefinita su elemento primitivo');
  }
  const node: Node = { cls, constructed, tag, begin, start: pos, end: pos, next: pos, children: [] };
  if (len >= 0) {
    if (pos + len > limit) throw new P7mError('elemento oltre la fine dei dati');
    node.end = node.next = pos + len;
    if (constructed) {
      let p = node.start;
      while (p < node.end) {
        const child = readNode(b, p, node.end, depth + 1);
        node.children.push(child);
        p = child.next;
      }
    }
  } else {
    // lunghezza indefinita: figli fino al marcatore 00 00
    let p = pos;
    for (;;) {
      if (p + 2 > limit) throw new P7mError('fine contenuto mancante');
      if (b[p] === 0 && b[p + 1] === 0) break;
      const child = readNode(b, p, limit, depth + 1);
      node.children.push(child);
      p = child.next;
    }
    node.end = p;
    node.next = p + 2;
  }
  return node;
}

function oidOf(b: Uint8Array, n: Node): string {
  if (n.cls !== 0 || n.tag !== 6 || n.end <= n.start) return '';
  const parts: number[] = [];
  let v = 0;
  for (let i = n.start; i < n.end; i++) {
    v = v * 128 + (b[i] & 0x7f);
    if ((b[i] & 0x80) === 0) {
      parts.push(v);
      v = 0;
    }
  }
  const [first, ...rest] = parts;
  const a = Math.min(Math.floor(first / 40), 2);
  return [a, first - a * 40, ...rest].join('.');
}

/** Contenuto di un OCTET STRING, anche frammentato (costruito, a lunghezza definita o indefinita). */
function octets(b: Uint8Array, n: Node, out: Uint8Array[]): void {
  if (!n.constructed) {
    out.push(b.subarray(n.start, n.end));
    return;
  }
  for (const c of n.children) {
    if (c.cls === 0 && c.tag === 4) octets(b, c, out);
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const res = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    res.set(p, o);
    o += p.length;
  }
  return res;
}

function isCms(b: Uint8Array): boolean {
  if (b.length < 4 || b[0] !== 0x30) return false;
  try {
    const root = readNode(b, 0, b.length, 0);
    const oid = root.children[0];
    return !!oid && oidOf(b, oid) === OID_SIGNED_DATA;
  } catch {
    return false;
  }
}

function extractOnce(b: Uint8Array): Uint8Array {
  const root = readNode(b, 0, b.length, 0);
  // ContentInfo ::= SEQUENCE { contentType OID, content [0] EXPLICIT ANY }
  if (!(root.cls === 0 && root.tag === 16) || root.children.length < 2) throw new P7mError('non è una busta CMS');
  if (oidOf(b, root.children[0]) !== OID_SIGNED_DATA) throw new P7mError('non è un SignedData');
  const wrap = root.children[1];
  if (!(wrap.cls === 2 && wrap.tag === 0) || wrap.children.length === 0) throw new P7mError('SignedData mancante');
  const signed = wrap.children[0];
  if (!(signed.cls === 0 && signed.tag === 16)) throw new P7mError('SignedData non valido');
  // SignedData ::= SEQUENCE { version, digestAlgorithms SET, encapContentInfo SEQUENCE, ... }
  const encap = signed.children.find((c) => c.cls === 0 && c.tag === 16);
  if (!encap || encap.children.length === 0) throw new P7mError('contenuto incapsulato mancante');
  const eContentWrap = encap.children.find((c) => c.cls === 2 && c.tag === 0);
  if (!eContentWrap) throw new P7mError('il file non contiene dati (firma staccata)');
  const inner = eContentWrap.children[0];
  if (!inner) throw new P7mError('contenuto vuoto');
  if (inner.cls === 0 && inner.tag === 4) {
    const parts: Uint8Array[] = [];
    octets(b, inner, parts);
    return concat(parts);
  }
  // alcuni software mettono il dato direttamente (SEQUENCE o altro): si restituisce l'elemento intero
  return b.slice(inner.begin, inner.next);
}

/**
 * Estrae il contenuto incapsulato di un CMS SignedData in DER/BER. Se il contenuto è a sua volta
 * una busta CMS (doppia firma) la apre, fino a 4 livelli.
 */
export function extractCmsContent(bytes: Uint8Array): Uint8Array {
  let current = bytes;
  for (let level = 0; level < 4; level++) {
    const content = extractOnce(current);
    if (!isCms(content)) return content;
    current = content;
  }
  throw new P7mError('buste annidate troppo in profondità');
}

/** Decodifica Base64 tollerante (a capo, spazi, righe PEM) in byte; null se non è Base64. */
export function decodeBase64Loose(text: string): Uint8Array | null {
  const body = text
    .replace(/-----(BEGIN|END)[^-]*-----/g, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (body.length < 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return null;
  const padded = body + '='.repeat((4 - (body.length % 4)) % 4);
  try {
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Da un file .p7m (DER oppure Base64) ai byte del contenuto, di norma l'XML della fattura.
 * Lancia P7mError se non è decodificabile.
 */
export function extractP7m(file: Uint8Array): Uint8Array {
  let der = file;
  if (file.length > 0 && file[0] !== 0x30) {
    // niente DER: forse Base64 (anche con intestazioni PEM)
    const text = new TextDecoder('latin1').decode(file);
    const decoded = decodeBase64Loose(text);
    if (!decoded || decoded[0] !== 0x30) throw new P7mError('né DER né Base64');
    der = decoded;
  }
  if (der.length === 0) throw new P7mError('file vuoto');
  return extractCmsContent(der);
}
