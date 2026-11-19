// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  CertInfo,
  CsrInfo,
  DecodedItem,
  base64ToBytes,
  bitLength,
  computeValidity,
  decode,
  extractPemBlocks,
  formatIp,
  serialHex,
  toHexColon,
} from './cert';

// Fixture generate con OpenSSL 3.0 (chiavi usa e getta, non più disponibili). Tutte valide dal 17/11/2026.
// CA radice RSA 2048: openssl req -x509 -newkey rsa:2048 -days 36500 -subj "/C=IT/O=Esempio Test CA/CN=Esempio Root CA" -addext basicConstraints=critical,CA:TRUE,pathlen:0 -addext keyUsage=critical,keyCertSign,cRLSign
const CA_PEM = `-----BEGIN CERTIFICATE-----
MIIDeDCCAmCgAwIBAgIUZYp5F1F1ianL1tW3CrVSsWeTBgQwDQYJKoZIhvcNAQEL
BQAwQTELMAkGA1UEBhMCSVQxGDAWBgNVBAoMD0VzZW1waW8gVGVzdCBDQTEYMBYG
A1UEAwwPRXNlbXBpbyBSb290IENBMCAXDTI2MTExNzA1NTI0MVoYDzIxMjYxMDI0
MDU1MjQxWjBBMQswCQYDVQQGEwJJVDEYMBYGA1UECgwPRXNlbXBpbyBUZXN0IENB
MRgwFgYDVQQDDA9Fc2VtcGlvIFJvb3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IB
DwAwggEKAoIBAQC1N3cjhtmhLRO3JOmo9Wn/HaQwxuh3ywAbZybVFiD7Re9dZ/D6
4cRNYb3H21RfxgT6ErL+T7weJ3YLCWha4QfeU6J56rtthEky4mjizlm120Yssl7o
NoSzHga7iPwSKfQAgkLqgTMf2ib8F4miVyRgkkiLGAO2Nzl4Gbpe2Gyo1IsldIEm
QMJzvBsgxBrB3lSKf1q999SkiiPUdp7nCXBTUqg0p1t+WAqipOI0aFx5BBUWY1Hj
HImnSxqcyGsjl7+zQj+8uj7OGX0Ao2T5PovGJ4Bu2B09XTD9I7XfEcegqFp7oS/0
3HvqZjVZROdd8cjyImFuDrxVXBeDUCMhDS8NAgMBAAGjZjBkMB0GA1UdDgQWBBRj
QZSXInjAgCiKhMobMWmG7atGhzAfBgNVHSMEGDAWgBRjQZSXInjAgCiKhMobMWmG
7atGhzASBgNVHRMBAf8ECDAGAQH/AgEAMA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG
9w0BAQsFAAOCAQEAb8lZATQCAnBIDa2TjpbchD8meg+GdYHa2uka+D8bE+4iHN3v
Z5L4x711bkr0EvPrJkIw1DuqeG0R6AWgTx/9Stsg6LzxznEh2GHcVu72ZC64HqdI
Yu8OSCc/a1fhoFnD6mfAFZwpwEW7Y/2TYL4AYXDRv/QKRVHEsRmnAMf36vrnnn67
hlj7RlVQqXW1Elm22uDUYHsRo/ljggM7e2UcHrDhb5EBbIiWieOzwAvlHFHezJkb
4k1kCWBxvzsyOaIw+LJvxnoAfb3Ay5qnM2DQ0BTWp/nZBIi0Ni1JYo/3oRJ+VWdj
lABdaTi/QnoLNGh+JLuSZi4yNxgTEQHuOK4TEA==
-----END CERTIFICATE-----
`;
// Foglia RSA 2048 firmata dalla CA, con SAN (DNS, IP, email, URI), keyUsage, extendedKeyUsage, SKI e AKI
const LEAF_PEM = `-----BEGIN CERTIFICATE-----
MIIEDTCCAvWgAwIBAgIUfyC3V5lv3ljF/1wkogHIaIherScwDQYJKoZIhvcNAQEL
BQAwQTELMAkGA1UEBhMCSVQxGDAWBgNVBAoMD0VzZW1waW8gVGVzdCBDQTEYMBYG
A1UEAwwPRXNlbXBpbyBSb290IENBMCAXDTI2MTExNzA1NTI0MloYDzIxMjYxMDI0
MDU1MjQyWjBjMQswCQYDVQQGEwJJVDESMBAGA1UECAwJTG9tYmFyZGlhMQ8wDQYD
VQQHDAZNaWxhbm8xFDASBgNVBAoMC0VzZW1waW8gU3JsMRkwFwYDVQQDDBB3d3cu
ZXNlbXBpby50ZXN0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAufaV
R5ZLiBU8DqVZhWafAs5B+1OmtioWLGFKs+JqXA6PtZrkq9OU6LVrBCSFqG9azSBZ
6BIMhddJkGUiND5n8m+goEzEM0zNIWwICkLAfG2cWAM40X28Z0jTnT50M0AgVQP9
+hrnm4jl2zErJ08chIAId2gLgbgkRyZx/UF9VrMsIw1FmKLo3rBfkHKf+JAP+61x
zd366smlN8vpynhIgTqbsW77hSFSKzmj5Ifr0FT1Wg7FcGYuyq5mf429pC5G5F62
Tv1KrwnBD6hh67lxppu4gVDiT3fqFXcEyosh5FbJLSC01M8BdsD4tGt41+tixtQ+
Nbhjup7SH3jGrG/pNQIDAQABo4HYMIHVMFkGA1UdEQRSMFCCEHd3dy5lc2VtcGlv
LnRlc3SCDGVzZW1waW8udGVzdIcEwAACCoERaW5mb0Blc2VtcGlvLnRlc3SGFWh0
dHBzOi8vZXNlbXBpby50ZXN0LzAOBgNVHQ8BAf8EBAMCBaAwHQYDVR0lBBYwFAYI
KwYBBQUHAwEGCCsGAQUFBwMCMAkGA1UdEwQCMAAwHQYDVR0OBBYEFBSff/tLoe9D
0vhQ39aiT4ijIb7IMB8GA1UdIwQYMBaAFGNBlJcieMCAKIqEyhsxaYbtq0aHMA0G
CSqGSIb3DQEBCwUAA4IBAQBLch6w7zRfNFDedmmD/SunpASomCpcqEAmYwRon1go
X9dN7DtPOXukikJMy33wHgW1XMrHq+bc6Q1NvOLCJezVAQdZHvHFuZJchikivNci
vM/a6JEUlLyqjT4/XZAzDJoZuGyLF8XBgvSx1IrMtB+FR/wJpxK2n35Zc6dYvaN0
U4oW9KBhzGWhKQhVjAa0E9p3I6OB/WxQMsod+b09QUWnfXyUoIbFw9I+MCQpejOx
O3nl5O6A6zZVRZhmBuuFMAgVLOUP+FH0+1YDvjb6U24f8sTF0GWm9fAzsdTgqV8z
CGyDq5gCwtOeWlFmG0GOykQyveW4ItdfJQQ3cO7IKz7I
-----END CERTIFICATE-----
`;
// Autofirmato EC P-256: openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -days 36500 -subj /CN=ec.esempio.test -addext subjectAltName=DNS:ec.esempio.test
const EC_PEM = `-----BEGIN CERTIFICATE-----
MIIBpzCCAU2gAwIBAgIUTaSxdqnRgy257ksVV8b7DdD0yeIwCgYIKoZIzj0EAwIw
GjEYMBYGA1UEAwwPZWMuZXNlbXBpby50ZXN0MCAXDTI2MTExNzA1NTI0MloYDzIx
MjYxMDI0MDU1MjQyWjAaMRgwFgYDVQQDDA9lYy5lc2VtcGlvLnRlc3QwWTATBgcq
hkjOPQIBBggqhkjOPQMBBwNCAATw6hMuyfAHzjszwkDd+AAMZhgHdsDZpk7MbOpA
8NpMplSIRRsB+P1jEaV0m7ya60NgimEqm5EihU8BxmeSEB/mo28wbTAdBgNVHQ4E
FgQUAu6QGDDs7Vnh3RWC/9Wtw7yydRIwHwYDVR0jBBgwFoAUAu6QGDDs7Vnh3RWC
/9Wtw7yydRIwDwYDVR0TAQH/BAUwAwEB/zAaBgNVHREEEzARgg9lYy5lc2VtcGlv
LnRlc3QwCgYIKoZIzj0EAwIDSAAwRQIhAOTdwF7MKtEakBFawjZ+NjdC/qecxGvH
YxdM8neSmGLKAiAvd4LSCzQEFexznnnQnTS4eMmR91ckW0r7Cx5IAvfCxQ==
-----END CERTIFICATE-----
`;
// Autofirmato Ed25519
const ED_PEM = `-----BEGIN CERTIFICATE-----
MIIBSjCB/aADAgECAhRiszt4VGyou9M25QKBjiBr5vXHAzAFBgMrZXAwGjEYMBYG
A1UEAwwPZWQuZXNlbXBpby50ZXN0MCAXDTI2MTExNzA1NTI0MloYDzIxMjYxMDI0
MDU1MjQyWjAaMRgwFgYDVQQDDA9lZC5lc2VtcGlvLnRlc3QwKjAFBgMrZXADIQC0
AmgjRpYoETa8LlFSuK31go4B+STplNW4C1y55+CBIqNTMFEwHQYDVR0OBBYEFKiS
67b5X80MMrNu7Tr/9YHtgdVTMB8GA1UdIwQYMBaAFKiS67b5X80MMrNu7Tr/9YHt
gdVTMA8GA1UdEwEB/wQFMAMBAf8wBQYDK2VwA0EABqjDP12Y6IUGjFLUtOoj+HkZ
/p5gkU0dcVS4UQ896+eGuxIwxWWrXvaVD+r67zmlhOoTa8MujEd9KHxRYsvFDA==
-----END CERTIFICATE-----
`;
// Autofirmato RSA valido un solo giorno (17-18/11/2026)
const OLD_PEM = `-----BEGIN CERTIFICATE-----
MIIDDzCCAfegAwIBAgIUN0aL+9XiR/GYeUgB9xU1wuXLNdswDQYJKoZIhvcNAQEL
BQAwFzEVMBMGA1UEAwwMc2NhZHV0by50ZXN0MB4XDTI2MTExNzA1NTI0M1oXDTI2
MTExODA1NTI0M1owFzEVMBMGA1UEAwwMc2NhZHV0by50ZXN0MIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEA6RwY/0tw8Zqk8LMeYJqpbPSXftiLYGcF6d38
CJoWHIZAVeeuDQtb5YkbonXwOnouIj25TLF1sb2MJrDVDKyvHEFeXXQ5ESkCixqq
2j/YZrNZXnGfqQoBZvD8UNr8yn8RmB2LRBC6i1k51WFyq3z0ug+GUOIz5h3Xgv+L
iND8ahosYvnHQix/KhJ19kXbidX3O0bGnh+ZgACQniN2St6yUuMUTdq1rfhe0dKX
wIAlv/8LF8+mF0IHHK9otV3bneiBdt51HsLvRkJ9jIcy8HgYzOv+34jOtXkmhBp2
tCoRb8hmjZCFAMYkdCTE1BLfnnUtS+feixCQyXHKqujAUxdcOQIDAQABo1MwUTAd
BgNVHQ4EFgQUJHATjL6K/xegBNSlUM+s+Y1/vIYwHwYDVR0jBBgwFoAUJHATjL6K
/xegBNSlUM+s+Y1/vIYwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOC
AQEAagHYEM5aCboAoFYmainucDqGb7vMhmVs1u8FMIML9xTvZk7ws2ChdtGPs514
tfPTrqdcyva1AvyUQ/eS7sqldksm7KhD8CN7/Iw6/L9EUtwqazvHxFUEMPVt4J+i
FTbV6vXZL6t0q8H/Ghltfz3nl13EvU4eiBl+E7S5Zq0CDDb693OfncHtiKmwcFjL
MLC3+tPqv9j8MwIePIGZHvhONvCFqp7KFwkVnAeIgFy4f8iZt1NHj797OBhJi8kw
K6D5Nqh3oUQssr+6yjc9exb9FU+44Lc2KjeZFAv0ImzcQW87F0KyEFGQC32bMyjM
cJWVHN741soFQiC9YQcq/seoIw==
-----END CERTIFICATE-----
`;
// Richiesta (CSR) EC P-384 con SAN: openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:secp384r1 -subj "/C=IT/O=Esempio/CN=csr.esempio.test" -addext subjectAltName=DNS:csr.esempio.test,DNS:alt.esempio.test
const CSR_PEM = `-----BEGIN CERTIFICATE REQUEST-----
MIIBcTCB+QIBADA6MQswCQYDVQQGEwJJVDEQMA4GA1UECgwHRXNlbXBpbzEZMBcG
A1UEAwwQY3NyLmVzZW1waW8udGVzdDB2MBAGByqGSM49AgEGBSuBBAAiA2IABOlw
cRFFynspfG6g3M64OMl/+KXhv6roU32+uFQhABX8s5SbO1lAohWxhw5FC+kpSVuA
584r+xWyDoqpRIXu3OFrsd+eEcffOymjBFHxdL5pMDZEtxb5Dwdj0QWwtKEGGaBA
MD4GCSqGSIb3DQEJDjExMC8wLQYDVR0RBCYwJIIQY3NyLmVzZW1waW8udGVzdIIQ
YWx0LmVzZW1waW8udGVzdDAKBggqhkjOPQQDAgNnADBkAjAsjtHBjCSauunlWjKV
TKVMeaKZ3O+m7Kldchlg8Jmp/wmad+DWWI/AfJS+l5vCNpoCMD+HuUcgSxfNAmww
4i2dajpfYkX2DTms1TALYGXzK6I1QAotEvqoxal4+OqF12xQ8A==
-----END CERTIFICATE REQUEST-----
`;
const EC_DER_BASE64 = 'MIIBpzCCAU2gAwIBAgIUTaSxdqnRgy257ksVV8b7DdD0yeIwCgYIKoZIzj0EAwIwGjEYMBYGA1UEAwwPZWMuZXNlbXBpby50ZXN0MCAXDTI2MTExNzA1NTI0MloYDzIxMjYxMDI0MDU1MjQyWjAaMRgwFgYDVQQDDA9lYy5lc2VtcGlvLnRlc3QwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAATw6hMuyfAHzjszwkDd+AAMZhgHdsDZpk7MbOpA8NpMplSIRRsB+P1jEaV0m7ya60NgimEqm5EihU8BxmeSEB/mo28wbTAdBgNVHQ4EFgQUAu6QGDDs7Vnh3RWC/9Wtw7yydRIwHwYDVR0jBBgwFoAUAu6QGDDs7Vnh3RWC/9Wtw7yydRIwDwYDVR0TAQH/BAUwAwEB/zAaBgNVHREEEzARgg9lYy5lc2VtcGlvLnRlc3QwCgYIKoZIzj0EAwIDSAAwRQIhAOTdwF7MKtEakBFawjZ+NjdC/qecxGvHYxdM8neSmGLKAiAvd4LSCzQEFexznnnQnTS4eMmR91ckW0r7Cx5IAvfCxQ==';

