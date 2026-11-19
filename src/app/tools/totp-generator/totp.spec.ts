// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  TotpAlgorithm,
  TotpError,
  base32Decode,
  base32Encode,
  buildOtpauth,
  formatCode,
  groupSecret,
  hotp,
  isOtpauthUri,
  parseOtpauth,
  randomSecret,
  secondsRemaining,
  timeCounter,
  totp,
  totpNeighbours,
  verifyTotp,
} from './totp';

const enc = (s: string) => new TextEncoder().encode(s);
const SECRETS: Record<TotpAlgorithm, Uint8Array> = {
  'SHA-1': enc('12345678901234567890'),
  'SHA-256': enc('12345678901234567890123456789012'),
  'SHA-512': enc('1234567890123456789012345678901234567890123456789012345678901234'),
};

describe('Base32', () => {
  it('vettori RFC 4648', () => {
    const cases: [string, string][] = [
      ['', ''],
      ['f', 'MY'],
      ['fo', 'MZXQ'],
      ['foo', 'MZXW6'],
      ['foob', 'MZXW6YQ'],
      ['fooba', 'MZXW6YTB'],
      ['foobar', 'MZXW6YTBOI'],
    ];
    for (const [plain, b32] of cases) {
      expect(base32Encode(enc(plain))).toBe(b32);
      if (plain) expect(new TextDecoder().decode(base32Decode(b32))).toBe(plain);
    }
    expect(base32Encode(enc('foob'), true)).toBe('MZXW6YQ=');
  });
  it('accetta minuscole, spazi, trattini e riempimento', () => {
    expect(new TextDecoder().decode(base32Decode('mzxw 6ytb-oi=='))).toBe('foobar');
  });
  it('errori: vuoto e caratteri non validi', () => {
    expect(() => base32Decode('')).toThrow(TotpError);
    expect(() => base32Decode('  ')).toThrow(TotpError);
    expect(() => base32Decode('ABC1')).toThrow(expect.objectContaining({ code: 'base32' }));
    expect(() => base32Decode('ABC!')).toThrow(expect.objectContaining({ code: 'base32' }));
  });
  it('andata e ritorno su byte casuali', () => {
    for (let n = 1; n < 40; n++) {
      const bytes = crypto.getRandomValues(new Uint8Array(n));
      expect(Array.from(base32Decode(base32Encode(bytes)))).toEqual(Array.from(bytes));
    }
  });
  it('randomSecret: 20 byte, Base32 valido, diverso a ogni chiamata', () => {
    const a = randomSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(a).length).toBe(20);
    expect(randomSecret()).not.toBe(a);
  });
  it('groupSecret raggruppa a 4', () => {
    expect(groupSecret('ABCDEFGHIJ')).toBe('ABCD EFGH IJ');
    expect(groupSecret('ABCD EFGH')).toBe('ABCD EFGH');
  });
});

describe('HOTP (RFC 4226, appendice D)', () => {
  const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
  it('dieci valori con SHA-1 a 6 cifre', async () => {
    for (let i = 0; i < expected.length; i++) {
      expect(await hotp(SECRETS['SHA-1'], i, 'SHA-1', 6)).toBe(expected[i]);
    }
  });
});

