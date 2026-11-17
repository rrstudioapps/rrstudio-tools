// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

// ---------- colori ----------

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#rgb` o `#rrggbb` (anche senza #) → componenti; null se non valido. */
export function hexToRgb(hex: string): Rgb | null {
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.replace(/./g, (c) => c + c);
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function rgbToHex(c: Rgb): string {
  const p = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return '#' + p(c.r) + p(c.g) + p(c.b);
}

/** Normalizza in `#rrggbb` minuscolo; null se non valido. */
export function normalizeHex(hex: string): string | null {
  const c = hexToRgb(hex);
  return c ? rgbToHex(c) : null;
}

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Numero per il CSS: al massimo `decimals` decimali, senza zeri inutili. */
export function num(n: number, decimals = 2): string {
  const f = 10 ** decimals;
  let r = (Math.sign(n) * Math.round(Math.abs(n) * f)) / f;
  if (Object.is(r, -0)) r = 0;
  return String(r);
}

/** Colore CSS: `#rrggbb` se opaco, altrimenti `rgba(r, g, b, a)`. */
export function cssColor(hex: string, alpha = 1): string {
  const c = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const a = clamp(alpha, 0, 1);
  if (a >= 1) return rgbToHex(c);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${num(a, 3)})`;
}

// ---------- gradiente ----------

export type GradientKind = 'linear' | 'radial' | 'conic';
export type RadialShape = 'circle' | 'ellipse';

export interface Stop {
  id: number;
  color: string; // #rrggbb
  alpha: number; // 0..1
  pos: number; // 0..100
}

export interface Gradient {
  kind: GradientKind;
  /** Angolo in gradi (linear: direzione; conic: punto di partenza). */
  angle: number;
  shape: RadialShape;
  /** Centro in % (radial e conic). */
  cx: number;
  cy: number;
  repeating: boolean;
  stops: Stop[];
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 12;

export function defaultGradient(): Gradient {
  return {
    kind: 'linear',
    angle: 135,
    shape: 'circle',
    cx: 50,
    cy: 50,
    repeating: false,
    stops: [
      { id: 1, color: '#6366f1', alpha: 1, pos: 0 },
      { id: 2, color: '#ec4899', alpha: 1, pos: 100 },
    ],
  };
}

export function sortedStops(stops: readonly Stop[]): Stop[] {
  return [...stops].sort((a, b) => a.pos - b.pos);
}

/** Valore CSS del gradiente, senza `background:` né `;`. */
export function gradientValue(g: Gradient): string {
  const stops = sortedStops(g.stops)
    .map((s) => `${cssColor(s.color, s.alpha)} ${num(clamp(s.pos, 0, 100))}%`)
    .join(', ');
  const prefix = g.repeating ? 'repeating-' : '';
  const angle = num(normalizeAngle(g.angle));
  const at = `${num(clamp(g.cx, 0, 100))}% ${num(clamp(g.cy, 0, 100))}%`;
  switch (g.kind) {
    case 'linear':
      return `${prefix}linear-gradient(${angle}deg, ${stops})`;
    case 'radial':
      return `${prefix}radial-gradient(${g.shape} at ${at}, ${stops})`;
    case 'conic':
      return `${prefix}conic-gradient(from ${angle}deg at ${at}, ${stops})`;
  }
}

/** Angolo riportato in 0..360 (360 resta 360 non serve: 0). */
export function normalizeAngle(a: number): number {
  if (!Number.isFinite(a)) return 0;
  return ((a % 360) + 360) % 360;
}

export function gradientCss(g: Gradient): string {
  return `background: ${gradientValue(g)};`;
}

/** Colore interpolato (RGB e alfa) in un punto della sequenza di stop. */
export function colorAt(stops: readonly Stop[], pos: number): { color: string; alpha: number } {
  const s = sortedStops(stops);
  if (s.length === 0) return { color: '#000000', alpha: 1 };
  if (pos <= s[0].pos) return { color: s[0].color, alpha: s[0].alpha };
  const last = s[s.length - 1];
  if (pos >= last.pos) return { color: last.color, alpha: last.alpha };
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i];
    const b = s[i + 1];
    if (pos >= a.pos && pos <= b.pos) {
      const t = b.pos === a.pos ? 0 : (pos - a.pos) / (b.pos - a.pos);
      const ca = hexToRgb(a.color) ?? { r: 0, g: 0, b: 0 };
      const cb = hexToRgb(b.color) ?? { r: 0, g: 0, b: 0 };
      return {
        color: rgbToHex({ r: ca.r + (cb.r - ca.r) * t, g: ca.g + (cb.g - ca.g) * t, b: ca.b + (cb.b - ca.b) * t }),
        alpha: a.alpha + (b.alpha - a.alpha) * t,
      };
    }
  }
  return { color: last.color, alpha: last.alpha };
}

export function nextStopId(stops: readonly Stop[]): number {
  return stops.reduce((m, s) => Math.max(m, s.id), 0) + 1;
}

/** Aggiunge uno stop nel mezzo del tratto più largo (o alla posizione data) con il colore interpolato. */
export function addStop(stops: readonly Stop[], pos?: number): Stop[] {
  if (stops.length >= MAX_STOPS) return [...stops];
  const s = sortedStops(stops);
  let at = pos;
  if (at === undefined) {
    let best = 0;
    let bestGap = -1;
    for (let i = 0; i < s.length - 1; i++) {
      const gap = s[i + 1].pos - s[i].pos;
      if (gap > bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    at = s.length >= 2 ? (s[best].pos + s[best + 1].pos) / 2 : 50;
  }
  const p = clamp(at, 0, 100);
  const c = colorAt(stops, p);
  return [...stops, { id: nextStopId(stops), color: c.color, alpha: c.alpha, pos: Math.round(p * 10) / 10 }];
}

/** Toglie uno stop, ma ne restano sempre almeno due. */
export function removeStop(stops: readonly Stop[], id: number): Stop[] {
  if (stops.length <= MIN_STOPS) return [...stops];
  return stops.filter((s) => s.id !== id);
}

export function updateStop(stops: readonly Stop[], id: number, patch: Partial<Omit<Stop, 'id'>>): Stop[] {
  return stops.map((s) => {
    if (s.id !== id) return s;
    const next = { ...s, ...patch };
    next.pos = clamp(next.pos, 0, 100);
    next.alpha = clamp(next.alpha, 0, 1);
    return next;
  });
}

export const GRADIENT_PRESETS: readonly { id: string; gradient: () => Gradient }[] = [
  {
    id: 'sunset',
    gradient: () => ({
      ...defaultGradient(),
      angle: 90,
      stops: [
        { id: 1, color: '#ff7e5f', alpha: 1, pos: 0 },
        { id: 2, color: '#feb47b', alpha: 1, pos: 100 },
      ],
    }),
  },
  {
    id: 'ocean',
    gradient: () => ({
      ...defaultGradient(),
      angle: 180,
      stops: [
        { id: 1, color: '#2193b0', alpha: 1, pos: 0 },
        { id: 2, color: '#6dd5ed', alpha: 1, pos: 100 },
      ],
    }),
  },
  {
    id: 'spot',
    gradient: () => ({
      ...defaultGradient(),
      kind: 'radial',
      stops: [
        { id: 1, color: '#fde68a', alpha: 1, pos: 0 },
        { id: 2, color: '#f59e0b', alpha: 1, pos: 60 },
        { id: 3, color: '#b45309', alpha: 1, pos: 100 },
      ],
    }),
  },
  {
    id: 'wheel',
    gradient: () => ({
      ...defaultGradient(),
      kind: 'conic',
      angle: 0,
      stops: [
        { id: 1, color: '#ef4444', alpha: 1, pos: 0 },
        { id: 2, color: '#eab308', alpha: 1, pos: 33 },
        { id: 3, color: '#22c55e', alpha: 1, pos: 66 },
        { id: 4, color: '#ef4444', alpha: 1, pos: 100 },
      ],
    }),
  },
];

// ---------- box-shadow ----------

export interface Shadow {
  id: number;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  alpha: number;
  inset: boolean;
}

export const MAX_SHADOWS = 8;

export function newShadow(id: number): Shadow {
  return { id, x: 0, y: 8, blur: 24, spread: 0, color: '#000000', alpha: 0.25, inset: false };
}

function len(n: number): string {
  const s = num(n);
  return s === '0' ? '0' : s + 'px';
}

/** Una singola ombra: `inset 0 4px 12px 0 rgba(...)`. Il blur negativo non è ammesso e diventa 0. */
export function shadowValue(s: Shadow): string {
  const parts = [len(s.x), len(s.y), len(Math.max(0, s.blur)), len(s.spread), cssColor(s.color, s.alpha)];
  return (s.inset ? 'inset ' : '') + parts.join(' ');
}

export function shadowsValue(shadows: readonly Shadow[]): string {
  return shadows.length === 0 ? 'none' : shadows.map(shadowValue).join(',\n    ');
}

export function shadowsCss(shadows: readonly Shadow[]): string {
  if (shadows.length === 0) return 'box-shadow: none;';
  if (shadows.length === 1) return `box-shadow: ${shadowValue(shadows[0])};`;
  return `box-shadow:\n    ${shadowsValue(shadows)};`;
}

/** Valore su una riga sola, per l'anteprima (`[style.box-shadow]`). */
export function shadowsInline(shadows: readonly Shadow[]): string {
  return shadows.length === 0 ? 'none' : shadows.map(shadowValue).join(', ');
}

export function updateShadow(shadows: readonly Shadow[], id: number, patch: Partial<Omit<Shadow, 'id'>>): Shadow[] {
  return shadows.map((s) => {
    if (s.id !== id) return s;
    const n = { ...s, ...patch };
    n.alpha = clamp(n.alpha, 0, 1);
    n.blur = Math.max(0, Number.isFinite(n.blur) ? n.blur : 0);
    for (const k of ['x', 'y', 'spread'] as const) if (!Number.isFinite(n[k])) n[k] = 0;
    return n;
  });
}

export const SHADOW_PRESETS: readonly { id: string; shadows: () => Shadow[] }[] = [
  { id: 'soft', shadows: () => [{ ...newShadow(1), y: 4, blur: 12, alpha: 0.15 }] },
  {
    id: 'layered',
    shadows: () => [
      { ...newShadow(1), y: 1, blur: 2, alpha: 0.12 },
      { ...newShadow(2), y: 4, blur: 8, alpha: 0.12 },
      { ...newShadow(3), y: 16, blur: 32, alpha: 0.12 },
    ],
  },
  { id: 'inner', shadows: () => [{ ...newShadow(1), y: 2, blur: 6, alpha: 0.3, inset: true }] },
  { id: 'hard', shadows: () => [{ ...newShadow(1), x: 6, y: 6, blur: 0, alpha: 1 }] },
];
