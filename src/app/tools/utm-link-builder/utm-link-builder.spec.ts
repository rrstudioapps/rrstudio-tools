// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import {
  DEFAULT_OPTIONS, MAX_BULK_LINES, PRESETS, buildBulk, buildUtmLink, bulkToCsv, csvCell, normalizeValue, parseBulkLines, parseQuery,
  type UtmOptions, type UtmParams, type UtmResult,
} from './utm-link-builder';

const P: UtmParams = { source: 'newsletter', medium: 'email', campaign: 'spring' };
const NO_LOWER: UtmOptions = { lowercase: false, spaces: 'percent' };

function ok(r: UtmResult) {
  if (!r.ok) throw new Error('atteso ok, errore: ' + r.error);
  return r;
}
const codes = (r: UtmResult) => ok(r).warnings.map((w) => w.code);

describe('buildUtmLink: costruzione', () => {
  it('aggiunge i parametri nell\'ordine standard', () => {
    const r = ok(buildUtmLink('https://example.com/page', { ...P, term: 'shoes', content: 'banner', id: 'c1' }));
    expect(r.url).toBe('https://example.com/page?utm_source=newsletter&utm_medium=email&utm_campaign=spring&utm_id=c1&utm_term=shoes&utm_content=banner');
    expect(r.warnings).toEqual([]);
  });
  it('mantiene la query esistente', () => {
    const r = ok(buildUtmLink('https://example.com/p?a=1&b=2', P));
    expect(r.url).toBe('https://example.com/p?a=1&b=2&utm_source=newsletter&utm_medium=email&utm_campaign=spring');
  });
  it('il frammento resta in fondo', () => {
    const r = ok(buildUtmLink('https://example.com/p?a=1#sezione-2', P));
    expect(r.url.endsWith('&utm_campaign=spring#sezione-2')).toBe(true);
    expect(ok(buildUtmLink('https://example.com/p#top', P)).url).toBe('https://example.com/p?utm_source=newsletter&utm_medium=email&utm_campaign=spring#top');
  });
  it('mantiene la porta e il dominio senza percorso', () => {
    expect(ok(buildUtmLink('http://example.com:8080/x', P)).url.startsWith('http://example.com:8080/x?')).toBe(true);
    expect(ok(buildUtmLink('https://example.com', P)).url.startsWith('https://example.com/?utm_source')).toBe(true);
  });
  it('dominio e percorso unicode diventano un indirizzo valido (punycode e percentuale)', () => {
    const r = ok(buildUtmLink('https://bücher.de/straße', P));
    expect(r.url.startsWith('https://xn--bcher-kva.de/stra%C3%9Fe?utm_source=')).toBe(true);
    expect(/^[\x21-\x7e]+$/.test(r.url)).toBe(true);
  });
  it('senza campi non aggiunge né «?» né «&»', () => {
    const r = ok(buildUtmLink('https://example.com/p#x', {}));
    expect(r.url).toBe('https://example.com/p#x');
  });
});

describe('buildUtmLink: schema e sicurezza', () => {
  it('senza schema propone https:// con un avviso', () => {
    const r = ok(buildUtmLink('example.com/p', P));
    expect(r.url.startsWith('https://example.com/p?')).toBe(true);
    expect(r.warnings[0]).toEqual({ code: 'noScheme' });
    expect(codes(buildUtmLink('//example.com/p', P))).toContain('noScheme');
  });
  it('host con porta senza schema non è scambiato per uno schema', () => {
    const r = ok(buildUtmLink('localhost:3000/app', P));
    expect(r.url.startsWith('https://localhost:3000/app?')).toBe(true);
    expect(codes(buildUtmLink('example.com:8080', P))).toContain('noScheme');
  });
  it('rifiuta mailto:, javascript:, data:, ftp:, file:', () => {
    for (const u of ['mailto:a@b.it', 'javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://example.com/f', 'file:///etc/passwd', 'vbscript:x']) {
      expect(buildUtmLink(u, P)).toEqual({ ok: false, error: 'scheme' });
    }
  });
  it('rifiuta i trucchi con caratteri di controllo', () => {
    expect(buildUtmLink('java\tscript:alert(1)', P).ok).toBe(false);
    expect(buildUtmLink('https://exa\nmple.com', P)).toEqual({ ok: false, error: 'invalid' });
  });
  it('vuoto, solo spazi, troppo lungo, non valido', () => {
    expect(buildUtmLink('', P)).toEqual({ ok: false, error: 'empty' });
    expect(buildUtmLink('   ', P)).toEqual({ ok: false, error: 'empty' });
    expect(buildUtmLink('https://' + 'a'.repeat(2100) + '.com', P)).toEqual({ ok: false, error: 'tooLong' });
    expect(buildUtmLink('https://', P).ok).toBe(false);
    expect(buildUtmLink('http://[::', P).ok).toBe(false);
    expect(buildUtmLink('https://exa mple.com', P).ok).toBe(false);
  });
  it('segnala le credenziali nell\'indirizzo', () => {
    expect(codes(buildUtmLink('https://user:pw@example.com/', P))).toContain('credentials');
  });
});

