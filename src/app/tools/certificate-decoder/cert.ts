// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type * as Pkijs from 'pkijs';

// ---------- tipi ----------

export interface NameEntry {
  oid: string;
  /** Sigla (CN, O, C…) o l'OID se sconosciuto. */
  label: string;
  value: string;
}

export interface DistinguishedName {
  entries: NameEntry[];
  /** Forma su una riga, es. `CN=esempio.it, O=Esempio, C=IT`. */
  text: string;
}

export type SanType = 'dns' | 'ip' | 'email' | 'uri' | 'dirName' | 'otherName' | 'registeredID' | 'other';

export interface SanEntry {
  type: SanType;
  value: string;
}

export interface NamedOid {
  oid: string;
  name: string;
}

export interface KeyInfo {
  /** Nome dell'algoritmo: RSA, EC, Ed25519… */
  algorithm: string;
  oid: string;
  /** Dimensione in bit (modulo RSA, curva EC…), se nota. */
  size: number | null;
  /** Curva (EC) o esponente pubblico (RSA). */
  detail: string | null;
}

export interface SignatureInfo {
  name: string;
  oid: string;
  /** Algoritmo considerato debole (MD5, SHA-1). */
  weak: boolean;
}

export type ValidityStatus = 'valid' | 'expired' | 'not-yet';

export interface Validity {
  notBefore: Date;
  notAfter: Date;
  status: ValidityStatus;
  /** Giorni interi alla scadenza (negativi se già scaduto). */
  daysLeft: number;
  /** Giorni al primo giorno di validità, se non è ancora valido (altrimenti 0). */
  daysToStart: number;
  /** Durata totale in giorni. */
  totalDays: number;
}

export interface BasicConstraints {
  ca: boolean;
  pathLen: number | null;
}

export interface ExtensionInfo {
  oid: string;
  name: string;
  critical: boolean;
}

export interface Fingerprints {
  sha1: string;
  sha256: string;
}

interface Common {
  version: number;
  subject: DistinguishedName;
  signature: SignatureInfo;
  key: KeyInfo;
  san: SanEntry[];
  keyUsage: string[];
  extendedKeyUsage: NamedOid[];
  basicConstraints: BasicConstraints | null;
  ski: string | null;
  extensions: ExtensionInfo[];
  fingerprints: Fingerprints;
  /** Dimensione in byte del DER. */
  size: number;
}

export interface CertInfo extends Common {
  kind: 'certificate';
  serial: string;
  issuer: DistinguishedName;
  selfSigned: boolean;
  validity: Validity;
  aki: string | null;
}

export interface CsrInfo extends Common {
  kind: 'csr';
  /** true/false se la firma si è potuta verificare, null se il browser non sa farlo per questo algoritmo. */
  signatureValid: boolean | null;
}

export type ItemError = 'bad-der' | 'unsupported-type' | 'private-key' | 'bad-base64' | 'not-cert';

export type DecodedItem = CertInfo | CsrInfo | { kind: 'error'; error: ItemError; label?: string; detail?: string };

export type DecodeError = 'empty' | 'no-pem' | 'too-large';

export type DecodeResult = { ok: true; items: DecodedItem[] } | { ok: false; error: DecodeError };

export const MAX_INPUT_BYTES = 2 * 1024 * 1024;

// ---------- tabelle di OID ----------

const NAME_LABELS: Record<string, string> = {
  '2.5.4.3': 'CN',
  '2.5.4.4': 'SN',
  '2.5.4.5': 'serialNumber',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.9': 'street',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '2.5.4.12': 'title',
  '2.5.4.15': 'businessCategory',
  '2.5.4.17': 'postalCode',
  '2.5.4.42': 'GN',
  '2.5.4.97': 'organizationIdentifier',
  '0.9.2342.19200300.100.1.1': 'UID',
  '0.9.2342.19200300.100.1.25': 'DC',
  '1.2.840.113549.1.9.1': 'emailAddress',
  '1.3.6.1.4.1.311.60.2.1.3': 'jurisdictionC',
};

