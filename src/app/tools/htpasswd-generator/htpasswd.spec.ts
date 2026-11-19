// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  apr1,
  bcryptHash,
  clampCost,
  detectType,
  hashPassword,
  makeLine,
  parseLine,
  passwordBytes,
  randomSalt,
  sha1Hash,
  validateUser,
  verifyLine,
} from './htpasswd';

// Vettori prodotti da `openssl passwd -apr1 -salt <salt> -- <password>` (OpenSSL 3.0.13)
const APR1_VECTORS: [string, string, string][] = [
  ['password', 'salt1234', '$apr1$salt1234$k3J5yKYW6TlGmTytnkXbQ0'],
  ['mypass', 'abcdefgh', '$apr1$abcdefgh$2HYzPOWvxrgYQAhO/cIsi0'],
  ['x', 'Zz9./abc', '$apr1$Zz9./abc$/L5e4cds2YDP19pw.pUUn.'],
  ['a-very-long-password-longer-than-16-bytes-for-sure', '12345678', '$apr1$12345678$CWQdYiZLEphKnEbwtko4Y1'],
  ['pässwörd', 'saltsalt', '$apr1$saltsalt$i5XfNxJNeh2E8ljXycZFm0'],
  ['', 'ab', '$apr1$ab$S8K6Sgp3W8c9Jb6LxgywZ.'],
  ['1234567890123456', 'xyz', '$apr1$xyz$pz8wDC6ysJzI.dA.jMuU0.'],
  ['x', 'abcdefgh12345', '$apr1$abcdefgh$82JubPF2dQkt1tVfvLnXS.'], // il salt oltre 8 caratteri viene troncato
];

// bcrypt prodotto da Python (libreria bcrypt) per la password "secret", costo 5
const BCRYPT_2B = '$2b$05$zkV.jrD88Nql7onyzvirsuXp0Kvj4/2dtiGyOtihJ5YL6cBoxLKMW';
const BCRYPT_2Y = '$2y$05$zkV.jrD88Nql7onyzvirsuXp0Kvj4/2dtiGyOtihJ5YL6cBoxLKMW';

describe('APR1-MD5', () => {
  it.each(APR1_VECTORS)('password %j con salt %j come openssl', (pw, salt, expected) => {
    expect(apr1(pw, salt)).toBe(expected);
  });
  it('accetta anche byte', () => {
    expect(apr1(new TextEncoder().encode('password'), 'salt1234')).toBe(APR1_VECTORS[0][2]);
  });
});

describe('SHA1', () => {
  it('vettore noto', async () => {
    expect(await sha1Hash('secret')).toBe('{SHA}5en6G6MezRroT3XKqkdPOmY/BfQ=');
    expect(await sha1Hash('')).toBe('{SHA}2jmj7l5rSw0yVb/vlWAYkK/YBwk=');
  });
});

describe('bcrypt', () => {
  it('scrive il prefisso $2y$ con il costo scelto', async () => {
    const h = await bcryptHash('prova', 4);
    expect(h).toMatch(/^\$2y\$04\$[./A-Za-z0-9]{53}$/);
  });
  it('due hash della stessa password sono diversi (salt)', async () => {
    expect(await bcryptHash('prova', 4)).not.toBe(await bcryptHash('prova', 4));
  });
  it('limita il costo', async () => {
    expect(clampCost(1)).toBe(4);
    expect(clampCost(99)).toBe(14);
    expect(clampCost(NaN)).toBe(10);
    expect(await bcryptHash('a', 1)).toMatch(/^\$2y\$04\$/);
  });
  it('verifica un hash prodotto da un\'altra implementazione', async () => {
    for (const line of [`u:${BCRYPT_2B}`, `u:${BCRYPT_2Y}`]) {
      expect(await verifyLine(line, 'secret')).toMatchObject({ ok: true, match: true, type: 'bcrypt', cost: 5 });
      expect(await verifyLine(line, 'Secret')).toMatchObject({ ok: true, match: false });
    }
  });
});

describe('salt', () => {
  it('8 caratteri dell\'alfabeto di crypt', () => {
    for (let i = 0; i < 50; i++) expect(randomSalt()).toMatch(/^[./0-9A-Za-z]{8}$/);
    expect(randomSalt(4)).toHaveLength(4);
  });
  it('è casuale', () => {
    expect(new Set(Array.from({ length: 20 }, () => randomSalt())).size).toBe(20);
  });
});

