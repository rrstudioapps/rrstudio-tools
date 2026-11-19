// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  binaryOctets,
  compressIpv6,
  expandIpv6,
  formatIpv4,
  groupDigits,
  ipv4Class,
  ipv4Contains,
  ipv4Info,
  ipv4Kind,
  ipv6Contains,
  ipv6Info,
  ipv6Kind,
  maskOf,
  parseIpv4,
  parseIpv4Cidr,
  parseIpv6,
  parseIpv6Cidr,
  parseRequests,
  prefixForHosts,
  prefixOfMask,
  splitByCount,
  splitByHosts,
  vlsm,
} from './subnet';

const ip = (s: string) => parseIpv4(s) as number;
const f = formatIpv4;

describe('IPv4: lettura', () => {
  it('indirizzi validi e non validi', () => {
    expect(f(ip('192.168.1.10'))).toBe('192.168.1.10');
    expect(parseIpv4('255.255.255.255')).toBe(0xffffffff);
    expect(parseIpv4('256.1.1.1')).toBeNull();
    expect(parseIpv4('1.2.3')).toBeNull();
    expect(parseIpv4('1.2.3.4.5')).toBeNull();
    expect(parseIpv4('01.2.3.4')).toBeNull();
    expect(parseIpv4('a.b.c.d')).toBeNull();
  });
  it('maschere', () => {
    expect(prefixOfMask('255.255.255.0')).toBe(24);
    expect(prefixOfMask('255.255.254.0')).toBe(23);
    expect(prefixOfMask('0.0.0.0')).toBe(0);
    expect(prefixOfMask('255.0.255.0')).toBeNull();
    expect(f(maskOf(20))).toBe('255.255.240.0');
    expect(f(maskOf(0))).toBe('0.0.0.0');
    expect(f(maskOf(32))).toBe('255.255.255.255');
  });
  it('formati CIDR, maschera e senza prefisso', () => {
    expect(parseIpv4Cidr('10.0.0.5/8')).toEqual({ ip: ip('10.0.0.5'), prefix: 8 });
    expect(parseIpv4Cidr('10.0.0.5 255.255.0.0')).toEqual({ ip: ip('10.0.0.5'), prefix: 16 });
    expect(parseIpv4Cidr('10.0.0.5/255.255.255.128')).toEqual({ ip: ip('10.0.0.5'), prefix: 25 });
    expect(parseIpv4Cidr('10.0.0.5')).toEqual({ ip: ip('10.0.0.5'), prefix: 32 });
    expect(parseIpv4Cidr('  10.0.0.5 / 24 ')).toEqual({ ip: ip('10.0.0.5'), prefix: 24 });
    expect(parseIpv4Cidr('')).toEqual({ error: 'empty' });
    expect(parseIpv4Cidr('10.0.0/24')).toEqual({ error: 'badAddress' });
    expect(parseIpv4Cidr('10.0.0.5/33')).toEqual({ error: 'badPrefix' });
    expect(parseIpv4Cidr('10.0.0.5/x')).toEqual({ error: 'badPrefix' });
    expect(parseIpv4Cidr('10.0.0.5 255.0.255.0')).toEqual({ error: 'badMask' });
  });
});

