// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * JSONPath (RFC 9535 con alcune estensioni dell'originale di Goessner), valutato senza eval né new Function.
 * Supportato: `$`, `.nome`, `['chiave']`, `[n]` (anche negativo), `[*]`, `.*`, `..` (discesa ricorsiva),
 * unioni `[a, 'b', 1:3]`, slice `[a:b:c]`, filtri `[?(@.prezzo > 10 && @.tipo == 'x')]` con
 * `== != < <= > >= && || !`, test di esistenza, `=~ /regex/flags` e le funzioni
 * `length() count() match() search() value()`.
 * Non supportato: espressioni di script come `[(@.length-1)]` (si usa `[-1]`).
 * Logica pura, senza DOM.
 */

export type JsonPathErrorCode =
  | 'empty' | 'start' | 'unexpected-char' | 'unexpected-end' | 'unterminated-string' | 'bad-escape' | 'bad-number'
  | 'bad-regex' | 'regex-unsafe' | 'non-singular' | 'unknown-function' | 'function-args' | 'not-a-test'
  | 'expected-bracket' | 'bad-slice' | 'bad-index' | 'bad-literal' | 'too-deep';

export interface JsonPathError {
  code: JsonPathErrorCode;
  /** Posizione (da 0) nell'espressione. */
  pos: number;
  /** Carattere o nome che ha causato l'errore, se serve nel messaggio. */
  detail?: string;
}

class PathSyntaxError extends Error {
  constructor(readonly info: JsonPathError) {
    super(info.code);
  }
}

// ---------- AST ----------

type Literal = string | number | boolean | null;
type Selector =
  | { t: 'name'; name: string }
  | { t: 'index'; i: number }
  | { t: 'wild' }
  | { t: 'slice'; start: number | null; end: number | null; step: number | null }
  | { t: 'filter'; expr: Expr };
interface Segment { desc: boolean; sels: Selector[] }
interface PathQuery { t: 'q'; root: boolean; segs: Segment[]; pos: number }
interface FuncCall { t: 'fn'; name: string; args: Operand[]; pos: number }
type Operand = { t: 'lit'; v: Literal } | PathQuery | FuncCall;
type Expr =
  | { t: 'or' | 'and'; l: Expr; r: Expr }
  | { t: 'not'; e: Expr }
  | { t: 'cmp'; op: '==' | '!=' | '<' | '<=' | '>' | '>='; l: Operand; r: Operand }
  | { t: 'regex'; l: Operand; re: RegExp }
  | { t: 'test'; q: PathQuery }
  | { t: 'fnTest'; f: FuncCall };

export interface CompiledPath { segs: Segment[] }

