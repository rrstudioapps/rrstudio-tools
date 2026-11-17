// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { validateState } from '../../shared/share-state';
import { SHARE_SCHEMA } from './curl-converter.share';

describe('curl-converter: schema di condivisione', () => {
  it('comando e linguaggio validi', () => {
    expect(validateState(SHARE_SCHEMA, { command: "curl 'https://a.it' -H 'X: 1'", target: 'python' })).toEqual({ command: "curl 'https://a.it' -H 'X: 1'", target: 'python' });
  });
  it('linguaggio sconosciuto e tipi sbagliati scartati', () => {
    expect(validateState(SHARE_SCHEMA, { command: 'curl x', target: 'ruby' })).toEqual({ command: 'curl x' });
    expect(validateState(SHARE_SCHEMA, { command: 5, target: 'go' })).toEqual({ target: 'go' });
  });
  it('comando troppo lungo scartato', () => {
    expect(validateState(SHARE_SCHEMA, { command: 'x'.repeat(6001) })).toBeNull();
  });
});
