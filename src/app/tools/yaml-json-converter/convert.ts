// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { parseAllDocuments, stringify as yamlStringify } from 'yaml';
import { TomlError, parse as tomlParse, stringify as tomlStringify } from 'smol-toml';

export type Format = 'yaml' | 'json' | 'toml';
export type Indent = '2' | '4' | 'tab';

export interface ConvError {
  message: string;
  /** Posizione (1-based) quando la libreria la fornisce. */
  line?: number;
  column?: number;
}

export interface ConvertOptions {
  indent: Indent;
  sortKeys: boolean;
  /** Da JSON/TOML a YAML: se la radice è un array, un documento YAML per ogni elemento. */
  arrayAsDocuments: boolean;
}

export const DEFAULT_OPTIONS: ConvertOptions = { indent: '2', sortKeys: false, arrayAsDocuments: false };

export type ParseResult = { ok: true; value: unknown; documents: number } | { ok: false; error: ConvError };
export type ConvertResult =
  | { ok: true; text: string; documents: number }
  | { ok: false; stage: 'parse' | 'write'; error: ConvError };

/** Estensione tipica di ogni formato (per il nome del file scaricato). */
export const EXTENSIONS: Record<Format, string> = { yaml: 'yaml', json: 'json', toml: 'toml' };

/** Formato dedotto dal nome di un file, o null. */
export function formatFromFileName(name: string): Format | null {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  const ext = m ? m[1].toLowerCase() : '';
  if (ext === 'yaml' || ext === 'yml') return 'yaml';
  if (ext === 'json') return 'json';
  if (ext === 'toml') return 'toml';
  return null;
}

/** Posizione 1-based di un offset (indice di carattere) nel testo. */
export function positionOf(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, Math.min(offset, text.length)));
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/** Indice di carattere di riga/colonna 1-based (per selezionare il punto dell'errore). */
export function offsetOf(text: string, line: number, column: number): number {
  let offset = 0;
  for (let l = 1; l < line; l++) {
    const next = text.indexOf('\n', offset);
    if (next === -1) return text.length;
    offset = next + 1;
  }
  return Math.min(offset + Math.max(0, column - 1), text.length);
}

// ---------- lettura ----------

function parseYaml(text: string): ParseResult {
  // merge: true risolve le chiavi `<<` (YAML 1.1) molto usate in docker-compose e CI
  const docs = parseAllDocuments(text, { merge: true });
  const list = Array.isArray(docs) ? docs : [docs];
  for (const d of list) {
    const err = d.errors[0];
    if (err) {
      const pos = err.linePos?.[0];
      const message = err.message
        .split('\n')[0]
        .replace(/ at line \d+, column \d+:?$/, '')
        .trim();
      return { ok: false, error: { message, line: pos?.line, column: pos?.col } };
    }
  }
  const values = list.map((d) => d.toJS() as unknown);
  if (values.length === 0) return { ok: true, value: null, documents: 0 };
  if (values.length === 1) return { ok: true, value: values[0], documents: 1 };
  return { ok: true, value: values, documents: values.length };
}

/**
 * Offset del primo carattere che rende il JSON non valido (o la fine del testo se è incompleto), o null se è valido.
 * Le stringhe d'errore dei motori JS differiscono (e a volte non hanno la posizione), quindi la cerchiamo noi.
 */
export function locateJsonError(text: string): number | null {
  let i = 0;
  const n = text.length;
  const ws = (): void => {
    while (i < n && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++;
  };
  const str = (): boolean => {
    i++; // virgolette di apertura
    while (i < n) {
      const c = text[i];
      if (c === '"') {
        i++;
        return true;
      }
      if (c < ' ') return false;
      if (c === '\\') {
        const e = text[i + 1];
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
            i += 2;
            return false;
          }
          i += 6;
        } else if (e !== undefined && '"\\/bfnrt'.includes(e)) i += 2;
        else {
          i++;
          return false;
        }
      } else i++;
    }
    return false; // stringa non chiusa: errore a fine testo
  };
  const num = (): boolean => {
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (!m) return false;
    i += m[0].length;
    return true;
  };
  const value = (depth: number): boolean => {
    ws();
    if (depth > 2000) return false;
    const c = text[i];
    if (c === '{') {
      i++;
      ws();
      if (text[i] === '}') {
        i++;
        return true;
      }
      for (;;) {
        ws();
        if (text[i] !== '"' || !str()) return false;
        ws();
        if (text[i] !== ':') return false;
        i++;
        if (!value(depth + 1)) return false;
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === '}') {
          i++;
          return true;
        }
        return false;
      }
    }
    if (c === '[') {
      i++;
      ws();
      if (text[i] === ']') {
        i++;
        return true;
      }
      for (;;) {
        if (!value(depth + 1)) return false;
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === ']') {
          i++;
          return true;
        }
        return false;
      }
    }
    if (c === '"') return str();
    for (const lit of ['true', 'false', 'null']) {
      if (text.startsWith(lit, i)) {
        i += lit.length;
        return true;
      }
    }
    return num();
  };
  if (!value(0)) return Math.min(i, n);
  ws();
  if (i < n) return i;
  return null;
}

