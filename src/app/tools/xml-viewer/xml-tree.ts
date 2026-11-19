// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { XmlAttr, XmlNode } from '../xml-formatter/xml';

/**
 * Albero XML per l'editor: sola logica, senza Angular. Il documento è immutabile (`XmlNode[]` del parser):
 * ogni modifica copia solo i nodi lungo il percorso, quindi annulla/ripeti costano poco.
 * Testo e attributi restano "come scritti" (con le entità); i campi di modifica lavorano sul testo decodificato.
 */

export type El = Extract<XmlNode, { t: 'el' }>;
export type Doc = XmlNode[];
/** Indici nei `children` (tutti i figli, anche gli spazi); il primo indice è nel livello superiore del documento. */
export type Path = readonly number[];

export const pathKey = (p: Path): string => p.join('.');

const NAME_RE = /^[\p{L}_:][\p{L}\p{N}_:.\-·]*$/u;
export const isValidName = (s: string): boolean => NAME_RE.test(s);

// ---------- entità ----------

export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(s: string, quote: '"' | "'"): string {
  return escapeText(s).replace(quote === '"' ? /"/g : /'/g, quote === '"' ? '&quot;' : '&apos;');
}

const NAMED: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Decodifica le entità predefinite e quelle numeriche; le altre (dichiarate in un DOCTYPE) restano com'erano. */
export function unescapeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (m, e: string) => {
    if (e[0] !== '#') return NAMED[e] ?? m;
    const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : m;
  });
}

// ---------- scrittura esatta ----------

const isBlank = (s: string): boolean => !/\S/.test(s);
export const isBlankText = (n: XmlNode): boolean => n.t === 'text' && isBlank(n.value);

function openTag(el: El): string {
  return `<${el.name}${el.attrs.map((a) => ` ${a.name}=${a.quote}${a.value}${a.quote}`).join('')}`;
}

/** Riscrive i nodi senza cambiare uno spazio (serve a mantenere `inner` coerente dopo una modifica). */
export function rawNodes(nodes: readonly XmlNode[]): string {
  return nodes
    .map((n) => {
      if (n.t === 'text') return n.value;
      if (n.t !== 'el') return n.raw;
      return n.selfClose ? `${openTag(n)}/>` : `${openTag(n)}>${rawNodes(n.children)}</${n.name}>`;
    })
    .join('');
}

// ---------- accesso ai nodi ----------

export function getNode(doc: Doc, path: Path): XmlNode | null {
  let list: readonly XmlNode[] = doc;
  let node: XmlNode | null = null;
  for (const i of path) {
    node = list[i] ?? null;
    if (!node) return null;
    list = node.t === 'el' ? node.children : [];
  }
  return node;
}

/** Il percorso più vicino che esiste ancora (dopo un'eliminazione o un annulla). */
export function nearestPath(doc: Doc, path: Path): Path {
  let p = path;
  while (p.length > 0 && !getNode(doc, p)) {
    const last = p[p.length - 1];
    p = last > 0 ? [...p.slice(0, -1), last - 1] : p.slice(0, -1);
  }
  return p;
}

/** Figli da mostrare: gli spazi tra i tag non sono righe. */
export function visibleChildren(children: readonly XmlNode[]): { node: XmlNode; index: number }[] {
  const out: { node: XmlNode; index: number }[] = [];
  children.forEach((node, index) => {
    if (!isBlankText(node)) out.push({ node, index });
  });
  return out;
}

/** Testo di un elemento che contiene solo testo/CDATA (decodificato), altrimenti null. Vuoto se non ha figli. */
export function inlineText(el: El): string | null {
  const kids = visibleChildren(el.children);
  if (!kids.every((k) => k.node.t === 'text' || k.node.t === 'cdata')) return null;
  return kids.map((k) => (k.node.t === 'text' ? unescapeXml(k.node.value) : cdataBody(k.node as { raw: string }))).join('').trim();
}

const cdataBody = (n: { raw: string }): string => n.raw.slice(9, -3);
const commentBody = (n: { raw: string }): string => n.raw.slice(4, -3);