describe('buildUtmLink: parametri esistenti', () => {
  it('i utm_* che ricompaiono sono sovrascritti, senza duplicati', () => {
    const r = ok(buildUtmLink('https://example.com/?utm_source=old&a=1&utm_source=older&UTM_Medium=x', P));
    expect(r.url).toBe('https://example.com/?a=1&utm_source=newsletter&utm_medium=email&utm_campaign=spring');
    const w = r.warnings.find((x) => x.code === 'overwritten');
    expect(w?.names).toEqual(['utm_source', 'utm_medium']);
  });
  it('altri utm_* non toccati restano', () => {
    const r = ok(buildUtmLink('https://example.com/?utm_term=k&utm_source_platform=sa360', P));
    expect(r.url).toContain('utm_term=k');
    expect(r.url).toContain('utm_source_platform=sa360');
    expect(r.url.match(/utm_source=/g)?.length).toBe(1);
  });
  it('un utm_* già nell\'indirizzo vale come presente (niente avviso di mancanza)', () => {
    const r = ok(buildUtmLink('https://example.com/?utm_campaign=c', { source: 's', medium: 'm' }));
    expect(codes(r)).not.toContain('missing');
  });
  it('segnala gclid e fbclid', () => {
    const r = ok(buildUtmLink('https://example.com/?gclid=abc&fbclid=def&x=1', P));
    expect(r.warnings.find((w) => w.code === 'tracking')?.names).toEqual(['gclid', 'fbclid']);
    expect(r.url.startsWith('https://example.com/?gclid=abc&fbclid=def&x=1&utm_source')).toBe(true);
  });
  it('mantiene parametri senza valore e con codifica originale', () => {
    const r = ok(buildUtmLink('https://example.com/?flag&q=a%20b&r=a+b', P));
    expect(r.url.startsWith('https://example.com/?flag&q=a%20b&r=a+b&utm_source')).toBe(true);
  });
});