const SIGNATURE_NAMES: Record<string, string> = {
  '1.2.840.113549.1.1.4': 'md5WithRSAEncryption',
  '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
  '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
  '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
  '1.2.840.113549.1.1.10': 'RSASSA-PSS',
  '1.2.840.10045.4.1': 'ecdsa-with-SHA1',
  '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
  '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
  '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512',
  '1.3.101.112': 'Ed25519',
  '1.3.101.113': 'Ed448',
  '1.2.840.10040.4.3': 'dsa-with-sha1',
  '2.16.840.1.101.3.4.3.2': 'dsa-with-sha256',
};
const WEAK_SIGNATURES = new Set(['1.2.840.113549.1.1.4', '1.2.840.113549.1.1.5', '1.2.840.10045.4.1', '1.2.840.10040.4.3']);

const CURVES: Record<string, { name: string; bits: number }> = {
  '1.2.840.10045.3.1.7': { name: 'P-256 (prime256v1)', bits: 256 },
  '1.3.132.0.34': { name: 'P-384 (secp384r1)', bits: 384 },
  '1.3.132.0.35': { name: 'P-521 (secp521r1)', bits: 521 },
  '1.3.132.0.10': { name: 'secp256k1', bits: 256 },
  '1.2.840.10045.3.1.1': { name: 'P-192 (prime192v1)', bits: 192 },
  '1.3.132.0.33': { name: 'P-224 (secp224r1)', bits: 224 },
};

const EKU_NAMES: Record<string, string> = {
  '2.5.29.37.0': 'anyExtendedKeyUsage',
  '1.3.6.1.5.5.7.3.1': 'serverAuth',
  '1.3.6.1.5.5.7.3.2': 'clientAuth',
  '1.3.6.1.5.5.7.3.3': 'codeSigning',
  '1.3.6.1.5.5.7.3.4': 'emailProtection',
  '1.3.6.1.5.5.7.3.8': 'timeStamping',
  '1.3.6.1.5.5.7.3.9': 'OCSPSigning',
  '1.3.6.1.4.1.311.10.3.4': 'encryptedFileSystem',
  '1.3.6.1.4.1.311.20.2.2': 'smartcardLogon',
  '1.3.6.1.5.2.3.5': 'kdcAuth',
};

const KEY_USAGE_NAMES = [
  'digitalSignature',
  'nonRepudiation',
  'keyEncipherment',
  'dataEncipherment',
  'keyAgreement',
  'keyCertSign',
  'cRLSign',
  'encipherOnly',
  'decipherOnly',
];

const EXTENSION_NAMES: Record<string, string> = {
  '2.5.29.14': 'subjectKeyIdentifier',
  '2.5.29.15': 'keyUsage',
  '2.5.29.17': 'subjectAltName',
  '2.5.29.18': 'issuerAltName',
  '2.5.29.19': 'basicConstraints',
  '2.5.29.30': 'nameConstraints',
  '2.5.29.31': 'cRLDistributionPoints',
  '2.5.29.32': 'certificatePolicies',
  '2.5.29.35': 'authorityKeyIdentifier',
  '2.5.29.36': 'policyConstraints',
  '2.5.29.37': 'extendedKeyUsage',
  '1.3.6.1.5.5.7.1.1': 'authorityInfoAccess',
  '1.3.6.1.5.5.7.1.3': 'qcStatements',
  '1.3.6.1.5.5.7.1.24': 'tlsFeature (OCSP must-staple)',
  '1.3.6.1.4.1.11129.2.4.2': 'signedCertificateTimestamps',
  '1.2.840.113549.1.9.14': 'extensionRequest',
};

// ---------- utilità ----------

export function toHexColon(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
}

/** Numero seriale: toglie lo zero iniziale che serve solo al segno nel DER. */
export function serialHex(bytes: Uint8Array): string {
  let b = bytes;
  while (b.length > 1 && b[0] === 0) b = b.subarray(1);
  return toHexColon(b);
}

/** Bit significativi di un intero a grandezza arbitraria (big endian, senza segno). */
export function bitLength(bytes: Uint8Array): number {
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) i++;
  if (i === bytes.length) return 0;
  return (bytes.length - i - 1) * 8 + (32 - Math.clz32(bytes[i]));
}