/** Contenuto modificabile del nodo, o null se non lo è (doctype, istruzioni, elementi con figli). */
export function editableText(n: XmlNode): string | null {
  if (n.t === 'text') return unescapeXml(n.value);
  if (n.t === 'comment') return commentBody(n);
  if (n.t === 'cdata') return cdataBody(n);
  if (n.t === 'el') {
    if (!n.children.every((c) => c.t === 'text' || c.t === 'cdata')) return null;
    return n.children.map((c) => (c.t === 'text' ? unescapeXml(c.value) : cdataBody(c as { raw: string }))).join('');
  }
  return null;
}

// ---------- XPath e briciole ----------

function sameKind(a: XmlNode, b: XmlNode): boolean {
  if (a.t === 'el') return b.t === 'el' && b.name === a.name;
  if (a.t === 'text' || a.t === 'cdata') return b.t === 'text' || b.t === 'cdata';
  return a.t === b.t;
}

function step(list: readonly XmlNode[], index: number): string {
  const n = list[index];
  const peers = list.filter((x) => sameKind(n, x) && !isBlankText(x));
  const k = peers.indexOf(n) + 1;
  const base = n.t === 'el' ? n.name : n.t === 'comment' ? 'comment()' : n.t === 'pi' ? 'processing-instruction()' : n.t === 'doctype' ? '' : 'text()';
  return base + (peers.length > 1 ? `[${k}]` : '');
}

/** XPath assoluto del nodo (indice solo dove serve a distinguere fratelli con lo stesso nome). */
export function xpathOf(doc: Doc, path: Path): string {
  if (path.length === 0) return '/';
  let list: readonly XmlNode[] = doc;
  const parts: string[] = [];
  for (const i of path) {
    const n = list[i];
    if (!n) break;
    parts.push(step(list, i));
    list = n.t === 'el' ? n.children : [];
  }
  return '/' + parts.join('/');
}

export function breadcrumbs(doc: Doc, path: Path): { path: Path; label: string }[] {
  const out: { path: Path; label: string }[] = [];
  let list: readonly XmlNode[] = doc;
  for (let d = 0; d < path.length; d++) {
    const n = list[path[d]];
    if (!n) break;
    out.push({ path: path.slice(0, d + 1), label: n.t === 'el' ? n.name : n.t });
    list = n.t === 'el' ? n.children : [];
  }
  return out;
}

// ---------- modifica ----------

export type EditError = 'notfound' | 'invalid' | 'duplicate' | 'root' | 'type';
export type EditResult = { ok: true; doc: Doc; path: Path } | { ok: false; error: EditError };
const fail = (error: EditError): EditResult => ({ ok: false, error });

function rebuild(el: El, patch: Partial<El>): El {
  const e: El = { ...el, ...patch };
  if (e.children.length > 0) e.selfClose = false;
  e.inner = rawNodes(e.children);
  return e;
}

/** Sostituisce i figli del contenitore al percorso (la radice del documento se vuoto), rinfrescando gli antenati. */
function withChildren(doc: Doc, containerPath: Path, fn: (kids: XmlNode[]) => XmlNode[] | null): Doc | null {
  if (containerPath.length === 0) return fn(doc);
  const [h, ...rest] = containerPath;
  const n = doc[h];
  if (!n || n.t !== 'el') return null;
  const kids = withChildren(n.children, rest, fn);
  if (!kids) return null;
  const copy = doc.slice();
  copy[h] = rebuild(n, { children: kids });
  return copy;
}

function replaceNode(doc: Doc, path: Path, fn: (n: XmlNode) => XmlNode | null): Doc | null {
  if (path.length === 0) return null;
  const i = path[path.length - 1];
  return withChildren(doc, path.slice(0, -1), (kids) => {
    if (!kids[i]) return null;
    const next = fn(kids[i]);
    if (!next) return null;
    const copy = kids.slice();
    copy[i] = next;
    return copy;
  });
}

const done = (doc: Doc | null, path: Path): EditResult => (doc ? { ok: true, doc, path } : fail('notfound'));

export function renameElement(doc: Doc, path: Path, name: string): EditResult {
  const n = getNode(doc, path);
  if (!n) return fail('notfound');
  if (n.t !== 'el') return fail('type');
  if (!isValidName(name)) return fail('invalid');
  return done(replaceNode(doc, path, (x) => rebuild(x as El, { name })), path);
}

