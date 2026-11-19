// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  detectUnit,
  fieldsIn,
  formatIso,
  formatRelative,
  formatRfc2822,
  isValidTimeZone,
  msToTimestamp,
  offsetMinutes,
  parseBatch,
  parseDate,
  parseTimestamp,
  relativeParts,
  timeZoneList,
} from './timestamp';

const ROME = 'Europe/Rome';
const NY = 'America/New_York';
const iso = (s: string): number => Date.parse(s);

describe('parseTimestamp', () => {
  it('riconosce secondi, millisecondi, microsecondi e nanosecondi', () => {
    expect(parseTimestamp('1700000000')).toEqual({ ok: true, ms: 1700000000_000, unit: 's', auto: true });
    expect(parseTimestamp('1700000000123')).toEqual({ ok: true, ms: 1700000000_123, unit: 'ms', auto: true });
    expect(parseTimestamp('1700000000123456')).toEqual({ ok: true, ms: 1700000000_123, unit: 'us', auto: true });
    expect(parseTimestamp('1700000000123456789')).toEqual({ ok: true, ms: 1700000000_123, unit: 'ns', auto: true });
  });
  it('soglie dell\'auto-rilevamento', () => {
    expect(detectUnit(99_999_999_999n)).toBe('s');
    expect(detectUnit(100_000_000_000n)).toBe('ms');
    expect(detectUnit(99_999_999_999_999n)).toBe('ms');
    expect(detectUnit(100_000_000_000_000n)).toBe('us');
    expect(detectUnit(100_000_000_000_000_000n)).toBe('ns');
  });
  it('unità scelta a mano, decimali e segno', () => {
    expect(parseTimestamp('1700000000', 'ms')).toMatchObject({ ok: true, ms: 1700000000, unit: 'ms', auto: false });
    expect(parseTimestamp('1700000000.5')).toMatchObject({ ok: true, ms: 1700000000_500 });
    expect(parseTimestamp('1700000000,25')).toMatchObject({ ok: true, ms: 1700000000_250 });
    expect(parseTimestamp('0')).toMatchObject({ ok: true, ms: 0 });
    expect(parseTimestamp('-1')).toMatchObject({ ok: true, ms: -1000 });
    expect(parseTimestamp('-1500', 'ms')).toMatchObject({ ok: true, ms: -1500 });
    // arrotondamento per difetto anche sotto zero: -0,5 ms → -1 ms
    expect(parseTimestamp('-1', 'us')).toMatchObject({ ok: true, ms: -1 });
  });
  it('errori', () => {
    expect(parseTimestamp('')).toEqual({ ok: false, error: 'empty' });
    expect(parseTimestamp('12ab')).toEqual({ ok: false, error: 'format' });
    expect(parseTimestamp('1e9')).toEqual({ ok: false, error: 'format' });
    expect(parseTimestamp('99999999999999', 's')).toEqual({ ok: false, error: 'range' });
  });
  it('nanosecondi senza perdere precisione oltre 2^53', () => {
    const r = parseTimestamp('1700000000999999999', 'ns');
    expect(r).toMatchObject({ ok: true, ms: 1700000000_999 });
  });
});

describe('msToTimestamp', () => {
  it('nelle quattro unità', () => {
    const ms = 1700000000_123;
    expect(msToTimestamp(ms, 's')).toBe('1700000000');
    expect(msToTimestamp(ms, 'ms')).toBe('1700000000123');
    expect(msToTimestamp(ms, 'us')).toBe('1700000000123000');
    expect(msToTimestamp(ms, 'ns')).toBe('1700000000123000000');
    expect(msToTimestamp(-1, 's')).toBe('-1');
  });
});

describe('formati e fusi', () => {
  const t = 1700000000_000; // 2023-11-14T22:13:20Z
  it('ISO 8601', () => {
    expect(formatIso(t, 'UTC')).toBe('2023-11-14T22:13:20.000Z');
    expect(formatIso(t, ROME)).toBe('2023-11-14T23:13:20.000+01:00');
    expect(formatIso(t, NY)).toBe('2023-11-14T17:13:20.000-05:00');
    expect(formatIso(t + 5, 'Asia/Kolkata')).toBe('2023-11-15T03:43:20.005+05:30');
  });
  it('RFC 2822', () => {
    expect(formatRfc2822(t, 'UTC')).toBe('Tue, 14 Nov 2023 22:13:20 +0000');
    expect(formatRfc2822(t, ROME)).toBe('Tue, 14 Nov 2023 23:13:20 +0100');
    expect(formatRfc2822(t, NY)).toBe('Tue, 14 Nov 2023 17:13:20 -0500');
  });
  it('epoca e date prima del 1970', () => {
    expect(formatIso(0, 'UTC')).toBe('1970-01-01T00:00:00.000Z');
    expect(formatIso(-1, 'UTC')).toBe('1969-12-31T23:59:59.999Z');
    expect(formatIso(-1, NY)).toBe('1969-12-31T18:59:59.999-05:00');
  });
  it('campi e scarto', () => {
    expect(fieldsIn(t, ROME)).toMatchObject({ year: 2023, month: 11, day: 14, hour: 23 });
    expect(offsetMinutes(iso('2026-07-01T00:00:00Z'), ROME)).toBe(120);
    expect(offsetMinutes(iso('2026-01-01T00:00:00Z'), ROME)).toBe(60);
    expect(offsetMinutes(iso('2026-01-01T00:00:00Z'), 'UTC')).toBe(0);
  });
  it('elenco dei fusi: UTC in testa, validità', () => {
    const list = timeZoneList();
    expect(list[0]).toBe('UTC');
    expect(list).toContain(ROME);
    expect(list).toContain(NY);
    expect(isValidTimeZone(ROME)).toBe(true);
    expect(isValidTimeZone('Mondo/Inesistente')).toBe(false);
  });
});