const NOW = new Date('2026-12-01T12:00:00Z');

async function one(input: string | Uint8Array, now = NOW): Promise<DecodedItem> {
  const r = await decode(input, now);
  if (!r.ok) throw new Error('errore ' + r.error);
  expect(r.items).toHaveLength(1);
  return r.items[0];
}

async function cert(input: string | Uint8Array, now = NOW): Promise<CertInfo> {
  const i = await one(input, now);
  if (i.kind !== 'certificate') throw new Error('atteso un certificato, trovato ' + i.kind);
  return i;
}

describe('certificato foglia RSA', () => {
  it('soggetto, emittente e numero seriale', async () => {
    const c = await cert(LEAF_PEM);
    expect(c.version).toBe(3);
    expect(c.subject.text).toBe('C=IT, ST=Lombardia, L=Milano, O=Esempio Srl, CN=www.esempio.test');
    expect(c.subject.entries[4]).toEqual({ oid: '2.5.4.3', label: 'CN', value: 'www.esempio.test' });
    expect(c.issuer.text).toBe('C=IT, O=Esempio Test CA, CN=Esempio Root CA');
    expect(c.selfSigned).toBe(false);
    expect(c.serial).toBe('7F:20:B7:57:99:6F:DE:58:C5:FF:5C:24:A2:01:C8:68:88:5E:AD:27');
  });
  it('validità e giorni alla scadenza', async () => {
    const c = await cert(LEAF_PEM);
    expect(c.validity.notBefore.toISOString()).toBe('2026-11-17T05:52:42.000Z');
    expect(c.validity.notAfter.toISOString()).toBe('2126-10-24T05:52:42.000Z');
    expect(c.validity.status).toBe('valid');
    expect(c.validity.daysLeft).toBe(Math.floor((Date.UTC(2126, 9, 24, 5, 52, 42) - NOW.getTime()) / 86400000));
    expect(c.validity.totalDays).toBeGreaterThan(36000);
  });
  it('SAN di ogni tipo', async () => {
    const c = await cert(LEAF_PEM);
    expect(c.san).toEqual([
      { type: 'dns', value: 'www.esempio.test' },
      { type: 'dns', value: 'esempio.test' },
      { type: 'ip', value: '192.0.2.10' },
      { type: 'email', value: 'info@esempio.test' },
      { type: 'uri', value: 'https://esempio.test/' },
    ]);
  });
  it('uso della chiave, uso esteso, basic constraints', async () => {
    const c = await cert(LEAF_PEM);
    expect(c.keyUsage).toEqual(['digitalSignature', 'keyEncipherment']);
    expect(c.extendedKeyUsage).toEqual([
      { oid: '1.3.6.1.5.5.7.3.1', name: 'serverAuth' },
      { oid: '1.3.6.1.5.5.7.3.2', name: 'clientAuth' },
    ]);
    expect(c.basicConstraints).toEqual({ ca: false, pathLen: null });
  });
  it('algoritmo e dimensione della chiave, firma', async () => {
    const c = await cert(LEAF_PEM);
    expect(c.key).toMatchObject({ algorithm: 'RSA', size: 2048, detail: 'e=65537' });
    expect(c.signature).toEqual({ oid: '1.2.840.113549.1.1.11', name: 'sha256WithRSAEncryption', weak: false });
  });
  it('SKI e AKI', async () => {
    const c = await cert(LEAF_PEM);
    expect(c.ski).toBe('14:9F:7F:FB:4B:A1:EF:43:D2:F8:50:DF:D6:A2:4F:88:A3:21:BE:C8');
    expect(c.aki).toBe('63:41:94:97:22:78:C0:80:28:8A:84:CA:1B:31:69:86:ED:AB:46:87');
    const ca = await cert(CA_PEM);
    expect(ca.ski).toBe(c.aki); // l'AKI della foglia è lo SKI della CA
  });
  it('impronte SHA-1 e SHA-256 come OpenSSL', async () => {
    const c = await cert(LEAF_PEM);
    expect(c.fingerprints.sha1).toBe('30:BE:BB:2C:AA:79:8C:EC:AB:55:14:18:6C:20:C6:BA:D6:0F:A5:A4');
    expect(c.fingerprints.sha256).toBe('F6:B1:9E:E6:3A:6F:96:16:FA:0D:8D:F7:6E:CB:9C:8D:33:90:20:84:AC:94:50:80:BA:E1:34:65:95:A0:31:34');
  });
  it('elenco delle estensioni con il flag critico', async () => {
    const c = await cert(LEAF_PEM);
    const byName = Object.fromEntries(c.extensions.map((e) => [e.name, e.critical]));
    expect(byName['keyUsage']).toBe(true);
    expect(byName['subjectAltName']).toBe(false);
    expect(Object.keys(byName)).toEqual(
      expect.arrayContaining(['subjectAltName', 'keyUsage', 'extendedKeyUsage', 'basicConstraints', 'subjectKeyIdentifier', 'authorityKeyIdentifier']),
    );
  });
});

