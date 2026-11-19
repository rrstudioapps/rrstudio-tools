// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { normalizeNewlines, parseXml } from '../xml-formatter/xml';
import type { XmlError, XmlNode } from '../xml-formatter/xml';
import { escapeAttr, unescapeXml } from '../xml-viewer/xml-tree';

/**
 * Da XML a JSON e da JSON a XML, nei due sensi. Convenzione (come i convertitori più diffusi):
 * attributi come chiavi con un prefisso (`@id`), testo di un elemento che ha anche attributi o figli in `#text`,
 * figli con lo stesso nome raccolti in un array, elemento vuoto = `null`. Commenti e istruzioni di elaborazione
 * si perdono; nel contenuto misto il testo si unisce in `#text` e l'ordine rispetto ai figli non si conserva.
 */

export interface XmlJsonOptions {
  /** Prefisso delle chiavi che sono attributi (di solito `@`). */
  attrPrefix: string;
  /** Chiave del testo di un elemento con attributi o figli. */
  textKey: string;
  /** Da XML: anche un figlio unico diventa un array. */
  forceArrays: boolean;
  /** Da XML: «123», «1.5», «true», «false» diventano numeri e booleani (solo se il testo non cambia riscrivendoli). */
  infer: boolean;
  /** Da JSON: rientro (0 = una riga sola). */
  indent: number;
  /** Da JSON: dichiarazione `<?xml …?>` in testa. */
  declaration: boolean;
  /** Da JSON: nome dell'elemento radice quando il JSON non ne ha uno solo. */
  rootName: string;
}

export const DEFAULT_OPTIONS: XmlJsonOptions = {
  attrPrefix: '@',
  textKey: '#text',
  forceArrays: false,
  infer: false,
  indent: 2,
  declaration: true,
  rootName: 'root',
};

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export type ConvertError =
  | { stage: 'xml'; error: XmlError }
  | { stage: 'json'; message: string; line?: number; column?: number }
  | { stage: 'write'; code: 'name' | 'shape' | 'attr' | 'text'; path: string; detail?: string };

export type XmlToJsonResult = { ok: true; json: Json; text: string } | { ok: false; error: ConvertError };
export type JsonToXmlResult = { ok: true; text: string } | { ok: false; error: ConvertError };

const NUMBER_RE = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;

/** «true»/«false» e i numeri scritti in forma canonica (niente zeri iniziali, niente numeri che perderebbero cifre). */
export function inferValue(s: string): string | number | boolean {
  if (s === 'true') return true;
  if (s === 'false') return false;
  // numero solo se riscritto dà lo stesso testo: «1.50», «1e3» e gli interi enormi restano stringhe
  if (NUMBER_RE.test(s) && String(Number(s)) === s) return Number(s);
  return s;
}

type El = Extract<XmlNode, { t: 'el' }>;

function textOf(el: El): string {
  return el.children
    .map((c) => (c.t === 'text' ? unescapeXml(c.value) : c.t === 'cdata' ? c.raw.slice(9, -3) : ''))
    .join('');
}

function elementToJson(el: El, o: XmlJsonOptions): Json {
  const kids = el.children.filter((c): c is El => c.t === 'el');
  const raw = textOf(el);
  const text = kids.length || el.attrs.length ? raw.trim() : raw;
  const val = (s: string): Json => (o.infer ? inferValue(s) : s);
  if (!kids.length && !el.attrs.length) return text === '' ? null : val(text);
  const obj: { [k: string]: Json } = {};
  for (const a of el.attrs) obj[o.attrPrefix + a.name] = val(unescapeXml(a.value));
  const groups = new Map<string, Json[]>();
  for (const k of kids) {
    const list = groups.get(k.name) ?? [];
    list.push(elementToJson(k, o));
    groups.set(k.name, list);
  }
  for (const [name, list] of groups) obj[name] = list.length > 1 || o.forceArrays ? list : list[0];
  if (text !== '') obj[o.textKey] = val(text);
  return obj;
}

/** Da testo XML a JSON (`{ radice: … }`). */
export function xmlToJson(src: string, o: XmlJsonOptions): XmlToJsonResult {
  const r = parseXml(normalizeNewlines(src));
  if (!r.ok) return { ok: false, error: { stage: 'xml', error: r.error } };
  const root = r.nodes.find((n): n is El => n.t === 'el');
  if (!root) return { ok: false, error: { stage: 'xml', error: { code: 'noRoot', params: {}, line: 1, column: 1 } } };
  const json: Json = { [root.name]: elementToJson(root, o) };
  return { ok: true, json, text: JSON.stringify(json, null, o.indent === 0 ? undefined : o.indent) };
}

// ---------- da JSON a XML ----------

const NAME_RE = /^[\p{L}_][\p{L}\p{N}_.\-·]*(:[\p{L}_][\p{L}\p{N}_.\-·]*)?$/u;
const isObj = (x: unknown): x is { [k: string]: Json } => typeof x === 'object' && x !== null && !Array.isArray(x);

