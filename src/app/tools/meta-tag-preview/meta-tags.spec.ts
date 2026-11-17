// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  breadcrumb,
  buildSnippet,
  checkMeta,
  effective,
  emptyFields,
  escapeAttr,
  isAbsoluteUrl,
  parseHtml,
  resolveUrl,
  summarize,
  truncate,
  type MetaFields,
} from './meta-tags';

const FULL = `<!doctype html>
<html lang="it"><head>
<meta charset="utf-8">
<title>  Pizzeria da Mario - Napoli  </title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="La vera pizza napoletana, cotta nel forno a legna dal 1952 nel cuore di Napoli. Prenota il tuo tavolo online.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://www.example.com/it/">
<link rel="icon" href="/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/apple.png">
<link rel="alternate" hreflang="it" href="https://www.example.com/it/">
<link rel="alternate" hreflang="en" href="https://www.example.com/en/">
<link rel="alternate" hreflang="x-default" href="https://www.example.com/">
<meta property="og:title" content="Pizzeria da Mario">
<meta property="og:description" content="La vera pizza napoletana.">
<meta property="og:image" content="https://www.example.com/img/og.jpg">
<meta property="og:url" content="https://www.example.com/it/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Da Mario">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@damario">
<script>document.title = 'x'</script>
</head><body><img src="http://tracker.example/pixel.gif"></body></html>`;

describe('parseHtml', () => {
  it('estrae tutti i tag di un documento completo', () => {
    const { fields, info } = parseHtml(FULL);
    expect(fields.title).toBe('Pizzeria da Mario - Napoli');
    expect(fields.description).toContain('pizza napoletana');
    expect(fields.canonical).toBe('https://www.example.com/it/');
    expect(fields.robots).toBe('index, follow');
    expect(fields.favicon).toBe('/favicon.ico');
    expect(fields.ogTitle).toBe('Pizzeria da Mario');
    expect(fields.ogImage).toBe('https://www.example.com/img/og.jpg');
    expect(fields.ogUrl).toBe('https://www.example.com/it/');
    expect(fields.ogType).toBe('website');
    expect(fields.ogSiteName).toBe('Da Mario');
    expect(fields.twitterCard).toBe('summary_large_image');
    expect(fields.twitterSite).toBe('@damario');
    expect(info.lang).toBe('it');
    expect(info.viewport).toContain('width=device-width');
    expect(info.charset).toBe('utf-8');
    expect(info.hreflang.map((h) => h.lang)).toEqual(['it', 'en', 'x-default']);
    expect(info.icons).toHaveLength(2);
    expect(info.found).toBe(true);
    expect(info.duplicates).toEqual([]);
  });
  it('accetta anche il solo head o solo qualche tag', () => {
    const { fields } = parseHtml('<title>Solo titolo</title><meta name="description" content="d">');
    expect(fields.title).toBe('Solo titolo');
    expect(fields.description).toBe('d');
  });
  it('non esegue gli script', () => {
    (globalThis as Record<string, unknown>)['__ran'] = false;
    parseHtml('<title>t</title><script>globalThis.__ran = true</script><img src=x onerror="globalThis.__ran = true">');
    expect((globalThis as Record<string, unknown>)['__ran']).toBe(false);
  });
  it('rileva i duplicati e tiene il primo valore', () => {
    const { fields, info } = parseHtml(
      '<title>A</title><title>B</title><meta name="description" content="uno"><meta name="description" content="due"><link rel="canonical" href="https://a.it/"><link rel="canonical" href="https://b.it/"><meta property="og:title" content="x"><meta property="og:title" content="y">',
    );
    expect(fields.title).toBe('A');
    expect(fields.description).toBe('uno');
    expect(fields.canonical).toBe('https://a.it/');
    expect(fields.ogTitle).toBe('x');
    expect(info.duplicates.sort()).toEqual(['canonical', 'description', 'og:title', 'title']);
  });
  it('nomi in maiuscolo, twitter con property e twitter:image:src', () => {
    const { fields } = parseHtml('<meta NAME="Description" content="d"><meta property="twitter:card" content="summary"><meta name="twitter:image:src" content="https://a.it/i.png">');
    expect(fields.description).toBe('d');
    expect(fields.twitterCard).toBe('summary');
    expect(fields.twitterImage).toBe('https://a.it/i.png');
  });
  it('input vuoto o senza tag: nessun errore, found false', () => {
    expect(parseHtml('').info.found).toBe(false);
    expect(parseHtml('ciao <b>mondo</b>').fields).toEqual(emptyFields());
  });
  it('compatta gli spazi e gestisce le entità', () => {
    expect(parseHtml('<title>Caff&egrave;\n   &amp;   co</title>').fields.title).toBe('Caffè & co');
  });
  it('l\'icona "icon" ha la precedenza su quella Apple', () => {
    const { fields } = parseHtml('<link rel="apple-touch-icon" href="/a.png"><link rel="shortcut icon" href="/f.ico">');
    expect(fields.favicon).toBe('/f.ico');
  });
});