describe('IPv4: informazioni sulla rete', () => {
  it('192.168.1.10/24', () => {
    const i = ipv4Info(ip('192.168.1.10'), 24);
    expect(f(i.network)).toBe('192.168.1.0');
    expect(f(i.broadcast)).toBe('192.168.1.255');
    expect(f(i.firstHost)).toBe('192.168.1.1');
    expect(f(i.lastHost)).toBe('192.168.1.254');
    expect(i.hosts).toBe(254);
    expect(i.total).toBe(256);
    expect(f(i.mask)).toBe('255.255.255.0');
    expect(f(i.wildcard)).toBe('0.0.0.255');
    expect(i.cls).toBe('C');
    expect(i.kind).toBe('private');
  });
  it('prefisso non a confine di ottetto: 172.16.37.9/20', () => {
    const i = ipv4Info(ip('172.16.37.9'), 20);
    expect(f(i.network)).toBe('172.16.32.0');
    expect(f(i.broadcast)).toBe('172.16.47.255');
    expect(i.hosts).toBe(4094);
    expect(i.cls).toBe('B');
  });
  it('/31 (RFC 3021) e /32', () => {
    const a = ipv4Info(ip('10.0.0.1'), 31);
    expect([f(a.firstHost), f(a.lastHost), a.hosts]).toEqual(['10.0.0.0', '10.0.0.1', 2]);
    const b = ipv4Info(ip('10.0.0.7'), 32);
    expect([f(b.network), f(b.firstHost), f(b.lastHost), f(b.broadcast), b.hosts]).toEqual(['10.0.0.7', '10.0.0.7', '10.0.0.7', '10.0.0.7', 1]);
  });
  it('/0 e /30', () => {
    const z = ipv4Info(ip('8.8.8.8'), 0);
    expect([f(z.network), f(z.broadcast), z.total]).toEqual(['0.0.0.0', '255.255.255.255', 4294967296]);
    expect(z.hosts).toBe(4294967294);
    const t = ipv4Info(ip('192.0.2.5'), 30);
    expect([f(t.firstHost), f(t.lastHost), t.hosts]).toEqual(['192.0.2.5', '192.0.2.6', 2]);
  });
  it('classi', () => {
    expect(ipv4Class(ip('1.1.1.1'))).toBe('A');
    expect(ipv4Class(ip('128.0.0.1'))).toBe('B');
    expect(ipv4Class(ip('192.0.0.1'))).toBe('C');
    expect(ipv4Class(ip('224.0.0.1'))).toBe('D');
    expect(ipv4Class(ip('240.0.0.1'))).toBe('E');
  });
  it('tipi di indirizzo', () => {
    const k = (s: string) => ipv4Kind(ip(s));
    expect(k('10.1.2.3')).toBe('private');
    expect(k('172.16.0.1')).toBe('private');
    expect(k('172.31.255.255')).toBe('private');
    expect(k('172.32.0.1')).toBe('public');
    expect(k('172.15.255.255')).toBe('public');
    expect(k('192.168.0.1')).toBe('private');
    expect(k('127.0.0.1')).toBe('loopback');
    expect(k('169.254.10.10')).toBe('linkLocal');
    expect(k('100.64.0.1')).toBe('cgnat');
    expect(k('100.127.255.255')).toBe('cgnat');
    expect(k('100.128.0.1')).toBe('public');
    expect(k('224.0.0.251')).toBe('multicast');
    expect(k('239.255.255.250')).toBe('multicast');
    expect(k('192.0.2.1')).toBe('documentation');
    expect(k('198.51.100.7')).toBe('documentation');
    expect(k('203.0.113.9')).toBe('documentation');
    expect(k('198.18.0.1')).toBe('benchmark');
    expect(k('0.0.0.0')).toBe('unspecified');
    expect(k('255.255.255.255')).toBe('broadcast');
    expect(k('250.1.1.1')).toBe('reserved');
    expect(k('8.8.8.8')).toBe('public');
  });
  it('binario con il confine di rete', () => {
    const o = binaryOctets(ip('192.168.1.10'), 20);
    expect(o.map((x) => x.net + '|' + x.host)).toEqual(['11000000|', '10101000|', '0000|0001', '|00001010']);
  });
  it('appartenenza', () => {
    const net = ip('192.168.1.0');
    expect(ipv4Contains(net, 24, ip('192.168.1.200'))).toBe(true);
    expect(ipv4Contains(net, 24, ip('192.168.2.1'))).toBe(false);
    expect(ipv4Contains(ip('128.0.0.0'), 1, ip('200.1.1.1'))).toBe(true);
    expect(ipv4Contains(0, 0, ip('1.2.3.4'))).toBe(true);
  });
});