describe('CA radice', () => {
  it('è autofirmata ed è una CA', async () => {
    const c = await cert(CA_PEM);
    expect(c.selfSigned).toBe(true);
    expect(c.basicConstraints).toEqual({ ca: true, pathLen: 0 });
    expect(c.keyUsage).toEqual(['keyCertSign', 'cRLSign']);
    expect(c.extensions.find((e) => e.name === 'basicConstraints')?.critical).toBe(true);
  });
});

describe('altri algoritmi', () => {
  it('EC P-256', async () => {
    const c = await cert(EC_PEM);
    expect(c.key).toMatchObject({ algorithm: 'EC', size: 256, detail: 'P-256 (prime256v1)' });
    expect(c.signature.name).toBe('ecdsa-with-SHA256');
    expect(c.san).toEqual([{ type: 'dns', value: 'ec.esempio.test' }]);
    expect(c.selfSigned).toBe(true);
    expect(c.fingerprints.sha256).toBe('F1:D2:55:FF:4A:19:BB:DD:43:B1:EB:5D:49:A2:30:52:E6:DF:2D:97:B9:CF:DF:E7:85:FD:52:A5:5C:7C:4D:48');
  });
  it('Ed25519', async () => {
    const c = await cert(ED_PEM);
    expect(c.key).toMatchObject({ algorithm: 'Ed25519', size: 256 });
    expect(c.signature.name).toBe('Ed25519');
    expect(c.san).toEqual([]);
    expect(c.keyUsage).toEqual([]);
    expect(c.basicConstraints).not.toBeNull(); // OpenSSL aggiunge basicConstraints CA:TRUE ai certificati autofirmati
  });
});

