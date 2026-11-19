// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { ALLOWED_ATTRS, ALLOWED_TAGS, RenderOptions, classifyUrl, demoteHeadings, renderMarkdown } from './markdown';

describe('titoli dell\'anteprima', () => {
  it('scendono di un livello per i lettori di schermo, h6 resta a 6', () => {
    expect(demoteHeadings('<h1>A</h1><h2>B</h2><h6>F</h6>')).toBe('<h1 aria-level="2">A</h1><h2 aria-level="3">B</h2><h6 aria-level="6">F</h6>');
  });
  it('non tocca il testo né altri tag che iniziano per h', () => {
    expect(demoteHeadings('<p>&lt;h1&gt;</p><hr><header>x</header>')).toBe('<p>&lt;h1&gt;</p><hr><header>x</header>');
  });
});

/** HTML senza a capo tra i tag, per confrontare con i risultati attesi di CommonMark. */
const md = (s: string, o: Partial<RenderOptions> = {}): string => renderMarkdown(s, o).replace(/>\s+</g, '><').replace(/\s+<(ul|ol)>/g, '<$1>').trim();

describe('titoli e paragrafi', () => {
  it('titoli ATX', () => {
    expect(md('# Titolo')).toBe('<h1>Titolo</h1>');
    expect(md('###### Sei')).toBe('<h6>Sei</h6>');
    expect(md('####### Sette')).toBe('<p>####### Sette</p>');
    expect(md('#Senza spazio')).toBe('<p>#Senza spazio</p>');
    expect(md('## Chiuso con ##')).toBe('<h2>Chiuso con</h2>');
    expect(md('### a ### b')).toBe('<h3>a ### b</h3>');
    expect(md('# ')).toBe('<h1></h1>');
    expect(md('   # Rientro')).toBe('<h1>Rientro</h1>');
    expect(md('# *enfasi* e `codice`')).toBe('<h1><em>enfasi</em> e <code>codice</code></h1>');
  });
  it('titoli setext', () => {
    expect(md('Titolo\n======')).toBe('<h1>Titolo</h1>');
    expect(md('Titolo\n------')).toBe('<h2>Titolo</h2>');
    expect(md('Due\nrighe\n---')).toBe('<h2>Due\nrighe</h2>');
  });
  it('paragrafi, righe vuote e a capo', () => {
    expect(md('uno\n\ndue')).toBe('<p>uno</p><p>due</p>');
    expect(md('uno\ndue')).toBe('<p>uno\ndue</p>');
    expect(md('uno  \ndue')).toBe('<p>uno<br>\ndue</p>');
    expect(md('uno\\\ndue')).toBe('<p>uno<br>\ndue</p>');
    expect(md('uno \ndue')).toBe('<p>uno\ndue</p>');
    expect(md('  rientrato\n  due')).toBe('<p>rientrato\ndue</p>');
    expect(md('')).toBe('');
    expect(md('\n\n  \n')).toBe('');
  });
  it('righe orizzontali', () => {
    expect(md('---')).toBe('<hr>');
    expect(md('***')).toBe('<hr>');
    expect(md('___')).toBe('<hr>');
    expect(md('- - -')).toBe('<hr>');
    expect(md(' **  * ** * ** * **')).toBe('<hr>');
    expect(md('--')).toBe('<p>--</p>');
    expect(md('a\n\n---\nb')).toBe('<p>a</p><hr><p>b</p>');
  });
});

