// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { Lang, publicUrl } from '../core/i18n/lang-routing';
import { REPO_URL } from '../core/links';

export type FeedbackKind = 'bug' | 'enhancement' | 'new-tool';

const TEMPLATE: Record<FeedbackKind, string> = {
  bug: 'bug.yml',
  enhancement: 'enhancement.yml',
  'new-tool': 'new-tool.yml',
};
const LABEL: Record<FeedbackKind, string> = { bug: 'bug', enhancement: 'enhancement', 'new-tool': 'tool' };

/**
 * Indirizzo del modulo di issue GitHub precompilato. Contiene solo l'id dello strumento, la lingua e l'URL
 * canonico della pagina: mai hash né query (lo stato condiviso `#s=` può contenere dati dell'utente) né
 * i dati inseriti. `slug` è lo slug della pagina senza prefisso di lingua; se per errore contiene ? o #,
 * quella parte viene scartata.
 */
export function feedbackUrl(kind: FeedbackKind, opts: { toolId?: string; slug: string; lang: Lang }): string {
  const slug = opts.slug.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  const p = new URLSearchParams();
  p.set('template', TEMPLATE[kind]);
  p.set('labels', LABEL[kind]);
  if (kind === 'new-tool') {
    p.set('title', '[new tool] ');
  } else if (opts.toolId) {
    p.set('title', `[${opts.toolId}] `);
    p.set('tool', opts.toolId);
  }
  p.set('page', publicUrl(slug, opts.lang));
  p.set('lang', opts.lang);
  // URLSearchParams scrive lo spazio come "+": nei moduli GitHub meglio %20
  return `${REPO_URL}/issues/new?${p.toString().replace(/\+/g, '%20')}`;
}
