// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Albero DOM di un documento HTML (analizzato con `DOMParser`, che non esegue script né carica risorse) e
 * query CSS e XPath 1.0 sui suoi nodi. Logica senza Angular: lavora sui nodi del DOM.
 */
export const MAX_ROWS = 4000;
export const MAX_RESULTS = 500;
export const DEFAULT_OPEN_DEPTH = 3;

export type RowKind = 'el' | 'text' | 'comment' | 'doctype';

export interface DomRow {
  /** Posizione del nodo in ordine di documento (stabile per un documento). */
  id: number;
  depth: number;
  kind: RowKind;
  node: Node;
  /** Nome del tag, testo breve o commento. */
  label: string;
  /** Attributi mostrati accanto al tag (già in forma `id="x"`), al massimo i primi. */
  attrs: string[];
  hasChildren: boolean;
  open: boolean;
}

export function parseHtml(text: string): Document {
  return new DOMParser().parseFromString(text.replace(/^﻿/, ''), 'text/html');
}

/** Numerazione in ordine di documento di tutti i nodi significativi (esclusi i testi fatti solo di spazi). */
export function numberNodes(doc: Document): Map<Node, number> {
  const ids = new Map<Node, number>();
  const walk = (n: Node): void => {
    if (!isShown(n)) return;
    ids.set(n, ids.size);
    n.childNodes.forEach(walk);
  };
  doc.childNodes.forEach(walk);
  return ids;
}

export function isShown(n: Node): boolean {
  if (n.nodeType === 3) return (n.nodeValue ?? '').trim() !== '';
  return n.nodeType === 1 || n.nodeType === 8 || n.nodeType === 10;
}

const short = (s: string, n: number): string => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n) + '…' : one;
};

/** Id dei nodi aperti all'inizio: gli elementi fino alla profondità indicata. */
export function defaultOpen(doc: Document, depth = DEFAULT_OPEN_DEPTH): Set<number> {
  const ids = numberNodes(doc);
  const open = new Set<number>();
  const walk = (n: Node, d: number): void => {
    if (n.nodeType === 1 && d < depth) open.add(ids.get(n)!);
    if (d < depth) n.childNodes.forEach((c) => isShown(c) && walk(c, d + 1));
  };
  doc.childNodes.forEach((c) => isShown(c) && walk(c, 0));
  return open;
}

/** Righe visibili dell'albero (nodi aperti), al massimo `max`; `truncated` dice se ce ne sono altre. */
export function buildRows(doc: Document, open: ReadonlySet<number>, max = MAX_ROWS): { rows: DomRow[]; truncated: boolean; total: number } {
  const ids = numberNodes(doc);
  const rows: DomRow[] = [];
  let truncated = false;
  const walk = (n: Node, depth: number): void => {
    if (!isShown(n)) return;
    if (rows.length >= max) {
      truncated = true;
      return;
    }
    const id = ids.get(n)!;
    const kids = Array.from(n.childNodes).filter(isShown);
    const isEl = n.nodeType === 1;
    const kind: RowKind = isEl ? 'el' : n.nodeType === 3 ? 'text' : n.nodeType === 8 ? 'comment' : 'doctype';
    const hasChildren = kids.length > 0;
    const isOpen = hasChildren && open.has(id);
    rows.push({
      id,
      depth,
      kind,
      node: n,
      label: isEl ? (n as Element).localName : kind === 'doctype' ? `<!DOCTYPE ${(n as DocumentType).name}>` : short(n.nodeValue ?? '', 120),
      attrs: isEl ? Array.from((n as Element).attributes).slice(0, 4).map((a) => `${a.name}="${short(a.value, 40)}"`) : [],
      hasChildren,
      open: isOpen,
    });
    if (isOpen) kids.forEach((k) => walk(k, depth + 1));
  };
  doc.childNodes.forEach((c) => walk(c, 0));
  return { rows, truncated, total: ids.size };
}

/** Id da aprire perché il nodo sia visibile (tutti i suoi antenati). */
export function ancestorsOf(doc: Document, node: Node): number[] {
  const ids = numberNodes(doc);
  const out: number[] = [];
  for (let p = node.parentNode; p; p = p.parentNode) {
    const id = ids.get(p);
    if (id !== undefined) out.push(id);
  }
  return out;
}

const cssEscape = (s: string): string => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/([^\w-])/g, '\\$1'));

