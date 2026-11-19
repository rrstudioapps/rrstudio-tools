// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { emptyState } from '../favorites/favorites.logic';
import { exportSettings, parseSettings } from './settings.logic';

const known = new Set(['base64', 'json-formatter', 'url-encode']);
const full = {
  theme: 'dark' as const,
  hintEnDismissed: true,
  favorites: { v: 1 as const, favorites: ['base64'], groups: [{ id: 'g1', name: 'Mio', tools: ['url-encode'] }] },
  chains: [{ id: 'c1', name: 'Catena', steps: ['base64', 'json-formatter'] }],
};

describe('impostazioni', () => {
  it('esporta e reimporta senza perdere nulla', () => {
    const r = parseSettings(exportSettings(full), known);
    expect(r).toEqual({ ok: true, settings: full, dropped: 0 });
  });
  it('non esporta sezioni vuote', () => {
    const json = JSON.parse(exportSettings({ theme: null, hintEnDismissed: false, favorites: emptyState(), chains: [] }));
    expect(Object.keys(json).sort()).toEqual(['format', 'v']);
  });
  it('rifiuta file non riconosciuti o vuoti di contenuto', () => {
    expect(parseSettings('', known)).toEqual({ ok: false, error: 'empty' });
    expect(parseSettings('{no', known)).toEqual({ ok: false, error: 'json' });
    expect(parseSettings('{"theme":"dark"}', known)).toEqual({ ok: false, error: 'shape' });
    expect(parseSettings('{"format":"rrstudio-tools-settings","v":1}', known)).toEqual({ ok: false, error: 'nothing' });
  });
  it('ripulisce e conta ciò che scarta', () => {
    const r = parseSettings(JSON.stringify({ format: 'rrstudio-tools-settings', v: 1, theme: 'blu', favorites: { v: 1, favorites: ['base64', 'zzz'], groups: [] } }), known);
    expect(r.ok && r.settings.theme).toBeNull();
    expect(r.ok && r.settings.favorites?.favorites).toEqual(['base64']);
    expect(r.ok && r.dropped).toBe(2);
  });
});
