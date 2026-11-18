// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { locateJsonError, parseInput, positionOf } from '../yaml-json-converter/convert';

/**
 * Confronto strutturale di due valori JSON: logica pura, senza dipendenze dal DOM.
 * Le differenze hanno un percorso (JSON Pointer RFC 6901 e forma leggibile `a.b[2].c`), un tipo e i valori.
 * L'ordine delle chiavi degli oggetti non conta mai; per gli array c'è una modalità a scelta.
 */

export type ChangeKind = 'added' | 'removed' | 'changed' | 'type';
export type ArrayMode = 'index' | 'set' | 'key';

export interface JsonDiffOptions {
  /** Come si confrontano gli array: per indice, come insiemi (ordine ignorato) o per chiave identificativa. */
  arrayMode: ArrayMode;
  /** Campo identificativo per `arrayMode: 'key'`; vuoto = rilevamento automatico fra `id`, `_id`, `key`, `uuid`. */
  key: string;
  /** Stringhe uguali anche se differiscono per maiuscole e minuscole. */
  ignoreCase: boolean;
  /** Numeri uguali se la differenza è al massimo questa (0 = esatti). */
  epsilon: number;
  /** Percorsi da ignorare: JSON Pointer o glob semplici (`*` un livello, `**` qualsiasi profondità). */
  ignore: readonly string[];
}

export const DEFAULT_OPTIONS: JsonDiffOptions = { arrayMode: 'index', key: '', ignoreCase: false, epsilon: 0, ignore: [] };

/** Campi provati per il rilevamento automatico della chiave, in ordine. */
export const AUTO_KEYS: readonly string[] = ['id', '_id', 'key', 'uuid'];

export interface Difference {
  /** JSON Pointer (RFC 6901); stringa vuota = radice. */
  pointer: string;
  /** Forma leggibile: `a.b[2].c`, `items[id=7].name`; stringa vuota = radice. */
  path: string;
  kind: ChangeKind;
  /** Valore in A (assente se aggiunto). */
  oldValue?: unknown;
  /** Valore in B (assente se rimosso). */
  newValue?: unknown;
}

export type NodeStatus = 'same' | 'added' | 'removed' | 'changed' | 'type' | 'nested';

/** Nodo dell'albero unito: i nodi uguali non hanno figli (i valori sono in `a`/`b`), quelli "nested" contengono modifiche. */
export interface DiffNode {
  pointer: string;
  path: string;
  /** Ultimo segmento, per l'albero: nome della chiave o `[indice]`. */
  label: string;
  status: NodeStatus;
  a?: unknown;
  b?: unknown;
  children?: DiffNode[];
  /** Tipo del contenitore, per i nodi "nested". */
  container?: 'object' | 'array';
  /** Numero di differenze nel sottoalbero. */
  changes: number;
  /** Il percorso è escluso dal confronto. */
  ignored?: boolean;
}

export interface JsonDiffResult {
  root: DiffNode;
  differences: Difference[];
  counts: Record<ChangeKind, number> & { total: number };
}

// ---------------------------------------------------------------- utilità

type Kind = 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean' | 'other';

function kindOf(v: unknown): Kind {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  switch (typeof v) {
    case 'object':
      return Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null ? 'object' : 'other';
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'other';
  }
}

const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Proprietà propria (le chiavi come `__proto__` sono dati, non il prototipo). */
function own(o: Record<string, unknown>, k: string): unknown {
  return hasOwn(o, k) ? o[k] : undefined;
}

/** Segmento di JSON Pointer: `~` → `~0`, `/` → `~1` (RFC 6901). */
export function escapePointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function unescapePointerToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** Divide un JSON Pointer nei suoi segmenti già decodificati (la stringa vuota è la radice). */
export function parsePointer(pointer: string): string[] {
  if (pointer === '') return [];
  return pointer.slice(1).split('/').map(unescapePointerToken);
}

interface Tok {
  /** Segmento grezzo (chiave o indice) per il JSON Pointer. */
  raw: string;
  /** Segmento leggibile: `.nome`, `["chiave con spazi"]`, `[2]`, `[id=7]`. */
  label: string;
}

const IDENT = /^[A-Za-z_$][\w$]*$/;