describe('validità', () => {
  it('scaduto', async () => {
    const c = await cert(OLD_PEM);
    expect(c.validity.status).toBe('expired');
    expect(c.validity.daysLeft).toBeLessThan(0);
    expect(c.validity.totalDays).toBe(1);
  });
  it('non ancora valido', async () => {
    const c = await cert(LEAF_PEM, new Date('2026-10-01T00:00:00Z'));
    expect(c.validity.status).toBe('not-yet');
    expect(c.validity.daysToStart).toBe(47);
  });
  it('computeValidity ai bordi', () => {
    const nb = new Date('2026-01-01T00:00:00Z');
    const na = new Date('2026-01-31T00:00:00Z');
    expect(computeValidity(nb, na, nb).status).toBe('valid');
    expect(computeValidity(nb, na, na).status).toBe('valid');
    expect(computeValidity(nb, na, new Date(na.getTime() + 1)).status).toBe('expired');
    expect(computeValidity(nb, na, new Date('2026-01-30T00:00:00Z')).daysLeft).toBe(1);
    expect(computeValidity(nb, na, new Date('2026-01-31T12:00:00Z')).daysLeft).toBe(-1);
  });
});

describe('CSR PKCS#10', () => {
  it('soggetto, chiave, SAN e firma', async () => {
    const i = await one(CSR_PEM);
    if (i.kind !== 'csr') throw new Error('atteso csr');
    const c: CsrInfo = i;
    expect(c.version).toBe(1);
    expect(c.subject.text).toBe('C=IT, O=Esempio, CN=csr.esempio.test');
    expect(c.key).toMatchObject({ algorithm: 'EC', size: 384, detail: 'P-384 (secp384r1)' });
    expect(c.signature.weak).toBe(false);
    expect(c.san).toEqual([
      { type: 'dns', value: 'csr.esempio.test' },
      { type: 'dns', value: 'alt.esempio.test' },
    ]);
    expect(c.signatureValid).toBe(true);
    expect(c.fingerprints.sha256).toBe('68:3E:02:13:DE:FE:A7:1C:BE:37:E0:BE:CB:EC:46:9C:49:17:87:DD:2E:96:EE:67:BA:E0:16:15:75:41:D3:32');
  });
  it('si riconosce anche con l\'intestazione NEW CERTIFICATE REQUEST', async () => {
    const i = await one(CSR_PEM.replace(/CERTIFICATE REQUEST/g, 'NEW CERTIFICATE REQUEST'));
    expect(i.kind).toBe('csr');
  });
  it('una CSR modificata ha la firma non valida', async () => {
    const lines = CSR_PEM.split('\n');
    // cambia un carattere nel corpo (dentro il soggetto: la firma non copre più i dati)
    const idx = lines.findIndex((l) => l.length === 64);
    lines[idx] = lines[idx].slice(0, 20) + (lines[idx][20] === 'A' ? 'B' : 'A') + lines[idx].slice(21);
    const r = await decode(lines.join('\n'), NOW);
    expect(r.ok).toBe(true);
    if (r.ok && r.items[0].kind === 'csr') expect(r.items[0].signatureValid).not.toBe(true);
  });
});

