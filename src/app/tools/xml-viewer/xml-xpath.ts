// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { Doc, El, Path, rawNodes, unescapeXml } from './xml-tree';
import type { XmlNode } from '../xml-formatter/xml';

/**
 * Query XPath 1.0 (le fa il browser, `document.evaluate`) e namespace dell'albero XML.
 * I risultati si riportano ai percorsi dell'albero dell'editor per numero d'ordine dell'elemento
 * (l'n-esimo elemento in ordine di documento è lo stesso nel DOM e nel nostro albero).
 */

export interface XpItem {
  label: string;
  /** Percorso del nodo (o dell'elemento che lo contiene, per attributi, testo e commenti). */
  path: Path | null;
}

export type XpResult =
  | { ok: true; kind: 'nodes'; items: XpItem[]; total: number }
  | { ok: true; kind: 'value'; value: string }
  | { ok: false; message: string };

export const XP_MAX = 500;

function elementPaths(doc: Doc): Path[] {
  const out: Path[] = [];
  const walk = (list: readonly XmlNode[], base: Path): void => {
    list.forEach((n, i) => {
      if (n.t !== 'el') return;
      const p = [...base, i];
      out.push(p);
      walk(n.children, p);
    });
  };
  walk(doc, []);
  return out;
}

/** Prefissi dichiarati nel documento (la prima dichiarazione vince); la chiave '' è il namespace predefinito. */
export function namespaceMap(doc: Doc): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (list: readonly XmlNode[]): void => {
    for (const n of list) {
      if (n.t !== 'el') continue;
      for (const a of n.attrs) {
        if (a.name === 'xmlns' && !map.has('')) map.set('', unescapeXml(a.value));
        else if (a.name.startsWith('xmlns:') && !map.has(a.name.slice(6))) map.set(a.name.slice(6), unescapeXml(a.value));
      }
      walk(n.children);
    }
  };
  walk(doc);
  return map;
}

export interface NsInfo {
  prefix: string;
  local: string;
  /** Namespace dell'elemento, o null se non ne ha. */
  uri: string | null;
  /** Dichiarazioni in vigore su questo elemento (prefisso → URI; '' = predefinito). */
  scope: [string, string][];
}

/** Namespace dell'elemento al percorso, secondo le dichiarazioni degli antenati. */
export function resolveNs(doc: Doc, path: Path): NsInfo | null {
  const scope = new Map<string, string>();
  let list: readonly XmlNode[] = doc;
  let el: El | null = null;
  for (const i of path) {
    const n = list[i];
    if (!n || n.t !== 'el') return null;
    el = n;
    for (const a of n.attrs) {
      if (a.name === 'xmlns') scope.set('', unescapeXml(a.value));
      else if (a.name.startsWith('xmlns:')) scope.set(a.name.slice(6), unescapeXml(a.value));
    }
    list = n.children;
  }
  if (!el) return null;
  const c = el.name.indexOf(':');
  const prefix = c === -1 ? '' : el.name.slice(0, c);
  const uri = scope.get(prefix) ?? null;
  return { prefix, local: c === -1 ? el.name : el.name.slice(c + 1), uri: uri === '' ? null : uri, scope: [...scope] };
}

const short = (s: string, n = 80): string => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n) + '…' : one;
};

export function runXpath(doc: Doc, expr: string): XpResult {
  const e = expr.trim();
  if (!e) return { ok: false, message: '' };
  if (typeof DOMParser === 'undefined') return { ok: false, message: 'DOMParser' };
  const dom = new DOMParser().parseFromString(rawNodes(doc), 'application/xml');
  if (dom.getElementsByTagName('parsererror').length > 0) return { ok: false, message: 'parse' };
  const ns = namespaceMap(doc);
  const resolver = (p: string | null): string | null => (p ? (ns.get(p) ?? null) : null);
  try {
    const res = dom.evaluate(e, dom, resolver, XPathResult.ANY_TYPE, null);
    if (res.resultType === XPathResult.NUMBER_TYPE) return { ok: true, kind: 'value', value: String(res.numberValue) };
    if (res.resultType === XPathResult.STRING_TYPE) return { ok: true, kind: 'value', value: res.stringValue };
    if (res.resultType === XPathResult.BOOLEAN_TYPE) return { ok: true, kind: 'value', value: String(res.booleanValue) };
    const paths = elementPaths(doc);
    const order = new Map<Node, number>();
    Array.from(dom.getElementsByTagName('*')).forEach((el, i) => order.set(el, i));
    const pathOf = (n: Node | null): Path | null => {
      for (let x: Node | null = n; x; x = x.parentNode) {
        const i = order.get(x);
        if (i !== undefined) return paths[i] ?? null;
      }
      return null;
    };
    const items: XpItem[] = [];
    let total = 0;
    for (let n = res.iterateNext(); n; n = res.iterateNext()) {
      total++;
      if (items.length >= XP_MAX) continue;
      if (n.nodeType === 2) {
        const a = n as Attr;
        items.push({ label: `@${a.name}="${short(a.value, 60)}"`, path: pathOf(a.ownerElement) });
      } else if (n.nodeType === 1) {
        const el = n as Element;
        const t = short(el.children.length === 0 ? (el.textContent ?? '') : '', 60);
        items.push({ label: `<${el.tagName}>${t ? ' ' + t : ''}`, path: pathOf(el) });
      } else if (n.nodeType === 3 || n.nodeType === 4) items.push({ label: short(n.nodeValue ?? ''), path: pathOf(n.parentNode) });
      else if (n.nodeType === 8) items.push({ label: `<!-- ${short(n.nodeValue ?? '', 60)} -->`, path: pathOf(n.parentNode) });
      else items.push({ label: '/', path: null });
    }
    return { ok: true, kind: 'nodes', items, total };
  } catch (err) {
    return { ok: false, message: (err as Error).message.split('\n')[0] };
  }
}
