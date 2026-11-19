// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Logica pura dell'anteprima dei meta tag: estrazione dall'HTML (DOMParser, senza eseguire script né
 * caricare risorse), valori effettivi come li usano motori di ricerca e social, controlli e generazione dello snippet.
 */

export interface MetaFields {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  favicon: string;
  themeColor: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  ogType: string;
  ogSiteName: string;
  ogLocale: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterSite: string;
}

export const FIELD_KEYS = [
  'title', 'description', 'canonical', 'robots', 'favicon', 'themeColor',
  'ogTitle', 'ogDescription', 'ogImage', 'ogUrl', 'ogType', 'ogSiteName', 'ogLocale',
  'twitterCard', 'twitterTitle', 'twitterDescription', 'twitterImage', 'twitterSite',
] as const satisfies readonly (keyof MetaFields)[];

export const emptyFields = (): MetaFields => Object.fromEntries(FIELD_KEYS.map((k) => [k, ''])) as unknown as MetaFields;

export interface Hreflang {
  lang: string;
  href: string;
}
export interface IconLink {
  rel: string;
  href: string;
  sizes: string;
}

/** Ciò che l'HTML contiene oltre ai campi: duplicati e tag senza un campo dedicato. */
export interface ParsedInfo {
  /** Quante volte compare ogni tag (solo se più di una). */
  duplicates: string[];
  hreflang: Hreflang[];
  icons: IconLink[];
  lang: string;
  viewport: string;
  charset: string;
  /** L'input contiene almeno un tag riconosciuto. */
  found: boolean;
}

export interface Parsed {
  fields: MetaFields;
  info: ParsedInfo;
}

const OG_MAP: Record<string, keyof MetaFields> = {
  'og:title': 'ogTitle',
  'og:description': 'ogDescription',
  'og:image': 'ogImage',
  'og:url': 'ogUrl',
  'og:type': 'ogType',
  'og:site_name': 'ogSiteName',
  'og:locale': 'ogLocale',
  'twitter:card': 'twitterCard',
  'twitter:title': 'twitterTitle',
  'twitter:description': 'twitterDescription',
  'twitter:image': 'twitterImage',
  'twitter:image:src': 'twitterImage',
  'twitter:site': 'twitterSite',
  description: 'description',
  robots: 'robots',
  'theme-color': 'themeColor',
};

/** Lunghezza massima dell'HTML analizzato (il resto si ignora: i meta tag stanno nell'`head`). */
export const MAX_HTML = 500_000;

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Estrae i meta tag da un documento HTML (o da un pezzo, come il solo `<head>`). Il documento creato da
 * DOMParser non ha una pagina: nessuno script gira e nessuna immagine, foglio di stile o link viene caricato.
 */
export function parseHtml(html: string): Parsed {
  const fields = emptyFields();
  const info: ParsedInfo = { duplicates: [], hreflang: [], icons: [], lang: '', viewport: '', charset: '', found: false };
  const doc = new DOMParser().parseFromString(html.slice(0, MAX_HTML), 'text/html');
  const counts = new Map<string, number>();
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  const setFirst = (key: keyof MetaFields, value: string) => {
    if (fields[key] === '') fields[key] = value;
  };

  const titles = doc.querySelectorAll('title');
  if (titles.length) {
    info.found = true;
    setFirst('title', clean(titles[0].textContent));
    titles.forEach(() => bump('title'));
  }
  for (const m of Array.from(doc.querySelectorAll('meta'))) {
    const name = (m.getAttribute('name') ?? m.getAttribute('property') ?? '').trim().toLowerCase();
    const content = clean(m.getAttribute('content'));
    if (m.hasAttribute('charset')) info.charset = clean(m.getAttribute('charset'));
    if (!name) continue;
    if (name === 'viewport') {
      info.viewport = content;
      continue;
    }
    const key = OG_MAP[name];
    if (!key) continue;
    info.found = true;
    bump(name === 'twitter:image:src' ? 'twitter:image' : name);
    setFirst(key, content);
  }
  for (const l of Array.from(doc.querySelectorAll('link'))) {
    const rel = clean(l.getAttribute('rel')).toLowerCase().split(' ');
    const href = clean(l.getAttribute('href'));
    if (rel.includes('canonical')) {
      info.found = true;
      bump('canonical');
      setFirst('canonical', href);
    } else if (rel.includes('alternate') && l.hasAttribute('hreflang')) {
      info.found = true;
      info.hreflang.push({ lang: clean(l.getAttribute('hreflang')), href });
    } else if (rel.some((r) => r === 'icon' || r === 'apple-touch-icon' || r === 'apple-touch-icon-precomposed' || r === 'mask-icon')) {
      info.found = true;
      info.icons.push({ rel: rel.join(' '), href, sizes: clean(l.getAttribute('sizes')) });
    }
  }
  // preferisce l'icona "icon" classica, poi quella Apple
  const best = info.icons.find((i) => /(^| )icon( |$)/.test(i.rel)) ?? info.icons[0];
  if (best) fields.favicon = best.href;
  info.lang = clean(doc.documentElement.getAttribute('lang'));
  info.duplicates = [...counts].filter(([, n]) => n > 1).map(([k]) => k);
  return { fields, info };
}