describe('catene e formati', () => {
  it('più certificati in un testo', async () => {
    const r = await decode(LEAF_PEM + '\n' + CA_PEM, NOW);
    if (!r.ok) throw new Error('atteso ok');
    expect(r.items.map((i) => (i.kind === 'certificate' ? i.subject.entries.at(-1)?.value : i.kind))).toEqual(['www.esempio.test', 'Esempio Root CA']);
  });
  it('certificato e CSR insieme', async () => {
    const r = await decode(CSR_PEM + '\n' + EC_PEM, NOW);
    if (!r.ok) throw new Error('atteso ok');
    expect(r.items.map((i) => i.kind)).toEqual(['csr', 'certificate']);
  });
  it('testo prima e dopo i blocchi, righe CRLF e spazi', async () => {
    const messy = 'Subject: qualcosa\r\n' + EC_PEM.replace(/\n/g, '\r\n') + '\r\n\r\nnote finali';
    expect((await cert(messy)).subject.text).toBe('CN=ec.esempio.test');
  });
  it('DER binario', async () => {
    const der = base64ToBytes(EC_DER_BASE64)!;
    expect(der[0]).toBe(0x30);
    const c = await cert(der);
    expect(c.subject.text).toBe('CN=ec.esempio.test');
    expect(c.size).toBe(der.length);
    expect(c.fingerprints.sha256).toBe('F1:D2:55:FF:4A:19:BB:DD:43:B1:EB:5D:49:A2:30:52:E6:DF:2D:97:B9:CF:DF:E7:85:FD:52:A5:5C:7C:4D:48');
  });
  it('base64 senza intestazioni', async () => {
    expect((await cert(EC_DER_BASE64)).subject.text).toBe('CN=ec.esempio.test');
    expect((await cert(EC_DER_BASE64.replace(/(.{64})/g, '$1\n'))).subject.text).toBe('CN=ec.esempio.test');
  });
  it('file PEM caricato come byte', async () => {
    const c = await cert(new TextEncoder().encode(EC_PEM));
    expect(c.subject.text).toBe('CN=ec.esempio.test');
  });
  it('estrae i blocchi PEM', () => {
    const blocks = extractPemBlocks(LEAF_PEM + CA_PEM + CSR_PEM);
    expect(blocks.map((b) => b.label)).toEqual(['CERTIFICATE', 'CERTIFICATE', 'CERTIFICATE REQUEST']);
    expect(blocks[0].base64).not.toMatch(/\s/);
  });
});

