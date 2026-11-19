// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { Op, diffSequences } from './myers';

/** Confronto di due testi per righe, con differenze per parola o carattere dentro le righe cambiate, e unified diff. */

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  ignoreBlank: boolean;
  /** Dettaglio dentro le righe cambiate. */
  granularity: 'word' | 'char';
}

export const DEFAULT_OPTIONS: DiffOptions = { ignoreWhitespace: false, ignoreCase: false, ignoreBlank: false, granularity: 'word' };

/** Pezzo di riga: `changed` = parte diversa dall'altro lato. */
export interface Seg {
  text: string;
  changed: boolean;
}

export type RowKind = 'eq' | 'del' | 'ins' | 'mod';

/** Riga della vista affiancata: a sinistra il testo A, a destra il B. `mod` = riga cambiata (presente da entrambe le parti). */
export interface Row {
  kind: RowKind;
  /** Numeri di riga (1-based) nel testo originale; assenti se la riga non esiste da quel lato. */
  aNo?: number;
  bNo?: number;
  a?: string;
  b?: string;
  /** Pezzi evidenziati (solo per `mod`, se le righe sono abbastanza simili). */
  aSegs?: Seg[];
  bSegs?: Seg[];
  /** Indice del gruppo di modifiche (0-based) o -1 per le righe uguali. */
  group: number;
}

export interface DiffStats {
  /** Righe aggiunte: nuove più quelle modificate (come nel conteggio "+" di git). */
  added: number;
  /** Righe rimosse: cancellate più quelle modificate (conteggio "-"). */
  removed: number;
  /** Righe presenti da entrambe le parti ma modificate (già comprese in added e removed). */
  modified: number;
  /** Numero di gruppi di modifiche (blocchi contigui). */
  groups: number;
  identical: boolean;
}

export interface DiffModel {
  rows: Row[];
  stats: DiffStats;
  /** Righe dei due testi (dopo l'eventuale scarto delle righe vuote), per l'esportazione. */
  aLines: string[];
  bLines: string[];
  /** Ops per riga, per l'esportazione unified. */
  ops: Op[];
}

/** Divide in righe ("\r\n", "\n" e "\r"); un a capo finale non crea una riga vuota in più. */
export function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split(/\r\n|\n|\r/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Forma usata per il confronto: spazi ridotti, maiuscole ignorate secondo le opzioni. */
export function normalizeLine(line: string, o: DiffOptions): string {
  let s = line;
  if (o.ignoreWhitespace) s = s.trim().replace(/\s+/g, ' ');
  if (o.ignoreCase) s = s.toLowerCase();
  return s;
}

/** Interna le stringhe in id interi (stesso testo = stesso id). */
function intern(lists: string[][]): Int32Array[] {
  const ids = new Map<string, number>();
  return lists.map((l) => {
    const out = new Int32Array(l.length);
    l.forEach((s, i) => {
      let id = ids.get(s);
      if (id === undefined) {
        id = ids.size;
        ids.set(s, id);
      }
      out[i] = id;
    });
    return out;
  });
}

/** Pezzi di una riga: parole, spazi e simboli (o i singoli caratteri). */
export function tokenize(line: string, granularity: 'word' | 'char'): string[] {
  if (granularity === 'char') return Array.from(line);
  return line.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
}

/** Sotto questa quota di testo in comune le due righe sono considerate "diverse": nessuna evidenziazione interna. */
const MIN_SIMILARITY = 0.3;
const MAX_INLINE_TOKENS = 4000;

/** Differenze dentro una coppia di righe cambiate: pezzi per il lato A e per il lato B. */
export function inlineDiff(a: string, b: string, o: DiffOptions): { aSegs: Seg[]; bSegs: Seg[] } | null {
  const ta = tokenize(a, o.granularity);
  const tb = tokenize(b, o.granularity);
  if (ta.length > MAX_INLINE_TOKENS || tb.length > MAX_INLINE_TOKENS) return null;
  const na = ta.map((t) => normalizeLine(t, { ...o, ignoreWhitespace: false }));
  const nb = tb.map((t) => normalizeLine(t, { ...o, ignoreWhitespace: false }));
  const [ia, ib] = intern([na, nb]);
  const ops = diffSequences(ia, ib);
  const sa: Seg[] = [];
  const sb: Seg[] = [];
  let common = 0;
  const add = (list: Seg[], text: string, changed: boolean) => {
    if (!text) return;
    const last = list[list.length - 1];
    if (last && last.changed === changed) last.text += text;
    else list.push({ text, changed });
  };
  for (const op of ops) {
    if (op.type === 'eq') {
      const t = ta.slice(op.a, op.a + op.len).join('');
      common += t.length;
      add(sa, t, false);
      add(sb, tb.slice(op.b, op.b + op.len).join(''), false);
    } else if (op.type === 'del') add(sa, ta.slice(op.a, op.a + op.len).join(''), true);
    else add(sb, tb.slice(op.b, op.b + op.len).join(''), true);
  }
  const longest = Math.max(a.length, b.length);
  if (longest > 0 && common / longest < MIN_SIMILARITY) return null;
  return { aSegs: sa, bSegs: sb };
}

/** Confronta due testi riga per riga. */
export function computeDiff(textA: string, textB: string, o: DiffOptions = DEFAULT_OPTIONS): DiffModel {
  const aAll = splitLines(textA);
  const bAll = splitLines(textB);
  const aNos: number[] = [];
  const bNos: number[] = [];
  const keep = (lines: string[], nos: number[]): string[] => {
    const out: string[] = [];
    lines.forEach((l, i) => {
      if (o.ignoreBlank && l.trim() === '') return;
      out.push(l);
      nos.push(i + 1);
    });
    return out;
  };
  const aLines = keep(aAll, aNos);
  const bLines = keep(bAll, bNos);
  const [ia, ib] = intern([aLines.map((l) => normalizeLine(l, o)), bLines.map((l) => normalizeLine(l, o))]);
  const ops = diffSequences(ia, ib);

  const rows: Row[] = [];
  let group = -1;
  let added = 0;
  let removed = 0;
  let modified = 0;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op.type === 'eq') {
      for (let k = 0; k < op.len; k++) {
        // con le opzioni "ignora" le righe uguali possono differire nel testo: si mostra quello di A a sinistra e di B a destra
        rows.push({ kind: 'eq', aNo: aNos[op.a + k], bNo: bNos[op.b + k], a: aLines[op.a + k], b: bLines[op.b + k], group: -1 });
      }
      continue;
    }
    // un blocco di modifiche: cancellazioni seguite (di solito) da inserimenti
    let dels = 0;
    let delStart = op.a;
    let insLen = 0;
    let insStart = op.b;
    if (op.type === 'del') {
      dels = op.len;
      const next = ops[i + 1];
      if (next && next.type === 'ins') {
        insLen = next.len;
        insStart = next.b;
        i++;
      } else insStart = op.b;
    } else {
      insLen = op.len;
      delStart = op.a;
    }
    group++;
    const paired = Math.min(dels, insLen);
    for (let k = 0; k < Math.max(dels, insLen); k++) {
      const hasA = k < dels;
      const hasB = k < insLen;
      const a = hasA ? aLines[delStart + k] : undefined;
      const b = hasB ? bLines[insStart + k] : undefined;
      const row: Row = {
        kind: hasA && hasB ? 'mod' : hasA ? 'del' : 'ins',
        aNo: hasA ? aNos[delStart + k] : undefined,
        bNo: hasB ? bNos[insStart + k] : undefined,
        a,
        b,
        group,
      };
      if (hasA && hasB && k < paired) {
        const inl = inlineDiff(a as string, b as string, o);
        if (inl) {
          row.aSegs = inl.aSegs;
          row.bSegs = inl.bSegs;
        }
        modified++;
        added++;
        removed++;
      } else if (hasA) removed++;
      else added++;
      rows.push(row);
    }
  }
  const groups = group + 1;
  return {
    rows,
    stats: { added, removed, modified, groups, identical: groups === 0 },
    aLines,
    bLines,
    ops,
  };
}