describe('TOTP (RFC 6238, appendice B)', () => {
  const times = [59, 1111111109, 1111111111, 1234567890, 2000000000, 20000000000];
  const vectors: Record<TotpAlgorithm, string[]> = {
    'SHA-1': ['94287082', '07081804', '14050471', '89005924', '69279037', '65353130'],
    'SHA-256': ['46119246', '68084774', '67062674', '91819424', '90698825', '77737706'],
    'SHA-512': ['90693936', '25091201', '99943326', '93441116', '38618901', '47863826'],
  };
  for (const algorithm of Object.keys(vectors) as TotpAlgorithm[]) {
    it(`${algorithm}, 8 cifre, periodo 30`, async () => {
      for (let i = 0; i < times.length; i++) {
        const code = await totp(SECRETS[algorithm], times[i] * 1000, { algorithm, digits: 8, period: 30 });
        expect(code).toBe(vectors[algorithm][i]);
      }
    });
  }
  it('con 6 cifre sono le ultime 6 delle 8', async () => {
    expect(await totp(SECRETS['SHA-1'], 59000, { algorithm: 'SHA-1', digits: 6, period: 30 })).toBe('287082');
  });
  it('il periodo cambia il contatore', async () => {
    const a = await totp(SECRETS['SHA-1'], 59000, { algorithm: 'SHA-1', digits: 6, period: 60 });
    expect(a).toBe(await hotp(SECRETS['SHA-1'], 0, 'SHA-1', 6));
  });
  it('parametri non validi', async () => {
    const s = SECRETS['SHA-1'];
    await expect(totp(s, 0, { algorithm: 'SHA-1', digits: 5, period: 30 })).rejects.toMatchObject({ code: 'digits' });
    await expect(totp(s, 0, { algorithm: 'SHA-1', digits: 6, period: 1 })).rejects.toMatchObject({ code: 'period' });
    await expect(totp(s, 0, { algorithm: 'MD5' as TotpAlgorithm, digits: 6, period: 30 })).rejects.toMatchObject({ code: 'algorithm' });
  });
  it('contatore e secondi rimanenti', () => {
    expect(timeCounter(59000, 30)).toBe(1);
    expect(timeCounter(60000, 30)).toBe(2);
    expect(secondsRemaining(60000, 30)).toBe(30);
    expect(secondsRemaining(89999, 30)).toBe(1);
    expect(secondsRemaining(0, 30)).toBe(30);
  });
  it('precedente, corrente e successivo', async () => {
    const p = { algorithm: 'SHA-1' as const, digits: 8, period: 30 };
    const n = await totpNeighbours(SECRETS['SHA-1'], 59000, p);
    expect(n.current).toBe('94287082');
    expect(n.previous).toBe(await hotp(SECRETS['SHA-1'], 0, 'SHA-1', 8));
    expect(n.next).toBe(await hotp(SECRETS['SHA-1'], 2, 'SHA-1', 8));
  });
});

describe('verifyTotp', () => {
  const p = { algorithm: 'SHA-1' as const, digits: 8, period: 30 };
  const secret = SECRETS['SHA-1'];
  it('accetta il codice corrente', async () => {
    expect(await verifyTotp('94287082', secret, 59000, p, 0)).toEqual({ ok: true, offset: 0 });
  });
  it('con finestra 0 rifiuta quello del periodo precedente, con 1 lo accetta', async () => {
    const prev = await hotp(secret, 0, 'SHA-1', 8);
    expect(await verifyTotp(prev, secret, 59000, p, 0)).toEqual({ ok: false, offset: null });
    expect(await verifyTotp(prev, secret, 59000, p, 1)).toEqual({ ok: true, offset: -1 });
  });
  it('riconosce anche il successivo e rispetta il limite della finestra', async () => {
    const next = await hotp(secret, 5, 'SHA-1', 8);
    expect(await verifyTotp(next, secret, 4 * 30 * 1000, p, 1)).toEqual({ ok: true, offset: 1 });
    const far = await hotp(secret, 8, 'SHA-1', 8);
    expect(await verifyTotp(far, secret, 4 * 30 * 1000, p, 1)).toEqual({ ok: false, offset: null });
    expect((await verifyTotp(far, secret, 4 * 30 * 1000, p, 4)).ok).toBe(true);
  });
  it('ignora gli spazi e rifiuta formati sbagliati', async () => {
    expect((await verifyTotp('9428 7082', secret, 59000, p, 0)).ok).toBe(true);
    expect((await verifyTotp('942870', secret, 59000, p, 0)).ok).toBe(false);
    expect((await verifyTotp('abcdefgh', secret, 59000, p, 0)).ok).toBe(false);
    expect((await verifyTotp('', secret, 59000, p, 0)).ok).toBe(false);
  });
  it('non va sotto il contatore zero', async () => {
    expect((await verifyTotp('00000000', secret, 0, p, 3)).ok).toBe(false);
  });
});

