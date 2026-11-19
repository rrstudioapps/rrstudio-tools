// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { XmlError, XmlNode, normalizeNewlines, parseXml } from '../xml-formatter/xml';
import { El, unescapeXml } from '../xml-viewer/xml-tree';

/**
 * Validazione di un XML con un sottoinsieme di XSD 1.0, tutto nel browser.
 * Supportato: element/attribute (anche ref), complexType con sequence, choice, all e group, simpleContent e complexContent
 * (extension/restriction), simpleType con restriction, list e union, i tipi predefiniti più usati, le faccette
 * (enumeration, pattern, length, min/maxLength, min/max Inclusive/Exclusive, totalDigits, fractionDigits), minOccurs/maxOccurs,
 * mixed, ID/IDREF, xsi:nil. NON supportato: namespace (si confrontano i nomi locali), import/include/redefine, key/keyref/unique,
 * substitution group, asserzioni e tipi dell'XSD 1.1.
 */

export interface XsdIssue {
  code: string;
  xpath: string;
  params: Record<string, string | number>;
}

export type XsdResult =
  | { ok: true; issues: XsdIssue[]; truncated: boolean }
  | { ok: false; which: 'xsd' | 'xml'; error: XmlError }
  | { ok: false; which: 'schema'; code: string; params: Record<string, string> };

export const MAX_ISSUES = 200;

// ---------- modello dello schema ----------

type TypeRef = { name: string } | { inline: TypeDef };
type TypeDef = { k: 'simple'; st: SimpleDef } | { k: 'complex'; ct: ComplexDef };

interface Facets {
  enumeration?: string[];
  pattern?: string[];
  length?: number;
  minLength?: number;
  maxLength?: number;
  minInclusive?: string;
  maxInclusive?: string;
  minExclusive?: string;
  maxExclusive?: string;
  totalDigits?: number;
  fractionDigits?: number;
}

interface SimpleDef {
  base?: TypeRef;
  facets: Facets;
  list?: TypeRef;
  union?: TypeRef[];
}

type Particle =
  | { k: 'el'; name: string; type?: TypeRef; min: number; max: number }
  | { k: 'seq' | 'choice' | 'all'; items: Particle[]; min: number; max: number }
  | { k: 'any'; min: number; max: number }
  | { k: 'group'; ref: string; min: number; max: number };

interface AttrDecl {
  name: string;
  type?: TypeRef;
  use: 'required' | 'optional' | 'prohibited';
}

interface ComplexDef {
  mixed: boolean;
  particle: Particle | null;
  attrs: AttrDecl[];
  attrGroups: string[];
  anyAttr: boolean;
  /** simpleContent: tipo del testo. */
  simple?: TypeRef;
  /** complexContent extension: tipo da cui si parte. */
  extBase?: TypeRef;
}

interface Schema {
  elements: Map<string, { type?: TypeRef }>;
  attributes: Map<string, AttrDecl>;
  types: Map<string, TypeDef>;
  groups: Map<string, Particle>;
  attrGroups: Map<string, { attrs: AttrDecl[]; groups: string[] }>;
}

class SchemaError extends Error {
  constructor(
    readonly code: string,
    readonly params: Record<string, string> = {},
  ) {
    super(code);
  }
}

const local = (s: string): string => s.slice(s.indexOf(':') + 1);
const kids = (el: El, ...names: string[]): El[] => el.children.filter((c): c is El => c.t === 'el' && (names.length === 0 || names.includes(local(c.name))));
const at = (el: El, name: string): string | undefined => {
  const a = el.attrs.find((x) => x.name === name);
  return a === undefined ? undefined : unescapeXml(a.value);
};
const occurs = (el: El): { min: number; max: number } => {
  const mx = at(el, 'maxOccurs');
  return { min: Number(at(el, 'minOccurs') ?? 1), max: mx === 'unbounded' ? Infinity : Number(mx ?? 1) };
};
const typeRef = (name: string | undefined): TypeRef | undefined => (name === undefined ? undefined : { name: local(name) });

