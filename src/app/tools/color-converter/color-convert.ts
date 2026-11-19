// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { CSS_COLOR_NAMES } from '../color-contrast-checker/color-names';

/** Colore sRGB: canali 0-255 (interi dopo la lettura), alfa 0-1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}
type Rgb = Pick<Rgba, 'r' | 'g' | 'b'>;

export interface Oklab {
  l: number;
  a: number;
  b: number;
}
export interface Oklch {
  l: number; // 0-1
  c: number;
  h: number; // gradi 0-360
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
export const round = (n: number, d = 0): number => {
  const k = 10 ** d;
  const r = Math.round(n * k) / k;
  return r === 0 ? 0 : r; // niente "-0"
};
const mod360 = (h: number): number => ((h % 360) + 360) % 360;

// ---------------- sRGB <-> lineare ----------------

/** Canale sRGB 0-255 → lineare 0-1. */
export function toLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
/** Lineare 0-1 → canale sRGB 0-255 (non arrotondato, non limitato). */
export function fromLinear(x: number): number {
  const s = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.sign(x) * Math.abs(x) ** (1 / 2.4) - 0.055;
  return s * 255;
}

// ---------------- OKLab / OKLCH (Björn Ottosson) ----------------

/** sRGB 0-255 → OKLab. */
export function rgbToOklab(c: Rgb): Oklab {
  const r = toLinear(c.r);
  const g = toLinear(c.g);
  const b = toLinear(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab → canali sRGB lineari (anche fuori da 0-1 se il colore è fuori gamut). */
export function oklabToLinear(L: number, A: number, B: number): [number, number, number] {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function oklabToOklch(o: Oklab): Oklch {
  const c = Math.hypot(o.a, o.b);
  return { l: o.l, c: c < 1e-6 ? 0 : c, h: c < 1e-4 ? 0 : mod360((Math.atan2(o.b, o.a) * 180) / Math.PI) };
}
export function oklchToOklab(o: Oklch): Oklab {
  const rad = (o.h * Math.PI) / 180;
  return { l: o.l, a: o.c * Math.cos(rad), b: o.c * Math.sin(rad) };
}

export function rgbToOklch(c: Rgb): Oklch {
  return oklabToOklch(rgbToOklab(c));
}

const GAMUT_EPS = 0.0005;
const inGamut = (v: readonly number[]): boolean => v.every((x) => x >= -GAMUT_EPS && x <= 1 + GAMUT_EPS);
const to8 = (x: number): number => Math.round(clamp(fromLinear(clamp(x, 0, 1)), 0, 255));

/** Vero se il colore OKLCH è rappresentabile in sRGB. */
export function oklchInSrgb(o: Oklch): boolean {
  const { l, a, b } = oklchToOklab(o);
  return inGamut(oklabToLinear(l, a, b));
}

/**
 * OKLCH → sRGB a 8 bit. Fuori gamut si riduce la croma (stessa luminosità e tinta, come fa CSS Color 4)
 * invece di tagliare i canali; `clipped` dice se è servito.
 */
export function oklchToRgb(o: Oklch): { rgb: Rgb; clipped: boolean } {
  const L = clamp(o.l, 0, 1);
  const lin = (c: number): [number, number, number] => {
    const k = oklchToOklab({ l: L, c, h: o.h });
    return oklabToLinear(k.l, k.a, k.b);
  };
  let v = lin(o.c);
  let clipped = false;
  if (!inGamut(v)) {
    clipped = true;
    let lo = 0;
    let hi = o.c;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(lin(mid))) lo = mid;
      else hi = mid;
    }
    v = lin(lo);
  }
  return { rgb: { r: to8(v[0]), g: to8(v[1]), b: to8(v[2]) }, clipped };
}

export function oklabToRgb(o: Oklab): { rgb: Rgb; clipped: boolean } {
  return oklchToRgb(oklabToOklch(o));
}

// ---------------- HSL, HWB, CMYK ----------------

export function rgbToHsl(c: Rgb): { h: number; s: number; l: number } {
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
  return { h: mod360(h * 60), s: s * 100, l: l * 100 };
}

/** HSL (h gradi, s e l 0-100) → canali 0-255 non arrotondati. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const S = clamp(s, 0, 100) / 100;
  const Lq = clamp(l, 0, 100) / 100;
  const k = (n: number): number => (n + mod360(h) / 30) % 12;
  const a = S * Math.min(Lq, 1 - Lq);
  const f = (n: number): number => Lq - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

export function rgbToHwb(c: Rgb): { h: number; w: number; b: number } {
  const { h } = rgbToHsl(c);
  const w = Math.min(c.r, c.g, c.b) / 255;
  const bl = 1 - Math.max(c.r, c.g, c.b) / 255;
  return { h, w: w * 100, b: bl * 100 };
}

/** HWB (h gradi, w e b 0-100) → canali 0-255 non arrotondati. Se w+b ≥ 100 il risultato è un grigio. */
export function hwbToRgb(h: number, w: number, b: number): [number, number, number] {
  const W = clamp(w, 0, 100) / 100;
  const B = clamp(b, 0, 100) / 100;
  if (W + B >= 1) {
    const g = (W / (W + B)) * 255;
    return [g, g, g];
  }
  const [r, g, bl] = hslToRgb(h, 100, 50);
  const f = (v: number): number => (v / 255) * (1 - W - B) * 255 + W * 255;
  return [f(r), f(g), f(bl)];
}

/** CMYK indicativo (formula semplice, senza profilo di stampa), valori 0-100. */
export function rgbToCmyk(c: Rgb): { c: number; m: number; y: number; k: number } {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return { c: ((1 - r - k) / (1 - k)) * 100, m: ((1 - g - k) / (1 - k)) * 100, y: ((1 - b - k) / (1 - k)) * 100, k: k * 100 };
}

// ---------------- lettura ----------------

export type InputFormat = 'hex' | 'name' | 'rgb' | 'hsl' | 'hwb' | 'oklch' | 'oklab';

export interface ParsedColor {
  rgb: Rgba;
  format: InputFormat;
  /** Vero se un OKLCH/OKLab non sta in sRGB ed è stato riportato nel gamut riducendo la croma. */
  outOfGamut: boolean;
}

const NUM = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`;
const NUM_RE = new RegExp(`^(${NUM})(%|deg|turn|rad|grad)?$`, 'i');

function token(t: string): { v: number; unit: string } | null {
  const m = NUM_RE.exec(t);
  return m ? { v: Number(m[1]), unit: (m[2] ?? '').toLowerCase() } : null;
}

function alphaOf(t: string | undefined): number | null {
  if (t === undefined) return 1;
  const k = token(t);
  if (!k || (k.unit !== '' && k.unit !== '%')) return null;
  return clamp(k.unit === '%' ? k.v / 100 : k.v, 0, 1);
}

function hueOf(t: string): number | null {
  const k = token(t);
  if (!k || k.unit === '%') return null;
  const f: Record<string, number> = { '': 1, deg: 1, turn: 360, rad: 180 / Math.PI, grad: 0.9 };
  return mod360(k.v * f[k.unit]);
}

/** Numero con unità opzionale %: con % vale `pct` per il 100%, senza si usa il valore così com'è. */
function scaled(t: string, pct: number): number | null {
  const k = token(t);
  if (!k || (k.unit !== '' && k.unit !== '%')) return null;
  return k.unit === '%' ? (k.v / 100) * pct : k.v;
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

const rounded = (v: readonly number[]): Rgb => ({ r: Math.round(clamp(v[0], 0, 255)), g: Math.round(clamp(v[1], 0, 255)), b: Math.round(clamp(v[2], 0, 255)) });

/**
 * Legge un colore CSS: HEX 3/4/6/8 (con o senza #), rgb()/rgba(), hsl()/hsla(), hwb(), oklch(), oklab() e i nomi CSS.
 * Restituisce null se non è riconoscibile. Maiuscole e spazi in più sono tollerati.
 */
export function parseColor(input: string): ParsedColor | null {
  const t = input.trim().toLowerCase();
  if (t === '') return null;
  const ok = (rgb: Rgba, format: InputFormat, outOfGamut = false): ParsedColor => ({ rgb, format, outOfGamut });

  if (t === 'transparent') return ok({ r: 0, g: 0, b: 0, a: 0 }, 'name');
  if (t.startsWith('#')) {
    const h = parseHex(t.slice(1));
    return h ? ok(h, 'hex') : null;
  }
  const named = CSS_COLOR_NAMES.get(t);
  if (named) {
    const h = parseHex(named.replace(/^#/, ''));
    return h ? ok(h, 'name') : null;
  }

  const rgb = args(t, /^rgba?\(\s*(.*?)\s*\)$/);
  if (rgb) {
    const v = rgb.slice(0, 3).map((x) => scaled(x, 255));
    const a = alphaOf(rgb[3]);
    if (v.some((x) => x === null) || a === null) return null;
    return ok({ ...rounded(v as number[]), a }, 'rgb');
  }
  const hsl = args(t, /^hsla?\(\s*(.*?)\s*\)$/);
  if (hsl) {
    const h = hueOf(hsl[0]);
    const s = scaled(hsl[1], 100);
    const l = scaled(hsl[2], 100);
    const a = alphaOf(hsl[3]);
    if (h === null || s === null || l === null || a === null) return null;
    return ok({ ...rounded(hslToRgb(h, s, l)), a }, 'hsl');
  }
  const hwb = args(t, /^hwb\(\s*(.*?)\s*\)$/);
  if (hwb) {
    const h = hueOf(hwb[0]);
    const w = scaled(hwb[1], 100);
    const b = scaled(hwb[2], 100);
    const a = alphaOf(hwb[3]);
    if (h === null || w === null || b === null || a === null) return null;
    return ok({ ...rounded(hwbToRgb(h, w, b)), a }, 'hwb');
  }
  const lch = args(t, /^oklch\(\s*(.*?)\s*\)$/);
  if (lch) {
    const L = scaled(lch[0], 1);
    const C = scaled(lch[1], 0.4);
    const h = hueOf(lch[2]);
    const a = alphaOf(lch[3]);
    if (L === null || C === null || h === null || a === null) return null;
    const r = oklchToRgb({ l: L, c: Math.max(0, C), h });
    return ok({ ...r.rgb, a }, 'oklch', r.clipped);
  }
  const lab = args(t, /^oklab\(\s*(.*?)\s*\)$/);
  if (lab) {
    const L = scaled(lab[0], 1);
    const A = scaled(lab[1], 0.4);
    const B = scaled(lab[2], 0.4);
    const a = alphaOf(lab[3]);
    if (L === null || A === null || B === null || a === null) return null;
    const r = oklabToRgb({ l: clamp(L, 0, 1), a: A, b: B });
    return ok({ ...r.rgb, a }, 'oklab', r.clipped);
  }
  // esadecimale senza # (i nomi sono già esclusi sopra)
  const h = parseHex(t);
  return h ? ok(h, 'hex') : null;
}

// ---------------- scrittura ----------------

const hex2 = (n: number): string => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');

/** #rrggbb, oppure #rrggbbaa se c'è trasparenza. */
export function toHex(c: Rgba): string {
  const base = `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
  return c.a < 1 ? base + hex2(c.a * 255) : base;
}
/** #rrggbb ignorando l'alfa (per l'input type=color). */
export function toHexOpaque(c: Rgb): string {
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
}

