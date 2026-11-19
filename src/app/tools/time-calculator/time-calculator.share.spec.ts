// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { validateState } from '../../shared/share-state';
import { SHARE_SCHEMA } from './time-calculator.share';

describe('time-calculator: schema di condivisione', () => {
  it('stato valido', () => {
    const s = { mode: 'sheet', sumText: '1:30\n2:00', bare: 'm', sheetText: 'lun 8:30 17:30 60', threshold: '40:00', scope: 'day', rate: '12,50', premium: '25', convertIn: '1,75' };
    expect(validateState(SHARE_SCHEMA, s)).toEqual(s);
  });
  it('valori non ammessi scartati', () => {
    expect(validateState(SHARE_SCHEMA, { mode: 'x', scope: 'month', bare: 's' })).toBeNull();
    expect(validateState(SHARE_SCHEMA, { sheetText: 'x'.repeat(3001) })).toBeNull();
  });
});
