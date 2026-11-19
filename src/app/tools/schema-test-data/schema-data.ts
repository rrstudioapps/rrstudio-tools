// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { CITIES, FEMALE, MALE, Rng, SURNAMES, hashSeed, int, makeRandom, pick } from '../fake-data-generator/fake-data';
import { tableFromJson, tableToCsvRows } from '../csv-json-converter/convert';
import { xsdToJsonSchema } from '../json-schema-xsd/schema-convert';
import type { ConvError, Warning } from '../json-schema-xsd/schema-convert';
import { DEFAULT_OPTIONS as XJ_DEFAULTS, jsonToXml } from '../xml-json-converter/xml-json';

/**
 * Dati di prova da un JSON Schema o da un XSD (questo si converte prima in JSON Schema con le stesse regole del convertitore).
 * Con lo stesso schema e lo stesso seme il risultato è sempre identico. Supporta type, properties, required, items, enum, const,
 * format, pattern (sottoinsieme), lunghezze, intervalli, multipleOf, minItems/maxItems, uniqueItems, $ref verso $defs, allOf,
 * oneOf/anyOf. Ciò che non si riesce a rispettare è elencato come avviso.
 */

export const MAX_RECORDS = 1000;
export const MAX_DEPTH = 6;
export type OutFormat = 'json' | 'xml' | 'csv';

type J = Record<string, unknown>;
const isObj = (v: unknown): v is J => v !== null && typeof v === 'object' && !Array.isArray(v);
const numOf = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

const WORDS = ['alfa', 'bravo', 'delta', 'luce', 'mare', 'monte', 'nodo', 'onda', 'pino', 'rosa', 'sole', 'terra', 'vento', 'zero', 'campo', 'ponte', 'riva', 'stella', 'tempo', 'valle'];
const HEX = '0123456789abcdef';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

// ---------------------------------------------------------------- pattern (sottoinsieme di regex)

type RNode =
  | { k: 'lit'; chars: string }
  | { k: 'set'; chars: string }
  | { k: 'alt'; branches: RNode[][] }
  | { k: 'rep'; node: RNode; min: number; max: number };

const CLASS_CHARS: Record<string, string> = {
  d: '0123456789',
  w: LETTERS + LETTERS.toUpperCase() + '0123456789_',
  s: ' ',
};

class PatternError extends Error {}

function parsePattern(src: string): RNode[] {
  let i = 0;
  const parseSeq = (): RNode[][] => {
    const branches: RNode[][] = [[]];
    while (i < src.length && src[i] !== ')') {
      const c = src[i];
      if (c === '|') {
        branches.push([]);
        i++;
        continue;
      }
      let atom: RNode | null = null;
      if (c === '^' || c === '$') {
        i++;
        continue;
      } else if (c === '(') {
        i++;
        if (src.startsWith('?:', i)) i += 2;
        else if (src[i] === '?') throw new PatternError('group');
        const inner = parseSeq();
        if (src[i] !== ')') throw new PatternError('paren');
        i++;
        atom = { k: 'alt', branches: inner };
      } else if (c === '[') {
        i++;
        const neg = src[i] === '^';
        if (neg) i++;
        let chars = '';
        while (i < src.length && src[i] !== ']') {
          let ch = src[i];
          if (ch === '\\') {
            const e = src[++i];
            if (CLASS_CHARS[e]) {
              chars += CLASS_CHARS[e];
              i++;
              continue;
            }
            ch = e;
          }
          if (src[i + 1] === '-' && src[i + 2] !== ']' && i + 2 < src.length) {
            const to = src[i + 2];
            for (let cc = ch.charCodeAt(0); cc <= to.charCodeAt(0); cc++) chars += String.fromCharCode(cc);
            i += 3;
          } else {
            chars += ch;
            i++;
          }
        }
        if (src[i] !== ']') throw new PatternError('class');
        i++;
        if (neg) chars = (LETTERS + '0123456789').split('').filter((x) => !chars.includes(x)).join('');
        atom = { k: 'set', chars: chars || 'x' };
      } else if (c === '.') {
        i++;
        atom = { k: 'set', chars: LETTERS + '0123456789' };
      } else if (c === '\\') {
        const e = src[i + 1];
        i += 2;
        if (CLASS_CHARS[e]) atom = { k: 'set', chars: CLASS_CHARS[e] };
        else if (e === 'D') atom = { k: 'set', chars: LETTERS };
        else if (e === 'W') atom = { k: 'set', chars: '-.' };
        else if (e === 'S') atom = { k: 'set', chars: LETTERS };
        else if (/[bBAZ]/.test(e)) continue;
        else atom = { k: 'lit', chars: e };
      } else if (c === '*' || c === '+' || c === '?' || c === '{') {
        throw new PatternError('quantifier');
      } else {
        atom = { k: 'lit', chars: c };
        i++;
      }
      // quantificatore
      const q = src[i];
      let min = 1;
      let max = 1;
      if (q === '*') [min, max] = [0, 3];
      else if (q === '+') [min, max] = [1, 4];
      else if (q === '?') [min, max] = [0, 1];
      else if (q === '{') {
        const m = /^\{(\d+)(?:(,)(\d*))?\}/.exec(src.slice(i));
        if (!m) throw new PatternError('quantifier');
        min = Number(m[1]);
        max = m[2] ? (m[3] === '' ? min + 3 : Number(m[3])) : min;
        i += m[0].length - 1;
      }
      if (q === '*' || q === '+' || q === '?' || q === '{') {
        i++;
        if (src[i] === '?') i++; // lazy
        atom = { k: 'rep', node: atom, min, max };
      }
      branches[branches.length - 1].push(atom);
    }
    return branches;
  };
  const top = parseSeq();
  if (i < src.length) throw new PatternError('paren');
  return [{ k: 'alt', branches: top }];
}