describe('enfasi', () => {
  it('corsivo e grassetto', () => {
    expect(md('*a*')).toBe('<p><em>a</em></p>');
    expect(md('_a_')).toBe('<p><em>a</em></p>');
    expect(md('**a**')).toBe('<p><strong>a</strong></p>');
    expect(md('__a__')).toBe('<p><strong>a</strong></p>');
    expect(md('***a***')).toBe('<p><em><strong>a</strong></em></p>');
    expect(md('**a *b* c**')).toBe('<p><strong>a <em>b</em> c</strong></p>');
    expect(md('*a **b** c*')).toBe('<p><em>a <strong>b</strong> c</em></p>');
  });
  it('regole di apertura e chiusura', () => {
    expect(md('a * b *')).toBe('<p>a * b *</p>');
    expect(md('a*b*c')).toBe('<p>a<em>b</em>c</p>');
    expect(md('foo_bar_baz')).toBe('<p>foo_bar_baz</p>');
    expect(md('_foo_bar')).toBe('<p>_foo_bar</p>');
    expect(md('*foo bar *')).toBe('<p>*foo bar *</p>');
    expect(md('**foo*')).toBe('<p>*<em>foo</em></p>');
    expect(md('*foo**')).toBe('<p><em>foo</em>*</p>');
    expect(md('2 * 3 * 4')).toBe('<p>2 * 3 * 4</p>');
    expect(md('**non chiuso')).toBe('<p>**non chiuso</p>');
  });
  it('barrato GFM', () => {
    expect(md('~~via~~')).toBe('<p><del>via</del></p>');
    expect(md('~una~')).toBe('<p>~una~</p>');
    expect(md('a ~~b *c*~~')).toBe('<p>a <del>b <em>c</em></del></p>');
  });
  it('caratteri protetti da backslash', () => {
    expect(md('\\*non enfasi\\*')).toBe('<p>*non enfasi*</p>');
    expect(md('\\# non titolo')).toBe('<p># non titolo</p>');
    expect(md('a \\\\ b')).toBe('<p>a \\ b</p>');
    expect(md('\\a')).toBe('<p>\\a</p>');
  });
});

describe('codice', () => {
  it('codice in linea', () => {
    expect(md('`a`')).toBe('<p><code>a</code></p>');
    expect(md('`` a`b ``')).toBe('<p><code>a`b</code></p>');
    expect(md('` a `')).toBe('<p><code>a</code></p>');
    expect(md('`<b>&</b>`')).toBe('<p><code>&lt;b&gt;&amp;&lt;/b&gt;</code></p>');
    expect(md('`non chiuso')).toBe('<p>`non chiuso</p>');
    expect(md('`*a*`')).toBe('<p><code>*a*</code></p>');
  });
  it('blocchi con ``` e ~~~ e linguaggio', () => {
    expect(md('```\nciao\n```')).toBe('<pre><code>ciao\n</code></pre>');
    expect(md('```js\nlet a = 1 < 2;\n```')).toBe('<pre data-lang="js"><code class="language-js">let a = 1 &lt; 2;\n</code></pre>');
    expect(md('~~~python title="x"\nprint(1)\n~~~')).toBe('<pre data-lang="python"><code class="language-python">print(1)\n</code></pre>');
    expect(md('```\na\n\n\nb\n```')).toBe('<pre><code>a\n\n\nb\n</code></pre>');
    expect(md('````\n```\ndentro\n```\n````')).toBe('<pre><code>```\ndentro\n```\n</code></pre>');
    expect(md('```\nnon chiuso')).toBe('<pre><code>non chiuso\n</code></pre>');
    expect(md('```\n```')).toBe('<pre><code></code></pre>');
    expect(md('```"><script>\nx\n```')).toBe('<pre><code>x\n</code></pre>');
  });
  it('codice con rientro di 4 spazi', () => {
    expect(md('    a\n    b')).toBe('<pre><code>a\nb\n</code></pre>');
    expect(md('    <div>')).toBe('<pre><code>&lt;div&gt;\n</code></pre>');
    expect(md('para\n    continua')).toBe('<p>para\ncontinua</p>');
  });
});

