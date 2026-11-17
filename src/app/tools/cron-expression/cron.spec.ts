// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { CronError, ParsedCron, UTC_ZONE, Zone, describeCron, expandAlias, gapEnd, makeZone, nextRuns, nextWall, parseCron, usesOrRule } from './cron';

function cron(expr: string): ParsedCron {
  const r = parseCron(expr);
  if (!r.ok) throw new Error(`${expr}: ${JSON.stringify(r.error)}`);
  return r.cron;
}
function error(expr: string): CronError {
  const r = parseCron(expr);
  if (r.ok) throw new Error(`${expr}: atteso errore`);
  return r.error;
}
const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');
const T = (s: string) => Date.parse(s);
function runs(expr: string, from: string, count: number, zone: Zone = UTC_ZONE): string[] {
  return nextRuns(cron(expr), zone, T(from), count).runs.map(iso);
}
const trueIdx = (a: boolean[]) => a.flatMap((v, i) => (v ? [i] : []));

describe('parseCron: campi validi', () => {
  it('asterisco, valori, liste, intervalli, passi', () => {
    const c = cron('*/15 0-6/2 1,15 * *');
    expect(trueIdx(c.minutes)).toEqual([0, 15, 30, 45]);
    expect(trueIdx(c.hours)).toEqual([0, 2, 4, 6]);
    expect(trueIdx(c.dom)).toEqual([1, 15]);
    expect(trueIdx(c.months)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(trueIdx(c.dow)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(c.hasSeconds).toBe(false);
    expect(trueIdx(c.seconds)).toEqual([0]);
  });
  it('liste con intervalli e passi misti', () => {
    expect(trueIdx(cron('1-3,10,20-30/5 * * * *').minutes)).toEqual([1, 2, 3, 10, 20, 25, 30]);
  });
  it('n/passo vale "da n fino alla fine"', () => {
    expect(trueIdx(cron('5/20 * * * *').minutes)).toEqual([5, 25, 45]);
  });
  it('nomi di mesi e giorni, anche in intervalli, senza badare alle maiuscole', () => {
    const c = cron('0 0 * JAN,Jul-sep MON-FRI');
    expect(trueIdx(c.months)).toEqual([1, 7, 8, 9]);
    expect(trueIdx(c.dow)).toEqual([1, 2, 3, 4, 5]);
    expect(trueIdx(cron('0 0 * * sun,SAT').dow)).toEqual([0, 6]);
  });
  it('domenica è 0 e 7', () => {
    expect(trueIdx(cron('0 0 * * 7').dow)).toEqual([0]);
    expect(trueIdx(cron('0 0 * * 5-7').dow)).toEqual([0, 5, 6]);
    expect(trueIdx(cron('0 0 * * 0,7').dow)).toEqual([0]);
    expect(trueIdx(cron('0 0 * * */2').dow)).toEqual([0, 2, 4, 6]);
  });
  it('?, valido solo per giorno del mese e della settimana', () => {
    const c = cron('0 0 ? * ?');
    expect(c.domStar && c.dowStar).toBe(true);
  });
  it('sei campi: i secondi sono i primi', () => {
    const c = cron('*/20 30 8 * * *');
    expect(c.hasSeconds).toBe(true);
    expect(trueIdx(c.seconds)).toEqual([0, 20, 40]);
    expect(trueIdx(c.minutes)).toEqual([30]);
    expect(trueIdx(c.hours)).toEqual([8]);
  });
  it('spazi e tabulazioni multipli, spazi ai bordi', () => {
    expect(cron('  0\t 12   *  * *  ').expanded).toBe('0 12 * * *');
  });
  it('alias', () => {
    expect(cron('@daily').expanded).toBe('0 0 * * *');
    expect(cron('@Midnight').expanded).toBe('0 0 * * *');
    expect(cron('@hourly').expanded).toBe('0 * * * *');
    expect(cron('@weekly').expanded).toBe('0 0 * * 0');
    expect(cron('@monthly').expanded).toBe('0 0 1 * *');
    expect(cron('@yearly').expanded).toBe('0 0 1 1 *');
    expect(cron('@annually').expanded).toBe('0 0 1 1 *');
    expect(expandAlias('@daily')).toBe('0 0 * * *');
    expect(expandAlias('0 0 * * *')).toBeNull();
  });
  it('estremi dei campi', () => {
    expect(() => cron('59 23 31 12 6')).not.toThrow();
    expect(() => cron('0 0 1 1 0')).not.toThrow();
    expect(() => cron('59 59 23 31 12 7')).not.toThrow();
  });
});

describe('parseCron: errori', () => {
  it('vuota', () => {
    expect(error('')).toEqual({ code: 'empty' });
    expect(error('   ')).toEqual({ code: 'empty' });
  });
  it('numero di campi', () => {
    expect(error('* * * *')).toEqual({ code: 'fieldCount', count: 4 });
    expect(error('* * * * * * *')).toEqual({ code: 'fieldCount', count: 7 });
  });
  it('fuori intervallo, con il campo giusto', () => {
    expect(error('60 * * * *')).toMatchObject({ code: 'outOfRange', field: 'minute', value: 60, min: 0, max: 59 });
    expect(error('* 24 * * *')).toMatchObject({ code: 'outOfRange', field: 'hour', value: 24 });
    expect(error('* * 0 * *')).toMatchObject({ code: 'outOfRange', field: 'dayOfMonth', value: 0, min: 1 });
    expect(error('* * 32 * *')).toMatchObject({ code: 'outOfRange', field: 'dayOfMonth' });
    expect(error('* * * 13 *')).toMatchObject({ code: 'outOfRange', field: 'month' });
    expect(error('* * * 0 *')).toMatchObject({ code: 'outOfRange', field: 'month' });
    expect(error('* * * * 8')).toMatchObject({ code: 'outOfRange', field: 'dayOfWeek', max: 7 });
    expect(error('60 * * * * *')).toMatchObject({ code: 'outOfRange', field: 'second' });
  });
  it('il primo campo sbagliato è quello segnalato', () => {
    expect(error('99 99 99 99 99')).toMatchObject({ field: 'minute' });
  });
  it('intervalli rovesciati', () => {
    expect(error('30-10 * * * *')).toMatchObject({ code: 'reversedRange', field: 'minute' });
    expect(error('* * * * FRI-MON')).toMatchObject({ code: 'reversedRange', field: 'dayOfWeek' });
  });
  it('passi non validi', () => {
    expect(error('*/0 * * * *')).toMatchObject({ code: 'badStep', field: 'minute' });
    expect(error('*/x * * * *')).toMatchObject({ code: 'badStep' });
    expect(error('*/ * * * *')).toMatchObject({ code: 'badStep' });
    expect(error('1/2/3 * * * *')).toMatchObject({ code: 'badStep' });
    expect(error('*/61 * * * *')).toMatchObject({ code: 'stepTooBig', value: 61, max: 60 });
    expect(error('* */25 * * *')).toMatchObject({ code: 'stepTooBig', field: 'hour' });
  });
  it('elementi vuoti e valori strani', () => {
    expect(error('1,,2 * * * *')).toMatchObject({ code: 'emptyItem', field: 'minute' });
    expect(error(',1 * * * *')).toMatchObject({ code: 'emptyItem' });
    expect(error('1, * * * *')).toMatchObject({ code: 'emptyItem' });
    expect(error('a * * * *')).toMatchObject({ code: 'badValue' });
    expect(error('1.5 * * * *')).toMatchObject({ code: 'badValue' });
    expect(error('-5 * * * *')).toMatchObject({ code: 'badValue' });
    expect(error('1-2-3 * * * *')).toMatchObject({ code: 'badValue' });
    expect(error('1- * * * *')).toMatchObject({ code: 'badValue' });
  });
  it('nomi sbagliati o nel campo sbagliato', () => {
    expect(error('0 0 * FOO *')).toMatchObject({ code: 'badName', field: 'month', token: 'FOO' });
    expect(error('0 0 * * JAN')).toMatchObject({ code: 'badName', field: 'dayOfWeek' });
    expect(error('0 0 * MON *')).toMatchObject({ code: 'badName', field: 'month' });
    expect(error('MON * * * *')).toMatchObject({ code: 'badValue', field: 'minute' });
  });
  it('estensioni Quartz non supportate', () => {
    expect(error('0 0 L * *')).toMatchObject({ code: 'quartz', field: 'dayOfMonth' });
    expect(error('0 0 15W * *')).toMatchObject({ code: 'quartz' });
    expect(error('0 0 * * 5#3')).toMatchObject({ code: 'quartz', field: 'dayOfWeek' });
    expect(error('0 0 * * 5L')).toMatchObject({ code: 'quartz' });
  });
  it('? solo dove ammesso', () => {
    expect(error('? * * * *')).toMatchObject({ code: 'badQuestion', field: 'minute' });
    expect(error('* * * ? *')).toMatchObject({ code: 'badQuestion', field: 'month' });
  });
  it('alias non validi', () => {
    expect(error('@reboot')).toEqual({ code: 'reboot' });
    expect(error('@sometimes')).toMatchObject({ code: 'badAlias', token: '@sometimes' });
    expect(error('@daily extra')).toMatchObject({ code: 'badAlias' });
  });
});

describe('nextRuns: casi base (UTC)', () => {
  it('ogni 15 minuti', () => {
    expect(runs('*/15 * * * *', '2026-01-01T00:07:00Z', 5)).toEqual([
      '2026-01-01T00:15:00Z',
      '2026-01-01T00:30:00Z',
      '2026-01-01T00:45:00Z',
      '2026-01-01T01:00:00Z',
      '2026-01-01T01:15:00Z',
    ]);
  });
  it('è strettamente dopo l\'istante di partenza', () => {
    expect(runs('0 10 * * *', '2026-03-05T10:00:00Z', 2)).toEqual(['2026-03-06T10:00:00Z', '2026-03-07T10:00:00Z']);
    expect(runs('0 10 * * *', '2026-03-05T09:59:59.999Z', 1)).toEqual(['2026-03-05T10:00:00Z']);
    expect(runs('0 10 * * *', '2026-03-05T10:00:00.500Z', 1)).toEqual(['2026-03-06T10:00:00Z']);
  });
  it('ogni giorno a una certa ora, passando il cambio di anno', () => {
    expect(runs('30 23 * * *', '2026-12-30T23:30:00Z', 3)).toEqual(['2026-12-31T23:30:00Z', '2027-01-01T23:30:00Z', '2027-01-02T23:30:00Z']);
  });
  it('giorni feriali', () => {
    // 2026-01-02 è venerdì
    expect(runs('0 9 * * 1-5', '2026-01-02T10:00:00Z', 4)).toEqual(['2026-01-05T09:00:00Z', '2026-01-06T09:00:00Z', '2026-01-07T09:00:00Z', '2026-01-08T09:00:00Z']);
  });
  it('domenica come 0 e come 7', () => {
    expect(runs('0 0 * * 0', '2026-01-01T00:00:00Z', 2)).toEqual(['2026-01-04T00:00:00Z', '2026-01-11T00:00:00Z']);
    expect(runs('0 0 * * 7', '2026-01-01T00:00:00Z', 2)).toEqual(['2026-01-04T00:00:00Z', '2026-01-11T00:00:00Z']);
  });
  it('primo del mese, con riporto di anno', () => {
    expect(runs('0 0 1 * *', '2026-11-15T00:00:00Z', 3)).toEqual(['2026-12-01T00:00:00Z', '2027-01-01T00:00:00Z', '2027-02-01T00:00:00Z']);
  });
  it('il giorno 31 salta i mesi più corti', () => {
    expect(runs('0 0 31 * *', '2026-01-01T00:00:00Z', 5)).toEqual([
      '2026-01-31T00:00:00Z',
      '2026-03-31T00:00:00Z',
      '2026-05-31T00:00:00Z',
      '2026-07-31T00:00:00Z',
      '2026-08-31T00:00:00Z',
    ]);
  });
  it('il 29 febbraio solo negli anni bisestili (2100 non lo è)', () => {
    expect(runs('0 0 29 2 *', '2026-01-01T00:00:00Z', 3)).toEqual(['2028-02-29T00:00:00Z', '2032-02-29T00:00:00Z', '2036-02-29T00:00:00Z']);
    expect(runs('0 0 29 2 *', '2096-03-01T00:00:00Z', 2)).toEqual(['2104-02-29T00:00:00Z', '2108-02-29T00:00:00Z']);
  });
  it('un giorno che non esiste (31 febbraio) non scatta mai', () => {
    const r = nextRuns(cron('0 0 31 2 *'), UTC_ZONE, T('2026-01-01T00:00:00Z'), 3);
    expect(r).toEqual({ runs: [], exhausted: true });
  });
  it('mesi per nome e intervalli di mesi', () => {
    expect(runs('0 12 15 JAN,JUL *', '2026-02-01T00:00:00Z', 3)).toEqual(['2026-07-15T12:00:00Z', '2027-01-15T12:00:00Z', '2027-07-15T12:00:00Z']);
  });
  it('ore e minuti con passi', () => {
    expect(runs('10-50/20 */8 * * *', '2026-01-01T00:00:00Z', 5)).toEqual([
      '2026-01-01T00:10:00Z',
      '2026-01-01T00:30:00Z',
      '2026-01-01T00:50:00Z',
      '2026-01-01T08:10:00Z',
      '2026-01-01T08:30:00Z',
    ]);
  });
  it('alias', () => {
    expect(runs('@hourly', '2026-01-01T00:30:00Z', 2)).toEqual(['2026-01-01T01:00:00Z', '2026-01-01T02:00:00Z']);
    expect(runs('@weekly', '2026-01-01T00:00:00Z', 1)).toEqual(['2026-01-04T00:00:00Z']);
    expect(runs('@yearly', '2026-01-01T00:00:00Z', 2)).toEqual(['2027-01-01T00:00:00Z', '2028-01-01T00:00:00Z']);
  });
  it('conta richiesta, anche 0 e oltre il massimo', () => {
    const c = cron('* * * * *');
    expect(nextRuns(c, UTC_ZONE, 0, 0).runs).toEqual([]);
    expect(nextRuns(c, UTC_ZONE, 0, 7).runs).toHaveLength(7);
    expect(nextRuns(c, UTC_ZONE, 0, 100000).runs).toHaveLength(100);
    expect(nextRuns(c, UTC_ZONE, 0, -3).runs).toEqual([]);
  });
  it('gli istanti sono crescenti e senza duplicati', () => {
    const r = nextRuns(cron('*/7 */3 * * 1-5'), UTC_ZONE, T('2026-05-05T00:00:00Z'), 100).runs;
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThan(r[i - 1]);
  });
});

describe('nextRuns: secondi', () => {
  it('ogni 20 secondi', () => {
    expect(runs('*/20 * * * * *', '2026-01-01T00:00:05Z', 4)).toEqual(['2026-01-01T00:00:20Z', '2026-01-01T00:00:40Z', '2026-01-01T00:01:00Z', '2026-01-01T00:01:20Z']);
  });
  it('un secondo preciso', () => {
    expect(runs('15 30 10 * * *', '2026-01-01T10:30:15Z', 2)).toEqual(['2026-01-02T10:30:15Z', '2026-01-03T10:30:15Z']);
  });
  it('ogni secondo, strettamente dopo la partenza', () => {
    expect(runs('* * * * * *', '2026-01-01T00:00:59Z', 3)).toEqual(['2026-01-01T00:01:00Z', '2026-01-01T00:01:01Z', '2026-01-01T00:01:02Z']);
  });
  it('a 5 campi i secondi sono sempre 0', () => {
    expect(runs('* * * * *', '2026-01-01T00:00:30Z', 2)).toEqual(['2026-01-01T00:01:00Z', '2026-01-01T00:02:00Z']);
  });
});

describe('giorno del mese e giorno della settimana (regola di cron)', () => {
  it('entrambi limitati: basta uno dei due (OR)', () => {
    // gennaio 2026: lunedì 5, 12, 19, 26; il 15 è giovedì
    expect(runs('0 0 15 * 1', '2026-01-01T00:00:00Z', 6)).toEqual([
      '2026-01-05T00:00:00Z',
      '2026-01-12T00:00:00Z',
      '2026-01-15T00:00:00Z',
      '2026-01-19T00:00:00Z',
      '2026-01-26T00:00:00Z',
      '2026-02-02T00:00:00Z',
    ]);
    expect(usesOrRule(cron('0 0 15 * 1'))).toBe(true);
  });
  it('se uno è * si richiedono entrambi (E): conta il solo campo limitato', () => {
    expect(runs('0 0 * * 1', '2026-01-01T00:00:00Z', 2)).toEqual(['2026-01-05T00:00:00Z', '2026-01-12T00:00:00Z']);
    expect(runs('0 0 15 * *', '2026-01-01T00:00:00Z', 2)).toEqual(['2026-01-15T00:00:00Z', '2026-02-15T00:00:00Z']);
    expect(usesOrRule(cron('0 0 * * 1'))).toBe(false);
  });
  it('"*/2" comincia con *, quindi vale la regola E (come in Vixie cron)', () => {
    // giorni dispari (1,3,5…) E lunedì: 5 e 19 gennaio
    expect(runs('0 0 */2 * 1', '2026-01-01T00:00:00Z', 2)).toEqual(['2026-01-05T00:00:00Z', '2026-01-19T00:00:00Z']);
    expect(usesOrRule(cron('0 0 */2 * 1'))).toBe(false);
  });
  it('OR con un giorno inesistente: scattano i giorni della settimana', () => {
    // 31 febbraio non esiste, ma il lunedì sì
    expect(runs('0 0 31 2 1', '2026-02-01T00:00:00Z', 2)).toEqual(['2026-02-02T00:00:00Z', '2026-02-09T00:00:00Z']);
  });
  it('? equivale a *', () => {
    expect(runs('0 0 ? * 1', '2026-01-01T00:00:00Z', 1)).toEqual(['2026-01-05T00:00:00Z']);
  });
});

describe('nextRuns: fusi orari e ora legale', () => {
  const rome = makeZone('Europe/Rome');
  const ny = makeZone('America/New_York');
  it('Europe/Rome: orario locale d\'inverno e d\'estate', () => {
    expect(runs('0 9 * * *', '2026-01-10T00:00:00Z', 1, rome)).toEqual(['2026-01-10T08:00:00Z']);
    expect(runs('0 9 * * *', '2026-07-10T00:00:00Z', 1, rome)).toEqual(['2026-07-10T07:00:00Z']);
  });
  it('lo stesso istante in UTC e a Roma dà giorni diversi', () => {
    // 23:30 UTC del 1 gennaio = 00:30 del 2 gennaio a Roma
    expect(runs('0 0 * * *', '2026-01-01T23:30:00Z', 1, rome)).toEqual(['2026-01-02T23:00:00Z']);
    expect(runs('0 0 * * *', '2026-01-01T23:30:00Z', 1, UTC_ZONE)).toEqual(['2026-01-02T00:00:00Z']);
  });
  it('salto all\'ora legale: 29 marzo 2026 a Roma, le 02:30 non esistono e slittano alle 03:00', () => {
    expect(runs('30 2 * * *', '2026-03-28T00:00:00Z', 4, rome)).toEqual([
      '2026-03-28T01:30:00Z', // 02:30 CET
      '2026-03-29T01:00:00Z', // slittata a 03:00 CEST
      '2026-03-30T00:30:00Z', // 02:30 CEST
      '2026-03-31T00:30:00Z',
    ]);
  });
  it('più esecuzioni nell\'ora saltata non si duplicano', () => {
    const r = runs('*/20 2 * * *', '2026-03-29T00:00:00Z', 3, rome);
    // 02:00, 02:20 e 02:40 non esistono: tutte e tre slittano al primo istante valido (03:00 CEST), contato una volta
    expect(r).toEqual(['2026-03-29T01:00:00Z', '2026-03-30T00:00:00Z', '2026-03-30T00:20:00Z']);
  });
  it('le esecuzioni orarie attraversano il salto senza buchi né doppioni', () => {
    expect(runs('0 * * * *', '2026-03-29T00:00:00Z', 4, rome)).toEqual([
      '2026-03-29T01:00:00Z', // 03:00 CEST (le 02:00 non esistono)
      '2026-03-29T02:00:00Z',
      '2026-03-29T03:00:00Z',
      '2026-03-29T04:00:00Z',
    ]);
  });
  it('ritorno all\'ora solare: 25 ottobre 2026, le 02:30 si ripetono ma si esegue una volta', () => {
    expect(runs('30 2 * * *', '2026-10-24T00:00:00Z', 3, rome)).toEqual([
      '2026-10-24T00:30:00Z', // 02:30 CEST
      '2026-10-25T00:30:00Z', // prima 02:30 (CEST)
      '2026-10-26T01:30:00Z', // 02:30 CET
    ]);
  });
  it('ritorno all\'ora solare con esecuzione oraria: l\'ora ripetuta conta una volta', () => {
    expect(runs('0 * * * *', '2026-10-24T22:30:00Z', 4, rome)).toEqual([
      '2026-10-24T23:00:00Z', // 01:00 CEST
      '2026-10-25T00:00:00Z', // 02:00 CEST (prima occorrenza)
      '2026-10-25T02:00:00Z', // 03:00 CET
      '2026-10-25T03:00:00Z', // 04:00 CET
    ]);
  });
  it('America/New_York: 8 marzo 2026 (salto) e 1 novembre 2026 (ripetizione)', () => {
    expect(runs('30 2 * * *', '2026-03-07T12:00:00Z', 3, ny)).toEqual([
      '2026-03-08T07:00:00Z', // le 02:30 non esistono: 03:00 EDT
      '2026-03-09T06:30:00Z', // 02:30 EDT
      '2026-03-10T06:30:00Z',
    ]);
    expect(runs('30 1 * * *', '2026-10-31T12:00:00Z', 2, ny)).toEqual([
      '2026-11-01T05:30:00Z', // prima 01:30 (EDT)
      '2026-11-02T06:30:00Z', // 01:30 EST
    ]);
  });
  it('UTC non cambia con l\'ora legale', () => {
    expect(runs('30 2 * * *', '2026-03-28T00:00:00Z', 3, UTC_ZONE)).toEqual(['2026-03-28T02:30:00Z', '2026-03-29T02:30:00Z', '2026-03-30T02:30:00Z']);
  });
  it('fusi con scarto frazionario (Asia/Kolkata +5:30)', () => {
    expect(runs('0 9 * * *', '2026-01-01T00:00:00Z', 1, makeZone('Asia/Kolkata'))).toEqual(['2026-01-01T03:30:00Z']);
  });
  it('mezzanotte non è mai "24:00"', () => {
    expect(runs('0 0 * * *', '2026-01-01T12:00:00Z', 2, ny)).toEqual(['2026-01-02T05:00:00Z', '2026-01-03T05:00:00Z']);
  });
  it('makeZone rifiuta nomi inesistenti', () => {
    expect(() => makeZone('Mars/Olympus')).toThrow(RangeError);
  });
  it('zone.instants: ora inesistente, normale e ripetuta', () => {
    expect(rome.instants({ y: 2026, mo: 3, d: 29, h: 2, mi: 30, s: 0 })).toEqual([]);
    expect(rome.instants({ y: 2026, mo: 3, d: 29, h: 3, mi: 30, s: 0 })).toHaveLength(1);
    expect(rome.instants({ y: 2026, mo: 10, d: 25, h: 2, mi: 30, s: 0 })).toHaveLength(2);
    expect(gapEnd(rome, { y: 2026, mo: 3, d: 29, h: 2, mi: 30, s: 0 })).toBe(T('2026-03-29T01:00:00Z'));
  });
});

describe('nextWall e prestazioni', () => {
  it('trova la prima ora a muro valida, inclusa la partenza', () => {
    expect(nextWall(cron('30 12 * * *'), { y: 2026, mo: 1, d: 1, h: 12, mi: 30, s: 0 })).toEqual({ y: 2026, mo: 1, d: 1, h: 12, mi: 30, s: 0 });
    expect(nextWall(cron('30 12 * * *'), { y: 2026, mo: 1, d: 1, h: 12, mi: 30, s: 1 })).toEqual({ y: 2026, mo: 1, d: 2, h: 12, mi: 30, s: 0 });
  });
  it('espressioni rare restano veloci', () => {
    const t0 = Date.now();
    runs('0 0 29 2 *', '2026-01-01T00:00:00Z', 20);
    runs('59 23 31 12 *', '2026-01-01T00:00:00Z', 20);
    runs('0 0 31 2 *', '2026-01-01T00:00:00Z', 5);
    runs('* * * * * *', '2026-01-01T00:00:00Z', 100);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
  it('100 esecuzioni nel fuso del browser non sono lente', () => {
    const t0 = Date.now();
    nextRuns(cron('*/5 * * * *'), makeZone('Europe/Rome'), T('2026-03-28T00:00:00Z'), 100);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});

describe('describeCron', () => {
  it('inglese', () => {
    expect(describeCron(cron('*/5 * * * *'), 'en')).toBe('Every 5 minutes');
    expect(describeCron(cron('0 9 * * 1-5'), 'en')).toMatch(/09:00.*Monday through Friday/);
    expect(describeCron(cron('@daily'), 'en')).toMatch(/00:00/);
  });
  it('italiano', () => {
    expect(describeCron(cron('*/5 * * * *'), 'it')).toBe('Ogni 5 minuti');
    expect(describeCron(cron('0 9 * * 1-5'), 'it')).toMatch(/09:00.*lunedì.*venerdì/i);
    expect(describeCron(cron('0 0 1 * *'), 'it')).toMatch(/giorno 1/);
  });
  it('sei campi', () => {
    expect(describeCron(cron('*/30 * * * * *'), 'en')).toMatch(/30 seconds/);
    expect(describeCron(cron('*/30 * * * * *'), 'it')).toMatch(/30 secondi/);
  });
});