function emit(node: RNode, r: Rng): string {
  switch (node.k) {
    case 'lit':
      return node.chars;
    case 'set':
      return node.chars[int(r, 0, node.chars.length - 1)];
    case 'alt':
      return pick(r, node.branches).map((n) => emit(n, r)).join('');
    case 'rep': {
      const n = int(r, node.min, node.max);
      let s = '';
      for (let j = 0; j < n; j++) s += emit(node.node, r);
      return s;
    }
  }
}

/** Una stringa che rispetta il pattern, oppure null se la sintassi non è nel sottoinsieme. */
export function fromPattern(pattern: string, r: Rng): string | null {
  try {
    return parsePattern(pattern).map((n) => emit(n, r)).join('');
  } catch (e) {
    if (e instanceof PatternError) return null;
    throw e;
  }
}

// ---------------------------------------------------------------- generazione

export interface GenContext {
  rng: Rng;
  root: J;
  defs: Map<string, J>;
  warnings: Warning[];
}

const warn = (c: GenContext, code: string, path: string, detail?: string): void => {
  if (!c.warnings.some((w) => w.code === code && w.path === path && w.detail === detail)) c.warnings.push({ code, path, detail });
};

function refTarget(ref: string, c: GenContext): J | undefined {
  const m = /^#\/(?:\$defs|definitions)\/(.+)$/.exec(ref);
  return m ? c.defs.get(decodeURIComponent(m[1].replace(/~1/g, '/').replace(/~0/g, '~'))) : undefined;
}

