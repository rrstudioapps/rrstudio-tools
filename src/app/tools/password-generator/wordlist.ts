// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** EFF Large Wordlist (7776 parole), servita dallo stesso sito e caricata solo quando serve. */
export const WORDLIST_URL = 'wordlists/eff-large.txt';
export const WORDLIST_SIZE = 7776;

let cached: Promise<string[]> | null = null;

export function loadWordlist(): Promise<string[]> {
  cached ??= fetch(WORDLIST_URL)
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then((text) => {
      const words = text.split('\n').map((w) => w.trim()).filter(Boolean);
      if (words.length !== WORDLIST_SIZE) throw new Error('lista di parole non valida');
      return words;
    })
    .catch((e) => {
      cached = null; // permette di riprovare
      throw e;
    });
  return cached;
}
