// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { CHANGELOG, ChangeKind, ChangelogVersion } from './changelog';
import { CHANGELOG_SLUG, Lang, publicUrl } from './i18n/lang-routing';
import { SITE_NAME, SITE_URL } from './links';

/** Per quanti giorni uno strumento nuovo mostra il badge «Nuovo». */
export const NEW_TOOL_DAYS = 30;
/** Tetto ai badge «Nuovo»: se in un giorno escono più strumenti, lo portano i più recenti (le voci stanno dalla più recente). */
export const MAX_NEW_BADGES = 12;
/** Numero di versioni nel feed. */
export const FEED_VERSIONS = 20;

/** Percorso (sotto la radice del sito) del feed Atom di ogni lingua. */
export const FEED_PATH: Record<Lang, string> = { it: 'changelog.xml', en: 'changelog.en.xml' };

const DAY_MS = 86_400_000;

/** Giorni interi tra due date AAAA-MM-GG (calcolo in UTC: nessun fuso, nessun orario). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY_MS);
}

/** Giorno corrente AAAA-MM-GG (UTC) di un istante. */
export function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Id degli strumenti con voce `new-tool` nell'ULTIMA versione che contiene strumenti nuovi, solo se quella
 * versione è entro `days` giorni da `today` (AAAA-MM-GG). Una versione futura rispetto a `today` non conta.
 * Al massimo `max` id, presi dalle voci più recenti (quelle in cima alla versione).
 */
export function newToolIds(today: string, days = NEW_TOOL_DAYS, log: readonly ChangelogVersion[] = CHANGELOG, max = MAX_NEW_BADGES): Set<string> {
  const ids = new Set<string>();
  const latest = log.find((v) => v.entries.some((e) => e.kind === 'new-tool'));
  if (!latest) return ids;
  const age = daysBetween(latest.date, today);
  if (age < 0 || age >= days) return ids;
  for (const e of latest.entries) {
    if (e.kind !== 'new-tool') continue;
    for (const id of e.toolIds ?? []) if (ids.size < max) ids.add(id);
  }
  return ids;
}

/** Data più recente del changelog (riferimento quando non c'è altra data di build). */
export const latestChangelogDay = (log: readonly ChangelogVersion[] = CHANGELOG): string => log[0].date;

/** Data lunga nella lingua, da AAAA-MM-GG: "18 novembre 2026" / "18 November 2026". */
export function formatDay(day: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(day + 'T00:00:00Z'));
}

export const KIND_ORDER: readonly ChangeKind[] = ['new-tool', 'feature', 'improvement', 'fix'];

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Feed Atom di una lingua: ultime 20 versioni, testo semplice, nessun tracciamento. `kindLabel` dà l'etichetta del tipo. */
export function buildFeed(lang: Lang, kindLabel: (k: ChangeKind) => string, log: readonly ChangelogVersion[] = CHANGELOG): string {
  const page = publicUrl(CHANGELOG_SLUG[lang], lang);
  const self = `${SITE_URL}/${FEED_PATH[lang]}`;
  const versions = log.slice(0, FEED_VERSIONS);
  const items = versions.map((v) => {
    const list = v.entries.map((e) => `<li><strong>${esc(kindLabel(e.kind))}</strong>: ${esc(e[lang])}</li>`).join('');
    return (
      '  <entry>\n' +
      `    <id>${page}#${v.date}</id>\n` +
      `    <title>${esc(v.title[lang])}</title>\n` +
      `    <updated>${v.date}T00:00:00Z</updated>\n` +
      `    <link rel="alternate" type="text/html" href="${page}#v-${v.date}"/>\n` +
      `    <content type="html">${esc(`<ul>${list}</ul>`)}</content>\n` +
      '  </entry>'
    );
  });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!-- SPDX-License-Identifier: AGPL-3.0-or-later · © 2026 rrstudio — rrstudio Tools -->\n' +
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">\n` +
    `  <id>${page}</id>\n` +
    `  <title>${SITE_NAME}: ${lang === 'it' ? 'Novità' : "What's new"}</title>\n` +
    `  <updated>${versions[0].date}T00:00:00Z</updated>\n` +
    `  <link rel="self" type="application/atom+xml" href="${self}"/>\n` +
    `  <link rel="alternate" type="text/html" href="${page}"/>\n` +
    '  <author><name>rrstudio</name></author>\n' +
    items.join('\n') +
    '\n</feed>\n'
  );
}