function keyTok(key: string): Tok {
  return { raw: key, label: IDENT.test(key) ? '.' + key : '[' + JSON.stringify(key) + ']' };
}
function indexTok(i: number): Tok {
  return { raw: String(i), label: `[${i}]` };
}

const pointerOf = (tokens: readonly Tok[]): string => tokens.map((t) => '/' + escapePointerToken(t.raw)).join('');
const pathOf = (tokens: readonly Tok[]): string => {
  const s = tokens.map((t) => t.label).join('');
  return s.startsWith('.') ? s.slice(1) : s;
};
function labelOf(tokens: readonly Tok[]): string {
  const t = tokens[tokens.length - 1];
  if (!t) return '';
  return t.label.startsWith('.') ? t.label.slice(1) : t.label;
}

/** Rappresentazione canonica (chiavi ordinate) per il confronto veloce fra elementi di un insieme. */
function canon(v: unknown): string {
  const k = kindOf(v);
  if (k === 'array') return '[' + (v as unknown[]).map((x) => (x === undefined ? 'null' : canon(x))).join(',') + ']';
  if (k === 'object') {
    const o = v as Record<string, unknown>;
    return (
      '{' +
      Object.keys(o)
        .filter((key) => o[key] !== undefined)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canon(o[key]))
        .join(',') +
      '}'
    );
  }
  if (k === 'other') return 'o' + String(v);
  return JSON.stringify(v) ?? 'null';
}

// ---------------------------------------------------------------- percorsi ignorati

type Matcher = (segment: string) => boolean;
type IgnoreToken = '**' | Matcher;

function compileToken(tok: string): IgnoreToken {
  if (tok === '**') return '**';
  if (!tok.includes('*')) {
    const lit = unescapePointerToken(tok);
    return (s) => s === lit;
  }
  const re = new RegExp('^' + unescapePointerToken(tok).split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return (s) => re.test(s);
}

/** Compila l'elenco dei percorsi da ignorare (vuoti e commenti `#` scartati; il "/" iniziale è facoltativo). */
export function compileIgnore(patterns: readonly string[]): IgnoreToken[][] {
  const out: IgnoreToken[][] = [];
  for (const raw of patterns) {
    const p = raw.trim();
    if (p === '' || p.startsWith('#')) continue;
    const body = p.startsWith('/') ? p.slice(1) : p;
    out.push(body.split('/').map(compileToken));
  }
  return out;
}

/** Elenco scritto dall'utente (uno per riga o separati da virgola) → modelli. */
export function parseIgnoreList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s !== '' && !s.startsWith('#'));
}

function matchFrom(pt: readonly IgnoreToken[], pi: number, path: readonly string[], ki: number): boolean {
  if (pi === pt.length) return true; // il modello copre un prefisso del percorso: tutto il sottoalbero è ignorato
  const t = pt[pi];
  if (t === '**') {
    for (let k = ki; k <= path.length; k++) if (matchFrom(pt, pi + 1, path, k)) return true;
    return false;
  }
  if (ki >= path.length) return false;
  return t(path[ki]) && matchFrom(pt, pi + 1, path, ki + 1);
}

// ---------------------------------------------------------------- confronto

interface Ctx {
  opts: JsonDiffOptions;
  ignore: IgnoreToken[][];
  /** Con opzioni "a occhio" (caso, epsilon, ignorati) l'uguaglianza canonica non basta. */
  exact: boolean;
}

function isIgnored(tokens: readonly Tok[], ctx: Ctx): boolean {
  if (ctx.ignore.length === 0 || tokens.length === 0) return false;
  const path = tokens.map((t) => t.raw);
  return ctx.ignore.some((p) => matchFrom(p, 0, path, 0));
}

function base(tokens: readonly Tok[]): Pick<DiffNode, 'pointer' | 'path' | 'label'> {
  return { pointer: pointerOf(tokens), path: pathOf(tokens), label: labelOf(tokens) };
}