const MAX_FILTER_DEPTH = 32;
const MAX_REGEX_LENGTH = 200;
/** Ripetizioni annidate come (a+)+ : la forma classica dei backtracking catastrofici. */
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*}](?:[^()\\]|\\.)*\)\s*[+*{]/;

// ---------- parser ----------

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
const isNameStart = (c: string | undefined): boolean => c !== undefined && (/[A-Za-z_$]/.test(c) || c > '\u007f');
const isNameChar = (c: string | undefined): boolean => c !== undefined && (isNameStart(c) || isDigit(c) || c === '-');

class Parser {
  private i = 0;
  private depth = 0;
  constructor(private readonly s: string) {}

  private err(code: JsonPathErrorCode, pos = this.i, detail?: string): never {
    throw new PathSyntaxError({ code, pos, detail });
  }
  private ws(): void {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }
  private peek(): string | undefined {
    return this.s[this.i];
  }
  private eat(c: string): boolean {
    if (this.s.startsWith(c, this.i)) {
      this.i += c.length;
      return true;
    }
    return false;
  }

  parse(): CompiledPath {
    this.ws();
    if (this.i >= this.s.length) this.err('empty', 0);
    if (this.peek() !== '$') this.err('start');
    this.i++;
    const segs = this.segments();
    this.ws();
    if (this.i < this.s.length) this.err('unexpected-char', this.i, this.s[this.i]);
    return { segs };
  }

  /** Segmenti di un percorso: si ferma al primo carattere che non ne comincia uno. */
  private segments(): Segment[] {
    const segs: Segment[] = [];
    for (;;) {
      const save = this.i;
      this.ws();
      const c = this.peek();
      if (c === '.') {
        if (this.s.startsWith('..', this.i)) {
          this.i += 2;
          if (this.peek() === '[') segs.push({ desc: true, sels: this.bracket() });
          else if (this.peek() === '*') {
            this.i++;
            segs.push({ desc: true, sels: [{ t: 'wild' }] });
          } else segs.push({ desc: true, sels: [{ t: 'name', name: this.shorthand() }] });
        } else {
          this.i++;
          if (this.peek() === '*') {
            this.i++;
            segs.push({ desc: false, sels: [{ t: 'wild' }] });
          } else segs.push({ desc: false, sels: [{ t: 'name', name: this.shorthand() }] });
        }
      } else if (c === '[') {
        segs.push({ desc: false, sels: this.bracket() });
      } else {
        this.i = save;
        return segs;
      }
    }
  }

  private shorthand(): string {
    const start = this.i;
    if (this.i >= this.s.length) this.err('unexpected-end');
    if (!(isNameChar(this.peek()))) this.err('unexpected-char', this.i, this.peek());
    while (isNameChar(this.peek())) this.i++;
    return this.s.slice(start, this.i);
  }

  private bracket(): Selector[] {
    this.i++; // [
    const sels: Selector[] = [];
    for (;;) {
      this.ws();
      sels.push(this.selector());
      this.ws();
      if (this.eat(',')) continue;
      if (this.eat(']')) return sels;
      if (this.i >= this.s.length) this.err('expected-bracket');
      this.err('unexpected-char', this.i, this.peek());
    }
  }

  private selector(): Selector {
    const c = this.peek();
    if (c === undefined) this.err('unexpected-end');
    if (c === "'" || c === '"') return { t: 'name', name: this.string() };
    if (c === '*') {
      this.i++;
      return { t: 'wild' };
    }
    if (c === '?') {
      this.i++;
      this.ws();
      return { t: 'filter', expr: this.orExpr() };
    }
    if (c === ':' || c === '-' || isDigit(c)) return this.indexOrSlice();
    if (c === '(') this.err('unexpected-char', this.i, '(');
    return this.err('unexpected-char', this.i, c);
  }

  private int(): number | null {
    const start = this.i;
    if (this.peek() === '-') this.i++;
    const ds = this.i;
    while (isDigit(this.peek())) this.i++;
    if (this.i === ds) {
      this.i = start;
      return null;
    }
    const text = this.s.slice(start, this.i);
    const n = Number(text);
    if (!Number.isSafeInteger(n) || (text.length > 1 && /^-?0\d/.test(text)) || text === '-0') this.err('bad-index', start, text);
    return n;
  }

  private indexOrSlice(): Selector {
    const start = this.i;
    const a = this.int();
    this.ws();
    if (this.peek() !== ':') {
      if (a === null) this.err('bad-index', start);
      return { t: 'index', i: a };
    }
    const nums: (number | null)[] = [a];
    while (this.peek() === ':' && nums.length < 3) {
      this.i++;
      this.ws();
      nums.push(this.int());
      this.ws();
    }
    if (this.peek() === ':') this.err('bad-slice');
    return { t: 'slice', start: nums[0], end: nums[1] ?? null, step: nums[2] ?? null };
  }

  private string(): string {
    const quote = this.s[this.i];
    const begin = this.i;
    this.i++;
    let out = '';
    for (;;) {
      if (this.i >= this.s.length) this.err('unterminated-string', begin);
      const c = this.s[this.i++];
      if (c === quote) return out;
      if (c !== '\\') {
        out += c;
        continue;
      }
      const e = this.s[this.i++];
      switch (e) {
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        case '/': case '\\': case "'": case '"': out += e; break;
        case 'u': {
          const hex = this.s.slice(this.i, this.i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.err('bad-escape', this.i - 2);
          out += String.fromCharCode(parseInt(hex, 16));
          this.i += 4;
          break;
        }
        default: this.err('bad-escape', this.i - 2);
      }
    }
  }

  // ---- espressioni dei filtri ----

  private orExpr(): Expr {
    if (++this.depth > MAX_FILTER_DEPTH) this.err('too-deep');
    let l = this.andExpr();
    for (;;) {
      this.ws();
      if (this.eat('||')) l = { t: 'or', l, r: this.andExpr() };
      else break;
    }
    this.depth--;
    return l;
  }
  private andExpr(): Expr {
    let l = this.unary();
    for (;;) {
      this.ws();
      if (this.eat('&&')) l = { t: 'and', l, r: this.unary() };
      else return l;
    }
  }
  private unary(): Expr {
    this.ws();
    if (this.peek() === '!' && this.s[this.i + 1] !== '=') {
      this.i++;
      return { t: 'not', e: this.unary() };
    }
    if (this.peek() === '(') {
      this.i++;
      const e = this.orExpr();
      this.ws();
      if (!this.eat(')')) this.err(this.i >= this.s.length ? 'unexpected-end' : 'unexpected-char', this.i, this.peek());
      return e;
    }
    const left = this.operand();
    this.ws();
    const op = /^(==|!=|<=|>=|<|>)/.exec(this.s.slice(this.i, this.i + 2))?.[1] as '==' | '!=' | '<' | '<=' | '>' | '>=' | undefined;
    if (op) {
      this.i += op.length;
      this.ws();
      const right = this.operand();
      this.singular(left);
      this.singular(right);
      return { t: 'cmp', op, l: left, r: right };
    }
    if (this.s.startsWith('=~', this.i)) {
      this.i += 2;
      this.ws();
      this.singular(left);
      return { t: 'regex', l: left, re: this.regexLiteral() };
    }
    // nessun operatore: test di esistenza o funzione logica
    if (left.t === 'q') return { t: 'test', q: left };
    if (left.t === 'fn') {
      if (left.name !== 'match' && left.name !== 'search') this.err('not-a-test', left.pos, left.name);
      return { t: 'fnTest', f: left };
    }
    return this.err('not-a-test', this.i);
  }
  private operand(): Operand {
    this.ws();
    const c = this.peek();
    const pos = this.i;
    if (c === undefined) return this.err('unexpected-end');
    if (c === "'" || c === '"') return { t: 'lit', v: this.string() };
    if (c === '-' || isDigit(c)) return { t: 'lit', v: this.number() };
    if (c === '@' || c === '$') {
      this.i++;
      return { t: 'q', root: c === '$', segs: this.segments(), pos };
    }
    if (/[a-z]/.test(c)) {
      const m = /^[a-z][a-z0-9_]*/.exec(this.s.slice(this.i))![0];
      this.i += m.length;
      if (m === 'true') return { t: 'lit', v: true };
      if (m === 'false') return { t: 'lit', v: false };
      if (m === 'null') return { t: 'lit', v: null };
      this.ws();
      if (this.peek() !== '(') this.err('bad-literal', pos, m);
      return this.func(m, pos);
    }
    return this.err('unexpected-char', this.i, c);
  }

  private func(name: string, pos: number): FuncCall {
    const arity: Record<string, number> = { length: 1, count: 1, match: 2, search: 2, value: 1 };
    if (!(name in arity)) this.err('unknown-function', pos, name);
    this.i++; // (
    const args: Operand[] = [];
    this.ws();
    if (!this.eat(')')) {
      for (;;) {
        args.push(this.operand());
        this.ws();
        if (this.eat(',')) continue;
        if (this.eat(')')) break;
        this.err(this.i >= this.s.length ? 'unexpected-end' : 'unexpected-char', this.i, this.peek());
      }
    }
    if (args.length !== arity[name]) this.err('function-args', pos, name);
    return { t: 'fn', name, args, pos };
  }

  private number(): number {
    const m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.s.slice(this.i));
    if (!m) return this.err('bad-number');
    this.i += m[0].length;
    return Number(m[0]);
  }

  private regexLiteral(): RegExp {
    const start = this.i;
    if (this.peek() !== '/') this.err('bad-regex', start);
    this.i++;
    let body = '';
    let inClass = false;
    for (;;) {
      if (this.i >= this.s.length) this.err('bad-regex', start);
      const c = this.s[this.i++];
      if (c === '\\') {
        body += c + (this.s[this.i++] ?? '');
        continue;
      }
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) break;
      body += c;
    }
    const flags = /^[a-z]*/.exec(this.s.slice(this.i))![0];
    this.i += flags.length;
    return this.safeRegex(body, flags, start);
  }

  safeRegex(body: string, flags: string, pos: number): RegExp {
    if (body.length > MAX_REGEX_LENGTH || NESTED_QUANTIFIER.test(body)) this.err('regex-unsafe', pos);
    if (!/^[imsu]*$/.test(flags)) this.err('bad-regex', pos);
    try {
      return new RegExp(body, flags);
    } catch {
      return this.err('bad-regex', pos);
    }
  }

  /** Nei confronti servono percorsi che producono al massimo un valore (RFC 9535, "singular query"). */
  private singular(o: Operand): void {
    if (o.t === 'q' && o.segs.some((s) => s.desc || s.sels.length !== 1 || !['name', 'index'].includes(s.sels[0].t))) {
      this.err('non-singular', o.pos);
    }
    if (o.t === 'fn' && o.name === 'count') return;
    if (o.t === 'fn' && (o.name === 'match' || o.name === 'search')) this.err('not-a-test', o.pos, o.name);
  }
}

