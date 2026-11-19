// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Tipi di chiave offerti. */
export type SshKeyKind = 'ed25519' | 'rsa-2048' | 'rsa-3072' | 'rsa-4096';
export const SSH_KEY_KINDS: readonly SshKeyKind[] = ['ed25519', 'rsa-2048', 'rsa-3072', 'rsa-4096'];

/** Componenti di una chiave RSA, interi senza segno in big-endian. */
export interface RsaParts {
  n: Uint8Array;
  e: Uint8Array;
  d: Uint8Array;
  p: Uint8Array;
  q: Uint8Array;
  /** Coefficiente CRT: q^-1 mod p (`iqmp` in OpenSSH, `qi` in JWK). */
  qi: Uint8Array;
}

export interface GeneratedSshKey {
  kind: SshKeyKind;
  /** Tipo come appare nella riga pubblica: ssh-ed25519 o ssh-rsa. */
  type: 'ssh-ed25519' | 'ssh-rsa';
  /** Riga per authorized_keys / id_xxx.pub. */
  publicKey: string;
  /** Chiave privata in formato OpenSSH (non cifrata), PEM. */
  privateOpenSsh: string;
  /** Chiave privata PKCS#8, PEM. */
  privatePkcs8: string;
  /** Impronta SHA256 come la mostra `ssh-keygen -l`. */
  fingerprint: string;
  /** Lunghezza in bit. */
  bits: number;
}

const enc = new TextEncoder();

