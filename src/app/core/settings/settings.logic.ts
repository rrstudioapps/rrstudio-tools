// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { Chain, sanitizeChains } from '../chains/chains.logic';
import { FavState, MAX_IMPORT_CHARS, isEmpty, sanitize } from '../favorites/favorites.logic';

/**
 * Esportazione e importazione di tutte le impostazioni dell'utente in un solo file JSON.
 * Contiene SOLO preferenze (tema, chiusura della barra «available in English», preferiti e menu, catene):
 * mai bozze né dati inseriti negli strumenti. Logica pura, senza storage né Angular.
 */
export const SETTINGS_FORMAT = 'rrstudio-tools-settings';
export const SETTINGS_VERSION = 1;

export interface Settings {
  theme: 'light' | 'dark' | null;
  hintEnDismissed: boolean | null;
  favorites: FavState | null;
  chains: Chain[] | null;
}

export type SettingsError = 'empty' | 'tooBig' | 'json' | 'shape' | 'nothing';
export type SettingsResult = { ok: true; settings: Settings; dropped: number } | { ok: false; error: SettingsError };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Testo del file da esportare: solo le sezioni con qualcosa dentro. */
export function exportSettings(s: Settings): string {
  const out: Record<string, unknown> = { format: SETTINGS_FORMAT, v: SETTINGS_VERSION };
  if (s.theme) out['theme'] = s.theme;
  if (s.hintEnDismissed) out['hintEnDismissed'] = true;
  if (s.favorites && !isEmpty(s.favorites)) out['favorites'] = s.favorites;
  if (s.chains?.length) out['chains'] = s.chains;
  return JSON.stringify(out, null, 2) + '\n';
}

/** Legge e ripulisce un file di impostazioni; `known` = id degli strumenti validi. */
export function parseSettings(text: string, known: ReadonlySet<string>): SettingsResult {
  const t = text.replace(/^﻿/, '').trim();
  if (!t) return { ok: false, error: 'empty' };
  if (t.length > MAX_IMPORT_CHARS * 2) return { ok: false, error: 'tooBig' };
  let raw: unknown;
  try {
    raw = JSON.parse(t);
  } catch {
    return { ok: false, error: 'json' };
  }
  if (!isObj(raw) || raw['format'] !== SETTINGS_FORMAT || raw['v'] !== SETTINGS_VERSION) return { ok: false, error: 'shape' };
  let dropped = 0;
  const theme = raw['theme'] === 'light' || raw['theme'] === 'dark' ? raw['theme'] : null;
  if (raw['theme'] !== undefined && theme === null) dropped++;
  const hint = raw['hintEnDismissed'] === true ? true : null;
  let favorites: FavState | null = null;
  if (raw['favorites'] !== undefined) {
    const f = sanitize(raw['favorites'], known);
    if (f && !isEmpty(f.state)) {
      favorites = f.state;
      dropped += f.unknown + f.trimmed;
    } else dropped++;
  }
  let chains: Chain[] | null = null;
  if (raw['chains'] !== undefined) {
    const c = sanitizeChains(raw['chains'], known);
    dropped += c.dropped;
    if (c.chains.length) chains = c.chains;
  }
  if (theme === null && hint === null && favorites === null && chains === null) return { ok: false, error: 'nothing' };
  return { ok: true, settings: { theme, hintEnDismissed: hint, favorites, chains }, dropped };
}
