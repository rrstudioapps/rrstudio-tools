// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  CryptError,
  HEADER_BYTES,
  IV_BYTES,
  MAGIC,
  MIN_FILE_BYTES,
  PBKDF2_ITERATIONS,
  SALT_BYTES,
  TAG_BYTES,
  buildHeader,
  decrypt,
  decryptText,
  decryptedName,
  encrypt,
  encryptParts,
  encryptText,
  encryptedName,
  fromBase64,
  parseHeader,
  toBase64,
} from './crypt';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);
const PW = 'correct horse battery staple';

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof CryptError ? e.code : 'other:' + String(e);
  }
}

describe('formato', () => {
  it('l\'intestazione è lunga 38 byte e il file contiene corpo + tag da 16', async () => {
    expect(HEADER_BYTES).toBe(38);
    const out = await encrypt(enc('ciao'), PW);
    expect(out.length).toBe(HEADER_BYTES + 4 + TAG_BYTES);
    expect(dec(out.subarray(0, 5))).toBe('RRENC');
    expect(out[5]).toBe(1);
    expect(new DataView(out.buffer).getUint32(6)).toBe(PBKDF2_ITERATIONS);
  });
  it('salt e iv sono casuali: due cifrature dello stesso testo sono diverse', async () => {
    const a = await encrypt(enc('uguale'), PW);
    const b = await encrypt(enc('uguale'), PW);
    expect(a.slice(10, 26)).not.toEqual(b.slice(10, 26));
    expect(a.slice(26, 38)).not.toEqual(b.slice(26, 38));
    expect(a).not.toEqual(b);
  });
  it('buildHeader e parseHeader sono inversi', () => {
    const salt = Uint8Array.from({ length: SALT_BYTES }, (_, i) => i);
    const iv = Uint8Array.from({ length: IV_BYTES }, (_, i) => 100 + i);
    const h = buildHeader(700000, salt, iv);
    expect(h.length).toBe(HEADER_BYTES);
    const p = parseHeader(h.length >= MIN_FILE_BYTES ? h : new Uint8Array([...h, ...new Uint8Array(TAG_BYTES)]));
    expect(p).toMatchObject({ version: 1, iterations: 700000 });
    expect(Array.from(p.salt)).toEqual(Array.from(salt));
    expect(Array.from(p.iv)).toEqual(Array.from(iv));
  });
  it('encryptParts separa intestazione e corpo', async () => {
    const { header, body } = await encryptParts(enc('abc'), PW);
    expect(header.length).toBe(HEADER_BYTES);
    expect(body.length).toBe(3 + TAG_BYTES);
  });
});

describe('andata e ritorno', () => {
  it('testo breve, vuoto e Unicode', async () => {
    for (const t of ['', 'a', 'Perché però è così! 日本語 🔐', 'riga 1\nriga 2\r\n'.repeat(100)]) {
      const out = await encrypt(enc(t), PW);
      expect(dec(await decrypt(out, PW))).toBe(t);
    }
  });
  it('byte arbitrari, anche 1 MiB', async () => {
    const data = new Uint8Array(1024 * 1024);
    for (let i = 0; i < data.length; i += 65536) crypto.getRandomValues(data.subarray(i, i + 65536));
    const out = await encrypt(data, PW);
    const back = await decrypt(out, PW);
    expect(back.length).toBe(data.length);
    expect(Buffer.compare(Buffer.from(back), Buffer.from(data))).toBe(0);
  });
  it('la passphrase è normalizzata NFC (é composta = e + accento)', async () => {
    const out = await encrypt(enc('segreto'), 'caffè');
    expect(dec(await decrypt(out, 'caffè'))).toBe('segreto');
  });
  it('testo in Base64', async () => {
    const b64 = await encryptText('messaggio riservato', PW);
    expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(await decryptText(b64, PW)).toBe('messaggio riservato');
    // con spazi e a capo incollati dalla email
    const wrapped = b64.replace(/(.{40})/g, '$1\n  ');
    expect(await decryptText(wrapped, PW)).toBe('messaggio riservato');
  });
});