describe('IPv4: suddivisione', () => {
  it('in 4 sottoreti', () => {
    const r = splitByCount(ip('192.168.1.0'), 24, 4);
    if ('error' in r) throw new Error(r.error);
    expect(r.newPrefix).toBe(26);
    expect(r.rows.map((x) => f(x.network))).toEqual(['192.168.1.0', '192.168.1.64', '192.168.1.128', '192.168.1.192']);
    expect(r.rows[0].hosts).toBe(62);
    expect(f(r.rows[3].broadcast)).toBe('192.168.1.255');
  });
  it('3 sottoreti arrotondano a 4; 1 resta uguale', () => {
    const r = splitByCount(ip('10.0.0.0'), 24, 3);
    if ('error' in r) throw new Error(r.error);
    expect(r.count).toBe(4);
    const one = splitByCount(ip('10.0.0.0'), 24, 1);
    if ('error' in one) throw new Error(one.error);
    expect(one.newPrefix).toBe(24);
    expect(one.rows).toHaveLength(1);
  });
  it('errori', () => {
    expect(splitByCount(ip('10.0.0.0'), 24, 0)).toEqual({ error: 'badCount' });
    expect(splitByCount(ip('10.0.0.0'), 24, 1.5)).toEqual({ error: 'badCount' });
    expect(splitByCount(ip('10.0.0.0'), 30, 8)).toEqual({ error: 'tooMany' });
  });
  it('elenco limitato ma conteggio esatto', () => {
    const r = splitByCount(ip('10.0.0.0'), 8, 65536);
    if ('error' in r) throw new Error(r.error);
    expect(r.count).toBe(65536);
    expect(r.rows).toHaveLength(256);
    expect(r.truncated).toBe(true);
  });
  it('per numero di host', () => {
    const r = splitByHosts(ip('192.168.0.0'), 24, 50);
    if ('error' in r) throw new Error(r.error);
    expect(r.newPrefix).toBe(26);
    expect(r.count).toBe(4);
    expect(splitByHosts(ip('192.168.0.0'), 24, 254)).toMatchObject({ newPrefix: 24, count: 1 });
    expect(splitByHosts(ip('192.168.0.0'), 24, 255)).toEqual({ error: 'tooBig' });
    expect(splitByHosts(ip('192.168.0.0'), 24, 0)).toEqual({ error: 'badHosts' });
  });
  it('prefisso per host', () => {
    expect(prefixForHosts(2)).toBe(30);
    expect(prefixForHosts(1)).toBe(30);
    expect(prefixForHosts(3)).toBe(29);
    expect(prefixForHosts(6)).toBe(29);
    expect(prefixForHosts(7)).toBe(28);
    expect(prefixForHosts(254)).toBe(24);
    expect(prefixForHosts(255)).toBe(23);
    expect(prefixForHosts(0)).toBeNull();
  });
});

describe('VLSM', () => {
  it('assegna dal più grande al più piccolo, in modo contiguo', () => {
    const r = vlsm(ip('192.168.10.0'), 24, [20, 100, 50, 2]);
    expect(r.failed).toEqual([]);
    expect(r.allocations.map((a) => `${f(a.network)}/${a.prefix}`)).toEqual(['192.168.10.0/25', '192.168.10.128/26', '192.168.10.192/27', '192.168.10.224/30']);
    expect(r.allocations.map((a) => a.requested)).toEqual([100, 50, 20, 2]);
    expect(r.free).toBe(28);
  });
  it('richieste che non entrano', () => {
    const r = vlsm(ip('10.0.0.0'), 24, [200, 100]);
    expect(r.allocations).toHaveLength(1);
    expect(r.failed).toEqual([100]);
    const big = vlsm(ip('10.0.0.0'), 24, [1000]);
    expect(big.failed).toEqual([1000]);
  });
  it('i blocchi non si sovrappongono', () => {
    const r = vlsm(ip('10.0.0.0'), 22, [300, 200, 100, 60, 30, 10, 5, 2, 2]);
    expect(r.failed).toEqual([]);
    for (let i = 1; i < r.allocations.length; i++) expect(r.allocations[i].network).toBeGreaterThan(r.allocations[i - 1].broadcast);
  });
  it('lettura delle richieste', () => {
    expect(parseRequests('100, 50 20\n2')).toEqual([100, 50, 20, 2]);
    expect(parseRequests('')).toBeNull();
    expect(parseRequests('10, abc')).toBeNull();
    expect(parseRequests('0')).toBeNull();
    expect(parseRequests('-5')).toBeNull();
  });
});