// ---------- formato "wire" di SSH (RFC 4251) ----------

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function u32(n: number): Uint8Array {
  return Uint8Array.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

/** `string`: lunghezza a 32 bit big-endian + byte. */
export function sshString(data: Uint8Array | string): Uint8Array {
  const b = typeof data === 'string' ? enc.encode(data) : data;
  return concat(u32(b.length), b);
}

/** `mpint`: intero senza segno in complemento a due: senza zeri iniziali e con uno 0x00 davanti se il primo bit è 1. */
export function mpint(value: Uint8Array): Uint8Array {
  let i = 0;
  while (i < value.length && value[i] === 0) i++;
  const v = value.subarray(i);
  if (v.length === 0) return u32(0);
  return v[0] & 0x80 ? sshString(concat(Uint8Array.of(0), v)) : sshString(v);
}

export function publicBlobEd25519(pub: Uint8Array): Uint8Array {
  return concat(sshString('ssh-ed25519'), sshString(pub));
}

export function publicBlobRsa(e: Uint8Array, n: Uint8Array): Uint8Array {
  return concat(sshString('ssh-rsa'), mpint(e), mpint(n));
}

// ---------- codifiche ----------

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64Url(text: string): Uint8Array {
  const s = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

/** PEM con le righe a `width` colonne (64 per PKCS#8, 70 per OpenSSH). */
export function pemWrap(label: string, der: Uint8Array, width: number): string {
  const b64 = toBase64(der);
  const lines = b64.match(new RegExp(`.{1,${width}}`, 'g')) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

/** Riga di una chiave pubblica: `tipo base64 commento`. */
export function publicKeyLine(type: string, blob: Uint8Array, comment: string): string {
  const c = comment.replace(/[\r\n]+/g, ' ').trim();
  return `${type} ${toBase64(blob)}${c ? ' ' + c : ''}`;
}

/** Impronta `SHA256:…` (Base64 senza padding dello SHA-256 del blob pubblico), come `ssh-keygen -l`. */
export async function fingerprintSha256(blob: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', blob as BufferSource));
  return 'SHA256:' + toBase64(digest).replace(/=+$/, '');
}

// ---------- chiave privata openssh-key-v1 ----------

const AUTH_MAGIC = enc.encode('openssh-key-v1\0');

/**
 * Costruisce il file `openssh-key-v1` senza cifratura (cifratura "none", KDF "none"): magic, cifrario, KDF, opzioni,
 * numero di chiavi, blob pubblico e sezione privata (due numeri di controllo uguali, campi della chiave, commento,
 * riempimento 1,2,3… fino a un multiplo di 8).
 */
export function buildOpenSshPrivate(publicBlob: Uint8Array, privateFields: Uint8Array, comment: string, check: number): Uint8Array {
  const body = concat(u32(check), u32(check), privateFields, sshString(comment));
  const padLen = (8 - (body.length % 8)) % 8;
  const padding = Uint8Array.from({ length: padLen }, (_, i) => i + 1);
  return concat(AUTH_MAGIC, sshString('none'), sshString('none'), sshString(''), u32(1), sshString(publicBlob), sshString(concat(body, padding)));
}

export function opensshEd25519Fields(seed: Uint8Array, pub: Uint8Array): Uint8Array {
  return concat(sshString('ssh-ed25519'), sshString(pub), sshString(concat(seed, pub)));
}

export function opensshRsaFields(k: RsaParts): Uint8Array {
  return concat(sshString('ssh-rsa'), mpint(k.n), mpint(k.e), mpint(k.d), mpint(k.qi), mpint(k.p), mpint(k.q));
}

function randomCheck(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

// ---------- generazione ----------

let ed25519Probe: Promise<boolean> | undefined;

/** Vero se il browser genera chiavi Ed25519 con WebCrypto (provato una volta con una chiave vera). */
export function ed25519Supported(): Promise<boolean> {
  ed25519Probe ??= (async () => {
    try {
      const k = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
      return k.privateKey.type === 'private';
    } catch {
      return false;
    }
  })();
  return ed25519Probe;
}

/** I 32 byte del seed Ed25519 dentro un PKCS#8 (il seed è negli ultimi 32 byte: prefisso fisso di 16 byte). */
export function seedFromPkcs8(pkcs8: Uint8Array): Uint8Array {
  if (pkcs8.length !== 48) throw new Error('pkcs8-ed25519');
  return pkcs8.slice(16);
}

export async function generateSshKey(kind: SshKeyKind, comment: string, check: number = randomCheck()): Promise<GeneratedSshKey> {
  const subtle = crypto.subtle;
  if (kind === 'ed25519') {
    const pair = (await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const pub = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
    const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey));
    const blob = publicBlobEd25519(pub);
    return {
      kind,
      type: 'ssh-ed25519',
      publicKey: publicKeyLine('ssh-ed25519', blob, comment),
      privateOpenSsh: pemWrap('OPENSSH PRIVATE KEY', buildOpenSshPrivate(blob, opensshEd25519Fields(seedFromPkcs8(pkcs8), pub), comment, check), 70),
      privatePkcs8: pemWrap('PRIVATE KEY', pkcs8, 64),
      fingerprint: await fingerprintSha256(blob),
      bits: 256,
    };
  }
  const bits = Number(kind.slice(4));
  const pair = (await subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: bits, publicExponent: Uint8Array.of(1, 0, 1), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = await subtle.exportKey('jwk', pair.privateKey);
  const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey));
  const parts: RsaParts = {
    n: fromBase64Url(jwk.n!),
    e: fromBase64Url(jwk.e!),
    d: fromBase64Url(jwk.d!),
    p: fromBase64Url(jwk.p!),
    q: fromBase64Url(jwk.q!),
    qi: fromBase64Url(jwk.qi!),
  };
  const blob = publicBlobRsa(parts.e, parts.n);
  return {
    kind,
    type: 'ssh-rsa',
    publicKey: publicKeyLine('ssh-rsa', blob, comment),
    privateOpenSsh: pemWrap('OPENSSH PRIVATE KEY', buildOpenSshPrivate(blob, opensshRsaFields(parts), comment, check), 70),
    privatePkcs8: pemWrap('PRIVATE KEY', pkcs8, 64),
    fingerprint: await fingerprintSha256(blob),
    bits,
  };
}
