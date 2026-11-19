// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { parseJson } from '../json-formatter/json-tools';
import { XmlError, normalizeNewlines, parseXml } from '../xml-formatter/xml';
import { El, escapeAttr, unescapeXml } from '../xml-viewer/xml-tree';

/**
 * Conversione tra XSD e JSON Schema (sottoinsieme), tutto nel browser.
 *
 * Il JSON Schema descrive l'XML nella forma di «XML ↔ JSON»: attributi come chiavi con prefisso (`@id`), testo in `#text`,
 * elementi ripetuti come array, elemento radice come unica chiave del documento.
 *
 * XSD → JSON Schema (2020-12): element/attribute (anche ref), complexType con sequence, choice, all, group e attributeGroup,
 * simpleContent, complexContent con extension, simpleType con restriction, list e union, tipi predefiniti più usati, faccette
 * (enumeration, pattern, length, minLength, maxLength, min/maxInclusive, min/maxExclusive, fractionDigits), minOccurs/maxOccurs,
 * nillable, default, fixed, documentazione.
 * JSON Schema → XSD 1.0: type, properties, required, items, enum, const, pattern, minLength, maxLength, minimum, maximum,
 * exclusiveMinimum/Maximum, minItems, maxItems, format (date, date-time, time, uri, duration), description, default, $ref verso
 * $defs/definitions, allOf (unione), oneOf/anyOf di sole costanti.
 * Tutto il resto viene elencato come avviso, mai scartato in silenzio.
 */

export interface Warning {
  /** Chiave `sx.w.<code>` del dizionario. */
  code: string;
  /** Posizione nel documento di partenza (percorso JSON o nome dell'elemento XSD). */
  path: string;
  detail?: string;
}

export interface ConvOptions {
  attrPrefix: string;
  textKey: string;
  /** JSON Schema → XSD: nome dell'elemento radice quando lo schema non ne indica uno. */
  rootName: string;
  indent: 2 | 4;
}

export const DEFAULT_CONV: ConvOptions = { attrPrefix: '@', textKey: '#text', rootName: 'root', indent: 2 };

export type ConvError =
  | { kind: 'xml'; xml: XmlError }
  | { kind: 'json'; message: string; line: number | null; column: number | null }
  | { kind: 'schema'; code: 'notXsd' | 'notJsonSchema' | 'empty' };
export type ConvResult = { ok: true; text: string; warnings: Warning[] } | { ok: false; error: ConvError };

type J = Record<string, unknown>;
const isObj = (v: unknown): v is J => v !== null && typeof v === 'object' && !Array.isArray(v);
const local = (s: string): string => s.slice(s.indexOf(':') + 1);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

// ======================================================================= XSD → JSON Schema

const INT_TYPES = new Set(['integer', 'int', 'long', 'short', 'byte', 'nonNegativeInteger', 'positiveInteger', 'negativeInteger', 'nonPositiveInteger', 'unsignedLong', 'unsignedInt', 'unsignedShort', 'unsignedByte']);
const NUM_TYPES = new Set(['decimal', 'float', 'double']);
const FORMATS: Record<string, string> = { date: 'date', dateTime: 'date-time', time: 'time', anyURI: 'uri', duration: 'duration' };

function builtin(name: string): J | null {
  if (INT_TYPES.has(name)) {
    const out: J = { type: 'integer' };
    if (name === 'positiveInteger') out['minimum'] = 1;
    else if (name.startsWith('nonNeg') || name.startsWith('unsigned')) out['minimum'] = 0;
    else if (name === 'negativeInteger') out['maximum'] = -1;
    else if (name === 'nonPositiveInteger') out['maximum'] = 0;
    return out;
  }
  if (NUM_TYPES.has(name)) return { type: 'number' };
  if (name === 'boolean') return { type: 'boolean' };
  if (name === 'anyType' || name === 'anySimpleType') return {};
  if (
    ['string', 'normalizedString', 'token', 'language', 'Name', 'NCName', 'NMTOKEN', 'ID', 'IDREF', 'QName', 'base64Binary', 'hexBinary', 'gYear', 'gYearMonth', 'gMonth', 'gMonthDay', 'gDay', 'date', 'dateTime', 'time', 'duration', 'anyURI'].includes(name)
  ) {
    const f = FORMATS[name];
    return f ? { type: 'string', format: f } : { type: 'string' };
  }
  return null;
}

class XsdCtx {
  warnings: Warning[] = [];
  elements = new Map<string, El>();
  complexTypes = new Map<string, El>();
  simpleTypes = new Map<string, El>();
  groups = new Map<string, El>();
  attrGroups = new Map<string, El>();
  attributes = new Map<string, El>();
  allowAny = false;
  warn(code: string, path: string, detail?: string): void {
    if (!this.warnings.some((w) => w.code === code && w.path === path && w.detail === detail)) this.warnings.push({ code, path, detail });
  }
}