function parseFacets(restriction: El): Facets {
  const f: Facets = {};
  const num = (el: El): number => Number(at(el, 'value'));
  for (const c of kids(restriction)) {
    const v = at(c, 'value') ?? '';
    switch (local(c.name)) {
      case 'enumeration': (f.enumeration ??= []).push(v); break;
      case 'pattern': (f.pattern ??= []).push(v); break;
      case 'length': f.length = num(c); break;
      case 'minLength': f.minLength = num(c); break;
      case 'maxLength': f.maxLength = num(c); break;
      case 'minInclusive': f.minInclusive = v; break;
      case 'maxInclusive': f.maxInclusive = v; break;
      case 'minExclusive': f.minExclusive = v; break;
      case 'maxExclusive': f.maxExclusive = v; break;
      case 'totalDigits': f.totalDigits = num(c); break;
      case 'fractionDigits': f.fractionDigits = num(c); break;
    }
  }
  return f;
}

function parseSimple(el: El): SimpleDef {
  const res = kids(el, 'restriction')[0];
  if (res) {
    const inner = kids(res, 'simpleType')[0];
    return { base: inner ? { inline: { k: 'simple', st: parseSimple(inner) } } : typeRef(at(res, 'base')), facets: parseFacets(res) };
  }
  const list = kids(el, 'list')[0];
  if (list) {
    const inner = kids(list, 'simpleType')[0];
    return { facets: {}, list: inner ? { inline: { k: 'simple', st: parseSimple(inner) } } : typeRef(at(list, 'itemType')) };
  }
  const un = kids(el, 'union')[0];
  if (un) {
    const members = (at(un, 'memberTypes') ?? '').split(/\s+/).filter(Boolean).map((n) => typeRef(n)!);
    for (const s of kids(un, 'simpleType')) members.push({ inline: { k: 'simple', st: parseSimple(s) } });
    return { facets: {}, union: members };
  }
  return { facets: {} };
}

function parseAttr(el: El, s: Schema): AttrDecl | null {
  const ref = at(el, 'ref');
  const use = (at(el, 'use') ?? 'optional') as AttrDecl['use'];
  if (ref) return { ...(s.attributes.get(local(ref)) ?? { name: local(ref) }), name: local(ref), use };
  const inline = kids(el, 'simpleType')[0];
  return { name: at(el, 'name') ?? '', use, type: inline ? { inline: { k: 'simple', st: parseSimple(inline) } } : typeRef(at(el, 'type')) };
}

function parseParticle(el: El): Particle | null {
  const o = occurs(el);
  switch (local(el.name)) {
    case 'element': {
      const ref = at(el, 'ref');
      const inline = kids(el, 'complexType', 'simpleType')[0];
      const type: TypeRef | undefined = inline
        ? { inline: local(inline.name) === 'complexType' ? { k: 'complex', ct: parseComplex(inline) } : { k: 'simple', st: parseSimple(inline) } }
        : typeRef(at(el, 'type'));
      return { k: 'el', name: local(ref ?? at(el, 'name') ?? ''), type: ref ? undefined : type, ...o };
    }
    case 'sequence':
    case 'choice':
    case 'all':
      return { k: local(el.name) === 'sequence' ? 'seq' : (local(el.name) as 'choice' | 'all'), items: kids(el).map(parseParticle).filter((p): p is Particle => p !== null), ...o };
    case 'any':
      return { k: 'any', ...o };
    case 'group':
      return { k: 'group', ref: local(at(el, 'ref') ?? ''), ...o };
    default:
      return null;
  }
}

