// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
// Logica pura (senza API del service worker) del Web Share Target: build-sw.mjs la incolla dentro sw.js
// (toglie le parole `export`), i test la importano così com'è (sw-share.test.mjs).
//
// Flusso: il sistema invia un POST multipart a /condividi/; il service worker legge i campi, li tiene SOLO in
// memoria in un `ShareStore` (mai cache, mai IndexedDB), risponde con un redirect 303 alla pagina di ricezione
// e la pagina li reclama con un messaggio. Il contenuto si consegna una volta sola e scade dopo SHARE_TTL.

/** Indirizzo a cui il sistema invia il contenuto condiviso (deve coincidere con `share_target.action` del manifest). */
export const SHARE_ACTION = '/condividi/';
/** Pagina di ricezione per lingua (come /preferiti e /en/favorites). */
export const SHARE_PATHS = { it: '/condividi/', en: '/en/share/' };
/** Dopo quanto un contenuto non reclamato dalla pagina viene scartato. */
export const SHARE_TTL = 60_000;
/** Limiti prudenti: oltre, il contenuto in eccesso viene ignorato. */
export const SHARE_MAX_FILES = 20;
export const SHARE_MAX_TEXT = 1_000_000;

/** Vero se la richiesta è l'invio del Web Share Target. */
export function isShareRequest(method, pathname) {
  return method === 'POST' && (pathname === SHARE_ACTION || pathname === SHARE_ACTION.slice(0, -1));
}

/** Lingua della pagina di ricezione dall'intestazione Accept-Language: inglese solo se è la prima preferenza. */
export function pickShareLang(acceptLanguage) {
  const first = String(acceptLanguage ?? '').split(',')[0].trim().toLowerCase();
  return first === 'en' || first.startsWith('en-') || first.startsWith('en;') ? 'en' : 'it';
}

/** Indirizzo (relativo) a cui rimandare dopo il POST: `received` = dati in attesa nel SW, `retry` = non letti. */
export function sharePath(lang, state) {
  return SHARE_PATHS[lang] + (state === 'retry' ? '?retry=1' : '?received=1');
}

const isFile = (v) => !!v && typeof v === 'object' && typeof v.name === 'string' && typeof v.size === 'number' && typeof v.slice === 'function';
const clip = (v) => (typeof v === 'string' ? v.slice(0, SHARE_MAX_TEXT) : '');

/**
 * Estrae i campi condivisi da un FormData: title, text, url e i file (campo `files`). Restituisce null se non
 * c'è nulla di utilizzabile.
 */
export function readShare(formData) {
  const title = clip(formData.get('title'));
  const text = clip(formData.get('text'));
  const url = clip(formData.get('url'));
  const files = formData.getAll('files').filter((f) => isFile(f) && f.size > 0).slice(0, SHARE_MAX_FILES);
  if (!title.trim() && !text.trim() && !url.trim() && files.length === 0) return null;
  return { title, text, url, files };
}

/** Un solo contenuto in attesa, in memoria, consegnato una sola volta e scaduto dopo `ttl` millisecondi. */
export class ShareStore {
  #data = null;
  #at = 0;
  #ttl;
  constructor(ttl = SHARE_TTL) {
    this.#ttl = ttl;
  }
  /** Mette il contenuto in attesa (sostituisce quello precedente). */
  put(data, now) {
    this.#data = data;
    this.#at = now;
  }
  /** Consegna una sola volta il contenuto, se c'è e non è scaduto; poi lo dimentica. */
  claim(now) {
    const d = this.#data;
    const fresh = d !== null && now - this.#at <= this.#ttl;
    this.#data = null;
    return fresh ? d : null;
  }
  /** Scarta il contenuto (scadenza o fine anticipata). */
  clear() {
    this.#data = null;
  }
  get pending() {
    return this.#data !== null;
  }
}