function primitivesEqual(a: unknown, b: unknown, kind: Kind, ctx: Ctx): boolean {
  if (kind === 'string') {
    const x = a as string;
    const y = b as string;
    return x === y || (ctx.opts.ignoreCase && x.toLowerCase() === y.toLowerCase());
  }
  if (kind === 'number') {
    const x = a as number;
    const y = b as number;
    return x === y || (x !== x && y !== y) || (ctx.opts.epsilon > 0 && Math.abs(x - y) <= ctx.opts.epsilon);
  }
  if (kind === 'other') return String(a) === String(b);
  return a === b; // null e boolean
}

function diffAt(a: unknown, b: unknown, tokens: Tok[], ctx: Ctx): DiffNode {
  const head = base(tokens);
  if (isIgnored(tokens, ctx)) return { ...head, status: 'same', a, b, changes: 0, ignored: true };
  if (a === undefined && b === undefined) return { ...head, status: 'same', changes: 0 };
  if (a === undefined) return { ...head, status: 'added', b, changes: 1 };
  if (b === undefined) return { ...head, status: 'removed', a, changes: 1 };
  const ka = kindOf(a);
  const kb = kindOf(b);
  if (ka !== kb) return { ...head, status: 'type', a, b, changes: 1 };
  if (ka === 'object') return fromChildren(head, a, b, diffObjects(a as Record<string, unknown>, b as Record<string, unknown>, tokens, ctx));
  if (ka === 'array') return fromChildren(head, a, b, diffArrays(a as unknown[], b as unknown[], tokens, ctx));
  return primitivesEqual(a, b, ka, ctx) ? { ...head, status: 'same', a, b, changes: 0 } : { ...head, status: 'changed', a, b, changes: 1 };
}

function fromChildren(head: Pick<DiffNode, 'pointer' | 'path' | 'label'>, a: unknown, b: unknown, children: DiffNode[]): DiffNode {
  const changes = children.reduce((n, c) => n + c.changes, 0);
  if (changes === 0) return { ...head, status: 'same', a, b, changes: 0 };
  return { ...head, status: 'nested', container: Array.isArray(a) ? 'array' : 'object', children, changes };
}

function diffObjects(a: Record<string, unknown>, b: Record<string, unknown>, tokens: Tok[], ctx: Ctx): DiffNode[] {
  const out: DiffNode[] = [];
  for (const k of Object.keys(a)) out.push(diffAt(a[k], own(b, k), [...tokens, keyTok(k)], ctx));
  for (const k of Object.keys(b)) if (!hasOwn(a, k)) out.push(diffAt(undefined, b[k], [...tokens, keyTok(k)], ctx));
  return out;
}

function diffArrays(a: unknown[], b: unknown[], tokens: Tok[], ctx: Ctx): DiffNode[] {
  if (ctx.opts.arrayMode === 'set') return diffAsSet(a, b, tokens, ctx);
  if (ctx.opts.arrayMode === 'key') {
    const explicit = ctx.opts.key.trim();
    // con un campo scelto dall'utente, gli array in cui nessun elemento lo ha (liste di numeri, di stringhe…) restano per indice
    const key = explicit ? ([...a, ...b].some((x) => keyValue(x, explicit) !== null) ? explicit : null) : detectKey(a, b);
    if (key) return diffByKey(a, b, key, tokens, ctx);
  }
  const out: DiffNode[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) out.push(diffAt(i < a.length ? a[i] : undefined, i < b.length ? b[i] : undefined, [...tokens, indexTok(i)], ctx));
  return out;
}

/** Elementi accoppiati per uguaglianza, ordine ignorato; il resto è rimosso (indice in A) o aggiunto (indice in B). */
function diffAsSet(a: unknown[], b: unknown[], tokens: Tok[], ctx: Ctx): DiffNode[] {
  const matchB = new Array<number>(a.length).fill(-1);
  const usedB = new Array<boolean>(b.length).fill(false);
  if (ctx.exact) {
    const queues = new Map<string, number[]>();
    b.forEach((v, j) => {
      const c = canon(v);
      const q = queues.get(c);
      if (q) q.push(j);
      else queues.set(c, [j]);
    });
    a.forEach((v, i) => {
      const j = queues.get(canon(v))?.shift();
      if (j !== undefined) {
        matchB[i] = j;
        usedB[j] = true;
      }
    });
  } else {
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        if (usedB[j]) continue;
        if (diffAt(a[i], b[j], [...tokens, indexTok(i)], ctx).changes === 0) {
          matchB[i] = j;
          usedB[j] = true;
          break;
        }
      }
    }
  }
  const out: DiffNode[] = [];
  a.forEach((v, i) => {
    const t = [...tokens, indexTok(i)];
    out.push(matchB[i] >= 0 ? diffAt(v, b[matchB[i]], t, ctx) : diffAt(v, undefined, t, ctx));
  });
  b.forEach((v, j) => {
    if (!usedB[j]) out.push(diffAt(undefined, v, [...tokens, indexTok(j)], ctx));
  });
  return out;
}