function parseComplex(el: El, s?: Schema): ComplexDef {
  const ct: ComplexDef = { mixed: at(el, 'mixed') === 'true', particle: null, attrs: [], attrGroups: [], anyAttr: false };
  const body = (parent: El): void => {
    for (const c of kids(parent)) {
      const n = local(c.name);
      if (n === 'attribute') {
        const a = parseAttr(c, s ?? EMPTY);
        if (a) ct.attrs.push(a);
      } else if (n === 'attributeGroup') ct.attrGroups.push(local(at(c, 'ref') ?? ''));
      else if (n === 'anyAttribute') ct.anyAttr = true;
      else if (n === 'sequence' || n === 'choice' || n === 'all' || n === 'group') ct.particle = parseParticle(c);
    }
  };
  const sc = kids(el, 'simpleContent')[0];
  const cc = kids(el, 'complexContent')[0];
  if (sc) {
    const d = kids(sc, 'extension', 'restriction')[0];
    if (d) {
      ct.simple = typeRef(at(d, 'base'));
      body(d);
    }
  } else if (cc) {
    if (at(cc, 'mixed') === 'true') ct.mixed = true;
    const d = kids(cc, 'extension', 'restriction')[0];
    if (d) {
      if (local(d.name) === 'extension') ct.extBase = typeRef(at(d, 'base'));
      body(d);
    }
  } else body(el);
  return ct;
}

const EMPTY: Schema = { elements: new Map(), attributes: new Map(), types: new Map(), groups: new Map(), attrGroups: new Map() };

function parseSchema(root: El): Schema {
  const s: Schema = { elements: new Map(), attributes: new Map(), types: new Map(), groups: new Map(), attrGroups: new Map() };
  if (local(root.name) !== 'schema') throw new SchemaError('notSchema');
  const top = kids(root);
  for (const c of top) if (['import', 'include', 'redefine'].includes(local(c.name))) throw new SchemaError('unsupported', { what: local(c.name) });
  // gli attributi globali prima, perché altri possono rimandarci
  for (const c of top) if (local(c.name) === 'attribute') s.attributes.set(at(c, 'name') ?? '', parseAttr(c, s)!);
  for (const c of top) {
    const name = at(c, 'name') ?? '';
    switch (local(c.name)) {
      case 'element': {
        const p = parseParticle(c) as Extract<Particle, { k: 'el' }>;
        s.elements.set(name, { type: p.type });
        break;
      }
      case 'complexType': s.types.set(name, { k: 'complex', ct: parseComplex(c, s) }); break;
      case 'simpleType': s.types.set(name, { k: 'simple', st: parseSimple(c) }); break;
      case 'group': {
        const p = kids(c).map(parseParticle).find((x) => x);
        if (p) s.groups.set(name, p);
        break;
      }
      case 'attributeGroup': {
        const attrs: AttrDecl[] = [];
        const groups: string[] = [];
        for (const a of kids(c)) {
          if (local(a.name) === 'attribute') attrs.push(parseAttr(a, s)!);
          else if (local(a.name) === 'attributeGroup') groups.push(local(at(a, 'ref') ?? ''));
        }
        s.attrGroups.set(name, { attrs, groups });
        break;
      }
    }
  }
  return s;
}

// ---------- tipi predefiniti ----------

const TZ = '(Z|[+-](0\\d|1[0-4]):[0-5]\\d)?';
const DEC = '[+-]?(\\d+(\\.\\d*)?|\\.\\d+)';
const BIG = (min: string | null, max: string | null): [bigint | null, bigint | null] => [min === null ? null : BigInt(min), max === null ? null : BigInt(max)];
const INT_RANGE: Record<string, [bigint | null, bigint | null]> = {
  integer: BIG(null, null),
  nonNegativeInteger: BIG('0', null),
  positiveInteger: BIG('1', null),
  nonPositiveInteger: BIG(null, '0'),
  negativeInteger: BIG(null, '-1'),
  long: BIG('-9223372036854775808', '9223372036854775807'),
  int: BIG('-2147483648', '2147483647'),
  short: BIG('-32768', '32767'),
  byte: BIG('-128', '127'),
  unsignedLong: BIG('0', '18446744073709551615'),
  unsignedInt: BIG('0', '4294967295'),
  unsignedShort: BIG('0', '65535'),
  unsignedByte: BIG('0', '255'),
};
const NUMERIC = new Set([...Object.keys(INT_RANGE), 'decimal', 'float', 'double']);
const WS_PRESERVE = new Set(['string']);
const KNOWN = new Set([
  ...NUMERIC, 'string', 'normalizedString', 'token', 'boolean', 'date', 'dateTime', 'time', 'duration', 'gYear', 'gYearMonth', 'gMonth', 'gDay',
  'gMonthDay', 'anyURI', 'language', 'NCName', 'Name', 'NMTOKEN', 'ID', 'IDREF', 'QName', 'hexBinary', 'base64Binary', 'anySimpleType', 'anyType',
]);