describe('buildUtmLink: valori', () => {
  it('codifica & = # + e spazi', () => {
    const r = ok(buildUtmLink('https://example.com/', { ...P, campaign: 'a&b=c#d+e f' }));
    expect(r.url).toContain('utm_campaign=a%26b%3Dc%23d%2Be%20f');
    expect(r.query.find(([k]) => k === 'utm_campaign')?.[1]).toBe('a&b=c#d+e f');
    expect(r.url.includes('#')).toBe(false);
  });
  it('un valore con & non spezza altri parametri', () => {
    const r = ok(buildUtmLink('https://example.com/', { ...P, source: 'x&utm_medium=evil' }));
    expect(r.query.map(([k]) => k)).toEqual(['utm_source', 'utm_medium', 'utm_campaign']);
    expect(r.query[1][1]).toBe('email');
  });
  it('codifica emoji e caratteri come !\'()*', () => {
    const r = ok(buildUtmLink('https://example.com/', { ...P, content: 'sale 🔥!(x)*' }));
    expect(r.url).toContain('utm_content=sale%20%F0%9F%94%A5%21%28x%29%2A');
    expect(codes(r)).toContain('weird');
  });
  it('spazi con trattino', () => {
    const r = ok(buildUtmLink('https://example.com/', { ...P, campaign: 'Summer   Sale 2026' }, { lowercase: true, spaces: 'dash' }));
    expect(r.url).toContain('utm_campaign=summer-sale-2026');
    expect(r.warnings.find((w) => w.code === 'spaces')?.applied).toBe(true);
  });
  it('spazi come %20 con avviso', () => {
    const r = ok(buildUtmLink('https://example.com/', { ...P, campaign: 'a b' }));
    expect(r.url).toContain('utm_campaign=a%20b');
    expect(r.warnings.find((w) => w.code === 'spaces')?.applied).toBe(false);
  });
  it('maiuscole: convertite di default, avvisate sempre', () => {
    const a = ok(buildUtmLink('https://example.com/', { ...P, source: 'Newsletter' }));
    expect(a.url).toContain('utm_source=newsletter&');
    expect(a.warnings).toEqual([{ code: 'upper', field: 'source', applied: true }]);
    const b = ok(buildUtmLink('https://example.com/', { ...P, source: 'Newsletter' }, NO_LOWER));
    expect(b.url).toContain('utm_source=Newsletter&');
    expect(b.warnings).toEqual([{ code: 'upper', field: 'source', applied: false }]);
  });
  it('valori unicode in minuscolo', () => {
    const r = ok(buildUtmLink('https://example.com/', { ...P, campaign: 'ÉTÉ' }));
    expect(r.url).toContain('utm_campaign=%C3%A9t%C3%A9');
    expect(codes(r)).not.toContain('weird');
  });
  it('valori lunghi: avviso oltre 100 caratteri, errore oltre 500', () => {
    expect(codes(buildUtmLink('https://example.com/', { ...P, campaign: 'a'.repeat(101) }))).toContain('long');
    expect(codes(buildUtmLink('https://example.com/', { ...P, campaign: 'a'.repeat(100) }))).not.toContain('long');
    expect(buildUtmLink('https://example.com/', { ...P, campaign: 'a'.repeat(501) })).toEqual({ ok: false, error: 'valueTooLong' });
  });
  it('già codificato: il % viene segnalato e ricodificato', () => {
    const r = ok(buildUtmLink('https://example.com/', { ...P, campaign: 'a%20b' }));
    expect(r.url).toContain('utm_campaign=a%2520b');
    expect(codes(r)).toContain('weird');
  });
  it('surrogato spaiato: errore invece di eccezione', () => {
    expect(buildUtmLink('https://example.com/', { ...P, campaign: 'a\ud800b' })).toEqual({ ok: false, error: 'encoding' });
  });
  it('campi obbligatori mancanti: avviso non bloccante', () => {
    const r = ok(buildUtmLink('https://example.com/', { source: 's' }));
    expect(r.warnings.filter((w) => w.code === 'missing').map((w) => w.field)).toEqual(['medium', 'campaign']);
    expect(r.url).toBe('https://example.com/?utm_source=s');
  });
  it('valori solo spazi sono considerati vuoti', () => {
    const r = ok(buildUtmLink('https://example.com/', { ...P, term: '   ' }));
    expect(r.url).not.toContain('utm_term');
  });
  it('link molto lungo: avviso', () => {
    const r = ok(buildUtmLink('https://example.com/?' + 'q=' + 'x'.repeat(1930), P));
    expect(codes(r)).toContain('urlLong');
  });
});

describe('normalizeValue e parseQuery', () => {
  it('normalizza', () => {
    expect(normalizeValue('  Ab Cd ', 'term', DEFAULT_OPTIONS).value).toBe('ab cd');
    expect(normalizeValue('plain-text_1.2~', 'term', DEFAULT_OPTIONS).warnings).toEqual([]);
  });
  it('parseQuery decodifica, con % non validi senza eccezioni', () => {
    expect(parseQuery('?a=1&b=x%20y&c&d=%E0%A4%A&e=a+b')).toEqual([['a', '1'], ['b', 'x y'], ['c', ''], ['d', '%E0%A4%A'], ['e', 'a b']]);
    expect(parseQuery('')).toEqual([]);
  });
});