describe('citazioni', () => {
  it('semplici, con più righe e annidate', () => {
    expect(md('> a')).toBe('<blockquote><p>a</p></blockquote>');
    expect(md('> a\n> b')).toBe('<blockquote><p>a\nb</p></blockquote>');
    expect(md('> a\nb')).toBe('<blockquote><p>a\nb</p></blockquote>');
    expect(md('> a\n\n> b')).toBe('<blockquote><p>a</p></blockquote><blockquote><p>b</p></blockquote>');
    expect(md('> a\n>\n> b')).toBe('<blockquote><p>a</p><p>b</p></blockquote>');
    expect(md('> > a')).toBe('<blockquote><blockquote><p>a</p></blockquote></blockquote>');
    expect(md('> # Titolo\n> testo')).toBe('<blockquote><h1>Titolo</h1><p>testo</p></blockquote>');
    expect(md('> - a\n> - b')).toBe('<blockquote><ul><li>a</li><li>b</li></ul></blockquote>');
    expect(md('>```\n>x\n>```')).toBe('<blockquote><pre><code>x\n</code></pre></blockquote>');
  });
});

describe('elenchi', () => {
  it('puntati e numerati', () => {
    expect(md('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(md('* a\n* b')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(md('+ a')).toBe('<ul><li>a</li></ul>');
    expect(md('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
    expect(md('3) a\n4) b')).toBe('<ol start="3"><li>a</li><li>b</li></ol>');
    expect(md('0. zero')).toBe('<ol start="0"><li>zero</li></ol>');
  });
  it('un cambio di simbolo apre un altro elenco', () => {
    expect(md('- a\n* b')).toBe('<ul><li>a</li></ul><ul><li>b</li></ul>');
    expect(md('1. a\n1) b')).toBe('<ol><li>a</li></ol><ol><li>b</li></ol>');
  });
  it('elenchi larghi (con riga vuota) e stretti', () => {
    expect(md('- a\n\n- b')).toBe('<ul><li><p>a</p></li><li><p>b</p></li></ul>');
    expect(md('- a\n- b\n\n- c')).toBe('<ul><li><p>a</p></li><li><p>b</p></li><li><p>c</p></li></ul>');
    expect(md('- a\n\n  b\n- c')).toBe('<ul><li><p>a</p><p>b</p></li><li><p>c</p></li></ul>');
  });
  it('annidati', () => {
    expect(md('- a\n  - b\n    - c\n- d')).toBe('<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li><li>d</li></ul>');
    expect(md('1. a\n   - b\n2. c')).toBe('<ol><li>a<ul><li>b</li></ul></li><li>c</li></ol>');
    expect(md('- a\n    - b')).toBe('<ul><li>a<ul><li>b</li></ul></li></ul>');
    expect(md('10. a\n    b')).toBe('<ol start="10"><li>a\nb</li></ol>');
  });
  it('continuazione pigra, codice e citazioni dentro un elemento', () => {
    expect(md('- a\nb')).toBe('<ul><li>a\nb</li></ul>');
    expect(md('- a\n\n  ```\n  x\n  ```')).toBe('<ul><li><p>a</p><pre><code>x\n</code></pre></li></ul>');
    expect(md('- > citazione')).toBe('<ul><li><blockquote><p>citazione</p></blockquote></li></ul>');
    expect(md('- a\n\nparagrafo')).toBe('<ul><li>a</li></ul><p>paragrafo</p>');
    expect(md('- a\n\n\n- b')).toBe('<ul><li><p>a</p></li><li><p>b</p></li></ul>');
  });
  it('elemento vuoto e riga che sembra un elenco', () => {
    expect(md('-')).toBe('<ul><li></li></ul>');
    expect(md('-a')).toBe('<p>-a</p>');
    expect(md('Testo\n- a')).toBe('<p>Testo</p><ul><li>a</li></ul>');
    expect(md('Testo\n2. a')).toBe('<p>Testo\n2. a</p>'); // solo "1." interrompe un paragrafo
  });
  it('elenchi di attività GFM', () => {
    expect(md('- [ ] da fare\n- [x] fatto\n- [X] anche')).toBe(
      '<ul><li class="md-task-item"><input type="checkbox" class="md-task" disabled aria-label="da fare"> da fare</li>' +
        '<li class="md-task-item"><input type="checkbox" class="md-task" checked disabled aria-label="fatto"> fatto</li>' +
        '<li class="md-task-item"><input type="checkbox" class="md-task" checked disabled aria-label="anche"> anche</li></ul>',
    );
    expect(md('- [x]senza spazio')).toBe('<ul><li>[x]senza spazio</li></ul>');
    expect(md('- [ ] a\n  - [x] b')).toContain('<ul><li class="md-task-item"><input type="checkbox" class="md-task" checked disabled aria-label="b"> b</li></ul>');
  });
});

describe('link e immagini', () => {
  it('link in linea con titolo', () => {
    expect(md('[a](https://example.com)')).toBe('<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">a</a></p>');
    expect(md('[a](https://example.com "Titolo")')).toBe('<p><a href="https://example.com" title="Titolo" target="_blank" rel="noopener noreferrer">a</a></p>');
    expect(md('[a](/percorso/pagina)')).toBe('<p><a href="/percorso/pagina">a</a></p>');
    expect(md('[a](#ancora)')).toBe('<p><a href="#ancora">a</a></p>');
    expect(md('[a](mailto:x@example.com)')).toBe('<p><a href="mailto:x@example.com">a</a></p>');
    expect(md('[a](<https://example.com/a b>)')).toBe('<p><a href="https://example.com/ab" target="_blank" rel="noopener noreferrer">a</a></p>');
    expect(md('[**a**](pagina.html)')).toBe('<p><a href="pagina.html"><strong>a</strong></a></p>');
    expect(md('[a](https://example.com/(x))')).toContain('href="https://example.com/(x)"');
  });
  it('link di riferimento', () => {
    expect(md('[a][1]\n\n[1]: https://example.com "T"')).toBe('<p><a href="https://example.com" title="T" target="_blank" rel="noopener noreferrer">a</a></p>');
    expect(md('[Esempio]\n\n[esempio]: https://example.com')).toContain('href="https://example.com"');
    expect(md('[a][]\n\n[a]: /x')).toContain('<a href="/x">a</a>');
    expect(md('[a][mancante]')).toBe('<p>[a][mancante]</p>');
    expect(md('[a]')).toBe('<p>[a]</p>');
  });
  it('testo tra parentesi quadre senza link e link non annidabili', () => {
    expect(md('[a] (b)')).toBe('<p>[a] (b)</p>');
    expect(md('[a [b](/b) c](/a)')).toBe('<p>[a <a href="/b">b</a> c](/a)</p>');
    expect(md('a ] b [ c')).toBe('<p>a ] b [ c</p>');
  });
  it('link automatici', () => {
    expect(md('<https://example.com/a?b=1&c=2>')).toBe('<p><a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">https://example.com/a?b=1&amp;c=2</a></p>');
    expect(md('<utente@example.com>')).toBe('<p><a href="mailto:utente@example.com">utente@example.com</a></p>');
    expect(md('vai su https://example.com/x.')).toBe('<p>vai su <a href="https://example.com/x" target="_blank" rel="noopener noreferrer">https://example.com/x</a>.</p>');
    expect(md('www.example.com')).toContain('href="http://www.example.com"');
    expect(md('(https://example.com/a)')).toContain('>https://example.com/a</a>)');
    expect(md('https://')).toBe('<p>https://</p>');
  });
  it('immagini: segnaposto cliccabile, nessun <img> con indirizzo esterno', () => {
    const h = md('![logo](https://example.com/logo.png "T")');
    expect(h).toBe('<p><a class="md-ext-img" href="https://example.com/logo.png" target="_blank" rel="noopener noreferrer">immagine esterna: https://example.com/logo.png</a></p>');
    expect(h).not.toContain('<img');
    expect(md('![a](locale.png)')).toBe('<p><span class="md-img-off">immagine: a</span></p>');
    expect(md('![a](data:image/png;base64,iVBORw0KGgo=)')).toBe('<p><img src="data:image/png;base64,iVBORw0KGgo=" alt="a" loading="lazy"></p>');
    expect(md('![a *b*](https://example.com/x.png)', { externalImageLabel: (u) => `ext ${u}` })).toContain('>ext https://example.com/x.png</a>');
  });
  it('immagini in modalità esportazione', () => {
    expect(md('![logo](https://example.com/l.png "T")', { images: 'embed' })).toBe(
      '<p><img src="https://example.com/l.png" alt="logo" title="T" loading="lazy" referrerpolicy="no-referrer"></p>',
    );
  });
  it('immagine dentro un link non annida due <a>', () => {
    const h = md('[![x](https://example.com/i.png)](https://example.com)');
    expect((h.match(/<a /g) ?? []).length).toBe(1);
  });
});

describe('tabelle GFM', () => {
  it('con allineamento', () => {
    const t = md('| A | B | C |\n|:--|:-:|--:|\n| 1 | 2 | 3 |\n| x | y | z |');
    expect(t).toBe(
      '<table><thead><tr><th class="al-l">A</th><th class="al-c">B</th><th class="al-r">C</th></tr></thead>' +
        '<tbody><tr><td class="al-l">1</td><td class="al-c">2</td><td class="al-r">3</td></tr>' +
        '<tr><td class="al-l">x</td><td class="al-c">y</td><td class="al-r">z</td></tr></tbody></table>',
    );
  });
  it('senza barre esterne, con celle mancanti, in eccesso e con barra protetta', () => {
    expect(md('a | b\n--|--\n1 | 2')).toBe('<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
    expect(md('| a | b |\n|---|---|\n| 1 |')).toContain('<td>1</td><td></td>');
    expect(md('| a | b |\n|---|---|\n| 1 | 2 | 3 |')).not.toContain('3');
    expect(md('| a |\n|---|\n| x \\| y |')).toContain('<td>x | y</td>');
    expect(md('| *a* | `b` |\n|---|---|\n| [l](/x) | **c** |')).toContain('<th><em>a</em></th><th><code>b</code></th>');
  });
  it('senza corpo, e non è tabella se le colonne non coincidono', () => {
    expect(md('| a | b |\n|---|---|')).toBe('<table><thead><tr><th>a</th><th>b</th></tr></thead></table>');
    expect(md('| a | b |\n|---|')).toBe('<p>| a | b |\n|---|</p>');
    expect(md('a | b\n--- | ---\n1 | 2\n\ntesto')).toContain('</table><p>testo</p>');
  });
});

describe('entità e caratteri speciali', () => {
  it('entità e escape', () => {
    expect(md('a & b < c > d "e"')).toBe('<p>a &amp; b &lt; c &gt; d &quot;e&quot;</p>');
    expect(md('&amp; &copy; &#35; &#x1F600; &nonesiste;')).toBe('<p>&amp; © # 😀 &amp;nonesiste;</p>');
    expect(md('&#0;')).toBe('<p>�</p>');
    expect(md('&lt;script&gt;')).toBe('<p>&lt;script&gt;</p>');
  });
  it('a capo Windows, tabulazioni e testo Unicode', () => {
    expect(md('a\r\nb\r\n\r\nc')).toBe('<p>a\nb</p><p>c</p>');
    expect(md('-\ta')).toBe('<ul><li>a</li></ul>');
    expect(md('Perché già è così: città 😀 日本語')).toBe('<p>Perché già è così: città 😀 日本語</p>');
    expect(md('*perché*')).toBe('<p><em>perché</em></p>');
  });
});

describe('sicurezza', () => {
  it('l’HTML grezzo non è eseguito: viene mostrato come testo', () => {
    expect(md('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    expect(md('<img src=x onerror=alert(1)>')).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
    expect(md('<div onclick="x()">ciao</div>')).toBe('<p>&lt;div onclick=&quot;x()&quot;&gt;ciao&lt;/div&gt;</p>');
    expect(md('<iframe src="https://example.com"></iframe>')).not.toContain('<iframe');
    expect(md('<style>*{display:none}</style>')).not.toContain('<style');
    expect(md('<!-- commento --><b>x</b>')).not.toContain('<b>');
    expect(md('<svg onload=alert(1)>')).not.toContain('<svg');
  });
  it('schemi pericolosi nei link diventano testo', () => {
    for (const u of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      'jav&#x61;script:alert(1)',
      'jav&#97;script:alert(1)',
      '&#106;avascript:alert(1)',
      'vbscript:msgbox(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      '//example.com/x',
      '\\\\example.com\\x',
      'blob:https://example.com/x',
    ]) {
      const h = md(`[clic](${u.includes(' ') || u.includes('\n') ? '<' + u + '>' : u})`);
      expect(h, u).not.toMatch(/href=/i);
      expect(h, u).not.toMatch(/<a /i);
    }
    expect(md('[x][r]\n\n[r]: javascript:alert(1)')).not.toMatch(/href=/);
    expect(md('<javascript:alert(1)>')).not.toMatch(/href=/);
    expect(md('![x](javascript:alert(1))')).not.toMatch(/src=|href=/);
    expect(md('![x](data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg==)')).not.toMatch(/<img|href=/);
  });
  it('gli attributi sono sempre protetti da virgolette e non nascono attributi nuovi', () => {
    const attrs = (html: string): string[] => [...html.matchAll(/<[a-z0-9]+((?:\s[a-z-]+(?:="[^"]*")?)*)>/g)].flatMap((m) => [...m[1].matchAll(/\s([a-z-]+)(?:="[^"]*")?/g)].map((a) => a[1]));
    const docs = [
      '[a](https://example.com/"onmouseover="alert(1))',
      '[a](https://example.com "x\\" onclick=\\"alert(1)")',
      '![x" onerror="alert(1)](https://example.com/a.png)',
      '```a" onclick="x\nb\n```',
      '[a](<x" onfocus="y>)',
    ];
    for (const d of docs) {
      const html = md(d);
      for (const a of attrs(html)) expect(ALLOWED_ATTRS.has(a), `${a} in ${html}`).toBe(true);
      expect(html, d).not.toMatch(/<[^>]*\sonmouseover=/);
    }
  });
  it('immagini esterne mai caricate automaticamente', () => {
    for (const u of ['https://example.com/a.png', 'http://example.com/a.gif', '//example.com/a.png', 'https://example.com/a.png?x=1']) {
      expect(md(`![a](${u})`), u).not.toMatch(/<img/);
    }
  });
  it('tutti i tag e gli attributi prodotti sono nella lista bianca (campione ampio)', () => {
    const docs = [
      '# t\n\n*a* **b** ~~c~~ `d` [e](https://example.com "t") ![f](https://example.com/i.png) <g>\n\n- [ ] x\n- [x] y\n  1. z\n\n> q\n\n```js\ncode\n```\n\n| a | b |\n|:-|-:|\n| 1 | 2 |\n\n---',
      '<script>alert(1)</script> [x](javascript:alert(1)) ![y](data:image/png;base64,AAAA) <a href="javascript:x">z</a>',
      '[a][b]\n\n[b]: <https://example.com/x> \'t"itle\'',
    ];
    for (const d of docs) {
      for (const mode of ['placeholder', 'embed'] as const) {
        const html = renderMarkdown(d, { images: mode });
        for (const m of html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g)) {
          expect(ALLOWED_TAGS.has(m[1].toLowerCase()), `tag ${m[1]}`).toBe(true);
          for (const a of m[2].matchAll(/\s([a-zA-Z-]+)(?:="[^"]*")?/g)) expect(ALLOWED_ATTRS.has(a[1]), `attr ${a[1]} in <${m[1]}>`).toBe(true);
          // ogni attributo ha il valore tra virgolette doppie
          expect(m[2].replace(/\s[a-zA-Z-]+(="[^"]*")?/g, '').trim(), m[0]).toBe('');
        }
      }
    }
  });
  it('fuzz: testo casuale non produce mai tag o attributi fuori lista', () => {
    const alphabet = ['<', '>', '"', "'", '&', '[', ']', '(', ')', '!', '*', '_', '`', '~', '|', '-', '#', '\n', ' ', '\\', 'a', 'x=', 'javascript:', 'https://e.com/', '1.', '> ', '    ', '<script>', 'onerror=', '```'];
    let seed = 12345;
    const rnd = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let n = 0; n < 400; n++) {
      let s = '';
      const len = 5 + Math.floor(rnd() * 60);
      for (let k = 0; k < len; k++) s += alphabet[Math.floor(rnd() * alphabet.length)];
      const html = renderMarkdown(s);
      for (const m of html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g)) {
        expect(ALLOWED_TAGS.has(m[1].toLowerCase()), `tag ${m[1]} da ${JSON.stringify(s)}`).toBe(true);
        expect(m[2].replace(/\s[a-zA-Z-]+(="[^"]*")?/g, '').trim(), `${m[0]} da ${JSON.stringify(s)}`).toBe('');
        expect(m[2], JSON.stringify(s)).not.toMatch(/\son[a-z]+=/i);
        expect(m[2], JSON.stringify(s)).not.toMatch(/(href|src)="\s*(javascript|data|vbscript)(?!:image)/i);
      }
      // un `<` dentro il testo è sempre un'entità: i tag stanno solo dove li produciamo
      expect(html.replace(/<\/?[a-zA-Z][^>]*>/g, '')).not.toContain('<');
    }
  });
  it('input estremi non bloccano né sollevano eccezioni', () => {
    const t0 = Date.now();
    expect(() => renderMarkdown('>'.repeat(5000) + ' a')).not.toThrow();
    expect(() => renderMarkdown('- '.repeat(3000) + 'a')).not.toThrow();
    expect(() => renderMarkdown('['.repeat(5000))).not.toThrow();
    expect(() => renderMarkdown('*a '.repeat(3000))).not.toThrow();
    expect(() => renderMarkdown('`'.repeat(5000))).not.toThrow();
    expect(() => renderMarkdown('![a](b)'.repeat(3000))).not.toThrow();
    expect(() => renderMarkdown('| a |\n|---|\n'.repeat(500))).not.toThrow();
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});

describe('classifyUrl', () => {
  it('classifica gli indirizzi', () => {
    expect(classifyUrl('https://a.it/x').kind).toBe('web');
    expect(classifyUrl('HTTP://a.it').kind).toBe('web');
    expect(classifyUrl('mailto:a@b.it').kind).toBe('mail');
    expect(classifyUrl('pagina.html').kind).toBe('relative');
    expect(classifyUrl('../su/pagina?x=1#a').kind).toBe('relative');
    expect(classifyUrl('#x').kind).toBe('relative');
    expect(classifyUrl('data:image/png;base64,AAAA').kind).toBe('data-image');
    expect(classifyUrl('data:image/svg+xml;base64,AAAA').kind).toBe('unsafe');
    expect(classifyUrl('javascript:1').kind).toBe('unsafe');
    expect(classifyUrl('').kind).toBe('unsafe');
    expect(classifyUrl('https://').kind).toBe('unsafe');
  });
});

describe('documento d’esempio', () => {
  it('un documento misto è convertito per intero', () => {
    const doc = [
      '# Guida',
      '',
      'Un paragrafo con **grassetto**, _corsivo_ e `codice`.',
      '',
      '1. Uno',
      '2. Due',
      '   - sotto',
      '',
      '> Citazione',
      '',
      '| Nome | Qta |',
      '|------|----:|',
      '| Mele |   3 |',
      '',
      '```sh',
      'echo ciao',
      '```',
    ].join('\n');
    const h = md(doc);
    expect(h).toContain('<h1>Guida</h1>');
    expect(h).toContain('<ol><li>Uno</li><li>Due<ul><li>sotto</li></ul></li></ol>');
    expect(h).toContain('<td class="al-r">3</td>');
    expect(h).toContain('<pre data-lang="sh"><code class="language-sh">echo ciao\n</code></pre>');
  });
});
