// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { validateState } from '../../shared/share-state';
import { SHARE_SCHEMA } from './url-parser.share';

describe('url-parser: schema di condivisione', () => {
  it('URL valido', () => {
    expect(validateState(SHARE_SCHEMA, { url: 'https://a.it/p?x=1#y' })).toEqual({ url: 'https://a.it/p?x=1#y' });
  });
  it('altri campi e tipi sbagliati ignorati', () => {
    expect(validateState(SHARE_SCHEMA, { url: 3, altro: 'x' })).toBeNull();
    expect(validateState(SHARE_SCHEMA, { url: 'https://a.it', altro: 'x' })).toEqual({ url: 'https://a.it' });
    expect(validateState(SHARE_SCHEMA, { url: 'x'.repeat(4001) })).toBeNull();
  });
});