/** Compila un'espressione; in caso di errore restituisce posizione e codice. */
export function compileJsonPath(expr: string): { ok: true; path: CompiledPath } | { ok: false; error: JsonPathError } {
  try {
    return { ok: true, path: new Parser(expr).parse() };
  } catch (e) {
    if (e instanceof PathSyntaxError) return { ok: false, error: e.info };
    throw e;
  }
}

// ---------- valutazione ----------

export interface PathNode {
  /** Percorso normalizzato (RFC 9535), es. `$['store']['book'][0]`. */
  path: string;
  value: unknown;
}

export type QueryResult =
  | { ok: true; nodes: PathNode[]; total: number; truncated: boolean }
  | { ok: false; error: JsonPathError };

export const MAX_RESULTS = 5000;
/** Tetto ai nodi visitati: protegge da espressioni (es. `$..*..*..*`) che esploderebbero su documenti grandi. */
const MAX_VISITS = 2_000_000;

class BudgetError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Percorso normalizzato di un nome: apici singoli, con escape di apice, barra e caratteri di controllo. */
export function quoteName(name: string): string {
  let out = "'";
  for (const ch of name) {
    const code = ch.codePointAt(0)!;
    if (ch === "'") out += "\\'";
    else if (ch === '\\') out += '\\\\';
    else if (code < 0x20) out += ch === '\b' ? '\\b' : ch === '\f' ? '\\f' : ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : '\\u' + code.toString(16).padStart(4, '0');
    else out += ch;
  }
  return out + "'";
}