describe('cambio d\'ora: Europe/Rome 2026', () => {
  it('inizio ora legale (29 marzo, 01:00 UTC): lo scarto passa da +01:00 a +02:00', () => {
    expect(formatIso(iso('2026-03-29T00:59:59Z'), ROME)).toBe('2026-03-29T01:59:59.000+01:00');
    expect(formatIso(iso('2026-03-29T01:00:00Z'), ROME)).toBe('2026-03-29T03:00:00.000+02:00');
  });
  it('fine ora legale (25 ottobre, 01:00 UTC): lo scarto passa da +02:00 a +01:00', () => {
    expect(formatIso(iso('2026-10-25T00:59:59Z'), ROME)).toBe('2026-10-25T02:59:59.000+02:00');
    expect(formatIso(iso('2026-10-25T01:00:00Z'), ROME)).toBe('2026-10-25T02:00:00.000+01:00');
  });
  it('un giorno di 23 ore e uno di 25', () => {
    const a = parseDate('2026-03-29 00:00:00', ROME);
    const b = parseDate('2026-03-30 00:00:00', ROME);
    expect(a.ok && b.ok && (b.ms - a.ms) / 3_600_000).toBe(23);
    const c = parseDate('2026-10-25 00:00:00', ROME);
    const d = parseDate('2026-10-26 00:00:00', ROME);
    expect(c.ok && d.ok && (d.ms - c.ms) / 3_600_000).toBe(25);
  });
  it('ora inesistente (02:30 del 29 marzo): spostata in avanti, con avviso', () => {
    const r = parseDate('2026-03-29 02:30:00', ROME);
    expect(r).toMatchObject({ ok: true, status: 'gap', ms: iso('2026-03-29T01:30:00Z') });
    expect(r.ok && formatIso(r.ms, ROME)).toBe('2026-03-29T03:30:00.000+02:00');
  });
  it('ora che ricorre due volte (02:30 del 25 ottobre): prima occorrenza e le due alternative', () => {
    const r = parseDate('2026-10-25 02:30:00', ROME);
    expect(r).toMatchObject({ ok: true, status: 'ambiguous', ms: iso('2026-10-25T00:30:00Z') });
    expect(r.ok && r.candidates).toEqual([iso('2026-10-25T00:30:00Z'), iso('2026-10-25T01:30:00Z')]);
  });
  it('ore normali accanto al cambio', () => {
    expect(parseDate('2026-03-29 01:59:59', ROME)).toMatchObject({ status: 'ok', ms: iso('2026-03-29T00:59:59Z') });
    expect(parseDate('2026-03-29 03:00:00', ROME)).toMatchObject({ status: 'ok', ms: iso('2026-03-29T01:00:00Z') });
    expect(parseDate('2026-10-25 03:00:00', ROME)).toMatchObject({ status: 'ok', ms: iso('2026-10-25T02:00:00Z') });
  });
});

describe('cambio d\'ora: America/New_York 2026', () => {
  it('inizio ora legale (8 marzo, 07:00 UTC): da -05:00 a -04:00', () => {
    expect(formatIso(iso('2026-03-08T06:59:59Z'), NY)).toBe('2026-03-08T01:59:59.000-05:00');
    expect(formatIso(iso('2026-03-08T07:00:00Z'), NY)).toBe('2026-03-08T03:00:00.000-04:00');
  });
  it('fine ora legale (1 novembre, 06:00 UTC): da -04:00 a -05:00', () => {
    expect(formatIso(iso('2026-11-01T05:59:59Z'), NY)).toBe('2026-11-01T01:59:59.000-04:00');
    expect(formatIso(iso('2026-11-01T06:00:00Z'), NY)).toBe('2026-11-01T01:00:00.000-05:00');
  });
  it('ora inesistente e ora doppia', () => {
    expect(parseDate('2026-03-08 02:30', NY)).toMatchObject({ ok: true, status: 'gap', ms: iso('2026-03-08T07:30:00Z') });
    const r = parseDate('2026-11-01 01:30', NY);
    expect(r).toMatchObject({ ok: true, status: 'ambiguous', ms: iso('2026-11-01T05:30:00Z') });
    expect(r.ok && r.candidates).toEqual([iso('2026-11-01T05:30:00Z'), iso('2026-11-01T06:30:00Z')]);
  });
  it('giorni di 23 e 25 ore', () => {
    const a = parseDate('2026-03-08', NY);
    const b = parseDate('2026-03-09', NY);
    expect(a.ok && b.ok && (b.ms - a.ms) / 3_600_000).toBe(23);
    const c = parseDate('2026-11-01', NY);
    const d = parseDate('2026-11-02', NY);
    expect(c.ok && d.ok && (d.ms - c.ms) / 3_600_000).toBe(25);
  });
});

