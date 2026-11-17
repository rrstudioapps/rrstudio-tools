// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Da un valore JSON a interfacce TypeScript e a uno JSON Schema (draft 2020-12).
 * Si ricava prima una "forma" che unisce tutto ciò che si osserva (anche i diversi elementi di un array);
 * poi la forma si scrive nei due formati. Logica pura.
 */

export type Prim = 'string' | 'integer' | 'number' | 'boolean' | 'null';

/** Forma osservata: tipi primitivi, forma degli array (elementi uniti) e degli oggetti (proprietà unite). */
export interface Shape {
  prims: Set<Prim>;
  arr: Shape | null;
  obj: Map<string, { shape: Shape; opt: boolean }> | null;
}

const empty = (): Shape => ({ prims: new Set(), arr: null, obj: null });
const isEmpty = (s: Shape): boolean => s.prims.size === 0 && !s.arr && !s.obj;

/** Profondità massima analizzata (oltre, il resto diventa `unknown`): evita di esaurire lo stack. */
export const MAX_DEPTH = 200;

function shapeOf(v: unknown, depth = 0): Shape {
  const s = empty();
  if (v === null) s.prims.add('null');
  else if (typeof v === 'string') s.prims.add('string');
  else if (typeof v === 'boolean') s.prims.add('boolean');
  else if (typeof v === 'number') s.prims.add(Number.isInteger(v) ? 'integer' : 'number');
  else if (depth >= MAX_DEPTH) return s;
  else if (Array.isArray(v)) {
    s.arr = empty();
    for (const x of v) s.arr = merge(s.arr, shapeOf(x, depth + 1));
  } else if (typeof v === 'object') {
    s.obj = new Map();
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) s.obj.set(k, { shape: shapeOf(x, depth + 1), opt: false });
  }
  return s;
}

/** Unisce due forme: le proprietà presenti in una sola diventano opzionali. */
export function merge(a: Shape, b: Shape): Shape {
  const out = empty();
  for (const p of a.prims) out.prims.add(p);
  for (const p of b.prims) out.prims.add(p);
  if (out.prims.has('integer') && out.prims.has('number')) out.prims.delete('integer');
  out.arr = a.arr && b.arr ? merge(a.arr, b.arr) : (a.arr ?? b.arr);
  if (a.obj && b.obj) {
    out.obj = new Map();
    for (const [k, v] of a.obj) {
      const o = b.obj.get(k);
      out.obj.set(k, o ? { shape: merge(v.shape, o.shape), opt: v.opt || o.opt } : { shape: v.shape, opt: true });
    }
    for (const [k, v] of b.obj) if (!a.obj.has(k)) out.obj.set(k, { shape: v.shape, opt: true });
  } else if (a.obj || b.obj) {
    const src = (a.obj ?? b.obj)!;
    out.obj = new Map([...src].map(([k, v]) => [k, { shape: v.shape, opt: v.opt }]));
  }
  return out;
}

export function inferShape(value: unknown): Shape {
  return shapeOf(value);
}

// ---------- TypeScript ----------

export interface TsOptions {
  rootName: string;
  /** `interface` o `type` per gli oggetti. */
  style: 'interface' | 'type';
  exportKeyword: boolean;
}

export const DEFAULT_TS_OPTIONS: TsOptions = { rootName: 'Root', style: 'interface', exportKeyword: true };

const RESERVED_TYPE_NAMES = new Set(['Object', 'Array', 'Date', 'Map', 'Set', 'Promise', 'Record', 'Error', 'Function', 'String', 'Number', 'Boolean', 'Symbol', 'Partial', 'Readonly', 'Pick', 'Omit', 'Required', 'Any', 'Never', 'Unknown', 'Void']);

/** `user_name`, `user-name`, `userName`, `user name` → `UserName`. Resta un identificatore valido. */
export function pascalCase(raw: string): string {
  const words = raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  let name = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  if (!name) name = 'Item';
  if (/^\d/.test(name)) name = '_' + name;
  if (RESERVED_TYPE_NAMES.has(name)) name += 'Value';
  return name;
}