const validDate = (v: string): boolean => {
  const m = /^(-?\d{4,})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= new Date(Date.UTC(2000 + (((y % 400) + 400) % 400), mo, 0)).getUTCDate();
};
const validTime = (v: string): boolean => {
  const m = /^(\d{2}):(\d{2}):(\d{2})/.exec(v);
  return !!m && Number(m[1]) <= 24 && Number(m[2]) <= 59 && Number(m[3]) <= 59 && (Number(m[1]) < 24 || (Number(m[2]) === 0 && Number(m[3]) === 0));
};

/** Controlla un valore (già normalizzato negli spazi) contro un tipo predefinito. */
function builtinOk(t: string, v: string): boolean {
  if (t in INT_RANGE) {
    if (!/^[+-]?\d+$/.test(v)) return false;
    const n = BigInt(v);
    const [lo, hi] = INT_RANGE[t];
    return (lo === null || n >= lo) && (hi === null || n <= hi);
  }
  switch (t) {
    case 'decimal': return new RegExp(`^${DEC}$`).test(v);
    case 'float':
    case 'double': return new RegExp(`^(${DEC}([eE][+-]?\\d+)?|[+-]?INF|NaN)$`).test(v);
    case 'boolean': return /^(true|false|1|0)$/.test(v);
    case 'date': return new RegExp(`^-?\\d{4,}-\\d{2}-\\d{2}${TZ}$`).test(v) && validDate(v);
    case 'dateTime': {
      const [d, rest] = v.split('T');
      return rest !== undefined && new RegExp(`^-?\\d{4,}-\\d{2}-\\d{2}$`).test(d) && validDate(d) && new RegExp(`^\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?${TZ}$`).test(rest) && validTime(rest);
    }
    case 'time': return new RegExp(`^\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?${TZ}$`).test(v) && validTime(v);
    case 'duration': return /^-?P(?!$)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/.test(v);
    case 'gYear': return new RegExp(`^-?\\d{4,}${TZ}$`).test(v);
    case 'gYearMonth': return new RegExp(`^-?\\d{4,}-(0[1-9]|1[0-2])${TZ}$`).test(v);
    case 'gMonth': return new RegExp(`^--(0[1-9]|1[0-2])${TZ}$`).test(v);
    case 'gDay': return new RegExp(`^---(0[1-9]|[12]\\d|3[01])${TZ}$`).test(v);
    case 'gMonthDay': return new RegExp(`^--(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])${TZ}$`).test(v);
    case 'language': return /^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/.test(v);
    case 'NCName':
    case 'ID':
    case 'IDREF': return /^[\p{L}_][\p{L}\p{N}_.\-]*$/u.test(v);
    case 'Name':
    case 'QName': return /^[\p{L}_:][\p{L}\p{N}_:.\-]*$/u.test(v);
    case 'NMTOKEN': return /^[\p{L}\p{N}_.:\-]+$/u.test(v);
    case 'hexBinary': return /^([0-9a-fA-F]{2})*$/.test(v);
    case 'base64Binary': return /^[A-Za-z0-9+/\s]*={0,2}$/.test(v);
    default: return true; // string, token, anyURI, anySimpleType, anyType
  }
}