export function formatIp(bytes: Uint8Array): string {
  if (bytes.length === 4) return Array.from(bytes).join('.');
  if (bytes.length === 16) {
    const groups: number[] = [];
    for (let i = 0; i < 16; i += 2) groups.push((bytes[i] << 8) | bytes[i + 1]);
    // comprime la sequenza più lunga (almeno due) di gruppi a zero
    let bestStart = -1;
    let bestLen = 0;
    for (let i = 0; i < 8; ) {
      if (groups[i] !== 0) {
        i++;
        continue;
      }
      let j = i;
      while (j < 8 && groups[j] === 0) j++;
      if (j - i > bestLen) {
        bestStart = i;
        bestLen = j - i;
      }
      i = j;
    }
    if (bestLen < 2) return groups.map((g) => g.toString(16)).join(':');
    const left = groups.slice(0, bestStart).map((g) => g.toString(16)).join(':');
    const right = groups.slice(bestStart + bestLen).map((g) => g.toString(16)).join(':');
    return `${left}::${right}`;
  }
  // lunghezza anomala (per esempio un intervallo di indirizzi di un vincolo): esadecimale
  return toHexColon(bytes);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export function computeValidity(notBefore: Date, notAfter: Date, now: Date): Validity {
  const status: ValidityStatus = now < notBefore ? 'not-yet' : now > notAfter ? 'expired' : 'valid';
  return {
    notBefore,
    notAfter,
    status,
    daysLeft: daysBetween(now, notAfter),
    daysToStart: status === 'not-yet' ? daysBetween(now, notBefore) : 0,
    totalDays: daysBetween(notBefore, notAfter),
  };
}

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'toString' in v) return String(v);
  return '';
}

// ---------- input PEM / DER ----------

export interface PemBlock {
  label: string;
  /** Contenuto base64 senza spazi. */
  base64: string;
}

const PEM_RE = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g;

export function extractPemBlocks(text: string): PemBlock[] {
  const blocks: PemBlock[] = [];
  for (const m of text.matchAll(PEM_RE)) {
    // elimina eventuali intestazioni "Proc-Type:" / righe con i due punti e gli spazi
    const body = m[2]
      .split(/\r?\n/)
      .filter((l) => !l.includes(':'))
      .join('')
      .replace(/\s+/g, '');
    blocks.push({ label: m[1], base64: body });
  }
  return blocks;
}

