// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { SHARE_SCHEMA as CALCOLO_IVA } from '../tools/calcolo-iva/calcolo-iva.share';
import { SHARE_SCHEMA as RATA_MUTUO } from '../tools/calcolo-rata-mutuo/calcolo-rata-mutuo.share';
import { SHARE_SCHEMA as CSS_GENERATOR, decodeShadows, decodeStops, encodeShadows, encodeStops } from '../tools/css-generator/css-generator.share';
import { SHARE_SCHEMA as CRON } from '../tools/cron-expression/cron-expression.share';
import { SHARE_SCHEMA as FIND_REPLACE, decodeRule, encodeRule } from '../tools/find-replace/find-replace.share';
import { SHARE_SCHEMA as JSON_DIFF } from '../tools/json-diff/json-diff.share';
import { SHARE_SCHEMA as JSON_FORMATTER } from '../tools/json-formatter/json-formatter.share';
import { SHARE_SCHEMA as NUMBER_BASE } from '../tools/number-base-converter/number-base-converter.share';
import { SHARE_SCHEMA as PERCENTAGE } from '../tools/percentage-calculator/percentage-calculator.share';
import { SHARE_SCHEMA as QR_CODE } from '../tools/qr-code/qr-code.share';
import { SHARE_SCHEMA as REGEX_TESTER } from '../tools/regex-tester/regex-tester.share';
import { SHARE_SCHEMA as TIMEZONE } from '../tools/timezone-converter/timezone-converter.share';
import { SHARE_SCHEMA as UNIT_CONVERTER } from '../tools/unit-converter/unit-converter.share';
import { DEFAULT_RULE } from '../tools/find-replace/find-replace-core';
import { defaultGradient, newShadow } from '../tools/css-generator/css-gen';
import { encodeState, parseHash, SHARE_PREFIX, validateState } from './share-state';