/** Risolve $ref e unisce allOf. */
function resolve(s: J, c: GenContext, path: string, depth = 0): J {
  let out = s;
  if (typeof out['$ref'] === 'string' && depth < 20) {
    const t = refTarget(out['$ref'] as string, c);
    if (!t) {
      warn(c, 'unresolvedRef', path, out['$ref'] as string);
      return {};
    }
    out = resolve({ ...t, ...Object.fromEntries(Object.entries(out).filter(([k]) => k !== '$ref')) }, c, path, depth + 1);
  }
  if (Array.isArray(out['allOf']) && depth < 20) {
    let merged: J = { ...out };
    delete merged['allOf'];
    for (const p of out['allOf'] as unknown[]) {
      if (!isObj(p)) continue;
      const q = resolve(p, c, path, depth + 1);
      const props = { ...(isObj(merged['properties']) ? merged['properties'] : {}), ...(isObj(q['properties']) ? q['properties'] : {}) };
      const req = [...new Set([...(Array.isArray(merged['required']) ? (merged['required'] as string[]) : []), ...(Array.isArray(q['required']) ? (q['required'] as string[]) : [])])];
      merged = { ...q, ...merged, ...(Object.keys(props).length ? { properties: props } : {}), ...(req.length ? { required: req } : {}) };
    }
    out = merged;
  }
  return out;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function genFormat(format: string, r: Rng): string | null {
  const y = int(r, 1990, 2030);
  const date = `${y}-${pad2(int(r, 1, 12))}-${pad2(int(r, 1, 28))}`;
  const time = `${pad2(int(r, 0, 23))}:${pad2(int(r, 0, 59))}:${pad2(int(r, 0, 59))}`;
  const hex = (n: number): string => Array.from({ length: n }, () => HEX[int(r, 0, 15)]).join('');
  switch (format) {
    case 'date': return date;
    case 'date-time': return `${date}T${time}Z`;
    case 'time': return time;
    case 'email': return `${pick(r, WORDS)}.${pick(r, WORDS)}${int(r, 1, 99)}@example.com`;
    case 'uri': case 'url': case 'iri': return `https://example.com/${pick(r, WORDS)}/${int(r, 1, 999)}`;
    case 'uuid': return `${hex(8)}-${hex(4)}-4${hex(3)}-${HEX[8 + int(r, 0, 3)]}${hex(3)}-${hex(12)}`;
    case 'ipv4': return [int(r, 1, 223), int(r, 0, 255), int(r, 0, 255), int(r, 1, 254)].join('.');
    case 'ipv6': return Array.from({ length: 8 }, () => hex(4)).join(':');
    case 'hostname': return `${pick(r, WORDS)}${int(r, 1, 99)}.example.com`;
    case 'duration': return `P${int(r, 1, 30)}D`;
    default: return null;
  }
}

const NAME_HINT: [RegExp, (r: Rng) => string][] = [
  [/^(nome|name|first_?name|given_?name)$/i, (r) => pick(r, r() < 0.5 ? MALE : FEMALE)],
  [/^(cognome|surname|last_?name|family_?name)$/i, (r) => pick(r, SURNAMES)],
  [/^(citta|città|city|comune)$/i, (r) => pick(r, CITIES)[0]],
  [/^(email|e-?mail|mail)$/i, (r) => genFormat('email', r) as string],
  [/^(telefono|phone|tel|cellulare)$/i, (r) => `3${int(r, 20, 99)}${String(int(r, 0, 9999999)).padStart(7, '0')}`],
];

function genString(s: J, key: string, r: Rng, c: GenContext, path: string): string {
  const minL = numOf(s['minLength']) ?? 0;
  const maxL = numOf(s['maxLength']) ?? Infinity;
  let out: string | null = null;
  if (typeof s['pattern'] === 'string') {
    for (let t = 0; t < 12 && out === null; t++) {
      const cand = fromPattern(s['pattern'] as string, r);
      if (cand === null) {
        warn(c, 'patternUnsupported', path, s['pattern'] as string);
        break;
      }
      if (cand.length >= minL && cand.length <= maxL) out = cand;
    }
    if (out === null) {
      const cand = fromPattern(s['pattern'] as string, r);
      if (cand !== null) {
        warn(c, 'lengthUnmet', path);
        return cand;
      }
    }
  } else if (typeof s['format'] === 'string') out = genFormat(s['format'] as string, r);
  if (out === null && typeof s['pattern'] !== 'string') {
    const hint = NAME_HINT.find(([re]) => re.test(key));
    if (hint) out = hint[1](r);
  }
  if (out === null) {
    out = pick(r, WORDS);
    while (out.length < minL) out += ' ' + pick(r, WORDS);
  }
  if (out.length > maxL) out = out.slice(0, maxL).trimEnd();
  while (out.length < minL) out += 'x';
  return out;
}

function genNumber(s: J, integer: boolean, r: Rng, c: GenContext, path: string): number {
  let lo: number | undefined = numOf(s['minimum']);
  let hi: number | undefined = numOf(s['maximum']);
  const exLo = numOf(s['exclusiveMinimum']);
  const exHi = numOf(s['exclusiveMaximum']);
  const mult = numOf(s['multipleOf']);
  if (exLo !== undefined) lo = Math.max(lo ?? -Infinity, integer ? Math.floor(exLo) + 1 : exLo + 0.01);
  if (exHi !== undefined) hi = Math.min(hi ?? Infinity, integer ? Math.ceil(exHi) - 1 : exHi - 0.01);
  if (lo === undefined && hi === undefined) [lo, hi] = [0, 1000];
  else if (lo === undefined) lo = (hi as number) - 1000;
  else if (hi === undefined) hi = lo + 1000;
  return pickNumber(lo as number, hi as number, mult, integer, r, c, path);
}

function pickNumber(lo: number, hi: number, mult: number | undefined, integer: boolean, r: Rng, c: GenContext, path: string): number {
  if (lo > hi) {
    warn(c, 'rangeEmpty', path);
    return lo;
  }
  if (mult !== undefined && mult > 0) {
    const a = Math.ceil(lo / mult);
    const b = Math.floor(hi / mult);
    if (a > b) {
      warn(c, 'rangeEmpty', path);
      return lo;
    }
    return Number((int(r, a, b) * mult).toFixed(10));
  }
  if (integer) return int(r, Math.ceil(lo), Math.floor(hi));
  return Number((lo + r() * (hi - lo)).toFixed(2));
}

function typeOf(s: J): string | undefined {
  const t = s['type'];
  if (Array.isArray(t)) {
    const nn = t.filter((v) => v !== 'null');
    return typeof nn[0] === 'string' ? nn[0] : 'null';
  }
  if (typeof t === 'string') return t;
  if (isObj(s['properties'])) return 'object';
  if (isObj(s['items'])) return 'array';
  return undefined;
}

export function generateValue(schema: unknown, key: string, c: GenContext, path = '', depth = 0): unknown {
  const r = c.rng;
  if (!isObj(schema)) return null;
  let s = resolve(schema, c, path);
  if (Array.isArray(s['oneOf']) || Array.isArray(s['anyOf'])) {
    const alts = (Array.isArray(s['oneOf']) ? s['oneOf'] : (s['anyOf'] as unknown[])).filter(isObj);
    if (alts.length) {
      const base = { ...s };
      delete base['oneOf'];
      delete base['anyOf'];
      s = resolve({ ...base, ...resolve(pick(r, alts), c, path) }, c, path);
    }
  }
  if ('const' in s) return s['const'];
  if (Array.isArray(s['enum']) && s['enum'].length) return pick(r, s['enum'] as unknown[]);
  if (Array.isArray(s['type']) && (s['type'] as unknown[]).includes('null') && r() < 0.15) return null;
  const t = typeOf(s);
  switch (t) {
    case 'string': return genString(s, key, r, c, path);
    case 'integer': return genNumber(s, true, r, c, path);
    case 'number': return genNumber(s, false, r, c, path);
    case 'boolean': return r() < 0.5;
    case 'null': return null;
    case 'array': {
      const items = isObj(s['items']) ? s['items'] : {};
      const minI = numOf(s['minItems']) ?? 0;
      const maxI = numOf(s['maxItems']) ?? Math.max(minI, minI + 3);
      const n = depth >= MAX_DEPTH ? minI : int(r, minI, Math.max(minI, maxI));
      const out: unknown[] = [];
      const seen = new Set<string>();
      for (let j = 0; j < n; j++) {
        let v = generateValue(items, key, c, `${path}/items`, depth + 1);
        if (s['uniqueItems'] === true) {
          for (let tries = 0; tries < 20 && seen.has(JSON.stringify(v)); tries++) v = generateValue(items, key, c, `${path}/items`, depth + 1);
          if (seen.has(JSON.stringify(v))) warn(c, 'uniqueUnmet', path);
          seen.add(JSON.stringify(v));
        }
        out.push(v);
      }
      return out;
    }
    case 'object': {
      const props = isObj(s['properties']) ? s['properties'] : {};
      const req = new Set(Array.isArray(s['required']) ? (s['required'] as string[]) : []);
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) {
        if (!req.has(k) && (depth >= MAX_DEPTH || r() < 0.25)) continue;
        Object.defineProperty(out, k, { value: generateValue(v, k, c, `${path}/${k}`, depth + 1), enumerable: true, writable: true, configurable: true });
      }
      return out;
    }
    default:
      return pick(r, WORDS);
  }
}