/** Cambia il valore di un attributo (`index` valido) o ne aggiunge uno (`index` = -1). Il valore è testo semplice. */
export function setAttr(doc: Doc, path: Path, index: number, name: string, value: string): EditResult {
  const n = getNode(doc, path);
  if (!n) return fail('notfound');
  if (n.t !== 'el') return fail('type');
  if (!isValidName(name)) return fail('invalid');
  if (index >= n.attrs.length || index < -1) return fail('notfound');
  if (n.attrs.some((a, i) => a.name === name && i !== index)) return fail('duplicate');
  const quote = index === -1 ? '"' : n.attrs[index].quote;
  const attr: XmlAttr = { name, quote, value: escapeAttr(value, quote) };
  const attrs = index === -1 ? [...n.attrs, attr] : n.attrs.map((a, i) => (i === index ? attr : a));
  return done(replaceNode(doc, path, (x) => rebuild(x as El, { attrs })), path);
}

export function removeAttr(doc: Doc, path: Path, index: number): EditResult {
  const n = getNode(doc, path);
  if (!n) return fail('notfound');
  if (n.t !== 'el') return fail('type');
  if (index < 0 || index >= n.attrs.length) return fail('notfound');
  return done(replaceNode(doc, path, (x) => rebuild(x as El, { attrs: (x as El).attrs.filter((_, i) => i !== index) })), path);
}

/** Cambia il testo di un nodo di testo, commento o CDATA, o il contenuto di un elemento che ha solo testo. */
export function setText(doc: Doc, path: Path, value: string): EditResult {
  const n = getNode(doc, path);
  if (!n) return fail('notfound');
  if (editableText(n) === null) return fail('type');
  if (n.t === 'comment' && (value.includes('--') || value.endsWith('-'))) return fail('invalid');
  if (n.t === 'cdata' && value.includes(']]>')) return fail('invalid');
  const next = (x: XmlNode): XmlNode => {
    if (x.t === 'text') return { t: 'text', value: escapeText(value) };
    if (x.t === 'comment') return { t: 'comment', raw: `<!--${value}-->` };
    if (x.t === 'cdata') return { t: 'cdata', raw: `<![CDATA[${value}]]>` };
    const el = x as El;
    return rebuild(el, { children: value === '' ? [] : [{ t: 'text', value: escapeText(value) }], selfClose: value === '' });
  };
  return done(replaceNode(doc, path, next), path);
}

export type NewKind = 'el' | 'text' | 'comment';

/** Aggiunge in coda a un elemento un figlio nuovo e ne restituisce il percorso. */
export function addChild(doc: Doc, parentPath: Path, kind: NewKind, name = 'elemento'): EditResult {
  const parent = getNode(doc, parentPath);
  if (!parent) return fail('notfound');
  if (parent.t !== 'el') return fail('type');
  if (kind === 'el' && !isValidName(name)) return fail('invalid');
  const node: XmlNode =
    kind === 'el'
      ? { t: 'el', name, attrs: [], selfClose: true, children: [], preserve: parent.preserve, inner: '' }
      : kind === 'text'
        ? { t: 'text', value: 'testo' }
        : { t: 'comment', raw: '<!-- commento -->' };
  const at = parent.children.length;
  return done(replaceNode(doc, parentPath, (x) => rebuild(x as El, { children: [...(x as El).children, node] })), [...parentPath, at]);
}

export function removeNode(doc: Doc, path: Path): EditResult {
  const n = getNode(doc, path);
  if (!n) return fail('notfound');
  if (n.t === 'el' && path.length === 1) return fail('root');
  const i = path[path.length - 1];
  const out = withChildren(doc, path.slice(0, -1), (k) => k.filter((_, j) => j !== i));
  return done(out, out ? nearestPath(out, path) : path);
}

export function duplicateNode(doc: Doc, path: Path): EditResult {
  const n = getNode(doc, path);
  if (!n) return fail('notfound');
  if (path.length === 1 && (n.t === 'el' || n.t === 'doctype')) return fail('root');
  const i = path[path.length - 1];
  const out = withChildren(doc, path.slice(0, -1), (k) => [...k.slice(0, i + 1), k[i], ...k.slice(i + 1)]);
  return done(out, [...path.slice(0, -1), i + 1]);
}