class WriteFail extends Error {
  constructor(readonly info: Extract<ConvertError, { stage: 'write' }>) {
    super(info.code);
  }
}

const escText = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const scalar = (v: Json): string => (v === null ? '' : String(v));
// eslint-disable-next-line no-control-regex
const BAD_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/;

function writeElement(name: string, value: Json, o: XmlJsonOptions, depth: number, path: string, out: string[]): void {
  if (!NAME_RE.test(name)) throw new WriteFail({ stage: 'write', code: 'name', path, detail: name });
  if (Array.isArray(value)) {
    value.forEach((v, i) => writeElement(name, v, o, depth, `${path}[${i + 1}]`, out));
    return;
  }
  const pad = o.indent > 0 ? ' '.repeat(o.indent * depth) : '';
  const nl = o.indent > 0 ? '\n' : '';
  if (!isObj(value)) {
    const t = scalar(value);
    if (BAD_CHARS.test(t)) throw new WriteFail({ stage: 'write', code: 'text', path });
    out.push(t === '' ? `${pad}<${name}/>${nl}` : `${pad}<${name}>${escText(t)}</${name}>${nl}`);
    return;
  }
  let attrs = '';
  let text = '';
  const children: [string, Json][] = [];
  for (const [k, v] of Object.entries(value)) {
    if (o.attrPrefix && k.startsWith(o.attrPrefix) && k.length > o.attrPrefix.length) {
      const an = k.slice(o.attrPrefix.length);
      if (!NAME_RE.test(an)) throw new WriteFail({ stage: 'write', code: 'name', path: `${path}/${k}`, detail: an });
      if (v !== null && typeof v === 'object') throw new WriteFail({ stage: 'write', code: 'attr', path: `${path}/${k}` });
      const s = scalar(v);
      if (BAD_CHARS.test(s)) throw new WriteFail({ stage: 'write', code: 'text', path: `${path}/${k}` });
      attrs += ` ${an}="${escapeAttr(s, '"')}"`;
    } else if (k === o.textKey) {
      if (v !== null && typeof v === 'object') throw new WriteFail({ stage: 'write', code: 'text', path: `${path}/${k}` });
      text = scalar(v);
      if (BAD_CHARS.test(text)) throw new WriteFail({ stage: 'write', code: 'text', path: `${path}/${k}` });
    } else children.push([k, v]);
  }
  if (!children.length) {
    out.push(text === '' ? `${pad}<${name}${attrs}/>${nl}` : `${pad}<${name}${attrs}>${escText(text)}</${name}>${nl}`);
    return;
  }
  out.push(`${pad}<${name}${attrs}>${nl}`);
  if (text !== '') out.push(`${o.indent > 0 ? ' '.repeat(o.indent * (depth + 1)) : ''}${escText(text)}${nl}`);
  for (const [k, v] of children) writeElement(k, v, o, depth + 1, `${path}/${k}`, out);
  out.push(`${pad}</${name}>${nl}`);
}

/**
 * Da testo JSON a XML. Un oggetto con una sola chiave (non attributo né testo) fa da elemento radice; in ogni altro
 * caso (più chiavi, array, valore semplice) tutto va dentro `rootName`.
 */
export function jsonToXml(src: string, o: XmlJsonOptions): JsonToXmlResult {
  let data: Json;
  try {
    data = JSON.parse(src.replace(/^﻿/, '')) as Json;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const pos = /position (\d+)/.exec(message);
    if (pos) {
      const before = src.slice(0, Number(pos[1]));
      const line = before.split('\n').length;
      return { ok: false, error: { stage: 'json', message, line, column: before.length - before.lastIndexOf('\n') } };
    }
    return { ok: false, error: { stage: 'json', message } };
  }
  const out: string[] = [];
  if (o.declaration) out.push('<?xml version="1.0" encoding="UTF-8"?>' + (o.indent > 0 ? '\n' : ''));
  try {
    const keys = isObj(data) ? Object.keys(data) : [];
    const single = keys.length === 1 && !(o.attrPrefix && keys[0].startsWith(o.attrPrefix)) && keys[0] !== o.textKey && !Array.isArray((data as { [k: string]: Json })[keys[0]]);
    if (single) writeElement(keys[0], (data as { [k: string]: Json })[keys[0]], o, 0, '/' + keys[0], out);
    else {
      if (!NAME_RE.test(o.rootName)) throw new WriteFail({ stage: 'write', code: 'name', path: '/', detail: o.rootName });
      writeElement(o.rootName, data, o, 0, '/' + o.rootName, out);
    }
  } catch (e) {
    if (e instanceof WriteFail) return { ok: false, error: e.info };
    throw e;
  }
  return { ok: true, text: out.join('') };
}
