// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

export type UrlMode = 'component' | 'full';

/** Errore di codifica/decodifica con un codice stabile (tradotto dall'interfaccia). */
export class UrlCodecError extends Error {
  constructor(
    readonly code: 'badSequence' | 'badUtf8' | 'unpaired',
    readonly detail = '',
  ) {
    super(code);
  }
}

/** Codifica: "component" = encodeURIComponent, "full" = encodeURI. `plus`: spazio come + (form-urlencoded). */
export function encodeUrl(text: string, mode: UrlMode, plus: boolean): string {
  let out: string;
  try {
    out = mode === 'component' ? encodeURIComponent(text) : encodeURI(text);
  } catch {
    throw new UrlCodecError('unpaired');
  }
  return plus ? out.replaceAll('%20', '+') : out;
}

/** Decodifica. `plus`: + diventa spazio. In modalità "full" i caratteri riservati restano codificati (decodeURI). */
export function decodeUrl(text: string, mode: UrlMode, plus: boolean): string {
  const src = plus ? text.replaceAll('+', ' ') : text;
  // % non seguito da due cifre esadecimali: errore con la sequenza incriminata
  const bad = /%(?![0-9a-fA-F]{2})[^%]{0,2}/.exec(src);
  if (bad) throw new UrlCodecError('badSequence', bad[0]);
  try {
    return mode === 'component' ? decodeURIComponent(src) : decodeURI(src);
  } catch {
    const m = /(?:%[0-9a-fA-F]{2})+/.exec(src);
    throw new UrlCodecError('badUtf8', m?.[0] ?? '');
  }
}

export interface UrlParts {
  protocol: string;
  host: string;
  pathname: string;
  hash: string;
  params: { key: string; value: string }[];
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Scompone un URL assoluto (http, https, ftp, ws, mailto...). Null se non lo è. */
export function parseUrlParts(text: string): UrlParts | null {
  const s = text.trim();
  if (!s || /\s/.test(s) || !/^(?:[a-z][a-z0-9+.-]*:\/\/|mailto:)/i.test(s)) return null;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  return {
    protocol: url.protocol,
    host: url.host,
    pathname: safeDecode(url.pathname),
    hash: safeDecode(url.hash),
    params: Array.from(url.searchParams.entries(), ([key, value]) => ({ key, value })),
  };
}
