// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { HmacError, base64ToBytes, bytesToHex, constantTimeEqual, encodeOutput, hexToBytes, hmac, parseExpected, parseKey, verify, HmacAlgorithm } from './hmac';

const enc = new TextEncoder();
const rep = (b: number, n: number) => new Uint8Array(n).fill(b);

/** Casi di prova RFC 4231 (SHA-256/384/512; il caso 5 è un troncamento e non c'è). I numeri sono quelli dell'RFC (il 6 e il 7 qui sono 5 e 6). */
const CASES: Record<string, [Uint8Array, Uint8Array]> = {
  '1': [rep(0x0b, 20), enc.encode('Hi There')],
  '2': [enc.encode('Jefe'), enc.encode('what do ya want for nothing?')],
  '3': [rep(0xaa, 20), rep(0xdd, 50)],
  '4': [Uint8Array.from({ length: 25 }, (_, i) => i + 1), rep(0xcd, 50)],
  '5': [rep(0xaa, 131), enc.encode('Test Using Larger Than Block-Size Key - Hash Key First')],
  '6': [
    rep(0xaa, 131),
    enc.encode('This is a test using a larger than block-size key and a larger than block-size data. The key needs to be hashed before being used by the HMAC algorithm.'),
  ],
};

const VECTORS: [string, HmacAlgorithm, string][] = [
  ['1', 'SHA-256', 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'],
  ['1', 'SHA-384', 'afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6'],
  ['1', 'SHA-512', '87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854'],
  ['2', 'SHA-256', '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'],
  ['2', 'SHA-384', 'af45d2e376484031617f78d2b58a6b1b9c7ef464f5a01b47e42ec3736322445e8e2240ca5e69e2c78b3239ecfab21649'],
  ['2', 'SHA-512', '164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737'],
  ['3', 'SHA-256', '773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe'],
  ['3', 'SHA-384', '88062608d3e6ad8a0aa2ace014c8a86f0aa635d947ac9febe83ef4e55966144b2a5ab39dc13814b94e3ab6e101a34f27'],
  ['3', 'SHA-512', 'fa73b0089d56a284efb0f0756c890be9b1b5dbdd8ee81a3655f83e33b2279d39bf3e848279a722c806b485a47e67c807b946a337bee8942674278859e13292fb'],
  ['4', 'SHA-256', '82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b'],
  ['4', 'SHA-384', '3e8a69b7783c25851933ab6290af6ca77a9981480850009cc5577c6e1f573b4e6801dd23c4a7d679ccf8a386c674cffb'],
  ['4', 'SHA-512', 'b0ba465637458c6990e5a8c5f61d4af7e576d97ff94b872de76f8050361ee3dba91ca5c11aa25eb4d679275cc5788063a5f19741120c4f2de2adebeb10a298dd'],
  ['5', 'SHA-256', '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54'],
  ['5', 'SHA-384', '4ece084485813e9088d2c63a041bc5b44f9ef1012a2b588f3cd11f05033ac4c60c2ef6ab4030fe8296248df163f44952'],
  ['5', 'SHA-512', '80b24263c7c1a3ebb71493c1dd7be8b49b46d1f41b4aeec1121b013783f8f3526b56d037e05f2598bd0fd2215d6a1e5295e64f73f63f0aec8b915a985d786598'],
  ['6', 'SHA-256', '9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2'],
  ['6', 'SHA-384', '6617178e941f020d351e2f254e8fd32c602420feb0b8fb9adccebb82461e99c5a678cc31e799176d3860e6110c46523e'],
  ['6', 'SHA-512', 'e37b6a775dc87dbaa4dfa9f96e5e3ffddebd71f8867289865df5a32d20cdc944b6022cac3c4982b10d5eeb55c3e4de15134676fb6de0446065c97440fa8c6a58'],
];

describe('hmac: vettori RFC 4231', () => {
  for (const [id, alg, expected] of VECTORS) {
    it(`caso ${id} ${alg}`, async () => {
      const [key, data] = CASES[id];
      expect(bytesToHex(await hmac(key, data, alg))).toBe(expected);
    });
  }
});

describe('hmac: SHA-1 (RFC 2202)', () => {
  it('caso 1', async () => {
    expect(bytesToHex(await hmac(rep(0x0b, 20), enc.encode('Hi There'), 'SHA-1'))).toBe('b617318655057264e28bc0b6fb378c8ef146be00');
  });
  it('caso 2', async () => {
    expect(bytesToHex(await hmac(enc.encode('Jefe'), enc.encode('what do ya want for nothing?'), 'SHA-1'))).toBe('effcdf6ae5eb2fa2d27416d5f184df9c259a7c79');
  });
});

describe('hmac: chiave vuota e messaggio vuoto', () => {
  it('la chiave vuota dà il valore noto di HMAC-SHA256("", "")', async () => {
    expect(bytesToHex(await hmac(new Uint8Array(0), new Uint8Array(0), 'SHA-256'))).toBe('b613679a0814d9ec772f95d778c35fc5ff1697c493715653c6c712144292c5ad');
  });
});

describe('chiavi e codifiche', () => {
  it('chiave in testo, hex e base64 equivalenti', () => {
    const t = Array.from(parseKey('Jefe', 'text'));
    expect(Array.from(parseKey('4a656665', 'hex'))).toEqual(t);
    expect(Array.from(parseKey('4a:65:66:65', 'hex'))).toEqual(t);
    expect(Array.from(parseKey('SmVmZQ==', 'base64'))).toEqual(t);
    expect(Array.from(parseKey('SmVmZQ', 'base64'))).toEqual(t);
  });
  it('rifiuta hex e base64 non validi', () => {
    expect(() => hexToBytes('abc')).toThrow(HmacError);
    expect(() => hexToBytes('zz')).toThrow(HmacError);
    expect(() => base64ToBytes('a*b')).toThrow(HmacError);
  });
  it('uscita hex, base64 e base64url', () => {
    const b = Uint8Array.from([0xfb, 0xff, 0xfe]);
    expect(encodeOutput(b, 'hex')).toBe('fbfffe');
    expect(encodeOutput(b, 'base64')).toBe('+//+');
    expect(encodeOutput(b, 'base64url')).toBe('-__-');
    expect(encodeOutput(Uint8Array.from([1, 2]), 'base64url')).toBe('AQI');
  });
});

describe('verifica a tempo costante', () => {
  const mac = hexToBytes('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  it('confronta byte e lunghezze', () => {
    expect(constantTimeEqual(Uint8Array.from([1, 2]), Uint8Array.from([1, 2]))).toBe(true);
    expect(constantTimeEqual(Uint8Array.from([1, 2]), Uint8Array.from([1, 3]))).toBe(false);
    expect(constantTimeEqual(Uint8Array.from([1, 2]), Uint8Array.from([1, 2, 0]))).toBe(false);
  });
  it('accetta hex (anche maiuscolo o con prefisso), base64 e base64url', () => {
    expect(verify(bytesToHex(mac), mac)).toBe('match');
    expect(verify(bytesToHex(mac).toUpperCase(), mac)).toBe('match');
    expect(verify('sha256=' + bytesToHex(mac), mac)).toBe('match');
    expect(verify(encodeOutput(mac, 'base64'), mac)).toBe('match');
    expect(verify(encodeOutput(mac, 'base64url'), mac)).toBe('match');
  });
  it('distingue firma diversa e illeggibile', () => {
    expect(verify('0' + bytesToHex(mac).slice(1), mac)).toBe('mismatch');
    expect(verify('abcd', mac)).toBe('mismatch');
    expect(verify('***', mac)).toBe('unreadable');
    expect(verify('   ', mac)).toBe('unreadable');
    expect(parseExpected('', 32)).toBeNull();
  });
});