// ---------------------------------------------------------------- ingresso, record, uscite

export type InputKind = 'json-schema' | 'xsd';

export interface GenOptions {
  seed: string;
  count: number;
  attrPrefix: string;
  textKey: string;
}

export type GenResult =
  | { ok: true; records: unknown[]; warnings: Warning[]; kind: InputKind }
  | { ok: false; error: ConvError };

export function detectKind(text: string): InputKind {
  return /^\s*</.test(text) ? 'xsd' : 'json-schema';
}

export function generateRecords(text: string, o: GenOptions): GenResult {
  const kind = detectKind(text);
  let schemaText = text;
  const warnings: Warning[] = [];
  if (kind === 'xsd') {
    const conv = xsdToJsonSchema(text, { attrPrefix: o.attrPrefix, textKey: o.textKey });
    if (!conv.ok) return conv;
    schemaText = conv.text;
    warnings.push(...conv.warnings);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(schemaText);
  } catch (e) {
    const m = /position (\d+)/.exec(e instanceof Error ? e.message : '');
    let line: number | null = null;
    let column: number | null = null;
    if (m) {
      const before = schemaText.slice(0, Number(m[1]));
      line = before.split('\n').length;
      column = before.length - before.lastIndexOf('\n');
    }
    return { ok: false, error: { kind: 'json', message: e instanceof Error ? e.message : String(e), line, column } };
  }
  if (!isObj(parsed)) return { ok: false, error: { kind: 'schema', code: 'notJsonSchema' } };
  const defs = new Map<string, J>();
  for (const k of ['$defs', 'definitions']) {
    const d = parsed[k];
    if (isObj(d)) for (const [n, v] of Object.entries(d)) if (isObj(v)) defs.set(n, v);
  }
  const c: GenContext = { rng: makeRandom(hashSeed(o.seed)), root: parsed, defs, warnings };
  const n = Math.max(1, Math.min(MAX_RECORDS, Math.floor(o.count)));
  const records: unknown[] = [];
  for (let i = 0; i < n; i++) records.push(generateValue(parsed, '', c));
  return { ok: true, records, warnings: c.warnings, kind };
}