describe('IPv6', () => {
  it('lettura', () => {
    expect(parseIpv6('::')).toBe(0n);
    expect(parseIpv6('::1')).toBe(1n);
    expect(parseIpv6('2001:db8::1')).toBe(0x20010db8000000000000000000000001n);
    expect(parseIpv6('2001:0DB8:0000:0000:0000:0000:0000:0001')).toBe(0x20010db8000000000000000000000001n);
    expect(parseIpv6('::ffff:192.0.2.1')).toBe(0xffffc0000201n);
    expect(parseIpv6('1:2:3:4:5:6:7:8')).toBe(0x00010002000300040005000600070008n);
    expect(parseIpv6('1::')).toBe(1n << 112n);
  });
  it('indirizzi non validi', () => {
    for (const bad of ['', ':::', '1::2::3', '1:2:3:4:5:6:7', '1:2:3:4:5:6:7:8:9', '12345::', 'g::1', '::1.2.3', '1.2.3.4', ':1', '1:', '1:2:3:4:5:6:7::8', '2001:db8::1%eth0']) {
      expect(parseIpv6(bad), bad).toBeNull();
    }
  });
  it('espansione', () => {
    expect(expandIpv6(parseIpv6('2001:db8::1') as bigint)).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
    expect(expandIpv6(0n)).toBe('0000:0000:0000:0000:0000:0000:0000:0000');
  });
  it('compressione RFC 5952', () => {
    const c = (s: string) => compressIpv6(parseIpv6(s) as bigint);
    expect(c('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
    expect(c('0:0:0:0:0:0:0:0')).toBe('::');
    expect(c('0:0:0:0:0:0:0:1')).toBe('::1');
    // un solo gruppo di zeri non si comprime
    expect(c('2001:db8:0:1:1:1:1:1')).toBe('2001:db8:0:1:1:1:1:1');
    // la sequenza più lunga vince, a parità la prima
    expect(c('2001:0:0:1:0:0:0:1')).toBe('2001:0:0:1::1');
    expect(c('2001:db8:0:0:1:0:0:1')).toBe('2001:db8::1:0:0:1');
    expect(c('fe80:0:0:0:0:0:0:0')).toBe('fe80::');
    expect(c('2001:DB8::ABCD')).toBe('2001:db8::abcd');
  });
  it('prefisso e intervallo', () => {
    const i = ipv6Info(parseIpv6('2001:db8:abcd:12::1') as bigint, 64);
    expect(compressIpv6(i.first)).toBe('2001:db8:abcd:12::');
    expect(compressIpv6(i.last)).toBe('2001:db8:abcd:12:ffff:ffff:ffff:ffff');
    expect(i.total).toBe('18446744073709551616');
    expect(i.networkCidr).toBe('2001:db8:abcd:12::/64');
    const all = ipv6Info(5n, 0);
    expect(all.total).toBe('340282366920938463463374607431768211456');
    expect(all.last).toBe((1n << 128n) - 1n);
    expect(ipv6Info(5n, 128).total).toBe('1');
  });
  it('tipi', () => {
    const k = (s: string) => ipv6Kind(parseIpv6(s) as bigint);
    expect(k('::')).toBe('unspecified');
    expect(k('::1')).toBe('loopback');
    expect(k('fd12:3456:789a::1')).toBe('ula');
    expect(k('fc00::1')).toBe('ula');
    expect(k('fe80::1')).toBe('linkLocal');
    expect(k('febf::1')).toBe('linkLocal');
    expect(k('fec0::1')).toBe('reserved');
    expect(k('ff02::1')).toBe('multicast');
    expect(k('2001:db8::1')).toBe('documentation');
    expect(k('2606:4700::1111')).toBe('global');
    expect(k('::ffff:1.2.3.4')).toBe('ipv4Mapped');
    expect(k('64:ff9b::1.2.3.4')).toBe('nat64');
    expect(k('4000::1')).toBe('reserved');
  });
  it('CIDR e appartenenza', () => {
    expect(parseIpv6Cidr('2001:db8::/32')).toEqual({ ip: 0x20010db8n << 96n, prefix: 32 });
    expect(parseIpv6Cidr('::1')).toEqual({ ip: 1n, prefix: 128 });
    expect(parseIpv6Cidr('::1/129')).toEqual({ error: 'badPrefix' });
    expect(parseIpv6Cidr('zz/64')).toEqual({ error: 'badAddress' });
    expect(parseIpv6Cidr('')).toEqual({ error: 'empty' });
    const net = parseIpv6('2001:db8::') as bigint;
    expect(ipv6Contains(net, 32, parseIpv6('2001:db8:ffff::1') as bigint)).toBe(true);
    expect(ipv6Contains(net, 32, parseIpv6('2001:db9::1') as bigint)).toBe(false);
  });
});

describe('utilità', () => {
  it('raggruppa le cifre', () => {
    expect(groupDigits('18446744073709551616', '.')).toBe('18.446.744.073.709.551.616');
    expect(groupDigits('999', '.')).toBe('999');
    expect(groupDigits('1000', ',')).toBe('1,000');
  });
});
