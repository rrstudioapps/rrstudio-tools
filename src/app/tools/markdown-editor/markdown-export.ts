// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { escapeHtml } from './markdown';

/** Titolo del documento: il primo titolo `#` (o setext di livello 1) senza segni di formattazione, o `fallback`. */
export function documentTitle(source: string, fallback: string): string {
  const m = /^ {0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/m.exec(source);
  if (!m) return fallback;
  const t = m[1].replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').trim();
  return t.slice(0, 120) || fallback;
}

/** Stile del documento HTML esportato: pulito, leggibile a schermo e in stampa, senza risorse esterne. */
export const EXPORT_CSS = `
:root{color-scheme:light dark}
body{margin:0;padding:2rem 1.25rem;font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1c1c1e;background:#fff}
main{max-width:46rem;margin:0 auto}
h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.6em 0 .5em}
h1{font-size:2rem}h2{font-size:1.5rem;border-bottom:1px solid #d8d8d4;padding-bottom:.25em}h3{font-size:1.2rem}
p,ul,ol,blockquote,pre,table{margin:0 0 1em}
a{color:#2f6f9f}
code{font:.9em ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#f1f0ec;padding:.1em .35em;border-radius:4px}
pre{background:#f1f0ec;padding:.9em 1em;border-radius:6px;overflow-x:auto}
pre code{background:none;padding:0}
blockquote{margin-left:0;padding:.1em 1em;border-left:4px solid #c9c8c2;color:#55555a}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #d8d8d4;padding:.4em .7em;text-align:left}
th{background:#f1f0ec}
.al-c{text-align:center}.al-r{text-align:right}
img{max-width:100%;height:auto}
hr{border:0;border-top:1px solid #d8d8d4;margin:2em 0}
.md-task{margin-right:.4em}
.md-task-item{list-style:none;margin-left:-1.4em}
@media (prefers-color-scheme:dark){body{background:#1c1c1e;color:#f2f1ed}a{color:#6fb0e0}code,pre,th{background:#2a2a2d}h2,th,td,hr{border-color:#444}blockquote{border-color:#555;color:#b5b4ae}}
@media print{body{background:#fff;color:#000;padding:0}a{color:#000}pre,code,th{background:#f3f3f3}pre{white-space:pre-wrap}h1,h2,h3{break-after:avoid}table,pre,blockquote,img{break-inside:avoid}}
`.replace(/\n/g, '');

/** Documento HTML autonomo (un solo file, nessuna risorsa esterna, nessuno script). */
export function buildHtmlDocument(title: string, bodyHtml: string, lang: 'it' | 'en'): string {
  return (
    '<!doctype html>\n' +
    `<html lang="${lang}">\n<head>\n<meta charset="utf-8">\n` +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    `<title>${escapeHtml(title)}</title>\n<style>${EXPORT_CSS}</style>\n</head>\n<body>\n<main>\n${bodyHtml}\n</main>\n</body>\n</html>\n`
  );
}