const withAlpha = (base: string, a: number): string => (a < 1 ? `${base} / ${round(a, 3)}` : base);

export function toRgbString(c: Rgba): string {
  return `rgb(${withAlpha(`${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)}`, c.a)})`;
}
export function toHslString(c: Rgba): string {
  const { h, s, l } = rgbToHsl(c);
  return `hsl(${withAlpha(`${round(h)} ${round(s)}% ${round(l)}%`, c.a)})`;
}
export function toHwbString(c: Rgba): string {
  const { h, w, b } = rgbToHwb(c);
  return `hwb(${withAlpha(`${round(h)} ${round(w)}% ${round(b)}%`, c.a)})`;
}
export function toOklchString(c: Rgba): string {
  const { l, c: ch, h } = rgbToOklch(c);
  return `oklch(${withAlpha(`${round(l * 100, 2)}% ${round(ch, 4)} ${round(h, 2)}`, c.a)})`;
}
export function toOklabString(c: Rgba): string {
  const { l, a, b } = rgbToOklab(c);
  return `oklab(${withAlpha(`${round(l * 100, 2)}% ${round(a, 4)} ${round(b, 4)}`, c.a)})`;
}
export function toCmykString(c: Rgb): string {
  const k = rgbToCmyk(c);
  return `cmyk(${round(k.c)}% ${round(k.m)}% ${round(k.y)}% ${round(k.k)}%)`;
}

