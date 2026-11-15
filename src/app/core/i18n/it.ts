// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Dizionario italiano: definisce l'insieme delle chiavi (en.ts deve averle tutte). */
export const it = {
  'nav.home': 'Home',
  'nav.main': 'Navigazione principale',
  'nav.skip': 'Vai al contenuto',
  'nav.lang': 'Lingua',
  'nav.theme.toLight': 'Passa al tema chiaro',
  'nav.theme.toDark': 'Passa al tema scuro',

  'privacy.headline': 'I tuoi dati restano sul tuo computer',
  'privacy.short': 'I file vengono elaborati nel browser e non vengono mai caricati.',

  'footer.coffee': 'Offrimi un caffè',
  'footer.premium': 'Dashboard premium',
  'footer.repo': 'Codice sorgente su GitHub',
  'footer.license': 'Licenza AGPL-3.0',
  'footer.noads': 'Nessuna pubblicità, nessun cookie, nessun tracciamento.',

  'home.eyebrow': 'STRUMENTI GRATUITI · OPEN SOURCE',
  'home.h1a': 'Strumenti semplici.',
  'home.h1b': 'Nel tuo browser.',
  'home.title': 'Strumenti web semplici, gratuiti e open source',
  'home.subtitle':
    'Piccoli strumenti che funzionano direttamente nel browser. Nessuna registrazione, nessun upload.',
  'home.tools': 'Strumenti',
  'home.open': 'Apri lo strumento',
  'home.soon.badge': 'In arrivo',
  'home.soon.title': 'Nuovi strumenti in arrivo',
  'home.soon.desc': 'Altri strumenti gratuiti e privati sono in preparazione.',
  'home.why.title': 'Perché è privato',
  'home.why.1.title': 'Nessun upload',
  'home.why.1.desc':
    'Tutto viene calcolato nel tuo browser: i tuoi file non lasciano mai il tuo computer.',
  'home.why.2.title': 'Nessun cookie né tracciamento',
  'home.why.2.desc':
    'Nessun analytics, nessun font o script esterno. Salviamo solo lingua e tema, in locale.',
  'home.why.3.title': 'Open source AGPL',
  'home.why.3.desc': 'Il codice è pubblico: puoi verificarlo, usarlo e migliorarlo.',

  'tool.csv.title': 'CSV → Dashboard',
  'tool.csv.desc':
    'Carica un file CSV o Excel e ottieni subito KPI, grafici e tabella. Esporta in HTML, PNG o PDF.',

  'common.input': 'Input',
  'common.output': 'Output',
  'common.copy': 'Copia',
  'common.copied': 'Copiato',
  'common.clear': 'Cancella',
  'common.swap': 'Inverti',
  'common.chooseFile': 'Scegli un file',
  'common.counter': '{chars} caratteri · {bytes} byte',

  'tool.base64.title': 'Base64 Encode/Decode',
  'tool.base64.desc':
    'Codifica e decodifica testo e file in Base64, con UTF-8, URL-safe e data URL. Anteprima delle immagini.',
  'tool.url.title': 'URL Encode/Decode',
  'tool.url.desc':
    'Codifica e decodifica URL e parametri con percent-encoding, e scomponi un URL nelle sue parti.',
  'tool.json.title': 'JSON Formatter e Validator',
  'tool.json.desc':
    'Formatta, minifica, ordina e valida JSON, con errori indicati per riga e colonna e statistiche.',

  'seo.home.title': 'rrstudio Tools — Strumenti web gratuiti e open source',
  'seo.home.desc':
    'Strumenti web gratuiti, open source e privati: i tuoi file restano sul tuo computer. Nessuna registrazione.',
  'seo.csv.title': 'CSV → Dashboard online gratis e privato — rrstudio Tools',
  'seo.csv.desc':
    'Trasforma un file CSV o Excel in una dashboard con KPI e grafici, direttamente nel browser. Nessun upload: i dati restano sul tuo computer.',
  'seo.base64.title': 'Base64 Encode e Decode online — gratis e privato | rrstudio Tools',
  'seo.base64.desc':
    'Codifica e decodifica Base64 online, anche di file e immagini: UTF-8 corretto, variante URL-safe e data URL. Tutto nel browser, nessun upload.',
  'seo.url.title': 'URL Encode e Decode online — gratis e privato | rrstudio Tools',
  'seo.url.desc':
    'Codifica e decodifica URL e parametri (percent-encoding), con modalità componente o URL intero e tabella delle parti dell\'URL. Tutto nel browser.',
  'seo.json.title': 'JSON Formatter e Validator online — gratis e privato | rrstudio Tools',
  'seo.json.desc':
    'Formatta, minifica e valida JSON online: errori con riga e colonna, ordinamento delle chiavi ed evidenziazione della sintassi. Tutto nel browser, nessun upload.',

  'tool.ic.title': 'Comprimi e converti immagini',
  'tool.ic.desc':
    'Riduci il peso di JPG, PNG e WebP, convertili in WebP o AVIF e ridimensionali, tante alla volta. Confronto prima e dopo, ZIP finale.',
  'seo.ic.title':
    'Comprimi e converti immagini online — gratis e privato | rrstudio Tools',
  'seo.ic.desc':
    'Comprimi foto e immagini, convertile in WebP, JPEG, PNG o AVIF e ridimensionale online: tante insieme, con confronto prima e dopo e ZIP. Tutto nel browser, nessun upload.',
};

export type Dict = typeof it;
export type DictKey = keyof Dict;
