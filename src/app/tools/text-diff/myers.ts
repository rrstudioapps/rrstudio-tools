// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Algoritmo di Myers (O(ND)) con la variante a spazio lineare: si cerca la "middle snake" di ogni
 * intervallo e si procede per bisezione, quindi la memoria resta O(N+M) anche per due testi
 * completamente diversi (D grande). Prima si tolgono prefisso e suffisso comuni.
 * Lavora su sequenze di interi (le righe o le parole vengono prima trasformate in id).
 */
export type Seq = ArrayLike<number>;

/** Segmento di una sequenza di modifiche: uguale, cancellato da A o inserito da B. */
export interface Op {
  type: 'eq' | 'del' | 'ins';
  /** Indice di partenza in A e in B (per 'ins' a indica la posizione di inserimento, per 'del' b idem). */
  a: number;
  b: number;
  len: number;
}

interface Split {
  x: number;
  y: number;
}

/** Punto di divisione dell'intervallo (indici locali) trovato dalla bisezione; null se non c'è nulla in comune. */
function bisect(a: Seq, aLo: number, aHi: number, b: Seq, bLo: number, bHi: number): Split | null {
  const n = aHi - aLo;
  const m = bHi - bLo;
  const maxD = Math.ceil((n + m) / 2);
  const off = maxD;
  const size = 2 * maxD + 2;
  const v1 = new Int32Array(size).fill(-1);
  const v2 = new Int32Array(size).fill(-1);
  v1[off + 1] = 0;
  v2[off + 1] = 0;
  const delta = n - m;
  const front = delta % 2 !== 0;
  let k1start = 0, k1end = 0, k2start = 0, k2end = 0;
  for (let d = 0; d < maxD; d++) {
    for (let k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
      const i = off + k1;
      let x1 = k1 === -d || (k1 !== d && v1[i - 1] < v1[i + 1]) ? v1[i + 1] : v1[i - 1] + 1;
      let y1 = x1 - k1;
      while (x1 < n && y1 < m && a[aLo + x1] === b[bLo + y1]) {
        x1++;
        y1++;
      }
      v1[i] = x1;
      if (x1 > n) k1end += 2;
      else if (y1 > m) k1start += 2;
      else if (front) {
        const j = off + delta - k1;
        if (j >= 0 && j < size && v2[j] !== -1) {
          const x2 = n - v2[j];
          if (x1 >= x2) return { x: x1, y: y1 };
        }
      }
    }
    for (let k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
      const i = off + k2;
      let x2 = k2 === -d || (k2 !== d && v2[i - 1] < v2[i + 1]) ? v2[i + 1] : v2[i - 1] + 1;
      let y2 = x2 - k2;
      while (x2 < n && y2 < m && a[aHi - x2 - 1] === b[bHi - y2 - 1]) {
        x2++;
        y2++;
      }
      v2[i] = x2;
      if (x2 > n) k2end += 2;
      else if (y2 > m) k2start += 2;
      else if (!front) {
        const j = off + delta - k2;
        if (j >= 0 && j < size && v1[j] !== -1) {
          const x1 = v1[j];
          const y1 = off + x1 - j;
          if (x1 >= n - x2) return { x: x1, y: y1 };
        }
      }
    }
  }
  return null;
}

/** Coppie (indice in A, indice in B, lunghezza) dei tratti uguali, in ordine. */
export function matchRuns(a: Seq, b: Seq): { a: number; b: number; len: number }[] {
  const runs: { a: number; b: number; len: number }[] = [];
  const push = (ai: number, bi: number, len: number) => {
    if (len <= 0) return;
    const last = runs[runs.length - 1];
    if (last && last.a + last.len === ai && last.b + last.len === bi) last.len += len;
    else runs.push({ a: ai, b: bi, len });
  };
  // pila di lavoro: o un intervallo da analizzare o un tratto uguale già noto (così l'ordine resta corretto)
  type Item = { run: false; aLo: number; aHi: number; bLo: number; bHi: number } | { run: true; a: number; b: number; len: number };
  const stack: Item[] = [{ run: false, aLo: 0, aHi: a.length, bLo: 0, bHi: b.length }];
  while (stack.length) {
    const it = stack.pop()!;
    if (it.run) {
      push(it.a, it.b, it.len);
      continue;
    }
    let { aLo, aHi, bLo, bHi } = it;
    const startA = aLo;
    const startB = bLo;
    while (aLo < aHi && bLo < bHi && a[aLo] === b[bLo]) {
      aLo++;
      bLo++;
    }
    push(startA, startB, aLo - startA);
    let tail = 0;
    while (aLo < aHi && bLo < bHi && a[aHi - 1] === b[bHi - 1]) {
      aHi--;
      bHi--;
      tail++;
    }
    if (tail > 0) stack.push({ run: true, a: aHi, b: bHi, len: tail });
    if (aLo >= aHi || bLo >= bHi) continue; // solo inserimenti o solo cancellazioni
    const s = bisect(a, aLo, aHi, b, bLo, bHi);
    if (!s) continue; // niente in comune
    // rete di sicurezza: una divisione che non riduce il problema si tratta come "niente in comune"
    if ((s.x === 0 && s.y === 0) || (s.x === aHi - aLo && s.y === bHi - bLo)) continue;
    stack.push({ run: false, aLo: aLo + s.x, aHi, bLo: bLo + s.y, bHi });
    stack.push({ run: false, aLo, aHi: aLo + s.x, bLo, bHi: bLo + s.y });
  }
  return runs;
}

/** Script di modifica completo (eq/del/ins) tra due sequenze. */
export function diffSequences(a: Seq, b: Seq): Op[] {
  const ops: Op[] = [];
  let ai = 0;
  let bi = 0;
  const flush = (aEnd: number, bEnd: number) => {
    if (aEnd > ai) ops.push({ type: 'del', a: ai, b: bi, len: aEnd - ai });
    if (bEnd > bi) ops.push({ type: 'ins', a: aEnd, b: bi, len: bEnd - bi });
  };
  for (const r of matchRuns(a, b)) {
    flush(r.a, r.b);
    ops.push({ type: 'eq', a: r.a, b: r.b, len: r.len });
    ai = r.a + r.len;
    bi = r.b + r.len;
  }
  flush(a.length, b.length);
  return ops;
}

/** Numero di elementi modificati (cancellati + inseriti). */
export function editDistance(ops: readonly Op[]): number {
  return ops.reduce((s, o) => s + (o.type === 'eq' ? 0 : o.len), 0);
}