/** Sposta il nodo prima (-1) o dopo (+1) del fratello visibile più vicino. */
export function moveNode(doc: Doc, path: Path, dir: -1 | 1): EditResult {
  const n = getNode(doc, path);
  if (!n) return fail('notfound');
  if (n.t === 'doctype') return fail('type');
  const i = path[path.length - 1];
  const parent = path.slice(0, -1);
  const sibs = parent.length === 0 ? doc : (getNode(doc, parent) as El).children;
  let j = i + dir;
  while (sibs[j] && isBlankText(sibs[j])) j += dir;
  if (!sibs[j]) return fail('notfound');
  if (sibs[j].t === 'doctype') return fail('type');
  const out = withChildren(doc, parent, (k) => {
    const c = k.slice();
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  });
  return done(out, [...parent, j]);
}

// ---------- albero visibile ----------

export interface Row {
  path: Path;
  key: string;
  depth: number;
  node: XmlNode;
  /** Ha figli da aprire (elementi, commenti, testo misto). */
  expandable: boolean;
  expanded: boolean;
  /** Numero di figli visibili. */
  count: number;
  /** Elemento che contiene solo testo: lo si mostra sulla stessa riga. */
  text: string | null;
}

export const MAX_ROWS = 4000;

export function flatten(doc: Doc, expanded: ReadonlySet<string>): { rows: Row[]; truncated: boolean } {
  const rows: Row[] = [];
  let truncated = false;
  const walk = (list: readonly XmlNode[], base: Path, depth: number): void => {
    for (const { node, index } of visibleChildren(list)) {
      if (rows.length >= MAX_ROWS) {
        truncated = true;
        return;
      }
      const path = [...base, index];
      const key = pathKey(path);
      const text = node.t === 'el' ? inlineText(node) : null;
      const count = node.t === 'el' && text === null ? visibleChildren(node.children).length : 0;
      const open = count > 0 && expanded.has(key);
      rows.push({ path, key, depth, node, expandable: count > 0, expanded: open, count, text });
      if (open && node.t === 'el') walk(node.children, path, depth + 1);
    }
  };
  walk(doc, [], 0);
  return { rows, truncated };
}

/** Chiavi degli elementi da aprire per mostrare `levels` livelli. */
export function expandLevels(doc: Doc, levels: number): Set<string> {
  const out = new Set<string>();
  const walk = (list: readonly XmlNode[], base: Path, depth: number): void => {
    if (depth >= levels) return;
    for (const { node, index } of visibleChildren(list)) {
      if (node.t !== 'el' || inlineText(node) !== null) continue;
      const path = [...base, index];
      out.add(pathKey(path));
      walk(node.children, path, depth + 1);
    }
  };
  walk(doc, [], 0);
  return out;
}

/** Aggiunge agli aperti tutti gli antenati del percorso, perché la riga sia visibile. */
export function reveal(expanded: ReadonlySet<string>, path: Path): Set<string> {
  const out = new Set(expanded);
  for (let d = 1; d < path.length; d++) out.add(pathKey(path.slice(0, d)));
  return out;
}

// ---------- ricerca e statistiche ----------

/** Percorsi dei nodi che contengono `query` (nome, attributi, testo), in ordine di documento, senza maiuscole. */
export function searchDoc(doc: Doc, query: string): Path[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: Path[] = [];
  const has = (s: string): boolean => s.toLowerCase().includes(q);
  const walk = (list: readonly XmlNode[], base: Path): void => {
    for (const { node, index } of visibleChildren(list)) {
      const path = [...base, index];
      if (node.t === 'el') {
        const text = inlineText(node);
        if (has(node.name) || node.attrs.some((a) => has(a.name) || has(unescapeXml(a.value))) || (text !== null && has(text))) out.push(path);
        if (text === null) walk(node.children, path);
      } else if (node.t === 'text') {
        if (has(unescapeXml(node.value))) out.push(path);
      } else if (has(node.raw)) out.push(path);
    }
  };
  walk(doc, []);
  return out;
}

export interface XmlStats {
  elements: number;
  attributes: number;
  depth: number;
}

export function xmlStats(doc: Doc): XmlStats {
  const s: XmlStats = { elements: 0, attributes: 0, depth: 0 };
  const walk = (list: readonly XmlNode[], depth: number): void => {
    for (const n of list) {
      if (n.t !== 'el') continue;
      s.elements++;
      s.attributes += n.attrs.length;
      s.depth = Math.max(s.depth, depth);
      walk(n.children, depth + 1);
    }
  };
  walk(doc, 1);
  return s;
}