describe('parseBulkLines', () => {
  it('virgola, punto e virgola, spazi e tabulazione', () => {
    const { rows, errors } = parseBulkLines('facebook,social\ninstagram;social;story\nlinkedin social\nx\tsocial\tbio');
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 1, source: 'facebook', medium: 'social', content: '' },
      { line: 2, source: 'instagram', medium: 'social', content: 'story' },
      { line: 3, source: 'linkedin', medium: 'social', content: '' },
      { line: 4, source: 'x', medium: 'social', content: 'bio' },
    ]);
  });
  it('righe vuote ignorate ma contate; CRLF', () => {
    const { rows, errors } = parseBulkLines('a,b\r\n\r\n   \r\nc,d,e\r\nsolo');
    expect(rows.map((r) => r.line)).toEqual([1, 4]);
    expect(errors).toEqual([{ line: 5, text: 'solo', reason: 'format' }]);
  });
  it('righe malformate col numero di riga', () => {
    const { rows, errors } = parseBulkLines('ok,medium\nsolo\n,medium\nsource,\na,b,c,d\na b c d');
    expect(rows).toHaveLength(1);
    expect(errors).toEqual([
      { line: 2, text: 'solo', reason: 'format' },
      { line: 3, text: ',medium', reason: 'empty' },
      { line: 4, text: 'source,', reason: 'empty' },
      { line: 5, text: 'a,b,c,d', reason: 'tooMany' },
      { line: 6, text: 'a b c d', reason: 'tooMany' },
    ]);
  });
  it('testo vuoto', () => {
    expect(parseBulkLines('')).toEqual({ rows: [], errors: [] });
  });
  it('limite di righe: un solo errore', () => {
    const text = Array.from({ length: MAX_BULK_LINES + 5 }, (_, i) => `s${i},m`).join('\n');
    const { rows, errors } = parseBulkLines(text);
    expect(rows).toHaveLength(MAX_BULK_LINES);
    expect(errors).toEqual([{ line: MAX_BULK_LINES + 1, text: `s${MAX_BULK_LINES},m`, reason: 'limit' }]);
  });
});

describe('buildBulk e CSV', () => {
  const common: UtmParams = { campaign: 'spring', content: 'top' };
  const { rows } = parseBulkLines('Facebook,social\nnewsletter,email,footer');
  const links = buildBulk('https://example.com/p', common, rows);
  it('un link per riga, contenuto di riga che sostituisce quello comune', () => {
    expect(links).toHaveLength(2);
    const [a, b] = links.map((l) => ok(l.result).url);
    expect(a).toBe('https://example.com/p?utm_source=facebook&utm_medium=social&utm_campaign=spring&utm_content=top');
    expect(b).toBe('https://example.com/p?utm_source=newsletter&utm_medium=email&utm_campaign=spring&utm_content=footer');
  });
  it('indirizzo non valido: errore su ogni riga', () => {
    expect(buildBulk('javascript:x', common, rows).every((l) => !l.result.ok)).toBe(true);
  });
  it('CSV con intestazione e CRLF', () => {
    const csv = bulkToCsv(links, common);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('source,medium,campaign,term,content,id,url');
    expect(lines[1]).toBe('Facebook,social,spring,,top,,https://example.com/p?utm_source=facebook&utm_medium=social&utm_campaign=spring&utm_content=top');
    expect(lines).toHaveLength(4);
  });
  it('csvCell: virgolette e iniezione di formule', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@x')).toBe("'@x");
    expect(csvCell('ok')).toBe('ok');
  });
  it('CSV omette le righe con errore', () => {
    const bad = buildBulk('', common, rows);
    expect(bulkToCsv(bad, common)).toBe('source,medium,campaign,term,content,id,url\r\n');
  });
});

describe('preset', () => {
  it('ogni preset produce un link senza avvisi e source/medium in minuscolo', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['newsletter', 'facebook', 'instagram', 'linkedin', 'x', 'googleAds', 'telegram', 'whatsapp', 'qr']);
    for (const p of PRESETS) {
      const r = ok(buildUtmLink('https://example.com/', { source: p.source, medium: p.medium, campaign: 'c' }));
      expect(r.warnings).toEqual([]);
      expect(p.source).toBe(p.source.toLowerCase());
    }
    expect(PRESETS.find((p) => p.id === 'googleAds')).toMatchObject({ source: 'google', medium: 'cpc' });
  });
});
