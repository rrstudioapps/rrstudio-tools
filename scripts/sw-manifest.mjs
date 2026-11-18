// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
// Logica pura (senza accesso al disco) con cui build-sw.mjs decide cosa mettere nel service worker:
// quali file sono pagine, quali asset, quali vanno precaricati all'installazione (SHELL) e quali
// scaricati su richiesta per l'uso offline completo (ALL). Testata in sw-manifest.test.mjs.

/** File con hash nel nome (stesso criterio di deploy/nginx.conf, più i chunk di esbuild con hash misto). */
export const HASHED_RE = /-[A-Za-z0-9]{8}\.(js|css)$/;

/** Estensioni di testo: comprimibili con gzip, per la stima del peso da scaricare. */
const TEXT_RE = /\.(html|js|mjs|css|json|txt|svg|csv|webmanifest|xml)$/i;

/** Percorsi (relativi alla radice della build) che non entrano mai nella cache offline. */
const EXCLUDED = [
  /^sw\.js$/,
  /^og\//,
  /^og-image\.png$/,
  /^sitemap\.xml$/,
  /^changelog(\.en)?\.xml$/, // feed Atom: lo leggono i lettori di feed, non serve offline
  /^robots\.txt$/,
  /^docs\//,
  /^3rdpartylicenses\.txt$/,
  /^prerendered-routes\.json$/,
  /\.map$/,
  /\.html$/, // le pagine si gestiscono a parte (solo index.html, come URL di navigazione)
];

/** Un CSV di esempio entra solo se piccolo: serve al download completo, non deve pesare. */
export const MAX_SAMPLE_BYTES = 150 * 1024;

/** Indirizzo di navigazione di una pagina prerenderizzata: 'index.html' -> '/', 'x/index.html' -> '/x/'. */
export function pageUrl(relPath) {
  if (relPath === 'index.html') return '/';
  if (relPath.endsWith('/index.html')) return '/' + relPath.slice(0, -'index.html'.length);
  return null;
}

/** Indirizzo di un asset: percorso relativo alla radice -> URL assoluto sul sito. */
export const assetUrl = (relPath) => '/' + relPath;

export const isHashed = (relPath) => HASHED_RE.test(relPath);

/** true se il file va escluso dalla cache offline. */
export function isExcluded(relPath, size = 0) {
  if (relPath.startsWith('samples/') && size > MAX_SAMPLE_BYTES) return true;
  // le pagine (index.html) non sono "asset": le gestisce pageUrl, quindi qui si escludono tutti gli .html
  return EXCLUDED.some((re) => re.test(relPath));
}

/** Riferimenti locali di una pagina HTML (script, stili, modulepreload, preload, icone, manifest). */
export function htmlRefs(html) {
  const out = new Set();
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = /\b(?:src|href)="([^"]+)"/i.exec(tag)?.[1];
    if (!attr) continue;
    const rel = /\brel="([^"]+)"/i.exec(tag)?.[1] ?? '';
    // link utili: stili, precaricamenti, icone, manifest; i canonical/alternate sono pagine, non asset
    if (/^link\b/i.test(tag) && !/(stylesheet|modulepreload|preload|icon|manifest)/i.test(rel)) continue;
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(attr) || /^[a-z][a-z0-9+.-]*:/i.test(attr)) continue; // origine esterna / data:
    const clean = attr.split(/[?#]/)[0];
    out.add(clean.startsWith('/') ? clean : '/' + clean);
  }
  return [...out];
}

/**
 * Costruisce gli elenchi del service worker.
 * @param {{path: string, size: number, gzip?: number}[]} files tutti i file della build (percorsi relativi, '/')
 * @param {Record<string, string>} htmlByUrl contenuto delle home da cui ricavare lo SHELL, es. {'/': '...', '/en/': '...'}
 * @returns {{shell: string[], all: string[], pages: string[], size: number}}
 */
export function buildLists(files, htmlByUrl) {
  const pages = [];
  const assets = [];
  let size = 0;
  for (const f of files) {
    const p = pageUrl(f.path);
    if (p) {
      pages.push(p);
      size += f.gzip ?? f.size;
      continue;
    }
    if (isExcluded(f.path, f.size)) continue;
    assets.push(assetUrl(f.path));
    size += TEXT_RE.test(f.path) ? (f.gzip ?? f.size) : f.size;
  }
  pages.sort();
  assets.sort();
  const known = new Set(assets);
  // SHELL: le due home e quello che dichiarano nell'HTML (se il file esiste davvero nella build), più manifest e icone
  const shell = new Set(['/', '/en/']);
  for (const html of Object.values(htmlByUrl)) {
    for (const ref of htmlRefs(html)) if (known.has(ref)) shell.add(ref);
  }
  for (const extra of ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png']) if (known.has(extra)) shell.add(extra);
  return { shell: [...shell].sort(), all: [...pages, ...assets], pages, size };
}

/** Ordina e unisce gli hash dei singoli file in una stringa da dare in pasto a un hash (indipendente dall'ordine di lettura). */
export function versionInput(entries) {
  return [...entries]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((e) => `${e.path}:${e.hash}`)
    .join('\n');
}