const childPath = (base: string, key: string | number): string =>
  typeof key === 'number' ? `${base}[${key}]` : `${base}[${quoteName(key)}]`;

function children(n: PathNode): PathNode[] {
  const v = n.value;
  if (Array.isArray(v)) return v.map((x, i) => ({ path: childPath(n.path, i), value: x }));
  if (isObj(v)) return Object.keys(v).map((k) => ({ path: childPath(n.path, k), value: v[k] }));
  return [];
}

/** Il nodo e tutti i suoi discendenti, in preordine (documento order), senza ricorsione. */
function descendantsOrSelf(n: PathNode, tick: () => void): PathNode[] {
  const out: PathNode[] = [];
  const stack: PathNode[] = [n];
  while (stack.length) {
    const cur = stack.pop()!;
    tick();
    out.push(cur);
    const kids = children(cur);
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return out;
}

/** Indici di una slice secondo l'algoritmo dell'RFC 9535 (sezione 2.3.4.2.2). */
export function sliceIndices(len: number, start: number | null, end: number | null, step: number | null): number[] {
  const st = step ?? 1;
  if (st === 0) return [];
  const norm = (i: number): number => (i >= 0 ? i : len + i);
  const s = norm(start ?? (st > 0 ? 0 : len - 1));
  const e = norm(end ?? (st > 0 ? len : -len - 1));
  const lower = st > 0 ? Math.min(Math.max(s, 0), len) : Math.min(Math.max(s, -1), len - 1);
  const upper = st > 0 ? Math.min(Math.max(e, 0), len) : Math.min(Math.max(e, -1), len - 1);
  const out: number[] = [];
  if (st > 0) for (let i = lower; i < upper; i += st) out.push(i);
  else for (let i = lower; i > upper; i += st) out.push(i);
  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

/** Confronto con l'assenza di valore (`undefined`): vedi RFC 9535, 2.3.5.2.2. */
function compare(op: string, a: unknown, b: unknown): boolean {
  const eq = (): boolean => (a === undefined || b === undefined ? a === b : deepEqual(a, b));
  const ordered = (): -1 | 0 | 1 | null => {
    if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
    if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
    return null;
  };
  switch (op) {
    case '==': return eq();
    case '!=': return !eq();
    case '<': return ordered() === -1;
    case '>': return ordered() === 1;
    case '<=': return ordered() === -1 || (eq() && a !== undefined);
    default: return ordered() === 1 || (eq() && a !== undefined);
  }
}

const MAX_REGEX_INPUT = 100_000;

class Evaluator {
  private visits = 0;
  constructor(private readonly root: unknown) {}

  private tick = (): void => {
    if (++this.visits > MAX_VISITS) throw new BudgetError();
  };

  run(segs: Segment[], start: PathNode): PathNode[] {
    let cur: PathNode[] = [start];
    for (const seg of segs) {
      const next: PathNode[] = [];
      for (const n of cur) {
        const bases = seg.desc ? descendantsOrSelf(n, this.tick) : [n];
        for (const b of bases) for (const sel of seg.sels) this.apply(sel, b, next);
      }
      cur = next;
    }
    return cur;
  }

  private apply(sel: Selector, n: PathNode, out: PathNode[]): void {
    this.tick();
    const v = n.value;
    switch (sel.t) {
      case 'name':
        if (isObj(v) && Object.hasOwn(v, sel.name)) out.push({ path: childPath(n.path, sel.name), value: v[sel.name] });
        return;
      case 'index':
        if (Array.isArray(v)) {
          const i = sel.i >= 0 ? sel.i : v.length + sel.i;
          if (i >= 0 && i < v.length) out.push({ path: childPath(n.path, i), value: v[i] });
        }
        return;
      case 'wild':
        out.push(...children(n));
        return;
      case 'slice':
        if (Array.isArray(v)) for (const i of sliceIndices(v.length, sel.start, sel.end, sel.step)) out.push({ path: childPath(n.path, i), value: v[i] });
        return;
      case 'filter':
        for (const c of children(n)) {
          this.tick();
          if (this.truth(sel.expr, c)) out.push(c);
        }
    }
  }

  private truth(e: Expr, cur: PathNode): boolean {
    switch (e.t) {
      case 'or': return this.truth(e.l, cur) || this.truth(e.r, cur);
      case 'and': return this.truth(e.l, cur) && this.truth(e.r, cur);
      case 'not': return !this.truth(e.e, cur);
      case 'test': return this.nodes(e.q, cur).length > 0;
      case 'cmp': return compare(e.op, this.value(e.l, cur), this.value(e.r, cur));
      case 'regex': {
        const v = this.value(e.l, cur);
        return typeof v === 'string' && v.length <= MAX_REGEX_INPUT && e.re.test(v);
      }
      case 'fnTest': {
        const [a, b] = e.f.args.map((x) => this.value(x, cur));
        if (typeof a !== 'string' || typeof b !== 'string' || a.length > MAX_REGEX_INPUT) return false;
        try {
          return this.userRegex(b, e.f.name === 'match').test(a);
        } catch {
          return false;
        }
      }
    }
  }

  private regexCache = new Map<string, RegExp>();
  private userRegex(pattern: string, whole: boolean): RegExp {
    const key = (whole ? 'm:' : 's:') + pattern;
    let re = this.regexCache.get(key);
    if (!re) {
      if (pattern.length > MAX_REGEX_LENGTH || NESTED_QUANTIFIER.test(pattern)) throw new Error('unsafe');
      re = new RegExp(whole ? `^(?:${pattern})$` : pattern, 'u');
      this.regexCache.set(key, re);
    }
    return re;
  }

  private nodes(q: PathQuery, cur: PathNode): PathNode[] {
    return this.run(q.segs, q.root ? { path: '$', value: this.root } : cur);
  }

  /** Valore di un operando; `undefined` = nessun valore (percorso senza risultati o funzione non applicabile). */
  private value(o: Operand, cur: PathNode): unknown {
    if (o.t === 'lit') return o.v;
    if (o.t === 'q') {
      const ns = this.nodes(o, cur);
      return ns.length === 1 ? ns[0].value : undefined;
    }
    switch (o.name) {
      case 'length': {
        const v = this.value(o.args[0], cur);
        if (typeof v === 'string') return [...v].length;
        if (Array.isArray(v)) return v.length;
        if (isObj(v)) return Object.keys(v).length;
        return undefined;
      }
      case 'count': {
        const a = o.args[0];
        return a.t === 'q' ? this.nodes(a, cur).length : undefined;
      }
      case 'value': {
        const a = o.args[0];
        if (a.t !== 'q') return this.value(a, cur);
        const ns = this.nodes(a, cur);
        return ns.length === 1 ? ns[0].value : undefined;
      }
      default:
        return undefined;
    }
  }
}

/** Esegue un percorso già compilato su un documento. */
export function runJsonPath(root: unknown, path: CompiledPath, max = MAX_RESULTS): QueryResult {
  try {
    const all = new Evaluator(root).run(path.segs, { path: '$', value: root });
    return { ok: true, nodes: all.slice(0, max), total: all.length, truncated: all.length > max };
  } catch (e) {
    if (e instanceof BudgetError) return { ok: false, error: { code: 'too-deep', pos: 0, detail: 'budget' } };
    throw e;
  }
}

/** Compila ed esegue. */
export function queryJsonPath(root: unknown, expr: string, max = MAX_RESULTS): QueryResult {
  const c = compileJsonPath(expr);
  if (!c.ok) return c;
  return runJsonPath(root, c.path, max);
}

// ---------- lettura del JSON con la posizione dell'errore ----------

export type JsonParse = { ok: true; value: unknown } | { ok: false; pos: number; line: number; col: number; message: string };

/** Posizione (riga e colonna da 1) di un offset nel testo. */
export function lineCol(text: string, pos: number): { line: number; col: number } {
  const before = text.slice(0, Math.max(0, Math.min(pos, text.length)));
  const lines = before.split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

/** Offset del primo errore di sintassi in un testo JSON (-1 se è valido). Serve perché non tutti i browser dicono dove. */
export function jsonErrorPos(t: string): number {
  const n = t.length;
  let i = 0;
  const stack: string[] = [];
  const ws = (): void => {
    while (i < n && (t[i] === ' ' || t[i] === '\t' || t[i] === '\n' || t[i] === '\r')) i++;
  };
  /** Legge una stringa che comincia in `i`; restituisce la posizione dell'errore o -1. */
  const str = (): number => {
    i++;
    while (i < n) {
      const c = t[i];
      if (c === '"') {
        i++;
        return -1;
      }
      if (c < ' ') return i;
      if (c === '\\') {
        const e = t[i + 1];
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(t.slice(i + 2, i + 6))) return Math.min(i + 2, n);
          i += 6;
        } else if (e !== undefined && '"\\/bfnrt'.includes(e)) i += 2;
        else return Math.min(i + 1, n);
      } else i++;
    }
    return n;
  };
  const NUM = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  let state: 'value' | 'key' | 'after' = 'value';
  for (;;) {
    ws();
    if (state === 'value') {
      const c = t[i];
      if (c === undefined) return n;
      if (c === '{' || c === '[') {
        stack.push(c);
        i++;
        ws();
        const close = c === '{' ? '}' : ']';
        if (t[i] === close) {
          stack.pop();
          i++;
          state = 'after';
        } else state = c === '{' ? 'key' : 'value';
      } else if (c === '"') {
        const e = str();
        if (e >= 0) return e;
        state = 'after';
      } else {
        NUM.lastIndex = i;
        const m = NUM.exec(t);
        if (m) i += m[0].length;
        else {
          const lit = ['true', 'false', 'null'].find((l) => t.startsWith(l, i));
          if (!lit) return i;
          i += lit.length;
        }
        state = 'after';
      }
    } else if (state === 'key') {
      if (t[i] !== '"') return Math.min(i, n);
      const e = str();
      if (e >= 0) return e;
      ws();
      if (t[i] !== ':') return Math.min(i, n);
      i++;
      state = 'value';
    } else {
      const top = stack[stack.length - 1];
      if (top === undefined) return i < n ? i : -1;
      const c = t[i];
      if (c === ',') {
        i++;
        state = top === '{' ? 'key' : 'value';
      } else if ((top === '{' && c === '}') || (top === '[' && c === ']')) {
        stack.pop();
        i++;
      } else return Math.min(i, n);
    }
  }
}

export function parseJson(text: string): JsonParse {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // la posizione la calcola il nostro lettore (i messaggi di JSON.parse cambiano da un browser all'altro)
    const own = jsonErrorPos(text);
    const m = /position (\d+)/.exec(message);
    const pos = own >= 0 ? own : m ? Math.min(Number(m[1]), text.length) : text.length;
    return { ok: false, pos, ...lineCol(text, pos), message };
  }
}
