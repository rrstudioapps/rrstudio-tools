// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { SITE_URL } from '../links';
import { TOOLS } from '../../tools/tools.registry';

/**
 * Lingua e indirizzi. La lingua di una pagina la decide l'URL: la radice è italiana,
 * le versioni inglesi stanno sotto `/en/` (stesso slug: `/pdf-tools` ↔ `/en/pdf-tools`).
 * Gli strumenti `italyOnly` non hanno la versione inglese.
 */
export type Lang = 'it' | 'en';
export const LANGS: readonly Lang[] = ['it', 'en'];
export const EN_PREFIX = 'en';

/** Pagine informative statiche (non sono strumenti): esistono in entrambe le lingue, senza voce nel registry. */
export const STATIC_PAGES: readonly string[] = ['privacy'];

/**
 * Pagina personale dei preferiti: slug diverso per lingua (/preferiti, /en/favorites), noindex,
 * fuori da sitemap, hreflang e immagini social.
 */
export const FAVORITES_SLUG: Record<Lang, string> = { it: 'preferiti', en: 'favorites' };

export const isFavoritesSlug = (slug: string): boolean => slug === FAVORITES_SLUG.it || slug === FAVORITES_SLUG.en;

export interface Alternate {
  hreflang: string;
  href: string;
}

function segments(path: string): string[] {
  return path.split(/[?#]/)[0].split('/').filter(Boolean);
}

/** Lingua di un percorso: `en` se inizia con il segmento `en`, altrimenti `it`. */
export function langFromPath(path: string): Lang {
  return segments(path)[0] === EN_PREFIX ? 'en' : 'it';
}

/** Slug senza prefisso di lingua né slash ('' = home). */
export function slugFromPath(path: string): string {
  const s = segments(path);
  if (s[0] === EN_PREFIX) s.shift();
  return s.join('/');
}

/** Percorso per il router (link interni): '/', '/pdf-tools', '/en', '/en/pdf-tools'. */
export function routePath(slug: string, lang: Lang): string {
  const base = lang === 'en' ? `/${EN_PREFIX}` : '';
  return slug ? `${base}/${slug}` : base || '/';
}

/** URL pubblico assoluto (canonical, og:url, sitemap): la home inglese è `/en/`. */
export function publicUrl(slug: string, lang: Lang): string {
  if (lang === 'it') return `${SITE_URL}/${slug}`;
  return `${SITE_URL}/${EN_PREFIX}/${slug}`;
}

/** Vero se la pagina esiste nella lingua data (la home sempre, uno strumento italyOnly solo in italiano). */
export function hasLang(slug: string, lang: Lang): boolean {
  if (slug === '' || STATIC_PAGES.includes(slug)) return true;
  const tool = TOOLS.find((t) => t.path === slug);
  if (!tool) return false;
  return lang === 'it' || !tool.italyOnly;
}

/** Vero se esiste un'immagine social dedicata (home e pagine statiche usano quella generica). */
export function hasOgImage(slug: string, lang: Lang): boolean {
  return slug !== '' && !STATIC_PAGES.includes(slug) && hasLang(slug, lang);
}

/** Percorso della stessa pagina nell'altra lingua, o null se non esiste (strumento solo italiano). */
export function alternatePath(path: string, target: Lang): string | null {
  const slug = slugFromPath(path);
  if (isFavoritesSlug(slug)) return routePath(FAVORITES_SLUG[target], target);
  return hasLang(slug, target) ? routePath(slug, target) : null;
}

/** Link hreflang di una pagina: it, en e x-default (= inglese) se esistono entrambe, solo it altrimenti. */
export function hreflangLinks(slug: string): Alternate[] {
  const it: Alternate = { hreflang: 'it', href: publicUrl(slug, 'it') };
  if (!hasLang(slug, 'en')) return [it];
  const en = publicUrl(slug, 'en');
  return [it, { hreflang: 'en', href: en }, { hreflang: 'x-default', href: en }];
}

/** Slug di tutte le pagine italiane (home inclusa), nell'ordine del registry. */
export function allSlugs(): string[] {
  return ['', ...TOOLS.map((t) => t.path), ...STATIC_PAGES];
}

/** Sitemap completa: ogni URL italiana e inglese, con i link xhtml:link alternate. */
export function buildSitemap(): string {
  const entries: string[] = [];
  for (const slug of allSlugs()) {
    const langs: Lang[] = hasLang(slug, 'en') ? ['it', 'en'] : ['it'];
    for (const lang of langs) {
      const alts = hreflangLinks(slug)
        .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`)
        .join('\n');
      entries.push(`  <url>\n    <loc>${publicUrl(slug, lang)}</loc>\n${alts}\n  </url>`);
    }
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!-- SPDX-License-Identifier: AGPL-3.0-or-later · © 2026 rrstudio — rrstudio Tools -->\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    entries.join('\n') +
    '\n</urlset>\n'
  );
}
