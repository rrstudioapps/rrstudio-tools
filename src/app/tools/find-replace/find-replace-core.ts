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
    if (!rule.wholeWord) return new RegExp(rule.find, flags);
    // parola intera: stessi confini Unicode della modalità testo; servono le proprietà \p{…}, quindi il flag u
    // (si aggiunge da soli: se il pattern non è valido con u, l'errore del motore viene mostrato)
    if (!rule.flags.u) flags += 'u';
    return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${rule.find})(?![\\p{L}\\p{N}_])`, flags);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Una regola con il campo "trova" vuoto non fa nulla (una regex vuota troverebbe una stringa vuota ovunque). */
export function isActive(rule: Rule): boolean {
  return rule.enabled && rule.find !== '';
}

type Positions = { index: number; end: number }[];

/** Espande i segnaposto di una stringa di sostituzione ($$, $&, $`, $', $n, $nn, $<nome>) come fa String.replace. */
function expandTemplate(tpl: string, args: unknown[]): string {
  const hasGroups = typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null;
  const tail = hasGroups ? 3 : 2;
  const match = args[0] as string;
  const caps = args.slice(1, args.length - tail) as (string | undefined)[];
  const offset = args[args.length - tail] as number;
  const input = args[args.length - tail + 1] as string;
  const named = hasGroups ? (args[args.length - 1] as Record<string, string | undefined>) : null;
  return tpl.replace(/\$(\$|&|`|'|\d{1,2}|<[^>]*>)/g, (all, t: string) => {
    if (t === '$') return '$';
    if (t === '&') return match;
    if (t === '`') return input.slice(0, offset);
    if (t === "'") return input.slice(offset + match.length);
    if (t[0] === '<') {
      if (!named) return all;
      return named[t.slice(1, -1)] ?? '';
    }
    let k = Number(t);
    if (t.length === 2 && (k < 1 || k > caps.length)) {
      // "$12" senza dodici gruppi vale "$1" seguito da "2"
      const one = Number(t[0]);
      if (one >= 1 && one <= caps.length) return (caps[one - 1] ?? '') + t[1];
      return all;
    }
    if (k < 1 || k > caps.length) return all;
    return caps[k - 1] ?? '';
  });
}

/**
 * Applica una regola in una sola passata: il nuovo testo, il conteggio e (se richiesto) le posizioni
 * delle occorrenze nel testo di partenza. In modalità testo la sostituzione è letterale ($ non è speciale).
 */
export function applyRuleCounting(
  text: string,
  rule: Rule,
  re: RegExp,
  wantPositions: boolean,
): { text: string; count: number; capped: boolean; positions: Positions; truncated: boolean } {
  const positions: Positions = [];
  let count = 0;
  let capped = false;
  let truncated = false;
  const out = text.replace(re, (...args: unknown[]) => {
    const m = args[0] as string;
    const hasGroups = typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null;
    const offset = args[args.length - (hasGroups ? 3 : 2)] as number;
    if (count < MAX_COUNT) count++;
    else capped = true;
    if (wantPositions) {
      if (positions.length < MAX_PREVIEW_MATCHES) positions.push({ index: offset, end: offset + m.length });
      else truncated = true;
    }
    return rule.mode === 'text' ? rule.replace : expandTemplate(rule.replace, args);
  });
  return { text: out, count, capped: capped || count >= MAX_COUNT, positions, truncated };
}

/** Applica una regola: restituisce il nuovo testo. */
export function applyRule(text: string, rule: Rule, re: RegExp): string {
  return applyRuleCounting(text, rule, re, false).text;
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
    out.applied = true;
    try {
      const c = applyRuleCounting(text, rule, re, i === req.previewRule);
      text = c.text;
      out.count = c.count;
      out.countCapped = c.capped;
      if (i === req.previewRule) {
        previewMatches = c.positions;
        previewTruncated = c.truncated;
      }
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
