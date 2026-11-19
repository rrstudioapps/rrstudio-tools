// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { CSS_COLOR_NAMES } from './color-names';

/** Colore sRGB: canali 0-255 (interi dopo la lettura), alfa 0-1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round = (n: number, d = 0): number => {
  const k = 10 ** d;
  return Math.round(n * k) / k;
};

// ---------------- lettura ----------------

const NUM = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`;
const NUM_RE = new RegExp(`^(${NUM})(%|deg|turn|rad|grad)?$`, 'i');

function token(t: string): { v: number; unit: string } | null {
  const m = NUM_RE.exec(t);
  return m ? { v: Number(m[1]), unit: (m[2] ?? '').toLowerCase() } : null;
}

/** Alfa: numero 0-1 o percentuale. */
function alphaOf(t: string | undefined): number | null {
  if (t === undefined) return 1;
  const k = token(t);
  if (!k || (k.unit !== '' && k.unit !== '%')) return null;
  return clamp(k.unit === '%' ? k.v / 100 : k.v, 0, 1);
}

function hueOf(t: string): number | null {
  const k = token(t);
  if (!k) return null;
  const turns: Record<string, number> = { '': 360 / 360, deg: 1, turn: 360, rad: 180 / Math.PI, grad: 0.9 };
  if (k.unit === '%') return null;
  const deg = k.v * (k.unit === '' ? 1 : turns[k.unit]);
  return ((deg % 360) + 360) % 360;
}

function parseHex(h: string): Rgba | null {
  if (!/^[0-9a-f]+$/i.test(h) || ![3, 4, 6, 8].includes(h.length)) return null;
  const full = h.length <= 4 ? [...h].map((c) => c + c).join('') : h;
  const n = (i: number): number => parseInt(full.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? round(n(6) / 255, 4) : 1 };
}

function args(text: string, fn: RegExp): string[] | null {
  const m = fn.exec(text);
  if (!m) return null;
  const parts = m[1].trim().split(/\s*[,/]\s*|\s+/).filter(Boolean);
  return parts.length === 3 || parts.length === 4 ? parts : null;
}

/** HSL → RGB (h in gradi, s e l 0-1). */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number): number => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/**
 * Legge un colore CSS: HEX 3/4/6/8 (con o senza #), rgb()/rgba(), hsl()/hsla(), oklch() e i 148 nomi.
 * Restituisce null se non è riconoscibile. Maiuscole e spazi in più sono tollerati.
 */
export function parseColor(input: string): Rgba | null {
  const t = input.trim().toLowerCase();
  if (t === '') return null;
  if (t === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (t.startsWith('#')) return parseHex(t.slice(1));
  const named = CSS_COLOR_NAMES.get(t);
  if (named) return parseHex(named);

  const rgb = args(t, /^rgba?\(\s*(.*?)\s*\)$/);
  if (rgb) {
    const ch = rgb.slice(0, 3).map(token);
    const a = alphaOf(rgb[3]);
    if (ch.some((c) => !c || (c.unit !== '' && c.unit !== '%')) || a === null) return null;
    const v = ch.map((c) => clamp(c!.unit === '%' ? (c!.v / 100) * 255 : c!.v, 0, 255));
    return { r: Math.round(v[0]), g: Math.round(v[1]), b: Math.round(v[2]), a };
  }
  const hsl = args(t, /^hsla?\(\s*(.*?)\s*\)$/);
  if (hsl) {
    const h = hueOf(hsl[0]);
    const s = token(hsl[1]);
    const l = token(hsl[2]);
    const a = alphaOf(hsl[3]);
    if (h === null || !s || !l || a === null || (s.unit !== '' && s.unit !== '%') || (l.unit !== '' && l.unit !== '%')) return null;
    const [r, g, b] = hslToRgb(h, clamp(s.v, 0, 100) / 100, clamp(l.v, 0, 100) / 100);
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a };
  }
  const ok = args(t, /^oklch\(\s*(.*?)\s*\)$/);
  if (ok) {
    const L = token(ok[0]);
    const C = token(ok[1]);
    const h = hueOf(ok[2]);
    const a = alphaOf(ok[3]);
    if (!L || !C || h === null || a === null || (L.unit !== '' && L.unit !== '%') || (C.unit !== '' && C.unit !== '%')) return null;
    const lightness = clamp(L.unit === '%' ? L.v / 100 : L.v, 0, 1);
    const chroma = Math.max(0, C.unit === '%' ? (C.v / 100) * 0.4 : C.v);
    const { r, g, b } = oklchToRgb(lightness, chroma, h);
    return { r, g, b, a };
  }
  // esadecimale senza #: solo se non è un nome (già escluso sopra)
  return parseHex(t);
}