// ---------- valori effettivi (con i ripieghi che usano i servizi) ----------

export interface Effective {
  title: string;
  description: string;
  url: string;
  host: string;
  siteName: string;
  image: string;
  fbTitle: string;
  fbDescription: string;
  twitterCard: 'summary' | 'summary_large_image';
  twTitle: string;
  twDescription: string;
  twImage: string;
}

/** Risolve un indirizzo rispetto a una base; null se non è un indirizzo valido. */
export function resolveUrl(value: string, base?: string): URL | null {
  const v = value.trim();
  if (!v) return null;
  try {
    return new URL(v, base && isAbsoluteUrl(base) ? base : undefined);
  } catch {
    return null;
  }
}
export const isAbsoluteUrl = (v: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(v.trim());

/** Valori effettivi: Facebook/LinkedIn ripiegano su title e description, X su Open Graph e poi sulla pagina. */
export function effective(f: MetaFields): Effective {
  const url = f.ogUrl.trim() || f.canonical.trim();
  const abs = resolveUrl(url);
  const host = abs ? abs.host.replace(/^www\./, '') : '';
  const image = f.ogImage.trim();
  const twImage = f.twitterImage.trim() || image;
  const card = f.twitterCard.trim().toLowerCase();
  return {
    title: f.title.trim() || f.ogTitle.trim(),
    description: f.description.trim() || f.ogDescription.trim(),
    url,
    host,
    siteName: f.ogSiteName.trim() || host,
    image: image,
    fbTitle: f.ogTitle.trim() || f.title.trim(),
    fbDescription: f.ogDescription.trim() || f.description.trim(),
    twitterCard: card === 'summary' ? 'summary' : card === 'summary_large_image' ? 'summary_large_image' : twImage ? 'summary_large_image' : 'summary',
    twTitle: f.twitterTitle.trim() || f.ogTitle.trim() || f.title.trim(),
    twDescription: f.twitterDescription.trim() || f.ogDescription.trim() || f.description.trim(),
    twImage,
  };
}

/** Taglia il testo a `max` caratteri (come fanno i motori di ricerca), preferibilmente a fine parola, con i puntini di sospensione. */
export function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:-]+$/, '') + '…';
}

/** Come Google mostra l'indirizzo: dominio e percorso separati da ›. */
export function breadcrumb(url: string): { host: string; path: string } {
  const u = resolveUrl(url);
  if (!u || !/^https?:$/.test(u.protocol)) return { host: '', path: '' };
  const parts = u.pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  return { host: `${u.protocol}//${u.host}`, path: parts.join(' › ') };
}

// ---------- controlli ----------

export type Level = 'error' | 'warn' | 'info' | 'ok';
export interface Check {
  level: Level;
  /** Chiave del messaggio (`meta.check.<code>`). */
  code: string;
  params?: Record<string, string | number>;
}