const kids = (el: El, ...names: string[]): El[] => el.children.filter((c): c is El => c.t === 'el' && (names.length === 0 || names.includes(local(c.name))));
const attr = (el: El, name: string): string | undefined => {
  const a = el.attrs.find((x) => x.name === name);
  return a === undefined ? undefined : unescapeXml(a.value);
};
const occ = (el: El): { min: number; max: number } => {
  const mx = attr(el, 'maxOccurs');
  return { min: Number(attr(el, 'minOccurs') ?? 1), max: mx === 'unbounded' ? Infinity : Number(mx ?? 1) };
};
const docOf = (el: El): string | undefined => {
  const ann = kids(el, 'annotation')[0];
  const d = ann ? kids(ann, 'documentation')[0] : undefined;
  const t = d ? d.children.map((c) => (c.t === 'text' ? unescapeXml(c.value) : '')).join('').replace(/\s+/g, ' ').trim() : '';
  return t === '' ? undefined : t;
};
const withDoc = (s: J, el: El): J => {
  const d = docOf(el);
  return d ? { ...s, description: d } : s;
};

/** Costruisce un valore del tipo `typeName`: predefinito, definito dall'utente (`$ref`) o sconosciuto (avviso). */
function namedType(name: string, ctx: XsdCtx, path: string): J {
  const n = local(name);
  if (ctx.complexTypes.has(n) || ctx.simpleTypes.has(n)) return { $ref: `#/$defs/${n}` };
  const b = builtin(n);
  if (b) return { ...b };
  ctx.warn('unknownType', path, name);
  return {};
}

function simpleSchema(st: El, ctx: XsdCtx, path: string): J {
  const res = kids(st, 'restriction')[0];
  if (res) {
    const inner = kids(res, 'simpleType')[0];
    const base = inner ? simpleSchema(inner, ctx, path) : attr(res, 'base') ? namedType(attr(res, 'base') as string, ctx, path) : {};
    return applyFacets(base, res, ctx, path);
  }
  const list = kids(st, 'list')[0];
  if (list) {
    const inner = kids(list, 'simpleType')[0];
    const items = inner ? simpleSchema(inner, ctx, path) : attr(list, 'itemType') ? namedType(attr(list, 'itemType') as string, ctx, path) : {};
    ctx.warn('listAsArray', path);
    return { type: 'array', items };
  }
  const un = kids(st, 'union')[0];
  if (un) {
    const members = kids(un, 'simpleType').map((m) => simpleSchema(m, ctx, path));
    for (const t of (attr(un, 'memberTypes') ?? '').split(/\s+/).filter(Boolean)) members.push(namedType(t, ctx, path));
    return { anyOf: members };
  }
  return {};
}

