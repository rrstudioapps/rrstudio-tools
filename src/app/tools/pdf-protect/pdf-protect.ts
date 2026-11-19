// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { PDFArray, PDFDict, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString } from 'pdf-lib';
import type { PDFObject } from 'pdf-lib';
import { PRODUCER, openForEdit } from '../pdf-common/pdf-file';

/**
 * Protegge un PDF con una password: cifratura AES a 256 bit (PDF 2.0, gestore standard V5 R6) con le funzioni crittografiche
 * del browser (Web Crypto). Si può chiedere la password per aprire il file e/o limitare stampa, copia e modifica con la
 * password del proprietario. pdf-lib non cifra: si riscrive il file senza flussi di oggetti, si cifrano a mano tutte le stringhe e
 * i flussi e si aggiunge il dizionario Encrypt. I limiti (stampa, copia…) li rispettano i lettori ma non sono una barriera tecnica.
 */

export interface Permissions {
  print: boolean;
  copy: boolean;
  modify: boolean;
  annotate: boolean;
}

export interface ProtectOptions {
  /** Password per aprire il file ("" = il file si apre senza password, ma con i limiti). */
  userPassword: string;
  /** Password del proprietario (toglie i limiti). Se vuota se ne usa una casuale che non viene mostrata. */
  ownerPassword: string;
  allow: Permissions;
}

export const ALL_ALLOWED: Permissions = { print: true, copy: true, modify: true, annotate: true };

const subtle = (): SubtleCrypto => globalThis.crypto.subtle;
const rand = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));
const enc = new TextEncoder();
const cat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

/** AES-CBC senza padding: Web Crypto aggiunge sempre un blocco di padding, che qui si scarta. */
async function aesCbcNoPad(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await subtle().importKey('raw', key as BufferSource, 'AES-CBC', false, ['encrypt']);
  const out = new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv: iv as BufferSource }, k, data as BufferSource));
  return out.subarray(0, data.length);
}

/** AES-CBC con padding PKCS#7 e IV casuale messo davanti (formato di stringhe e flussi cifrati nel PDF). */
async function aesObject(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const iv = rand(16);
  const body = new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv: iv as BufferSource }, key, data as BufferSource));
  return cat(iv, body);
}

async function sha(bits: 256 | 384 | 512, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest(`SHA-${bits}`, data as BufferSource));
}

/** Algoritmo 2.B di ISO 32000-2: l'impronta della password per R6. */
export async function hashR6(password: Uint8Array, salt: Uint8Array, udata: Uint8Array): Promise<Uint8Array> {
  let k = await sha(256, cat(password, salt, udata));
  for (let i = 0; ; i++) {
    const unit = cat(password, k, udata);
    const k1 = new Uint8Array(unit.length * 64);
    for (let r = 0; r < 64; r++) k1.set(unit, r * unit.length);
    const e = await aesCbcNoPad(k.subarray(0, 16), k.subarray(16, 32), k1);
    let mod = 0;
    for (let j = 0; j < 16; j++) mod += e[j];
    k = await sha(([256, 384, 512] as const)[mod % 3], e);
    if (i >= 63 && e[e.length - 1] <= i - 32) break;
  }
  return k.subarray(0, 32);
}

const utf8Password = (p: string): Uint8Array => enc.encode(p.normalize('NFKC')).subarray(0, 127);

/** Valore P: bit di permesso (3 stampa, 4 modifica, 5 copia, 6 annotazioni, 9 moduli, 10 accessibilità, 11 assemblaggio, 12 stampa fedele). */
export function permissionBits(a: Permissions): number {
  let p = 0xfffff0c0; // bit riservati a 1
  if (a.print) p |= (1 << 2) | (1 << 11);
  if (a.modify) p |= (1 << 3) | (1 << 10);
  if (a.copy) p |= 1 << 4;
  if (a.annotate) p |= (1 << 5) | (1 << 8);
  p |= 1 << 9; // lettura per l'accessibilità: sempre consentita
  return p | 0; // intero con segno a 32 bit
}

export interface EncryptEntries {
  O: Uint8Array;
  U: Uint8Array;
  OE: Uint8Array;
  UE: Uint8Array;
  Perms: Uint8Array;
  P: number;
  fileKey: Uint8Array;
}

