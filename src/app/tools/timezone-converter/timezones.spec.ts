// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it, vi } from 'vitest';
import {
  cityOf,
  formatOffset,
  isDst,
  isValidZone,
  listZones,
  normalizeSearch,
  offsetMinutes,
  partsInZone,
  regionOf,
  searchZones,
  zonedToInstant,
} from './timezones';

const utc = (y: number, m: number, d: number, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi);

describe('elenco dei fusi', () => {
  it('viene dal motore Intl e include UTC e le città principali', () => {
    const z = listZones();
    expect(z.length).toBeGreaterThan(100);
    expect(z).toContain('Europe/Rome');
    expect(z).toContain('America/New_York');
    expect(z).toContain('UTC');
  });
  it('validità di un identificativo', () => {
    expect(isValidZone('Europe/Rome')).toBe(true);
    expect(isValidZone('Mars/Olympus')).toBe(false);
  });
});

describe('scarto dal UTC', () => {
  it('Roma: +1 d\'inverno, +2 d\'estate', () => {
    expect(offsetMinutes('Europe/Rome', utc(2026, 1, 15, 12))).toBe(60);
    expect(offsetMinutes('Europe/Rome', utc(2026, 7, 15, 12))).toBe(120);
  });
  it('New York: -5 / -4', () => {
    expect(offsetMinutes('America/New_York', utc(2026, 1, 15, 12))).toBe(-300);
    expect(offsetMinutes('America/New_York', utc(2026, 7, 15, 12))).toBe(-240);
  });
  it('scarti con mezz\'ore e quarti d\'ora', () => {
    expect(offsetMinutes('Asia/Kolkata', utc(2026, 7, 1))).toBe(330);
    expect(offsetMinutes('Asia/Kathmandu', utc(2026, 7, 1))).toBe(345);
    expect(offsetMinutes('Pacific/Kiritimati', utc(2026, 7, 1))).toBe(840);
    expect(offsetMinutes('UTC', utc(2026, 7, 1))).toBe(0);
  });
  it('i millisecondi non falsano lo scarto', () => {
    expect(offsetMinutes('Europe/Rome', utc(2026, 1, 15, 12) + 999)).toBe(60);
  });
});

describe('ora locale di un istante', () => {
  it('Tokyo oltre la mezzanotte', () => {
    const p = partsInZone(utc(2026, 1, 1, 23, 30), 'Asia/Tokyo');
    expect([p.y, p.m, p.d, p.h, p.mi]).toEqual([2026, 1, 2, 8, 30]);
    expect(p.weekday).toBe(5); // venerdì
  });
  it('mezzanotte è 0 e non 24', () => {
    expect(partsInZone(utc(2026, 1, 1, 0, 0), 'UTC').h).toBe(0);
    expect(partsInZone(utc(2026, 1, 1, 23, 0), 'Europe/Rome').h).toBe(0);
  });
});

describe('dall\'ora locale all\'istante', () => {
  it('ora normale: Roma 12:00 d\'estate = 10:00 UTC', () => {
    expect(zonedToInstant('Europe/Rome', { y: 2026, m: 7, d: 1, h: 12, mi: 0 })).toEqual({ ms: utc(2026, 7, 1, 10), status: 'ok' });
    expect(zonedToInstant('Europe/Rome', { y: 2026, m: 1, d: 1, h: 12, mi: 0 })).toEqual({ ms: utc(2026, 1, 1, 11), status: 'ok' });
  });
  it('mezza ora: Mumbai 12:00 = 06:30 UTC', () => {
    expect(zonedToInstant('Asia/Kolkata', { y: 2026, m: 5, d: 5, h: 12, mi: 0 }).ms).toBe(utc(2026, 5, 5, 6, 30));
  });
  it('salto in avanti (Roma, 29 marzo 2026): 02:30 non esiste, diventa 03:30', () => {
    const r = zonedToInstant('Europe/Rome', { y: 2026, m: 3, d: 29, h: 2, mi: 30 });
    expect(r.status).toBe('gap');
    const p = partsInZone(r.ms, 'Europe/Rome');
    expect([p.h, p.mi]).toEqual([3, 30]);
  });
  it('salto in avanti a New York (8 marzo 2026)', () => {
    expect(zonedToInstant('America/New_York', { y: 2026, m: 3, d: 8, h: 2, mi: 30 }).status).toBe('gap');
    expect(zonedToInstant('America/New_York', { y: 2026, m: 3, d: 8, h: 3, mi: 30 }).status).toBe('ok');
  });
  it('ora doppia (Roma, 25 ottobre 2026): 02:30 è ambigua, vale la prima (CEST)', () => {
    const r = zonedToInstant('Europe/Rome', { y: 2026, m: 10, d: 25, h: 2, mi: 30 });
    expect(r.status).toBe('ambiguous');
    expect(r.ms).toBe(utc(2026, 10, 25, 0, 30));
    expect(zonedToInstant('Europe/Rome', { y: 2026, m: 10, d: 25, h: 3, mi: 30 }).status).toBe('ok');
  });
  it('ora doppia a New York (1 novembre 2026)', () => {
    const r = zonedToInstant('America/New_York', { y: 2026, m: 11, d: 1, h: 1, mi: 30 });
    expect(r.status).toBe('ambiguous');
    expect(r.ms).toBe(utc(2026, 11, 1, 5, 30));
  });
  it('andata e ritorno su molti fusi e date', () => {
    const zones = ['Europe/Rome', 'America/Los_Angeles', 'Asia/Kolkata', 'Australia/Sydney', 'Pacific/Auckland', 'America/Sao_Paulo', 'UTC'];
    for (const tz of zones) {
      for (const [m, d] of [[1, 10], [4, 3], [7, 20], [11, 15]]) {
        const r = zonedToInstant(tz, { y: 2026, m, d, h: 14, mi: 15 });
        const p = partsInZone(r.ms, tz);
        expect([p.y, p.m, p.d, p.h, p.mi], `${tz} ${m}/${d}`).toEqual([2026, m, d, 14, 15]);
      }
    }
  });
});

