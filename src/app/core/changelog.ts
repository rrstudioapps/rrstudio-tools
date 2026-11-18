// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Tipo di una voce: determina il badge e il filtro della pagina Novità. */
export type ChangeKind = 'new-tool' | 'feature' | 'improvement' | 'fix';

export interface ChangeEntry {
  kind: ChangeKind;
  it: string;
  en: string;
  /** Strumenti coinvolti: diventano link, con il nome preso dal registry. Per `new-tool` sono gli strumenti nuovi. */
  toolIds?: readonly string[];
  /** Numeri delle issue GitHub collegate. */
  issues?: readonly number[];
}

export interface ChangelogVersion {
  /** Solo il giorno, AAAA-MM-GG (mai l'ora). */
  date: string;
  title: { it: string; en: string };
  entries: readonly ChangeEntry[];
}

/** Novità del sito, dalla più recente. Testi per gli utenti, non per gli sviluppatori. */
export const CHANGELOG: readonly ChangelogVersion[] = [
  {
    date: '2026-11-18',
    title: { it: 'Codice fiscale, confronto testi e stampa', en: 'Tax code, text comparison and printing' },
    entries: [
      {
        kind: 'new-tool',
        it: 'Nuovo strumento: conto alla rovescia a una data, con giorni lavorativi, fusi orari, feste e file calendario .ics.',
        en: 'New tool: countdown to a date, with working days, time zones, holidays and an .ics calendar file.',
        toolIds: ['countdown'],
      },
      {
        kind: 'new-tool',
        it: 'Nuovo strumento «Confronta elenchi»: incolla due elenchi e vedi unione, voci in comune, solo in A, solo in B e doppioni, con conteggi, copia e download di ogni scheda.',
        en: 'New tool "List compare": paste two lists and see the union, items in common, only in A, only in B and duplicates, with counts, copy and download for each tab.',
        toolIds: ['list-compare'],
      },
      {
        kind: 'new-tool',
        it: 'Nuovo strumento «Pulisci testo»: incolla un testo da PDF, email o Word e ottieni la versione pulita, con righe riunite, spazi doppi tolti, virgolette semplici, caratteri invisibili e tag HTML rimossi.',
        en: 'New tool "Text cleaner": paste text from a PDF, email or Word and get a clean version, with lines joined, double spaces removed, straight quotes, and invisible characters and HTML tags stripped.',
        toolIds: ['text-cleaner'],
      },
      {
        kind: 'improvement',
        it: 'In fondo a ogni strumento trovi i collegamenti agli strumenti affini, per passare da uno all\'altro senza tornare alla home.',
        en: 'At the bottom of every tool you now find links to related tools, to move from one to another without going back to the home page.',
      },
      {
        kind: 'new-tool',
        it: 'Timer con conto alla rovescia, cronometro con giri e pomodoro; calcolatrice scientifica con cronologia; generatore di numeri casuali, dadi, estrazioni da un elenco e squadre.',
        en: 'Timer with countdown, stopwatch with laps and Pomodoro; scientific calculator with history; generator of random numbers, dice, draws from a list and teams.',
        toolIds: ['timer', 'scientific-calculator', 'random-number-generator'],
      },
      {
        kind: 'new-tool',
        it: 'Estrazione del testo dai PDF, anche protetti da password: righe, paragrafi e colonne ricostruiti, scarico in TXT o Markdown.',
        en: 'Text extraction from PDFs, password-protected ones too: lines, paragraphs and columns rebuilt, download as TXT or Markdown.',
        toolIds: ['pdf-to-text'],
      },
      {
        kind: 'new-tool',
        it: 'Generatore di codice fiscale e di partita IVA con dati di prova, utile per testare moduli e gestionali.',
        en: 'Generator of Italian tax codes and VAT numbers with test data, handy for testing forms and software.',
        toolIds: ['generatore-codice-fiscale'],
      },
      {
        kind: 'new-tool',
        it: 'Calcolo di sottoreti IP, conversione da docker run a Docker Compose, generatore di CSS clamp(), calcolatrice di orari e scadenze delle fatture.',
        en: 'IP subnet calculator, docker run to Docker Compose converter, CSS clamp() generator, time calculator and invoice due dates.',
        toolIds: ['subnet-calculator', 'docker-run-to-compose', 'css-clamp-calculator', 'time-calculator', 'scadenze-fatture'],
      },
      {
        kind: 'new-tool',
        it: 'Confronto JSON strutturale: differenze per percorso con valore vecchio e nuovo, array per indice, come insiemi o per chiave, albero unito ed esportazione come JSON Patch.',
        en: 'Structural JSON diff: differences by path with old and new value, arrays by index, as sets or by key, merged tree view and JSON Patch export.',
        toolIds: ['json-diff'],
      },
      {
        kind: 'feature',
        it: 'Scorciatoie da tastiera in tutti gli strumenti: premi ? per vedere l\'elenco.',
        en: 'Keyboard shortcuts in every tool: press ? to see the list.',
      },
      {
        kind: 'feature',
        it: 'Nella home puoi incollare un testo o trascinare un file: il sito propone gli strumenti adatti.',
        en: 'On the home page you can paste some text or drop a file, and the site suggests the right tools.',
      },
      {
        kind: 'feature',
        it: 'Dalla versione installata come app puoi condividere testi e file verso rrstudio Tools e aprirli con gli strumenti giusti.',
        en: 'With the installed app you can share text and files to rrstudio Tools and open them with the right tools.',
      },
      {
        kind: 'feature',
        it: 'Stampa dei risultati negli strumenti di calcolo, con un impaginato pulito.',
        en: 'Print the results of the calculation tools, with a clean layout.',
      },
      {
        kind: 'feature',
        it: 'Da ogni strumento puoi segnalare un problema o suggerire un miglioramento: si apre un modulo GitHub già compilato.',
        en: 'From every tool you can report a problem or suggest an improvement: a pre-filled GitHub form opens.',
      },
      {
        kind: 'feature',
        it: 'Questa pagina Novità, con un feed per seguire gli aggiornamenti, e il badge «Nuovo» sugli strumenti appena arrivati.',
        en: 'This What\'s new page, with a feed to follow updates, and a "New" badge on newly added tools.',
      },
      {
        kind: 'improvement',
        it: 'Confronto testi più comodo: i risultati scorrono in una propria area, la barra dei comandi resta sempre in vista, puoi nascondere i testi, andare a capo e saltare a una riga, e spostarti tra le differenze con F7.',
        en: 'Easier text comparison: results scroll in their own area, the toolbar stays in view, you can hide the texts, wrap lines and jump to a line, and move between differences with F7.',
        toolIds: ['text-diff'],
      },
    ],
  },
  {
    date: '2026-11-17',
    title: { it: 'App installabile, preferiti e molti nuovi strumenti', en: 'Installable app, favorites and many new tools' },
    entries: [
      {
        kind: 'new-tool',
        it: 'Filigrana per immagini e PDF, selettore di colori e palette da un\'immagine, da SVG a PNG, convertitore di formato per le immagini.',
        en: 'Watermark for images and PDFs, color picker and palette from an image, SVG to PNG, image format converter.',
        toolIds: ['image-watermark', 'image-color-picker', 'svg-to-png', 'image-converter'],
      },
      {
        kind: 'new-tool',
        it: 'Generatori HMAC, chiavi SSH e CSR, condivisione di un segreto con Shamir.',
        en: 'HMAC, SSH key and CSR generators, secret sharing with Shamir.',
        toolIds: ['hmac-generator', 'ssh-key-generator', 'csr-generator', 'shamir-secret-sharing'],
      },
      {
        kind: 'new-tool',
        it: 'Convertitori di colori e cURL, analisi degli URL, interesse composto.',
        en: 'Color and cURL converters, URL parser, compound interest.',
        toolIds: ['color-converter', 'curl-converter', 'url-parser', 'compound-interest'],
      },
      {
        kind: 'new-tool',
        it: 'Statistica, proporzioni, ispettore Unicode, numeri romani, codice Morse, cifrari classici, lire in euro.',
        en: 'Statistics, aspect ratio, Unicode inspector, Roman numerals, Morse code, classic ciphers, lire to euro.',
        toolIds: ['statistics-calculator', 'aspect-ratio-calculator', 'unicode-inspector', 'roman-numerals', 'morse-code', 'classic-ciphers', 'convertitore-lire-euro'],
      },
      {
        kind: 'new-tool',
        it: 'Dati finti, interrogazioni JSONPath, firma dei PDF, ritaglio e rotazione immagini, anteprima dei meta tag.',
        en: 'Fake data, JSONPath queries, PDF signing, image crop and rotate, meta tag preview.',
        toolIds: ['fake-data-generator', 'json-query', 'pdf-sign', 'image-crop', 'meta-tag-preview'],
      },
      {
        kind: 'new-tool',
        it: 'Trentuno strumenti in una volta: ritenuta d\'acconto, rata del mutuo, numeri in lettere, formattatori YAML, XML e SQL, TOTP, cifratura dei file, lettore di QR code e molti altri.',
        en: 'Thirty-one tools at once: Italian withholding tax, mortgage payments, numbers in words, YAML, XML and SQL formatters, TOTP, file encryption, QR code reader and many more.',
        toolIds: ['calcolo-ritenuta-acconto', 'calcolo-rata-mutuo', 'numeri-in-lettere', 'totp-generator', 'file-encrypt', 'qr-code-reader'],
      },
      {
        kind: 'feature',
        it: 'Il sito si può installare come app e funziona anche senza connessione.',
        en: 'The site can be installed as an app and also works offline.',
      },
      {
        kind: 'feature',
        it: 'Preferiti e menu personalizzati, con esportazione e importazione in un file e link per passarli a un altro dispositivo. Restano nel tuo browser.',
        en: 'Favorites and custom menus, with export and import to a file and a link to move them to another device. They stay in your browser.',
      },
      {
        kind: 'feature',
        it: 'Link condivisibili in 36 strumenti: l\'impostazione che hai scelto si rimette uguale a chi apre il link. Nel link non finiscono mai i tuoi file.',
        en: 'Shareable links in 36 tools: the settings you chose are restored for whoever opens the link. Your files never end up in the link.',
      },
      {
        kind: 'feature',
        it: 'Funzione «Invia a…»: passi il risultato di uno strumento a un altro senza copiare e incollare.',
        en: '"Send to…": pass the result of one tool to another without copy and paste.',
      },
      {
        kind: 'improvement',
        it: 'Guide «come si fa» e domande frequenti negli strumenti, home con 8 categorie, filtro Preferiti e schede più compatte su telefono.',
        en: '"How to" guides and FAQs in the tools, a home page with 8 categories, a Favorites filter and more compact cards on phones.',
      },
      {
        kind: 'improvement',
        it: 'Pagine più veloci a comparire e più reattive.',
        en: 'Pages appear faster and respond more quickly.',
      },
    ],
  },
  {
    date: '2026-11-16',
    title: { it: 'Versione inglese e nuovi strumenti', en: 'English version and new tools' },
    entries: [
      {
        kind: 'new-tool',
        it: 'Codice QR, calcolo dell\'IVA, confronto testi, convertitore CSV/JSON/Excel, JWT, UUID, timestamp, contrasto dei colori, editor Markdown, contaparole, prova delle espressioni regolari, giorni lavorativi.',
        en: 'QR code, VAT calculator, text diff, CSV/JSON/Excel converter, JWT, UUID, timestamp, color contrast, Markdown editor, word counter, regex tester, working days.',
        toolIds: ['qr-code-generator', 'calcolo-iva', 'text-diff', 'csv-json-converter', 'jwt-decoder', 'uuid-generator', 'timestamp-converter', 'color-contrast-checker', 'markdown-editor', 'word-counter', 'regex-tester', 'calcolo-giorni-lavorativi'],
      },
      {
        kind: 'new-tool',
        it: 'Visualizzatore di fatture elettroniche, da immagini a PDF e da PDF a immagini, lettore dei dati EXIF.',
        en: 'E-invoice viewer, images to PDF and PDF to images, EXIF viewer.',
        toolIds: ['fattura-elettronica', 'images-to-pdf', 'pdf-to-images', 'exif-viewer'],
      },
      {
        kind: 'new-tool',
        it: 'Visualizzatore e editor JSON.',
        en: 'JSON viewer and editor.',
        toolIds: ['json-viewer'],
      },
      {
        kind: 'improvement',
        it: 'Il calcolo del codice fiscale ora gestisce anche i comuni soppressi e gli stati esteri.',
        en: 'The tax code tool now also handles suppressed municipalities and foreign states.',
        toolIds: ['codice-fiscale'],
      },
      {
        kind: 'new-tool',
        it: 'Verifica del codice fiscale e di IBAN e partita IVA.',
        en: 'Validation of Italian tax codes, IBANs and VAT numbers.',
        toolIds: ['codice-fiscale', 'iban-partita-iva'],
      },
      {
        kind: 'feature',
        it: 'Il sito è disponibile in inglese: aggiungi /en/ all\'indirizzo oppure usa il selettore di lingua.',
        en: 'The site is available in English: add /en/ to the address or use the language switch.',
      },
      {
        kind: 'feature',
        it: 'Strumenti divisi per categoria nella home e informativa sulla privacy.',
        en: 'Tools grouped by category on the home page, and a privacy notice.',
      },
      {
        kind: 'improvement',
        it: 'Più accessibilità, anteprime più curate quando si condivide un indirizzo del sito.',
        en: 'Better accessibility and nicer previews when a page of the site is shared.',
      },
    ],
  },
  {
    date: '2026-11-15',
    title: { it: 'Prima uscita', en: 'First release' },
    entries: [
      {
        kind: 'new-tool',
        it: 'Dalla prima uscita: CSV in dashboard, generatore di password, calcolo di hash, strumenti per i PDF (unisci, dividi, ruota, riordina), compressione immagini, Base64, codifica degli URL e formattatore JSON.',
        en: 'From day one: CSV to dashboard, password generator, hash calculator, PDF tools (merge, split, rotate, reorder), image compressor, Base64, URL encoding and JSON formatter.',
        toolIds: ['csv-dashboard', 'password-generator', 'hash-generator', 'pdf-tools', 'image-compressor', 'base64', 'url-encode', 'json-formatter'],
      },
      {
        kind: 'fix',
        it: 'Esportazione in PNG e PDF: margini corretti e file PDF molto più piccoli.',
        en: 'PNG and PDF export: correct margins and much smaller PDF files.',
        toolIds: ['csv-dashboard'],
      },
    ],
  },
];
