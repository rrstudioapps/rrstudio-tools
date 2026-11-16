// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Dict } from './it';

/** Dizionario inglese: il tipo Dict garantisce le stesse chiavi dell'italiano. */
export const en: Dict = {
  'nav.home': 'Home',
  'nav.main': 'Main navigation',
  'nav.skip': 'Skip to content',
  'nav.lang': 'Language',
  'nav.theme.toLight': 'Switch to light theme',
  'nav.theme.toDark': 'Switch to dark theme',

  'privacy.headline': 'Your data stays on your computer',
  'privacy.short': 'Files are processed in your browser and are never uploaded.',

  'footer.coffee': 'Buy me a coffee',
  'footer.tools': 'Tools',
  'footer.dashboards': 'Dashboards',
  'footer.apps': 'Apps',
  'footer.github': 'GitHub',
  'footer.license': 'AGPL-3.0 license',
  'footer.source': 'Source code',
  'footer.privacy': 'Privacy',
  'footer.noads': 'No ads, no cookies, no tracking.',

  'home.eyebrow': 'FREE TOOLS · OPEN SOURCE',
  'home.h1a': 'Simple tools.',
  'home.h1b': 'In your browser.',
  'home.title': 'Simple, free and open source web tools',
  'home.subtitle':
    'Small tools that run right in your browser. No sign-up, no uploads.',
  'home.tools': 'Tools',
  'home.filters.label': 'Filter by category',
  'home.filter.all': 'All',
  'home.search.label': 'Search tools',
  'home.search.ph': 'Search: hash, pdf, iban…',
  'home.results': '{n} tools',
  'home.results.one': '1 tool',
  'home.empty': 'No tool matches your search.',
  'home.reset': 'Clear filters',
  'cat.data.title': 'Data & documents',
  'cat.data.desc': 'Tables, JSON, PDF, images and text: open, write, clean up and convert your files.',
  'cat.dev.title': 'Developers',
  'cat.dev.desc': 'Encode, decode and compute: small workbench tools.',
  'cat.security.title': 'Security',
  'cat.security.desc': 'Strong passwords and photo metadata: your privacy, handled in the browser.',
  'cat.italy.title': 'Italy: tax & banking',
  'cat.italy.desc': 'Codice fiscale, IBAN, VAT number, VAT calculator, working days and e-invoices: calculate, verify and read.',
  'home.italy.lead': 'Tools for Italy (in Italian):',
  'home.italy.codice-fiscale': 'codice fiscale',
  'home.italy.iban-partita-iva': 'IBAN & partita IVA',
  'home.italy.fattura-elettronica': 'fattura elettronica',
  'home.italy.calcolo-iva': 'VAT & withholding calculator',
  'home.italy.calcolo-giorni-lavorativi': 'working days calculator',
  'home.open': 'Open the tool',
  'home.soon.badge': 'Coming soon',
  'home.soon.title': 'More tools coming soon',
  'home.soon.desc': 'More free and private tools are on the way.',
  'home.why.title': 'Why it is private',
  'home.why.1.title': 'No uploads',
  'home.why.1.desc':
    'Everything is computed in your browser: your files never leave your computer.',
  'home.why.2.title': 'No cookies, no tracking',
  'home.why.2.desc':
    'No analytics scripts, no external fonts or scripts. Only your theme and a few preferences stay in your browser.',
  'home.why.3.title': 'Open source AGPL',
  'home.why.3.desc': 'The code is public: you can inspect it, use it and improve it.',

  'tool.csv.title': 'CSV → Dashboard',
  'tool.csv.desc':
    'Load a CSV or Excel file and get KPIs, charts and a table instantly. Export to HTML, PNG or PDF.',

  'common.input': 'Input',
  'common.output': 'Output',
  'common.copy': 'Copy',
  'common.copied': 'Copied',
  'common.clear': 'Clear',
  'common.swap': 'Swap',
  'common.chooseFile': 'Choose a file',
  'common.counter': '{chars} characters · {bytes} bytes',

  'tool.base64.title': 'Base64 Encode/Decode',
  'tool.base64.desc':
    'Encode and decode text and files to Base64, with UTF-8, URL-safe and data URL support. Image preview included.',
  'tool.url.title': 'URL Encode/Decode',
  'tool.url.desc':
    'Encode and decode URLs and query parameters with percent-encoding, and break a URL into its parts.',
  'tool.json.title': 'JSON Formatter and Validator',
  'tool.json.desc':
    'Format, minify, sort and validate JSON, with errors pinpointed by line and column, plus statistics.',

  'seo.home.title': 'rrstudio Tools — Free and open source web tools',
  'seo.home.desc':
    'Free, open source and private web tools: PDF, JSON, CSV, images, QR codes and more. Your files stay on your computer. No sign-up, no tracking.',
  'seo.csv.title': 'CSV → Dashboard, free and private online — rrstudio Tools',
  'seo.csv.desc':
    'Turn a CSV or Excel file into a dashboard with KPIs and charts, right in your browser. No uploads: your data stays on your computer.',
  'seo.base64.title': 'Base64 Encode and Decode online | rrstudio Tools',
  'seo.base64.desc':
    'Encode and decode Base64 online, including files and images: proper UTF-8, URL-safe variant and data URLs. Runs in your browser, nothing is uploaded.',
  'seo.url.title': 'URL Encode and Decode online | rrstudio Tools',
  'seo.url.desc':
    'Encode and decode URLs and query parameters (percent-encoding) in component or full-URL mode, with a table of the URL parts. Runs in your browser.',
  'seo.json.title': 'JSON Formatter and Validator online | rrstudio Tools',
  'seo.json.desc':
    'Format, minify and validate JSON online: errors with line and column, key sorting and syntax highlighting. Runs in your browser, nothing is uploaded.',
  'tool.jv.title': 'JSON viewer & editor',
  'tool.jv.desc':
    'Explore JSON as a tree, search keys and values, copy the path and edit nodes with undo and redo. Handles files of tens of MB.',
  'seo.jv.title': 'JSON Viewer and Editor, tree view | rrstudio Tools',
  'seo.jv.desc':
    'View and edit JSON as an expandable tree: search, JavaScript path and JSON Pointer, edit keys and values, undo and redo. Nothing is uploaded.',

  'tool.ic.title': 'Image compressor & converter',
  'tool.ic.desc':
    'Shrink JPG, PNG and WebP files, convert to WebP or AVIF and resize them, many at once. Before/after comparison and a ZIP download.',
  'seo.ic.title':
    'Image compressor and converter | rrstudio Tools',
  'seo.ic.desc':
    'Compress photos and images, convert them to WebP, JPEG, PNG or AVIF and resize them in bulk, with a before/after comparison and ZIP. No upload.',

  'tool.pdf.title': 'PDF tools: merge, split, rotate',
  'tool.pdf.desc':
    'Merge several PDFs, extract or split pages, rotate and reorder them from a grid of thumbnails. Your files never leave your computer.',
  'seo.pdf.title': 'Merge, split and rotate PDF online | rrstudio Tools',
  'seo.pdf.desc':
    'Merge PDFs into one, split a PDF, extract, delete, rotate and reorder pages. All in your browser, nothing is uploaded: fine for confidential files.',

  'tool.pw.title': 'Password generator',
  'tool.pw.desc':
    'Random passwords and memorable passphrases, with entropy and an estimated time to guess them. Made in your browser, never stored.',
  'seo.pw.title': 'Secure password generator online | rrstudio Tools',
  'seo.pw.desc':
    'Generate random passwords and passphrases with the browser\'s cryptography: length, character sets, entropy in bits and time to guess. Nothing is stored.',

  'tool.hash.title': 'Hash & checksum',
  'tool.hash.desc':
    'Compute MD5, SHA-1, SHA-256, SHA-384 and SHA-512 of a text or a file (up to 2 GB) and compare them with a checksum. All in your browser.',
  'seo.hash.title': 'SHA-256, SHA-1, MD5 hash calculator | rrstudio Tools',
  'seo.hash.desc':
    'Compute SHA-256, SHA-512, SHA-1 and MD5 of a text or a file and verify a checksum, with a progress bar for large files. All in your browser, no upload.',

  'tool.cf.title': 'Italian tax code (codice fiscale) calculator',
  'tool.cf.desc':
    'Calculate the Italian codice fiscale from name, surname, sex, date and place of birth, or check and decode a code (including omocodia). No personal data leaves your computer.',
  'seo.cf.title': 'Italian tax code (codice fiscale) tool | rrstudio Tools',
  'seo.cf.desc':
    'Calculate the codice fiscale from name, surname, date and place of birth and validate one: check character, omocodia, sex and date. No data is sent or stored.',

  'tool.iban.title': 'IBAN & Italian VAT number validator',
  'tool.iban.desc':
    'Check an IBAN (mod-97, length per country, Italian CIN, ABI and CAB) or an Italian VAT number (partita IVA), also in bulk with CSV export. No data leaves your computer.',
  'seo.iban.title': 'IBAN and Italian VAT number validator | rrstudio Tools',
  'seo.iban.desc':
    'Check whether an IBAN is valid (mod-97, length per country, CIN, ABI, CAB) and whether an Italian VAT number is correct, in bulk with CSV export.',

  'tool.fe.title': 'Italian e-invoice viewer (FatturaPA XML/P7M)',
  'tool.fe.desc':
    'Open an Italian electronic invoice in XML, a signed .p7m file or a ZIP of invoices and read it laid out: parties, lines, VAT, totals, payment and attachments. Print or save as PDF.',
  'seo.fe.title': 'Italian e-invoice XML and P7M viewer | rrstudio Tools',
  'seo.fe.desc':
    'Read an Italian electronic invoice (FatturaPA XML, signed .p7m, ZIP): supplier, lines, VAT summary, totals, due dates and attachments. Print to PDF, no upload.',

  'tool.i2p.title': 'Images to PDF',
  'tool.i2p.desc':
    'Combine JPG, PNG and WebP images into one PDF: reorder the thumbnails, pick page size, orientation, margins, images per page and quality.',
  'seo.i2p.title': 'Images to PDF online (JPG, PNG, WebP) | rrstudio Tools',
  'seo.i2p.desc':
    'Combine several JPG, PNG or WebP images into one PDF: any order, A4, Letter or fit-to-image pages, margins, 1, 2 or 4 images per page. All in your browser.',

  'tool.p2i.title': 'PDF to images',
  'tool.p2i.desc':
    'Turn PDF pages into PNG or JPEG images at 72, 150 or 300 dpi: choose the pages, preview them and download one by one or as a ZIP.',
  'seo.p2i.title': 'PDF to PNG or JPG images online | rrstudio Tools',
  'seo.p2i.desc':
    'Convert PDF pages to PNG or JPEG images, all of them or just a range, at 72, 150 or 300 dpi, with previews and a ZIP download. All in your browser, no upload.',

  'tool.exif.title': 'EXIF viewer & remover: photo metadata',
  'tool.exif.desc':
    'See what your photos reveal (GPS location, phone model, date, serial number) and remove the metadata without recompressing the image.',
  'seo.exif.title': 'View and remove photo EXIF metadata | rrstudio Tools',
  'seo.exif.desc':
    'Read the EXIF, GPS, XMP and IPTC metadata of JPEG, PNG and WebP files and strip it with no recompression, with warnings about sensitive data. No upload.',

  'tool.qr.title': 'QR code generator',
  'tool.qr.desc':
    'Create QR codes for links, text, WiFi, contacts, email, SMS and locations, with colors, a logo and error correction. Download PNG or SVG.',
  'seo.qr.title': 'Free QR code generator with logo and WiFi | rrstudio Tools',
  'seo.qr.desc':
    'Create QR codes for links, text, WiFi, vCard, email, SMS and locations: colors, margin, centre logo, PNG and SVG. In your browser, no account, never expires.',

  'tool.iva.title': 'Italian VAT, VAT extraction and withholding tax calculator',
  'tool.iva.desc':
    'Add or extract Italian VAT and prepare a freelancer invoice: INPS surcharge, pension fund, withholding tax, stamp duty and flat-rate regime. Also from net to fee.',
  'seo.iva.title': 'Italian VAT and withholding calculator | rrstudio Tools',
  'seo.iva.desc':
    'Calculate Italian VAT, extract VAT from a gross amount and prepare an invoice with INPS surcharge, 20% withholding tax, stamp duty and flat-rate regime.',

  'tool.diff.title': 'Text compare (diff)',
  'tool.diff.desc':
    'Compare two texts or files line by line, with changed words highlighted, side-by-side or inline view, and export as a patch.',
  'seo.diff.title': 'Online text compare (diff) | rrstudio Tools',
  'seo.diff.desc':
    'Compare two texts or files and see the differences: lines, words and characters changed, side-by-side or inline view, ignore whitespace and case, export .patch.',

  'tool.md.title': 'Markdown editor',
  'tool.md.desc':
    'Write Markdown and see the preview side by side, with a formatting toolbar. Export as .md, as a standalone HTML file or as a PDF through the browser print dialog.',
  'seo.md.title': 'Markdown editor with live preview | rrstudio Tools',
  'seo.md.desc':
    'Markdown editor with a real-time preview: headings, lists, tables, code and links. Safe preview, export .md, HTML or PDF. The draft stays in your browser only.',

  'tool.wc.title': 'Word & character counter',
  'tool.wc.desc':
    'Count words, characters, sentences and paragraphs, estimate reading and speaking time, find the most frequent words and check length limits (SMS, X, meta description). With case conversions.',
  'seo.wc.title': 'Online word and character counter | rrstudio Tools',
  'seo.wc.desc':
    'Count words, characters (with and without spaces), sentences and paragraphs; reading and speaking time, frequent words and limits for SMS, X and meta tags.',

  'tool.rx.title': 'Regex tester',
  'tool.rx.desc':
    'Try a JavaScript regular expression with flags, highlighted matches, groups, replacement and a plain-words explanation of the pattern. Protected against catastrophic backtracking.',
  'seo.rx.title': 'Online regex tester (regular expressions) | rrstudio Tools',
  'seo.rx.desc':
    'Test JavaScript regular expressions: flags, highlighted matches, named groups, replacement preview, token explanation and examples. A timeout stops slow ones.',

  'tool.wd.title': 'Working days calculator (Italy)',
  'tool.wd.desc':
    'Count working days between two dates, or add and subtract working days from a date, with Italian public holidays, a patron saint day and Easter (in Italian).',
  'seo.wd.title': 'Italian working days calculator | rrstudio Tools',
  'seo.wd.desc':
    'Calculate working days between two dates or a deadline by adding working days: weekends, Italian national holidays, Easter and patron saint day. In Italian.',

  'tool.cj.title': 'CSV, JSON & Excel converter',
  'tool.cj.desc':
    'Convert tables between CSV, JSON and Excel in any direction: delimiters, headers, nested objects, sheet choice and a preview.',
  'seo.cj.title': 'CSV, JSON & Excel converter online | rrstudio Tools',
  'seo.cj.desc':
    'Convert CSV, JSON and Excel into each other: automatic delimiter, header row, nested objects, sheet picker, formula-safe export. In your browser, no upload.',

  'tool.jwt.title': 'JWT decoder',
  'tool.jwt.desc':
    'Paste a JSON Web Token and read its header, payload, algorithm and expiry dates, in your time zone and in UTC. The signature is not verified.',
  'seo.jwt.title': 'JWT decoder online (JSON Web Token) | rrstudio Tools',
  'seo.jwt.desc':
    'Decode a JWT and read the header, payload, algorithm and the exp, iat and nbf dates, with the time left until expiry. The signature is not verified.',

  'tool.uuid.title': 'UUID generator',
  'tool.uuid.desc':
    'Generate UUID v4, UUID v7 (sortable by date) and ULID, up to 1000 at a time, and check the version, variant and date of an identifier.',
  'seo.uuid.title': 'UUID v4, v7 and ULID generator | rrstudio Tools',
  'seo.uuid.desc':
    'Generate UUID v4, UUID v7 with timestamp and ULID, from 1 to 1000, in upper or lower case, and validate a UUID to read its version and date. In your browser.',

  'tool.ts.title': 'Unix timestamp converter',
  'tool.ts.desc':
    'Convert Unix timestamps to dates and back: seconds, milliseconds, microseconds and nanoseconds, time zones, ISO 8601, RFC 2822 and relative time.',
  'seo.ts.title': 'Unix timestamp converter online | rrstudio Tools',
  'seo.ts.desc':
    'Convert a Unix timestamp to a readable date and back: seconds, milliseconds, microseconds and nanoseconds, time zones, ISO 8601, RFC 2822 and many lines.',

  'tool.cc.title': 'Color contrast checker',
  'tool.cc.desc':
    'Check the contrast between two colors according to WCAG: AA and AAA results, preview, HEX, RGB, HSL and OKLCH conversions and an alternative color that passes.',
  'seo.cc.title': 'WCAG color contrast checker (AA, AAA) | rrstudio Tools',
  'seo.cc.desc':
    'Calculate the contrast ratio between text and background and check AA and AAA for normal and large text and graphics. Accepts HEX, rgb, hsl and suggests a fix.',

  'seo.privacy.title': 'Privacy notice | rrstudio Tools',
  'seo.privacy.desc':
    'How rrstudio Tools handles data: the tools run in your browser, no cookies or tracking, only technical server logs with automatic rotation.',
};