/** Un solo elemento radice (la forma prodotta dall'XSD): il suo nome e il suo contenuto. */
function rootOf(v: unknown): { name: string; value: unknown } | null {
  if (!isObj(v)) return null;
  const keys = Object.keys(v);
  return keys.length === 1 && !keys[0].startsWith('@') ? { name: keys[0], value: v[keys[0]] } : null;
}

export type RenderResult = { ok: true; text: string } | { ok: false; code: string; detail?: string };

export function renderRecords(records: unknown[], format: OutFormat, o: { attrPrefix: string; textKey: string; indent: number }): RenderResult {
  if (format === 'json') return { ok: true, text: JSON.stringify(records.length === 1 ? records[0] : records, null, o.indent) + '\n' };
  if (format === 'xml') {
    const first = rootOf(records[0]);
    const wrapped: unknown =
      records.length === 1 ? records[0] : { records: { [first ? first.name : 'record']: records.map((rec) => (first ? (rootOf(rec)?.value ?? null) : rec)) } };
    const r = jsonToXml(JSON.stringify(wrapped), { ...XJ_DEFAULTS, attrPrefix: o.attrPrefix, textKey: o.textKey, indent: o.indent, rootName: records.length === 1 ? 'record' : 'records' });
    return r.ok ? { ok: true, text: r.text } : { ok: false, code: 'xml', detail: r.error.stage === 'write' ? `${r.error.code} ${r.error.path}` : '' };
  }
  const rows = records.map((rec) => rootOf(rec)?.value ?? rec);
  try {
    const t = tableFromJson(JSON.stringify(rows), { flatten: true, header: true });
    const q = (s: string): string => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    return { ok: true, text: tableToCsvRows(t, true).map((row) => row.map(q).join(',')).join('\n') + '\n' };
  } catch {
    return { ok: false, code: 'csv' };
  }
}
