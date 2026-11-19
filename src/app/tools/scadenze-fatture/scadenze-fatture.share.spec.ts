// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { validateState } from '../../shared/share-state';
import { SHARE_SCHEMA } from './scadenze-fatture.share';

describe('scadenze-fatture: schema di condivisione', () => {
  it('stato valido', () => {
    const s = { date: '2026-01-15', terms: '30-60-90', base: 'dffm', extra: '10', shift: true, satWork: false, total: '10.000,00', reference: 'Fattura 12' };
    expect(validateState(SHARE_SCHEMA, s)).toEqual(s);
  });
  it('modalità e tipi sbagliati scartati', () => {
    expect(validateState(SHARE_SCHEMA, { base: 'mensile', shift: 'si' })).toBeNull();
    expect(validateState(SHARE_SCHEMA, { date: '2026-01-15', base: 'xx' })).toEqual({ date: '2026-01-15' });
  });
});