function parseJson(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as unknown, documents: 1 };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    let line: number | undefined;
    let column: number | undefined;
    const lc = /line (\d+) column (\d+)/.exec(raw);
    const pos = /position (\d+)/.exec(raw);
    if (lc) {
      line = Number(lc[1]);
      column = Number(lc[2]);
    } else if (pos) {
      ({ line, column } = positionOf(text, Number(pos[1])));
    }
    if (line === undefined) {
      const at = locateJsonError(text);
      if (at !== null) ({ line, column } = positionOf(text, at));
    }
    const message = raw
      .replace(/\s*\(line \d+ column \d+\)/, '')
      .replace(/\s*at line \d+ column \d+ of the JSON data/, '')
      .replace(/\s*in JSON at position \d+/, '')
      .replace(/\s*at position \d+/, '')
      .replace(/^JSON\.parse: /, '');
    return { ok: false, error: { message, line, column } };
  }
}

function parseToml(text: string): ParseResult {
  try {
    return { ok: true, value: tomlParse(text, { integersAsBigInt: true }), documents: 1 };
  } catch (e) {
    if (e instanceof TomlError) {
      const message = e.message.split('\n')[0].replace(/^Invalid TOML document: /, '');
      return { ok: false, error: { message, line: e.line, column: e.column } };
    }
    return { ok: false, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

export function parseInput(text: string, format: Format): ParseResult {
  try {
    if (format === 'yaml') return parseYaml(text);
    if (format === 'json') return parseJson(text);
    return parseToml(text);
  } catch (e) {
    return { ok: false, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

// ---------- scrittura ----------

function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  // defineProperty: una chiave "__proto__" resta un dato e non cambia il prototipo
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

/**
 * Prepara il valore per il formato di destinazione: date e interi grandi di TOML diventano
 * stringhe/numeri per JSON e YAML (restano nativi per TOML); opzionalmente ordina le chiavi.
 */
export function normalize(value: unknown, keepNative: boolean, sortKeys: boolean): unknown {
  if (value instanceof Date) {
    if (keepNative) return value;
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'bigint') {
    if (keepNative) return value;
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : value.toString();
  }
  if (typeof value === 'number' && !Number.isFinite(value) && !keepNative) return Number.isNaN(value) ? null : value;
  if (Array.isArray(value)) return value.map((v) => normalize(v, keepNative, sortKeys));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(value);
    if (sortKeys) keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const k of keys) setOwn(out, k, normalize((value as Record<string, unknown>)[k], keepNative, sortKeys));
    return out;
  }
  return value;
}

/** Percorso del primo valore che TOML non può rappresentare (null/undefined), o null. */
export function findTomlProblem(value: unknown, path = ''): string | null {
  if (value === null || value === undefined) return path || '(root)';
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const p = findTomlProblem(value[i], `${path}[${i}]`);
      if (p) return p;
    }
  } else if (typeof value === 'object' && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) {
      const p = findTomlProblem(v, path ? `${path}.${k}` : k);
      if (p) return p;
    }
  }
  return null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
}

function indentSize(indent: Indent): number {
  return indent === '4' ? 4 : 2;
}

export function serialize(value: unknown, format: Format, opts: ConvertOptions, asDocuments: boolean): string {
  const data = normalize(value, format === 'toml', opts.sortKeys);
  if (format === 'json') {
    return JSON.stringify(data, null, opts.indent === 'tab' ? '\t' : indentSize(opts.indent)) ?? 'null';
  }
  if (format === 'yaml') {
    // lo YAML non ammette tabulazioni: con "tab" si usano 2 spazi
    const o = { indent: indentSize(opts.indent), lineWidth: 0 };
    if (asDocuments && Array.isArray(data)) {
      return data.map((d) => '---\n' + yamlStringify(d, o)).join('');
    }
    return yamlStringify(data, o);
  }
  if (!isPlainObject(data)) throw new RangeError('toml-root');
  const bad = findTomlProblem(data);
  if (bad) throw new RangeError('toml-null:' + bad);
  return tomlStringify(data) + '\n';
}

export function convert(text: string, from: Format, to: Format, opts: ConvertOptions = DEFAULT_OPTIONS): ConvertResult {
  const parsed = parseInput(text, from);
  if (!parsed.ok) return { ok: false, stage: 'parse', error: parsed.error };
  const asDocuments = to === 'yaml' && Array.isArray(parsed.value) && (opts.arrayAsDocuments || (from === 'yaml' && parsed.documents > 1));
  try {
    return { ok: true, text: serialize(parsed.value, to, opts, asDocuments), documents: parsed.documents };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, stage: 'write', error: { message: raw } };
  }
}