export interface Representation {
  key: 'hex' | 'rgb' | 'hsl' | 'hwb' | 'oklch' | 'oklab' | 'cmyk';
  label: string;
  value: string;
}

/** Tutte le rappresentazioni di un colore, nell'ordine in cui si mostrano. */
export function representations(c: Rgba): Representation[] {
  return [
    { key: 'hex', label: 'HEX', value: toHex(c) },
    { key: 'rgb', label: 'RGB', value: toRgbString(c) },
    { key: 'hsl', label: 'HSL', value: toHslString(c) },
    { key: 'hwb', label: 'HWB', value: toHwbString(c) },
    { key: 'oklch', label: 'OKLCH', value: toOklchString(c) },
    { key: 'oklab', label: 'OKLAB', value: toOklabString(c) },
    { key: 'cmyk', label: 'CMYK', value: toCmykString(c) },
  ];
}

// ---------------- palette ----------------

export interface Swatch {
  /** Etichetta (50…950, oppure il nome dell'armonia). */
  name: string;
  hex: string;
  /** Vero per il campione che coincide con il colore di partenza. */
  base?: boolean;
}

export const SHADE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
/** Luminosità OKLCH di ogni gradino (da quasi bianco a quasi nero). */
const SHADE_LIGHTNESS = [0.975, 0.94, 0.885, 0.81, 0.725, 0.635, 0.545, 0.46, 0.38, 0.31, 0.235];
/** Quanta della croma di partenza resta a ogni gradino (massima al centro, ridotta agli estremi). */
const SHADE_CHROMA = [0.12, 0.25, 0.45, 0.68, 0.88, 1, 1, 0.92, 0.78, 0.62, 0.5];