const normWs = (t: string, v: string): string => (WS_PRESERVE.has(t) ? v : t === 'normalizedString' ? v.replace(/[\t\n\r]/g, ' ') : v.replace(/\s+/g, ' ').trim());
const cmp = (t: string, a: string, b: string): number => (NUMERIC.has(t) ? Number(a) - Number(b) : a < b ? -1 : a > b ? 1 : 0);
const digits = (v: string): { total: number; frac: number } => {
  const [i, f = ''] = v.replace(/^[+-]/, '').split('.');
  return { total: (i.replace(/^0+/, '') + f.replace(/0+$/, '')).length || 1, frac: f.replace(/0+$/, '').length };
};

// ---------- validazione ----------

class Validator {
  issues: XsdIssue[] = [];
  truncated = false;
  private ids = new Set<string>();
  private idrefs: { v: string; xpath: string }[] = [];

  constructor(private readonly s: Schema) {}

  add(code: string, xpath: string, params: Record<string, string | number> = {}): void {
    if (this.issues.length >= MAX_ISSUES) this.truncated = true;
    else this.issues.push({ code, xpath, params });
  }

  finish(): void {
    for (const r of this.idrefs) if (!this.ids.has(r.v)) this.add('badIdref', r.xpath, { value: r.v });
  }

  private resolve(ref: TypeRef | undefined): { def: TypeDef } | { builtin: string } {
    if (!ref) return { builtin: 'anyType' };
    if ('inline' in ref) return { def: ref.inline };
    const d = this.s.types.get(ref.name);
    if (d) return { def: d };
    return { builtin: KNOWN.has(ref.name) ? ref.name : 'anyType' };
  }

  /** Percorre la catena di restrizioni: tipo predefinito di base e faccette di tutti i livelli. */
  private chain(ref: TypeRef | undefined, depth = 0): { builtin: string; facets: Facets[]; list?: TypeRef; union?: TypeRef[] } {
    const r = this.resolve(ref);
    if ('builtin' in r) return { builtin: r.builtin, facets: [] };
    if (depth > 30) return { builtin: 'anyType', facets: [] };
    if (r.def.k === 'complex') return r.def.ct.simple ? this.chain(r.def.ct.simple, depth + 1) : { builtin: 'anyType', facets: [] };
    const st = r.def.st;
    if (st.list) return { builtin: 'list', facets: [st.facets], list: st.list };
    if (st.union) return { builtin: 'union', facets: [st.facets], union: st.union };
    const up = this.chain(st.base, depth + 1);
    return { ...up, facets: [...up.facets, st.facets] };
  }

  /** Controlla un valore contro un tipo semplice. Restituisce null se valido, altrimenti il codice e i parametri dell'errore. */
  private checkValue(ref: TypeRef | undefined, raw: string): { code: string; params: Record<string, string | number> } | null {
    const c = this.chain(ref);
    if (c.builtin === 'list') {
      for (const item of raw.trim().split(/\s+/).filter(Boolean)) {
        const e = this.checkValue(c.list, item);
        if (e) return e;
      }
      return this.facetErr(c.facets, 'string', raw.trim().split(/\s+/).filter(Boolean).length, raw);
    }
    if (c.builtin === 'union') {
      const errs = (c.union ?? []).map((m) => this.checkValue(m, raw));
      return errs.every((e) => e) ? { code: 'badType', params: { value: raw, type: 'union' } } : null;
    }
    const v = normWs(c.builtin, raw);
    if (!builtinOk(c.builtin, v)) return { code: 'badType', params: { value: raw, type: c.builtin } };
    return this.facetErr(c.facets, c.builtin, v.length, v);
  }

