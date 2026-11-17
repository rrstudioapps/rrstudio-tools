// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type * as Pkijs from 'pkijs';
import type * as Asn1js from 'asn1js';

export interface Subject {
  cn: string;
  o: string;
  ou: string;
  l: string;
  st: string;
  c: string;
  email: string;
}

export const EMPTY_SUBJECT: Subject = { cn: '', o: '', ou: '', l: '', st: '', c: '', email: '' };

export type CsrKeySpec =
  | { type: 'rsa'; bits: 2048 | 4096 }
  | { type: 'ecdsa'; curve: 'P-256' | 'P-384' }
  | { type: 'existing'; pem: string };

export type CsrErrorCode =
  | 'empty-subject'
  | 'bad-country'
  | 'bad-san'
  | 'key-encrypted'
  | 'key-format'
  | 'key-unsupported'
  | 'crypto'
  | 'build';

export class CsrError extends Error {
  readonly code: CsrErrorCode;
  readonly detail?: string;
  constructor(code: CsrErrorCode, detail?: string) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

// ---------- soggetto ----------

const OID = { C: '2.5.4.6', ST: '2.5.4.8', L: '2.5.4.7', O: '2.5.4.10', OU: '2.5.4.11', CN: '2.5.4.3', EMAIL: '1.2.840.113549.1.9.1' } as const;

export interface SubjectAttribute {
  /** Sigla leggibile (C, ST, L, O, OU, CN, emailAddress). */
  label: string;
  oid: string;
  value: string;
  /** Tipo ASN.1 della stringa: PrintableString per il paese, IA5String per l'email, UTF8String per il resto. */
  string: 'printable' | 'ia5' | 'utf8';
}

/**
 * Campi del soggetto, nell'ordine in cui compaiono di solito (C, ST, L, O, OU, CN, email); i campi vuoti si saltano.
 * Il paese deve essere di due lettere (ISO 3166) e viene portato in maiuscolo.
 */
export function subjectAttributes(s: Subject): SubjectAttribute[] {
  const t = (v: string) => v.trim();
  const out: SubjectAttribute[] = [];
  const country = t(s.c).toUpperCase();
  if (country !== '') {
    if (!/^[A-Z]{2}$/.test(country)) throw new CsrError('bad-country');
    out.push({ label: 'C', oid: OID.C, value: country, string: 'printable' });
  }
  const add = (label: string, oid: string, v: string, string: SubjectAttribute['string'] = 'utf8') => {
    if (t(v) !== '') out.push({ label, oid, value: t(v), string });
  };
  add('ST', OID.ST, s.st);
  add('L', OID.L, s.l);
  add('O', OID.O, s.o);
  add('OU', OID.OU, s.ou);
  add('CN', OID.CN, s.cn);
  add('emailAddress', OID.EMAIL, s.email, 'ia5');
  if (out.length === 0) throw new CsrError('empty-subject');
  return out;
}

// ---------- SAN ----------

export interface SanList {
  dns: string[];
  /** Indirizzi IP nella forma data dall'utente. */
  ip: string[];
  /** Voci non riconoscibili né come nome DNS né come indirizzo IP. */
  invalid: string[];
}

/** Vero se è un indirizzo IPv4 in notazione puntata. */
export function isIPv4(v: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v);
  return !!m && m.slice(1).every((x) => Number(x) <= 255 && String(Number(x)) === x);
}