describe('schemi di condivisione degli strumenti', () => {
  it('regex-tester: pattern, flag e testo; flag non validi scartati', () => {
    expect(validateState(REGEX_TESTER, { pattern: '\\d+', flags: 'gi', text: 'a1', replacement: '#' })).toEqual({ pattern: '\\d+', flags: 'gi', text: 'a1', replacement: '#' });
    expect(validateState(REGEX_TESTER, { pattern: 'x', flags: 'gz' })).toEqual({ pattern: 'x' });
  });

  it('json-formatter: enum di azione e indentazione', () => {
    expect(validateState(JSON_FORMATTER, { input: '{}', action: 'minify', indent: 'tab', sortKeys: true })).toEqual({ input: '{}', action: 'minify', indent: 'tab', sortKeys: true });
    expect(validateState(JSON_FORMATTER, { input: '{}', action: 'delete', indent: 8 })).toEqual({ input: '{}' });
  });

  it('json-diff: testi e opzioni; modalità o vista non ammesse scartate', () => {
    const ok = { textA: '{"a":1}', textB: '{"a":2}', arrayMode: 'key', key: 'id', ignoreCase: true, epsilon: '0,01', ignore: '/meta/*', view: 'tree', collapse: false };
    expect(validateState(JSON_DIFF, ok)).toEqual(ok);
    expect(validateState(JSON_DIFF, { textA: '{}', arrayMode: 'sorted', view: 'grid' })).toEqual({ textA: '{}' });
    expect(validateState(JSON_DIFF, { textA: 'x'.repeat(100001) })).toBeNull();
  });

  it('cron-expression: conteggio entro 1..100', () => {
    expect(validateState(CRON, { expression: '* * * * *', count: 100, tz: 'utc' })).toEqual({ expression: '* * * * *', count: 100, tz: 'utc' });
    expect(validateState(CRON, { expression: '* * * * *', count: 101 })).toEqual({ expression: '* * * * *' });
  });

  it('number-base-converter: la larghezza è un numero fra quelli ammessi', () => {
    expect(validateState(NUMBER_BASE, { width: 16 })).toEqual({ width: 16 });
    expect(validateState(NUMBER_BASE, { width: 12 })).toBeNull();
    expect(validateState(NUMBER_BASE, { width: '16' })).toBeNull();
  });

  it('unit-converter: categoria ammessa', () => {
    expect(validateState(UNIT_CONVERTER, { category: 'mass', valueText: '5', from: 'kg', to: 'lb' })).not.toBeNull();
    expect(validateState(UNIT_CONVERTER, { category: 'magic' })).toBeNull();
  });

  it('calcolo-iva e calcolo-rata-mutuo: modalità e periodicità', () => {
    expect(validateState(CALCOLO_IVA, { mode: 'extract', amountText: '122', vatBp: 2200 })).toEqual({ mode: 'extract', amountText: '122', vatBp: 2200 });
    expect(validateState(CALCOLO_IVA, { mode: 'boh', vatBp: -1 })).toBeNull();
    expect(validateState(RATA_MUTUO, { capitalText: '100000', periodicity: 'quarterly' })).toEqual({ capitalText: '100000', periodicity: 'quarterly' });
    expect(validateState(RATA_MUTUO, { periodicity: 'weekly' })).toBeNull();
  });

  it('timezone-converter: solo fusi orari esistenti', () => {
    expect(validateState(TIMEZONE, { zones: ['Europe/Rome', 'UTC'], source: 'Europe/Rome' })).toEqual({ zones: ['Europe/Rome', 'UTC'], source: 'Europe/Rome' });
    expect(validateState(TIMEZONE, { zones: ['Europe/Rome', 'Nowhere/City'], source: 'Mars/Base' })).toBeNull();
  });

  it('percentage-calculator: dieci campi e due direzioni', () => {
    expect(validateState(PERCENTAGE, { ofA: '20', ofB: '150', applyDir: 'add' })).toEqual({ ofA: '20', ofB: '150', applyDir: 'add' });
    expect(validateState(PERCENTAGE, { applyDir: 'up' })).toBeNull();
  });

  it('qr-code: il link non prevede la password del Wi-Fi', () => {
    expect(Object.keys(QR_CODE)).not.toContain('wifiPassword');
    expect(validateState(QR_CODE, { type: 'wifi', wifiSsid: 'casa', wifiPassword: 'segreta', fg: '#112233' })).toEqual({ type: 'wifi', wifiSsid: 'casa', fg: '#112233' });
    expect(validateState(QR_CODE, { fg: 'red' })).toBeNull();
  });

  it('css-generator: stop e ombre fanno il giro e vengono riportati nei limiti', () => {
    const g = defaultGradient();
    expect(decodeStops(encodeStops(g.stops))).toEqual(g.stops);
    const sh = [{ ...newShadow(1), y: 8, blur: 24 }];
    expect(decodeShadows(encodeShadows(sh))).toEqual(sh);
    expect(decodeStops(['#112233|9|150', '#ffffff|0|0'])).toEqual([
      { id: 1, color: '#112233', alpha: 1, pos: 100 },
      { id: 2, color: '#ffffff', alpha: 0, pos: 0 },
    ]);
    expect(decodeStops(['#112233|1|0'])).toBeNull();
    expect(validateState(CSS_GENERATOR, { stops: ['rosso|1|0', '#ffffff|1|1'] })).toBeNull();
    expect(validateState(CSS_GENERATOR, { stops: encodeStops(g.stops), kind: 'conic', angle: 90 })).not.toBeNull();
  });

  it('find-replace: le regole fanno il giro e quelle malformate si scartano', () => {
    const rule = { ...DEFAULT_RULE, flags: { ...DEFAULT_RULE.flags }, find: 'a"b', replace: 'è', mode: 'regex' as const, wholeWord: true };
    expect(decodeRule(encodeRule(rule))).toEqual(rule);
    expect(decodeRule('[1,2,3,4]')).toBeNull();
    expect(decodeRule('non json')).toBeNull();
    expect(validateState(FIND_REPLACE, { text: 'x', rules: [encodeRule(rule), 'rotta'] })).toEqual({ text: 'x' });
  });

  it('hash completo: stato di uno strumento e rifiuto di quello di un altro', async () => {
    const payload = await encodeState('regex-tester', { pattern: 'a+', flags: 'g', text: 'aaa' });
    expect(await parseHash('regex-tester', REGEX_TESTER, SHARE_PREFIX + payload)).toEqual({ kind: 'ok', state: { pattern: 'a+', flags: 'g', text: 'aaa' } });
    expect(await parseHash('text-diff', REGEX_TESTER, SHARE_PREFIX + payload)).toEqual({ kind: 'invalid' });
  });
});
