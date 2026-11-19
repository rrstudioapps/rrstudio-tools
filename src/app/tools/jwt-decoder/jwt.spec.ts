// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { JwtDecoded, JweInfo, cleanToken, decodeBase64Url, encodeSegment, parseJwt, remaining, sampleToken, splitDuration, statusOf } from './jwt';

const make = (header: unknown, payload: unknown, sig = 'c2ln'): string => `${encodeSegment(header)}.${encodeSegment(payload)}.${sig}`;

function decoded(token: string): JwtDecoded {
  const r = parseJwt(token);
  if (!r.ok || r.token.type !== 'jws') throw new Error('atteso un JWS valido');
  return r.token;
}

describe('cleanToken', () => {
  it('toglie Bearer, virgolette, spazi e a capo', () => {
    expect(cleanToken('  Bearer  aaa.bbb.ccc\n')).toBe('aaa.bbb.ccc');
    expect(cleanToken('bearer aaa.bbb.ccc')).toBe('aaa.bbb.ccc');
    expect(cleanToken('Authorization: Bearer aaa.bbb.ccc')).toBe('aaa.bbb.ccc');
    expect(cleanToken('"aaa.bbb.ccc"')).toBe('aaa.bbb.ccc');
    expect(cleanToken('aaa.\n bbb.\n ccc')).toBe('aaa.bbb.ccc');
  });
});

describe('decodeBase64Url', () => {
  it('decodifica con e senza padding, - e _', () => {
    expect([...decodeBase64Url('aGk', 'header')]).toEqual([104, 105]);
    expect([...decodeBase64Url('aGk=', 'header')]).toEqual([104, 105]);
    expect([...decodeBase64Url('_-8', 'header')]).toEqual([255, 239]);
  });
  it('rifiuta + e / e lunghezze impossibili', () => {
    expect(() => decodeBase64Url('a+b', 'payload')).toThrow(expect.objectContaining({ kind: 'base64', part: 'payload', char: '+' }));
    expect(() => decodeBase64Url('abcde', 'header')).toThrow(expect.objectContaining({ kind: 'base64', char: '' }));
  });
});