/** Byte di un indirizzo IPv4 (4) o IPv6 (16, con "::" e IPv4 finale); null se non valido. */
export function ipToBytes(v: string): Uint8Array | null {
  if (isIPv4(v)) return Uint8Array.from(v.split('.').map(Number));
  if (!v.includes(':') || !/^[0-9a-fA-F:.]+$/.test(v)) return null;
  let text = v;
  let tail: number[] = [];
  const last = text.slice(text.lastIndexOf(':') + 1);
  if (last.includes('.')) {
    if (!isIPv4(last)) return null;
    const b = last.split('.').map(Number);
    tail = [(b[0] << 8) | b[1], (b[2] << 8) | b[3]];
    text = text.slice(0, text.lastIndexOf(':') + 1) + '0:0';
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string): number[] | null => {
    if (part === '') return [];
    const groups = part.split(':');
    if (groups.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return null;
    return groups.map((g) => parseInt(g, 16));
  };
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  if (!head || !rest) return null;
  let words: number[];
  if (halves.length === 2) {
    const fill = 8 - head.length - rest.length;
    if (fill < 1) return null;
    words = [...head, ...Array<number>(fill).fill(0), ...rest];
  } else {
    if (head.length !== 8) return null;
    words = head;
  }
  if (tail.length) words = [...words.slice(0, 6), ...tail];
  const out = new Uint8Array(16);
  words.forEach((w, i) => {
    out[i * 2] = w >> 8;
    out[i * 2 + 1] = w & 255;
  });
  return out;
}

/** Nome DNS valido (etichette LDH, jolly `*.` solo all'inizio). Si usa anche per i nomi con caratteri non ASCII già in punycode. */
export function isDnsName(v: string): boolean {
  const name = v.startsWith('*.') ? v.slice(2) : v;
  if (name.length === 0 || name.length > 253) return false;
  // un'etichetta finale tutta numerica (es. 999.1.1.1) è un IPv4 sbagliato, non un nome
  if (/^\d+$/.test(name.slice(name.lastIndexOf('.') + 1))) return false;
  return name.split('.').every((l) => /^[A-Za-z0-9_]([A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?$/.test(l));
}

/** Legge l'elenco dei SAN: voci separate da righe, virgole, punti e virgola o spazi; senza doppioni. */
export function parseSanList(text: string): SanList {
  const out: SanList = { dns: [], ip: [], invalid: [] };
  const seen = new Set<string>();
  for (const raw of text.split(/[\s,;]+/)) {
    const v = raw.trim().replace(/^(DNS|IP)[:=]/i, '');
    if (v === '' || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    if (ipToBytes(v)) out.ip.push(v);
    else if (isDnsName(v)) out.dns.push(v);
    else out.invalid.push(v);
  }
  return out;
}

// ---------- chiavi ----------

const OIDS = { rsa: '1.2.840.113549.1.1.1', ec: '1.2.840.10045.2.1', p256: '1.2.840.10045.3.1.7', p384: '1.3.132.0.34', p521: '1.3.132.0.35' };

export interface KeyAlgo {
  rsa: boolean;
  /** Algoritmo WebCrypto per l'importazione. */
  import: RsaHashedImportParams | EcKeyImportParams;
  hash: 'SHA-256' | 'SHA-384' | 'SHA-512';
}

export function decodePem(pem: string, label: string): Uint8Array | null {
  const m = new RegExp(`-----BEGIN ${label}-----([A-Za-z0-9+/=\\s]+)-----END ${label}-----`).exec(pem);
  if (!m) return null;
  try {
    return Uint8Array.from(atob(m[1].replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export function toPem(label: string, der: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < der.length; i += 0x8000) bin += String.fromCharCode(...der.subarray(i, i + 0x8000));
  const lines = btoa(bin).match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

/** Riconosce l'algoritmo di una chiave PKCS#8 dal suo AlgorithmIdentifier. */
export async function detectKeyAlgo(der: Uint8Array): Promise<KeyAlgo> {
  const asn1js = await import('asn1js');
  const asn = asn1js.fromBER(der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength) as ArrayBuffer);
  if (asn.offset === -1 || !(asn.result instanceof asn1js.Sequence)) throw new CsrError('key-format');
  const items = asn.result.valueBlock.value;
  const algId = items[1];
  if (!(algId instanceof asn1js.Sequence) || !(items[0] instanceof asn1js.Integer)) throw new CsrError('key-format');
  const oid = (algId.valueBlock.value[0] as Asn1js.ObjectIdentifier | undefined)?.valueBlock.toString();
  if (oid === OIDS.rsa) return { rsa: true, import: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, hash: 'SHA-256' };
  if (oid === OIDS.ec) {
    const curve = (algId.valueBlock.value[1] as Asn1js.ObjectIdentifier | undefined)?.valueBlock.toString();
    if (curve === OIDS.p256) return { rsa: false, import: { name: 'ECDSA', namedCurve: 'P-256' }, hash: 'SHA-256' };
    if (curve === OIDS.p384) return { rsa: false, import: { name: 'ECDSA', namedCurve: 'P-384' }, hash: 'SHA-384' };
    if (curve === OIDS.p521) return { rsa: false, import: { name: 'ECDSA', namedCurve: 'P-521' }, hash: 'SHA-512' };
    throw new CsrError('key-unsupported', 'curve');
  }
  throw new CsrError('key-unsupported', oid);
}

/** Coppia di chiavi WebCrypto pronta per firmare la richiesta. */
export interface SigningKeys {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  hash: KeyAlgo['hash'];
  /** PKCS#8 della chiave privata, solo se creata qui. */
  pkcs8?: Uint8Array;
}

async function loadExistingKey(pem: string): Promise<SigningKeys> {
  if (/-----BEGIN ENCRYPTED PRIVATE KEY-----/.test(pem)) throw new CsrError('key-encrypted');
  const der = decodePem(pem, 'PRIVATE KEY');
  if (!der) throw new CsrError('key-format');
  const algo = await detectKeyAlgo(der);
  const subtle = crypto.subtle;
  let privateKey: CryptoKey;
  try {
    privateKey = await subtle.importKey('pkcs8', der as BufferSource, algo.import, true, ['sign']);
  } catch {
    throw new CsrError('key-format');
  }
  // la chiave pubblica si ricava dal JWK della privata (n, e oppure x, y)
  const jwk = await subtle.exportKey('jwk', privateKey);
  const pub: JsonWebKey = algo.rsa
    ? { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }
    : { kty: 'EC', crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true };
  const publicKey = await subtle.importKey('jwk', pub, algo.import, true, ['verify']);
  return { privateKey, publicKey, hash: algo.hash };
}

async function createKey(spec: Exclude<CsrKeySpec, { type: 'existing' }>): Promise<SigningKeys> {
  const subtle = crypto.subtle;
  const pair =
    spec.type === 'rsa'
      ? await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: spec.bits, publicExponent: Uint8Array.of(1, 0, 1), hash: 'SHA-256' }, true, ['sign', 'verify'])
      : await subtle.generateKey({ name: 'ECDSA', namedCurve: spec.curve }, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey));
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, hash: spec.type === 'ecdsa' && spec.curve === 'P-384' ? 'SHA-384' : 'SHA-256', pkcs8 };
}

// ---------- richiesta ----------

export interface CsrInput {
  subject: Subject;
  san: SanList;
  key: CsrKeySpec;
}

export interface CsrResult {
  csrPem: string;
  csrDer: Uint8Array;
  /** Chiave privata PKCS#8 in PEM, solo se è stata creata una chiave nuova. */
  keyPem: string | null;
}

const OID_EXTENSION_REQUEST = '1.2.840.113549.1.9.14';
const OID_SAN = '2.5.29.17';

function nameValue(asn1js: typeof Asn1js, a: SubjectAttribute): Pkijs.AttributeTypeAndValue['value'] {
  if (a.string === 'printable') return new asn1js.PrintableString({ value: a.value });
  if (a.string === 'ia5') return new asn1js.IA5String({ value: a.value });
  return new asn1js.Utf8String({ value: a.value });
}

/** Crea la richiesta PKCS#10 con pkijs: soggetto, SAN come extensionRequest, firma SHA-256/384 con la chiave. */
export async function buildCsr(input: CsrInput): Promise<CsrResult> {
  if (!globalThis.crypto?.subtle) throw new CsrError('crypto');
  const attrs = subjectAttributes(input.subject);
  if (input.san.invalid.length > 0) throw new CsrError('bad-san', input.san.invalid.join(', '));
  const [asn1js, pkijs] = await Promise.all([import('asn1js'), import('pkijs')]);
  const keys = input.key.type === 'existing' ? await loadExistingKey(input.key.pem) : await createKey(input.key);
  try {
    const csr = new pkijs.CertificationRequest();
    csr.version = 0;
    for (const a of attrs) csr.subject.typesAndValues.push(new pkijs.AttributeTypeAndValue({ type: a.oid, value: nameValue(asn1js, a) }));
    // pkijs mette tutti i campi in un solo RDN multivalore ("C=IT + ST=MI + …"): le CA vogliono un RDN per campo,
    // quindi la codifica del soggetto la facciamo noi (un SET per attributo, nell'ordine dato).
    csr.subject.toSchema = () =>
      new asn1js.Sequence({
        value: attrs.map(
          (a) => new asn1js.Set({ value: [new asn1js.Sequence({ value: [new asn1js.ObjectIdentifier({ value: a.oid }), nameValue(asn1js, a) as Asn1js.BaseBlock] })] }),
        ),
      });
    await csr.subjectPublicKeyInfo.importKey(keys.publicKey);
    const names: Pkijs.GeneralName[] = [
      ...input.san.dns.map((d) => new pkijs.GeneralName({ type: 2, value: d })),
      ...input.san.ip.map((ip) => new pkijs.GeneralName({ type: 7, value: new asn1js.OctetString({ valueHex: ipToBytes(ip)!.slice().buffer as ArrayBuffer }) })),
    ];
    if (names.length > 0) {
      const ext = new pkijs.Extension({
        extnID: OID_SAN,
        critical: false,
        extnValue: new pkijs.GeneralNames({ names }).toSchema().toBER(false),
      });
      csr.attributes = [new pkijs.Attribute({ type: OID_EXTENSION_REQUEST, values: [new pkijs.Extensions({ extensions: [ext] }).toSchema()] })];
    }
    await csr.sign(keys.privateKey, keys.hash);
    const csrDer = new Uint8Array(csr.toSchema().toBER(false));
    return { csrPem: toPem('CERTIFICATE REQUEST', csrDer), csrDer, keyPem: keys.pkcs8 ? toPem('PRIVATE KEY', keys.pkcs8) : null };
  } catch (e) {
    if (e instanceof CsrError) throw e;
    throw new CsrError('build', e instanceof Error ? e.message : undefined);
  }
}
