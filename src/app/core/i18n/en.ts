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

  'guide.how': 'How to use it',
  'guide.faq': 'Frequently asked questions',
  'guide.privacy': 'Privacy',
  'privacy.headline': 'Your data stays on your computer',
  'privacy.short': 'Files are processed in your browser and are never uploaded.',

  'footer.coffee': 'Buy me a coffee',
  'footer.tools': 'Tools',
  'footer.dashboards': 'Dashboards',
  'footer.apps': 'Apps',
  'footer.github': 'GitHub',
  'footer.license': 'AGPL-3.0 license',
  'footer.source': 'Source code',
  'feedback.title': 'Feedback',
  'feedback.bug': 'Report a problem',
  'feedback.idea': 'Suggest an improvement',
  'feedback.newtool': 'Propose a new tool',
  'feedback.newtab': '(opens in a new tab, on GitHub)',
  'feedback.note': 'A GitHub account is required. Nothing is sent until you submit the form; do not paste personal data.',
  'footer.suggest': 'Suggest a tool',
  'footer.changelog': "What's new",
  'home.new': 'New',
  'changelog.eyebrow': "What's new",
  'changelog.title': "What's new",
  'changelog.lead': 'The tools, features and improvements added to the site, newest first.',
  'changelog.filter.label': 'Filter by type',
  'changelog.filter.all': 'All',
  'changelog.filter.new-tool': 'New tools',
  'changelog.filter.feature': 'Features',
  'changelog.filter.improvement': 'Improvements',
  'changelog.filter.fix': 'Fixes',
  'changelog.kind.new-tool': 'New tool',
  'changelog.kind.feature': 'Feature',
  'changelog.kind.improvement': 'Improvement',
  'changelog.kind.fix': 'Fix',
  'changelog.tools': 'Tools:',
  'changelog.issues': 'Reports:',
  'changelog.feed': 'Atom feed',
  'changelog.empty': 'No updates of this type.',
  'seo.changelog.title': "What's new | rrstudio Tools",
  'seo.changelog.desc': 'New tools, features and improvements in rrstudio Tools, with a feed to follow the updates.',
  'footer.privacy': 'Privacy',
  'footer.noads': 'No ads, no cookies, no tracking.',
  'pwa.footer': 'Use offline',
  'pwa.title': 'Use offline',
  'pwa.close': 'Close',
  'pwa.intro':
    'You can save the site in your browser to use it without a connection. Only the site files (pages, scripts, styles and fonts) are kept: the data you enter in the tools is never saved.',
  'pwa.auto': 'When a new version is released, the saved files update by themselves.',
  'pwa.size': 'Estimated download size: about {size}.',
  'pwa.download': 'Download everything for offline use',
  'pwa.downloading': 'Downloading: {done} of {total} files',
  'pwa.progress': 'Download progress',
  'pwa.cancel': 'Cancel',
  'pwa.cancelled': 'Download cancelled. Files already downloaded stay saved.',
  'pwa.error': 'Some files could not be downloaded. Check your connection and try again.',
  'pwa.ready': 'Ready offline',
  'pwa.readyText': 'The whole site is saved in this browser.',
  'pwa.partial': '{cached} of {total} files are already saved: the pages you visited work offline.',
  'pwa.clear': 'Clear the offline cache',
  'pwa.cleared': 'Offline cache cleared.',
  'pwa.unsupported': 'This browser does not support offline use.',
  'pwa.starting': 'Setting up offline use…',
  'pwa.update': 'New version available',
  'pwa.updateAction': 'Update',
  'pwa.offline': 'You are offline',

  'home.eyebrow': 'FREE TOOLS · OPEN SOURCE',
  'home.h1a': 'Simple tools.',
  'home.h1b': 'In your browser.',
  'home.title': 'Simple, free and open source web tools',
  'home.subtitle':
    'Small tools that run right in your browser. No sign-up, no uploads.',
  'home.tools': 'Tools',
  'home.filters.label': 'Filter by category',
  'home.filter.all': 'All',
  'home.filter.fav': 'Favorites',
  'home.search.label': 'Search tools',
  'home.search.ph': 'Search: hash, pdf, iban…',
  'home.results': '{n} tools',
  'home.results.one': '1 tool',
  'home.empty': 'No tool matches your search.',
  'home.reset': 'Clear filters',
  'cat.text.title': 'Text',
  'cat.text.short': 'Text',
  'cat.text.desc': 'Write, compare, sort and clean up text.',
  'cat.data.title': 'Data',
  'cat.data.short': 'Data',
  'cat.data.desc': 'Tables and structured formats: open, format and convert.',
  'cat.media.title': 'Images, PDF & codes',
  'cat.media.short': 'Images & PDF',
  'cat.media.desc': 'Compress images, merge and split PDFs, create and read QR codes and barcodes.',
  'cat.calc.title': 'Calculators',
  'cat.calc.short': 'Calculators',
  'cat.calc.desc': 'Percentages, units, dates, time zones and number bases.',
  'cat.dev.title': 'Developers',
  'cat.dev.short': 'Developers',
  'cat.dev.desc': 'Encode, decode and compute: small workbench tools.',
  'cat.web.title': 'Web & design',
  'cat.web.short': 'Web & design',
  'cat.web.desc': 'Colors, CSS, SVG and icons for your sites.',
  'cat.security.title': 'Security',
  'cat.security.short': 'Security',
  'cat.security.desc': 'Strong passwords, two-factor codes, encrypted files and photo metadata: your privacy, handled in the browser.',
  'cat.italy.title': 'Italy: tax & banking',
  'cat.italy.short': 'Italy',
  'cat.italy.desc': 'Codice fiscale, IBAN, VAT number, VAT calculator, working days and e-invoices: calculate, verify and read.',
  'home.italy.lead': 'Tools for Italy (in Italian):',
  'home.italy.codice-fiscale': 'codice fiscale',
  'home.italy.iban-partita-iva': 'IBAN & partita IVA',
  'home.italy.fattura-elettronica': 'fattura elettronica',
  'home.italy.calcolo-iva': 'VAT & withholding calculator',
  'home.italy.calcolo-giorni-lavorativi': 'working days calculator',
  'home.italy.calcolo-ritenuta-acconto': 'withholding tax calculator',
  'home.italy.calcolo-rata-mutuo': 'mortgage payment calculator',
  'home.italy.numeri-in-lettere': 'numbers in words',
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
  'send.btn': 'Send to…',
  'send.label': 'Send to… another tool',
  'send.menu': 'Tools to send the result to',
  'send.received': 'Received from {tool}',
  'intake.title': 'Paste or drop here',
  'intake.hint': 'Paste some text with {key}+V (or drop a file on this page): I recognise the content and suggest the right tools.',
  'intake.paste.label': 'Paste some text here',
  'intake.paste.ph': 'JSON, URL, IBAN, curl command, colour, cron…',
  'intake.pick': 'Choose a file',
  'intake.clear': 'Clear',
  'intake.preview': 'Content preview',
  'intake.local': 'The content stays in this tab: it is not sent to any server.',
  'intake.suggest': 'Tools that fit this content',
  'intake.nothing': 'No tool accepts these files together: try one file at a time.',
  'intake.drop.title': 'Drop the file here to pick a tool',
  'intake.found': 'Detected: {type}',
  'intake.found.text': 'Text with no specific format',
  'intake.found.file': 'File: {kind}',
  'intake.found.files': '{n} files: {kind}',
  'intake.err.big': 'The file is too large to be read as text (10 MB at most).',
  'intake.err.read': 'I cannot read the file.',
  'intake.type.json': 'JSON',
  'intake.type.jwt': 'JWT token',
  'intake.type.url': 'URL',
  'intake.type.base64': 'Base64',
  'intake.type.color': 'CSS colour',
  'intake.type.cron': 'Cron expression',
  'intake.type.iban': 'IBAN',
  'intake.type.codice-fiscale': 'Italian tax code',
  'intake.type.partita-iva': 'Italian VAT number',
  'intake.type.svg': 'SVG',
  'intake.type.curl': 'curl command',
  'intake.type.docker-run': 'docker run command',
  'intake.type.csv': 'CSV or TSV',
  'intake.type.yaml': 'YAML',
  'intake.type.xml': 'XML or HTML',
  'intake.type.sql': 'SQL',
  'intake.type.unix-timestamp': 'Unix timestamp',
  'intake.type.uuid': 'UUID',
  'intake.type.hash': 'Hex hash',
  'intake.type.pem': 'PEM certificate or key',
  'intake.type.ip': 'IP address or CIDR',
  'intake.type.roman': 'Roman numeral',
  'intake.type.morse': 'Morse code',
  'intake.type.date': 'Date',
  'intake.type.text': 'Text',
  'intake.file.image': 'image',
  'intake.file.svg': 'SVG',
  'intake.file.pdf': 'PDF',
  'intake.file.csv': 'CSV',
  'intake.file.json': 'JSON',
  'intake.file.yaml': 'YAML',
  'intake.file.xml': 'XML or HTML',
  'intake.file.pem': 'PEM certificate',
  'intake.file.text': 'text',
  'intake.file.other': 'other type',
  'intake.file.mixed': 'mixed types',
  'share.eyebrow': 'Sharing',
  'share.title': 'Content received',
  'share.lead': 'This is where content arrives when you share it with rrstudio Tools from another app or open it with the app. Pick the tool to open it with: the content stays in this tab.',
  'share.waiting': 'Receiving the content…',
  'share.received': 'Content received: pick a tool.',
  'share.empty': 'No content arrived. You can paste it or drop a file below.',
  'share.retry': 'I could not receive the content. Try sharing it again, or paste it or drop a file below.',
  'seo.share.title': 'Content received',
  'seo.share.desc': 'Page that receives content shared with rrstudio Tools or opened with the app: pick the right tool.',
  'common.clear': 'Clear',
  'common.swap': 'Swap',

  'shortcuts.btn': 'Shortcuts',
  'shortcuts.btn.aria': 'Keyboard shortcuts',
  'shortcuts.title': 'Keyboard shortcuts',
  'shortcuts.close': 'Close',
  'shortcuts.tool': 'In this tool',
  'shortcuts.global': 'Everywhere',
  'shortcuts.none': 'This tool has no keyboard actions.',
  'shortcuts.run': 'Run or generate',
  'shortcuts.copy': 'Copy the result',
  'shortcuts.download': 'Download the result',
  'shortcuts.swap': 'Swap input and output',
  'shortcuts.clear': 'Clear the data (press twice to confirm)',
  'shortcuts.send': 'Send to another tool',
  'print.btn': 'Print or save PDF',
  'print.btn.aria': 'Print or save PDF of the results',
  'print.note': 'Indicative calculation, generated in the browser by tools.rr-dev.eu',
  'print.yes': 'Yes',
  'print.no': 'No',
  'shortcuts.print': 'Print or save as PDF',
  'shortcuts.next': 'Next difference or result (also in text fields)',
  'shortcuts.prev': 'Previous difference or result (also in text fields)',
  'shortcuts.toggle-view': 'Switch view (side by side or inline)',
  'shortcuts.toggle-collapse': 'Hide or show unchanged lines',
  'shortcuts.toggle-ws': 'Ignore whitespace, on or off',
  'shortcuts.toggle-inputs': 'Hide or show the texts',
  'shortcuts.help': 'Open this panel (outside text fields)',
  'shortcuts.esc': 'Closes panels and menus, never clears data',
  'shortcuts.search': 'Search for a tool (on the home page)',
  'shortcuts.or': 'or',
  'shortcuts.done.run': 'Done',
  'shortcuts.done.download': 'Downloaded',
  'shortcuts.done.swap': 'Swapped',
  'shortcuts.done.clear': 'Data cleared',
  'shortcuts.done.send': 'Pick the destination tool',
  'shortcuts.done.print': 'Opening print',
  'shortcuts.done.toggle-view': 'View switched',
  'shortcuts.done.toggle-collapse': 'Unchanged lines option switched',
  'shortcuts.done.toggle-ws': 'Whitespace option switched',
  'shortcuts.done.toggle-inputs': 'Texts visibility switched',
  'shortcuts.unavailable': 'Nothing to do right now',
  'shortcuts.confirmClear': 'Press {keys} again to clear the data',
  'shortcuts.key.enter': 'Enter',
  'shortcuts.key.shift': 'Shift',
  'common.chooseFile': 'Choose a file',
  'share.copy': 'Copy link',
  'share.note': 'The content is in the link: whoever gets it can see it. It is not sent to our server.',
  'share.copied': 'Link copied',
  'share.invalid': 'The link is not valid or was cut short: the tool was left as it is.',
  'share.toolarge': 'The content is too large to fit in a link.',
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

  'tool.p2t.title': 'PDF to text',
  'tool.p2t.desc':
    'Extract the text from one or more PDFs, password-protected ones too: lines and paragraphs rebuilt, columns, line-end hyphens joined, repeated headers and footers removed. Copy or download as .txt and .md.',
  'seo.p2t.title': 'Extract text from a PDF online: PDF to text (TXT), without uploading | rrstudio Tools',
  'seo.p2t.desc':
    'Copy the text of a PDF or turn it into TXT or Markdown: rebuilds lines, paragraphs and columns, joins split words, removes headers and footers. Warns when the PDF is a scan (OCR needed). In your browser, no upload.',

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
  'tool.jd.title': 'JSON diff (structural compare)',
  'tool.jd.desc':
    'Compare two JSON (or YAML) documents by structure: differences with path, old and new value, arrays by index, as sets or by key, merged tree view and JSON Patch export.',
  'seo.jd.title': 'Online JSON diff (structural compare) | rrstudio Tools',
  'seo.jd.desc':
    'Compare two JSON documents and see the differences: additions, removals and changes with the exact path, key order ignored, arrays matched by id key, export as JSON Patch. In your browser, no upload.',

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

  'tool.sign.title': 'Sign a PDF online',
  'tool.sign.desc':
    'Sign a PDF in your browser: draw, type or upload your signature, place it on the pages with a date and download the signed PDF. A graphic signature, nothing uploaded.',
  'seo.sign.title': 'Sign a PDF online for free, without uploading it | rrstudio Tools',
  'seo.sign.desc':
    'Sign a PDF online: draw your signature with a mouse or finger, type it or upload it from an image, place it on several pages with the date. The file stays in your browser. Graphic signature, not digital.',
  'tool.crop.title': 'Crop and rotate images',
  'tool.crop.desc':
    'Crop a photo with fixed aspect ratios (including 35×45 ID photo), rotate, flip, resize and export as PNG, JPEG or WebP, without uploading anything.',
  'seo.crop.title': 'Crop, rotate and resize images online | rrstudio Tools',
  'seo.crop.desc':
    'Crop photos online with 1:1, 4:3, 16:9 or 35×45 ID photo ratios, rotate by 90° or any angle, flip, resize and export as PNG, JPEG or WebP. In your browser, metadata stripped.',
  'tool.meta.title': 'Meta tag and Open Graph preview',
  'tool.meta.desc':
    'Paste a page\'s HTML and preview it on Google, Facebook, LinkedIn, X and WhatsApp, with checks on title, description, Open Graph and Twitter Card.',
  'seo.meta.title': 'Meta tag, Open Graph and Twitter Card preview online | rrstudio Tools',
  'seo.meta.desc':
    'Check a page\'s title, description, canonical, Open Graph and Twitter Card: Google, Facebook, LinkedIn, X and WhatsApp previews, length warnings and an HTML snippet. No network requests.',

  'tool.fake.title': 'Fake data generator',
  'tool.fake.desc':
    'Fake but realistic test data: names, emails, addresses, formally valid Italian tax codes, VAT numbers and IBANs. 1 to 10,000 rows, with a repeatable seed, as CSV, JSON or SQL.',
  'seo.fake.title': 'Online fake data generator: CSV, JSON and SQL | rrstudio Tools',
  'seo.fake.desc':
    'Generate fake Italian test data: first and last name, email on test domains, phone, address, and format-valid tax code, VAT number and IBAN. With a seed, up to 10,000 rows. All in your browser.',

  'tool.jq.title': 'JSONPath, JSON to TypeScript and JSON Schema',
  'tool.jq.desc':
    'Query a JSON with JSONPath expressions (filters, slices, recursive search) and derive TypeScript interfaces and a JSON Schema from it.',
  'seo.jq.title': 'Online JSONPath, JSON to TypeScript and JSON Schema | rrstudio Tools',
  'seo.jq.desc':
    'Try JSONPath expressions on a JSON with filters, slices and result paths, and generate TypeScript interfaces or a JSON Schema (draft 2020-12). All in your browser.',

  'tool.wm.title': 'Watermark images and PDFs',
  'tool.wm.desc':
    'Add a text or logo watermark to several images and PDFs at once: position, tiling, rotation and opacity, with a live preview and nothing uploaded.',
  'seo.wm.title': 'Watermark images and PDFs online, without uploading files | rrstudio Tools',
  'seo.wm.desc':
    'Put a text or logo watermark on photos and PDFs: nine positions or tiled, rotation, opacity, colour, all pages or just some. Several files at once as a ZIP, right in your browser.',
  'tool.cpk.title': 'Image color picker and palette',
  'tool.cpk.desc':
    'Read a pixel\'s colour with a click, a tap or the keyboard (HEX, RGB, HSL, OKLCH) with a magnifier, and extract the dominant colour palette from an image.',
  'seo.cpk.title': 'Image colour picker and palette extractor online | rrstudio Tools',
  'seo.cpk.desc':
    'Load a photo and pick the colour of any pixel as HEX, RGB, HSL and OKLCH, with a magnifier and history. Compute the dominant colour palette with percentages and export it as CSS or JSON. In your browser.',
  'tool.s2p.title': 'SVG to PNG',
  'tool.s2p.desc':
    'Convert an SVG to PNG, JPG or WebP: 1x to 8x scale or an exact size, transparent or coloured background, even when the SVG has no width and height. In your browser.',
  'seo.s2p.title': 'Convert SVG to PNG, JPG or WebP online, without uploading the file | rrstudio Tools',
  'seo.s2p.desc':
    'Turn an SVG into a PNG, JPG or WebP image at the resolution you want (1x-8x or width and height), with a transparent or coloured background. Handles viewBox and warns about external resources. All in your browser.',
  'tool.icv.title': 'Image format converter',
  'tool.icv.desc':
    'Convert images to PNG, JPG, WebP or AVIF in your browser, with quality and resizing of your choice. Several files at once, single or ZIP download.',
  'seo.icv.title': 'Online image converter: PNG, JPG, WebP, AVIF | rrstudio Tools',
  'seo.icv.desc':
    'Convert several images to PNG, JPG, WebP or AVIF, adjust quality, resize keeping the aspect ratio and download everything as a ZIP. In your browser, nothing uploaded, no EXIF.',
  'tool.colc.title': 'Color converter',
  'tool.colc.desc':
    'Convert a color between HEX, RGB, HSL, HWB, OKLCH, OKLAB and CMYK, generate the 50-950 shade scale and harmonies, and export CSS variables and JSON.',
  'seo.colc.title': 'Online color converter: HEX, RGB, HSL, OKLCH and palettes | rrstudio Tools',
  'seo.colc.desc':
    'Convert colors between HEX, RGB, HSL, HWB, OKLCH, OKLAB and CMYK, with the sRGB gamut flagged. 50-950 shade scale, complementary, analogous and triadic colors, exportable as CSS variables or JSON.',

  'tool.yj.title': 'YAML, JSON and TOML converter',
  'tool.yj.desc':
    'Convert between YAML, JSON and TOML in every direction, with multiple YAML documents, a choice of indentation and errors with line and column.',
  'seo.yj.title': 'YAML JSON TOML converter online | rrstudio Tools',
  'seo.yj.desc':
    'Convert YAML to JSON, JSON to YAML and TOML in every direction: multiple documents, indentation, errors with line and column. In your browser, nothing is sent.',

  'tool.xml.title': 'XML formatter and minifier',
  'tool.xml.desc':
    'Format or minify XML with the indentation you want, check it is well-formed and, if needed, convert it to JSON. Comments and CDATA are kept.',
  'seo.xml.title': 'Format, minify and validate XML online | rrstudio Tools',
  'seo.xml.desc':
    'Format and minify XML, check well-formedness with errors by line and column, keep comments and CDATA and convert to JSON. Everything runs in your browser.',

  'tool.sql.title': 'SQL formatter',
  'tool.sql.desc':
    'Format or minify an SQL query, choosing the dialect (PostgreSQL, MySQL, SQLite, SQL Server, BigQuery…), keyword case and indentation.',
  'seo.sql.title': 'SQL formatter online (PostgreSQL, MySQL, SQLite) | rrstudio Tools',
  'seo.sql.desc':
    'Format and minify SQL queries for PostgreSQL, MySQL, MariaDB, SQLite, SQL Server, BigQuery and other dialects, with keyword case and indentation of your choice. In your browser.',

  'tool.ent.title': 'HTML entities and escaping',
  'tool.ent.desc':
    'Encode and decode HTML entities (named, decimal, hexadecimal) and escape text for JavaScript strings, JSON and URL components.',
  'seo.ent.title': 'HTML entities encoder and decoder online | rrstudio Tools',
  'seo.ent.desc':
    'Encode and decode HTML entities, escape and unescape JavaScript, JSON and URL strings. Decoding never interprets markup. Everything runs in your browser.',

  'tool.case.title': 'Text case converter',
  'tool.case.desc':
    'Convert text to camelCase, snake_case, kebab-case, Title Case (English and Italian), uppercase, lowercase and more, line by line if you like.',
  'seo.case.title': 'camelCase, snake_case, Title Case and uppercase converter | rrstudio Tools',
  'seo.case.desc':
    'Convert text to camelCase, PascalCase, snake_case, kebab-case, Title Case with English and Italian rules, uppercase and lowercase, line by line. In your browser.',

  'tool.slug.title': 'Slug generator',
  'tool.slug.desc':
    'Turn titles into URL slugs: transliterated accents, a separator of your choice, a maximum length that never splits words, and stop words.',
  'seo.slug.title': 'URL slug generator online | rrstudio Tools',
  'seo.slug.desc':
    'Generate URL slugs from titles and sentences: transliterated accents, separator and length of your choice, Italian and English stop words, in bulk too. In your browser.',

  'tool.lorem.title': 'Lorem ipsum generator',
  'tool.lorem.desc':
    'Generate Lorem ipsum placeholder text as paragraphs, sentences or words, as text or HTML, with an optional seed for repeatable results.',
  'seo.lorem.title': 'Lorem ipsum generator online | rrstudio Tools',
  'seo.lorem.desc':
    'Generate Lorem ipsum as paragraphs, sentences or words, as text or HTML with p tags, with an optional seed to always get the same text. Everything runs in your browser.',

  'tool.cron.title': 'Cron expressions',
  'tool.cron.desc':
    'Explain a cron expression in plain words (Italian and English), validate it and compute the next runs in your time zone or in UTC.',
  'seo.cron.title': 'Cron expression explainer and next runs online | rrstudio Tools',
  'seo.cron.desc':
    'Read a cron expression in English or Italian, validate the syntax with clear errors and see the next runs in local time or UTC, with seconds and aliases.',

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

  'tool.rit.title': 'Withholding tax calculator (Italy)',
  'tool.rit.desc':
    'Gross to net and net to gross for Italian occasional services and freelancer fees: withholding tax, INPS surcharge, pension fund, VAT and stamp duty, with a copyable statement.',
  'seo.rit.title': 'Italian withholding tax calculator, gross and net | rrstudio Tools',
  'seo.rit.desc':
    'Calculate the 20% Italian withholding tax (ritenuta d\'acconto) on an occasional service or a fee: gross to net and back, with INPS surcharge, pension fund, VAT and 2 euro stamp duty.',

  'tool.mutuo.title': 'Mortgage payment calculator (Italy)',
  'tool.mutuo.desc':
    'Payment, total interest and a French amortization schedule from principal, nominal rate (TAN) and term. Monthly, quarterly or half-yearly payments, with CSV export.',
  'seo.mutuo.title': 'Mortgage payment and amortization schedule | rrstudio Tools',
  'seo.mutuo.desc':
    'Calculate the payment of a mortgage with French amortization from principal, nominal rate and term, the total interest and the full schedule, downloadable as CSV.',

  'tool.nl.title': 'Numbers in words (Italian)',
  'tool.nl.desc':
    'Write a number out in correct Italian, with decimals and negatives, up to billions. Cheque mode with the cents as digits.',
  'seo.nl.title': 'Numbers in Italian words, cheque amounts | rrstudio Tools',
  'seo.nl.desc':
    'Convert a number to correct Italian words (ventuno, centottanta, ventitré, milleuno), with decimals, negatives and cheque amounts such as "cento/50".',

  'tool.pct.title': 'Percentage calculator',
  'tool.pct.desc':
    'X% of Y, what percentage it is, percentage change between two values, discount or markup and reverse percentage: five calculations on one page.',
  'seo.pct.title': 'Online percentage calculator | rrstudio Tools',
  'seo.pct.desc':
    'Calculate the percentage of a number, the percentage change between two values, a discount or markup and the value before a discount. Instant results, in your browser.',

  'tool.uc.title': 'Unit converter',
  'tool.uc.desc':
    'Length, mass, temperature, area, volume, speed, time, digital data, pressure and energy, with unit search and a table of all conversions.',
  'seo.uc.title': 'Online unit converter | rrstudio Tools',
  'seo.uc.desc':
    'Convert lengths, weights, temperatures, areas, volumes, speeds, times, bytes (KB and KiB), pressures and energies. Search for a unit and see every conversion together.',

  'tool.dc.title': 'Date and age calculator',
  'tool.dc.desc':
    'Difference between two dates in years, months and days, add or subtract days, weeks, months and years, work out an exact age and the days to the next birthday.',
  'seo.dc.title': 'Date difference, age and days calculator | rrstudio Tools',
  'seo.dc.desc':
    'Calculate the difference between two dates, add or subtract days, months and years, and find an exact age and the days left to a birthday. Handles month ends and leap years.',

  'tool.tz.title': 'Time zone converter',
  'tool.tz.desc':
    'Convert a time between IANA time zones worldwide and compare several at once, with daylight saving and search by city. Uses only your browser.',
  'seo.tz.title': 'Time zone and daylight saving converter | rrstudio Tools',
  'seo.tz.desc':
    'Convert a time between time zones (Rome, New York, Tokyo and all the others) and compare several cities at once, with daylight saving handled. Nothing is sent anywhere.',

  'tool.nb.title': 'Number base converter',
  'tool.nb.desc':
    'Binary, octal, decimal, hexadecimal and bases 2 to 36 with BigInt, two\'s complement, bit view and IEEE-754 float32 and float64 encoding.',
  'seo.nb.title': 'Binary, hex and IEEE-754 converter | rrstudio Tools',
  'seo.nb.desc':
    'Convert numbers between binary, octal, decimal, hexadecimal and bases 2-36, see the two\'s complement at 8, 16, 32 and 64 bits and decode or encode float32 and float64.',

  'tool.pws.title': 'Password strength checker',
  'tool.pws.desc':
    'See how strong a password is: score, time to guess it, entropy and suggestions. No online check.',
  'seo.pws.title': 'Online password strength checker | rrstudio Tools',
  'seo.pws.desc':
    'Rate a password with zxcvbn: a 0 to 4 score, time to crack in several scenarios, entropy and advice. Everything in the browser, with no online lookups.',

  'tool.totp.title': 'TOTP generator (2FA)',
  'tool.totp.desc':
    'Generate the time-based two-factor codes from a Base32 secret or an otpauth URI, verify them and create the QR.',
  'seo.totp.title': 'Online TOTP 2FA code generator | rrstudio Tools',
  'seo.totp.desc':
    'Generate and verify TOTP codes (RFC 6238) with SHA-1, SHA-256 or SHA-512, a countdown and an otpauth QR. Everything in the browser.',

  'tool.hmac.title': 'HMAC generator',
  'tool.hmac.desc':
    'Compute the HMAC of a text or file with a key (SHA-1, SHA-256, SHA-384, SHA-512) and verify an expected signature in constant time.',
  'seo.hmac.title': 'Online HMAC generator (SHA-256, SHA-512) | rrstudio Tools',
  'seo.hmac.desc':
    'Compute and verify HMACs with SHA-1, SHA-256, SHA-384 or SHA-512 from text or a file, with a text, hex or Base64 key. All in the browser, nothing is sent.',

  'tool.ssh.title': 'SSH key generator',
  'tool.ssh.desc':
    'Generate Ed25519 or RSA SSH key pairs in the browser: public key for authorized_keys, private key in OpenSSH or PKCS#8 format and SHA256 fingerprint.',
  'seo.ssh.title': 'Online SSH key generator (Ed25519, RSA) | rrstudio Tools',
  'seo.ssh.desc':
    'Create Ed25519 or RSA 2048, 3072, 4096 SSH keys with WebCrypto: OpenSSH format, PKCS#8 and ssh-keygen style fingerprint. Keys never leave the browser.',

  'tool.csr.title': 'CSR generator',
  'tool.csr.desc':
    'Create a certificate signing request (CSR) with subject and SANs, with a new RSA or ECDSA key or an existing one, and check it.',
  'seo.csr.title': 'Online CSR generator (certificate signing request) | rrstudio Tools',
  'seo.csr.desc':
    'Generate a PKCS#10 CSR with common name, organization and SANs (DNS and IP), RSA or ECDSA key and PEM private key. All in the browser, with a check of the request.',

  'tool.sss.title': 'Shamir secret sharing',
  'tool.sss.desc':
    'Split a secret into N shares with threshold K (Shamir over GF(256)) and rebuild it by pasting K shares. Hex or Base64 shares, to download or print.',
  'seo.sss.title': 'Split a secret with Shamir online | rrstudio Tools',
  'seo.sss.desc':
    'Shamir secret sharing: split a password or recovery phrase into N shares, any K rebuild it. All in the browser.',

  'tool.fenc.title': 'Encrypt and decrypt files',
  'tool.fenc.desc':
    'Encrypt files and text with a passphrase (AES-256-GCM, PBKDF2) and decrypt them when needed. Everything in the browser.',
  'seo.fenc.title': 'Encrypt and decrypt files with a password online | rrstudio Tools',
  'seo.fenc.desc':
    'Protect files and text with AES-256-GCM and a passphrase (PBKDF2-SHA256, 600,000 iterations). Documented format, everything in the browser, no upload.',

  'tool.bc.title': 'Barcode generator',
  'tool.bc.desc':
    'EAN-13, EAN-8, UPC-A, Code 128, Code 39, ITF-14 and more, with check digit; download SVG or PNG, or create many codes in a ZIP.',
  'seo.bc.title': 'EAN, UPC and Code 128 barcode generator | rrstudio Tools',
  'seo.bc.desc':
    'Create EAN-13, EAN-8, UPC-A, Code 128, Code 39 and ITF-14 barcodes with the check digit computed, download SVG or PNG and generate a ZIP in bulk.',

  'tool.qrr.title': 'QR code reader',
  'tool.qrr.desc':
    'Read a QR from an image or with the camera and see what it contains (link, Wi-Fi, contact…) without opening anything.',
  'seo.qrr.title': 'Online QR code reader from image and camera | rrstudio Tools',
  'seo.qrr.desc':
    'Read a QR code from an image or the camera: it recognises addresses, Wi-Fi, vCards and text and shows them safely, with warnings about suspicious links.',

  'tool.sl.title': 'Sort lines',
  'tool.sl.desc':
    'Sort a list alphabetically, naturally or by length; remove duplicates and blank lines, count occurrences and number lines.',
  'seo.sl.title': 'Sort text lines and remove duplicates online | rrstudio Tools',
  'seo.sl.desc':
    'Sort lines alphabetically (Italian and English), naturally, by length or randomly; remove duplicates and blank lines, count occurrences, add a prefix and numbering.',

  'tool.fr.title': 'Find and replace',
  'tool.fr.desc':
    'Search and replace in text with plain text or regex, several rules in sequence and a preview of the matches.',
  'seo.fr.title': 'Online find and replace with regex | rrstudio Tools',
  'seo.fr.desc':
    'Find and replace in a text in plain mode or with regex (flags g, i, m, s, u and groups), with several rules in sequence, a highlighted preview and protection from slow regexes.',

  'tool.tts.title': 'Text to speech',
  'tool.tts.desc':
    'Have a text read aloud with the voices installed on your device: choose voice, speed and pitch. Local voices only.',
  'seo.tts.title': 'Online text to speech: read a text aloud | rrstudio Tools',
  'seo.tts.desc':
    'Read a text aloud with the browser speech synthesis: voice, language, speed, pitch, volume, pause and a highlighted sentence. It uses local voices only: no text goes to external servers.',

  'tool.chmod.title': 'chmod calculator',
  'tool.chmod.desc':
    'Tick Unix permissions and get octal, symbolic form and the chmod command; apply expressions like u+x,go-w and pick from the most common permissions.',
  'seo.chmod.title': 'chmod calculator online: octal and symbolic | rrstudio Tools',
  'seo.chmod.desc':
    'Work out chmod permissions with r/w/x checkboxes for owner, group and others, plus setuid, setgid and sticky. Convert octal and symbolic and copy the command.',

  'tool.cssu.title': 'CSS unit converter',
  'tool.cssu.desc':
    'Convert px, rem, em, pt, %, vw, vh, cm, mm and inches with your own root font size and viewport; paste CSS to turn every px into rem.',
  'seo.cssu.title': 'px to rem and em converter for CSS | rrstudio Tools',
  'seo.cssu.desc':
    'Convert px to rem, em, pt, vw and other CSS units, with a quick px-to-rem table and bulk conversion of a whole stylesheet. Everything in your browser.',

  'tool.cssg.title': 'CSS generator: gradients and shadows',
  'tool.cssg.desc':
    'Build linear, radial and conic gradients or multi-layer box-shadows, with a live preview and ready-to-copy CSS code.',
  'seo.cssg.title': 'CSS gradient and box-shadow generator online | rrstudio Tools',
  'seo.cssg.desc':
    'Create linear-gradient, radial-gradient, conic-gradient and box-shadow with live preview, draggable stops, opacity and multiple shadows. Copy the CSS.',

  'tool.svgo.title': 'SVG optimizer',
  'tool.svgo.desc':
    'Shrink SVG files with SVGO: choose precision, metadata and comments, compare before and after, side-by-side preview and a ZIP for many files.',
  'seo.svgo.title': 'Online SVG optimizer with SVGO | rrstudio Tools',
  'seo.svgo.desc':
    'Compress and optimize SVG files in your browser with SVGO: several files at once, size comparison, safe preview and ZIP download. Nothing is uploaded.',

  'tool.fav.title': 'Favicon generator',
  'tool.fav.desc':
    'From an image or from a letter or emoji, get favicon.ico, PNGs at 16, 32, 180, 192 and 512, site.webmanifest and the HTML lines, in a single ZIP.',
  'seo.fav.title': 'Online favicon generator: ICO, PNG and manifest | rrstudio Tools',
  'seo.fav.desc':
    'Create favicon.ico, apple-touch-icon, Android icons and site.webmanifest from a PNG, JPG or SVG image, or from text and emoji. All in your browser, download a ZIP.',

  'tool.ht.title': '.htpasswd generator',
  'tool.ht.desc':
    'Generate .htpasswd lines with bcrypt, APR1-MD5 or SHA1 for several users, and check whether an existing line matches a password.',
  'seo.ht.title': 'Online .htpasswd generator: bcrypt, APR1, SHA1 | rrstudio Tools',
  'seo.ht.desc':
    'Create the .htpasswd file for Apache and Nginx with bcrypt ($2y$), APR1-MD5 or SHA1 and check an existing line. The calculation runs in your browser, passwords stay here.',

  'tool.cert.title': 'Certificate decoder',
  'tool.cert.desc':
    'Read X.509 certificates and CSRs in PEM or DER: subject, issuer, expiry, SANs, key usages, SHA-1 and SHA-256 fingerprints, chains included.',
  'seo.cert.title': 'Online SSL/TLS certificate and CSR decoder | rrstudio Tools',
  'seo.cert.desc':
    'Paste a PEM certificate or a CSR and read subject, issuer, days to expiry, SANs, algorithm, key size and fingerprints. All in your browser.',

  'seo.privacy.title': 'Privacy notice | rrstudio Tools',
  'seo.privacy.desc':
    'How rrstudio Tools handles data: the tools run in your browser, no cookies or tracking, only technical server logs with automatic rotation.',
  // preferiti e menu personalizzati
  'fav.menu': 'Favorites',
  'fav.menu.label': 'Favorites menu',
  'fav.add': 'Add to favorites',
  'fav.menu.empty': 'You have no favorites yet. Tap the star next to a tool to add it.',
  'fav.menu.favs': 'Your favorites',
  'fav.menu.manage': 'Manage favorites and menus',
  'fav.home.title': 'Your favorites',
  'fav.home.manage': 'Manage',
  'fav.home.desc': 'Saved on this device only.',
  'fav.home.group': 'Your custom menu.',
  'fav.page.title': 'Favorites and custom menus',
  'fav.page.lead': 'Save the tools you use most and group them into your own menus. The data stays in this browser and is never sent to anyone.',
  'fav.nostorage': 'This browser does not allow saving data: changes last only while the page stays open.',
  'fav.hidden': 'Some Italian-only tools ({n}) are hidden in this version, but they stay saved.',
  'fav.loading': 'Loading…',
  'fav.list.title': 'Favorites',
  'fav.list.empty': 'No favorites. Use the star on a tool or add one below.',
  'fav.groups.title': 'Custom menus',
  'fav.groups.empty': 'No custom menus. Create one to group your tools.',
  'fav.group.new.label': 'Name of the new menu',
  'fav.group.new.ph': 'E.g. Work, Development…',
  'fav.group.create': 'Create menu',
  'fav.group.limit': 'You have reached the maximum of {max} menus.',
  'fav.group.rename': 'Rename',
  'fav.group.rename.label': 'New name for the menu «{name}»',
  'fav.group.save': 'Save',
  'fav.cancel': 'Cancel',
  'fav.group.delete': 'Delete menu',
  'fav.confirm.delete': 'Delete the menu «{name}»?',
  'fav.delete': 'Delete',
  'fav.group.up': 'Move the menu «{name}» up',
  'fav.group.down': 'Move the menu «{name}» down',
  'fav.item.up': 'Move «{name}» up',
  'fav.item.down': 'Move «{name}» down',
  'fav.item.remove': 'Remove «{name}»',
  'fav.drag': 'Drag to reorder',
  'fav.empty.group': 'No tools in this menu.',
  'fav.add.tools': 'Add tools',
  'fav.add.close': 'Close search',
  'fav.add.search': 'Search for a tool to add',
  'fav.add.ph': 'Search…',
  'fav.add.btn': 'Add',
  'fav.add.aria': 'Add «{name}»',
  'fav.add.none': 'No tools found.',
  'fav.add.more': 'Showing the first {n} results: refine your search.',
  'fav.added': '«{name}» added.',
  'fav.removed': '«{name}» removed.',
  'fav.moved': '«{name}»: position {pos} of {total}.',
  'fav.data.title': 'Export, import and share',
  'fav.export': 'Export JSON',
  'fav.import': 'Import JSON',
  'fav.share': 'Create share link',
  'fav.share.label': 'Share link',
  'fav.share.note': 'The data is inside the link, after the # symbol: it stays in the browser and is never sent to the server. Whoever opens the link must confirm before anything is imported.',
  'fav.share.empty': 'There is nothing to share.',
  'fav.import.title': 'Import this data?',
  'fav.import.from.link': 'You opened a share link.',
  'fav.import.from.file': 'From the file «{name}».',
  'fav.import.favs': 'Favorites ({n})',
  'fav.import.groups': 'Menus ({n})',
  'fav.import.none': 'none',
  'fav.import.dropped': '{n} invalid or unknown items were ignored.',
  'fav.import.trimmed': 'Some data was trimmed to respect the limits.',
  'fav.import.mode': 'How to import',
  'fav.import.merge': 'Merge with the existing ones',
  'fav.import.replace': 'Replace the existing ones',
  'fav.import.go': 'Import',
  'fav.imported': 'Import completed.',
  'fav.err.empty': 'The file or link is empty.',
  'fav.err.tooBig': 'The data is too large to import.',
  'fav.err.encoding': 'The link is not valid: the data is incomplete or damaged.',
  'fav.err.json': 'The content is not valid JSON.',
  'fav.err.shape': 'Unrecognised format: it does not look like an rrstudio Tools export.',
  'fav.err.nothing': 'There are no valid favorites or menus to import.',
  'fav.err.read': 'The file could not be read.',
  'fav.clear': 'Delete favorites and menus',
  'fav.clear.confirm': 'Delete all favorites and custom menus from this browser? This cannot be undone.',
  'fav.clear.yes': 'Yes, delete everything',
  'fav.cleared': 'Favorites and menus deleted.',
  'seo.favorites.title': 'Favorites and custom menus | rrstudio Tools',
  'seo.favorites.desc': 'Your favorite tools and custom menus, saved in this browser only.',

  'tool.curl.title': 'cURL converter',
  'tool.curl.desc': 'Turn a curl command, including one copied from Chrome or Firefox, into JavaScript, Python, PHP or Go code, with warnings about what does not translate.',
  'seo.curl.title': 'cURL converter to fetch, axios, Python, PHP and Go online | rrstudio Tools',
  'seo.curl.desc': 'Paste a curl command (including Chrome and Firefox "Copy as cURL") and get code for fetch, axios, Node.js, Python requests, PHP and Go. Headers, JSON, forms, authentication. All in the browser, nothing is run.',
  'tool.urlp.title': 'URL parser',
  'tool.urlp.desc': 'Split a URL into protocol, host, domain, port, path, parameters and fragment; edit the parameters and strip tracking ones.',
  'seo.urlp.title': 'URL parser online: parameters, domain and tracking | rrstudio Tools',
  'seo.urlp.desc': 'Parse a URL: protocol, user, host, subdomain, port, path, query and fragment, with percent-encoding and punycode decoded. Editable parameter table and removal of utm_*, fbclid and gclid.',
  'tool.ci.title': 'Compound interest calculator',
  'tool.ci.desc': 'Work out the balance of a sum with compound interest and regular deposits: interest, real value after inflation, a year-by-year table and a chart.',
  'seo.ci.title': 'Compound interest calculator with regular deposits online | rrstudio Tools',
  'seo.ci.desc': 'Calculate compound interest: initial amount, monthly or yearly deposits, rate, compounding and term. Final balance, total paid in, interest, real value after inflation, table and chart.',
  'tool.stat.title': 'Statistics calculator',
  'tool.stat.desc': 'Paste numbers or a CSV column: mean, median, mode, variance, standard deviation, quartiles, percentiles, outliers and a histogram.',
  'seo.stat.title': 'Statistics calculator online: mean, median, standard deviation | rrstudio Tools',
  'seo.stat.desc': 'Work out mean, median, mode, variance and standard deviation (sample and population), quartiles, IQR, percentiles, outliers and a histogram from pasted numbers or a CSV column.',

  'tool.ar.title': 'Aspect ratio calculator',
  'tool.ar.desc': 'Find the ratio from width and height, work out the missing side, resize proportionally and copy the CSS aspect-ratio.',
  'seo.ar.title': 'Aspect ratio calculator online: 16:9, 4:3, resize | rrstudio Tools',
  'seo.ar.desc': 'Calculate the aspect ratio (16:9, 4:3, 21:9, A4…) from width and height, find the missing side, resize proportionally with rounding to even numbers or multiples of 8 and copy the CSS aspect-ratio.',

  'tool.rom.title': 'Roman numerals converter',
  'tool.rom.desc': 'Convert numbers to Roman numerals and back, from 1 to 3,999 (or up to 3,999,999 with the overline), with a check of the canonical form.',
  'seo.rom.title': 'Roman numerals converter: numbers to Roman and back | rrstudio Tools',
  'seo.rom.desc': 'Convert a number to Roman numerals and back. It checks the canonical form and explains mistakes (IIII, VX, IC), with quick years and the vinculum up to 3,999,999.',

  'tool.uni.title': 'Unicode inspector',
  'tool.uni.desc': 'See every character with code point, category, UTF-8 and UTF-16 bytes, HTML entity and escapes; find invisibles, homoglyphs and mixed scripts.',
  'seo.uni.title': 'Unicode inspector: invisible characters, homoglyphs, code points, UTF-8 | rrstudio Tools',
  'seo.uni.desc': 'Analyse a text character by character: U+XXXX code point, category, UTF-8/UTF-16, HTML entity, JavaScript and CSS escapes. Removes invisible characters, flags homoglyphs and normalises to NFC or NFKC.',

  'tool.morse.title': 'Morse code translator',
  'tool.morse.desc': 'Translate text to Morse code and back, hear it with Web Audio or watch it flash, with adjustable speed and pitch.',
  'seo.morse.title': 'Morse code translator: text, audio and flash | rrstudio Tools',
  'seo.morse.desc': 'Translate text to Morse code and Morse code to text, with numbers, punctuation and accented letters. Play the audio (adjustable words per minute and pitch) and choose symbols and separators.',

  'tool.cph.title': 'Classic ciphers',
  'tool.cph.desc': 'ROT13, ROT47, Caesar, Atbash and Vigenère to encrypt and decrypt, with Caesar brute force. For fun and study, not secure.',
  'seo.cph.title': 'Classic ciphers online: ROT13, Caesar, Atbash, Vigenère | rrstudio Tools',
  'seo.cph.desc': 'Encrypt and decrypt with ROT13, ROT47, the Caesar cipher (with all 25 shifts by brute force), Atbash and Vigenère. Historical ciphers that are not secure, for fun and learning.',

  'tool.lire.title': 'Convertitore lire euro',
  'tool.lire.desc': 'Converti lire in euro e euro in lire con il cambio fisso 1 € = 1936,27 lire, con arrotondamento e tabella dei tagli storici.',
  'seo.lire.title': 'Convertitore lire euro: cambio 1936,27, banconote e monete | rrstudio Tools',
  'seo.lire.desc': 'Converti lire in euro e euro in lire con il cambio irrevocabile 1 euro = 1936,27 lire (Reg. CE 2866/98), arrotondando al centesimo o alla lira, con la tabella dei tagli storici di banconote e monete.',

  'tool.subnet.title': 'IP subnet calculator (CIDR)',
  'tool.subnet.desc': 'Work out network, broadcast, hosts, mask and wildcard for IPv4 and IPv6, split into subnets with VLSM and check whether an address belongs to a network.',
  'seo.subnet.title': 'IP subnet calculator (CIDR): IPv4, IPv6, VLSM | rrstudio Tools',
  'seo.subnet.desc': 'IPv4 and IPv6 subnet calculator with CIDR notation: network, broadcast, first and last host, mask, wildcard, binary, subnet splitting (VLSM) and membership check. Runs entirely in your browser.',

  'tool.docker.title': 'docker run to docker-compose',
  'tool.docker.desc': 'Paste one or more docker run commands and get a docker-compose.yml with services, volumes and networks, with warnings for options that cannot be translated.',
  'seo.docker.title': 'docker run to docker-compose converter online | rrstudio Tools',
  'seo.docker.desc': 'Convert docker run commands into a docker-compose.yml file: ports, volumes, variables, networks, healthchecks, limits and other options. Several commands become several services. In your browser, nothing is run.',

  'tool.clamp.title': 'CSS clamp() fluid typography generator',
  'tool.clamp.desc': 'Generate the CSS clamp() for text that scales fluidly between two viewports, with a preview, a type scale as CSS variables and a WCAG 1.4.4 check.',
  'seo.clamp.title': 'CSS clamp() fluid typography generator | rrstudio Tools',
  'seo.clamp.desc': 'Compute the CSS clamp() for fluid typography in rem: minimum and maximum size between two viewports, a type scale from -2 to +5 as CSS variables, a slider preview and a WCAG 1.4.4 accessibility warning.',

  'tool.time.title': 'Time calculator (hours and minutes)',
  'tool.time.desc': 'Add and subtract durations (1:30, 1h 30m, 90m), fill in a timesheet with breaks and overtime, convert decimal hours and hours:minutes and work out the amount from an hourly rate.',
  'seo.time.title': 'Time calculator: add durations and timesheet | rrstudio Tools',
  'seo.time.desc': 'Hours and minutes calculator: add and subtract durations in mixed formats, timesheet with breaks, night shifts and overtime, decimal hours conversion and amount from an hourly rate. In your browser.',

  'tool.scad.title': 'Calcolo scadenze fatture',
  'tool.scad.desc': 'Calcola le scadenze di pagamento: 30, 60, 90 o 120 giorni, data fattura o fine mese (D.F.F.M.), rate multiple, spostamento al giorno lavorativo ed esportazione CSV e .ics.',
  'seo.scad.title': 'Calcolo scadenze fatture: D.F.F.M., rate e giorni lavorativi | rrstudio Tools',
  'seo.scad.desc': 'Calcola le scadenze di pagamento di una fattura: termini a 30, 60, 90, 120 giorni o personalizzati, data fattura o fine mese (D.F.F.M.), rate con importo diviso, spostamento al primo giorno lavorativo ed esportazione in CSV e calendario .ics.',
  'tool.gcf.title': 'Generatore codice fiscale e partita IVA',
  'tool.gcf.desc': 'Genera codici fiscali e partite IVA di prova, validi ma inventati: filtri per sesso, data e comune di nascita, omocodia, ufficio provinciale, seme ripetibile, copia singola, CSV e JSON.',
  'seo.gcf.title': 'Generatore codice fiscale e partita IVA casuali di prova | rrstudio Tools',
  'seo.gcf.desc': 'Genera codici fiscali casuali e partite IVA di prova formalmente validi ma finti: scegli quanti, sesso, data e comune di nascita, omocodia e ufficio provinciale. Seme per risultati ripetibili, esporta in CSV e JSON. Nel browser, solo per test.',
};
