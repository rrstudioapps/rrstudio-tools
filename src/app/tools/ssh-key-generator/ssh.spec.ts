// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  buildOpenSshPrivate,
  concat,
  ed25519Supported,
  fingerprintSha256,
  generateSshKey,
  mpint,
  pemWrap,
  publicBlobEd25519,
  publicBlobRsa,
  publicKeyLine,
  seedFromPkcs8,
  sshString,
  u32,
} from './ssh';

const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** Lettore minimale del formato wire per rileggere ciò che il codice produce. */
class Reader {
  pos = 0;
  constructor(readonly b: Uint8Array) {}
  u32(): number {
    const v = ((this.b[this.pos] << 24) | (this.b[this.pos + 1] << 16) | (this.b[this.pos + 2] << 8) | this.b[this.pos + 3]) >>> 0;
    this.pos += 4;
    return v;
  }
  string(): Uint8Array {
    const n = this.u32();
    const s = this.b.subarray(this.pos, this.pos + n);
    this.pos += n;
    return s;
  }
  text(): string {
    return new TextDecoder().decode(this.string());
  }
  bytes(n: number): Uint8Array {
    const s = this.b.subarray(this.pos, this.pos + n);
    this.pos += n;
    return s;
  }
  get rest(): number {
    return this.b.length - this.pos;
  }
}

/** Riga reale prodotta da \`ssh-keygen -t ed25519\` e la sua impronta secondo \`ssh-keygen -l\`. */
const KNOWN_LINE = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ+aLywe39JR2bn8klMDW9KJB6joqltQFp3aWH6llh5u test@example';
const KNOWN_FINGERPRINT = 'SHA256:PTa4RgpABQATxffcQoyrts98bI+S/V/g2/r4fOlLowg';

function pemBody(pem: string, label: string): Uint8Array {
  const m = pem.match(new RegExp(`^-----BEGIN ${label}-----\\n([A-Za-z0-9+/=\\n]+)\\n-----END ${label}-----\\n$`));
  expect(m).not.toBeNull();
  return fromB64(m![1].replace(/\n/g, ''));
}

describe('formato wire', () => {
  it('string: lunghezza a 32 bit e byte', () => {
    expect(hex(sshString('ssh-rsa'))).toBe('000000077373682d727361');
    expect(hex(sshString(new Uint8Array(0)))).toBe('00000000');
    expect(hex(u32(0x01020304))).toBe('01020304');
  });
  it('mpint: esempi dell\'RFC 4251', () => {
    expect(hex(mpint(new Uint8Array(0)))).toBe('00000000');
    expect(hex(mpint(Uint8Array.from([0x09, 0xa3, 0x78, 0xf9, 0xb2, 0xe3, 0x32, 0xa7])))).toBe('0000000809a378f9b2e332a7');
    expect(hex(mpint(Uint8Array.from([0x80])))).toBe('000000020080');
  });
  it('mpint toglie gli zeri iniziali e aggiunge lo 0x00 solo se serve', () => {
    expect(hex(mpint(Uint8Array.from([0, 0, 0x7f])))).toBe('000000017f');
    expect(hex(mpint(Uint8Array.from([0, 0xff])))).toBe('0000000200ff');
    expect(hex(mpint(Uint8Array.from([0, 0, 0])))).toBe('00000000');
  });
  it('blob pubblico RSA ed Ed25519', () => {
    const rsa = publicBlobRsa(Uint8Array.from([1, 0, 1]), Uint8Array.from([0xc0, 0x01]));
    expect(hex(rsa)).toBe('000000077373682d727361' + '00000003010001' + '0000000300c001');
    const ed = publicBlobEd25519(new Uint8Array(32).fill(7));
    expect(ed.length).toBe(4 + 11 + 4 + 32);
  });
});

describe('riga pubblica e impronta', () => {
  it('ricostruisce la riga e l\'impronta di una chiave vera', async () => {
    const [type, b64, comment] = KNOWN_LINE.split(' ');
    const blob = fromB64(b64);
    const r = new Reader(blob);
    expect(r.text()).toBe('ssh-ed25519');
    const pub = r.string();
    expect(pub.length).toBe(32);
    expect(r.rest).toBe(0);
    expect(publicBlobEd25519(pub)).toEqual(blob);
    expect(publicKeyLine(type, publicBlobEd25519(pub), comment)).toBe(KNOWN_LINE);
    expect(await fingerprintSha256(blob)).toBe(KNOWN_FINGERPRINT);
  });
  it('il commento è opzionale e senza a capo', () => {
    expect(publicKeyLine('ssh-rsa', Uint8Array.of(1), '')).toBe('ssh-rsa AQ==');
    expect(publicKeyLine('ssh-rsa', Uint8Array.of(1), 'a\nb')).toBe('ssh-rsa AQ== a b');
  });
});