describe('parseDate', () => {
  it('UTC e formati accettati', () => {
    expect(parseDate('2023-11-14T22:13:20', 'UTC')).toMatchObject({ ok: true, ms: 1700000000_000 });
    expect(parseDate('2023-11-14 22:13:20.5', 'UTC')).toMatchObject({ ok: true, ms: 1700000000_500 });
    expect(parseDate('2023-11-14T22:13', 'UTC')).toMatchObject({ ok: true, ms: 1699999980_000 });
    expect(parseDate('1970-01-01', 'UTC')).toMatchObject({ ok: true, ms: 0 });
  });
  it('con Z o scarto esplicito il fuso scelto non conta', () => {
    expect(parseDate('2023-11-14T23:13:20+01:00', NY)).toMatchObject({ ok: true, ms: 1700000000_000, explicitOffset: true });
    expect(parseDate('2023-11-14T22:13:20Z', ROME)).toMatchObject({ ok: true, ms: 1700000000_000, explicitOffset: true });
    expect(parseDate('2023-11-15T03:43:20+0530', 'UTC')).toMatchObject({ ok: true, ms: 1700000000_000 });
  });
  it('errori: vuoto, formato, date impossibili', () => {
    expect(parseDate('', 'UTC')).toEqual({ ok: false, error: 'empty' });
    expect(parseDate('ieri', 'UTC')).toEqual({ ok: false, error: 'format' });
    expect(parseDate('2026-02-30', 'UTC')).toEqual({ ok: false, error: 'format' });
    expect(parseDate('2026-13-01', 'UTC')).toEqual({ ok: false, error: 'format' });
    expect(parseDate('2026-01-01 24:00', 'UTC')).toEqual({ ok: false, error: 'format' });
    expect(parseDate('2024-02-29', 'UTC')).toMatchObject({ ok: true });
    expect(parseDate('2100-02-29', 'UTC')).toEqual({ ok: false, error: 'format' });
  });
  it('andata e ritorno: istante → ISO nel fuso → istante', () => {
    for (const tz of ['UTC', ROME, NY, 'Asia/Tokyo', 'Australia/Lord_Howe']) {
      for (const t of [0, 1700000000_000, iso('2026-03-29T00:30:00Z'), iso('2026-10-25T02:30:00Z'), iso('2026-11-01T06:30:00Z')]) {
        const r = parseDate(formatIso(t, tz), tz);
        expect(r.ok && r.ms).toBe(t);
      }
    }
  });
});

describe('relativo', () => {
  const now = iso('2026-11-16T12:00:00Z');
  it('unità naturali', () => {
    expect(relativeParts(now + 3 * 86400_000, now)).toEqual({ value: 3, unit: 'day' });
    expect(relativeParts(now - 2 * 3600_000, now)).toEqual({ value: -2, unit: 'hour' });
    expect(relativeParts(now + 90_000, now)).toEqual({ value: 2, unit: 'minute' });
    expect(relativeParts(now - 20_000, now)).toEqual({ value: -20, unit: 'second' });
    expect(relativeParts(now - 400 * 86400_000, now)).toEqual({ value: -1, unit: 'year' });
    expect(relativeParts(now + 59_600, now)).toEqual({ value: 1, unit: 'minute' });
  });
  it('Intl.RelativeTimeFormat in italiano e inglese', () => {
    expect(formatRelative(now + 3 * 86400_000, now, 'it-IT')).toBe('tra 3 giorni');
    expect(formatRelative(now - 2 * 3600_000, now, 'it-IT')).toBe('2 ore fa');
    expect(formatRelative(now + 3 * 86400_000, now, 'en-GB')).toBe('in 3 days');
    expect(formatRelative(now - 2 * 3600_000, now, 'en-GB')).toBe('2 hours ago');
    expect(formatRelative(now, now, 'en-GB')).toBe('now');
  });
});

describe('parseBatch', () => {
  it('un timestamp per riga, righe vuote saltate, numerazione originale', () => {
    const { rows, truncated } = parseBatch('1700000000\n\n 1700000000123 \nabc\r\n0', 'auto');
    expect(truncated).toBe(false);
    expect(rows.map((r) => r.line)).toEqual([1, 3, 4, 5]);
    expect(rows[0].result).toMatchObject({ ok: true, unit: 's' });
    expect(rows[1].result).toMatchObject({ ok: true, unit: 'ms' });
    expect(rows[2].result).toEqual({ ok: false, error: 'format' });
  });
  it('limita il numero di righe', () => {
    const text = Array.from({ length: 2500 }, (_, i) => String(i)).join('\n');
    const r = parseBatch(text, 's');
    expect(r.rows).toHaveLength(2000);
    expect(r.truncated).toBe(true);
  });
});
