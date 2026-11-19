// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Tipografia fluida con CSS clamp(): calcolo di intercetta e pendenza, scala tipografica e controllo di accessibilità.
 * Logica pura, senza DOM e senza Angular. Le lunghezze di calcolo sono in pixel; la conversione in rem usa la
 * dimensione di base del carattere radice (di solito 16 px).
 */

export type Unit = 'px' | 'rem';

/** Lunghezza "16", "16px", "1.25rem" (virgola o punto decimale) in pixel; null se non valida o non positiva. */
export function parseSize(input: string, defaultUnit: Unit, rootPx: number): number | null {
  const m = /^\s*(\d*[.,]?\d+)\s*(px|rem)?\s*$/i.exec(input);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (m[2]?.toLowerCase() as Unit | undefined) ?? defaultUnit;
  return unit === 'rem' ? n * rootPx : n;
}

/** Numero con al massimo `maxFrac` decimali e senza zeri finali (`-0` diventa `0`). */
export function trimNumber(n: number, maxFrac = 4): string {
  const s = n.toFixed(maxFrac).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
}

export interface FluidInput {
  /** Dimensioni in pixel alla viewport minima e massima. */
  minSize: number;
  maxSize: number;
  /** Larghezze di viewport in pixel. */
  minVw: number;
  maxVw: number;
  /** Pixel di 1 rem. */
  rootPx: number;
}

export type FluidError = 'viewport' | 'size' | 'root';

export interface FluidResult {
  /** Pendenza in vw (percentuale della larghezza di viewport per ogni pixel di viewport = 100 × pixel/pixel). */
  slopeVw: number;
  /** Intercetta in pixel (valore teorico a viewport 0). */
  interceptPx: number;
  /** Minimo e massimo reali del clamp, in pixel (il minore e il maggiore tra le due dimensioni). */
  lowPx: number;
  highPx: number;
  /** Vero se la dimensione diminuisce al crescere della viewport (min > max). */
  decreasing: boolean;
  /** Vero se le due dimensioni coincidono: il clamp non serve e si restituisce un valore fisso. */
  constant: boolean;
  css: string;
  /** Rapporto tra la dimensione maggiore e la minore. */
  ratio: number;
}

const rem = (px: number, root: number) => trimNumber(px / root) + 'rem';

/** `clamp(min, intercetta + pendenza vw, max)` in rem. */
export function fluidClamp(i: FluidInput): FluidResult | { error: FluidError } {
  if (!(i.rootPx > 0)) return { error: 'root' };
  if (!(i.minSize > 0) || !(i.maxSize > 0)) return { error: 'size' };
  if (!(i.maxVw > i.minVw) || !(i.minVw >= 0)) return { error: 'viewport' };
  const slope = (i.maxSize - i.minSize) / (i.maxVw - i.minVw);
  const interceptPx = i.minSize - slope * i.minVw;
  const slopeVw = slope * 100;
  const decreasing = i.minSize > i.maxSize;
  const lowPx = Math.min(i.minSize, i.maxSize);
  const highPx = Math.max(i.minSize, i.maxSize);
  const constant = i.minSize === i.maxSize;
  const css = constant
    ? rem(i.minSize, i.rootPx)
    : `clamp(${rem(lowPx, i.rootPx)}, ${rem(interceptPx, i.rootPx)} ${slopeVw < 0 ? '-' : '+'} ${trimNumber(Math.abs(slopeVw))}vw, ${rem(highPx, i.rootPx)})`;
  return { slopeVw, interceptPx, lowPx, highPx, decreasing, constant, css, ratio: highPx / lowPx };
}

/** Dimensione in pixel alla larghezza di viewport `vw` (simulazione dell'anteprima). */
export function sizeAt(i: FluidInput, vw: number): number {
  const slope = (i.maxSize - i.minSize) / (i.maxVw - i.minVw);
  const v = i.minSize - slope * i.minVw + slope * vw;
  return Math.min(Math.max(v, Math.min(i.minSize, i.maxSize)), Math.max(i.minSize, i.maxSize));
}

/** Soglia del controllo WCAG 1.4.4 (Ridimensionamento del testo): il testo deve poter arrivare al 200% con lo zoom. */
export const WCAG_RATIO_LIMIT = 2.5;

/**
 * Avvisi di accessibilità. Con rapporto max/min oltre 2,5 lo zoom del browser potrebbe non ingrandire il testo
 * del 200% sulle viewport più grandi, perché il clamp lo blocca al massimo.
 */
export function accessibilityWarnings(r: FluidResult): ('ratio' | 'tiny')[] {
  const w: ('ratio' | 'tiny')[] = [];
  if (r.ratio > WCAG_RATIO_LIMIT) w.push('ratio');
  if (r.lowPx < 12) w.push('tiny');
  return w;
}

// ---------- scala tipografica ----------

export interface ScaleInput extends FluidInput {
  /** Rapporti della scala alla viewport minima e massima (es. 1,2 e 1,25). */
  minRatio: number;
  maxRatio: number;
  /** Passi dal primo all'ultimo (di solito -2 … 5). */
  from: number;
  to: number;
  /** Prefisso delle variabili CSS (default `--step-`). */
  prefix?: string;
}

export interface ScaleStep {
  step: number;
  name: string;
  minPx: number;
  maxPx: number;
  css: string;
}

export const SCALE_PRESETS: readonly { ratio: number; id: string }[] = [
  { ratio: 1.067, id: 'minorSecond' },
  { ratio: 1.125, id: 'majorSecond' },
  { ratio: 1.2, id: 'minorThird' },
  { ratio: 1.25, id: 'majorThird' },
  { ratio: 1.333, id: 'perfectFourth' },
  { ratio: 1.414, id: 'augmentedFourth' },
  { ratio: 1.5, id: 'perfectFifth' },
  { ratio: 1.618, id: 'goldenRatio' },
];

/** Legge un rapporto "1,25" o "1.25" tra 1 e 3; null se non valido. */
export function parseRatio(s: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*$/.exec(s);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return n >= 1 && n <= 3 ? n : null;
}

/** Scala fluida: il passo 0 è la dimensione base; ogni passo moltiplica per il rapporto elevato al passo. */
export function fluidScale(i: ScaleInput): ScaleStep[] | { error: FluidError | 'steps' } {
  if (!Number.isInteger(i.from) || !Number.isInteger(i.to) || i.from > i.to || i.to - i.from > 20) return { error: 'steps' };
  const prefix = i.prefix ?? '--step-';
  const out: ScaleStep[] = [];
  for (let s = i.from; s <= i.to; s++) {
    const minPx = i.minSize * Math.pow(i.minRatio, s);
    const maxPx = i.maxSize * Math.pow(i.maxRatio, s);
    const r = fluidClamp({ ...i, minSize: minPx, maxSize: maxPx });
    if ('error' in r) return r;
    out.push({ step: s, name: `${prefix}${s}`, minPx, maxPx, css: r.css });
  }
  return out;
}

/** Variabili CSS pronte da incollare. */
export function scaleToCss(steps: ScaleStep[]): string {
  return ':root {\n' + steps.map((s) => `  ${s.name}: ${s.css};`).join('\n') + '\n}\n';
}