describe('errori', () => {
  it('input vuoto', async () => {
    expect(await decode('')).toEqual({ ok: false, error: 'empty' });
    expect(await decode('   \n ')).toEqual({ ok: false, error: 'empty' });
    expect(await decode(new Uint8Array(0))).toEqual({ ok: false, error: 'empty' });
  });
  it('testo che non è PEM né base64', async () => {
    expect(await decode('ciao, questo non è un certificato!')).toEqual({ ok: false, error: 'no-pem' });
  });
  it('troppo grande', async () => {
    expect(await decode('A'.repeat(3 * 1024 * 1024))).toEqual({ ok: false, error: 'too-large' });
  });
  it('base64 non valido dentro il blocco', async () => {
    const r = await decode('-----BEGIN CERTIFICATE-----\n@@@@@@@@\n-----END CERTIFICATE-----');
    expect(r).toEqual({ ok: true, items: [{ kind: 'error', error: 'bad-base64', label: 'CERTIFICATE' }] });
  });
  it('contenuto base64 che non è un certificato', async () => {
    const r = await decode('-----BEGIN CERTIFICATE-----\nSGVsbG8gd29ybGQ=\n-----END CERTIFICATE-----');
    expect(r).toMatchObject({ ok: true, items: [{ kind: 'error', error: 'bad-der' }] });
  });
  it('DER valido ma non un certificato', async () => {
    // SEQUENCE { INTEGER 1 }
    const r = await decode(new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x01]));
    expect(r).toMatchObject({ ok: true, items: [{ kind: 'error', error: 'not-cert' }] });
  });
  it('certificato troncato', async () => {
    const lines = EC_PEM.split('\n');
    const cut = [lines[0], lines[1], lines[2], lines[lines.length - 1]].join('\n');
    const r = await decode(cut);
    expect(r).toMatchObject({ ok: true, items: [{ kind: 'error' }] });
  });
  it('chiave privata: avvisa e non la decodifica', async () => {
    const r = await decode('-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----');
    expect(r).toEqual({ ok: true, items: [{ kind: 'error', error: 'private-key', label: 'PRIVATE KEY' }] });
    const r2 = await decode('-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----');
    expect(r2).toMatchObject({ ok: true, items: [{ error: 'private-key' }] });
  });
  it('tipo PEM non supportato', async () => {
    const r = await decode('-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----');
    expect(r).toEqual({ ok: true, items: [{ kind: 'error', error: 'unsupported-type', label: 'PUBLIC KEY' }] });
  });
  it('un blocco rotto non impedisce di leggere gli altri', async () => {
    const r = await decode('-----BEGIN CERTIFICATE-----\nSGVsbG8=\n-----END CERTIFICATE-----\n' + EC_PEM);
    if (!r.ok) throw new Error('atteso ok');
    expect(r.items.map((i) => i.kind)).toEqual(['error', 'certificate']);
  });
});

