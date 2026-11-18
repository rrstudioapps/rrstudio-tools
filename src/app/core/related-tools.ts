// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { ToolDefinition } from '../tools/tools.registry';
import type { Lang } from './i18n/lang-routing';

/** Parole delle chiavi di ricerca di uno strumento (italiano e inglese), senza quelle troppo corte per distinguere. */
function words(t: ToolDefinition): Set<string> {
  const all = `${t.keywords?.it ?? ''} ${t.keywords?.en ?? ''}`.toLowerCase().split(/[^a-z0-9àèéìòù]+/);
  return new Set(all.filter((w) => w.length > 3));
}

/**
 * Strumenti affini a `current`, per i collegamenti in fondo alla pagina: stessa categoria, in ordine di parole chiave
 * in comune (a parità, l'ordine del registro, quindi il risultato è sempre lo stesso). Nella versione inglese salta gli strumenti solo italiani.
 */
export function relatedTools(current: ToolDefinition, all: readonly ToolDefinition[], lang: Lang, limit = 5): ToolDefinition[] {
  const mine = words(current);
  return all
    .map((t, order) => ({ t, order }))
    .filter(({ t }) => t.id !== current.id && t.category === current.category && (lang === 'it' || !t.italyOnly))
    .map(({ t, order }) => ({ t, order, score: [...words(t)].filter((w) => mine.has(w)).length }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(({ t }) => t);
}