describe('effective', () => {
  it('ripiega su title/description per Open Graph e su Open Graph per X', () => {
    const f = { ...emptyFields(), title: 'T', description: 'D', canonical: 'https://www.sito.it/a/b' };
    const e = effective(f);
    expect(e.fbTitle).toBe('T');
    expect(e.fbDescription).toBe('D');
    expect(e.twTitle).toBe('T');
    expect(e.host).toBe('sito.it');
    expect(e.siteName).toBe('sito.it');
    expect(e.twitterCard).toBe('summary');
  });
  it('la card di X: esplicita, oppure large se c\'è un\'immagine', () => {
    const base = { ...emptyFields(), ogImage: 'https://a.it/i.png' };
    expect(effective(base).twitterCard).toBe('summary_large_image');
    expect(effective({ ...base, twitterCard: 'summary' }).twitterCard).toBe('summary');
    expect(effective({ ...base, twitterCard: 'SUMMARY_LARGE_IMAGE' }).twitterCard).toBe('summary_large_image');
  });
  it('i campi propri di X vincono su quelli Open Graph', () => {
    const f = { ...emptyFields(), ogTitle: 'og', twitterTitle: 'tw', ogImage: 'https://a.it/1.png', twitterImage: 'https://a.it/2.png' };
    const e = effective(f);
    expect(e.twTitle).toBe('tw');
    expect(e.twImage).toBe('https://a.it/2.png');
  });
});

describe('utilità', () => {
  it('truncate rispetta il massimo e taglia a fine parola', () => {
    expect(truncate('breve', 60)).toBe('breve');
    const t = truncate('una frase molto lunga che deve essere tagliata in modo ragionevole alla fine', 30);
    expect(t.length).toBeLessThanOrEqual(30);
    expect(t.endsWith('…')).toBe(true);
    expect(t).not.toMatch(/\s…$/);
    expect(truncate('x'.repeat(100), 10)).toBe('x'.repeat(9) + '…');
  });
  it('breadcrumb', () => {
    expect(breadcrumb('https://www.example.com/it/blog/ciao%20mondo')).toEqual({ host: 'https://www.example.com', path: 'it › blog › ciao mondo' });
    expect(breadcrumb('https://example.com/')).toEqual({ host: 'https://example.com', path: '' });
    expect(breadcrumb('non un url')).toEqual({ host: '', path: '' });
    expect(breadcrumb('javascript:alert(1)')).toEqual({ host: '', path: '' });
  });
  it('isAbsoluteUrl e resolveUrl', () => {
    expect(isAbsoluteUrl('https://a.it')).toBe(true);
    expect(isAbsoluteUrl('//a.it/x')).toBe(false);
    expect(isAbsoluteUrl('/x.png')).toBe(false);
    expect(resolveUrl('/x.png', 'https://a.it/p')?.href).toBe('https://a.it/x.png');
    expect(resolveUrl('')).toBeNull();
    expect(resolveUrl('/x.png')).toBeNull();
  });
  it('escapeAttr', () => {
    expect(escapeAttr('a "b" <c> & d')).toBe('a &quot;b&quot; &lt;c&gt; &amp; d');
  });
});