describe('ora legale', () => {
  it('emisfero nord e sud', () => {
    expect(isDst('Europe/Rome', utc(2026, 7, 1))).toBe(true);
    expect(isDst('Europe/Rome', utc(2026, 1, 1))).toBe(false);
    expect(isDst('Australia/Sydney', utc(2026, 1, 1))).toBe(true);
    expect(isDst('Australia/Sydney', utc(2026, 7, 1))).toBe(false);
  });
  it('fusi senza ora legale', () => {
    expect(isDst('Asia/Kolkata', utc(2026, 7, 1))).toBe(false);
    expect(isDst('UTC', utc(2026, 7, 1))).toBe(false);
    expect(isDst('Asia/Tokyo', utc(2026, 7, 1))).toBe(false);
  });
  it('Lord Howe: ora legale di mezz\'ora', () => {
    expect(offsetMinutes('Australia/Lord_Howe', utc(2026, 1, 1))).toBe(660);
    expect(offsetMinutes('Australia/Lord_Howe', utc(2026, 7, 1))).toBe(630);
    expect(isDst('Australia/Lord_Howe', utc(2026, 1, 1))).toBe(true);
  });
  it('cambio il giorno stesso della transizione (Roma, 29 marzo 2026)', () => {
    expect(isDst('Europe/Rome', utc(2026, 3, 29, 0, 59))).toBe(false);
    expect(isDst('Europe/Rome', utc(2026, 3, 29, 1, 0))).toBe(true);
  });
});

describe('formattazione e nomi', () => {
  it('formatOffset', () => {
    expect(formatOffset(330)).toBe('UTC+05:30');
    expect(formatOffset(-210)).toBe('UTC-03:30');
    expect(formatOffset(0)).toBe('UTC+00:00');
    expect(formatOffset(-300)).toBe('UTC-05:00');
  });
  it('città e regione', () => {
    expect(cityOf('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
    expect(regionOf('America/Argentina/Buenos_Aires')).toBe('America / Argentina');
    expect(cityOf('UTC')).toBe('UTC');
    expect(regionOf('UTC')).toBe('');
  });
});

describe('ricerca per città', () => {
  const zones = listZones();
  it('nome IANA, anche con spazi e maiuscole', () => {
    expect(searchZones('new york', zones)).toContain('America/New_York');
    expect(searchZones('KOLKATA', zones)[0]).toMatch(/Asia\/(Kolkata|Calcutta)/);
    expect(searchZones('buenos', zones).some((z) => z.endsWith('/Buenos_Aires'))).toBe(true);
  });
  it('nomi italiani', () => {
    expect(searchZones('roma', zones)[0]).toBe('Europe/Rome');
    expect(searchZones('londra', zones)).toContain('Europe/London');
    expect(searchZones('pechino', zones)).toContain('Asia/Shanghai');
    expect(searchZones('nuova delhi', zones).some((z) => /Asia\/(Kolkata|Calcutta)/.test(z))).toBe(true);
    expect(searchZones('città del messico', zones)).toContain('America/Mexico_City');
  });
  it('senza risultati e ricerca vuota', () => {
    expect(searchZones('', zones)).toEqual([]);
    expect(searchZones('zzzzqqq', zones)).toEqual([]);
  });
  it('rispetta il limite', () => {
    expect(searchZones('a', zones, 'en-GB', 5).length).toBeLessThanOrEqual(5);
  });
  it('normalizzazione', () => {
    expect(normalizeSearch(' Città_del / Messico ')).toBe('citta del messico');
  });
});

describe('cache dei formatter dei nomi', () => {
  it('una seconda ricerca per nome esteso non crea nuovi Intl.DateTimeFormat', () => {
    const zones = ['Europe/Rome', 'America/New_York', 'Asia/Tokyo', 'Australia/Sydney'];
    searchZones('zzz nome inesistente', zones, 'it-IT'); // scalda la cache
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    try {
      searchZones('zzz nome inesistente', zones, 'it-IT');
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
