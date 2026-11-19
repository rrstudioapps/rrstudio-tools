// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
// Service worker scritto a mano (nessuna libreria). Il file pubblicato è generato da scripts/build-sw.mjs,
// che sostituisce il segnaposto dei dati con versione ed elenchi dei file. Conserva in cache solo i file del sito
// (pagine, script, stili, font): non salva nulla di ciò che l'utente inserisce negli strumenti.
'use strict';

const DATA = __SW_DATA__;
const { VERSION, SHELL, ALL, SIZE } = DATA;

// Web Share Target: logica pura di scripts/sw-share.mjs, incollata qui da build-sw.mjs.
/*__SW_SHARE__*/
const shareStore = new ShareStore();

const PREFIX = 'rrtools-';
const CACHE = `${PREFIX}v-${VERSION}`; // pagine e asset senza hash: una cache per versione
const STATIC = `${PREFIX}static`; // file con hash nel nome: immutabili, sopravvivono agli aggiornamenti
const MARKER = '/__offline-complete'; // segna che il download completo è stato fatto (per rifarlo dopo un aggiornamento)
const HASHED_RE = /-[A-Za-z0-9]{8}\.(js|css)$/;
const NAV_TIMEOUT = 3000;
const CONCURRENCY = 6;

const ALL_SET = new Set(ALL);
const PAGES = new Set(ALL.filter((u) => u.endsWith('/')));
const isHashed = (path) => HASHED_RE.test(path);
const targetCache = (path) => (isHashed(path) ? STATIC : CACHE);

// ---------------------------------------------------------------- installazione e attivazione

self.addEventListener('install', (event) => {
  // Nessun skipWaiting automatico: la nuova versione aspetta che l'utente la chieda dalla pagina.
  event.waitUntil(precache(SHELL));
});

async function precache(urls) {
  for (const url of urls) {
    const cache = await caches.open(targetCache(url));
    if (isHashed(url) && (await cache.match(url))) continue;
    const res = await fetch(new Request(url, { cache: 'reload' }));
    if (!res.ok) throw new Error(`precache ${url}: ${res.status}`);
    await cache.put(url, res);
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      let wasComplete = false;
      for (const k of keys) {
        if (!k.startsWith(PREFIX) || k === CACHE || k === STATIC) continue;
        if (!wasComplete && k.startsWith(`${PREFIX}v-`)) {
          wasComplete = !!(await (await caches.open(k)).match(MARKER));
        }
        await caches.delete(k);
      }
      // la cache statica tiene solo i file con hash ancora presenti in questa versione
      const stat = await caches.open(STATIC);
      for (const req of await stat.keys()) {
        if (!ALL_SET.has(new URL(req.url).pathname)) await stat.delete(req);
      }
      await self.clients.claim();
      // chi aveva scaricato tutto lo ritrova completo anche dopo l'aggiornamento (senza bloccare l'attivazione)
      if (wasComplete) downloadAll().catch(() => {});
    })(),
  );
});

// ---------------------------------------------------------------- richieste

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && isShareRequest(req.method, url.pathname)) {
    event.respondWith(receiveShare(req, event));
    return;
  }
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js' || req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    event.respondWith(navigation(req, url, event));
  } else if (isHashed(url.pathname)) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(staleWhileRevalidate(req, event));
  }
});

/** '/x' e '/x/' sono la stessa pagina; la query non conta. */
const pageKey = (url) => (url.pathname.endsWith('/') ? url.pathname : url.pathname + '/');

