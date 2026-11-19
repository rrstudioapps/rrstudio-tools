// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { QrCode } from './qr-encoder';

/** Disegno del QR (SVG e canvas), contrasto dei colori e dimensione del logo. */

/** Quota massima del lato del simbolo occupata dal logo (con il suo riquadro): ~4% dell'area, ben dentro la correzione H. */
export const MAX_LOGO_FRACTION = 0.2;
export const MIN_LOGO_FRACTION = 0.08;

export interface RenderOptions {
  /** Moduli chiari attorno al simbolo (quiet zone). */
  margin: number;
  fg: string;
  bg: string;
  /** Logo al centro: data URL (immagine già ridotta) e quota del lato (0.08-0.2). */
  logo?: { dataUrl: string; fraction: number; width: number; height: number } | null;
}

/** Riquadro (in moduli) del logo al centro, già clampato al massimo consentito, e quello dell'immagine dentro. */
export function logoBox(qr: QrCode, o: NonNullable<RenderOptions['logo']>): { box: number; x: number; y: number; w: number; h: number } {
  const fraction = Math.min(MAX_LOGO_FRACTION, Math.max(MIN_LOGO_FRACTION, o.fraction));
  // dimensioni in moduli intere e dispari-coerenti con il centro: il riquadro resta centrato sul simbolo
  const box = Math.max(3, Math.floor(qr.size * fraction));
  const pad = Math.max(1, Math.round(box * 0.12));
  const inner = box - 2 * pad;
  const ratio = o.width > 0 && o.height > 0 ? o.width / o.height : 1;
  const w = ratio >= 1 ? inner : inner * ratio;
  const h = ratio >= 1 ? inner / ratio : inner;
  const c = qr.size / 2;
  return { box, x: c - w / 2, y: c - h / 2, w, h };
}

/** Elenco dei rettangoli scuri (x, y, larghezza) uniti per riga, senza i moduli coperti dal logo. */
export function darkRuns(qr: QrCode, hidden?: { x0: number; y0: number; x1: number; y1: number } | null): { x: number; y: number; w: number }[] {
  const runs: { x: number; y: number; w: number }[] = [];
  for (let y = 0; y < qr.size; y++) {
    let start = -1;
    for (let x = 0; x <= qr.size; x++) {
      const dark = x < qr.size && qr.modules[y][x] && !(hidden && x >= hidden.x0 && x < hidden.x1 && y >= hidden.y0 && y < hidden.y1);
      if (dark && start < 0) start = x;
      if (!dark && start >= 0) {
        runs.push({ x: start, y, w: x - start });
        start = -1;
      }
    }
  }
  return runs;
}

function hiddenArea(qr: QrCode, o: RenderOptions) {
  if (!o.logo) return null;
  const b = logoBox(qr, o.logo);
  const c = qr.size / 2;
  return { x0: Math.floor(c - b.box / 2), y0: Math.floor(c - b.box / 2), x1: Math.ceil(c + b.box / 2), y1: Math.ceil(c + b.box / 2) };
}

const escAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Colore esadecimale #rrggbb (solo questo formato entra nell'SVG). */
export function safeColor(c: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : fallback;
}

/** SVG vettoriale: un solo path per i moduli scuri, sfondo, e il logo su riquadro dello sfondo. */
export function toSvg(qr: QrCode, o: RenderOptions): string {
  const total = qr.size + 2 * o.margin;
  const fg = safeColor(o.fg, '#000000');
  const bg = safeColor(o.bg, '#ffffff');
  const hidden = hiddenArea(qr, o);
  const d = darkRuns(qr, hidden)
    .map((r) => `M${r.x + o.margin} ${r.y + o.margin}h${r.w}v1h-${r.w}z`)
    .join('');
  let logo = '';
  if (o.logo && hidden) {
    const b = logoBox(qr, o.logo);
    const m = o.margin;
    logo =
      `<rect x="${hidden.x0 + m}" y="${hidden.y0 + m}" width="${hidden.x1 - hidden.x0}" height="${hidden.y1 - hidden.y0}" fill="${bg}"/>` +
      `<image x="${+(b.x + m).toFixed(3)}" y="${+(b.y + m).toFixed(3)}" width="${+b.w.toFixed(3)}" height="${+b.h.toFixed(3)}" href="${escAttr(o.logo.dataUrl)}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="${bg}"/>` +
    `<path d="${d}" fill="${fg}"/>${logo}</svg>`
  );
}

/** Disegna il QR su un canvas quadrato di `px` pixel (tutto il canvas, margine compreso). */
export function drawToCanvas(
  ctx: CanvasRenderingContext2D,
  qr: QrCode,
  o: RenderOptions,
  px: number,
  logoImage?: CanvasImageSource | null,
): void {
  const total = qr.size + 2 * o.margin;
  const unit = px / total;
  // bordi arrotondati al pixel: moduli nitidi, senza fessure da antialiasing
  const edge = (n: number): number => Math.round(n * unit);
  ctx.fillStyle = safeColor(o.bg, '#ffffff');
  ctx.fillRect(0, 0, px, px);
  const hidden = hiddenArea(qr, o);
  ctx.fillStyle = safeColor(o.fg, '#000000');
  for (const r of darkRuns(qr, hidden)) {
    const x0 = edge(r.x + o.margin);
    const y0 = edge(r.y + o.margin);
    ctx.fillRect(x0, y0, edge(r.x + o.margin + r.w) - x0, edge(r.y + o.margin + 1) - y0);
  }
  if (o.logo && hidden && logoImage) {
    const b = logoBox(qr, o.logo);
    const m = o.margin;
    ctx.fillStyle = safeColor(o.bg, '#ffffff');
    const x0 = edge(hidden.x0 + m);
    const y0 = edge(hidden.y0 + m);
    ctx.fillRect(x0, y0, edge(hidden.x1 + m) - x0, edge(hidden.y1 + m) - y0);
    ctx.drawImage(logoImage, (b.x + m) * unit, (b.y + m) * unit, b.w * unit, b.h * unit);
  }
}

// ---- Contrasto ----

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const h = safeColor(hex, '#000000');
  return 0.2126 * channel(parseInt(h.slice(1, 3), 16)) + 0.7152 * channel(parseInt(h.slice(3, 5), 16)) + 0.0722 * channel(parseInt(h.slice(5, 7), 16));
}

/** Rapporto di contrasto WCAG (1-21) tra due colori. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Sotto questo rapporto la lettura diventa incerta (servono almeno ~3:1; meglio più di 4,5:1). */
export const MIN_CONTRAST = 3;

export type ContrastIssue = 'low' | 'inverted' | null;

/** 'low' se il contrasto è insufficiente, 'inverted' se il primo piano è più chiaro dello sfondo (molti lettori non leggono i QR in negativo). */
export function contrastIssue(fg: string, bg: string): ContrastIssue {
  if (contrastRatio(fg, bg) < MIN_CONTRAST) return 'low';
  return luminance(fg) > luminance(bg) ? 'inverted' : null;
}
