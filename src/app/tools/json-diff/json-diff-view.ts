// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeKind, DiffNode, Difference, NodeStatus, escapePointerToken, formatValue } from './json-diff';

/** Riga dell'albero unito (già "appiattita", pronta per il template). */
export interface TreeRow {
  /** Identificativo stabile (JSON Pointer, con suffisso per le righe speciali). */
  id: string;
  depth: number;
  label: string;
  status: NodeStatus;
  /** Parentesi del contenitore (oggetto o array), se la riga ne apre uno. */
  open?: '{' | '[';
  /** Valore (foglia uguale, aggiunta o rimozione). */
  text?: string;
  /** Valori prima e dopo (modificato o tipo cambiato). */
  oldText?: string;
  newText?: string;
  /** Indice della differenza (stesso ordine dell'elenco), -1 se la riga non è una differenza. */
  group: number;
  /** Riga che raccoglie `count` nodi invariati: il clic li mostra. */
  fold?: { count: number };
  /** Percorso escluso dal confronto. */
  ignored?: boolean;
}

export interface FlattenOptions {
  /** Raccoglie i rami invariati in righe "n invariati". */
  hideSame: boolean;
  /** Identificativi delle righe raccolte che l'utente ha aperto. */
  expanded: ReadonlySet<string>;
  /** Tetto alle righe prodotte (un ramo invariato enorme aperto non deve bloccare la pagina). */
  maxRows?: number;
}

const isContainer = (v: unknown): v is object => v !== null && typeof v === 'object';

/** Albero unito → righe, in ordine di lettura; le differenze hanno `group` crescente come nell'elenco. */
export function flattenTree(root: DiffNode, opts: FlattenOptions): { rows: TreeRow[]; truncated: boolean } {
  const max = opts.maxRows ?? 20000;
  const rows: TreeRow[] = [];
  let group = 0;
  let truncated = false;
  const push = (r: TreeRow): boolean => {
    if (rows.length >= max) {
      truncated = true;
      return false;
    }
    rows.push(r);
    return true;
  };

  /** Un valore invariato (con il suo sottoalbero) come righe. */
  const emitValue = (v: unknown, label: string, id: string, depth: number, ignored?: boolean): void => {
    if (!isContainer(v)) {
      push({ id, depth, label, status: 'same', text: formatValue(v), group: -1, ignored });
      return;
    }
    const arr = Array.isArray(v);
    if (!push({ id, depth, label, status: 'same', open: arr ? '[' : '{', group: -1, ignored })) return;
    if (arr) (v as unknown[]).forEach((x, i) => emitValue(x, `[${i}]`, `${id}/${i}`, depth + 1));
    else for (const k of Object.keys(v)) emitValue((v as Record<string, unknown>)[k], k, `${id}/${escapePointerToken(k)}`, depth + 1);
  };

  const emit = (n: DiffNode, depth: number): void => {
    if (truncated) return;
    const label = n.label === '' ? '' : n.label;
    switch (n.status) {
      case 'nested':
        if (push({ id: n.pointer, depth, label, status: 'nested', open: n.container === 'array' ? '[' : '{', group: -1 })) emitChildren(n.children ?? [], depth + 1);
        break;
      case 'same':
        emitValue(n.a ?? n.b, label, n.pointer, depth, n.ignored);
        break;
      case 'added':
        push({ id: n.pointer, depth, label, status: 'added', text: formatValue(n.b), group: group++ });
        break;
      case 'removed':
        push({ id: n.pointer, depth, label, status: 'removed', text: formatValue(n.a), group: group++ });
        break;
      default:
        push({ id: n.pointer, depth, label, status: n.status, oldText: formatValue(n.a), newText: formatValue(n.b), group: group++ });
    }
  };

  const emitChildren = (children: readonly DiffNode[], depth: number): void => {
    for (let i = 0; i < children.length && !truncated; ) {
      if (children[i].status !== 'same') {
        emit(children[i], depth);
        i++;
        continue;
      }
      let j = i;
      while (j < children.length && children[j].status === 'same') j++;
      const id = children[i].pointer + '#fold';
      if (opts.hideSame && !opts.expanded.has(id)) push({ id, depth, label: '', status: 'same', fold: { count: j - i }, group: -1 });
      else for (let k = i; k < j; k++) emit(children[k], depth);
      i = j;
    }
  };

  emit(root, 0);
  return { rows, truncated };
}

/** Differenze con il tipo fra quelli attivi. */
export function filterDifferences(diffs: readonly Difference[], active: ReadonlySet<ChangeKind>): Difference[] {
  return diffs.filter((d) => active.has(d.kind));
}
