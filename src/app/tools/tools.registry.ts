// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import type { IconName } from '../shared/icon';
import type { DictKey } from '../core/i18n/it';

/**
 * Descrizione di un tool. Per aggiungerne uno: nuova cartella in tools/ + una voce qui.
 * Titolo/descrizione e dati SEO sono chiavi del dizionario principale (core/i18n).
 */
export type ToolCategoryId = 'data' | 'dev' | 'security' | 'italy';

/** Categoria mostrata in home. L'ordine dell'array CATEGORIES è quello delle sezioni. */
export interface ToolCategory {
  id: ToolCategoryId;
  /** Parte dell'URL italiana (?categoria=slug o #slug) e id dell'ancora della sezione. */
  slug: string;
  /** Lo stesso in inglese (?category=slug o #slug nelle pagine /en/). */
  slugEn: string;
  titleKey: DictKey;
  descriptionKey: DictKey;
}

export const CATEGORIES: readonly ToolCategory[] = [
  { id: 'data', slug: 'dati', slugEn: 'data', titleKey: 'cat.data.title', descriptionKey: 'cat.data.desc' },
  { id: 'dev', slug: 'sviluppatori', slugEn: 'developers', titleKey: 'cat.dev.title', descriptionKey: 'cat.dev.desc' },
  { id: 'security', slug: 'sicurezza', slugEn: 'security', titleKey: 'cat.security.title', descriptionKey: 'cat.security.desc' },
  { id: 'italy', slug: 'italia', slugEn: 'italy', titleKey: 'cat.italy.title', descriptionKey: 'cat.italy.desc' },
];

export interface ToolDefinition {
  id: string;
  /** Percorso della route (senza slash iniziale). */
  path: string;
  icon: IconName;
  /** Solo per l'Italia: nessuna versione inglese (/en/…), resta solo la pagina italiana. */
  italyOnly?: boolean;
  /** Un tool sta in una sola categoria. */
  category: ToolCategoryId;
  /** Parole chiave extra per la ricerca in home (non mostrate). */
  keywords?: { it: string; en: string };
  titleKey: DictKey;
  descriptionKey: DictKey;
  seo: { titleKey: DictKey; descriptionKey: DictKey };
  /** Dati di route extra (es. la modalità preimpostata di un componente condiviso da più route). */
  routeData?: Record<string, unknown>;
  /** Caricamento lazy: o un singolo componente o un file di route. */
  loadComponent?: () => Promise<Type<unknown>>;
  loadChildren?: () => Promise<Routes>;
}