/** Selettore CSS che individua l'elemento (con #id se unico, altrimenti tag:nth-child dalla radice). */
export function cssPathOf(el: Element): string {
  const parts: string[] = [];
  for (let n: Element | null = el; n && n.nodeType === 1; n = n.parentElement) {
    const id = n.getAttribute('id');
    if (id && n.ownerDocument.querySelectorAll('#' + cssEscape(id)).length === 1) {
      parts.unshift('#' + cssEscape(id));
      break;
    }
    const tag = n.localName;
    if (!n.parentElement) {
      parts.unshift(tag);
      break;
    }
    const same = Array.from(n.parentElement.children).filter((c) => c.localName === tag);
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(n) + 1})` : tag);
  }
  return parts.join(' > ');
}

/** Percorso XPath (`/html/body/div[2]/p`) di un nodo. */
export function xpathOfNode(n: Node): string {
  if (n.nodeType === 9) return '/';
  const parts: string[] = [];
  for (let x: Node | null = n; x && x.nodeType !== 9; x = x.parentNode) {
    if (x.nodeType === 2) {
      parts.unshift('@' + (x as Attr).name);
      continue;
    }
    const sibs = Array.from(x.parentNode?.childNodes ?? []).filter((s) => s.nodeType === x!.nodeType && (x!.nodeType !== 1 || (s as Element).localName === (x as Element).localName));
    const idx = sibs.indexOf(x as ChildNode) + 1;
    const name = x.nodeType === 1 ? (x as Element).localName : x.nodeType === 3 ? 'text()' : x.nodeType === 8 ? 'comment()' : 'node()';
    parts.unshift(sibs.length > 1 ? `${name}[${idx}]` : name);
  }
  return '/' + parts.join('/');
}

export type QueryMode = 'css' | 'xpath';
export interface QueryHit {
  node: Node;
  label: string;
}
export type QueryResult =
  | { ok: true; kind: 'nodes'; hits: QueryHit[]; total: number }
  | { ok: true; kind: 'value'; value: string }
  | { ok: false; message: string };

function labelOf(n: Node): string {
  if (n.nodeType === 1) {
    const el = n as Element;
    const id = el.getAttribute('id');
    const cls = el.getAttribute('class');
    return `<${el.localName}${id ? '#' + id : ''}${cls ? '.' + cls.trim().split(/\s+/).join('.') : ''}>` + (el.children.length === 0 && el.textContent?.trim() ? ' ' + short(el.textContent, 50) : '');
  }
  if (n.nodeType === 2) return `@${(n as Attr).name}="${short((n as Attr).value, 50)}"`;
  if (n.nodeType === 8) return `<!-- ${short(n.nodeValue ?? '', 50)} -->`;
  return short(n.nodeValue ?? '', 60);
}

/** Esegue una query CSS (`querySelectorAll`) o XPath 1.0 (`document.evaluate`) sul documento. */
export function runQuery(doc: Document, mode: QueryMode, expr: string): QueryResult {
  const e = expr.trim();
  if (!e) return { ok: false, message: '' };
  try {
    if (mode === 'css') {
      const list = Array.from(doc.querySelectorAll(e));
      return { ok: true, kind: 'nodes', total: list.length, hits: list.slice(0, MAX_RESULTS).map((n) => ({ node: n, label: labelOf(n) })) };
    }
    const res = doc.evaluate(e, doc, null, XPathResult.ANY_TYPE, null);
    if (res.resultType === XPathResult.NUMBER_TYPE) return { ok: true, kind: 'value', value: String(res.numberValue) };
    if (res.resultType === XPathResult.STRING_TYPE) return { ok: true, kind: 'value', value: res.stringValue };
    if (res.resultType === XPathResult.BOOLEAN_TYPE) return { ok: true, kind: 'value', value: String(res.booleanValue) };
    const hits: QueryHit[] = [];
    let total = 0;
    for (let n = res.iterateNext(); n; n = res.iterateNext()) {
      total++;
      if (hits.length < MAX_RESULTS) hits.push({ node: n, label: labelOf(n) });
    }
    return { ok: true, kind: 'nodes', hits, total };
  } catch (err) {
    return { ok: false, message: (err as Error).message.split('\n')[0] };
  }
}

/** Il nodo da evidenziare nell'albero: gli attributi non hanno una riga, si usa il loro elemento. */
export const treeNodeOf = (n: Node): Node => (n.nodeType === 2 ? ((n as Attr).ownerElement ?? n) : n);

export interface DomStats {
  elements: number;
  attributes: number;
  depth: number;
  ids: number;
}

export function domStats(doc: Document): DomStats {
  let elements = 0;
  let attributes = 0;
  let depth = 0;
  let ids = 0;
  const walk = (n: Node, d: number): void => {
    if (n.nodeType === 1) {
      elements++;
      attributes += (n as Element).attributes.length;
      if ((n as Element).hasAttribute('id')) ids++;
      depth = Math.max(depth, d);
    }
    n.childNodes.forEach((c) => walk(c, d + 1));
  };
  doc.childNodes.forEach((c) => walk(c, 1));
  return { elements, attributes, depth, ids };
}
