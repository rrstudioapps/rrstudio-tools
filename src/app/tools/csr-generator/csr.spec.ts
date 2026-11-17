// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { decode } from '../certificate-decoder/cert';
import type { CsrInfo } from '../certificate-decoder/cert';
import { CsrError, EMPTY_SUBJECT, buildCsr, decodePem, detectKeyAlgo, ipToBytes, isDnsName, parseSanList, subjectAttributes } from './csr';

const hex = (b: Uint8Array | null) => (b ? Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('') : null);

describe('soggetto', () => {
  it('ordine C, ST, L, O, OU, CN, email e salto dei campi vuoti', () => {
    const a = subjectAttributes({ cn: 'example.com', o: 'Esempio SRL', ou: 'IT', l: 'Milano', st: 'MI', c: ' it ', email: 'a@example.com' });
    expect(a.map((x) => x.label)).toEqual(['C', 'ST', 'L', 'O', 'OU', 'CN', 'emailAddress']);
    expect(a[0]).toMatchObject({ value: 'IT', oid: '2.5.4.6', string: 'printable' });
    expect(a[6]).toMatchObject({ oid: '1.2.840.113549.1.9.1', string: 'ia5' });
    expect(subjectAttributes({ ...EMPTY_SUBJECT, cn: 'x.it' }).map((x) => x.label)).toEqual(['CN']);
  });
  it('rifiuta soggetto vuoto e paese non valido', () => {
    expect(() => subjectAttributes(EMPTY_SUBJECT)).toThrow(CsrError);
    expect(() => subjectAttributes({ ...EMPTY_SUBJECT, cn: 'x', c: 'ITA' })).toThrow(CsrError);
  });
});

describe('SAN', () => {
  it('separa DNS e IP, toglie doppioni e prefissi', () => {
    const l = parseSanList('example.com, www.example.com\n*.example.com 10.0.0.1;DNS:EXAMPLE.com ip:2001:db8::1');
    expect(l.dns).toEqual(['example.com', 'www.example.com', '*.example.com']);
    expect(l.ip).toEqual(['10.0.0.1', '2001:db8::1']);
    expect(l.invalid).toEqual([]);
  });
  it('segnala le voci non valide', () => {
    expect(parseSanList('good.it bad_name! -x.com 999.1.1.1 a..b').invalid).toEqual(['bad_name!', '-x.com', '999.1.1.1', 'a..b']);
  });
  it('indirizzi in byte', () => {
    expect(hex(ipToBytes('192.168.1.10'))).toBe('c0a8010a');
    expect(hex(ipToBytes('::1'))).toBe('00000000000000000000000000000001');
    expect(hex(ipToBytes('2001:db8::ff00:42:8329'))).toBe('20010db8000000000000ff0000428329');
    expect(hex(ipToBytes('::ffff:1.2.3.4'))).toBe('00000000000000000000ffff01020304');
    expect(ipToBytes('1:2:3:4:5:6:7:8:9')).toBeNull();
    expect(ipToBytes('1::2::3')).toBeNull();
    expect(ipToBytes('256.0.0.1')).toBeNull();
  });
  it('nomi DNS', () => {
    expect(isDnsName('a-b.example.com')).toBe(true);
    expect(isDnsName('*.example.com')).toBe(true);
    expect(isDnsName('exa*mple.com')).toBe(false);
    expect(isDnsName('')).toBe(false);
  });
});