export const TOOLS: readonly ToolDefinition[] = [
  {
    id: 'csv-dashboard',
    path: 'csv-dashboard',
    icon: 'chart',
    category: 'data',
    keywords: { it: 'csv dashboard excel xlsx grafici kpi tabella charts spreadsheet', en: 'csv dashboard excel xlsx charts kpi table spreadsheet' },
    titleKey: 'tool.csv.title',
    descriptionKey: 'tool.csv.desc',
    seo: { titleKey: 'seo.csv.title', descriptionKey: 'seo.csv.desc' },
    loadChildren: () =>
      import('./csv-dashboard/csv-dashboard.routes').then((m) => m.CSV_DASHBOARD_ROUTES),
  },
  {
    id: 'qr-code-generator',
    path: 'qr-code-generator',
    icon: 'qr',
    category: 'data',
    keywords: {
      it: 'qr code generatore codice qr wifi vcard biglietto da visita contatto url link sms email geo posizione logo png svg barcode',
      en: 'qr code generator wifi vcard business card contact url link sms email geo location logo png svg barcode',
    },
    titleKey: 'tool.qr.title',
    descriptionKey: 'tool.qr.desc',
    seo: { titleKey: 'seo.qr.title', descriptionKey: 'seo.qr.desc' },
    loadComponent: () => import('./qr-code/qr-code.page').then((m) => m.QrCodePage),
  },
  {
    id: 'text-diff',
    path: 'text-diff',
    icon: 'columns',
    category: 'dev',
    keywords: {
      it: 'diff confronto confronta testi file differenze righe parole patch unified git compare',
      en: 'diff compare text files differences lines words patch unified git',
    },
    titleKey: 'tool.diff.title',
    descriptionKey: 'tool.diff.desc',
    seo: { titleKey: 'seo.diff.title', descriptionKey: 'seo.diff.desc' },
    loadComponent: () => import('./text-diff/text-diff.page').then((m) => m.TextDiffPage),
  },
  {
    id: 'markdown-editor',
    path: 'markdown-editor',
    icon: 'markdown',
    category: 'data',
    keywords: {
      it: 'markdown editor anteprima live md html pdf titoli elenchi tabelle codice formatta scrivi documento readme commonmark gfm',
      en: 'markdown editor live preview md html pdf headings lists tables code format write document readme commonmark gfm',
    },
    titleKey: 'tool.md.title',
    descriptionKey: 'tool.md.desc',
    seo: { titleKey: 'seo.md.title', descriptionKey: 'seo.md.desc' },
    loadComponent: () => import('./markdown-editor/markdown-editor.page').then((m) => m.MarkdownEditorPage),
  },
  {
    id: 'word-counter',
    path: 'word-counter',
    icon: 'type',
    category: 'data',
    keywords: {
      it: 'contatore parole caratteri conta frasi paragrafi righe tempo di lettura parlato densità parole frequenti stopword sms twitter x meta description maiuscolo minuscolo iniziali maiuscole',
      en: 'word counter character count sentences paragraphs lines reading time speaking time keyword density frequent words stopwords sms twitter x meta description uppercase lowercase title case',
    },
    titleKey: 'tool.wc.title',
    descriptionKey: 'tool.wc.desc',
    seo: { titleKey: 'seo.wc.title', descriptionKey: 'seo.wc.desc' },
    loadComponent: () => import('./word-counter/word-counter.page').then((m) => m.WordCounterPage),
  },
  {
    id: 'regex-tester',
    path: 'regex-tester',
    icon: 'regex',
    category: 'dev',
    keywords: {
      it: 'regex espressioni regolari tester prova pattern flag gruppi corrispondenze sostituzione spiega javascript match backtracking',
      en: 'regex regular expressions tester pattern flags groups matches replace explain javascript match backtracking',
    },
    titleKey: 'tool.rx.title',
    descriptionKey: 'tool.rx.desc',
    seo: { titleKey: 'seo.rx.title', descriptionKey: 'seo.rx.desc' },
    loadComponent: () => import('./regex-tester/regex-tester.page').then((m) => m.RegexTesterPage),
  },
  {
    id: 'csv-json-converter',
    path: 'csv-json-converter',
    icon: 'swap',
    category: 'data',
    keywords: {
      it: 'csv json excel xlsx converti convertitore tsv separatore foglio tabella appiattisci annidati',
      en: 'csv json excel xlsx convert converter tsv delimiter sheet table flatten nested',
    },
    titleKey: 'tool.cj.title',
    descriptionKey: 'tool.cj.desc',
    seo: { titleKey: 'seo.cj.title', descriptionKey: 'seo.cj.desc' },
    loadComponent: () => import('./csv-json-converter/csv-json-converter.page').then((m) => m.CsvJsonConverterPage),
  },
  {
    id: 'base64',
    path: 'base64',
    icon: 'code',
    category: 'dev',
    keywords: { it: 'base64 codifica decodifica data url immagine utf-8', en: 'base64 encode decode data url image utf-8' },
    titleKey: 'tool.base64.title',
    descriptionKey: 'tool.base64.desc',
    seo: { titleKey: 'seo.base64.title', descriptionKey: 'seo.base64.desc' },
    loadComponent: () => import('./base64/base64.page').then((m) => m.Base64Page),
  },
  {
    id: 'url-encode',
    path: 'url-encode',
    icon: 'link',
    category: 'dev',
    keywords: { it: 'url percent encoding querystring parametri codifica decodifica', en: 'url percent encoding query string parameters encode decode' },
    titleKey: 'tool.url.title',
    descriptionKey: 'tool.url.desc',
    seo: { titleKey: 'seo.url.title', descriptionKey: 'seo.url.desc' },
    loadComponent: () => import('./url-encode/url-encode.page').then((m) => m.UrlEncodePage),
  },
  {
    id: 'json-formatter',
    path: 'json-formatter',
    icon: 'braces',
    category: 'data',
    keywords: { it: 'json formatta minifica valida indenta ordina chiavi errori riga colonna', en: 'json format minify validate indent sort keys lint beautify' },
    titleKey: 'tool.json.title',
    descriptionKey: 'tool.json.desc',
    seo: { titleKey: 'seo.json.title', descriptionKey: 'seo.json.desc' },
    loadComponent: () => import('./json-formatter/json-formatter.page').then((m) => m.JsonFormatterPage),
  },
  {
    id: 'json-viewer',
    path: 'json-viewer',
    icon: 'tree',
    category: 'data',
    keywords: {
      it: 'json viewer editor albero visualizza modifica percorso jsonpath pointer cerca nodi',
      en: 'json viewer editor tree view edit path jsonpath pointer search nodes',
    },
    titleKey: 'tool.jv.title',
    descriptionKey: 'tool.jv.desc',
    seo: { titleKey: 'seo.jv.title', descriptionKey: 'seo.jv.desc' },
    loadComponent: () => import('./json-viewer/json-viewer.page').then((m) => m.JsonViewerPage),
  },
  {
    id: 'image-compressor',
    path: 'image-compressor',
    icon: 'image',
    category: 'data',
    keywords: { it: 'immagini foto comprimi converti webp avif jpeg png ridimensiona zip', en: 'images photos compress convert webp avif jpeg png resize zip' },
    titleKey: 'tool.ic.title',
    descriptionKey: 'tool.ic.desc',
    seo: { titleKey: 'seo.ic.title', descriptionKey: 'seo.ic.desc' },
    loadComponent: () =>
      import('./image-compressor/image-compressor.page').then((m) => m.ImageCompressorPage),
  },
  {
    id: 'pdf-tools',
    path: 'pdf-tools',
    icon: 'layers',
    category: 'data',
    keywords: { it: 'pdf unisci dividi ruota pagine estrai riordina merge split', en: 'pdf merge split rotate pages extract reorder' },
    titleKey: 'tool.pdf.title',
    descriptionKey: 'tool.pdf.desc',
    seo: { titleKey: 'seo.pdf.title', descriptionKey: 'seo.pdf.desc' },
    loadComponent: () => import('./pdf-tools/pdf-tools.page').then((m) => m.PdfToolsPage),
  },
  {
    id: 'images-to-pdf',
    path: 'images-to-pdf',
    icon: 'image',
    category: 'data',
    keywords: {
      it: 'immagini in pdf jpg png webp foto unisci converti pagina a4 letter margini',
      en: 'images to pdf jpg png webp photos combine convert page a4 letter margins',
    },
    routeData: { mode: 'images-to-pdf' },
    titleKey: 'tool.i2p.title',
    descriptionKey: 'tool.i2p.desc',
    seo: { titleKey: 'seo.i2p.title', descriptionKey: 'seo.i2p.desc' },
    loadComponent: () => import('./images-pdf/images-pdf.page').then((m) => m.ImagesPdfPage),
  },
  {
    id: 'pdf-to-images',
    path: 'pdf-to-images',
    icon: 'file',
    category: 'data',
    keywords: {
      it: 'pdf in immagini png jpeg jpg converti pagine dpi risoluzione esporta zip',
      en: 'pdf to images png jpeg jpg convert pages dpi resolution export zip',
    },
    routeData: { mode: 'pdf-to-images' },
    titleKey: 'tool.p2i.title',
    descriptionKey: 'tool.p2i.desc',
    seo: { titleKey: 'seo.p2i.title', descriptionKey: 'seo.p2i.desc' },
    loadComponent: () => import('./images-pdf/images-pdf.page').then((m) => m.ImagesPdfPage),
  },
  {
    id: 'exif-viewer',
    path: 'exif-viewer',
    icon: 'eyeOff',
    category: 'security',
    keywords: {
      it: 'exif metadati foto gps posizione privacy rimuovi pulisci xmp iptc jpeg png webp fotocamera',
      en: 'exif metadata photo gps location privacy remove strip clean xmp iptc jpeg png webp camera',
    },
    titleKey: 'tool.exif.title',
    descriptionKey: 'tool.exif.desc',
    seo: { titleKey: 'seo.exif.title', descriptionKey: 'seo.exif.desc' },
    loadComponent: () => import('./exif-viewer/exif-viewer.page').then((m) => m.ExifViewerPage),
  },
  {
    id: 'password-generator',
    path: 'password-generator',
    icon: 'lock',
    category: 'security',
    keywords: { it: 'password passphrase generatore casuale entropia sicura', en: 'password passphrase generator random entropy secure' },
    titleKey: 'tool.pw.title',
    descriptionKey: 'tool.pw.desc',
    seo: { titleKey: 'seo.pw.title', descriptionKey: 'seo.pw.desc' },
    loadComponent: () =>
      import('./password-generator/password-generator.page').then((m) => m.PasswordGeneratorPage),
  },
  {
    id: 'hash-generator',
    path: 'hash-generator',
    icon: 'hash',
    category: 'dev',
    keywords: { it: 'hash checksum sha256 sha1 sha512 md5 file integrita', en: 'hash checksum sha256 sha1 sha512 md5 file integrity' },
    titleKey: 'tool.hash.title',
    descriptionKey: 'tool.hash.desc',
    seo: { titleKey: 'seo.hash.title', descriptionKey: 'seo.hash.desc' },
    loadComponent: () => import('./hash-generator/hash-generator.page').then((m) => m.HashGeneratorPage),
  },
  {
    id: 'jwt-decoder',
    path: 'jwt-decoder',
    icon: 'key',
    category: 'dev',
    keywords: {
      it: 'jwt json web token decodifica decodificatore bearer header payload claim exp scadenza firma jws jwe oauth',
      en: 'jwt json web token decode decoder bearer header payload claims exp expiry signature jws jwe oauth',
    },
    titleKey: 'tool.jwt.title',
    descriptionKey: 'tool.jwt.desc',
    seo: { titleKey: 'seo.jwt.title', descriptionKey: 'seo.jwt.desc' },
    loadComponent: () => import('./jwt-decoder/jwt-decoder.page').then((m) => m.JwtDecoderPage),
  },
  {
    id: 'uuid-generator',
    path: 'uuid-generator',
    icon: 'dice',
    category: 'dev',
    keywords: {
      it: 'uuid guid ulid generatore identificativo univoco v4 v7 casuale validatore versione variante id',
      en: 'uuid guid ulid generator unique identifier v4 v7 random validator version variant id',
    },
    titleKey: 'tool.uuid.title',
    descriptionKey: 'tool.uuid.desc',
    seo: { titleKey: 'seo.uuid.title', descriptionKey: 'seo.uuid.desc' },
    loadComponent: () => import('./uuid-generator/uuid-generator.page').then((m) => m.UuidGeneratorPage),
  },
  {
    id: 'timestamp-converter',
    path: 'timestamp-converter',
    icon: 'clock',
    category: 'dev',
    keywords: {
      it: 'timestamp unix epoch data ora converti convertitore secondi millisecondi fuso orario iso 8601 rfc 2822 ora legale adesso relativo',
      en: 'timestamp unix epoch date time convert converter seconds milliseconds time zone iso 8601 rfc 2822 daylight saving now relative',
    },
    titleKey: 'tool.ts.title',
    descriptionKey: 'tool.ts.desc',
    seo: { titleKey: 'seo.ts.title', descriptionKey: 'seo.ts.desc' },
    loadComponent: () => import('./timestamp-converter/timestamp-converter.page').then((m) => m.TimestampConverterPage),
  },
  {
    id: 'color-contrast-checker',
    path: 'color-contrast-checker',
    icon: 'contrast',
    category: 'dev',
    keywords: {
      it: 'colori contrasto wcag accessibilita aa aaa rapporto testo sfondo hex rgb hsl oklch conversione luminanza a11y',
      en: 'color colour contrast wcag accessibility aa aaa ratio text background hex rgb hsl oklch conversion luminance a11y',
    },
    titleKey: 'tool.cc.title',
    descriptionKey: 'tool.cc.desc',
    seo: { titleKey: 'seo.cc.title', descriptionKey: 'seo.cc.desc' },
    loadComponent: () =>
      import('./color-contrast-checker/color-contrast-checker.page').then((m) => m.ColorContrastCheckerPage),
  },
  {
    id: 'codice-fiscale',
    italyOnly: true,
    path: 'codice-fiscale',
    icon: 'idcard',
    category: 'italy',
    keywords: { it: 'codice fiscale cf omocodia calcolo verifica comune nascita', en: 'italian tax code codice fiscale cf calculate check birth place' },
    titleKey: 'tool.cf.title',
    descriptionKey: 'tool.cf.desc',
    seo: { titleKey: 'seo.cf.title', descriptionKey: 'seo.cf.desc' },
    loadComponent: () => import('./codice-fiscale/codice-fiscale.page').then((m) => m.CodiceFiscalePage),
  },
  {
    id: 'iban-partita-iva',
    italyOnly: true,
    path: 'iban-partita-iva',
    icon: 'bank',
    category: 'italy',
    keywords: { it: 'iban partita iva piva banca conto verifica cin abi cab', en: 'iban vat number italian partita iva bank account validate' },
    titleKey: 'tool.iban.title',
    descriptionKey: 'tool.iban.desc',
    seo: { titleKey: 'seo.iban.title', descriptionKey: 'seo.iban.desc' },
    loadComponent: () => import('./iban-partita-iva/iban-partita-iva.page').then((m) => m.IbanPartitaIvaPage),
  },
  {
    id: 'fattura-elettronica',
    italyOnly: true,
    path: 'fattura-elettronica',
    icon: 'file',
    category: 'italy',
    keywords: {
      it: 'fattura elettronica xml p7m fatturapa sdi visualizza leggi stampa zip allegati tracciato',
      en: 'italian e-invoice electronic invoice fatturapa xml p7m sdi viewer read print zip attachments',
    },
    titleKey: 'tool.fe.title',
    descriptionKey: 'tool.fe.desc',
    seo: { titleKey: 'seo.fe.title', descriptionKey: 'seo.fe.desc' },
    loadComponent: () =>
      import('./fattura-elettronica/fattura-elettronica.page').then((m) => m.FatturaElettronicaPage),
  },
  {
    id: 'calcolo-iva',
    italyOnly: true,
    path: 'calcolo-iva',
    icon: 'calculator',
    category: 'italy',
    keywords: {
      it: 'iva calcolo scorporo ritenuta acconto rivalsa inps cassa previdenziale bollo forfettario notula fattura professionista netto lordo 22',
      en: 'italian vat calculator extract withholding tax inps surcharge pension fund stamp duty flat rate freelancer invoice net gross',
    },
    titleKey: 'tool.iva.title',
    descriptionKey: 'tool.iva.desc',
    seo: { titleKey: 'seo.iva.title', descriptionKey: 'seo.iva.desc' },
    loadComponent: () => import('./calcolo-iva/calcolo-iva.page').then((m) => m.CalcoloIvaPage),
  },
  {
    id: 'calcolo-giorni-lavorativi',
    italyOnly: true,
    path: 'calcolo-giorni-lavorativi',
    icon: 'calendar',
    category: 'italy',
    keywords: {
      it: 'giorni lavorativi calcolo scadenza festività festivi pasqua pasquetta santo patrono weekend sabato domenica aggiungi togli data giorni feriali calendario',
      en: 'italian working days business days calculator deadline public holidays easter patron saint weekend add subtract dates calendar',
    },
    titleKey: 'tool.wd.title',
    descriptionKey: 'tool.wd.desc',
    seo: { titleKey: 'seo.wd.title', descriptionKey: 'seo.wd.desc' },
    loadComponent: () =>
      import('./calcolo-giorni-lavorativi/calcolo-giorni-lavorativi.page').then((m) => m.CalcoloGiorniLavorativiPage),
  },
];