/** Valore della chiave di un elemento: stringa, numero o booleano; altrimenti null. */
function keyValue(item: unknown, key: string): string | number | boolean | null {
  if (kindOf(item) !== 'object') return null;
  const v = own(item as Record<string, unknown>, key);
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : null;
}

const keyId = (v: string | number | boolean): string => typeof v + ':' + String(v);

/** Primo fra `id`, `_id`, `key`, `uuid` presente in tutti gli elementi (oggetti) di entrambi gli array e con valori unici. */
export function detectKey(a: readonly unknown[], b: readonly unknown[]): string | null {
  if (a.length + b.length === 0) return null;
  for (const cand of AUTO_KEYS) {
    let ok = true;
    for (const list of [a, b]) {
      const seen = new Set<string>();
      for (const item of list) {
        const v = keyValue(item, cand);
        if (v === null || seen.has(keyId(v))) {
          ok = false;
          break;
        }
        seen.add(keyId(v));
      }
      if (!ok) break;
    }
    if (ok) return cand;
  }
  return null;
}

/** Elementi accoppiati per valore di `key`: lo spostamento non è una modifica. Il percorso usa l'indice in A (in B se aggiunto). */
function diffByKey(a: unknown[], b: unknown[], key: string, tokens: Tok[], ctx: Ctx): DiffNode[] {
  const queues = new Map<string, number[]>();
  b.forEach((v, j) => {
    const kv = keyValue(v, key);
    if (kv === null) return;
    const id = keyId(kv);
    const q = queues.get(id);
    if (q) q.push(j);
    else queues.set(id, [j]);
  });
  const tokenFor = (index: number, item: unknown): Tok => {
    const kv = keyValue(item, key);
    return kv === null ? indexTok(index) : { raw: String(index), label: `[${key}=${typeof kv === 'string' ? JSON.stringify(kv) : String(kv)}]` };
  };
  const usedB = new Array<boolean>(b.length).fill(false);
  const out: DiffNode[] = [];
  a.forEach((v, i) => {
    const kv = keyValue(v, key);
    const j = kv === null ? undefined : queues.get(keyId(kv))?.shift();
    const t = [...tokens, tokenFor(i, v)];
    if (j === undefined) out.push(diffAt(v, undefined, t, ctx));
    else {
      usedB[j] = true;
      out.push(diffAt(v, b[j], t, ctx));
    }
  });
  b.forEach((v, j) => {
    if (!usedB[j]) out.push(diffAt(undefined, v, [...tokens, tokenFor(j, v)], ctx));
  });
  return out;
}

/** Elenco piatto delle differenze (le foglie modificate, aggiunte, rimosse o con tipo cambiato), nell'ordine dell'albero. */
export function collectDifferences(root: DiffNode): Difference[] {
  const out: Difference[] = [];
  const walk = (n: DiffNode): void => {
    if (n.status === 'same') return;
    if (n.status === 'nested') {
      n.children?.forEach(walk);
      return;
    }
    const d: Difference = { pointer: n.pointer, path: n.path, kind: n.status };
    if (n.status !== 'added') d.oldValue = n.a;
    if (n.status !== 'removed') d.newValue = n.b;
    out.push(d);
  };
  walk(root);
  return out;
}

export function countDifferences(diffs: readonly Difference[]): JsonDiffResult['counts'] {
  const counts = { added: 0, removed: 0, changed: 0, type: 0, total: diffs.length };
  for (const d of diffs) counts[d.kind]++;
  return counts;
}