describe('URI otpauth', () => {
  it('legge un URI completo', () => {
    const d = parseOtpauth('otpauth://totp/Esempio:mario%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Esempio&algorithm=SHA256&digits=8&period=60');
    expect(d).toEqual({
      secret: 'JBSWY3DPEHPK3PXP',
      params: { algorithm: 'SHA-256', digits: 8, period: 60 },
      label: 'mario@example.com',
      issuer: 'Esempio',
    });
  });
  it('valori predefiniti e issuer preso dall\'etichetta', () => {
    const d = parseOtpauth('otpauth://totp/Acme:luca?secret=jbswy3dpehpk3pxp');
    expect(d.params).toEqual({ algorithm: 'SHA-1', digits: 6, period: 30 });
    expect(d.issuer).toBe('Acme');
    expect(d.label).toBe('luca');
    expect(d.secret).toBe('JBSWY3DPEHPK3PXP');
  });
  it('errori', () => {
    expect(() => parseOtpauth('non un uri')).toThrow(expect.objectContaining({ code: 'uri' }));
    expect(() => parseOtpauth('https://example.com/?secret=AAAA')).toThrow(expect.objectContaining({ code: 'uri' }));
    expect(() => parseOtpauth('otpauth://hotp/x?secret=JBSWY3DPEHPK3PXP&counter=1')).toThrow(expect.objectContaining({ code: 'uri-type' }));
    expect(() => parseOtpauth('otpauth://totp/x')).toThrow(expect.objectContaining({ code: 'uri-secret' }));
    expect(() => parseOtpauth('otpauth://totp/x?secret=ab1')).toThrow(expect.objectContaining({ code: 'base32' }));
    expect(() => parseOtpauth('otpauth://totp/x?secret=JBSWY3DP&algorithm=MD5')).toThrow(expect.objectContaining({ code: 'algorithm' }));
    expect(() => parseOtpauth('otpauth://totp/x?secret=JBSWY3DP&digits=12')).toThrow(expect.objectContaining({ code: 'digits' }));
    expect(() => parseOtpauth('otpauth://totp/x?secret=JBSWY3DP&period=0')).toThrow(expect.objectContaining({ code: 'period' }));
  });
  it('costruisce e rilegge (andata e ritorno)', () => {
    const data = {
      secret: 'JBSWY3DPEHPK3PXP',
      params: { algorithm: 'SHA-512' as const, digits: 8, period: 45 },
      label: 'mario rossi@example.com',
      issuer: 'Il mio sito',
    };
    const uri = buildOtpauth(data);
    expect(uri.startsWith('otpauth://totp/Il%20mio%20sito:mario%20rossi%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Il%20mio%20sito')).toBe(true);
    expect(uri).toContain('algorithm=SHA512&digits=8&period=45');
    expect(parseOtpauth(uri)).toEqual(data);
  });
  it('senza issuer, e rifiuta un segreto non valido', () => {
    const uri = buildOtpauth({ secret: 'jbsw y3dp', params: { algorithm: 'SHA-1', digits: 6, period: 30 }, label: 'a', issuer: '' });
    expect(uri).toBe('otpauth://totp/a?secret=JBSWY3DP&algorithm=SHA1&digits=6&period=30');
    expect(() => buildOtpauth({ secret: '0189', params: { algorithm: 'SHA-1', digits: 6, period: 30 }, label: 'a', issuer: '' })).toThrow(TotpError);
  });
  it('isOtpauthUri e formatCode', () => {
    expect(isOtpauthUri(' otpauth://totp/x?secret=AA')).toBe(true);
    expect(isOtpauthUri('JBSWY3DP')).toBe(false);
    expect(formatCode('123456')).toBe('123 456');
    expect(formatCode('1234567')).toBe('1234 567');
    expect(formatCode('12345678')).toBe('1234 5678');
  });
});