describe('CSR generato e riletto', () => {
  const subject = { cn: 'www.example.com', o: 'Esempio SRL', ou: 'IT', l: 'Milano', st: 'MI', c: 'it', email: 'admin@example.com' };
  const san = parseSanList('www.example.com example.com 192.0.2.7 2001:db8::1');

  it('ECDSA P-256: soggetto, SAN, chiave e firma validi', async () => {
    const r = await buildCsr({ subject, san, key: { type: 'ecdsa', curve: 'P-256' } });
    expect(r.csrPem).toMatch(/^-----BEGIN CERTIFICATE REQUEST-----\n/);
    expect(r.keyPem).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);
    const d = await decode(r.csrPem);
    expect(d.ok).toBe(true);
    const item = (d as { items: CsrInfo[] }).items[0];
    expect(item.kind).toBe('csr');
    expect(item.subject.entries.map((e) => e.label + '=' + e.value)).toEqual(['C=IT', 'ST=MI', 'L=Milano', 'O=Esempio SRL', 'OU=IT', 'CN=www.example.com', 'emailAddress=admin@example.com'].map((s) => s));
    expect(item.san.map((s) => s.type + ':' + s.value)).toEqual(['dns:www.example.com', 'dns:example.com', 'ip:192.0.2.7', 'ip:2001:db8::1']);
    expect(item.key.algorithm).toMatch(/EC/);
    expect(item.signatureValid).toBe(true);
  });

  it('ogni campo del soggetto è un RDN separato (niente RDN multivalore)', async () => {
    const asn1js = await import('asn1js');
    const r = await buildCsr({ subject, san, key: { type: 'ecdsa', curve: 'P-256' } });
    const top = asn1js.fromBER(r.csrDer.slice().buffer as ArrayBuffer).result as InstanceType<typeof asn1js.Sequence>;
    const certInfo = top.valueBlock.value[0] as InstanceType<typeof asn1js.Sequence>;
    const name = certInfo.valueBlock.value[1] as InstanceType<typeof asn1js.Sequence>;
    expect(name.valueBlock.value.length).toBe(7);
    for (const rdn of name.valueBlock.value) expect((rdn as InstanceType<typeof asn1js.Set>).valueBlock.value.length).toBe(1);
  });

  it('ECDSA P-384 usa SHA-384', async () => {
    const r = await buildCsr({ subject: { ...EMPTY_SUBJECT, cn: 'a.example' }, san: parseSanList(''), key: { type: 'ecdsa', curve: 'P-384' } });
    const item = ((await decode(r.csrPem)) as { items: CsrInfo[] }).items[0];
    expect(item.signature.name).toMatch(/384/);
    expect(item.san).toEqual([]);
    expect(item.signatureValid).toBe(true);
  });

  it('RSA 2048', async () => {
    const r = await buildCsr({ subject: { ...EMPTY_SUBJECT, cn: 'rsa.example' }, san: parseSanList('rsa.example'), key: { type: 'rsa', bits: 2048 } });
    const item = ((await decode(r.csrPem)) as { items: CsrInfo[] }).items[0];
    expect(item.key.size).toBe(2048);
    expect(item.signature.name).toMatch(/256/);
    expect(item.signatureValid).toBe(true);
  });

  it('chiave esistente PKCS#8: stessa chiave pubblica, nessuna chiave privata in uscita', async () => {
    const first = await buildCsr({ subject: { ...EMPTY_SUBJECT, cn: 'one.example' }, san: parseSanList(''), key: { type: 'ecdsa', curve: 'P-256' } });
    const again = await buildCsr({ subject: { ...EMPTY_SUBJECT, cn: 'two.example' }, san: parseSanList('two.example'), key: { type: 'existing', pem: first.keyPem! } });
    expect(again.keyPem).toBeNull();
    const a = ((await decode(first.csrPem)) as { items: CsrInfo[] }).items[0];
    const b = ((await decode(again.csrPem)) as { items: CsrInfo[] }).items[0];
    expect(b.signatureValid).toBe(true);
    expect(b.subject.text).toContain('two.example');
    expect(b.key).toEqual(a.key);
  });

  it('chiave esistente RSA', async () => {
    const first = await buildCsr({ subject: { ...EMPTY_SUBJECT, cn: 'one.example' }, san: parseSanList(''), key: { type: 'rsa', bits: 2048 } });
    const again = await buildCsr({ subject: { ...EMPTY_SUBJECT, cn: 'two.example' }, san: parseSanList(''), key: { type: 'existing', pem: first.keyPem! } });
    expect(((await decode(again.csrPem)) as { items: CsrInfo[] }).items[0].signatureValid).toBe(true);
  });

  it('errori sulle chiavi incollate', async () => {
    const base = { subject: { ...EMPTY_SUBJECT, cn: 'x.it' }, san: parseSanList('') };
    await expect(buildCsr({ ...base, key: { type: 'existing', pem: '-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n-----END ENCRYPTED PRIVATE KEY-----' } })).rejects.toMatchObject({ code: 'key-encrypted' });
    await expect(buildCsr({ ...base, key: { type: 'existing', pem: 'non una chiave' } })).rejects.toMatchObject({ code: 'key-format' });
    await expect(buildCsr({ ...base, key: { type: 'existing', pem: '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----' } })).rejects.toBeInstanceOf(CsrError);
    await expect(buildCsr({ subject: EMPTY_SUBJECT, san: parseSanList(''), key: { type: 'ecdsa', curve: 'P-256' } })).rejects.toMatchObject({ code: 'empty-subject' });
    await expect(buildCsr({ ...base, san: parseSanList('bad!'), key: { type: 'ecdsa', curve: 'P-256' } })).rejects.toMatchObject({ code: 'bad-san' });
  });

  it('riconosce l\'algoritmo di un PKCS#8', async () => {
    const r = await buildCsr({ subject: { ...EMPTY_SUBJECT, cn: 'x' }, san: parseSanList(''), key: { type: 'ecdsa', curve: 'P-384' } });
    const algo = await detectKeyAlgo(decodePem(r.keyPem!, 'PRIVATE KEY')!);
    expect(algo.rsa).toBe(false);
    expect(algo.hash).toBe('SHA-384');
  });
});
