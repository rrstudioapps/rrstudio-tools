// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Esecuzione di un'espressione regolare JavaScript su un testo. Logica pura (gira anche in un Web Worker). */

export const FLAGS = ['g', 'i', 'm', 's', 'u', 'y', 'd'] as const;
export type Flag = (typeof FLAGS)[number];
export const MAX_MATCHES = 1000;
/** Il testo mostrato per una corrispondenza o un gruppo viene tagliato oltre questa lunghezza. */
export const MAX_SHOWN = 300;

export interface RegexRequest {
  pattern: string;
  /** Flag nell'ordine che si vuole, senza ripetizioni. */
  flags: string;
  text: string;
  /** Testo di sostituzione ($1, $<nome>, $&, $$ …) o null per non calcolarla. */
  replacement: string | null;
}

export interface GroupInfo {
  /** 1, 2, … */
  index: number;
  name: string | null;
  /** null: gruppo non partecipante. */
  text: string | null;
  start: number | null;
  end: number | null;
}

export interface MatchInfo {
  index: number;
  end: number;
  text: string;
  groups: GroupInfo[];
}

export type RegexResult =
  | {
      ok: true;
      matches: MatchInfo[];
      truncated: boolean;
      replaced: string | null;
      /** Gruppi catturanti del pattern (per le intestazioni). */
      groupCount: number;
    }
  | { ok: false; error: string };

/** Flag validi, deduplicati e in ordine canonico. */
export function normalizeFlags(flags: string): string {
  return FLAGS.filter((f) => flags.includes(f)).join('');
}

/** Costruisce la regex o restituisce il messaggio d'errore del motore. */
export function buildRegex(pattern: string, flags: string): RegExp | string {
  try {
    return new RegExp(pattern, normalizeFlags(flags));
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Nomi dei gruppi catturanti, nell'ordine: null per i gruppi senza nome. */
export function groupNames(pattern: string): (string | null)[] {
  const names: (string | null)[] = [];
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (inClass) {
      if (c === ']') inClass = false;
      continue;
    }
    if (c === '[') {
      inClass = true;
      continue;
    }
    if (c !== '(') continue;
    if (pattern[i + 1] !== '?') {
      names.push(null);
    } else if (pattern[i + 2] === '<' && pattern[i + 3] !== '=' && pattern[i + 3] !== '!') {
      const end = pattern.indexOf('>', i + 3);
      if (end > 0) names.push(pattern.slice(i + 3, end));
    }
  }
  return names;
}

function clip(s: string): string {
  return s.length > MAX_SHOWN ? s.slice(0, MAX_SHOWN) + '…' : s;
}

function toMatch(m: RegExpExecArray, names: (string | null)[], hasIndices: boolean): MatchInfo {
  const indices = hasIndices ? (m as RegExpExecArray & { indices?: ([number, number] | undefined)[] }).indices : undefined;
  const groups: GroupInfo[] = [];
  for (let g = 1; g < m.length; g++) {
    const span = indices?.[g];
    groups.push({
      index: g,
      name: names[g - 1] ?? null,
      text: m[g] === undefined ? null : clip(m[g]),
      start: span ? span[0] : null,
      end: span ? span[1] : null,
    });
  }
  return { index: m.index, end: m.index + m[0].length, text: clip(m[0]), groups };
}

/**
 * Trova le corrispondenze come farebbe JavaScript: con `g` tutte, senza `g` solo la prima (con `y`
 * solo se comincia dove si guarda). Le corrispondenze vuote non bloccano il ciclo.
 */
export function runRegex(req: RegexRequest): RegexResult {
  const built = buildRegex(req.pattern, req.flags);
  if (typeof built === 'string') return { ok: false, error: built };
  const re = built;
  const names = groupNames(req.pattern);
  const global = re.global;
  const unicode = re.unicode || re.flags.includes('v');
  const matches: MatchInfo[] = [];
  let truncated = false;
  re.lastIndex = 0;
  for (;;) {
    const m = re.exec(req.text);
    if (!m) break;
    if (matches.length >= MAX_MATCHES) {
      truncated = true;
      break;
    }
    matches.push(toMatch(m, names, re.hasIndices));
    if (!global) break; // senza g (anche con y) una sola corrispondenza
    if (m[0] === '') {
      // avanza di un carattere (di un punto di codice con u) per non restare fermi
      const cp = unicode ? req.text.codePointAt(re.lastIndex) : undefined;
      re.lastIndex += cp !== undefined && cp > 0xffff ? 2 : 1;
      if (re.lastIndex > req.text.length) break;
    }
  }
  let replaced: string | null = null;
  if (req.replacement !== null) {
    re.lastIndex = 0;
    replaced = req.text.replace(re, req.replacement);
  }
  return { ok: true, matches, truncated, replaced, groupCount: names.length };
}

/** Segmento del testo di prova: parte normale o corrispondenza (numerata, per l'alternanza dei colori). */
export interface Piece {
  text: string;
  match: number | null;
}

/** Spezza il testo in parti normali e corrispondenze, per l'evidenziazione. Le corrispondenze vuote si saltano. */
export function highlightPieces(text: string, matches: readonly MatchInfo[]): Piece[] {
  const out: Piece[] = [];
  let pos = 0;
  matches.forEach((m, i) => {
    if (m.end === m.index || m.index < pos) return;
    if (m.index > pos) out.push({ text: text.slice(pos, m.index), match: null });
    out.push({ text: text.slice(m.index, m.end), match: i });
    pos = m.end;
  });
  if (pos < text.length) out.push({ text: text.slice(pos), match: null });
  return out;
}