export function base64ToBytes(b64: string): Uint8Array | null {
  const clean = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (clean === '' || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return null;
  try {
    const bin = atob(clean.padEnd(Math.ceil(clean.length / 4) * 4, '='));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const CERT_LABELS = new Set(['CERTIFICATE', 'X509 CERTIFICATE', 'TRUSTED CERTIFICATE']);
const CSR_LABELS = new Set(['CERTIFICATE REQUEST', 'NEW CERTIFICATE REQUEST', 'X509 CRL REQUEST']);

function isPrivateKeyLabel(label: string): boolean {
  return /PRIVATE KEY/.test(label);
}

const textDecoder = new TextDecoder('utf-8', { fatal: false });

/**
 * Decodifica un testo PEM (anche con più blocchi, per le catene) o un file DER (byte).
 * `now` serve a calcolare la validità (di default, adesso).
 */
export async function decode(input: string | Uint8Array, now: Date = new Date()): Promise<DecodeResult> {
  const size = typeof input === 'string' ? input.length : input.length;
  if (size === 0 || (typeof input === 'string' && input.trim() === '')) return { ok: false, error: 'empty' };
  if (size > MAX_INPUT_BYTES) return { ok: false, error: 'too-large' };

  const blobs: { der: Uint8Array | null; label?: string; kindHint?: 'cert' | 'csr' }[] = [];
  let text: string | null = null;
  if (typeof input === 'string') text = input;
  else if (startsWithPem(input)) text = textDecoder.decode(input);

  if (text !== null) {
    const blocks = extractPemBlocks(text);
    if (blocks.length === 0) {
      // niente intestazioni: forse è solo il base64 del DER
      const der = base64ToBytes(text);
      if (!der) return { ok: false, error: 'no-pem' };
      blobs.push({ der });
    }
    for (const b of blocks) blobs.push({ der: base64ToBytes(b.base64), label: b.label, kindHint: CERT_LABELS.has(b.label) ? 'cert' : CSR_LABELS.has(b.label) ? 'csr' : undefined });
  } else {
    blobs.push({ der: input as Uint8Array });
  }

  const items: DecodedItem[] = [];
  for (const b of blobs) {
    if (b.label && isPrivateKeyLabel(b.label)) {
      items.push({ kind: 'error', error: 'private-key', label: b.label });
      continue;
    }
    if (b.label && !b.kindHint) {
      items.push({ kind: 'error', error: 'unsupported-type', label: b.label });
      continue;
    }
    if (!b.der) {
      items.push({ kind: 'error', error: 'bad-base64', label: b.label });
      continue;
    }
    items.push(await decodeDer(b.der, now, b.kindHint, b.label));
  }
  return { ok: true, items };
}

function startsWithPem(bytes: Uint8Array): boolean {
  // salta spazi e BOM iniziali
  let i = 0;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x0a || bytes[i] === 0x0d || bytes[i] === 0x09 || bytes[i] === 0xef || bytes[i] === 0xbb || bytes[i] === 0xbf)) i++;
  const head = String.fromCharCode(...bytes.subarray(i, i + 10));
  return head.startsWith('-----BEGIN');
}

async function decodeDer(der: Uint8Array, now: Date, hint: 'cert' | 'csr' | undefined, label?: string): Promise<DecodedItem> {
  const [asn1js, pkijs] = await Promise.all([import('asn1js'), import('pkijs')]);
  const buf = der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength) as ArrayBuffer;
  const asn = asn1js.fromBER(buf);
  if (asn.offset === -1) return { kind: 'error', error: 'bad-der', label };
  // un "TRUSTED CERTIFICATE" ha dati aggiuntivi dopo il certificato: si tiene solo la prima struttura
  const raw = new Uint8Array(buf, 0, asn.offset);
  const tryCert = hint !== 'csr';
  const tryCsr = hint !== 'cert';
  if (tryCert) {
    try {
      const cert = new pkijs.Certificate({ schema: asn.result });
      return await describeCertificate(cert, raw, now, asn1js);
    } catch {
      /* non è un certificato */
    }
  }
  if (tryCsr) {
    try {
      const csr = new pkijs.CertificationRequest({ schema: asn.result });
      return await describeCsr(csr, raw, asn1js);
    } catch {
      /* non è una richiesta */
    }
  }
  return { kind: 'error', error: hint ? 'bad-der' : 'not-cert', label };
}

// ---------- descrizione ----------

function describeName(name: Pkijs.RelativeDistinguishedNames): DistinguishedName {
  const entries: NameEntry[] = name.typesAndValues.map((t) => ({
    oid: t.type,
    label: NAME_LABELS[t.type] ?? t.type,
    value: str((t.value as { valueBlock: { value: unknown } }).valueBlock.value),
  }));
  return { entries, text: entries.map((e) => `${e.label}=${e.value}`).join(', ') };
}

function bytesOf(block: { valueBlock: { valueHexView: Uint8Array } }): Uint8Array {
  return new Uint8Array(block.valueBlock.valueHexView);
}

function describeSignature(oid: string): SignatureInfo {
  return { oid, name: SIGNATURE_NAMES[oid] ?? oid, weak: WEAK_SIGNATURES.has(oid) };
}

