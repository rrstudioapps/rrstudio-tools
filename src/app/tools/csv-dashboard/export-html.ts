// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { escapeHtml } from './format';

export interface ExportKpi {
  label: string;
  value: string;
  /** Testo della variazione e direzione (solo per il KPI di variazione). */
  delta?: { text: string; up: boolean };
}

export interface ExportColors {
  bg: string;
  surface: string;
  text: string;
  ink2: string;
  muted: string;
  line: string;
}

export interface ExportModel {
  lang: string;
  title: string;
  generatedLabel: string;
  kpis: ExportKpi[];
  /** Grafici come immagini PNG in base64 (data URL). */
  charts: { title: string; dataUrl: string }[];
  headers: string[];
  rows: string[][];
  rowsNote: string;
  credit: string;
  colors: ExportColors;
}

/** Il valore finisce dentro un attributo src="...": ammette solo data URL PNG base64. */
function safeImage(dataUrl: string): string {
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl) ? dataUrl : '';
}

/**
 * Costruisce un documento HTML autonomo (CSS inline, immagini base64, nessuna risorsa esterna).
 * Tutti i testi provenienti dall'utente passano da escapeHtml.
 */
export function buildExportHtml(m: ExportModel): string {
  const c = m.colors;
  const kpis = m.kpis
    .map(
      (k) =>
        `<div class="kpi"><span class="l">${escapeHtml(k.label)}</span><strong>${escapeHtml(k.value)}</strong>` +
        (k.delta
          ? `<span class="d ${k.delta.up ? 'up' : 'down'}">${k.delta.up ? '▲' : '▼'} ${escapeHtml(k.delta.text)}</span>`
          : '') +
        `</div>`,
    )
    .join('');
  const charts = m.charts
    .map((ch) => {
      const src = safeImage(ch.dataUrl);
      return src
        ? `<figure><figcaption>${escapeHtml(ch.title)}</figcaption><img src="${src}" alt="${escapeHtml(ch.title)}"></figure>`
        : '';
    })
    .join('');
  const head = m.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = m.rows
    .map((r) => `<tr>${r.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<!doctype html>
<html lang="${escapeHtml(m.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(m.title)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:24px;background:${c.bg};color:${c.text};font-family:system-ui,sans-serif;line-height:1.5}
main{max-width:1100px;margin:0 auto}
h1{margin:0 0 4px}
.sub{color:${c.muted};margin:0 0 20px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px}
.kpi{border-top:1px solid ${c.line};padding:16px 16px 16px 0;display:flex;flex-direction:column;gap:4px}
.kpi .l{color:${c.muted};font-size:.85rem}
.kpi strong{font-size:2.2rem;font-weight:500;letter-spacing:-.035em;font-variant-numeric:tabular-nums}
.d.up{color:${c.text}}.d.down{color:${c.ink2}}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-bottom:20px}
figure{margin:0;border-top:1px solid ${c.line};padding:16px 0}
figcaption{font-weight:700;margin-bottom:8px}
img{width:100%;height:auto;display:block}
.tw{overflow-x:auto;background:${c.surface};border:1px solid ${c.line};border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:.85rem}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid ${c.line};white-space:nowrap}
th{position:sticky;top:0;background:${c.surface}}
.note{color:${c.muted};font-size:.85rem}
footer{margin-top:20px;color:${c.muted};font-size:.8rem}
</style>
</head>
<body>
<main>
<h1>${escapeHtml(m.title)}</h1>
<p class="sub">${escapeHtml(m.generatedLabel)}</p>
<div class="kpis">${kpis}</div>
<div class="charts">${charts}</div>
<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
<p class="note">${escapeHtml(m.rowsNote)}</p>
<footer>${escapeHtml(m.credit)}</footer>
</main>
</body>
</html>
`;
}
