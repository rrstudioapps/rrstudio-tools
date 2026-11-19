// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Ricostruzione del testo da un PDF. Logica pura: parte dagli elementi di testo che pdf.js restituisce
 * (stringa, posizione, larghezza) e ricostruisce righe, paragrafi e, con un'euristica semplice, due colonne.
 * Non sa nulla di pdf.js né del DOM, quindi si prova con elementi finti.
 *
 * Sistema di coordinate: quello del PDF, con la y che cresce verso l'alto.
 */

/** Un frammento di testo posizionato (uno per ogni `TextItem` di pdf.js). */
export interface RawItem {
  str: string;
  /** Ascissa dell'inizio del frammento. */
  x: number;
  /** Ordinata della linea di base. */
  y: number;
  /** Larghezza del frammento. */
  width: number;
  /** Altezza del carattere (corpo del testo). */
  height: number;
}

export type LayoutMode = 'keep' | 'flow';

export interface TextOptions {
  /** `keep`: mantiene le righe e approssima l'impaginazione con gli spazi; `flow`: testo fluido, un paragrafo per riga lunga. */
  layout: LayoutMode;
  /** Unisce le parole spezzate da un trattino a fine riga. */
  dehyphenate: boolean;
  /** Riconosce i layout a due colonne e legge prima una colonna, poi l'altra. */
  columns: boolean;
  /** Toglie intestazioni e piè di pagina che si ripetono. */
  stripRepeated: boolean;
}

export const DEFAULT_OPTIONS: TextOptions = { layout: 'flow', dehyphenate: true, columns: true, stripRepeated: true };

/** Una riga ricostruita. */
export interface Line {
  /** Ordinata di riferimento (quella del primo elemento). */
  y: number;
  height: number;
  x0: number;
  x1: number;
  /** Elementi della riga, da sinistra a destra. */
  items: RawItem[];
  /** Testo della riga con un solo spazio fra le parole. */
  plain: string;
  /** Ascissa da cui contare i rientri nella modalità «mantieni impaginazione». */
  baseX: number;
  /** Vero se prima di questa riga c'è uno stacco da paragrafo (o un cambio di colonna). */
  breakBefore: boolean;
}

export interface PageLines {
  lines: Line[];
  /** Larghezza media di un carattere nella pagina (serve ai rientri). */
  charWidth: number;
  /** Vero se la pagina ha almeno un carattere visibile (altrimenti è una scansione o una pagina vuota). */
  hasText: boolean;
  /** Vero se è stato applicato l'ordine a due colonne. */
  twoColumns: boolean;
}

// ---------------------------------------------------------------- utilità