/** Pagine: prima la rete (al massimo 3 s se ho una copia), poi la STESSA pagina in cache, infine la pagina offline. */
async function navigation(req, url, event) {
  const key = pageKey(url);
  const cache = await caches.open(CACHE);
  const known = PAGES.has(key) && (url.pathname.endsWith('/') || !/\.[a-z0-9]+$/i.test(url.pathname));
  const cached = known ? await cache.match(key) : undefined;

  const network = fetch(req).then((res) => {
    // si salvano solo le pagine vere (nginx risponde 200 con la home anche a indirizzi inesistenti)
    if (known && res.ok && !res.redirected && url.pathname === key) cache.put(key, res.clone());
    return res;
  });

  if (!cached) {
    try {
      return await network;
    } catch {
      return offlinePage(url);
    }
  }
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT));
  try {
    const res = await Promise.race([network, timeout]);
    if (res && res.status < 500) return res;
  } catch {
    /* offline: copia in cache */
  }
  event.waitUntil(network.catch(() => {})); // la rete continua e aggiorna la copia per la prossima volta
  return cached;
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) (await caches.open(STATIC)).put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const update = fetch(req)
    .then((res) => {
      if (res.ok && res.status === 200) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  return (await update) ?? Response.error();
}

// ---------------------------------------------------------------- condivisione dal sistema (Web Share Target)

/**
 * Il POST del sistema non va in rete: si leggono i campi, si tengono SOLO in memoria (shareStore) e si rimanda
 * con un 303 alla pagina di ricezione, che li reclama con un messaggio ('share-claim'). Niente cache, niente IndexedDB.
 * Il worker resta vivo finché la pagina li ha presi o il tempo è scaduto, poi il contenuto viene dimenticato.
 */
async function receiveShare(req, event) {
  const lang = pickShareLang(req.headers.get('accept-language'));
  let data = null;
  try {
    data = readShare(await req.formData());
  } catch {
    data = null;
  }
  const to = (state) => new URL(sharePath(lang, state), self.location.origin).href;
  if (!data) return Response.redirect(to('retry'), 303);
  shareStore.put(data, Date.now());
  event.waitUntil(
    new Promise((resolve) => {
      const tick = setInterval(() => {
        if (!shareStore.pending) done();
      }, 500);
      const timer = setTimeout(() => {
        shareStore.clear();
        done();
      }, SHARE_TTL);
      function done() {
        clearInterval(tick);
        clearTimeout(timer);
        resolve();
      }
    }),
  );
  return Response.redirect(to('received'), 303);
}

// ---------------------------------------------------------------- pagina offline

const OFFLINE_TEXT = {
  it: {
    lang: 'it',
    title: 'Sei offline',
    body: 'Questa pagina non è stata salvata e non c’è connessione. Le pagine già visitate funzionano anche offline; per usare tutto il sito senza rete apri «Usa offline» in fondo a una pagina e scarica tutto.',
    retry: 'Riprova',
    home: 'Vai alla home',
    homeHref: '/',
  },
  en: {
    lang: 'en',
    title: 'You are offline',
    body: 'This page was not saved and there is no connection. Pages you have already visited also work offline; to use the whole site without a network open "Use offline" at the bottom of a page and download everything.',
    retry: 'Try again',
    home: 'Go to the home page',
    homeHref: '/en/',
  },
};

function offlinePage(url) {
  const t = url.pathname === '/en' || url.pathname.startsWith('/en/') ? OFFLINE_TEXT.en : OFFLINE_TEXT.it;
  const html = `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex"><title>${t.title} | rrstudio tools</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1rem;box-sizing:border-box;background:#f7f6f3;color:#1c1c1e;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){body{background:#121211;color:#f2f1ed}a,button{color:#f2f1ed!important;border-color:#55555a!important}}
main{max-width:34rem}h1{font-size:1.6rem;margin:0 0 .75rem}p{margin:0 0 1.25rem;color:inherit;opacity:.85}
.a{display:flex;flex-wrap:wrap;gap:.75rem}a,button{font:inherit;padding:.5rem 1rem;border:1px solid #1c1c1e;border-radius:6px;background:transparent;color:#1c1c1e;text-decoration:none;cursor:pointer}
</style></head><body><main><h1>${t.title}</h1><p>${t.body}</p><div class="a"><button type="button" onclick="location.reload()">${t.retry}</button><a href="${t.homeHref}">${t.home}</a></div></main></body></html>`;
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// ---------------------------------------------------------------- messaggi dalla pagina

let cancelled = false;
let downloading = null;

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg.type !== 'string') return;
  switch (msg.type) {
    case 'skipWaiting':
      self.skipWaiting();
      break;
    case 'share-claim': {
      // la pagina di ricezione reclama il contenuto condiviso: una sola volta, poi è dimenticato
      const d = shareStore.claim(Date.now());
      event.waitUntil(reply(event, d ? { type: 'share-data', ...d } : { type: 'share-none' }));
      break;
    }
    case 'status':
      event.waitUntil(status().then((s) => reply(event, { type: 'status', ...s })));
      break;
    case 'download':
      event.waitUntil(downloadAll().catch(() => {}));
      break;
    case 'cancel':
      cancelled = true;
      break;
    case 'cache-urls':
      event.waitUntil(cacheLoaded(Array.isArray(msg.urls) ? msg.urls : []));
      break;
    case 'clear':
      event.waitUntil(
        (async () => {
          cancelled = true;
          for (const k of await caches.keys()) if (k.startsWith(PREFIX)) await caches.delete(k);
          await reply(event, { type: 'status', ...(await status()) });
        })(),
      );
      break;
  }
});