// ---- Unified diff ----

/** Unified diff (formato di `diff -u`, con 3 righe di contesto) dai due testi già confrontati. */
export function toUnifiedDiff(model: DiffModel, nameA = 'a/originale', nameB = 'b/modificato', context = 3): string {
  const { ops, aLines, bLines } = model;
  if (ops.every((o) => o.type === 'eq')) return '';
  // righe del copione: [tipo, testo, indice A, indice B]
  type L = { t: ' ' | '-' | '+'; text: string; a: number; b: number };
  const lines: L[] = [];
  for (const op of ops) {
    for (let k = 0; k < op.len; k++) {
      if (op.type === 'eq') lines.push({ t: ' ', text: aLines[op.a + k], a: op.a + k, b: op.b + k });
      else if (op.type === 'del') lines.push({ t: '-', text: aLines[op.a + k], a: op.a + k, b: op.b });
      else lines.push({ t: '+', text: bLines[op.b + k], a: op.a, b: op.b + k });
    }
  }
  const changeIdx: number[] = [];
  lines.forEach((l, i) => l.t !== ' ' && changeIdx.push(i));
  // unisce i cambiamenti le cui finestre di contesto si toccano
  const hunks: [number, number][] = [];
  for (const ci of changeIdx) {
    const lo = Math.max(0, ci - context);
    const hi = Math.min(lines.length - 1, ci + context);
    const last = hunks[hunks.length - 1];
    if (last && lo <= last[1] + 1) last[1] = Math.max(last[1], hi);
    else hunks.push([lo, hi]);
  }
  const out = [`--- ${nameA}`, `+++ ${nameB}`];
  for (const [lo, hi] of hunks) {
    const slice = lines.slice(lo, hi + 1);
    const aCount = slice.filter((l) => l.t !== '+').length;
    const bCount = slice.filter((l) => l.t !== '-').length;
    const first = slice[0];
    // con zero righe da un lato la numerazione punta alla riga precedente (convenzione di diff)
    const aStart = aCount === 0 ? first.a : first.a + 1;
    const bStart = bCount === 0 ? first.b : first.b + 1;
    out.push(`@@ -${aStart}${aCount === 1 ? '' : ',' + aCount} +${bStart}${bCount === 1 ? '' : ',' + bCount} @@`);
    for (const l of slice) out.push(l.t + l.text);
  }
  return out.join('\n') + '\n';
}