const median = (v: readonly number[]): number => {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Spazio orizzontale oltre il quale due frammenti vicini sono due parole (frazione del corpo). */
const WORD_GAP = 0.15;
/** Tolleranza verticale per stare sulla stessa riga (frazione del corpo). */
const SAME_LINE = 0.5;
/** Oltre questo multiplo dell'interlinea tipica c'è un nuovo paragrafo. */
const PARAGRAPH_GAP = 1.4;
/** Massimo di colonne di spazi per un rientro (evita righe enormi con elementi lontanissimi). */
const MAX_COLUMN = 160;

/** Testo "pulito" di un frammento: spazi di controllo e a larghezza zero tolti. */
function clean(s: string): string {
  return s.replace(/[\u0000-\u0008\u000b-\u001f​-‏⁠﻿]/g, '').replace(/[  -  ]/g, ' ');
}

/** Elementi con almeno un carattere visibile, con il testo ripulito. */
function visibleItems(items: readonly RawItem[]): RawItem[] {
  const out: RawItem[] = [];
  for (const it of items) {
    const str = clean(it.str);
    if (str.trim() === '') continue;
    if (!Number.isFinite(it.x) || !Number.isFinite(it.y)) continue;
    out.push({ ...it, str, width: Number.isFinite(it.width) ? Math.max(0, it.width) : 0, height: it.height > 0 ? it.height : 10 });
  }
  return out;
}

/** Testo di una sequenza di elementi già ordinati per x, con uno spazio dove c'è un vuoto. */
function joinPlain(items: readonly RawItem[]): string {
  let text = '';
  let prev: RawItem | null = null;
  for (const it of items) {
    if (prev) {
      const gap = it.x - (prev.x + prev.width);
      const hasSpace = /\s$/.test(text) || /^\s/.test(it.str);
      if (!hasSpace && gap > WORD_GAP * Math.max(prev.height, it.height)) text += ' ';
    }
    text += it.str;
    prev = it;
  }
  return text.replace(/\s+/g, ' ').trim();
}

/** Raggruppa gli elementi in righe, dall'alto verso il basso. */
function groupLines(items: readonly RawItem[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: { y: number; height: number; items: RawItem[] }[] = [];
  for (const it of sorted) {
    // l'elemento si unisce all'ultima riga se la sua ordinata è dentro la tolleranza (sempre in cima all'elenco)
    const g = groups[groups.length - 1];
    if (g && Math.abs(g.y - it.y) <= SAME_LINE * Math.max(g.height, it.height)) {
      g.items.push(it);
      g.height = Math.max(g.height, it.height);
    } else groups.push({ y: it.y, height: it.height, items: [it] });
  }
  return groups.map((g) => {
    const row = g.items.sort((a, b) => a.x - b.x);
    return {
      y: g.y,
      height: g.height,
      x0: row[0].x,
      x1: Math.max(...row.map((r) => r.x + r.width)),
      items: row,
      plain: joinPlain(row),
      baseX: 0,
      breakBefore: false,
    };
  });
}

/** Stacchi da paragrafo: salto verticale più grande dell'interlinea tipica. */
function markBreaks(lines: Line[]): void {
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const d = lines[i - 1].y - lines[i].y;
    if (d > 0) gaps.push(d);
  }
  // interlinea tipica: il primo quartile dei salti (con poche righe la mediana cadrebbe sugli stacchi fra paragrafi)
  const leading = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor((gaps.length - 1) / 4)] : 0;
  for (let i = 1; i < lines.length; i++) {
    const d = lines[i - 1].y - lines[i].y;
    lines[i].breakBefore = leading > 0 && d > leading * PARAGRAPH_GAP;
  }
}

// ---------------------------------------------------------------- colonne

/**
 * Cerca il "canale" fra due colonne: una fascia verticale vuota vicino al centro del testo. Rende l'ascissa
 * del canale o null. Euristica prudente: servono almeno 4 righe per lato e quasi nessun elemento che attraversi il canale.
 */
export function findGutter(items: readonly RawItem[]): number | null {
  if (items.length < 8) return null;
  const min = Math.min(...items.map((i) => i.x));
  const max = Math.max(...items.map((i) => i.x + i.width));
  const span = max - min;
  if (span <= 0) return null;
  const BINS = 200;
  const bin = span / BINS;
  const cover = new Array<number>(BINS).fill(0);
  for (const it of items) {
    const a = Math.max(0, Math.floor((it.x - min) / bin));
    const b = Math.min(BINS - 1, Math.floor((it.x + it.width - min) / bin));
    for (let k = a; k <= b; k++) cover[k]++;
  }
  // il canale deve cadere fra il 30% e il 70% della larghezza del testo e restare quasi vuoto
  const maxCross = 2;
  let best: { from: number; to: number } | null = null;
  let run: number | null = null;
  for (let k = Math.floor(BINS * 0.3); k <= Math.ceil(BINS * 0.7) && k < BINS; k++) {
    if (cover[k] <= maxCross) {
      run ??= k;
      if (!best || k - run > best.to - best.from) best = { from: run, to: k };
    } else run = null;
  }
  // il canale deve essere largo almeno il 3% del testo e due volte lo spazio fra parole (corpo medio x 1,2):
  // gli spazi fra le parole che per caso si allineano su più righe non sono un canale
  const bodySize = median(items.map((i) => i.height));
  if (!best || (best.to - best.from + 1) * bin < Math.max(span * 0.03, bodySize * 1.2)) return null;
  const gutter = min + ((best.from + best.to + 1) / 2) * bin;
  const left = new Set<number>();
  const right = new Set<number>();
  for (const it of items) {
    if (it.x + it.width <= gutter) left.add(Math.round(it.y));
    else if (it.x >= gutter) right.add(Math.round(it.y));
  }
  return left.size >= 4 && right.size >= 4 ? gutter : null;
}

