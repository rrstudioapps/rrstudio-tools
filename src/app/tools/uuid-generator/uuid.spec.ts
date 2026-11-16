// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MAX_COUNT, RandomSource, clampCount, formatId, generateIds, inspectId, newState, ulid, uuidV4, uuidV7 } from './uuid';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-([1-8])[0-9a-f]{3}-([89ab])[0-9a-f]{3}-[0-9a-f]{12}$/;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Sorgente deterministica: byte in sequenza (non casuale, solo per i test di formato). */
function counterRandom(start = 1): RandomSource {
  let n = start;
  return (len) => Uint8Array.from({ length: len }, () => (n++ * 37) & 0xff);
}
const cryptoSource: RandomSource = (len) => webcrypto.getRandomValues(new Uint8Array(len));

describe('uuidV4', () => {
  it('ha formato, versione 4 e variante RFC', () => {
    for (let i = 0; i < 200; i++) {
      const m = UUID_RE.exec(uuidV4(cryptoSource));
      expect(m).not.toBeNull();
      expect(m![1]).toBe('4');
      expect('89ab').toContain(m![2]);
    }
  });
  it('forza i bit di versione e variante anche con byte tutti a 1 o a 0', () => {
    expect(uuidV4(() => new Uint8Array(16).fill(0xff))).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(uuidV4(() => new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000');
  });
  it('non produce duplicati in mille generazioni', () => {
    expect(new Set(generateIds('v4', 1000, newState(), 0, cryptoSource)).size).toBe(1000);
  });
});

describe('uuidV7', () => {
  it('codifica il timestamp corretto nei primi 48 bit', () => {
    const ms = Date.UTC(2026, 10, 16, 12, 34, 56, 789);
    const id = uuidV7(newState(), ms, cryptoSource);
    expect(UUID_RE.exec(id)![1]).toBe('7');
    expect(parseInt(id.replace('-', '').slice(0, 12), 16)).toBe(ms);
    const r = inspectId(id);
    expect(r.ok && r.kind === 'uuid' && r.ms).toBe(ms);
  });
  it('timestamp oltre i 32 bit e all\'epoca zero', () => {
    expect(uuidV7(newState(), 0, () => new Uint8Array(8)).startsWith('00000000-0000-7')).toBe(true);
    const big = 2 ** 47 + 12345;
    expect(parseInt(uuidV7(newState(), big, cryptoSource).replace('-', '').slice(0, 12), 16)).toBe(big);
  });
  it('variante RFC', () => {
    expect(UUID_RE.exec(uuidV7(newState(), 1, () => new Uint8Array(8).fill(0xff)))![2]).toBe('b');
  });
  it('è crescente in ordine lessicografico nello stesso millisecondo', () => {
    const ids = generateIds('v7', 1000, newState(), 1_800_000_000_000, cryptoSource);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(1000);
  });
  it('resta crescente se l\'orologio torna indietro e se il contatore si esaurisce', () => {
    const st = newState();
    const a = uuidV7(st, 5000, counterRandom());
    const b = uuidV7(st, 4000, counterRandom(9)); // orologio indietro
    expect(b > a).toBe(true);
    // 5000 id nello stesso ms: il contatore a 12 bit (4096) si esaurisce e il tempo avanza di 1 ms
    const many: string[] = [];
    const st2 = newState();
    for (let i = 0; i < 5000; i++) many.push(uuidV7(st2, 7000, cryptoSource));
    expect([...many].sort()).toEqual(many);
    expect(new Set(many).size).toBe(5000);
  });
  it('è crescente anche tra millisecondi diversi', () => {
    const st = newState();
    const ids = [1000, 1001, 1001, 1002, 99999].map((t) => uuidV7(st, t, cryptoSource));
    expect([...ids].sort()).toEqual(ids);
  });
});

describe('ULID', () => {
  it('ha 26 caratteri Crockford e il timestamp corretto', () => {
    const ms = Date.UTC(2026, 10, 16, 12, 0, 0, 1);
    const id = ulid(newState(), ms, cryptoSource);
    expect(id).toMatch(ULID_RE);
    const r = inspectId(id);
    expect(r.ok && r.kind === 'ulid' && r.ms).toBe(ms);
  });
  it('vettore noto: tempo 0 → 0000000000, tempo massimo → 7ZZZZZZZZZ', () => {
    expect(ulid(newState(), 0, () => new Uint8Array(10))).toBe('00000000000000000000000000');
    expect(ulid(newState(), 2 ** 48 - 1, () => new Uint8Array(10).fill(0xff))).toBe('7ZZZZZZZZZZZZZZZZZZZZZZZZZ');
  });
  it('è monotono nello stesso millisecondo, anche con riporto', () => {
    const st = newState();
    const first = ulid(st, 123456, () => Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff]));
    const second = ulid(st, 123456, cryptoSource);
    expect(second > first).toBe(true);
    expect(second.slice(0, 10)).toBe(first.slice(0, 10));
    const ids = generateIds('ulid', 1000, newState(), 5_000_000, cryptoSource);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(1000);
  });
});