/**
 * Scala di tinte e ombre 50-950 in OKLCH: stessa tinta, luminosità fissa per gradino, croma modulata e riportata
 * nel gamut sRGB. Il gradino con luminosità più vicina al colore di partenza è il colore stesso.
 */
export function shadeScale(c: Rgb): Swatch[] {
  const o = rgbToOklch(c);
  const chroma = Math.max(o.c, 0.02);
  let nearest = 0;
  SHADE_LIGHTNESS.forEach((l, i) => {
    if (Math.abs(l - o.l) < Math.abs(SHADE_LIGHTNESS[nearest] - o.l)) nearest = i;
  });
  return SHADE_STEPS.map((step, i) => {
    if (i === nearest) return { name: String(step), hex: toHexOpaque(c), base: true };
    const k = o.c < 0.005 ? 0 : SHADE_CHROMA[i];
    const { rgb } = oklchToRgb({ l: SHADE_LIGHTNESS[i], c: chroma * k, h: o.h });
    return { name: String(step), hex: toHexOpaque(rgb) };
  });
}

export type HarmonyKey = 'complementary' | 'analogous' | 'triadic';

/** Gradi di rotazione della tinta (in OKLCH) per ogni armonia, escluso il colore di partenza. */
export const HARMONY_OFFSETS: Record<HarmonyKey, readonly number[]> = {
  complementary: [180],
  analogous: [-30, 30],
  triadic: [120, 240],
};

/** Colori armonici: il colore di partenza per primo, poi gli altri con stessa luminosità e croma e tinta ruotata. */
export function harmony(c: Rgb, kind: HarmonyKey): Swatch[] {
  const o = rgbToOklch(c);
  const base: Swatch = { name: '0°', hex: toHexOpaque(c), base: true };
  const others = HARMONY_OFFSETS[kind].map((deg) => {
    const { rgb } = oklchToRgb({ l: o.l, c: o.c, h: mod360(o.h + deg) });
    return { name: `${deg > 0 ? '+' : ''}${deg}°`, hex: toHexOpaque(rgb) };
  });
  if (kind === 'analogous') return [others[0], base, others[1]];
  return [base, ...others];
}

// ---------------- esportazione ----------------

/** Nome di variabile CSS valido (lettere minuscole, cifre e trattini). */
export function cssVarName(name: string): string {
  const n = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return n === '' ? 'color' : /^\d/.test(n) ? `c-${n}` : n;
}

export function shadesToCss(shades: readonly Swatch[], name: string): string {
  const prefix = cssVarName(name);
  return `:root {\n${shades.map((s) => `  --${prefix}-${s.name}: ${s.hex};`).join('\n')}\n}`;
}

export function shadesToJson(shades: readonly Swatch[], name: string): string {
  return JSON.stringify({ [cssVarName(name)]: Object.fromEntries(shades.map((s) => [s.name, s.hex])) }, null, 2);
}
