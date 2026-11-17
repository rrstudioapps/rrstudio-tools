// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

export interface SvgOptions {
  /** Cifre decimali dei numeri (0-8). */
  precision: number;
  /** Toglie l'attributo viewBox: di norma NO, perché serve a scalare l'immagine. */
  removeViewBox: boolean;
  removeMetadata: boolean;
  removeComments: boolean;
  /** Toglie <title> e <desc> (attenzione: sono usati dai lettori di schermo). */
  removeTitle: boolean;
  /** Toglie width e height e lascia solo il viewBox. */
  removeDimensions: boolean;
  /** Accorcia e rinomina gli id (può rompere riferimenti esterni da CSS o JavaScript). */
  minifyIds: boolean;
  /** Codice indentato e leggibile invece che compatto. */
  pretty: boolean;
}

export const DEFAULT_OPTIONS: SvgOptions = {
  precision: 3,
  removeViewBox: false,
  removeMetadata: true,
  removeComments: true,
  removeTitle: false,
  removeDimensions: false,
  minifyIds: false,
  pretty: false,
};

export const MIN_PRECISION = 0;
export const MAX_PRECISION = 8;

export function clampPrecision(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_OPTIONS.precision;
  return Math.min(MAX_PRECISION, Math.max(MIN_PRECISION, Math.trunc(n)));
}

export type SvgError = 'empty' | 'not-svg' | 'parse';

export type SvgResult =
  | { ok: true; data: string; before: number; after: number; savedBytes: number; savedPercent: number }
  | { ok: false; error: SvgError; detail?: string };

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Configurazione svgo: preset predefinito (sicuro) più le scelte dell'utente. */
export function buildConfig(opts: SvgOptions): Record<string, unknown> {
  const overrides: Record<string, false> = {};
  if (!opts.removeMetadata) overrides['removeMetadata'] = false;
  if (!opts.removeComments) overrides['removeComments'] = false;
  if (!opts.minifyIds) overrides['cleanupIds'] = false;
  if (!opts.removeTitle) overrides['removeDesc'] = false;
  const plugins: unknown[] = [{ name: 'preset-default', params: { overrides } }];
  if (opts.removeViewBox) plugins.push('removeViewBox');
  if (opts.removeTitle) plugins.push('removeTitle');
  if (opts.removeDimensions && !opts.removeViewBox) plugins.push('removeDimensions');
  return {
    multipass: true,
    floatPrecision: clampPrecision(opts.precision),
    js2svg: opts.pretty ? { pretty: true, indent: 2 } : { pretty: false },
    plugins,
  };
}

/** Ottimizza un SVG con svgo (caricato solo qui, nel chunk lazy). */
export async function optimizeSvg(input: string, opts: SvgOptions = DEFAULT_OPTIONS): Promise<SvgResult> {
  const text = input.replace(/^﻿/, '');
  if (text.trim() === '') return { ok: false, error: 'empty' };
  if (!/<svg[\s>/]/i.test(text)) return { ok: false, error: 'not-svg' };
  try {
    const { optimize } = await import('svgo/browser');
    const out = optimize(text, buildConfig(opts) as Parameters<typeof optimize>[1]);
    const data = out.data;
    if (!/<svg[\s>/]/i.test(data)) return { ok: false, error: 'not-svg' };
    const before = byteLength(text);
    const after = byteLength(data);
    return {
      ok: true,
      data,
      before,
      after,
      savedBytes: before - after,
      savedPercent: before === 0 ? 0 : Math.round(((before - after) / before) * 1000) / 10,
    };
  } catch (e) {
    return { ok: false, error: 'parse', detail: e instanceof Error ? e.message.split('\n')[0] : String(e) };
  }
}

/** URL `data:` per mostrare l'SVG in un <img>: gli script dentro un'immagine non vengono mai eseguiti. */
export function svgDataUrl(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Nome del file ottimizzato: `logo.svg` → `logo.min.svg`. */
export function optimizedName(name: string): string {
  const base = name.replace(/\.svg$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'image';
  return `${base}.min.svg`;
}

/** Nomi unici dentro lo ZIP: se due file hanno lo stesso nome si aggiunge -2, -3… */
export function uniqueNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((n) => {
    let candidate = n;
    let i = 2;
    const dot = n.lastIndexOf('.');
    const stem = dot > 0 ? n.slice(0, dot) : n;
    const ext = dot > 0 ? n.slice(dot) : '';
    while (used.has(candidate.toLowerCase())) candidate = `${stem}-${i++}${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 2 : 1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