const crosses = (it: RawItem, gutter: number): boolean => it.x < gutter && it.x + it.width > gutter;

/**
 * Righe in ordine di lettura per un layout a due colonne: prima le righe a tutta larghezza in cima, poi la colonna
 * sinistra, poi la destra, poi quelle a tutta larghezza in fondo. Se una riga che attraversa il canale sta in mezzo
 * alle colonne rende null: non è un layout a due colonne che sappiamo leggere.
 */
function twoColumnOrder(items: readonly RawItem[], gutter: number): Line[] | null {
  const all = groupLines(items);
  const split = (l: Line) => l.items.some((i) => i.x + i.width <= gutter) && l.items.some((i) => i.x >= gutter);
  const wide = (l: Line) => l.items.some((i) => crosses(i, gutter));
  const firstSplit = all.findIndex(split);
  let lastSplit = -1;
  all.forEach((l, i) => (split(l) ? (lastSplit = i) : undefined));
  if (firstSplit < 0) return null;
  const top: Line[] = [];
  const bottom: Line[] = [];
  const colItems: RawItem[] = [];
  for (let i = 0; i < all.length; i++) {
    const l = all[i];
    if (wide(l)) {
      if (i < firstSplit) top.push(l);
      else if (i > lastSplit) bottom.push(l);
      else return null;
    } else colItems.push(...l.items);
  }
  const left = groupLines(colItems.filter((i) => i.x + i.width <= gutter));
  const right = groupLines(colItems.filter((i) => i.x >= gutter));
  if (left.length === 0 || right.length === 0) return null;
  const mark = (ls: Line[], first: boolean) => {
    markBreaks(ls);
    if (ls.length) ls[0].breakBefore = !first;
  };
  mark(top, true);
  mark(left, top.length === 0);
  mark(right, false);
  mark(bottom, false);
  if (top.length && left.length) left[0].breakBefore = true;
  const baseLeft = Math.min(...left.map((l) => l.x0));
  const baseRight = Math.min(...right.map((l) => l.x0));
  const baseAll = Math.min(...[...top, ...bottom].map((l) => l.x0), baseLeft);
  for (const l of left) l.baseX = baseLeft;
  for (const l of right) l.baseX = baseRight;
  for (const l of [...top, ...bottom]) l.baseX = baseAll;
  return [...top, ...left, ...right, ...bottom];
}

// ---------------------------------------------------------------- pagina

/** Dagli elementi di una pagina alle righe in ordine di lettura. */
export function pageToLines(raw: readonly RawItem[], opts: Pick<TextOptions, 'columns'> = DEFAULT_OPTIONS): PageLines {
  const items = visibleItems(raw);
  if (items.length === 0) return { lines: [], charWidth: 6, hasText: false, twoColumns: false };
  const widths = items.filter((i) => i.width > 0 && i.str.length >= 2).map((i) => i.width / i.str.length);
  const charWidth = median(widths) || median(items.map((i) => i.height)) * 0.5 || 6;
  const gutter = opts.columns ? findGutter(items) : null;
  const ordered = gutter === null ? null : twoColumnOrder(items, gutter);
  if (ordered) return { lines: ordered, charWidth, hasText: true, twoColumns: true };
  const lines = groupLines(items);
  markBreaks(lines);
  const base = Math.min(...lines.map((l) => l.x0));
  for (const l of lines) l.baseX = base;
  return { lines, charWidth, hasText: true, twoColumns: false };
}

/** Testo di una riga che mantiene la posizione orizzontale: gli spazi seguono la distanza dal bordo sinistro. */
export function keepLayoutText(line: Line, charWidth: number): string {
  let text = '';
  let prev: RawItem | null = null;
  for (const it of line.items) {
    const col = Math.min(MAX_COLUMN, Math.max(0, Math.round((it.x - line.baseX) / charWidth)));
    if (text.length < col) text += ' '.repeat(col - text.length);
    else if (prev) {
      const gap = it.x - (prev.x + prev.width);
      if (!/\s$/.test(text) && !/^\s/.test(it.str) && gap > WORD_GAP * Math.max(prev.height, it.height)) text += ' ';
    }
    text += it.str;
    prev = it;
  }
  return text.replace(/\s+$/, '');
}

