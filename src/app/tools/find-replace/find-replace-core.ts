// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Trova e sostituisci con più regole in sequenza. Logica pura: gira in un Web Worker (le regex
 * catastrofiche si fermano allo scadere del tempo) ma si può usare anche direttamente nei test.
 */

export type RuleMode = 'text' | 'regex';

export interface Rule {
  find: string;
  replace: string;
  mode: RuleMode;
  caseSensitive: boolean;
  wholeWord: boolean;
  /** Solo per le regex: flag g (tutte le occorrenze), m, s, u. La i deriva da `caseSensitive`. */
  flags: { g: boolean; m: boolean; s: boolean; u: boolean };
  /** Regola disattivata: si salta. */
  enabled: boolean;
}

export const DEFAULT_RULE: Rule = {
  find: '',
  replace: '',
  mode: 'text',
  caseSensitive: false,
  wholeWord: false,
  flags: { g: true, m: false, s: false, u: false },
  enabled: true,
};

export const MAX_RULES = 20;
/** Posizioni delle occorrenze restituite per l'anteprima (oltre, si conta soltanto). */
export const MAX_PREVIEW_MATCHES = 2000;
/** Oltre questo numero di occorrenze il conteggio si ferma (e lo si dice). */
export const MAX_COUNT = 1_000_000;

export interface RunRequest {
  text: string;
  rules: Rule[];
  /** Indice della regola di cui si vogliono le evidenziazioni (sul testo che quella regola riceve). */
  previewRule: number;
}

export interface RuleOutcome {
  /** La regola è stata applicata (vuota o disattivata: non è un errore, ma non fa nulla). */
  applied: boolean;
  count: number;
  countCapped: boolean;
  /** Messaggio d'errore del motore (sintassi non valida). */
  error: string | null;
}

export type RunResult =
  | {
      ok: true;
      output: string;
      outcomes: RuleOutcome[];
      previewText: string;
      previewMatches: { index: number; end: number }[];
      previewTruncated: boolean;
    };

/** Escape per usare un testo come pattern letterale (valido con e senza flag u). */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Costruisce la RegExp della regola oppure restituisce il messaggio d'errore. */
export function buildRuleRegex(rule: Rule): RegExp | string {
  try {
    if (rule.mode === 'text') {
      const body = escapeRegex(rule.find);
      // parola intera: non preceduta né seguita da lettere, cifre o trattino basso (anche accentate)
      const src = rule.wholeWord ? `(?<![\\p{L}\\p{N}_])(?:${body})(?![\\p{L}\\p{N}_])` : body;
      return new RegExp(src, `g${rule.caseSensitive ? '' : 'i'}u`);
    }
    let flags = '';
    if (rule.flags.g) flags += 'g';
    if (!rule.caseSensitive) flags += 'i';
    if (rule.flags.m) flags += 'm';
    if (rule.flags.s) flags += 's';
    if (rule.flags.u) flags += 'u';
    const src = rule.wholeWord ? `\\b(?:${rule.find})\\b` : rule.find;
    return new RegExp(src, flags);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Una regola con il campo "trova" vuoto non fa nulla (una regex vuota troverebbe una stringa vuota ovunque). */
export function isActive(rule: Rule): boolean {
  return rule.enabled && rule.find !== '';
}

function countAndCollect(re: RegExp, text: string, wantPositions: boolean): { count: number; capped: boolean; positions: { index: number; end: number }[]; truncated: boolean } {
  const positions: { index: number; end: number }[] = [];
  let count = 0;
  let truncated = false;
  const g = re.global ? re : new RegExp(re.source, re.flags + 'g');
  const single = !re.global;
  for (const m of text.matchAll(g)) {
    count++;
    if (wantPositions) {
      if (positions.length < MAX_PREVIEW_MATCHES) positions.push({ index: m.index!, end: m.index! + m[0].length });
      else truncated = true;
    }
    if (single || count >= MAX_COUNT) break;
  }
  return { count, capped: count >= MAX_COUNT && !single, positions, truncated };
}

/** Applica una regola: restituisce il nuovo testo. In modalità testo la sostituzione è letterale ($ non è speciale). */
export function applyRule(text: string, rule: Rule, re: RegExp): string {
  if (rule.mode === 'text') return text.replace(re, () => rule.replace);
  return text.replace(re, rule.replace);
}

export function runRules(req: RunRequest): RunResult {
  let text = req.text;
  const outcomes: RuleOutcome[] = [];
  let previewText = req.text;
  let previewMatches: { index: number; end: number }[] = [];
  let previewTruncated = false;
  req.rules.forEach((rule, i) => {
    const out: RuleOutcome = { applied: false, count: 0, countCapped: false, error: null };
    outcomes.push(out);
    if (i === req.previewRule) previewText = text;
    if (!isActive(rule)) return;
    const re = buildRuleRegex(rule);
    if (typeof re === 'string') {
      out.error = re;
      return;
    }
    const c = countAndCollect(re, text, i === req.previewRule);
    out.count = c.count;
    out.countCapped = c.capped;
    if (i === req.previewRule) {
      previewMatches = c.positions;
      previewTruncated = c.truncated;
    }
    out.applied = true;
    try {
      text = applyRule(text, rule, re);
    } catch (e) {
      out.error = e instanceof Error ? e.message : String(e);
      out.applied = false;
    }
  });
  return { ok: true, output: text, outcomes, previewText, previewMatches, previewTruncated };
}

// ---- evidenziazione ----

export interface Piece {
  text: string;
  match: boolean;
}

/** Spezza il testo in frammenti normali ed evidenziati (le posizioni sono ordinate e non si sovrappongono). */
export function highlightPieces(text: string, matches: readonly { index: number; end: number }[]): Piece[] {
  const out: Piece[] = [];
  let pos = 0;
  for (const m of matches) {
    if (m.index < pos) continue;
    if (m.index > pos) out.push({ text: text.slice(pos, m.index), match: false });
    // una corrispondenza vuota non si vede: la si segna con un frammento vuoto evidenziato
    out.push({ text: text.slice(m.index, m.end), match: true });
    pos = m.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), match: false });
  return out;
}