  private facetErr(fs: Facets[], t: string, len: number, v: string): { code: string; params: Record<string, string | number> } | null {
    const p = (extra: Record<string, string | number>): Record<string, string | number> => ({ value: v, ...extra });
    for (const f of fs) {
      if (f.enumeration && !f.enumeration.some((e) => normWs(t, e) === v)) return { code: 'badEnum', params: p({ list: f.enumeration.join(', ') }) };
      for (const pat of f.pattern ?? []) {
        try {
          if (!new RegExp(`^(?:${pat})$`, 'u').test(v)) return { code: 'badPattern', params: p({ pattern: pat }) };
        } catch {
          /* espressione regolare non traducibile: faccetta ignorata */
        }
      }
      if (f.length !== undefined && len !== f.length) return { code: 'badLength', params: p({ facet: 'length', n: f.length }) };
      if (f.minLength !== undefined && len < f.minLength) return { code: 'badLength', params: p({ facet: 'minLength', n: f.minLength }) };
      if (f.maxLength !== undefined && len > f.maxLength) return { code: 'badLength', params: p({ facet: 'maxLength', n: f.maxLength }) };
      if (f.minInclusive !== undefined && cmp(t, v, f.minInclusive) < 0) return { code: 'badRange', params: p({ facet: 'minInclusive', n: f.minInclusive }) };
      if (f.maxInclusive !== undefined && cmp(t, v, f.maxInclusive) > 0) return { code: 'badRange', params: p({ facet: 'maxInclusive', n: f.maxInclusive }) };
      if (f.minExclusive !== undefined && cmp(t, v, f.minExclusive) <= 0) return { code: 'badRange', params: p({ facet: 'minExclusive', n: f.minExclusive }) };
      if (f.maxExclusive !== undefined && cmp(t, v, f.maxExclusive) >= 0) return { code: 'badRange', params: p({ facet: 'maxExclusive', n: f.maxExclusive }) };
      if ((f.totalDigits !== undefined || f.fractionDigits !== undefined) && NUMERIC.has(t)) {
        const d = digits(v);
        if (f.totalDigits !== undefined && d.total > f.totalDigits) return { code: 'badDigits', params: p({ facet: 'totalDigits', n: f.totalDigits }) };
        if (f.fractionDigits !== undefined && d.frac > f.fractionDigits) return { code: 'badDigits', params: p({ facet: 'fractionDigits', n: f.fractionDigits }) };
      }
    }
    return null;
  }

  private value(ref: TypeRef | undefined, raw: string, xpath: string): void {
    const e = this.checkValue(ref, raw);
    if (e) this.add(e.code, xpath, e.params);
    const b = this.chain(ref).builtin;
    if (b === 'ID') {
      const v = raw.trim();
      if (this.ids.has(v)) this.add('dupId', xpath, { value: v });
      this.ids.add(v);
    } else if (b === 'IDREF') this.idrefs.push({ v: raw.trim(), xpath });
  }

  // ---- contenuto complesso ----

  private effective(ct: ComplexDef, depth = 0): { particle: Particle | null; attrs: AttrDecl[]; anyAttr: boolean; mixed: boolean; simple?: TypeRef } {
    let attrs = [...ct.attrs];
    const seen = new Set<string>();
    const addGroups = (names: string[]): void => {
      for (const n of names) {
        const g = this.s.attrGroups.get(n);
        if (!g || seen.has(n)) continue;
        seen.add(n);
        attrs.push(...g.attrs);
        addGroups(g.groups);
      }
    };
    addGroups(ct.attrGroups);
    let particle = ct.particle;
    let mixed = ct.mixed;
    let anyAttr = ct.anyAttr;
    let simple = ct.simple;
    if (ct.extBase && depth < 30) {
      const b = this.resolve(ct.extBase);
      if ('def' in b && b.def.k === 'complex') {
        const e = this.effective(b.def.ct, depth + 1);
        attrs = [...e.attrs, ...attrs];
        anyAttr = anyAttr || e.anyAttr;
        mixed = mixed || e.mixed;
        simple = simple ?? e.simple;
        if (e.particle) particle = particle ? { k: 'seq', items: [e.particle, particle], min: 1, max: 1 } : e.particle;
      }
    }
    return { particle, attrs, anyAttr, mixed, simple };
  }

