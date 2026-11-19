// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { validateState } from '../../shared/share-state';
import { SHARE_SCHEMA } from './compound-interest.share';

describe('compound-interest: schema di condivisione', () => {
  it('stato completo valido', () => {
    const s = { principalText: '10.000', contributionText: '200', rateText: '5,5', yearsText: '20', inflationText: '2', taxText: '', frequency: 'yearly', timing: 'start', compounding: 365 };
    expect(validateState(SHARE_SCHEMA, s)).toEqual(s);
  });
  it('valori non ammessi scartati', () => {
    expect(validateState(SHARE_SCHEMA, { frequency: 'weekly', timing: 'middle', compounding: 7, rateText: '3' })).toEqual({ rateText: '3' });
    expect(validateState(SHARE_SCHEMA, { rateText: 'x'.repeat(31) })).toBeNull();
    expect(validateState(SHARE_SCHEMA, { compounding: '12' })).toBeNull();
  });
});