describe('utilità', () => {
  it('esadecimale con i due punti', () => {
    expect(toHexColon(Uint8Array.of(0, 1, 171, 255))).toBe('00:01:AB:FF');
  });
  it('seriale senza zero di segno', () => {
    expect(serialHex(Uint8Array.of(0, 0x80, 0x01))).toBe('80:01');
    expect(serialHex(Uint8Array.of(0))).toBe('00');
    expect(serialHex(Uint8Array.of(0x7f, 0x00))).toBe('7F:00');
  });
  it('bit di un intero', () => {
    expect(bitLength(Uint8Array.of(0))).toBe(0);
    expect(bitLength(Uint8Array.of(1))).toBe(1);
    expect(bitLength(Uint8Array.of(0, 0x80))).toBe(8);
    expect(bitLength(Uint8Array.of(0x01, 0x00))).toBe(9);
    expect(bitLength(Uint8Array.of(0xff, 0xff, 0xff))).toBe(24);
  });
  it('indirizzi IP', () => {
    expect(formatIp(Uint8Array.of(10, 0, 0, 1))).toBe('10.0.0.1');
    expect(formatIp(Uint8Array.of(0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1))).toBe('2001:db8::1');
    expect(formatIp(new Uint8Array(16))).toBe('::');
    expect(formatIp(Uint8Array.of(0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8))).toBe('1:2:3:4:5:6:7:8');
    expect(formatIp(Uint8Array.of(1, 2, 3))).toBe('01:02:03');
  });
  it('base64 non valido', () => {
    expect(base64ToBytes('@@@')).toBeNull();
    expect(base64ToBytes('')).toBeNull();
    expect(base64ToBytes('QUJD')).toEqual(Uint8Array.of(65, 66, 67));
  });
});
