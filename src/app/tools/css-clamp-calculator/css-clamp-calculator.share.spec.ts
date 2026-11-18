// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { validateState } from '../../shared/share-state';
import { SHARE_SCHEMA } from './css-clamp-calculator.share';

describe('css-clamp-calculator: schema di condivisione', () => {
  it('stato valido', () => {
    const s = { unit: 'rem', root: '16', minSize: '1', maxSize: '1.5', minVw: '320', maxVw: '1280', minRatio: '1.2', maxRatio: '1.25', stepFrom: '-2', stepTo: '5', previewVw: 800 };
    expect(validateState(SHARE_SCHEMA, s)).toEqual(s);
  });
  it('unità e larghezza fuori intervallo scartate', () => {
    expect(validateState(SHARE_SCHEMA, { unit: 'em', root: '16' })).toEqual({ root: '16' });
    expect(validateState(SHARE_SCHEMA, { previewVw: 100 })).toBeNull();
    expect(validateState(SHARE_SCHEMA, { previewVw: 2500 })).toBeNull();
    expect(validateState(SHARE_SCHEMA, { previewVw: 640.5 })).toBeNull();
  });
});