/** Voci del dizionario Encrypt e chiave del file (esportata per i test). */
export async function makeEntries(o: ProtectOptions, fileKey = rand(32)): Promise<EncryptEntries> {
  const userPw = utf8Password(o.userPassword);
  const ownerPw = utf8Password(o.ownerPassword !== '' ? o.ownerPassword : crypto.randomUUID());
  const empty = new Uint8Array(0);
  const zeroIv = new Uint8Array(16);
  const uVal = rand(8);
  const uKey = rand(8);
  const U = cat(await hashR6(userPw, uVal, empty), uVal, uKey);
  const UE = await aesCbcNoPad(await hashR6(userPw, uKey, empty), zeroIv, fileKey);
  const oVal = rand(8);
  const oKey = rand(8);
  const O = cat(await hashR6(ownerPw, oVal, U), oVal, oKey);
  const OE = await aesCbcNoPad(await hashR6(ownerPw, oKey, U), zeroIv, fileKey);
  const P = permissionBits(o.allow);
  const perms = new Uint8Array(16);
  new DataView(perms.buffer).setUint32(0, P >>> 0, true);
  perms.set([0xff, 0xff, 0xff, 0xff, 0x54, 0x61, 0x64, 0x62], 4); // «FFFFFFFF», T (metadati cifrati), «adb»
  perms.set(rand(4), 12);
  return { O, U, OE, UE, Perms: await aesCbcNoPad(fileKey, zeroIv, perms), P, fileKey };
}

/** Controlla la password dell'utente contro la voce U (R6): vero se è quella giusta. */
export async function checkUserPassword(password: string, U: Uint8Array): Promise<boolean> {
  const h = await hashR6(utf8Password(password), U.subarray(32, 40), new Uint8Array(0));
  return h.every((b, i) => b === U[i]);
}

async function encryptObject(key: CryptoKey, o: PDFObject): Promise<PDFObject> {
  if (o instanceof PDFString || o instanceof PDFHexString) {
    return PDFHexString.of(toHex(await aesObject(key, o.asBytes())));
  }
  if (o instanceof PDFArray) {
    for (let i = 0; i < o.size(); i++) o.set(i, await encryptObject(key, o.get(i)));
    return o;
  }
  if (o instanceof PDFRawStream) {
    await encryptDict(key, o.dict);
    return PDFRawStream.of(o.dict, await aesObject(key, o.getContents()));
  }
  if (o instanceof PDFDict) {
    await encryptDict(key, o);
    return o;
  }
  return o;
}

async function encryptDict(key: CryptoKey, d: PDFDict): Promise<void> {
  for (const [name, v] of d.entries()) {
    if (v instanceof PDFRef || v instanceof PDFName || v instanceof PDFNumber) continue;
    d.set(name, await encryptObject(key, v));
  }
}

const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export type ProtectResult = { ok: true; bytes: Uint8Array } | { ok: false; error: 'noPassword' | 'build' };

export async function protectPdf(bytes: Uint8Array, o: ProtectOptions): Promise<ProtectResult> {
  const restricted = !(o.allow.print && o.allow.copy && o.allow.modify && o.allow.annotate);
  if (o.userPassword === '' && !restricted) return { ok: false, error: 'noPassword' };
  try {
    // 1. riscrive il file in forma semplice (niente flussi di oggetti) e lo rilegge: tutti gli oggetti sono diretti
    const first = await openForEdit(bytes);
    first.setProducer(PRODUCER);
    first.setCreator(PRODUCER);
    const plain = await first.save({ useObjectStreams: false });
    const doc = await openForEdit(plain);
    const entries = await makeEntries(o);
    const key = await subtle().importKey('raw', entries.fileKey as BufferSource, 'AES-CBC', false, ['encrypt']);
    // 2. cifra stringhe e flussi di tutti gli oggetti
    for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
      if (obj instanceof PDFRawStream && (obj.dict.get(PDFName.of('Type')) as PDFName | undefined)?.toString() === '/XRef') continue;
      const out = await encryptObject(key, obj);
      if (out !== obj) doc.context.assign(ref, out);
    }
    // 3. dizionario Encrypt (le sue stringhe non si cifrano) e identificativo del file
    const ctx = doc.context;
    const dict = ctx.obj({
      Filter: 'Standard',
      V: 5,
      R: 6,
      Length: 256,
      CF: { StdCF: { AuthEvent: 'DocOpen', CFM: 'AESV3', Length: 32 } },
      StmF: 'StdCF',
      StrF: 'StdCF',
      EncryptMetadata: true,
      P: entries.P,
    });
    dict.set(PDFName.of('O'), PDFHexString.of(toHex(entries.O)));
    dict.set(PDFName.of('U'), PDFHexString.of(toHex(entries.U)));
    dict.set(PDFName.of('OE'), PDFHexString.of(toHex(entries.OE)));
    dict.set(PDFName.of('UE'), PDFHexString.of(toHex(entries.UE)));
    dict.set(PDFName.of('Perms'), PDFHexString.of(toHex(entries.Perms)));
    ctx.trailerInfo.Encrypt = ctx.register(dict);
    const id = PDFHexString.of(toHex(rand(16)));
    ctx.trailerInfo.ID = ctx.obj([id, id]);
    return { ok: true, bytes: await doc.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false }) };
  } catch {
    return { ok: false, error: 'build' };
  }
}
