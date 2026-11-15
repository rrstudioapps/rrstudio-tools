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
  'footer.demo': 'Demo',
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

  'seo.home.title': 'rrstudio Tools — Strumenti web gratuiti e open source',
  'seo.home.desc':
    'Strumenti web gratuiti, open source e privati: i tuoi file restano sul tuo computer. Nessuna registrazione.',
  'seo.csv.title': 'CSV → Dashboard online gratis e privato — rrstudio Tools',
  'seo.csv.desc':
    'Trasforma un file CSV o Excel in una dashboard con KPI e grafici, direttamente nel browser. Nessun upload: i dati restano sul tuo computer.',
};

export type Dict = typeof it;
export type DictKey = keyof Dict;
