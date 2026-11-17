// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

export interface XmlError {
  /** Codice dell'errore (chiave `xml.err.<code>` del dizionario). */
  code: string;
  params: Record<string, string | number>;
  /** Posizione 1-based. */
  line: number;
  column: number;
}

export interface XmlAttr {
  name: string;
  quote: '"' | "'";
  value: string;
}

export type XmlNode =
  | { t: 'el'; name: string; attrs: XmlAttr[]; selfClose: boolean; children: XmlNode[]; preserve: boolean; inner: string }
  | { t: 'text'; value: string }
  | { t: 'cdata'; raw: string }
  | { t: 'comment'; raw: string }
  | { t: 'pi'; raw: string }
  | { t: 'doctype'; raw: string };

export type ParseResult = { ok: true; nodes: XmlNode[] } | { ok: false; error: XmlError };

const NAME_RE = /^[\p{L}_:][\p{L}\p{N}_:.\-·]*$/u;
const BAD_AMP_RE = /&(?!#[0-9]+;|#x[0-9a-fA-F]+;|[\p{L}_:][\p{L}\p{N}_:.\-]*;)/u;
const WS = /\s/;

/** Normalizza i fine riga (come richiede XML) e toglie un eventuale BOM. */
export function normalizeNewlines(src: string): string {
  return src.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

class Fail extends Error {
  constructor(
    readonly code: string,
    readonly offset: number,
    readonly params: Record<string, string | number> = {},
  ) {
    super(code);
  }
}

/** Indici di inizio riga, per convertire un offset in riga/colonna senza rileggere il testo. */
function lineStarts(src: string): number[] {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

function locate(starts: number[], offset: number): { line: number; column: number } {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: offset - starts[lo] + 1 };
}

/**
 * Legge l'XML in un albero minimo, controllando la buona formazione (tag annidati, attributi, entità,
 * una sola radice). Il testo e le entità restano come scritti: non si decodifica nulla.
 * `src` deve avere già i fine riga normalizzati.
 */
export function parseXml(src: string): ParseResult {
  const starts = lineStarts(src);
  const n = src.length;
  const root: XmlNode[] = [];
  const stack: { node: Extract<XmlNode, { t: 'el' }>; offset: number; innerStart: number }[] = [];
  let rootCount = 0;
  let i = 0;

  const container = (): XmlNode[] => (stack.length ? stack[stack.length - 1].node.children : root);

  try {
    while (i < n) {
      if (src[i] !== '<') {
        let end = src.indexOf('<', i);
        if (end === -1) end = n;
        const text = src.slice(i, end);
        if (stack.length === 0) {
          const m = /\S/.exec(text);
          if (m) throw new Fail('textOutside', i + m.index);
        } else {
          const amp = BAD_AMP_RE.exec(text);
          if (amp) throw new Fail('badAmp', i + amp.index);
          const cd = text.indexOf(']]>');
          if (cd !== -1) throw new Fail('cdataEnd', i + cd);
          container().push({ t: 'text', value: text });
        }
        i = end;
      } else if (src.startsWith('<!--', i)) {
        const end = src.indexOf('-->', i + 4);
        if (end === -1) throw new Fail('unterminatedComment', i);
        container().push({ t: 'comment', raw: src.slice(i, end + 3) });
        i = end + 3;
      } else if (src.startsWith('<![CDATA[', i)) {
        if (stack.length === 0) throw new Fail('cdataOutside', i);
        const end = src.indexOf(']]>', i + 9);
        if (end === -1) throw new Fail('unterminatedCdata', i);
        container().push({ t: 'cdata', raw: src.slice(i, end + 3) });
        i = end + 3;
      } else if (src.startsWith('<?', i)) {
        const end = src.indexOf('?>', i + 2);
        if (end === -1) throw new Fail('unterminatedPi', i);
        container().push({ t: 'pi', raw: src.slice(i, end + 2) });
        i = end + 2;
      } else if (src.startsWith('<!', i)) {
        if (!/^<!DOCTYPE\b/i.test(src.slice(i, i + 10)) || stack.length > 0) throw new Fail('badMarkup', i);
        let j = i + 9;
        let depth = 0;
        let quote = '';
        for (; j < n; j++) {
          const c = src[j];
          if (quote) {
            if (c === quote) quote = '';
          } else if (c === '"' || c === "'") quote = c;
          else if (c === '[') depth++;
          else if (c === ']') depth--;
          else if (c === '>' && depth <= 0) break;
        }
        if (j >= n) throw new Fail('unterminatedDoctype', i);
        root.push({ t: 'doctype', raw: src.slice(i, j + 1) });
        i = j + 1;
      } else if (src[i + 1] === '/') {
        const m = /^<\/([^\s>]*)\s*>/.exec(src.slice(i, i + 4096));
        if (!m) throw new Fail('badEndTag', i);
        const open = stack[stack.length - 1];
        if (!open) throw new Fail('unexpectedEnd', i, { name: m[1] });
        if (open.node.name !== m[1]) {
          const at = locate(starts, open.offset);
          throw new Fail('mismatch', i, { expected: open.node.name, found: m[1], line: at.line });
        }
        open.node.inner = src.slice(open.innerStart, i);
        stack.pop();
        i += m[0].length;
      } else {
        // tag di apertura
        const start = i;
        let j = i + 1;
        let k = j;
        while (k < n && !WS.test(src[k]) && src[k] !== '/' && src[k] !== '>') k++;
        const name = src.slice(j, k);
        if (!name) throw new Fail('badName', start, { name: '<' });
        if (!NAME_RE.test(name)) throw new Fail('badName', j, { name });
        j = k;
        const attrs: XmlAttr[] = [];
        let selfClose = false;
        for (;;) {
          const ws0 = j;
          while (j < n && WS.test(src[j])) j++;
          const spaced = j > ws0;
          if (j >= n) throw new Fail('unterminatedTag', start);
          if (src[j] === '>') {
            j++;
            break;
          }
          if (src[j] === '/') {
            if (src[j + 1] !== '>') throw new Fail('badAttr', j);
            selfClose = true;
            j += 2;
            break;
          }
          if (!spaced) throw new Fail('badAttr', j);
          let a = j;
          while (a < n && !WS.test(src[a]) && src[a] !== '=' && src[a] !== '>' && src[a] !== '/') a++;
          const aName = src.slice(j, a);
          if (!aName || !NAME_RE.test(aName)) throw new Fail('badAttrName', j, { name: aName || src[j] });
          if (attrs.some((x) => x.name === aName)) throw new Fail('dupAttr', j, { name: aName });
          while (a < n && WS.test(src[a])) a++;
          if (src[a] !== '=') throw new Fail('attrNoValue', j, { name: aName });
          a++;
          while (a < n && WS.test(src[a])) a++;
          const q = src[a];
          if (q !== '"' && q !== "'") throw new Fail('attrNoQuote', Math.min(a, n - 1), { name: aName });
          const close = src.indexOf(q, a + 1);
          if (close === -1) throw new Fail('unterminatedTag', start);
          const value = src.slice(a + 1, close);
          const lt = value.indexOf('<');
          if (lt !== -1) throw new Fail('ltInAttr', a + 1 + lt, { name: aName });
          const amp = BAD_AMP_RE.exec(value);
          if (amp) throw new Fail('badAmp', a + 1 + amp.index);
          attrs.push({ name: aName, quote: q, value });
          j = close + 1;
        }
        if (stack.length === 0) {
          rootCount++;
          if (rootCount > 1) throw new Fail('multiRoot', start);
        }
        // xml:space si eredita dall'antenato più vicino; "default" su un discendente annulla il preserve
        const space = attrs.find((x) => x.name === 'xml:space')?.value;
        const preserve = space === 'preserve' ? true : space === 'default' ? false : (stack[stack.length - 1]?.node.preserve ?? false);
        const node: Extract<XmlNode, { t: 'el' }> = { t: 'el', name, attrs, selfClose, children: [], preserve, inner: '' };
        container().push(node);
        if (!selfClose) stack.push({ node, offset: start, innerStart: j });
        i = j;
      }
    }
    if (stack.length > 0) {
      const open = stack[stack.length - 1];
      throw new Fail('unclosed', n, { name: open.node.name, line: locate(starts, open.offset).line });
    }
    if (rootCount === 0) throw new Fail('noRoot', n);
  } catch (e) {
    if (e instanceof Fail) {
      const { line, column } = locate(starts, Math.min(e.offset, n));
      return { ok: false, error: { code: e.code, params: e.params, line, column } };
    }
    throw e;
  }
  return { ok: true, nodes: root };
}

// ---------- scrittura ----------

export interface FormatOptions {
  /** Spazi per livello (2, 4) o 'tab'. */
  indent: 2 | 4 | 'tab';
  keepComments: boolean;
}

function openTag(el: Extract<XmlNode, { t: 'el' }>): string {
  const attrs = el.attrs.map((a) => ` ${a.name}=${a.quote}${a.value}${a.quote}`).join('');
  return `<${el.name}${attrs}`;
}

function isBlank(s: string): boolean {
  return !/\S/.test(s);
}

function rawOf(n: XmlNode): string {
  if (n.t === 'text') return n.value;
  if (n.t === 'el') return '';
  return n.raw;
}

/** Contenuto misto: testo non vuoto accanto a elementi, commenti o istruzioni (gli spazi sono significativi). */
function isMixed(el: Extract<XmlNode, { t: 'el' }>): boolean {
  return el.children.some((c) => c.t === 'text' && !isBlank(c.value)) && el.children.some((c) => c.t !== 'text' && c.t !== 'cdata');
}

/** Figli di un contenuto misto in linea: il testo resta identico, compresi i nodi di soli spazi. */
function mixedInline(el: Extract<XmlNode, { t: 'el' }>, o: FormatOptions): string {
  return el.children.map((c) => (c.t === 'text' ? c.value : minifyNode(c, o))).join('');
}

function visibleChildren(el: Extract<XmlNode, { t: 'el' }>, keepComments: boolean): XmlNode[] {
  return el.children.filter((c) => !(c.t === 'text' && isBlank(c.value)) && !(c.t === 'comment' && !keepComments));
}

function printNode(n: XmlNode, depth: number, unit: string, o: FormatOptions, out: string[]): void {
  const pad = unit.repeat(depth);
  if (n.t === 'text') {
    const t = n.value.trim();
    if (t) out.push(pad + t);
    return;
  }
  if (n.t !== 'el') {
    if (n.t === 'comment' && !o.keepComments) return;
    out.push(pad + n.raw);
    return;
  }
  const open = openTag(n);
  if (n.selfClose) {
    out.push(`${pad}${open}/>`);
    return;
  }
  if (n.preserve) {
    out.push(`${pad}${open}>${n.inner}</${n.name}>`);
    return;
  }
  if (isMixed(n)) {
    out.push(`${pad}${open}>${mixedInline(n, o)}</${n.name}>`);
    return;
  }
  const kids = visibleChildren(n, o.keepComments);
  if (kids.length === 0) {
    out.push(`${pad}${open}></${n.name}>`);
    return;
  }
  if (kids.every((c) => c.t === 'text' || c.t === 'cdata')) {
    const inline = kids.map((c) => (c.t === 'text' ? c.value.trim() : rawOf(c))).join('');
    // un testo con a capo resta su più righe, senza toccarne il contenuto
    out.push(`${pad}${open}>${inline}</${n.name}>`);
    return;
  }
  out.push(`${pad}${open}>`);
  for (const c of kids) printNode(c, depth + 1, unit, o, out);
  out.push(`${pad}</${n.name}>`);
}

function minifyNode(n: XmlNode, o: FormatOptions): string {
  if (n.t === 'text') return isBlank(n.value) ? '' : n.value;
  if (n.t === 'comment') return o.keepComments ? n.raw : '';
  if (n.t !== 'el') return n.raw;
  const open = openTag(n);
  if (n.selfClose) return `${open}/>`;
  if (n.preserve) return `${open}>${n.inner}</${n.name}>`;
  const kids = isMixed(n) ? mixedInline(n, o) : n.children.map((c) => minifyNode(c, o)).join('');
  return kids === '' ? `${open}/>` : `${open}>${kids}</${n.name}>`;
}

export function formatNodes(nodes: XmlNode[], opts: FormatOptions): string {
  const unit = opts.indent === 'tab' ? '\t' : ' '.repeat(opts.indent);
  const out: string[] = [];
  for (const n of nodes) printNode(n, 0, unit, opts, out);
  return out.join('\n');
}

export function minifyNodes(nodes: XmlNode[], opts: FormatOptions): string {
  return nodes.map((n) => minifyNode(n, opts)).join('');
}

export type XmlResult = { ok: true; text: string } | { ok: false; error: XmlError };

/** Formatta (a capo e rientri) un XML. */
export function formatXml(src: string, opts: FormatOptions): XmlResult {
  const p = parseXml(normalizeNewlines(src));
  return p.ok ? { ok: true, text: formatNodes(p.nodes, opts) + '\n' } : p;
}

/** Toglie gli spazi inutili tra i tag (e, a richiesta, i commenti). */
export function minifyXml(src: string, opts: FormatOptions): XmlResult {
  const p = parseXml(normalizeNewlines(src));
  return p.ok ? { ok: true, text: minifyNodes(p.nodes, opts) } : p;
}

// ---------- DOMParser: controllo aggiuntivo e conversione in JSON ----------

/**
 * Seconda opinione del parser del browser (nomi non validi, entità non definite…).
 * Restituisce null se il parser non c'è (prerender, test senza DOM) o se non trova errori.
 */
export function domCheck(src: string): XmlError | null {
  if (typeof DOMParser === 'undefined') return null;
  return domError(new DOMParser().parseFromString(normalizeNewlines(src), 'application/xml'));
}

function domError(doc: Document): XmlError | null {
  const bad = doc.getElementsByTagName('parsererror')[0];
  if (!bad) return null;
  const text = (bad.textContent ?? '').trim();
  let line = 1;
  let column = 1;
  let message = text;
  const chrome = /error on line (\d+) at column (\d+):\s*([^\n]*)/i.exec(text);
  const firefox = /Line Number (\d+), Column (\d+)/i.exec(text);
  if (chrome) {
    line = Number(chrome[1]);
    column = Number(chrome[2]);
    message = chrome[3];
  } else if (firefox) {
    line = Number(firefox[1]);
    column = Number(firefox[2]);
    message = text.split('\n')[0].replace(/^XML Parsing Error:\s*/i, '');
  } else {
    message = text.split('\n')[0];
  }
  return { code: 'dom', params: { msg: message.trim() }, line, column };
}

function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

/** Elemento DOM in un valore JSON: attributi come "@nome", testo come "#text", ripetuti in array. */
export function elementToJson(el: Element): unknown {
  const obj: Record<string, unknown> = {};
  for (const a of Array.from(el.attributes)) setOwn(obj, '@' + a.name, a.value);
  let text = '';
  let hasChild = false;
  for (const c of Array.from(el.childNodes)) {
    if (c.nodeType === 1) {
      hasChild = true;
      const child = c as Element;
      const v = elementToJson(child);
      const key = child.nodeName;
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const cur = obj[key];
        if (Array.isArray(cur)) cur.push(v);
        else setOwn(obj, key, [cur, v]);
      } else setOwn(obj, key, v);
    } else if (c.nodeType === 3 || c.nodeType === 4) text += c.nodeValue ?? '';
  }
  const t = text.trim();
  const hasAttr = el.attributes.length > 0;
  if (!hasAttr && !hasChild) return t === '' ? null : t;
  if (t !== '') setOwn(obj, '#text', t);
  return obj;
}

export type JsonResult = { ok: true; text: string } | { ok: false; error: XmlError };

export function xmlToJson(src: string, indent: FormatOptions['indent']): JsonResult {
  const p = parseXml(normalizeNewlines(src));
  if (!p.ok) return p;
  if (typeof DOMParser === 'undefined') {
    return { ok: false, error: { code: 'noDom', params: {}, line: 1, column: 1 } };
  }
  const doc = new DOMParser().parseFromString(normalizeNewlines(src), 'application/xml');
  const bad = domError(doc);
  if (bad) return { ok: false, error: bad };
  const root = doc.documentElement;
  const wrapper: Record<string, unknown> = {};
  setOwn(wrapper, root.nodeName, elementToJson(root));
  return { ok: true, text: JSON.stringify(wrapper, null, indent === 'tab' ? '\t' : indent) + '\n' };
}