  validateElement(el: El, type: TypeRef | undefined, xpath: string): void {
    const r = this.resolve(type);
    if (at(el, 'xsi:nil') === 'true') return;
    if ('builtin' in r && r.builtin === 'anyType') return;
    if ('def' in r && r.def.k === 'complex') {
      this.validateComplex(el, r.def.ct, xpath);
      return;
    }
    // tipo semplice: niente attributi (a parte xmlns e xsi), niente figli
    this.checkAttrs(el, [], false, xpath);
    const sub = kids(el);
    if (sub.length) this.add('noChildren', xpath, { name: sub[0].name });
    this.value(type, textOf(el), xpath);
  }

  private checkAttrs(el: El, decls: AttrDecl[], any: boolean, xpath: string): void {
    for (const a of el.attrs) {
      if (a.name === 'xmlns' || a.name.startsWith('xmlns:') || a.name.startsWith('xsi:')) continue;
      const d = decls.find((x) => x.name === local(a.name));
      if (!d) {
        if (!any) this.add('unknownAttr', xpath, { name: a.name });
      } else if (d.use === 'prohibited') this.add('unknownAttr', xpath, { name: a.name });
      else this.value(d.type, unescapeXml(a.value), `${xpath}/@${a.name}`);
    }
    for (const d of decls) if (d.use === 'required' && !el.attrs.some((a) => local(a.name) === d.name)) this.add('missingAttr', xpath, { name: d.name });
  }

  private validateComplex(el: El, ct: ComplexDef, xpath: string): void {
    const e = this.effective(ct);
    this.checkAttrs(el, e.attrs, e.anyAttr, xpath);
    const sub = kids(el);
    if (e.simple) {
      if (sub.length) this.add('noChildren', xpath, { name: sub[0].name });
      this.value(e.simple, textOf(el), xpath);
      return;
    }
    if (!e.mixed && /\S/.test(textOf(el))) this.add('noText', xpath);
    if (!e.particle) {
      if (sub.length) this.add('noChildren', xpath, { name: sub[0].name });
      return;
    }
    const m = new Matcher(this.s, sub.map((c) => local(c.name)));
    if (!m.matches(e.particle)) {
      const r = m.failure();
      if (r.index < sub.length) this.add('unexpected', `${xpath}/${sub[r.index].name}`, { name: sub[r.index].name, expected: r.expected.join(', ') });
      else this.add('missing', xpath, { expected: r.expected.join(', ') });
    }
    // controllo dei figli con la dichiarazione che porta il loro nome
    const decls = new Map<string, TypeRef | undefined>();
    this.declsOf(e.particle, decls, 0);
    const count = new Map<string, number>();
    const total = new Map<string, number>();
    for (const c of sub) total.set(c.name, (total.get(c.name) ?? 0) + 1);
    for (const c of sub) {
      const n = (count.get(c.name) ?? 0) + 1;
      count.set(c.name, n);
      const name = local(c.name);
      if (!decls.has(name)) continue;
      this.validateElement(c, decls.get(name), `${xpath}/${c.name}${(total.get(c.name) ?? 0) > 1 ? `[${n}]` : ''}`);
    }
  }

  private declsOf(p: Particle, out: Map<string, TypeRef | undefined>, depth: number): void {
    if (depth > 30) return;
    if (p.k === 'el') {
      if (!out.has(p.name)) out.set(p.name, p.type ?? this.s.elements.get(p.name)?.type);
    } else if (p.k === 'group') {
      const g = this.s.groups.get(p.ref);
      if (g) this.declsOf(g, out, depth + 1);
    } else if (p.k !== 'any') for (const i of p.items) this.declsOf(i, out, depth + 1);
  }
}

function textOf(el: El): string {
  return el.children.map((c) => (c.t === 'text' ? unescapeXml(c.value) : c.t === 'cdata' ? c.raw.slice(9, -3) : '')).join('');
}

/** Controlla la sequenza dei nomi dei figli contro un modello di contenuto, con insiemi di posizioni raggiungibili. */
class Matcher {
  private expected = new Map<number, Set<string>>();

  constructor(
    private readonly s: Schema,
    private readonly names: string[],
  ) {}