/** Nome al singolare per gli elementi di un array (`items` → `Item`, `categories` → `Category`). */
export function singular(pascal: string): string {
  if (/ies$/.test(pascal) && pascal.length > 4) return pascal.slice(0, -3) + 'y';
  if (/(ss|us|is)$/i.test(pascal)) return pascal;
  if (/s$/.test(pascal) && pascal.length > 2) return pascal.slice(0, -1);
  return pascal;
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const propKey = (k: string): string => (IDENT.test(k) ? k : JSON.stringify(k));

interface Decl {
  base: string;
  name: string | null;
  body: string | null;
}

class TsWriter {
  private decls: Decl[] = [];
  constructor(private readonly opt: TsOptions) {}

  /** Scrive il tipo di una forma; per gli oggetti registra una dichiarazione con nome ricavato da `hint`. */
  type(s: Shape, hint: string): string {
    const parts = this.parts(s, hint);
    return parts.length ? parts.join(' | ') : 'unknown';
  }

  /** Le alternative dell'unione (una sola se la forma non è un'unione). */
  private parts(s: Shape, hint: string): string[] {
    const parts: string[] = [];
    if (s.prims.has('string')) parts.push('string');
    if (s.prims.has('integer') || s.prims.has('number')) parts.push('number');
    if (s.prims.has('boolean')) parts.push('boolean');
    if (s.obj) parts.push(this.object(s.obj, hint));
    if (s.arr) {
      const el = isEmpty(s.arr) ? ['unknown'] : this.parts(s.arr, singular(hint));
      parts.push(el.length > 1 ? `(${el.join(' | ')})[]` : `${el[0]}[]`);
    }
    if (s.prims.has('null')) parts.push('null');
    return parts;
  }

  private object(props: NonNullable<Shape['obj']>, hint: string): string {
    const slot: Decl = { base: hint, name: null, body: null };
    this.decls.push(slot);
    const lines: string[] = [];
    for (const [k, v] of props) {
      const t = this.type(v.shape, pascalCase(k));
      lines.push(`  ${propKey(k)}${v.opt ? '?' : ''}: ${t};`);
    }
    const body = lines.length ? `{\n${lines.join('\n')}\n}` : '{}';
    const same = this.decls.find((d) => d !== slot && d.body === body && d.base === hint && d.name !== null);
    if (same) {
      this.decls.splice(this.decls.indexOf(slot), 1);
      return same.name!;
    }
    let name = hint;
    for (let n = 2; this.decls.some((d) => d !== slot && d.name === name); n++) name = hint + n;
    slot.name = name;
    slot.body = body;
    return name;
  }

  render(root: Shape): string {
    const rn = pascalCase(this.opt.rootName);
    const pureObject = !!root.obj && root.prims.size === 0 && !root.arr;
    // un array alla radice: gli elementi si chiamano `<Radice>Item`; altre unioni: `<Radice>Data`
    const hint = root.arr && root.prims.size === 0 && !root.obj ? rn + 'Item' : pureObject ? rn : rn + 'Data';
    const t = this.type(root, hint);
    const exp = this.opt.exportKeyword ? 'export ' : '';
    const out = this.decls.map((d) =>
      this.opt.style === 'interface' ? `${exp}interface ${d.name} ${d.body}` : `${exp}type ${d.name} = ${d.body};`,
    );
    // se la radice non è un oggetto con il suo nome, serve un alias esplicito
    if (t !== rn) out.unshift(`${exp}type ${rn} = ${t};`);
    return out.join('\n\n') + '\n';
  }
}

/** Interfacce TypeScript per un valore JSON. */
export function jsonToTypeScript(value: unknown, options: Partial<TsOptions> = {}): string {
  return new TsWriter({ ...DEFAULT_TS_OPTIONS, ...options }).render(inferShape(value));
}

// ---------- JSON Schema ----------

export const SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

type Schema = Record<string, unknown>;

function shapeToSchema(s: Shape): Schema {
  const alts: Schema[] = [];
  const prims = [...s.prims].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  if (prims.length === 1) alts.push({ type: prims[0] });
  else if (prims.length > 1) alts.push({ type: prims });
  if (s.arr) alts.push(isEmpty(s.arr) ? { type: 'array' } : { type: 'array', items: shapeToSchema(s.arr) });
  if (s.obj) {
    const required: string[] = [];
    for (const [k, v] of s.obj) if (!v.opt) required.push(k);
    // fromEntries crea proprietà proprie anche per chiavi come __proto__
    const properties = Object.fromEntries([...s.obj].map(([k, v]) => [k, shapeToSchema(v.shape)]));
    alts.push({ type: 'object', properties, ...(required.length ? { required } : {}) });
  }
  if (alts.length === 0) return {};
  if (alts.length === 1) return alts[0];
  return { anyOf: alts };
}

const ORDER: Prim[] = ['string', 'integer', 'number', 'boolean', 'null'];

/** JSON Schema (draft 2020-12) che descrive il valore: tipi, `required` e `items`. */
export function jsonToSchema(value: unknown): Schema {
  return { $schema: SCHEMA_DIALECT, ...shapeToSchema(inferShape(value)) };
}

export function jsonToSchemaText(value: unknown): string {
  return JSON.stringify(jsonToSchema(value), null, 2) + '\n';
}