// ---------------------------------------------------------------- intestazioni e piè di pagina

/** Forma confrontabile di una riga: numeri sostituiti da `#` (così «Pagina 3 di 9» ripetuta è la stessa riga). */
export function repeatKey(text: string): string {
  return text.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Righe da considerare in alto e in basso in ogni pagina (al massimo; nelle pagine corte un terzo delle righe). */
const EDGE_LINES = 2;

/**
 * Chiavi delle righe che si ripetono: compaiono fra le prime o le ultime due righe di più del 50% delle pagine.
 * Servono almeno 3 pagine con testo, altrimenti non si decide (un titolo che torna due volte non è un'intestazione).
 */
export function repeatedKeys(pages: readonly PageLines[]): Set<string> {
  const withText = pages.filter((p) => p.lines.length > 0);
  if (withText.length < 3) return new Set();
  const counts = new Map<string, number>();
  for (const p of withText) {
    const seen = new Set<string>();
    for (const l of edgeLines(p)) {
      const k = repeatKey(l.plain);
      if (k.length > 0) seen.add(k);
    }
    for (const k of seen) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out = new Set<string>();
  for (const [k, n] of counts) if (n > withText.length / 2) out.add(k);
  return out;
}

/** Le righe più in alto e più in basso della pagina (per ordinata, non per ordine di lettura). */
function edgeLines(p: PageLines): Line[] {
  const n = Math.min(EDGE_LINES, Math.floor(p.lines.length / 3));
  if (n === 0) return [];
  const byY = [...p.lines].sort((a, b) => b.y - a.y);
  return [...byY.slice(0, n), ...byY.slice(-n)];
}

/** Toglie dalla pagina le righe di intestazione e piè di pagina ripetuti. */
export function stripLines(page: PageLines, keys: ReadonlySet<string>): PageLines {
  if (keys.size === 0) return page;
  const drop = new Set(edgeLines(page).filter((l) => keys.has(repeatKey(l.plain))));
  if (drop.size === 0) return page;
  const lines = page.lines.filter((l) => !drop.has(l));
  if (lines.length > 0) lines[0] = { ...lines[0], breakBefore: false };
  return { ...page, lines };
}

// ---------------------------------------------------------------- testo della pagina

const HYPHEN_END = /[\p{L}][-­‐]$/u;
const LOWER_START = /^\p{Ll}/u;

/**
 * Testo di una pagina dalle sue righe.
 * - `flow`: le righe dello stesso paragrafo si uniscono con uno spazio; un paragrafo finisce al salto verticale
 *   o dopo una riga corta che chiude con un punto (fine di capoverso); paragrafi separati da una riga vuota.
 * - `keep`: una riga di testo per riga del PDF, con rientri approssimati con gli spazi e una riga vuota ai salti.
 * - `dehyphenate`: «parola-» + «mento» diventa «parolamento» quando la riga dopo comincia con una minuscola.
 */
export function linesToText(page: PageLines, opts: Pick<TextOptions, 'layout' | 'dehyphenate'>): string {
  const { lines } = page;
  if (lines.length === 0) return '';
  const keep = opts.layout === 'keep';
  const texts = lines.map((l) => (keep ? keepLayoutText(l, page.charWidth) : l.plain));
  const maxWidth = Math.max(...lines.map((l) => l.x1 - l.x0));

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let text = texts[i];
    const prev = i > 0 ? lines[i - 1] : null;
    let newPara = i === 0 || lines[i].breakBefore;
    if (!newPara && !keep && prev) {
      // riga corta che chiude con un punto: fine di capoverso anche senza salto verticale
      const short = prev.x1 - prev.x0 < 0.6 * maxWidth;
      if (short && /[.!?:;»"”)]$/.test(prev.plain)) newPara = true;
    }
    if (opts.dehyphenate && !newPara && i > 0 && HYPHEN_END.test(texts[i - 1]) && LOWER_START.test(text.trimStart())) {
      if (keep) {
        // si sposta la prima parola sulla riga precedente, il resto della riga resta dov'è
        const m = /^(\s*)(\S+)(.*)$/s.exec(text);
        const last = out.length - 1;
        if (m && last >= 0) {
          out[last] = out[last].replace(/[-­‐]$/, '') + m[2];
          text = m[3].replace(/^\s+/, '') === '' ? '' : m[1] + ' '.repeat(m[2].length) + m[3];
          if (text === '') continue;
          out.push(text);
          continue;
        }
      } else {
        const last = out.length - 1;
        out[last] = out[last].replace(/[-­‐]$/, '') + text.trimStart();
        continue;
      }
    }
    if (i === 0) out.push(text);
    else if (newPara) out.push('', text);
    else if (keep) out.push(text);
    else out[out.length - 1] += ' ' + text;
  }
  return out.join('\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------- documento

export interface PageInput {
  /** Numero di pagina (da 1). */
  number: number;
  items: readonly RawItem[];
}

export interface PageText {
  number: number;
  text: string;
  /** La pagina ha un livello di testo. */
  hasText: boolean;
}

export interface DocumentText {
  pages: PageText[];
  withText: number;
  withoutText: number;
  /** Quante pagine sono state lette in ordine a due colonne. */
  twoColumnPages: number;
}

/** Estrae il testo di tutte le pagine date, applicando le opzioni (intestazioni e piè di pagina compresi). */
export function extractDocument(inputs: readonly PageInput[], opts: TextOptions): DocumentText {
  let parsed = inputs.map((p) => pageToLines(p.items, opts));
  if (opts.stripRepeated) {
    const keys = repeatedKeys(parsed);
    parsed = parsed.map((p) => stripLines(p, keys));
  }
  const pages = parsed.map<PageText>((p, i) => ({ number: inputs[i].number, text: linesToText(p, opts), hasText: p.hasText }));
  const withText = pages.filter((p) => p.hasText).length;
  return { pages, withText, withoutText: pages.length - withText, twoColumnPages: parsed.filter((p) => p.twoColumns).length };
}

// ---------------------------------------------------------------- uscita

export interface ComposeOptions {
  /** Aggiunge `--- Pagina N ---` prima del testo di ogni pagina. */
  markers: boolean;
  /** Parola per «Pagina» nella lingua dell'interfaccia. */
  pageLabel: string;
}

/** Testo semplice (.txt): le pagine una dopo l'altra, con o senza separatori. Le pagine senza testo restano vuote. */
export function composeText(pages: readonly PageText[], o: ComposeOptions): string {
  const parts = pages.map((p) => (o.markers ? `--- ${o.pageLabel} ${p.number} ---\n\n${p.text}`.trimEnd() : p.text));
  return (o.markers ? parts.join('\n\n') : parts.filter((t) => t !== '').join('\n\n')).trim();
}

/** Markdown (.md): titolo con il nome del file e un titolo di secondo livello per ogni pagina. */
export function composeMarkdown(title: string, pages: readonly PageText[], pageLabel: string): string {
  const head = `# ${title.replace(/[\r\n]+/g, ' ').trim() || 'PDF'}`;
  const body = pages.map((p) => `## ${pageLabel} ${p.number}\n\n${p.text}`.trimEnd());
  return [head, ...body].join('\n\n') + '\n';
}

/** Parole di un testo (sequenze di caratteri non spazio). */
export function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

/** Numeri delle pagine senza testo, scritti a intervalli («1-3, 7»). */
export function describePages(numbers: readonly number[]): string {
  const out: string[] = [];
  for (let i = 0; i < numbers.length; ) {
    let j = i;
    while (j + 1 < numbers.length && numbers[j + 1] === numbers[j] + 1) j++;
    out.push(j > i ? `${numbers[i]}-${numbers[j]}` : String(numbers[i]));
    i = j + 1;
  }
  return out.join(', ');
}