function applyFacets(base: J, res: El, ctx: XsdCtx, path: string): J {
  const out: J = { ...base };
  const isNum = out['type'] === 'integer' || out['type'] === 'number';
  const enumeration: unknown[] = [];
  const patterns: string[] = [];
  for (const f of kids(res)) {
    const k = local(f.name);
    const v = attr(f, 'value') ?? '';
    switch (k) {
      case 'enumeration': enumeration.push(isNum ? Number(v) : out['type'] === 'boolean' ? v === 'true' : v); break;
      case 'pattern':
        patterns.push(v); // XSD ancora sempre il modello: in JSON Schema si ottiene con ^(?:…)$
        if (/\\[ic]|-\[/.test(v)) ctx.warn('patternSyntax', path, v);
        break;
      case 'length': out['minLength'] = Number(v); out['maxLength'] = Number(v); break;
      case 'minLength': out['minLength'] = Number(v); break;
      case 'maxLength': out['maxLength'] = Number(v); break;
      case 'minInclusive': case 'maxInclusive': case 'minExclusive': case 'maxExclusive': {
        if (!isNum) {
          ctx.warn('facetNotNumeric', path, `${k}=${v}`);
          break;
        }
        const key = { minInclusive: 'minimum', maxInclusive: 'maximum', minExclusive: 'exclusiveMinimum', maxExclusive: 'exclusiveMaximum' }[k] as string;
        out[key] = Number(v);
        break;
      }
      case 'fractionDigits': out['multipleOf'] = Number(v) === 0 && out['type'] === 'number' ? 1 : Number((10 ** -Number(v)).toFixed(Number(v))); break;
      case 'totalDigits': ctx.warn('totalDigits', path, v); break;
      case 'whiteSpace': ctx.warn('whiteSpace', path, v); break;
      case 'annotation': case 'simpleType': break;
      default: ctx.warn('facet', path, k);
    }
  }
  if (enumeration.length) out['enum'] = enumeration;
  if (patterns.length === 1) out['pattern'] = `^(?:${patterns[0]})$`;
  else if (patterns.length > 1) out['allOf'] = patterns.map((p) => ({ pattern: `^(?:${p})$` }));
  return out;
}

interface Props {
  props: Record<string, J>;
  required: string[];
  /** Per ogni `choice` obbligatoria, i nomi richiesti da ciascun ramo. */
  choices: string[][][];
}

function elementSchema(el: El, ctx: XsdCtx, path: string): { name: string; schema: J } | null {
  const ref = attr(el, 'ref');
  if (ref) {
    const g = ctx.elements.get(local(ref));
    if (!g) {
      ctx.warn('unknownRef', path, ref);
      return null;
    }
    return { name: local(ref), schema: elementSchema(g, ctx, path + '/' + local(ref))?.schema ?? {} };
  }
  const name = attr(el, 'name') ?? '';
  const p = path === '' ? name : `${path}/${name}`;
  if (attr(el, 'substitutionGroup')) ctx.warn('substitution', p);
  if (kids(el, 'key', 'keyref', 'unique').length) ctx.warn('identity', p);
  let schema: J;
  const type = attr(el, 'type');
  const ict = kids(el, 'complexType')[0];
  const ist = kids(el, 'simpleType')[0];
  if (type) schema = namedType(type, ctx, p);
  else if (ict) schema = complexSchema(ict, ctx, p);
  else if (ist) schema = simpleSchema(ist, ctx, p);
  else schema = {};
  if (attr(el, 'nillable') === 'true') {
    const t = schema['type'];
    schema = typeof t === 'string' ? { ...schema, type: [t, 'null'] } : { anyOf: [schema, { type: 'null' }] };
  }
  const d = attr(el, 'default');
  const f = attr(el, 'fixed');
  const isNum = schema['type'] === 'integer' || schema['type'] === 'number';
  const conv = (v: string): unknown => (isNum ? Number(v) : schema['type'] === 'boolean' ? v === 'true' : v);
  if (f !== undefined) schema = { ...schema, const: conv(f) };
  else if (d !== undefined) schema = { ...schema, default: conv(d) };
  return { name, schema: withDoc(schema, el) };
}

function addParticle(p: El, ctx: XsdCtx, acc: Props, path: string, optional: boolean, depth: number): void {
  if (depth > 40) return;
  const k = local(p.name);
  const { min, max } = occ(p);
  const opt = optional || min === 0;
  if (k === 'element') {
    const e = elementSchema(p, ctx, path);
    if (!e) return;
    const schema = max > 1 ? { type: 'array', items: e.schema, ...(min > 1 ? { minItems: min } : {}), ...(Number.isFinite(max) ? { maxItems: max } : {}) } : e.schema;
    if (e.name in acc.props) {
      ctx.warn('repeatedElement', path, e.name);
      acc.props[e.name] = { type: 'array', items: e.schema };
    } else acc.props[e.name] = schema;
    if (!opt && !acc.required.includes(e.name)) acc.required.push(e.name);
  } else if (k === 'sequence' || k === 'all') {
    if (max > 1) ctx.warn('repeatedGroup', path, k);
    for (const c of kids(p, 'element', 'sequence', 'choice', 'all', 'group', 'any')) addParticle(c, ctx, acc, path, opt, depth + 1);
  } else if (k === 'choice') {
    const branches: string[][] = [];
    let ok = !opt;
    for (const c of kids(p, 'element', 'sequence', 'choice', 'all', 'group', 'any')) {
      const sub: Props = { props: acc.props, required: [], choices: [] };
      addParticle(c, ctx, sub, path, true, depth + 1);
      const names = firstNames(c, ctx);
      if (names.length === 0) ok = false;
      branches.push(names);
    }
    if (max > 1) ctx.warn('repeatedGroup', path, k);
    if (ok && branches.length > 0) acc.choices.push(branches);
    else if (branches.length > 1) ctx.warn('choiceLoose', path);
  } else if (k === 'group') {
    const g = ctx.groups.get(local(attr(p, 'ref') ?? ''));
    if (!g) return ctx.warn('unknownRef', path, attr(p, 'ref') ?? '');
    for (const c of kids(g, 'sequence', 'choice', 'all')) addParticle(c, ctx, acc, path, opt, depth + 1);
  } else if (k === 'any') {
    ctx.allowAny = true;
    ctx.warn('any', path);
  }
}

/** Elementi che un ramo di choice richiede (per `oneOf`). */
function firstNames(c: El, ctx: XsdCtx): string[] {
  const k = local(c.name);
  if (occ(c).min === 0) return [];
  if (k === 'element') {
    const r = attr(c, 'ref');
    return [r ? local(r) : (attr(c, 'name') ?? '')];
  }
  if (k === 'sequence' || k === 'all') return kids(c, 'element', 'sequence', 'group').flatMap((x) => firstNames(x, ctx));
  if (k === 'group') {
    const g = ctx.groups.get(local(attr(c, 'ref') ?? ''));
    return g ? kids(g, 'sequence', 'all').flatMap((x) => firstNames(x, ctx)) : [];
  }
  return [];
}

function addAttrs(ct: El, ctx: XsdCtx, acc: Props, path: string, o: ConvOptions): void {
  for (const a of kids(ct, 'attribute', 'attributeGroup', 'anyAttribute')) {
    const k = local(a.name);
    if (k === 'anyAttribute') {
      ctx.allowAny = true;
      ctx.warn('anyAttribute', path);
    } else if (k === 'attributeGroup') {
      const g = ctx.attrGroups.get(local(attr(a, 'ref') ?? ''));
      if (g) addAttrs(g, ctx, acc, path, o);
      else ctx.warn('unknownRef', path, attr(a, 'ref') ?? '');
    } else {
      const ref = attr(a, 'ref');
      const decl = ref ? ctx.attributes.get(local(ref)) : a;
      const name = ref ? local(ref) : (attr(a, 'name') ?? '');
      if (!decl) {
        ctx.warn('unknownRef', path, ref ?? '');
        continue;
      }
      if (attr(a, 'use') === 'prohibited') continue;
      const type = attr(decl, 'type');
      const ist = kids(decl, 'simpleType')[0];
      let s: J = type ? namedType(type, ctx, `${path}/@${name}`) : ist ? simpleSchema(ist, ctx, `${path}/@${name}`) : { type: 'string' };
      const isNum = s['type'] === 'integer' || s['type'] === 'number';
      const fx = attr(a, 'fixed');
      const df = attr(a, 'default');
      const conv = (v: string): unknown => (isNum ? Number(v) : s['type'] === 'boolean' ? v === 'true' : v);
      if (fx !== undefined) s = { ...s, const: conv(fx) };
      else if (df !== undefined) s = { ...s, default: conv(df) };
      acc.props[o.attrPrefix + name] = withDoc(s, decl);
      if (attr(a, 'use') === 'required') acc.required.push(o.attrPrefix + name);
    }
  }
}

let OPTS: ConvOptions = DEFAULT_CONV;

function finishObject(acc: Props, ctx: XsdCtx): J {
  const out: J = { type: 'object', properties: acc.props };
  if (acc.required.length) out['required'] = acc.required;
  if (!ctx.allowAny) out['additionalProperties'] = false;
  const sets = acc.choices.map((branches) => ({ oneOf: branches.map((names) => ({ required: names })) }));
  if (sets.length === 1) out['oneOf'] = sets[0].oneOf;
  else if (sets.length > 1) out['allOf'] = sets;
  return out;
}

function complexSchema(ct: El, ctx: XsdCtx, path: string, depth = 0): J {
  const o = OPTS;
  const acc: Props = { props: {}, required: [], choices: [] };
  const savedAny = ctx.allowAny;
  ctx.allowAny = false;
  let result: J;
  const sc = kids(ct, 'simpleContent')[0];
  const cc = kids(ct, 'complexContent')[0];
  if (sc) {
    const ext = kids(sc, 'extension', 'restriction')[0];
    const base = ext ? attr(ext, 'base') : undefined;
    let text: J = base ? namedType(base, ctx, path) : { type: 'string' };
    if (ext && local(ext.name) === 'restriction') text = applyFacets(text, ext, ctx, path);
    if (ext) addAttrs(ext, ctx, acc, path, o);
    if (Object.keys(acc.props).length === 0) result = text;
    else {
      acc.props = { [o.textKey]: text, ...acc.props };
      result = finishObject(acc, ctx);
    }
  } else {
    const content = cc ? kids(cc, 'extension', 'restriction')[0] : undefined;
    const holder = content ?? ct;
    if (content && local(content.name) === 'extension') {
      const baseName = local(attr(content, 'base') ?? '');
      const baseCt = ctx.complexTypes.get(baseName);
      if (baseCt && depth < 20) {
        const b = complexSchema(baseCt, ctx, path, depth + 1);
        if (isObj(b['properties'])) Object.assign(acc.props, b['properties'] as Record<string, J>);
        if (Array.isArray(b['required'])) acc.required.push(...(b['required'] as string[]));
      } else if (!baseCt && baseName !== 'anyType') ctx.warn('unknownType', path, baseName);
    } else if (content) ctx.warn('restrictionComplex', path);
    for (const p of kids(holder, 'sequence', 'choice', 'all', 'group')) addParticle(p, ctx, acc, path, false, 0);
    addAttrs(holder, ctx, acc, path, o);
    if (attr(ct, 'mixed') === 'true' || (cc && attr(cc, 'mixed') === 'true')) {
      ctx.warn('mixed', path);
      acc.props[o.textKey] = { type: 'string' };
    }
    result = finishObject(acc, ctx);
  }
  ctx.allowAny = savedAny || ctx.allowAny;
  return withDoc(result, ct);
}

export function xsdToJsonSchema(src: string, options: Partial<ConvOptions> = {}): ConvResult {
  const o = { ...DEFAULT_CONV, ...options };
  OPTS = o;
  const parsed = parseXml(normalizeNewlines(src));
  if (!parsed.ok) return { ok: false, error: { kind: 'xml', xml: parsed.error } };
  const root = parsed.nodes.find((n): n is El => n.t === 'el');
  if (!root) return { ok: false, error: { kind: 'schema', code: 'empty' } };
  if (local(root.name) !== 'schema') return { ok: false, error: { kind: 'schema', code: 'notXsd' } };
  const ctx = new XsdCtx();
  if (attr(root, 'targetNamespace')) ctx.warn('namespace', '');
  for (const c of kids(root)) {
    const k = local(c.name);
    const n = attr(c, 'name') ?? '';
    if (k === 'element') ctx.elements.set(n, c);
    else if (k === 'complexType') ctx.complexTypes.set(n, c);
    else if (k === 'simpleType') ctx.simpleTypes.set(n, c);
    else if (k === 'group') ctx.groups.set(n, c);
    else if (k === 'attributeGroup') ctx.attrGroups.set(n, c);
    else if (k === 'attribute') ctx.attributes.set(n, c);
    else if (k === 'import' || k === 'include' || k === 'redefine') ctx.warn('import', '', attr(c, 'schemaLocation') ?? attr(c, 'namespace') ?? k);
    else if (k !== 'annotation' && k !== 'notation') ctx.warn('construct', '', k);
  }
  const defs: Record<string, J> = {};
  for (const [n, c] of ctx.simpleTypes) defs[n] = withDoc(simpleSchema(c, ctx, n), c);
  for (const [n, c] of ctx.complexTypes) defs[n] = complexSchema(c, ctx, n);
  const globals: { name: string; schema: J }[] = [];
  for (const [, e] of ctx.elements) {
    const r = elementSchema(e, ctx, '');
    if (r) globals.push(r);
  }
  if (globals.length === 0) return { ok: false, error: { kind: 'schema', code: 'empty' } };
  const out: J = { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object' };
  if (globals.length === 1) {
    out['properties'] = { [globals[0].name]: globals[0].schema };
    out['required'] = [globals[0].name];
  } else {
    out['properties'] = Object.fromEntries(globals.map((g) => [g.name, g.schema]));
    out['oneOf'] = globals.map((g) => ({ required: [g.name] }));
    ctx.warn('multiRoot', '', globals.map((g) => g.name).join(', '));
  }
  out['additionalProperties'] = false;
  if (Object.keys(defs).length) out['$defs'] = defs;
  return { ok: true, text: JSON.stringify(out, null, o.indent) + '\n', warnings: ctx.warnings };
}

// ======================================================================= JSON Schema → XSD

interface XNode {
  n: string;
  a: [string, string][];
  c: (XNode | string)[];
}
const x = (n: string, a: Record<string, string | undefined> = {}, c: (XNode | string | null | undefined)[] = []): XNode => ({
  n: 'xs:' + n,
  a: Object.entries(a).filter((e): e is [string, string] => e[1] !== undefined),
  c: c.filter((v): v is XNode | string => v !== null && v !== undefined),
});

function serializeX(n: XNode, depth: number, unit: string, out: string[]): void {
  const pad = unit.repeat(depth);
  const attrs = n.a.map(([k, v]) => ` ${k}="${escapeAttr(v, '"')}"`).join('');
  if (n.c.length === 0) {
    out.push(`${pad}<${n.n}${attrs}/>`);
  } else if (n.c.length === 1 && typeof n.c[0] === 'string') {
    out.push(`${pad}<${n.n}${attrs}>${(n.c[0] as string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</${n.n}>`);
  } else {
    out.push(`${pad}<${n.n}${attrs}>`);
    for (const ch of n.c) if (typeof ch !== 'string') serializeX(ch, depth + 1, unit, out);
    out.push(`${pad}</${n.n}>`);
  }
}

const SILENT = new Set(['$schema', '$id', '$comment', 'title', 'examples', 'readOnly', 'writeOnly', 'deprecated', '$defs', 'definitions', 'description', 'default', 'additionalProperties']);
const HANDLED = new Set(['type', 'properties', 'required', 'items', 'enum', 'const', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minItems', 'maxItems', 'format', '$ref', 'allOf', 'oneOf', 'anyOf', 'multipleOf']);

class JsCtx {
  warnings: Warning[] = [];
  warn(code: string, path: string, detail?: string): void {
    if (!this.warnings.some((w) => w.code === code && w.path === path && w.detail === detail)) this.warnings.push({ code, path, detail });
  }
  defs = new Map<string, J>();
  used = new Map<string, 'simple' | 'complex'>();
  constructor(
    readonly root: J,
    readonly o: ConvOptions,
  ) {
    for (const k of ['$defs', 'definitions']) {
      const d = root[k];
      if (isObj(d)) for (const [n, v] of Object.entries(d)) if (isObj(v)) this.defs.set(n, v);
    }
  }
}

const ncname = (s: string): string => {
  const t = s.replace(/[^\p{L}\p{N}_.-]/gu, '_');
  return /^[\p{L}_]/u.test(t) ? t : '_' + t;
};

/** Unisce allOf (proprietà e required) e risolve oneOf/anyOf di sole costanti in un enum. */
function flatten(s: J, c: JsCtx, path: string, depth = 0): J {
  let out: J = { ...s };
  if (Array.isArray(s['allOf']) && depth < 20) {
    delete out['allOf'];
    for (const part of s['allOf'] as unknown[]) {
      if (!isObj(part)) continue;
      const p = flatten(deref(part, c), c, path, depth + 1);
      const props = { ...(isObj(out['properties']) ? out['properties'] : {}), ...(isObj(p['properties']) ? p['properties'] : {}) };
      const req = [...new Set([...(Array.isArray(out['required']) ? (out['required'] as string[]) : []), ...(Array.isArray(p['required']) ? (p['required'] as string[]) : [])])];
      out = { ...p, ...out, ...(Object.keys(props).length ? { properties: props } : {}), ...(req.length ? { required: req } : {}) };
    }
  }
  for (const k of ['oneOf', 'anyOf']) {
    const alts = s[k];
    if (!Array.isArray(alts)) continue;
    const consts = alts.every((a) => isObj(a) && ('const' in a || Array.isArray(a['enum'])));
    if (consts && alts.length) {
      delete out[k];
      out['enum'] = alts.flatMap((a) => (('const' in (a as J) ? [(a as J)['const']] : ((a as J)['enum'] as unknown[]))));
    }
  }
  return out;
}

function deref(s: J, c: JsCtx): J {
  const r = s['$ref'];
  if (typeof r !== 'string') return s;
  const m = /^#\/(?:\$defs|definitions)\/(.+)$/.exec(r);
  const d = m ? c.defs.get(decodeURIComponent(m[1].replace(/~1/g, '/').replace(/~0/g, '~'))) : undefined;
  return d ?? s;
}

function checkKeywords(s: J, c: JsCtx, path: string): void {
  for (const k of Object.keys(s)) {
    if (HANDLED.has(k) || SILENT.has(k)) continue;
    c.warn('ignored', path, k);
  }
  if (s['multipleOf'] !== undefined) c.warn('ignored', path, 'multipleOf');
  if (Array.isArray(s['oneOf']) || Array.isArray(s['anyOf'])) c.warn('alternatives', path, Array.isArray(s['oneOf']) ? 'oneOf' : 'anyOf');
  if (isObj(s['additionalProperties']) || s['additionalProperties'] === true) c.warn('additional', path);
}

function simpleBase(s: J): { base: string; numeric: boolean } {
  const t = Array.isArray(s['type']) ? (s['type'] as unknown[]).find((v) => v !== 'null') : s['type'];
  if (t === 'integer') return { base: 'xs:integer', numeric: true };
  if (t === 'number') return { base: 'xs:decimal', numeric: true };
  if (t === 'boolean') return { base: 'xs:boolean', numeric: false };
  const f = s['format'];
  const m: Record<string, string> = { date: 'xs:date', 'date-time': 'xs:dateTime', time: 'xs:time', uri: 'xs:anyURI', duration: 'xs:duration' };
  return { base: typeof f === 'string' && m[f] ? m[f] : 'xs:string', numeric: false };
}

const isSimple = (s: J): boolean => {
  const t = Array.isArray(s['type']) ? (s['type'] as unknown[]).find((v) => v !== 'null') : s['type'];
  if (t === 'object' || t === 'array' || isObj(s['properties'])) return false;
  return true;
};

/** Tipo semplice (restriction con faccette) oppure null se bastano il tipo predefinito. */
function simpleTypeNode(s: J, c: JsCtx, path: string): { typeAttr?: string; node?: XNode } {
  const { base, numeric } = simpleBase(s);
  const facets: XNode[] = [];
  const en = Array.isArray(s['enum']) ? (s['enum'] as unknown[]) : 'const' in s ? [s['const']] : [];
  for (const v of en) facets.push(x('enumeration', { value: String(v) }));
  const str = (k: string): string | undefined => (typeof s[k] === 'string' ? (s[k] as string) : undefined);
  const pat = str('pattern');
  if (pat !== undefined) {
    const wrapped = /^\^\(\?:([\s\S]*)\)\$$/.exec(pat);
    facets.push(x('pattern', { value: wrapped ? wrapped[1] : pat.replace(/^\^/, '').replace(/\$$/, '') }));
    if (/\(\?[=!<]|\\[bBAZ]/.test(pat)) c.warn('patternSyntax', path, pat);
  }
  const nums: [string, string][] = [['minLength', 'minLength'], ['maxLength', 'maxLength']];
  for (const [k, f] of nums) if (num(s[k]) !== undefined) facets.push(x(f, { value: String(s[k]) }));
  const range: [string, string][] = [['minimum', 'minInclusive'], ['maximum', 'maxInclusive'], ['exclusiveMinimum', 'minExclusive'], ['exclusiveMaximum', 'maxExclusive']];
  for (const [k, f] of range) if (num(s[k]) !== undefined) facets.push(x(f, { value: String(s[k]) }));
  if (typeof s['exclusiveMinimum'] === 'boolean' || typeof s['exclusiveMaximum'] === 'boolean') c.warn('ignored', path, 'exclusiveMinimum/Maximum booleano (draft-04)');
  if (!numeric && (num(s['minimum']) !== undefined || num(s['maximum']) !== undefined)) c.warn('ignored', path, 'minimum/maximum su un tipo non numerico');
  if (facets.length === 0) return { typeAttr: base };
  return { node: x('simpleType', {}, [x('restriction', { base }, facets)]) };
}

function docNode(s: J): XNode | null {
  return typeof s['description'] === 'string' && s['description'] !== '' ? x('annotation', {}, [x('documentation', {}, [s['description'] as string])]) : null;
}

/** Dichiarazione di un elemento per la proprietà `name`. */
function elementNode(name: string, schema: J, required: boolean, c: JsCtx, path: string): XNode {
  let s = schema;
  let min = required ? 1 : 0;
  let max: number = 1;
  let desc = docNode(s);
  if (s['type'] === 'array' || (typeof s['$ref'] !== 'string' && isObj(s['items']) && s['type'] === undefined)) {
    checkKeywords(s, c, path);
    min = Math.max(num(s['minItems']) ?? 0, required ? 1 : 0);
    if (!required && num(s['minItems']) === undefined) min = 0;
    const mi = num(s['maxItems']);
    max = mi ?? Infinity;
    const it = isObj(s['items']) ? s['items'] : {};
    if (Array.isArray(s['items'])) c.warn('ignored', path, 'items come elenco (tuple)');
    if (it['type'] === 'array') c.warn('nestedArray', path);
    s = it;
    desc = desc ?? docNode(s);
  }
  const attrs: Record<string, string | undefined> = {
    name: ncname(name),
    minOccurs: min === 1 ? undefined : String(min),
    maxOccurs: max === 1 ? undefined : Number.isFinite(max) ? String(max) : 'unbounded',
  };
  const t = typeNodes(s, c, path);
  const d = typeof s['default'] === 'string' || typeof s['default'] === 'number' || typeof s['default'] === 'boolean' ? String(s['default']) : undefined;
  if (Array.isArray(s['type']) && (s['type'] as unknown[]).includes('null')) attrs['nillable'] = 'true';
  if (d !== undefined) attrs['default'] = d;
  return withType(x('element', attrs, [desc, t.complexType ?? t.simpleType]), t.typeAttr);
}

function withType(n: XNode, type: string | undefined): XNode {
  if (type) n.a.splice(1, 0, ['type', type]);
  return n;
}

function typeNodes(schema: J, c: JsCtx, path: string): { typeAttr?: string; simpleType?: XNode; complexType?: XNode } {
  const ref = schema['$ref'];
  if (typeof ref === 'string') {
    const m = /^#\/(?:\$defs|definitions)\/(.+)$/.exec(ref);
    const name = m ? decodeURIComponent(m[1].replace(/~1/g, '/').replace(/~0/g, '~')) : undefined;
    const d = name !== undefined ? c.defs.get(name) : undefined;
    if (name === undefined || !d) {
      c.warn('unresolvedRef', path, ref);
      return { typeAttr: 'xs:anyType' };
    }
    const kind = isSimple(flatten(d, c, path)) ? 'simple' : 'complex';
    c.used.set(name, kind);
    return { typeAttr: ncname(name) };
  }
  const s = flatten(schema, c, path);
  checkKeywords(s, c, path);
  if (isObj(s['properties']) || s['type'] === 'object') return { complexType: complexNode(s, c, path) };
  if (s['type'] === 'array') {
    c.warn('nestedArray', path);
    return { typeAttr: 'xs:anyType' };
  }
  if (s['type'] === undefined && !('enum' in s) && !('const' in s)) {
    return { typeAttr: 'xs:anyType' };
  }
  const t = simpleTypeNode(s, c, path);
  return { typeAttr: t.typeAttr, simpleType: t.node };
}

function complexNode(s: J, c: JsCtx, path: string): XNode {
  const o = c.o;
  const props = isObj(s['properties']) ? s['properties'] : {};
  const req = new Set(Array.isArray(s['required']) ? (s['required'] as string[]) : []);
  const els: XNode[] = [];
  const atts: XNode[] = [];
  let text: J | undefined;
  for (const [k, raw] of Object.entries(props)) {
    const v = isObj(raw) ? raw : {};
    const p = `${path}/${k}`;
    if (o.attrPrefix !== '' && k.startsWith(o.attrPrefix)) {
      const flat = flatten(deref(v, c), c, p);
      if (!isSimple(flat)) {
        c.warn('attrNotSimple', p);
        continue;
      }
      const t = typeof v['$ref'] === 'string' ? typeNodes(v, c, p) : simpleTypeNode(flat, c, p);
      const d = flat['default'];
      atts.push(
        withType(
          x('attribute', { name: ncname(k.slice(o.attrPrefix.length)), use: req.has(k) ? 'required' : undefined, default: typeof d === 'string' || typeof d === 'number' || typeof d === 'boolean' ? String(d) : undefined }, [
            docNode(v),
            'node' in t ? (t as { node?: XNode }).node : (t as { simpleType?: XNode }).simpleType,
          ]),
          t.typeAttr,
        ),
      );
    } else if (k === o.textKey) text = v;
    else els.push(elementNode(k, v, req.has(k), c, p));
  }
  if (text !== undefined && els.length === 0) {
    const flat = flatten(deref(text, c), c, path + '/' + o.textKey);
    const t = typeof text['$ref'] === 'string' ? typeNodes(text, c, path) : simpleTypeNode(flat, c, path);
    return x('complexType', {}, [x('simpleContent', {}, [x('extension', { base: t.typeAttr ?? 'xs:string' }, atts)])]);
  }
  if (text !== undefined) c.warn('textWithChildren', path);
  return x('complexType', {}, [els.length ? x('sequence', {}, els) : null, ...atts]);
}

export function jsonSchemaToXsd(src: string, options: Partial<ConvOptions> = {}): ConvResult {
  const o = { ...DEFAULT_CONV, ...options };
  const parsed = parseJson(src);
  if (!parsed.ok) return { ok: false, error: { kind: 'json', message: parsed.error.message, line: parsed.error.line, column: parsed.error.column } };
  const root = parsed.value;
  if (!isObj(root)) return { ok: false, error: { kind: 'schema', code: 'notJsonSchema' } };
  const c = new JsCtx(root, o);
  const top = flatten(deref(root, c), c, '');
  checkKeywords(top, c, '');
  const props = isObj(top['properties']) ? top['properties'] : {};
  const keys = Object.keys(props).filter((k) => !(o.attrPrefix !== '' && k.startsWith(o.attrPrefix)) && k !== o.textKey);
  let rootEl: XNode;
  if (top['type'] === 'array') {
    const it = isObj(top['items']) ? top['items'] : {};
    rootEl = x('element', { name: ncname(typeof root['title'] === 'string' && root['title'] ? (root['title'] as string) : o.rootName) }, [
      x('complexType', {}, [x('sequence', {}, [elementNode('item', it, false, c, '/items')])]),
    ]);
    (((rootEl.c[0] as XNode).c[0] as XNode).c[0] as XNode).a.push(['maxOccurs', 'unbounded']);
  } else if (keys.length === 1 && (top['type'] === 'object' || top['type'] === undefined) && Object.keys(props).length === 1) {
    // un solo elemento nel documento: è l'elemento radice (la forma prodotta da XSD → JSON Schema)
    const only = props[keys[0]];
    rootEl = elementNode(keys[0], isObj(only) ? only : {}, true, c, '/' + keys[0]);
    rootEl.a = rootEl.a.filter(([k]) => k !== 'minOccurs');
  } else if (top['type'] === 'object' || isObj(top['properties'])) {
    const name = typeof root['title'] === 'string' && root['title'] ? (root['title'] as string) : o.rootName;
    rootEl = x('element', { name: ncname(name) }, [docNode(top), complexNode(top, c, '')]);
  } else {
    rootEl = x('element', { name: ncname(o.rootName), type: simpleBase(top).base });
  }
  // tipi globali richiesti dai $ref (anche a catena)
  const emitted = new Map<string, XNode>();
  for (let guard = 0; guard < 200; guard++) {
    const pending = [...c.used.keys()].filter((n) => !emitted.has(n));
    if (pending.length === 0) break;
    for (const n of pending) {
      const d = flatten(c.defs.get(n) as J, c, '/$defs/' + n);
      checkKeywords(d, c, '/$defs/' + n);
      if (c.used.get(n) === 'simple') {
        const t = simpleTypeNode(d, c, '/$defs/' + n);
        const st = t.node ?? x('simpleType', {}, [x('restriction', { base: t.typeAttr ?? 'xs:string' })]);
        st.a.unshift(['name', ncname(n)]);
        emitted.set(n, st);
      } else {
        const ct = complexNode(d, c, '/$defs/' + n);
        ct.a.unshift(['name', ncname(n)]);
        emitted.set(n, ct);
      }
    }
  }
  const schema = x('schema', { 'xmlns:xs': 'http://www.w3.org/2001/XMLSchema', elementFormDefault: 'qualified' }, [rootEl, ...emitted.values()]);
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  serializeX(schema, 0, ' '.repeat(o.indent), lines);
  return { ok: true, text: lines.join('\n') + '\n', warnings: c.warnings };
}
