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
  'footer.premium': 'Premium dashboard',
  'footer.repo': 'Source code on GitHub',
  'footer.license': 'AGPL-3.0 license',
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
  'cat.data.desc': 'Tables, JSON, PDF and images: open, clean up and convert your files.',
  'cat.dev.title': 'Developers',
  'cat.dev.desc': 'Encode, decode and compute: small workbench tools.',
  'cat.security.title': 'Security',
  'cat.security.desc': 'Strong passwords, created in your browser.',
  'cat.italy.title': 'Italy: tax & banking',
  'cat.italy.desc': 'Codice fiscale, IBAN and VAT number: calculate and verify.',
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
    'No analytics, no external fonts or scripts. We only store language and theme, locally.',
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
    'Free, open source and private web tools: your files stay on your computer. No sign-up.',
  'seo.csv.title': 'CSV → Dashboard, free and private online — rrstudio Tools',
  'seo.csv.desc':
    'Turn a CSV or Excel file into a dashboard with KPIs and charts, right in your browser. No uploads: your data stays on your computer.',
  'seo.base64.title': 'Base64 Encode and Decode online — free and private | rrstudio Tools',
  'seo.base64.desc':
    'Encode and decode Base64 online, including files and images: proper UTF-8, URL-safe variant and data URLs. Runs in your browser, nothing is uploaded.',
  'seo.url.title': 'URL Encode and Decode online — free and private | rrstudio Tools',
  'seo.url.desc':
    'Encode and decode URLs and query parameters (percent-encoding) in component or full-URL mode, with a table of the URL parts. Runs in your browser.',
  'seo.json.title': 'JSON Formatter and Validator online — free and private | rrstudio Tools',
  'seo.json.desc':
    'Format, minify and validate JSON online: errors with line and column, key sorting and syntax highlighting. Runs in your browser, nothing is uploaded.',
  'tool.jv.title': 'JSON viewer & editor',
  'tool.jv.desc':
    'Explore JSON as a tree, search keys and values, copy the path and edit nodes with undo and redo. Handles files of tens of MB.',
  'seo.jv.title': 'JSON viewer and editor online, tree view — free and private | rrstudio Tools',
  'seo.jv.desc':
    'View and edit JSON as an expandable tree: search, JavaScript path and JSON Pointer, edit keys and values, undo and redo. Handles large files. Everything runs in your browser, nothing is uploaded.',

  'tool.ic.title': 'Image compressor & converter',
  'tool.ic.desc':
    'Shrink JPG, PNG and WebP files, convert to WebP or AVIF and resize them, many at once. Before/after comparison and a ZIP download.',
  'seo.ic.title':
    'Image compressor and converter online — free and private | rrstudio Tools',
  'seo.ic.desc':
    'Compress photos and images, convert them to WebP, JPEG, PNG or AVIF and resize them online: in bulk, with a before/after comparison and ZIP. All in your browser, no upload.',

  'tool.pdf.title': 'PDF tools: merge, split, rotate',
  'tool.pdf.desc':
    'Merge several PDFs, extract or split pages, rotate and reorder them from a grid of thumbnails. Your files never leave your computer.',
  'seo.pdf.title': 'Merge, split and rotate PDF online — free and private | rrstudio Tools',
  'seo.pdf.desc':
    'Merge PDFs into one, split a PDF into several files, extract, delete, rotate and reorder pages online. All in your browser, nothing is uploaded: fine for confidential documents.',

  'tool.pw.title': 'Password generator',
  'tool.pw.desc':
    'Random passwords and memorable passphrases, with entropy and an estimated time to guess them. Made in your browser, never stored.',
  'seo.pw.title': 'Secure password generator online — free and private | rrstudio Tools',
  'seo.pw.desc':
    'Generate random passwords and passphrases with the browser\'s cryptography (crypto.getRandomValues): length, character sets, entropy in bits and estimated time to guess. Nothing is stored or sent.',

  'tool.hash.title': 'Hash & checksum',
  'tool.hash.desc':
    'Compute MD5, SHA-1, SHA-256, SHA-384 and SHA-512 of a text or a file (up to 2 GB) and compare them with a checksum. All in your browser.',
  'seo.hash.title': 'SHA-256, SHA-1 and MD5 hash and checksum calculator online — free and private | rrstudio Tools',
  'seo.hash.desc':
    'Compute SHA-256, SHA-512, SHA-1 and MD5 of a text or a file and verify a checksum, with a progress bar for large files. All in your browser, nothing is uploaded.',

  'tool.cf.title': 'Italian tax code (codice fiscale) calculator',
  'tool.cf.desc':
    'Calculate the Italian codice fiscale from name, surname, sex, date and place of birth, or check and decode a code (including omocodia). No personal data leaves your computer.',
  'seo.cf.title': 'Italian tax code (codice fiscale) calculator and validator online — free and private | rrstudio Tools',
  'seo.cf.desc':
    'Calculate the codice fiscale from name, surname, date and place of birth (Italian municipality or foreign country) and validate a code: structure, check character, omocodia, sex, date and place of birth. All in your browser: no personal data is sent or stored.',

  'tool.iban.title': 'IBAN & Italian VAT number validator',
  'tool.iban.desc':
    'Check an IBAN (mod-97, length per country, Italian CIN, ABI and CAB) or an Italian VAT number (partita IVA), also in bulk with CSV export. No data leaves your computer.',
  'seo.iban.title': 'IBAN and Italian VAT number (partita IVA) validator online — free and private | rrstudio Tools',
  'seo.iban.desc':
    'Check whether an IBAN is valid (mod-97 check digits, length per country, Italian CIN, ABI, CAB) and whether an Italian VAT number is correct. Validate many values at once and export a CSV. Nothing is sent or stored.',
};