function describeKey(spki: Pkijs.PublicKeyInfo, asn1js: typeof import('asn1js')): KeyInfo {
  const oid = spki.algorithm.algorithmId;
  const keyBytes = bytesOf(spki.subjectPublicKey as unknown as { valueBlock: { valueHexView: Uint8Array } });
  switch (oid) {
    case '1.2.840.113549.1.1.1':
    case '1.2.840.113549.1.1.10': {
      let size: number | null = null;
      let exponent: string | null = null;
      try {
        const k = asn1js.fromBER(keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer);
        const seq = k.result as InstanceType<typeof asn1js.Sequence>;
        const [mod, exp] = seq.valueBlock.value as InstanceType<typeof asn1js.Integer>[];
        size = bitLength(bytesOf(mod));
        const e = bytesOf(exp);
        let v = 0n;
        for (const b of e) v = (v << 8n) | BigInt(b);
        exponent = v.toString();
      } catch {
        /* chiave illeggibile: dimensione ignota */
      }
      return { algorithm: oid === '1.2.840.113549.1.1.10' ? 'RSA-PSS' : 'RSA', oid, size, detail: exponent ? `e=${exponent}` : null };
    }
    case '1.2.840.10045.2.1': {
      const params = spki.algorithm.algorithmParams as { valueBlock?: { toString?: () => string } } | undefined;
      const curveOid = params?.valueBlock?.toString?.() ?? '';
      const curve = CURVES[curveOid];
      return { algorithm: 'EC', oid, size: curve?.bits ?? null, detail: curve?.name ?? (curveOid || null) };
    }
    case '1.3.101.112':
      return { algorithm: 'Ed25519', oid, size: 256, detail: null };
    case '1.3.101.113':
      return { algorithm: 'Ed448', oid, size: 448, detail: null };
    case '1.3.101.110':
      return { algorithm: 'X25519', oid, size: 256, detail: null };
    case '1.3.101.111':
      return { algorithm: 'X448', oid, size: 448, detail: null };
    case '1.2.840.10040.4.1':
      return { algorithm: 'DSA', oid, size: null, detail: null };
    default:
      return { algorithm: oid, oid, size: null, detail: null };
  }
}

function sanEntries(names: Pkijs.GeneralName[]): SanEntry[] {
  const out: SanEntry[] = [];
  for (const n of names) {
    switch (n.type) {
      case 1:
        out.push({ type: 'email', value: str(n.value) });
        break;
      case 2:
        out.push({ type: 'dns', value: str(n.value) });
        break;
      case 6:
        out.push({ type: 'uri', value: str(n.value) });
        break;
      case 7:
        out.push({ type: 'ip', value: formatIp(bytesOf(n.value as unknown as { valueBlock: { valueHexView: Uint8Array } })) });
        break;
      case 4:
        out.push({ type: 'dirName', value: describeName(n.value as Pkijs.RelativeDistinguishedNames).text });
        break;
      case 8:
        out.push({ type: 'registeredID', value: str((n.value as { valueBlock?: { toString?: () => string } }).valueBlock?.toString?.() ?? '') });
        break;
      case 0: {
        const v = n.value as { typeId?: string };
        out.push({ type: 'otherName', value: v.typeId ?? '' });
        break;
      }
      default:
        out.push({ type: 'other', value: '' });
    }
  }
  return out;
}

function keyUsageNames(bits: { valueBlock: { valueHexView: Uint8Array; unusedBits: number } }): string[] {
  const bytes = bits.valueBlock.valueHexView;
  const total = bytes.length * 8 - (bits.valueBlock.unusedBits || 0);
  const names: string[] = [];
  for (let i = 0; i < Math.min(total, KEY_USAGE_NAMES.length); i++) {
    if (bytes[i >> 3] & (0x80 >> (i & 7))) names.push(KEY_USAGE_NAMES[i]);
  }
  return names;
}

interface ExtDetails {
  san: SanEntry[];
  keyUsage: string[];
  extendedKeyUsage: NamedOid[];
  basicConstraints: BasicConstraints | null;
  ski: string | null;
  aki: string | null;
  list: ExtensionInfo[];
}