// ---------------- luminanza e contrasto (WCAG 2.x) ----------------

function linear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminanza relativa WCAG 2.x di un colore opaco: 0 (nero) … 1 (bianco). */
export function relativeLuminance(c: Pick<Rgba, 'r' | 'g' | 'b'>): number {
  return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
}

/** Rapporto di contrasto WCAG 2.x tra due colori opachi: da 1 a 21. */
export function contrastRatio(a: Pick<Rgba, 'r' | 'g' | 'b'>, b: Pick<Rgba, 'r' | 'g' | 'b'>): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Compone `top` (con la sua trasparenza) su `under` (opaco): il risultato è opaco, canali non arrotondati. */
export function composite(top: Rgba, under: Pick<Rgba, 'r' | 'g' | 'b'>): Rgba {
  const a = top.a;
  return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 };
}

export const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

export const THRESHOLDS = { aaNormal: 4.5, aaaNormal: 7, aaLarge: 3, aaaLarge: 4.5, ui: 3 } as const;
export type CheckName = keyof typeof THRESHOLDS;

export interface Evaluation {
  ratio: number;
  /** Primo piano e sfondo effettivi, dopo aver composto la trasparenza. */
  fg: Rgba;
  bg: Rgba;
  checks: Record<CheckName, boolean>;
}

/**
 * Valuta il contrasto: lo sfondo con trasparenza si compone sul bianco, il testo sullo sfondo risultante.
 * Il confronto con le soglie usa il valore esatto (un 4,499 non passa AA).
 */
export function evaluate(fg: Rgba, bg: Rgba): Evaluation {
  const bgEff = composite(bg, WHITE);
  const fgEff = composite(fg, bgEff);
  const ratio = contrastRatio(fgEff, bgEff);
  const checks = Object.fromEntries(
    (Object.keys(THRESHOLDS) as CheckName[]).map((k) => [k, ratio >= THRESHOLDS[k]]),
  ) as Record<CheckName, boolean>;
  return { ratio, fg: fgEff, bg: bgEff, checks };
}

/** Rapporto mostrato: due decimali troncati, mai arrotondati per eccesso (4,497 non diventa 4,50). */
export function displayRatio(ratio: number): number {
  return Math.floor(ratio * 100 + 1e-9) / 100;
}

// ---------------- OKLCH ----------------

export interface Oklch {
  l: number; // 0-1
  c: number;
  h: number; // gradi 0-360
}

const toLinear = (c8: number): number => linear(c8);
const fromLinear = (x: number): number => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255;

export function rgbToOklch(c: Pick<Rgba, 'r' | 'g' | 'b'>): Oklch {
  const r = toLinear(c.r);
  const g = toLinear(c.g);
  const b = toLinear(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(A, B);
  const hue = chroma < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c: chroma < 1e-4 ? 0 : chroma, h: hue };
}

/** Canali sRGB lineari (non limitati a 0-1) di un colore OKLCH. */
function oklchToLinear(L: number, C: number, h: number): [number, number, number] {
  const A = C * Math.cos((h * Math.PI) / 180);
  const B = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (v: [number, number, number]): boolean => v.every((x) => x >= -0.0005 && x <= 1.0005);

/** OKLCH → sRGB a 8 bit. Se il colore è fuori gamut si riduce la croma (stessa luminosità e tinta) invece di tagliare i canali. */
export function oklchToRgb(L: number, C: number, h: number): Pick<Rgba, 'r' | 'g' | 'b'> {
  let lin = oklchToLinear(L, C, h);
  if (!inGamut(lin)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, mid, h))) lo = mid;
      else hi = mid;
    }
    lin = oklchToLinear(L, lo, h);
  }
  const to8 = (x: number): number => Math.round(clamp(fromLinear(clamp(x, 0, 1)), 0, 255));
  return { r: to8(lin[0]), g: to8(lin[1]), b: to8(lin[2]) };
}

