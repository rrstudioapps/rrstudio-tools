// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { formatBytes, textStats } from './text-stats';

describe('textStats', () => {
  it('conta caratteri e byte UTF-8', () => {
    expect(textStats('')).toEqual({ chars: 0, bytes: 0 });
    expect(textStats('abc')).toEqual({ chars: 3, bytes: 3 });
    expect(textStats('àèì')).toEqual({ chars: 3, bytes: 6 });
    expect(textStats('👋')).toEqual({ chars: 1, bytes: 4 });
    expect(textStats('Ciao 👋 àèì')).toEqual({ chars: 10, bytes: 16 });
  });
  it('coincide con TextEncoder', () => {
    const s = 'x€𝄞 ok\n';
    expect(textStats(s).bytes).toBe(new TextEncoder().encode(s).length);
  });
});

describe('formatBytes', () => {
  it('sceglie l\'unità', () => {
    expect(formatBytes(512, 'en-GB')).toBe('512 B');
    expect(formatBytes(2048, 'en-GB')).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024, 'en-GB')).toBe('5 MB');
  });
});
