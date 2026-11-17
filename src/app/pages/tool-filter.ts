// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { CATEGORIES, ToolCategory, ToolCategoryId, ToolDefinition } from '../tools/tools.registry';

/** Minuscole e senza accenti, per confrontare "caffè" con "caffe". */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}

/** Parole della ricerca: tutte devono comparire nel testo del tool. */
export function searchTerms(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

/** Vero se ogni parola compare nel testo (già normalizzato) o se non ci sono parole. */
export function matchesTerms(haystack: string, terms: readonly string[]): boolean {
  return terms.every((t) => haystack.includes(t));
}

export interface ToolTexts {
  title: string;
  description: string;
}

/** Testo di ricerca di un tool: titolo, descrizione e parole chiave in entrambe le lingue. */
export function toolHaystack(tool: ToolDefinition, texts: ToolTexts): string {
  return normalizeText([texts.title, texts.description, tool.keywords?.it ?? '', tool.keywords?.en ?? ''].join(' '));
}

export interface ToolGroup {
  category: ToolCategory;
  tools: readonly ToolDefinition[];
}

/** Tool raggruppati per categoria nell'ordine di CATEGORIES (le categorie vuote non compaiono). */
export function groupByCategory(
  tools: readonly ToolDefinition[],
  categories: readonly ToolCategory[] = CATEGORIES,
): ToolGroup[] {
  return categories
    .map((category) => ({ category, tools: tools.filter((t) => t.category === category.id) }))
    .filter((g) => g.tools.length > 0);
}

/** Filtra per categoria (null = tutte) e ricerca. `texts` dà titolo e descrizione nella lingua corrente. */
export function filterTools(
  tools: readonly ToolDefinition[],
  category: ToolCategoryId | null,
  query: string,
  texts: (tool: ToolDefinition) => ToolTexts,
): ToolDefinition[] {
  const terms = searchTerms(query);
  return tools.filter(
    (t) => (category === null || t.category === category) && matchesTerms(toolHaystack(t, texts(t)), terms),
  );
}

/** Da slug (?categoria= in italiano, ?category= in inglese; qui si accettano entrambi) a id categoria; null se sconosciuto. */
export function categoryFromSlug(slug: string | null | undefined): ToolCategoryId | null {
  if (!slug) return null;
  const s = slug.trim().toLowerCase();
  return CATEGORIES.find((c) => c.slug === s || c.slugEn === s)?.id ?? null;
}

/** Categoria scelta da un URL: prima ?categoria= o ?category=, poi il fragment. */
export function categoryFromUrl(url: string): ToolCategoryId | null {
  const hashAt = url.indexOf('#');
  const hash = hashAt === -1 ? '' : url.slice(hashAt + 1);
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const q = beforeHash.indexOf('?');
  const params = q === -1 ? null : new URLSearchParams(beforeHash.slice(q + 1));
  const fromQuery = params?.get('categoria') ?? params?.get('category') ?? null;
  return categoryFromSlug(fromQuery) ?? categoryFromSlug(hash);
}

/** Filtro della home: una categoria, i preferiti dell'utente ('fav') o tutto (null). */
export type HomeFilter = ToolCategoryId | 'fav' | null;

/** Slug del filtro preferiti nell'URL della home (?categoria=preferiti, ?category=favorites). */
export const FAV_FILTER_SLUG = { it: 'preferiti', en: 'favorites' } as const;

/** Come categoryFromUrl, ma riconosce anche il filtro dei preferiti (solo dalla query, non dal fragment). */
export function homeFilterFromUrl(url: string): HomeFilter {
  const cat = categoryFromUrl(url);
  if (cat) return cat;
  const beforeHash = url.split('#')[0];
  const q = beforeHash.indexOf('?');
  if (q === -1) return null;
  const params = new URLSearchParams(beforeHash.slice(q + 1));
  const v = (params.get('categoria') ?? params.get('category') ?? '').trim().toLowerCase();
  return v === FAV_FILTER_SLUG.it || v === FAV_FILTER_SLUG.en ? 'fav' : null;
}