describe('checkMeta', () => {
  const codes = (f: Partial<MetaFields>, info?: Parameters<typeof checkMeta>[1]) => checkMeta({ ...emptyFields(), ...f }, info).map((c) => c.code);
  const good: Partial<MetaFields> = {
    title: 'Pizzeria da Mario - la vera pizza di Napoli',
    description: 'La vera pizza napoletana, cotta nel forno a legna dal 1952 nel cuore di Napoli. Prenota il tuo tavolo.',
    canonical: 'https://www.example.com/',
    favicon: '/favicon.ico',
    ogTitle: 'Pizzeria da Mario',
    ogDescription: 'La vera pizza napoletana.',
    ogImage: 'https://www.example.com/og.jpg',
    ogUrl: 'https://www.example.com/',
    ogType: 'website',
    twitterCard: 'summary_large_image',
  };
  it('una pagina completa non ha avvisi né errori', () => {
    const s = summarize(checkMeta({ ...emptyFields(), ...good }));
    expect(s.error).toBe(0);
    expect(s.warn).toBe(0);
    expect(s.ok).toBe(2);
  });
  it('tag mancanti', () => {
    const c = codes({});
    expect(c).toContain('titleMissing');
    expect(c).toContain('descMissing');
    expect(c).toContain('ogImageMissing');
    expect(c).toContain('ogTitleMissing');
    expect(c).toContain('canonicalMissing');
    expect(c).toContain('faviconMissing');
  });
  it('lunghezze', () => {
    expect(codes({ title: 'x'.repeat(LIMITS.titleMax + 1) })).toContain('titleLong');
    expect(codes({ title: 'corto' })).toContain('titleShort');
    expect(codes({ description: 'x'.repeat(LIMITS.descMax + 1) })).toContain('descLong');
    expect(codes({ description: 'corta' })).toContain('descShort');
    expect(codes({ ogDescription: 'x'.repeat(LIMITS.ogDescMax + 1) })).toContain('ogDescLong');
  });
  it('indirizzi relativi e http', () => {
    expect(codes({ ...good, ogImage: '/og.jpg' })).toContain('ogImageRelative');
    expect(codes({ ...good, ogImage: 'http://a.it/og.jpg' })).toContain('ogImageHttp');
    expect(codes({ ...good, canonical: '/pagina' })).toContain('canonicalRelative');
    expect(codes({ ...good, ogUrl: 'pagina' })).toContain('ogUrlRelative');
    expect(codes({ ...good, twitterImage: '/t.png' })).toContain('twImageRelative');
  });
  it('robots, card non valida, immagine mancante per la card grande', () => {
    expect(codes({ ...good, robots: 'noindex, nofollow' })).toEqual(expect.arrayContaining(['noindex', 'nofollow']));
    expect(codes({ ...good, twitterCard: 'grande' })).toContain('twCardInvalid');
    expect(codes({ ...good, ogImage: '', twitterCard: 'summary_large_image' })).toContain('twImageMissing');
  });
  it('og:url diverso dal canonical è solo informativo', () => {
    const c = checkMeta({ ...emptyFields(), ...good, ogUrl: 'https://www.example.com/altro' }).find((x) => x.code === 'urlMismatch');
    expect(c?.level).toBe('info');
  });
  it('duplicati e hreflang dall\'HTML', () => {
    const { fields, info } = parseHtml('<title>A</title><title>B</title><link rel="alternate" hreflang="italiano" href="/it"><link rel="alternate" hreflang="en" href="https://a.it/en">');
    const c = checkMeta(fields, info).map((x) => x.code);
    expect(c).toContain('duplicate');
    expect(c).toContain('hreflangInvalid');
    expect(c).toContain('hreflangRelative');
    expect(c).toContain('hreflangNoDefault');
    expect(c).toContain('langMissing');
    expect(c).toContain('viewportMissing');
  });
  it('il documento completo di esempio non ha duplicati né hreflang errati', () => {
    const { fields, info } = parseHtml(FULL);
    const c = checkMeta(fields, info).map((x) => x.code);
    expect(c).not.toContain('duplicate');
    expect(c).not.toContain('hreflangInvalid');
    expect(c).not.toContain('hreflangNoDefault');
  });
});

describe('buildSnippet', () => {
  it('genera solo i tag compilati, con gli attributi protetti', () => {
    const s = buildSnippet({ ...emptyFields(), title: 'A & B <c>', description: 'Dice "ciao"', ogImage: 'https://a.it/i.png?x=1&y=2', twitterCard: 'summary' });
    expect(s).toBe(
      [
        '<title>A &amp; B &lt;c&gt;</title>',
        '<meta name="description" content="Dice &quot;ciao&quot;">',
        '<meta property="og:image" content="https://a.it/i.png?x=1&amp;y=2">',
        '<meta name="twitter:card" content="summary">',
      ].join('\n'),
    );
  });
  it('vuoto se non c\'è nulla', () => {
    expect(buildSnippet(emptyFields())).toBe('');
  });
  it('il risultato rilegge gli stessi campi (andata e ritorno)', () => {
    const { fields } = parseHtml(FULL);
    const again = parseHtml(buildSnippet(fields)).fields;
    expect(again).toEqual(fields);
  });
});
