// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { matchesTerms, normalizeText, searchTerms } from '../pages/tool-filter';

/** Voce della palette: testi già nella lingua corrente. */
export interface PaletteItem {
  id: string;
  title: string;
  description: string;
  /** Parole chiave (non mostrate), in entrambe le lingue. */
  keywords: string;
}

/**
 * Cerca nella palette (Ctrl/⌘+K): ogni parola deve comparire in titolo, descrizione o parole chiave.
 * Ordine: titolo che inizia con la ricerca, titolo che la contiene, parola del titolo che inizia con la prima parola,
 * poi il resto nell'ordine originale. Senza ricerca restituisce le voci nell'ordine dato.
 */
export function searchPalette<T extends PaletteItem>(items: readonly T[], query: string, limit = 50): T[] {
  const terms = searchTerms(query);
  if (!terms.length) return items.slice(0, limit);
  const q = normalizeText(query).trim();
  const scored: { item: T; score: number; i: number }[] = [];
  items.forEach((item, i) => {
    const title = normalizeText(item.title);
    const hay = normalizeText([item.title, item.description, item.keywords].join(' '));
    if (!matchesTerms(hay, terms)) return;
    let score = 3;
    if (title.startsWith(q)) score = 0;
    else if (title.includes(q)) score = 1;
    else if (title.split(/[\s\-/()]+/).some((w) => w.startsWith(terms[0]))) score = 2;
    scored.push({ item, score, i });
  });
  scored.sort((a, b) => a.score - b.score || a.i - b.i);
  return scored.slice(0, limit).map((s) => s.item);
}
