// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { validateState } from '../../shared/share-state';
import { SHARE_SCHEMA } from './docker-run-to-compose.share';

describe('docker-run-to-compose: schema di condivisione', () => {
  it('comando valido', () => {
    expect(validateState(SHARE_SCHEMA, { command: 'docker run -p 80:80 nginx' })).toEqual({ command: 'docker run -p 80:80 nginx' });
  });
  it('tipo sbagliato e troppo lungo scartati', () => {
    expect(validateState(SHARE_SCHEMA, { command: 5 })).toBeNull();
    expect(validateState(SHARE_SCHEMA, { command: 'x'.repeat(6001) })).toBeNull();
  });
});