describe('parseJwt', () => {
  it('decodifica un JWT con header, payload, alg e date', () => {
    const t = decoded(make({ alg: 'RS256', typ: 'JWT', kid: 'k1' }, { sub: 'u1', exp: 1893456000, iat: 1893452400, nbf: 1893452400, auth_time: 1893452300 }));
    expect(t.alg).toBe('RS256');
    expect(t.typ).toBe('JWT');
    expect(t.kid).toBe('k1');
    expect(t.signatureBytes).toBe(3);
    expect(t.dates.map((d) => d.claim)).toEqual(['exp', 'iat', 'nbf', 'auth_time']);
    expect(t.dates[0].ms).toBe(1893456000_000);
    expect(new Date(t.dates[0].ms!).toISOString()).toBe('2030-01-01T00:00:00.000Z');
    expect(t.payloadText).toContain('"sub": "u1"');
    expect(t.unsecured).toBe(false);
  });

  it('accetta il prefisso Bearer e gli UTF-8 nel payload', () => {
    const t = decoded('Bearer ' + make({ alg: 'HS256' }, { name: 'Zoë 日本' }));
    expect((t.payload as { name: string }).name).toBe('Zoë 日本');
  });

  it('riconosce un token non firmato (alg none, firma vuota)', () => {
    const t = decoded(make({ alg: 'none' }, { a: 1 }, ''));
    expect(t.unsecured).toBe(true);
    expect(t.signatureBytes).toBe(0);
  });

  it('segnala i claim di data non numerici senza fallire', () => {
    const t = decoded(make({ alg: 'HS256' }, { exp: '2030-01-01', iat: 5 }));
    expect(t.badDates).toEqual(['exp']);
    expect(t.dates.map((d) => d.claim)).toEqual(['iat']);
  });

  it('errori: vuoto, segmenti mancanti o in eccesso', () => {
    expect(parseJwt('   ')).toEqual({ ok: false, error: { kind: 'empty' } });
    expect(parseJwt('abc')).toEqual({ ok: false, error: { kind: 'segments', count: 1 } });
    expect(parseJwt('abc.def')).toEqual({ ok: false, error: { kind: 'segments', count: 2 } });
    expect(parseJwt('a.b.c.d')).toEqual({ ok: false, error: { kind: 'segments', count: 4 } });
  });

  it('errori: Base64URL non valido, JSON non valido, header non oggetto', () => {
    const good = encodeSegment({ alg: 'HS256' });
    const r1 = parseJwt(`${good}.pay!load.sig`);
    expect(r1).toEqual({ ok: false, error: { kind: 'base64', part: 'payload', char: '!' } });
    const notJson = btoa('{non json').replace(/=+$/, '');
    const r2 = parseJwt(`${good}.${notJson}.sig`);
    expect(r2.ok === false && r2.error.kind === 'json' && r2.error.part === 'payload').toBe(true);
    const r3 = parseJwt(`${encodeSegment([1, 2])}.${good}.sig`);
    expect(r3).toEqual({ ok: false, error: { kind: 'header-type' } });
    const r4 = parseJwt(`${good}.${good}.si*g`);
    expect(r4.ok === false && r4.error.kind === 'base64' && r4.error.part === 'signature').toBe(true);
  });

  it('errore UTF-8 quando i byte non sono testo valido', () => {
    const bad = btoa(String.fromCharCode(0xff, 0xfe, 0xfd)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const r = parseJwt(`${bad}.${bad}.x`);
    expect(r.ok === false && r.error.kind === 'utf8' && r.error.part === 'header').toBe(true);
  });

  it('riconosce un JWE (5 segmenti) e ne legge l\'intestazione', () => {
    const jwe = `${encodeSegment({ alg: 'RSA-OAEP', enc: 'A256GCM', kid: 'k9' })}.QUJD.REVG.R0hJSktM.dGFn`;
    const r = parseJwt(jwe);
    expect(r.ok).toBe(true);
    const t = (r as { token: JweInfo }).token;
    expect(t.type).toBe('jwe');
    expect(t.alg).toBe('RSA-OAEP');
    expect(t.enc).toBe('A256GCM');
    expect(t.lengths).toHaveLength(5);
  });

  it('un JWE con intestazione illeggibile resta un JWE', () => {
    const r = parseJwt('a!.b.c.d.e');
    expect(r.ok && r.token.type === 'jwe' && r.token.header === null).toBe(true);
  });

  it('il token d\'esempio si decodifica', () => {
    const t = decoded(sampleToken(1893452400));
    expect(t.dates.find((d) => d.claim === 'exp')?.seconds).toBe(1893452400 - 300 + 3600);
  });
});

describe('tempo', () => {
  it('remaining distingue futuro, passato e adesso', () => {
    expect(remaining(10_000, 0)).toEqual({ state: 'future', seconds: 10 });
    expect(remaining(0, 10_000)).toEqual({ state: 'past', seconds: 10 });
    expect(remaining(1000, 1000).state).toBe('now');
  });

  it('splitDuration tiene le due unità più grandi', () => {
    expect(splitDuration(90061)).toEqual([{ unit: 'day', value: 1 }, { unit: 'hour', value: 1 }]);
    expect(splitDuration(3600)).toEqual([{ unit: 'hour', value: 1 }]);
    expect(splitDuration(59)).toEqual([{ unit: 'second', value: 59 }]);
    expect(splitDuration(0)).toEqual([{ unit: 'second', value: 0 }]);
  });

  it('statusOf: scaduto, non ancora valido, valido, senza scadenza', () => {
    const d = (claim: 'exp' | 'nbf', s: number) => ({ claim, seconds: s, ms: s * 1000 });
    expect(statusOf([d('exp', 100)], 200_000)).toBe('expired');
    expect(statusOf([d('exp', 300)], 200_000)).toBe('valid');
    expect(statusOf([d('nbf', 300), d('exp', 900)], 200_000)).toBe('not-yet');
    expect(statusOf([], 200_000)).toBe('no-exp');
  });
});
