// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Valutatore di espressioni per la calcolatrice scientifica: nessun `eval`, solo un parser a discesa ricorsiva.
 * Operatori + - * / ^ ! %, parentesi, moltiplicazione implicita (2pi, 3(4+1)), costanti, funzioni e `ans`.
 * Virgola e punto sono entrambi separatori decimali. Il `%` dopo una somma o una sottrazione vale come sui telefoni:
 * `200 + 10%` = 220 (il 10% di 200), mentre `10%` da solo vale 0,1.
 */
export type AngleMode = 'deg' | 'rad';

export type CalcError = 'empty' | 'syntax' | 'parens' | 'unknown' | 'div0' | 'domain' | 'overflow' | 'tooLong';

export type CalcResult = { ok: true; value: number } | { ok: false; error: CalcError; detail?: string };

export const MAX_LENGTH = 300;
const MAX_DEPTH = 60;

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

class CalcFail extends Error {
  constructor(
    readonly code: CalcError,
    readonly detail?: string,
  ) {
    super(code);
  }
}

function tokenize(src: string): Tok[] {
  const s = src
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/\*\*/g, '^')
    .replace(/√/g, ' sqrt ')
    .replace(/π/g, ' pi ');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[\s  ]/.test(c)) {
      i++;
    } else if (/[0-9.,]/.test(c)) {
      // numero con parte decimale ed esponente (2e3, 1,5e-4); "2e" senza cifre dopo è 2 × e
      const m = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?/i.exec(s.slice(i));
      if (!m) throw new CalcFail('syntax', c);
      out.push({ t: 'num', v: Number(m[0].replace(',', '.')) });
      i += m[0].length;
    } else if (/[a-z]/i.test(c)) {
      const m = /^[a-z][a-z0-9]*/i.exec(s.slice(i))!;
      out.push({ t: 'id', v: m[0].toLowerCase() });
      i += m[0].length;
    } else if ('+-*/^!%()'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
    } else {
      throw new CalcFail('syntax', c);
    }
  }
  return out;
}

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

/** Arrotonda a 15 cifre significative: 0.1+0.2 → 0.3, sin(30°) → 0.5. Nelle funzioni solo per la trigonometria (un arrotondamento intermedio falserebbe sqrt(2)^2). */
function tidy(v: number): number {
  if (!Number.isFinite(v)) return v;
  return Number(v.toPrecision(15));
}

/** Come `tidy`, ma azzera i residui del tipo cos(90°) = 6e-17, che in trigonometria sono sempre errori di arrotondamento. */
function tidyTrig(v: number): number {
  return Math.abs(v) < 1e-15 ? 0 : tidy(v);
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new CalcFail('domain', '!');
  if (n > 170) throw new CalcFail('overflow');
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function fn(name: string, x: number, angle: AngleMode): number {
  const toRad = (a: number) => (angle === 'deg' ? (a * Math.PI) / 180 : a);
  const fromRad = (a: number) => (angle === 'deg' ? (a * 180) / Math.PI : a);
  const need = (ok: boolean) => {
    if (!ok) throw new CalcFail('domain', name);
  };
  switch (name) {
    case 'sin': return tidyTrig(Math.sin(toRad(x)));
    case 'cos': return tidyTrig(Math.cos(toRad(x)));
    case 'tan':
      // tan(90°) non esiste: senza questo controllo uscirebbe un numero enorme
      need(!(angle === 'deg' ? Math.abs((x - 90) % 180) < 1e-9 : Math.abs(Math.cos(x)) < 1e-12));
      return tidyTrig(Math.tan(toRad(x)));
    case 'asin': need(x >= -1 && x <= 1); return tidy(fromRad(Math.asin(x)));
    case 'acos': need(x >= -1 && x <= 1); return tidy(fromRad(Math.acos(x)));
    case 'atan': return tidy(fromRad(Math.atan(x)));
    case 'sinh': return Math.sinh(x);
    case 'cosh': return Math.cosh(x);
    case 'tanh': return Math.tanh(x);
    case 'ln': need(x > 0); return Math.log(x);
    case 'log': need(x > 0); return Math.log10(x);
    case 'log2': need(x > 0); return Math.log2(x);
    case 'sqrt': need(x >= 0); return Math.sqrt(x);
    case 'cbrt': return Math.cbrt(x);
    case 'abs': return Math.abs(x);
    case 'exp': return Math.exp(x);
    case 'floor': return Math.floor(x);
    case 'ceil': return Math.ceil(x);
    case 'round': return Math.round(x);
    case 'sign': return Math.sign(x);
    case 'fact': return factorial(x);
    default: throw new CalcFail('unknown', name);
  }
}

export const FUNCTIONS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'ln', 'log', 'log2', 'sqrt', 'cbrt', 'abs', 'exp', 'floor', 'ceil', 'round', 'sign', 'fact'] as const;

interface Val {
  v: number;
  /** Vero se il valore è un solo "N%" (serve alla regola di somma e sottrazione). */
  pct: boolean;
}

class Parser {
  private i = 0;
  private depth = 0;
  constructor(
    private readonly toks: Tok[],
    private readonly angle: AngleMode,
    private readonly ans: number,
  ) {}