// ---------------- scrittura ----------------

const hex2 = (n: number): string => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');

/** #rrggbb, oppure #rrggbbaa se c'è trasparenza. */
export function toHex(c: Rgba): string {
  const base = `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
  return c.a < 1 ? base + hex2(c.a * 255) : base;
}

/** #rrggbb ignorando l'alfa (per l'input type=color). */
export function toHexOpaque(c: Pick<Rgba, 'r' | 'g' | 'b'>): string {
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
}

const alphaText = (a: number): string => String(round(a, 3));

export function toRgbString(c: Rgba): string {
  const ch = `${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)}`;
  return c.a < 1 ? `rgb(${ch} / ${alphaText(c.a)})` : `rgb(${ch})`;
}

export function rgbToHsl(c: Pick<Rgba, 'r' | 'g' | 'b'>): { h: number; s: number; l: number } {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

export function toHslString(c: Rgba): string {
  const { h, s, l } = rgbToHsl(c);
  const base = `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
  return c.a < 1 ? `hsl(${base} / ${alphaText(c.a)})` : `hsl(${base})`;
}

export function toOklchString(c: Rgba): string {
  const { l, c: chroma, h } = rgbToOklch(c);
  const base = `${round(l * 100, 2)}% ${round(chroma, 3)} ${round(h, 1)}`;
  return c.a < 1 ? `oklch(${base} / ${alphaText(c.a)})` : `oklch(${base})`;
}

// ---------------- suggerimento ----------------

export type Side = 'fg' | 'bg';

export interface Suggestion {
  target: number;
  /** null: nessun colore raggiunge l'obiettivo cambiando solo questo lato. */
  color: Rgba | null;
  ratio: number;
  /** Il colore attuale lo raggiunge già. */
  already: boolean;
  /** Variazione di luminosità OKLCH (punti percentuali, con segno). */
  deltaL: number;
}

function ratioWith(side: Side, candidate: Rgba, fg: Rgba, bg: Rgba): number {
  return side === 'fg' ? evaluate(candidate, bg).ratio : evaluate(fg, candidate).ratio;
}

/**
 * Colore più vicino che raggiunge il contrasto `target`, cambiando solo la luminosità in OKLCH (tinta e croma restano,
 * la croma si riduce solo se serve per restare nella gamma sRGB). Prova a schiarire e a scurire e tiene la variazione minore.
 * L'alfa del colore modificato resta com'è. Il risultato è verificato dopo l'arrotondamento a 8 bit.
 */
export function suggestColor(side: Side, fg: Rgba, bg: Rgba, target: number): Suggestion {
  const current = side === 'fg' ? fg : bg;
  const now = ratioWith(side, current, fg, bg);
  const start = rgbToOklch(current);
  if (now >= target) return { target, color: current, ratio: now, already: true, deltaL: 0 };

  const make = (L: number): Rgba => ({ ...oklchToRgb(L, start.c, start.h), a: current.a });
  const passes = (L: number): boolean => ratioWith(side, make(L), fg, bg) >= target;

  const search = (towards: 0 | 1): number | null => {
    if (!passes(towards)) return null;
    let bad = start.l; // non passa
    let good: number = towards; // passa
    for (let i = 0; i < 30; i++) {
      const mid = (bad + good) / 2;
      if (passes(mid)) good = mid;
      else bad = mid;
    }
    return good;
  };

  const options = ([0, 1] as const)
    .map((t) => search(t))
    .filter((v): v is number => v !== null)
    .sort((a, b) => Math.abs(a - start.l) - Math.abs(b - start.l));
  if (!options.length) return { target, color: null, ratio: now, already: false, deltaL: 0 };
  const L = options[0];
  const color = make(L);
  return { target, color, ratio: ratioWith(side, color, fg, bg), already: false, deltaL: round((L - start.l) * 100, 1) };
}