describe('errori e manomissione', () => {
  it('passphrase sbagliata', async () => {
    const out = await encrypt(enc('dati'), PW);
    expect(await code(decrypt(out, PW + '!'))).toBe('auth');
    expect(await code(decrypt(out, 'Correct horse battery staple'))).toBe('auth');
  });
  it('passphrase vuota, in cifratura e in decifratura', async () => {
    expect(await code(encrypt(enc('x'), ''))).toBe('empty-password');
    const out = await encrypt(enc('x'), PW);
    expect(await code(decrypt(out, ''))).toBe('empty-password');
  });
  it('un bit cambiato nel testo cifrato, nel tag, nel salt, nell\'IV o nella versione fa fallire', async () => {
    const out = await encrypt(enc('contenuto importante da proteggere'), PW);
    const positions = [HEADER_BYTES, HEADER_BYTES + 5, out.length - 1, out.length - TAG_BYTES, 12, 30];
    for (const pos of positions) {
      const bad = out.slice();
      bad[pos] ^= 0x01;
      expect(await code(decrypt(bad, PW)), `posizione ${pos}`).toBe('auth');
    }
    const v = out.slice();
    v[5] = 2;
    expect(await code(decrypt(v, PW))).toBe('version');
  });
  it('le iterazioni modificate nell\'intestazione sono rifiutate o fanno fallire', async () => {
    const out = await encrypt(enc('x'), PW);
    const low = out.slice();
    new DataView(low.buffer).setUint32(6, 1000);
    expect(await code(decrypt(low, PW))).toBe('params');
    const high = out.slice();
    new DataView(high.buffer).setUint32(6, 0xffffffff);
    expect(await code(decrypt(high, PW))).toBe('params');
  });
  it('file troncato o aggiungendo byte', async () => {
    const out = await encrypt(enc('contenuto'), PW);
    expect(await code(decrypt(out.subarray(0, out.length - 1), PW))).toBe('auth');
    expect(await code(decrypt(new Uint8Array([...out, 0]), PW))).toBe('auth');
    expect(await code(decrypt(out.subarray(0, 20), PW))).toBe('truncated');
    expect(await code(decrypt(out.subarray(0, HEADER_BYTES), PW))).toBe('truncated');
  });
  it('un file che non è nostro', async () => {
    expect(await code(decrypt(enc('%PDF-1.7 non cifrato ma lungo abbastanza per superare la soglia'), PW))).toBe('not-encrypted');
    expect(await code(decrypt(new Uint8Array(0), PW))).toBe('not-encrypted');
    expect(MAGIC.length).toBe(5);
  });
  it('iterazioni sotto il minimo in cifratura', async () => {
    expect(await code(encrypt(enc('x'), PW, { iterations: 1000 }))).toBe('params');
  });
  it('Base64 non valido', async () => {
    expect(await code(decryptText('', PW))).toBe('base64');
    expect(await code(decryptText('questo non è base64!', PW))).toBe('base64');
    expect(await code(decryptText('QUJD', PW))).toBe('not-encrypted');
  });
  it('fromBase64 e toBase64', () => {
    expect(toBase64(enc('abc'))).toBe('YWJj');
    expect(dec(fromBase64('YW Jj\n'))).toBe('abc');
    expect(Array.from(fromBase64('-_-_'))).toEqual([0xfb, 0xff, 0xbf]);
    const big = crypto.getRandomValues(new Uint8Array(60_000));
    expect(Array.from(fromBase64(toBase64(big)))).toEqual(Array.from(big));
  });
});

describe('nomi dei file', () => {
  it('aggiunge e toglie l\'estensione', () => {
    expect(encryptedName('relazione.pdf')).toBe('relazione.pdf.rrenc');
    expect(decryptedName('relazione.pdf.rrenc')).toBe('relazione.pdf');
    expect(decryptedName('RELAZIONE.PDF.RRENC')).toBe('RELAZIONE.PDF');
    expect(decryptedName('misterioso.bin')).toBe('misterioso.bin.dec');
    expect(decryptedName('.rrenc')).toBe('.rrenc.dec');
  });
});
