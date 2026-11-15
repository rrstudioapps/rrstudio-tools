// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

export interface JsonError {
  /** Messaggio del motore JS, senza prefissi e senza la posizione. */
  message: string;
  /** Indice (0-based) nel testo, se noto. */
  position: number | null;
  /** Riga e colonna (1-based), se note. */
  line: number | null;
  column: number | null;
}

export type JsonParseResult = { ok: true; value: unknown } | { ok: false; error: JsonError };

/** Da indice a riga/colonna (1-based). */
export function positionToLineColumn(text: string, position: number): { line: number; column: number } {
  const pos = Math.max(0, Math.min(position, text.length));
  let line = 1;
  let last = -1;
  for (let i = text.indexOf('\n'); i !== -1 && i < pos; i = text.indexOf('\n', i + 1)) {
    line++;
    last = i;
  }
  return { line, column: pos - last };
}

/** Da riga/colonna (1-based) a indice. */
export function lineColumnToPosition(text: string, line: number, column: number): number {
  let idx = 0;
  for (let l = 1; l < line; l++) {
    const n = text.indexOf('\n', idx);
    if (n === -1) return text.length;
    idx = n + 1;
  }
  return Math.min(idx + column - 1, text.length);
}

/**
 * Scanner di sintassi JSON minimale: restituisce la posizione del primo errore, o null.
 * Serve solo quando il motore non indica la posizione (per esempio Safari o i messaggi V8 con estratto).
 */
export function findSyntaxErrorPosition(text: string): number | null {
  let i = 0;
  const n = text.length;
  const fail = (): never => {
    throw i;
  };
  const ws = () => {
    while (i < n && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++;
  };
  const literal = (word: string) => {
    for (const ch of word) {
      if (text[i] !== ch) fail();
      i++;
    }
  };
  const str = () => {
    i++; // "
    while (i < n) {
      const c = text[i];
      if (c === '"') {
        i++;
        return;
      }
      if (c < ' ') fail();
      if (c === '\\') {
        i++;
        const e = text[i];
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) {
            i++;
            fail();
          }
          i += 5;
        } else if (e !== undefined && '"\\/bfnrt'.includes(e)) i++;
        else fail();
      } else i++;
    }
    fail(); // stringa non chiusa
  };
  const num = () => {
    const m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i, i + 400));
    if (!m) fail();
    else i += m[0].length;
  };
  const value = (): void => {
    ws();
    const c = text[i];
    if (c === '{') {
      i++;
      ws();
      if (text[i] === '}') {
        i++;
        return;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') fail();
        str();
        ws();
        if (text[i] !== ':') fail();
        i++;
        value();
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === '}') {
          i++;
          return;
        }
        fail();
      }
    } else if (c === '[') {
      i++;
      ws();
      if (text[i] === ']') {
        i++;
        return;
      }
      for (;;) {
        value();
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === ']') {
          i++;
          return;
        }
        fail();
      }
    } else if (c === '"') str();
    else if (c === 't') literal('true');
    else if (c === 'f') literal('false');
    else if (c === 'n') literal('null');
    else if (c === '-' || (c !== undefined && c >= '0' && c <= '9')) num();
    else fail();
  };
  try {
    value();
    ws();
    if (i < n) fail();
    return null;
  } catch (e) {
    return typeof e === 'number' ? e : null;
  }
}

/** Estrae posizione e messaggio puliti dall'errore di JSON.parse (formati V8, Firefox, Safari). */
export function describeParseError(text: string, err: unknown): JsonError {
  let message = err instanceof Error ? err.message : String(err);
  message = message.replace(/^JSON\.parse:\s*/, '').replace(/^JSON Parse error:\s*/, '');
  let position: number | null = null;
  let line: number | null = null;
  let column: number | null = null;

  // Firefox: "... at line 2 column 5 of the JSON data"; V8 recente: "... (line 2 column 5)"
  const lc = /\(?\bline (\d+) column (\d+)\)?/.exec(message);
  if (lc) {
    line = Number(lc[1]);
    column = Number(lc[2]);
    position = lineColumnToPosition(text, line, column);
    message = message.replace(/\s*\(?\bline \d+ column \d+\)?(?:\s*of the JSON data)?/, '');
  }
  // V8: "... in JSON at position 12" (con o senza la parte "(line .. column ..)")
  const pos = /\bat position (\d+)/.exec(message);
  if (pos) {
    if (position === null) position = Number(pos[1]);
    message = message.replace(/\s*(?:in JSON )?at position \d+/, '');
  }
  // V8 aggiunge un estratto del testo: lo togliamo (la riga evidenziata lo rende inutile)
  message = message.replace(/,\s*(?:\.\.\.)?"[\s\S]*" is not valid JSON\s*$/, '');
  message = message.replace(/\s*in JSON\s*$/, '').replace(/\s+at\s*$/, '').trim();
  if (/unexpected end of (?:JSON )?(?:input|data)/i.test(message) && position === null) position = text.length;
  // Nessuna posizione dal motore (Safari, V8 con estratto): la cerco con lo scanner
  position ??= findSyntaxErrorPosition(text);
  if (position !== null && line === null) {
    ({ line, column } = positionToLineColumn(text, position));
  }
  return { message: message || 'Invalid JSON', position, line, column };
}

export function parseJson(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: describeParseError(text, err) };
  }
}

export type Indent = 2 | 4 | 'tab';

/** Copia con le chiavi ordinate in modo ricorsivo (gli array mantengono l'ordine). */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    // fromEntries definisce le proprietà come dati: sicuro anche con una chiave "__proto__"
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortKeysDeep((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export function formatJson(value: unknown, indent: Indent, sortKeys: boolean): string {
  const v = sortKeys ? sortKeysDeep(value) : value;
  return JSON.stringify(v, null, indent === 'tab' ? '\t' : indent);
}

export function minifyJson(value: unknown, sortKeys: boolean): string {
  return JSON.stringify(sortKeys ? sortKeysDeep(value) : value);
}

export interface JsonStats {
  keys: number;
  depth: number;
}

/** Numero totale di chiavi degli oggetti e profondità massima (valore semplice = 0, {"a":1} = 1). */
export function jsonStats(value: unknown): JsonStats {
  let keys = 0;
  const walk = (v: unknown): number => {
    if (v === null || typeof v !== 'object') return 0;
    let max = 0;
    const children = Array.isArray(v) ? v : Object.values(v);
    if (!Array.isArray(v)) keys += children.length;
    for (const c of children) max = Math.max(max, walk(c));
    return 1 + max;
  };
  const depth = walk(value);
  return { keys, depth };
}

export type TokenType = 'key' | 'string' | 'number' | 'literal' | 'punct' | 'space';
export interface JsonToken {
  type: TokenType;
  text: string;
}

const TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}[\],:]|\s+/g;

/** Spezza un JSON già valido in token per l'evidenziazione (nessun HTML coinvolto). */
export function tokenizeJson(text: string): JsonToken[] {
  const out: JsonToken[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const t = m[0];
    if (m[1] !== undefined) {
      if (m[2] !== undefined) {
        out.push({ type: 'key', text: m[1] });
        out.push({ type: 'punct', text: m[2] });
      } else out.push({ type: 'string', text: t });
    } else if (/^\s/.test(t)) out.push({ type: 'space', text: t });
    else if (t === 'true' || t === 'false' || t === 'null') out.push({ type: 'literal', text: t });
    else if (/^[{}[\],:]$/.test(t)) out.push({ type: 'punct', text: t });
    else out.push({ type: 'number', text: t });
  }
  return out;
}