  matches(p: Particle): boolean {
    return this.ends(p, 0, 0).has(this.names.length);
  }

  failure(): { index: number; expected: string[] } {
    let best = -1;
    for (const i of this.expected.keys()) best = Math.max(best, i);
    return { index: Math.max(0, best), expected: [...(this.expected.get(best) ?? [])] };
  }

  private expect(i: number, n: string): void {
    let set = this.expected.get(i);
    if (!set) this.expected.set(i, (set = new Set()));
    set.add(n);
  }

  private ends(p: Particle, i: number, depth: number): Set<number> {
    if (depth > 60) return new Set();
    const once = (from: number): Set<number> => {
      switch (p.k) {
        case 'el':
          if (this.names[from] === p.name) return new Set([from + 1]);
          this.expect(from, p.name);
          return new Set();
        case 'any':
          return from < this.names.length ? new Set([from + 1]) : new Set();
        case 'group': {
          const g = this.s.groups.get(p.ref);
          return g ? this.ends(g, from, depth + 1) : new Set();
        }
        case 'choice': {
          const out = new Set<number>();
          for (const it of p.items) for (const e of this.ends(it, from, depth + 1)) out.add(e);
          return out;
        }
        case 'seq': {
          let cur = new Set([from]);
          for (const it of p.items) {
            const next = new Set<number>();
            for (const s of cur) for (const e of this.ends(it, s, depth + 1)) next.add(e);
            cur = next;
            if (cur.size === 0) break;
          }
          return cur;
        }
        case 'all': {
          const used = new Set<number>();
          let j = from;
          for (; j < this.names.length; ) {
            const k = p.items.findIndex((it, x) => !used.has(x) && it.k === 'el' && it.name === this.names[j]);
            if (k === -1) break;
            used.add(k);
            j++;
          }
          const missing = p.items.filter((it, x) => !used.has(x) && it.min >= 1 && it.k === 'el');
          for (const m of missing) this.expect(j, (m as { name: string }).name);
          return missing.length === 0 ? new Set([j]) : new Set();
        }
      }
    };
    const out = new Set<number>();
    if (p.min === 0) out.add(i);
    let cur = new Set([i]);
    const limit = Math.max(p.min, this.names.length) + 1;
    for (let k = 1; k <= p.max && k <= limit; k++) {
      const next = new Set<number>();
      for (const s of cur) for (const e of once(s)) next.add(e);
      if (next.size === 0) break;
      if (k >= p.min) for (const e of next) out.add(e);
      if (k >= p.min && [...next].every((x) => cur.has(x))) break;
      cur = next;
    }
    return out;
  }
}

function nodesOf(src: string): { ok: true; nodes: XmlNode[] } | { ok: false; error: XmlError } {
  return parseXml(normalizeNewlines(src));
}

export function validateXsd(xsdSrc: string, xmlSrc: string): XsdResult {
  const px = nodesOf(xsdSrc);
  if (!px.ok) return { ok: false, which: 'xsd', error: px.error };
  const pd = nodesOf(xmlSrc);
  if (!pd.ok) return { ok: false, which: 'xml', error: pd.error };
  let schema: Schema;
  try {
    const root = px.nodes.find((n): n is El => n.t === 'el');
    if (!root) return { ok: false, which: 'schema', code: 'notSchema', params: {} };
    schema = parseSchema(root);
  } catch (e) {
    if (e instanceof SchemaError) return { ok: false, which: 'schema', code: e.code, params: e.params };
    throw e;
  }
  const doc = pd.nodes.find((n): n is El => n.t === 'el')!;
  const v = new Validator(schema);
  const decl = schema.elements.get(local(doc.name));
  if (!decl) v.add('noRootDecl', '/' + doc.name, { name: doc.name, known: [...schema.elements.keys()].join(', ') });
  else v.validateElement(doc, decl.type, '/' + doc.name);
  v.finish();
  return { ok: true, issues: v.issues, truncated: v.truncated };
}