async function reply(event, data) {
  const src = event.source;
  if (src && 'postMessage' in src) src.postMessage(data);
  else await broadcast(data);
}

async function broadcast(data) {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })) c.postMessage(data);
}

/** Percorsi presenti in cache (pagine e asset), per sapere cosa manca dell'elenco completo. */
async function cachedPaths() {
  const set = new Set();
  for (const name of [CACHE, STATIC]) {
    if (!(await caches.has(name))) continue;
    for (const r of await (await caches.open(name)).keys()) set.add(new URL(r.url).pathname);
  }
  return set;
}

async function status() {
  const have = await cachedPaths();
  const cached = ALL.filter((u) => have.has(u)).length;
  return { version: VERSION, size: SIZE, total: ALL.length, cached, ready: cached === ALL.length, downloading: !!downloading };
}

/** Scarica tutto l'elenco ALL (salta quello che c'è già), con avanzamento e possibilità di annullare. */
function downloadAll() {
  if (downloading) return downloading;
  cancelled = false;
  downloading = (async () => {
    const have = await cachedPaths();
    const todo = ALL.filter((u) => !have.has(u));
    const total = ALL.length;
    let done = total - todo.length;
    let failed = 0;
    const post = () => broadcast({ type: 'progress', done, total });
    await post();
    const queue = todo.slice();
    const worker = async () => {
      while (queue.length && !cancelled) {
        const url = queue.shift();
        let ok = false;
        for (let attempt = 0; attempt < 2 && !ok && !cancelled; attempt++) {
          try {
            // pagine e file senza hash si rivalidano; quelli con hash possono arrivare dalla cache HTTP
            const res = await fetch(new Request(url, { cache: isHashed(url) ? 'default' : 'no-cache' }));
            if (res.ok && res.status === 200) {
              await (await caches.open(targetCache(url))).put(url, res);
              ok = true;
            }
          } catch {
            /* ritenta una volta */
          }
        }
        if (ok) done++;
        else if (!cancelled) failed++;
        if (done % 4 === 0 || !queue.length) await post();
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (cancelled) {
      await broadcast({ type: 'download-cancelled', done, total });
    } else if (failed) {
      await broadcast({ type: 'download-error', done, total, failed });
    } else {
      await (await caches.open(CACHE)).put(MARKER, new Response('1'));
      await broadcast({ type: 'download-done', done, total });
    }
  })().finally(() => {
    downloading = null;
  });
  return downloading;
}

/** File già caricati dalla pagina (ad esempio i chunk lazy della prima visita, prima che il SW la controllasse). */
async function cacheLoaded(urls) {
  const have = await cachedPaths();
  for (const raw of urls.slice(0, 500)) {
    let path;
    try {
      const u = new URL(raw, self.location.origin);
      if (u.origin !== self.location.origin) continue;
      path = u.pathname;
    } catch {
      continue;
    }
    if (!ALL_SET.has(path) || have.has(path)) continue; // solo file del sito, mai altro
    try {
      const res = await fetch(new Request(path, { cache: 'default' }));
      if (res.ok && res.status === 200) await (await caches.open(targetCache(path))).put(path, res);
    } catch {
      /* sarà preso dal download completo */
    }
  }
}