export const LIMITS = {
  titleMin: 30,
  titleMax: 60,
  descMin: 70,
  descMax: 160,
  ogTitleMax: 70,
  ogDescMax: 200,
  twTitleMax: 70,
};
const TWITTER_CARDS = ['summary', 'summary_large_image', 'app', 'player'];
const HREFLANG = /^(x-default|[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?)$/i;

/** Controlli sui campi (e, se l'input era un HTML, sui duplicati e sugli altri tag trovati). */
export function checkMeta(f: MetaFields, info?: ParsedInfo): Check[] {
  const out: Check[] = [];
  const add = (level: Level, code: string, params?: Record<string, string | number>) => out.push({ level, code, params });
  const title = f.title.trim();
  const desc = f.description.trim();

  if (!title) add('error', 'titleMissing');
  else if (title.length > LIMITS.titleMax) add('warn', 'titleLong', { n: title.length, max: LIMITS.titleMax });
  else if (title.length < LIMITS.titleMin) add('warn', 'titleShort', { n: title.length, min: LIMITS.titleMin });
  else add('ok', 'titleOk', { n: title.length });

  if (!desc) add('warn', 'descMissing');
  else if (desc.length > LIMITS.descMax) add('warn', 'descLong', { n: desc.length, max: LIMITS.descMax });
  else if (desc.length < LIMITS.descMin) add('warn', 'descShort', { n: desc.length, min: LIMITS.descMin });
  else add('ok', 'descOk', { n: desc.length });

  const canonical = f.canonical.trim();
  if (!canonical) add('info', 'canonicalMissing');
  else if (!isAbsoluteUrl(canonical)) add('warn', 'canonicalRelative');
  else if (!/^https?:/i.test(canonical)) add('warn', 'canonicalProtocol');

  const robots = f.robots.toLowerCase();
  if (/\bnoindex\b|\bnone\b/.test(robots)) add('warn', 'noindex');
  if (/\bnofollow\b|\bnone\b/.test(robots)) add('info', 'nofollow');

  if (!f.favicon.trim()) add('info', 'faviconMissing');

  // Open Graph
  if (!f.ogTitle.trim()) add('warn', 'ogTitleMissing');
  else if (f.ogTitle.trim().length > LIMITS.ogTitleMax) add('warn', 'ogTitleLong', { n: f.ogTitle.trim().length, max: LIMITS.ogTitleMax });
  if (!f.ogDescription.trim()) add('warn', 'ogDescMissing');
  else if (f.ogDescription.trim().length > LIMITS.ogDescMax) add('warn', 'ogDescLong', { n: f.ogDescription.trim().length, max: LIMITS.ogDescMax });
  const img = f.ogImage.trim();
  if (!img) add('warn', 'ogImageMissing');
  else {
    if (!isAbsoluteUrl(img)) add('warn', 'ogImageRelative');
    else if (/^http:\/\//i.test(img)) add('warn', 'ogImageHttp');
  }
  if (!f.ogUrl.trim()) add('info', 'ogUrlMissing');
  else if (!isAbsoluteUrl(f.ogUrl)) add('warn', 'ogUrlRelative');
  if (!f.ogType.trim()) add('info', 'ogTypeMissing');
  if (f.ogUrl.trim() && canonical && isAbsoluteUrl(f.ogUrl) && isAbsoluteUrl(canonical) && f.ogUrl.trim() !== canonical) add('info', 'urlMismatch');

  // X / Twitter
  const card = f.twitterCard.trim();
  if (!card) add('info', 'twCardMissing');
  else if (!TWITTER_CARDS.includes(card.toLowerCase())) add('warn', 'twCardInvalid', { v: card });
  const twImg = f.twitterImage.trim();
  if (twImg && !isAbsoluteUrl(twImg)) add('warn', 'twImageRelative');
  if (!twImg && !img && card.toLowerCase() === 'summary_large_image') add('warn', 'twImageMissing');

  if (info) {
    for (const d of info.duplicates) add('warn', 'duplicate', { tag: d });
    for (const h of info.hreflang) {
      if (!HREFLANG.test(h.lang)) add('warn', 'hreflangInvalid', { v: h.lang });
      if (!isAbsoluteUrl(h.href)) add('warn', 'hreflangRelative', { v: h.lang });
    }
    if (info.hreflang.length > 0 && !info.hreflang.some((h) => h.lang.toLowerCase() === 'x-default')) add('info', 'hreflangNoDefault');
    if (info.found && !info.lang) add('info', 'langMissing');
    if (info.found && !info.viewport) add('info', 'viewportMissing');
  }
  return out;
}

// ---------- snippet ----------

export function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const escapeText = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Genera i meta tag HTML dai campi; i campi vuoti si omettono. */
export function buildSnippet(f: MetaFields): string {
  const lines: string[] = [];
  const meta = (attr: 'name' | 'property', key: string, value: string) => {
    if (value.trim()) lines.push(`<meta ${attr}="${key}" content="${escapeAttr(value.trim())}">`);
  };
  if (f.title.trim()) lines.push(`<title>${escapeText(f.title.trim())}</title>`);
  meta('name', 'description', f.description);
  meta('name', 'robots', f.robots);
  if (f.canonical.trim()) lines.push(`<link rel="canonical" href="${escapeAttr(f.canonical.trim())}">`);
  if (f.favicon.trim()) lines.push(`<link rel="icon" href="${escapeAttr(f.favicon.trim())}">`);
  meta('name', 'theme-color', f.themeColor);
  meta('property', 'og:type', f.ogType);
  meta('property', 'og:title', f.ogTitle);
  meta('property', 'og:description', f.ogDescription);
  meta('property', 'og:url', f.ogUrl);
  meta('property', 'og:image', f.ogImage);
  meta('property', 'og:site_name', f.ogSiteName);
  meta('property', 'og:locale', f.ogLocale);
  meta('name', 'twitter:card', f.twitterCard);
  meta('name', 'twitter:title', f.twitterTitle);
  meta('name', 'twitter:description', f.twitterDescription);
  meta('name', 'twitter:image', f.twitterImage);
  meta('name', 'twitter:site', f.twitterSite);
  return lines.join('\n');
}

/** Riepilogo dei livelli dei controlli. */
export function summarize(checks: readonly Check[]): Record<Level, number> {
  const s: Record<Level, number> = { error: 0, warn: 0, info: 0, ok: 0 };
  for (const c of checks) s[c.level]++;
  return s;
}