  parse(): number {
    const r = this.expr();
    if (this.i < this.toks.length) {
      const t = this.toks[this.i];
      if (t.t === 'op' && t.v === ')') throw new CalcFail('parens');
      throw new CalcFail('syntax', String(t.v));
    }
    return r.v;
  }

  private peek(): Tok | undefined {
    return this.toks[this.i];
  }
  private isOp(v: string): boolean {
    const t = this.peek();
    return t?.t === 'op' && t.v === v;
  }

  private expr(): Val {
    if (++this.depth > MAX_DEPTH) throw new CalcFail('syntax');
    let left = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.toks[this.i++] as { v: string }).v;
      const right = this.term();
      // 200 + 10% = 200 + (10% di 200)
      const r = right.pct ? left.v * right.v : right.v;
      left = { v: op === '+' ? left.v + r : left.v - r, pct: false };
    }
    this.depth--;
    return left;
  }

  /** Vero se il token successivo può iniziare un fattore: serve alla moltiplicazione implicita. */
  private startsFactor(): boolean {
    const t = this.peek();
    return !!t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.v === '('));
  }

  private term(): Val {
    let left = this.unary();
    let single = true;
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.toks[this.i++] as { v: string }).v;
        const right = this.unary();
        if (op === '/' && right.v === 0) throw new CalcFail('div0');
        left = { v: op === '*' ? left.v * right.v : left.v / right.v, pct: false };
      } else if (this.startsFactor()) {
        const right = this.unary();
        left = { v: left.v * right.v, pct: false };
      } else break;
      single = false;
    }
    return single ? left : { v: left.v, pct: false };
  }

  private unary(): Val {
    if (this.isOp('-')) {
      this.i++;
      return { v: -this.unary().v, pct: false };
    }
    if (this.isOp('+')) {
      this.i++;
      return this.unary();
    }
    return this.power();
  }

  private power(): Val {
    const base = this.postfix();
    if (this.isOp('^')) {
      this.i++;
      if (++this.depth > MAX_DEPTH) throw new CalcFail('syntax');
      const exp = this.unary(); // associativa a destra, e accetta 2^-3
      this.depth--;
      const r = Math.pow(base.v, exp.v);
      if (Number.isNaN(r)) throw new CalcFail('domain', '^');
      return { v: r, pct: false };
    }
    return base;
  }

  private postfix(): Val {
    let val = this.primary();
    for (;;) {
      if (this.isOp('!')) {
        this.i++;
        val = { v: factorial(val.v), pct: false };
      } else if (this.isOp('%')) {
        this.i++;
        val = { v: val.v / 100, pct: true };
      } else return val;
    }
  }

  private primary(): Val {
    const t = this.toks[this.i++];
    if (!t) throw new CalcFail('syntax', '');
    if (t.t === 'num') return { v: t.v, pct: false };
    if (t.t === 'op' && t.v === '(') {
      const r = this.expr();
      if (!this.isOp(')')) throw new CalcFail('parens');
      this.i++;
      return { v: r.v, pct: false };
    }
    if (t.t === 'id') {
      if (t.v === 'ans') return { v: this.ans, pct: false };
      if (Object.hasOwn(CONSTANTS, t.v)) return { v: CONSTANTS[t.v], pct: false };
      if (!(FUNCTIONS as readonly string[]).includes(t.v)) throw new CalcFail('unknown', t.v);
      if (!this.isOp('(')) throw new CalcFail('syntax', t.v);
      this.i++;
      const arg = this.expr();
      if (!this.isOp(')')) throw new CalcFail('parens');
      this.i++;
      return { v: fn(t.v, arg.v, this.angle), pct: false };
    }
    throw new CalcFail('syntax', String(t.v));
  }
}

/** Valuta un'espressione. `ans` è il risultato precedente (0 se non c'è). Non lancia mai: gli errori sono nel risultato. */
export function evaluate(expr: string, opts: { angle?: AngleMode; ans?: number } = {}): CalcResult {
  if (expr.trim() === '') return { ok: false, error: 'empty' };
  if (expr.length > MAX_LENGTH) return { ok: false, error: 'tooLong' };
  try {
    const value = new Parser(tokenize(expr), opts.angle ?? 'deg', opts.ans ?? 0).parse();
    if (!Number.isFinite(value)) return { ok: false, error: 'overflow' };
    return { ok: true, value: tidy(value) };
  } catch (e) {
    if (e instanceof CalcFail) return { ok: false, error: e.code, detail: e.detail };
    return { ok: false, error: 'syntax' };
  }
}

/** Testo del risultato nella lingua: fino a 12 cifre significative, notazione scientifica per numeri molto grandi o piccoli. */
export function formatNumber(n: number, lang: 'it' | 'en'): string {
  if (Object.is(n, -0)) n = 0;
  const abs = Math.abs(n);
  let s: string;
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) {
    s = n.toExponential(11).replace(/\.?0+e/, 'e');
  } else {
    s = String(Number(n.toPrecision(12)));
    if (s.includes('e')) s = n.toFixed(12).replace(/\.?0+$/, '');
  }
  return lang === 'it' ? s.replace('.', ',') : s;
}
