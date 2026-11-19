// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';
import { sanitizeDom } from './markdown-sanitize';

const hasDom = typeof document !== 'undefined' && typeof document.createElement === 'function';

describe.skipIf(!hasDom)('sanitizeDom (seconda difesa)', () => {
  it('toglie script, gestori di eventi e schemi pericolosi dall’HTML ostile', () => {
    const evil =
      '<p onclick="x()">a</p><script>alert(1)</script><img src="https://e.com/x.png" onerror="alert(1)">' +
      '<a href="javascript:alert(1)" target="_blank">l</a><iframe src="https://e.com"></iframe><svg onload="x()"></svg><style>p{}</style>' +
      '<input type="text" value="x"><input type="checkbox" checked>';
    const out = sanitizeDom(evil, document);
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|iframe|svg|style|type="text"|e\.com/i);
    expect(out).toContain('<p>a</p>');
    expect(out).toContain('type="checkbox"');
    expect(out).toContain('disabled');
  });
  it('non cambia l’HTML prodotto dal convertitore', () => {
    const md = '# T\n\n- [x] a\n\n[l](https://example.com) ![i](https://example.com/i.png)\n\n| a |\n|:-:|\n| 1 |\n\n```js\nx\n```';
    const html = renderMarkdown(md);
    const tidy = (s: string): string => s.replace(/=""/g, '').replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
    expect(tidy(sanitizeDom(html, document))).toBe(tidy(html));
  });
});