describe('pemWrap', () => {
  it('righe alla larghezza data', () => {
    const pem = pemWrap('OPENSSH PRIVATE KEY', new Uint8Array(100).fill(1), 70);
    const lines = pem.trimEnd().split('\n');
    expect(lines[0]).toBe('-----BEGIN OPENSSH PRIVATE KEY-----');
    expect(lines.at(-1)).toBe('-----END OPENSSH PRIVATE KEY-----');
    expect(Math.max(...lines.slice(1, -1).map((l) => l.length))).toBe(70);
  });
});

describe('openssh-key-v1', () => {
  it('struttura del contenitore con la chiave pubblica nota', () => {
    const pub = fromB64(KNOWN_LINE.split(' ')[1]);
    const seed = new Uint8Array(32).fill(9);
    const edPub = new Reader(pub);
    edPub.string();
    const raw = edPub.string();
    const fields = concat(sshString('ssh-ed25519'), sshString(raw), sshString(concat(seed, raw)));
    const file = buildOpenSshPrivate(pub, fields, 'test@example', 0xdeadbeef);
    const r = new Reader(file);
    expect(new TextDecoder().decode(r.bytes(15))).toBe('openssh-key-v1\0');
    expect(r.text()).toBe('none');
    expect(r.text()).toBe('none');
    expect(r.string().length).toBe(0);
    expect(r.u32()).toBe(1);
    expect(r.string()).toEqual(pub);
    const priv = new Reader(r.string());
    expect(r.rest).toBe(0);
    expect(priv.b.length % 8).toBe(0);
    expect(priv.u32()).toBe(0xdeadbeef);
    expect(priv.u32()).toBe(0xdeadbeef);
    expect(priv.text()).toBe('ssh-ed25519');
    expect(priv.string()).toEqual(raw);
    expect(priv.string()).toEqual(concat(seed, raw));
    expect(priv.text()).toBe('test@example');
    // riempimento 1, 2, 3…
    const pad = priv.bytes(priv.rest);
    expect(Array.from(pad)).toEqual(Array.from({ length: pad.length }, (_, i) => i + 1));
    expect(pad.length).toBeLessThan(8);
  });
});

describe('generazione', () => {
  it('Ed25519: riga pubblica, impronta, seed e struttura coerenti', async () => {
    expect(await ed25519Supported()).toBe(true);
    const k = await generateSshKey('ed25519', 'me@host', 0x01020304);
    expect(k.publicKey.startsWith('ssh-ed25519 ')).toBe(true);
    expect(k.publicKey.endsWith(' me@host')).toBe(true);
    const blob = fromB64(k.publicKey.split(' ')[1]);
    expect(await fingerprintSha256(blob)).toBe(k.fingerprint);
    const outer = new Reader(pemBody(k.privateOpenSsh, 'OPENSSH PRIVATE KEY'));
    outer.bytes(15);
    outer.string();
    outer.string();
    outer.string();
    outer.u32();
    expect(outer.string()).toEqual(blob);
    const priv = new Reader(outer.string());
    expect(priv.u32()).toBe(0x01020304);
    priv.u32();
    priv.string();
    const pub = priv.string();
    const seedPub = priv.string();
    expect(seedPub.subarray(32)).toEqual(pub);
    const pkcs8 = pemBody(k.privatePkcs8, 'PRIVATE KEY');
    expect(seedFromPkcs8(pkcs8)).toEqual(seedPub.subarray(0, 32));
    expect(k.privatePkcs8.split('\n')[1].length).toBe(64);
  });

  it('RSA 2048: n ed e nel blob, numeri nella chiave privata, impronta', async () => {
    const k = await generateSshKey('rsa-2048', '', 5);
    expect(k.publicKey.startsWith('ssh-rsa ')).toBe(true);
    expect(k.publicKey.split(' ').length).toBe(2);
    const blob = fromB64(k.publicKey.split(' ')[1]);
    const pub = new Reader(blob);
    expect(pub.text()).toBe('ssh-rsa');
    expect(Array.from(pub.string())).toEqual([1, 0, 1]);
    const n = pub.string();
    expect(n[0]).toBe(0); // 2048 bit con il bit alto a 1: serve lo 0x00 davanti
    expect(n.length).toBe(257);
    expect(await fingerprintSha256(blob)).toBe(k.fingerprint);
    const outer = new Reader(pemBody(k.privateOpenSsh, 'OPENSSH PRIVATE KEY'));
    outer.bytes(15);
    outer.string();
    outer.string();
    outer.string();
    outer.u32();
    outer.string();
    const priv = new Reader(outer.string());
    expect(priv.u32()).toBe(5);
    expect(priv.u32()).toBe(5);
    expect(priv.text()).toBe('ssh-rsa');
    expect(priv.string()).toEqual(n);
    expect(Array.from(priv.string())).toEqual([1, 0, 1]);
    for (let i = 0; i < 4; i++) expect(priv.string().length).toBeGreaterThan(100); // d, iqmp, p, q
    expect(priv.text()).toBe('');
    expect(pemBody(k.privatePkcs8, 'PRIVATE KEY').length).toBeGreaterThan(1000);
  });
});