/** Confronta due valori già letti. */
export function compareValues(a: unknown, b: unknown, options: Partial<JsonDiffOptions> = {}): JsonDiffResult {
  const opts: JsonDiffOptions = { ...DEFAULT_OPTIONS, ...options };
  const ignore = compileIgnore(opts.ignore);
  const ctx: Ctx = { opts, ignore, exact: !opts.ignoreCase && !(opts.epsilon > 0) && ignore.length === 0 };
  const root = diffAt(a, b, [], ctx);
  const differences = collectDifferences(root);
  return { root, differences, counts: countDifferences(differences) };
}

// ---------------------------------------------------------------- lettura (JSON o YAML)

export interface ParseError {
  message: string;
  line?: number;
  column?: number;
}
export type Format = 'json' | 'yaml';
export type ParsedInput = { ok: true; value: unknown; format: Format } | { ok: false; error: ParseError; format: Format };

/**
 * Legge un testo come JSON o, se non lo è, come YAML (JSON è quasi un sottoinsieme di YAML). Un testo che inizia con `{` o `[`
 * è trattato come JSON: l'errore è quello del JSON; un YAML che dà solo un valore semplice è considerato un errore di JSON.
 */
export function parseJsonOrYaml(text: string): ParsedInput {
  const asJson = parseInput(text, 'json');
  if (asJson.ok) return { ok: true, value: asJson.value, format: 'json' };
  const first = text.trimStart()[0];
  if (first !== '{' && first !== '[') {
    const asYaml = parseInput(text, 'yaml');
    if (asYaml.ok && asYaml.value !== null && typeof asYaml.value === 'object') return { ok: true, value: asYaml.value, format: 'yaml' };
    if (!asYaml.ok && looksLikeYaml(text)) return { ok: false, error: asYaml.error, format: 'yaml' };
  }
  return { ok: false, error: asJson.error, format: 'json' };
}