describe('makeLine', () => {
  it('apr1', async () => {
    const r = await makeLine('mario', 'pw', 'apr1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.line).toMatch(/^mario:\$apr1\$[./0-9A-Za-z]{8}\$[./0-9A-Za-z]{22}$/);
  });
  it('sha1', async () => {
    expect(await makeLine('u', 'secret', 'sha1')).toEqual({ ok: true, line: 'u:{SHA}5en6G6MezRroT3XKqkdPOmY/BfQ=' });
  });
  it('bcrypt', async () => {
    const r = await makeLine('u', 'pw', 'bcrypt', 4);
    expect(r.ok && r.line).toMatch(/^u:\$2y\$04\$/);
  });
  it('rifiuta utente e password non validi', async () => {
    expect(await makeLine('', 'pw', 'sha1')).toEqual({ ok: false, error: 'user-empty' });
    expect(await makeLine('a:b', 'pw', 'sha1')).toEqual({ ok: false, error: 'user-colon' });
    expect(await makeLine('a\nb', 'pw', 'sha1')).toEqual({ ok: false, error: 'user-control' });
    expect(await makeLine('a'.repeat(256), 'pw', 'sha1')).toEqual({ ok: false, error: 'user-long' });
    expect(await makeLine('u', '', 'sha1')).toEqual({ ok: false, error: 'password-empty' });
  });
  it('nome utente con caratteri accentati', async () => {
    expect(validateUser('città')).toBeNull();
  });
  it('hashPassword per ogni algoritmo si verifica', async () => {
    for (const algo of ['bcrypt', 'apr1', 'sha1'] as const) {
      const h = await hashPassword(algo, 'pässword', 4);
      const v = await verifyLine(`u:${h}`, 'pässword');
      expect(v, algo).toMatchObject({ ok: true, match: true });
      expect(await verifyLine(`u:${h}`, 'altra'), algo).toMatchObject({ ok: true, match: false });
    }
  });
});

describe('verifyLine e parseLine', () => {
  it('apr1 da openssl', async () => {
    const line = 'mario:' + APR1_VECTORS[0][2];
    expect(await verifyLine(line, 'password')).toMatchObject({ ok: true, user: 'mario', type: 'apr1', match: true });
    expect(await verifyLine(line, 'sbagliata')).toMatchObject({ ok: true, match: false });
  });
  it('sha1', async () => {
    expect(await verifyLine('u:{SHA}5en6G6MezRroT3XKqkdPOmY/BfQ=', 'secret')).toMatchObject({ ok: true, type: 'sha1', match: true });
  });
  it('usa la prima riga non vuota e ignora gli spazi', async () => {
    expect(await verifyLine('\n  u:{SHA}5en6G6MezRroT3XKqkdPOmY/BfQ=  \nv:x', 'secret')).toMatchObject({ ok: true, user: 'u', match: true });
  });
  it('errori', async () => {
    expect(await verifyLine('', 'x')).toEqual({ ok: false, error: 'empty' });
    expect(await verifyLine('solo-utente', 'x')).toEqual({ ok: false, error: 'no-colon' });
    expect(await verifyLine('u:', 'x')).toEqual({ ok: false, error: 'no-hash' });
    expect(await verifyLine(':abc', 'x')).toEqual({ ok: false, error: 'no-hash' });
    expect(await verifyLine('u:qualcosa-di-strano', 'x')).toMatchObject({ ok: false, error: 'bad-hash' });
    expect(await verifyLine('u:$6$salt$abcdef', 'x')).toMatchObject({ ok: false, error: 'unsupported', type: 'sha512crypt' });
    expect(await verifyLine('u:$1$salt$abcdef', 'x')).toMatchObject({ ok: false, error: 'unsupported', type: 'md5crypt' });
    expect(await verifyLine('u:abJnggxhB/yWI', 'x')).toMatchObject({ ok: false, error: 'unsupported', type: 'crypt' });
  });
  it('riconosce il tipo di hash', () => {
    expect(detectType(BCRYPT_2Y)).toBe('bcrypt');
    expect(detectType(APR1_VECTORS[0][2])).toBe('apr1');
    expect(detectType('{SHA}5en6G6MezRroT3XKqkdPOmY/BfQ=')).toBe('sha1');
    expect(detectType('$apr1$salt$corto')).toBe('unknown');
    expect(detectType('$2y$05$troppo-corto')).toBe('unknown');
  });
  it('parseLine tiene i due punti dentro l\'hash', () => {
    const r = parseLine('u:$apr1$a:b$x');
    expect(r.ok && r.parsed).toMatchObject({ user: 'u', hash: '$apr1$a:b$x' });
  });
});

describe('utilità', () => {
  it('conta i byte, non i caratteri', () => {
    expect(passwordBytes('abc')).toBe(3);
    expect(passwordBytes('àèì')).toBe(6);
    expect(passwordBytes('🚀')).toBe(4);
  });
});
