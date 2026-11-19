// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { validateState } from '../../shared/share-state';
import { SHARE_SCHEMA } from './subnet-calculator.share';

describe('subnet-calculator: schema di condivisione', () => {
  it('stato valido', () => {
    const s = { input: '10.0.0.0/8', splitMode: 'vlsm', splitValue: '100, 50', checkIp: '10.1.1.1' };
    expect(validateState(SHARE_SCHEMA, s)).toEqual(s);
  });
  it('modalità sconosciuta e valori troppo lunghi scartati', () => {
    expect(validateState(SHARE_SCHEMA, { input: '1.1.1.1', splitMode: 'xx' })).toEqual({ input: '1.1.1.1' });
    expect(validateState(SHARE_SCHEMA, { input: 'x'.repeat(81) })).toBeNull();
  });
});