/** Euristica: più righe o `chiave:` / `- elemento` iniziali. */
function looksLikeYaml(text: string): boolean {
  return /^\s*(-\s|[^\s"{[][^:\n]*:(\s|$))/m.test(text);
}

export { locateJsonError, positionOf };

// ---------------------------------------------------------------- JSON Patch (RFC 6902)

export interface PatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

/**
 * Operazioni che trasformano A esattamente in B (le opzioni di confronto non si applicano: la patch è sempre esatta).
 * Gli array si confrontano per indice: gli elementi in coda si aggiungono con `/-` o si tolgono dall'ultimo.
 */
export function toJsonPatch(a: unknown, b: unknown): PatchOp[] {
  const ops: PatchOp[] = [];
  const walk = (x: unknown, y: unknown, ptr: string): void => {
    if (x === undefined && y === undefined) return;
    if (x === undefined) {
      ops.push({ op: 'add', path: ptr, value: y });
      return;
    }
    if (y === undefined) {
      ops.push({ op: 'remove', path: ptr });
      return;
    }
    const kx = kindOf(x);
    if (kx !== kindOf(y)) {
      ops.push({ op: 'replace', path: ptr, value: y });
    } else if (kx === 'object') {
      const ox = x as Record<string, unknown>;
      const oy = y as Record<string, unknown>;
      for (const k of Object.keys(ox)) if (ox[k] !== undefined) walk(ox[k], own(oy, k), ptr + '/' + escapePointerToken(k));
      for (const k of Object.keys(oy)) if (oy[k] !== undefined && own(ox, k) === undefined) ops.push({ op: 'add', path: ptr + '/' + escapePointerToken(k), value: oy[k] });
    } else if (kx === 'array') {
      const ax = x as unknown[];
      const ay = y as unknown[];
      const n = Math.min(ax.length, ay.length);
      for (let i = 0; i < n; i++) walk(ax[i], ay[i], ptr + '/' + i);
      for (let i = n; i < ay.length; i++) ops.push({ op: 'add', path: ptr + '/-', value: ay[i] });
      for (let i = ax.length - 1; i >= n; i--) ops.push({ op: 'remove', path: ptr + '/' + i });
    } else if (!primitivesEqual(x, y, kx, { opts: DEFAULT_OPTIONS, ignore: [], exact: true })) {
      ops.push({ op: 'replace', path: ptr, value: y });
    }
  };
  walk(a, b, '');
  return ops;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Applica una patch (solo add, remove, replace) a una copia del documento; lancia un errore se un percorso non esiste. */
export function applyJsonPatch(doc: unknown, ops: readonly PatchOp[]): unknown {
  let root = clone(doc);
  for (const op of ops) {
    const tokens = parsePointer(op.path);
    if (tokens.length === 0) {
      if (op.op === 'remove') throw new Error('remove sulla radice');
      root = clone(op.value);
      continue;
    }
    let parent = root as Record<string, unknown> | unknown[];
    for (const t of tokens.slice(0, -1)) {
      const next: unknown = Array.isArray(parent) ? parent[Number(t)] : (parent as Record<string, unknown>)[t];
      if (next === null || typeof next !== 'object') throw new Error('percorso inesistente: ' + op.path);
      parent = next as Record<string, unknown> | unknown[];
    }
    const last = tokens[tokens.length - 1];
    if (Array.isArray(parent)) {
      const idx = last === '-' ? parent.length : Number(last);
      if (!Number.isInteger(idx) || idx < 0 || idx > parent.length) throw new Error('indice non valido: ' + op.path);
      if (op.op === 'add') parent.splice(idx, 0, clone(op.value));
      else {
        if (idx >= parent.length) throw new Error('indice non valido: ' + op.path);
        if (op.op === 'remove') parent.splice(idx, 1);
        else parent[idx] = clone(op.value);
      }
    } else if (op.op === 'add') parent[last] = clone(op.value);
    else {
      if (!hasOwn(parent, last)) throw new Error('chiave inesistente: ' + op.path);
      if (op.op === 'remove') delete parent[last];
      else parent[last] = clone(op.value);
    }
  }
  return root;
}

// ---------------------------------------------------------------- confronto di testi (lettura + confronto)

export type Outcome =
  | { state: 'empty' }
  | { state: 'error'; a?: ParseError; b?: ParseError }
  | { state: 'ok'; result: JsonDiffResult; patch: PatchOp[]; formatA: Format; formatB: Format };

/** Legge i due testi (JSON o YAML) e li confronta; è la funzione che gira nel worker. */
export function compareTexts(textA: string, textB: string, options: Partial<JsonDiffOptions> = {}): Outcome {
  if (textA.trim() === '' || textB.trim() === '') return { state: 'empty' };
  const a = parseJsonOrYaml(textA);
  const b = parseJsonOrYaml(textB);
  if (!a.ok || !b.ok) return { state: 'error', a: a.ok ? undefined : a.error, b: b.ok ? undefined : b.error };
  return { state: 'ok', result: compareValues(a.value, b.value, options), patch: toJsonPatch(a.value, b.value), formatA: a.format, formatB: b.format };
}

// ---------------------------------------------------------------- testo per esportazione e visualizzazione

/** Valore su una riga, accorciato oltre `max` caratteri. */
export function formatValue(v: unknown, max = 160): string {
  let s: string;
  try {
    s = JSON.stringify(v) ?? String(v);
  } catch {
    s = String(v);
  }
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export interface ExportLabels {
  added: string;
  removed: string;
  changed: string;
  type: string;
  root: string;
}

/** Elenco delle differenze in testo semplice o Markdown (una riga per differenza). */
export function differencesToText(diffs: readonly Difference[], labels: ExportLabels, markdown: boolean): string {
  const lines = diffs.map((d) => {
    const where = d.path === '' ? labels.root : d.path;
    const tag = labels[d.kind];
    let what: string;
    if (d.kind === 'added') what = formatValue(d.newValue, 400);
    else if (d.kind === 'removed') what = formatValue(d.oldValue, 400);
    else what = `${formatValue(d.oldValue, 400)} → ${formatValue(d.newValue, 400)}`;
    if (markdown) return `- **${tag}** \`${where.replace(/`/g, "'")}\`: \`${what.replace(/`/g, "'")}\``;
    return `${d.kind === 'added' ? '+' : d.kind === 'removed' ? '-' : '~'} ${where} (${tag}): ${what}`;
  });
  return lines.join('\n');
}