describe('generateIds e formattazione', () => {
  it('limita la quantità a 1-1000', () => {
    expect(clampCount(0)).toBe(1);
    expect(clampCount(5000)).toBe(MAX_COUNT);
    expect(clampCount(NaN)).toBe(1);
    expect(clampCount(7.9)).toBe(7);
    expect(generateIds('v4', 5000)).toHaveLength(1000);
  });
  it('maiuscole, senza trattini, con graffe', () => {
    const id = '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';
    expect(formatId(id, 'v7', { upper: false, hyphens: true, braces: false })).toBe(id);
    expect(formatId(id, 'v7', { upper: true, hyphens: false, braces: true })).toBe('{0190A1B2C3D47E5F8A6B7C8D9E0F1A2B}');
    expect(formatId('01ARZ3NDEKTSV4RRFFQ69G5FAV', 'ulid', { upper: false, hyphens: false, braces: true })).toBe('01arz3ndektsv4rrffq69g5fav');
  });
});

describe('inspectId', () => {
  it('v4: versione e variante', () => {
    const r = inspectId('f47ac10b-58cc-4372-a567-0e02b2c3d479');
    expect(r).toMatchObject({ ok: true, kind: 'uuid', version: 4, variant: 'rfc', ms: null, nil: false });
  });
  it('accetta graffe, maiuscole, urn:uuid: e assenza di trattini', () => {
    const base = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    for (const v of [`{${base.toUpperCase()}}`, `urn:uuid:${base}`, base.replaceAll('-', ''), `  ${base}  `]) {
      expect(inspectId(v)).toMatchObject({ ok: true, version: 4, canonical: base });
    }
  });
  it('v7 di esempio: data contenuta', () => {
    // 0x018F_0000_0000 ms = 2024-04-10T...; calcolato dal valore stesso
    const r = inspectId('018f0000-0000-7abc-8def-0123456789ab');
    expect(r.ok && r.kind === 'uuid' && r.version === 7 && r.ms).toBe(0x018f00000000);
  });
  it('varianti: NCS, Microsoft, futura; nil e max', () => {
    expect(inspectId('00000000-0000-1000-0000-000000000000')).toMatchObject({ variant: 'ncs', version: 1 });
    expect(inspectId('00000000-0000-1000-c000-000000000000')).toMatchObject({ variant: 'microsoft' });
    expect(inspectId('00000000-0000-1000-e000-000000000000')).toMatchObject({ variant: 'future' });
    expect(inspectId('00000000-0000-0000-0000-000000000000')).toMatchObject({ nil: true, version: 0 });
    expect(inspectId('ffffffff-ffff-ffff-ffff-ffffffffffff')).toMatchObject({ max: true, version: 15 });
  });
  it('ULID: riconosce e dà la data; case-insensitive', () => {
    const r = inspectId('01arz3ndektsv4rrffq69g5fav');
    expect(r).toMatchObject({ ok: true, kind: 'ulid', canonical: '01ARZ3NDEKTSV4RRFFQ69G5FAV' });
    // 01ARZ3NDEK: esempio della specifica ULID
    expect(r.ok && r.kind === 'ulid' && new Date(r.ms).toISOString()).toBe('2016-07-30T23:54:10.259Z');
  });
  it('errori', () => {
    expect(inspectId('')).toEqual({ ok: false, error: 'empty' });
    expect(inspectId('1234')).toEqual({ ok: false, error: 'length' });
    expect(inspectId('zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz')).toEqual({ ok: false, error: 'chars' });
    expect(inspectId('f47ac10b58cc-4372-a567-0e02b2c3d479')).toEqual({ ok: false, error: 'hyphens' });
    expect(inspectId('81ARZ3NDEKTSV4RRFFQ69G5FAV')).toEqual({ ok: false, error: 'ulid-overflow' });
    expect(inspectId('01ARZ3NDEKTSV4RRFFQ69G5FAU')).toEqual({ ok: false, error: 'chars' });
  });
  it('round trip: tutto ciò che si genera si riconosce con la stessa versione', () => {
    for (const [kind, version] of [['v4', 4], ['v7', 7]] as const) {
      for (const id of generateIds(kind, 20, newState(), Date.now(), cryptoSource)) {
        expect(inspectId(id)).toMatchObject({ ok: true, kind: 'uuid', version, variant: 'rfc' });
      }
    }
    for (const id of generateIds('ulid', 20, newState(), Date.now(), cryptoSource)) expect(inspectId(id)).toMatchObject({ ok: true, kind: 'ulid' });
  });
});