function describeExtensions(exts: readonly Pkijs.Extension[] | undefined): ExtDetails {
  const d: ExtDetails = { san: [], keyUsage: [], extendedKeyUsage: [], basicConstraints: null, ski: null, aki: null, list: [] };
  for (const e of exts ?? []) {
    d.list.push({ oid: e.extnID, name: EXTENSION_NAMES[e.extnID] ?? e.extnID, critical: !!e.critical });
    const pv = e.parsedValue as unknown;
    if (!pv) continue;
    try {
      switch (e.extnID) {
        case '2.5.29.17':
          d.san = sanEntries((pv as Pkijs.AltName).altNames);
          break;
        case '2.5.29.15':
          d.keyUsage = keyUsageNames(pv as never);
          break;
        case '2.5.29.37':
          d.extendedKeyUsage = (pv as Pkijs.ExtKeyUsage).keyPurposes.map((oid) => ({ oid, name: EKU_NAMES[oid] ?? oid }));
          break;
        case '2.5.29.19': {
          const bc = pv as Pkijs.BasicConstraints;
          d.basicConstraints = { ca: !!bc.cA, pathLen: bc.pathLenConstraint === undefined ? null : Number(bc.pathLenConstraint) };
          break;
        }
        case '2.5.29.14':
          d.ski = toHexColon(bytesOf(pv as never));
          break;
        case '2.5.29.35': {
          const k = (pv as Pkijs.AuthorityKeyIdentifier).keyIdentifier;
          if (k) d.aki = toHexColon(bytesOf(k as never));
          break;
        }
      }
    } catch {
      /* estensione non interpretabile: resta nell'elenco */
    }
  }
  return d;
}

async function sha(algo: 'SHA-1' | 'SHA-256', der: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(algo, der as BufferSource);
  return toHexColon(new Uint8Array(digest));
}

async function fingerprints(der: Uint8Array): Promise<Fingerprints> {
  return { sha1: await sha('SHA-1', der), sha256: await sha('SHA-256', der) };
}

async function describeCertificate(cert: Pkijs.Certificate, der: Uint8Array, now: Date, asn1js: typeof import('asn1js')): Promise<CertInfo> {
  const ext = describeExtensions(cert.extensions);
  const subject = describeName(cert.subject);
  const issuer = describeName(cert.issuer);
  return {
    kind: 'certificate',
    version: cert.version + 1,
    serial: serialHex(bytesOf(cert.serialNumber as never)),
    subject,
    issuer,
    selfSigned: sameName(cert.subject, cert.issuer),
    validity: computeValidity(cert.notBefore.value, cert.notAfter.value, now),
    signature: describeSignature(cert.signatureAlgorithm.algorithmId),
    key: describeKey(cert.subjectPublicKeyInfo, asn1js),
    san: ext.san,
    keyUsage: ext.keyUsage,
    extendedKeyUsage: ext.extendedKeyUsage,
    basicConstraints: ext.basicConstraints,
    ski: ext.ski,
    aki: ext.aki,
    extensions: ext.list,
    fingerprints: await fingerprints(der),
    size: der.length,
  };
}

function sameName(a: Pkijs.RelativeDistinguishedNames, b: Pkijs.RelativeDistinguishedNames): boolean {
  const x = new Uint8Array(a.toSchema().toBER(false));
  const y = new Uint8Array(b.toSchema().toBER(false));
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

async function describeCsr(csr: Pkijs.CertificationRequest, der: Uint8Array, asn1js: typeof import('asn1js')): Promise<CsrInfo> {
  const pkijs = await import('pkijs');
  let exts: readonly Pkijs.Extension[] = [];
  for (const attr of csr.attributes ?? []) {
    if (attr.type === '1.2.840.113549.1.9.14' && attr.values[0]) {
      try {
        exts = new pkijs.Extensions({ schema: attr.values[0] }).extensions;
      } catch {
        /* attributo illeggibile */
      }
    }
  }
  const ext = describeExtensions(exts);
  let signatureValid: boolean | null = null;
  try {
    signatureValid = await csr.verify();
  } catch {
    signatureValid = null;
  }
  return {
    kind: 'csr',
    version: csr.version + 1,
    subject: describeName(csr.subject),
    signature: describeSignature(csr.signatureAlgorithm.algorithmId),
    signatureValid,
    key: describeKey(csr.subjectPublicKeyInfo, asn1js),
    san: ext.san,
    keyUsage: ext.keyUsage,
    extendedKeyUsage: ext.extendedKeyUsage,
    basicConstraints: ext.basicConstraints,
    ski: ext.ski,
    extensions: ext.list,
    fingerprints: await fingerprints(der),
    size: der.length,
  };
}
