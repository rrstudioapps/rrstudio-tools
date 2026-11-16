<!-- SPDX-License-Identifier: AGPL-3.0-or-later · © 2026 rrstudio — rrstudio Tools -->

<p align="center">
  <img src="public/rrstudio-logo.svg" width="72" height="72" alt="rrstudio logo">
</p>

<h1 align="center">rrstudio Tools</h1>

<p align="center">
  Free, open source web tools that run entirely in your browser.<br>
  <strong>Your data stays on your computer.</strong>
</p>

<p align="center">
  <a href="https://tools.rr-dev.eu"><strong>Live demo → tools.rr-dev.eu</strong></a> ·
  <a href="https://demo.rr-dev.eu">Premium dashboards</a> ·
  <a href="https://ko-fi.com/rrstudioapps">Buy me a coffee</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-1c1c1e"></a>
  <a href="../../actions/workflows/build.yml"><img alt="Build" src="../../actions/workflows/build.yml/badge.svg"></a>
</p>

![rrstudio Tools home](docs/screenshots/home-light.png)

## Languages and URLs

The language of a page is decided by its URL, not by the browser or a saved preference. The root is Italian (`/`, `/pdf-tools`); the English versions live under `/en/` with the same slugs (`/en/`, `/en/pdf-tools`). Every page is prerendered in its own language, with `<html lang>`, title, description, Open Graph tags, `canonical` and `hreflang` links (`it`, `en`, and `x-default` pointing to English). `public/sitemap.xml` lists all of them with `xhtml:link` alternates.

Tools that only make sense in Italy (codice fiscale, IBAN & partita IVA, e-invoice) are flagged `italyOnly` in the registry: they have no `/en/` page, the EN switch is disabled on them, and the English home links to them in a discreet line. An unknown `/en/...` address goes to `/en/`. Visitors whose browser is not in Italian get a small, dismissible hint on Italian pages that have an English version; there is no automatic redirect.

## Tools

The home page groups the tools by category, with filter pills (shareable as `?categoria=sviluppatori`, or `?category=developers` on the English home) and a search box.

### Data & documents

Tables, JSON, PDF and images.

| Tool | What it does |
|---|---|
| [**CSV → Dashboard**](https://tools.rr-dev.eu/csv-dashboard) | Drop a CSV or Excel file and get KPI cards, a time chart, a category chart and a filterable, sortable table. Customize columns, chart types, color and title, then export as a self-contained HTML file, PNG or PDF. |
| [**JSON Viewer & Editor**](https://tools.rr-dev.eu/json-viewer) | Explore JSON as a lazy, paginated tree (files up to 50 MB), search keys and values, copy the JavaScript path or JSON Pointer of a node, edit values and keys inline, add, delete, duplicate, move and retype nodes, with undo/redo and a formatted Text view. |
| [**JSON Formatter and Validator**](https://tools.rr-dev.eu/json-formatter) | Format (2 / 4 spaces or tab), minify and sort keys, with live validation: errors show line and column, plus size, key count and depth, and light syntax highlighting. |
| [**PDF tools: merge, split, rotate**](https://tools.rr-dev.eu/pdf-tools) | Merge several PDFs, extract or split pages (every page, every N pages or by ranges like `1-3, 5, 8-10`), rotate, delete and reorder pages from a grid of thumbnails. Your PDFs are never uploaded: fine for confidential documents. |
| [**Image compressor & converter**](https://tools.rr-dev.eu/image-compressor) | Compress and convert many images at once to JPEG, WebP, PNG or AVIF, with quality and resize options, a before/after slider and a ZIP download. Done in your browser; EXIF metadata (GPS included) is stripped. |
| [**Images to PDF**](https://tools.rr-dev.eu/images-to-pdf) | Combine JPG, PNG and WebP images into one PDF: reorder the thumbnails (drag & drop or keyboard), choose A4, Letter or fit-to-image pages, orientation, margins, 1, 2 or 4 images per page and the quality. EXIF orientation is respected. |
| [**PDF to images**](https://tools.rr-dev.eu/pdf-to-images) | Turn PDF pages (all, or a range like `1-3, 5`) into PNG or JPEG at 72, 150 or 300 dpi, with previews and single or ZIP download. |

### Developers

Encode, decode and compute.

| Tool | What it does |
|---|---|
| [**Base64 Encode/Decode**](https://tools.rr-dev.eu/base64) | Encode and decode text or files to Base64 with correct UTF-8, an URL-safe option and data URLs. Drop a file to get its Base64, or decode back to a downloadable file with an image preview. |
| [**URL Encode/Decode**](https://tools.rr-dev.eu/url-encode) | Percent-encode and decode text, as a component or as a full URL, with optional "space as +". Shows a copyable table of the URL parts and decoded query parameters. |
| [**Hash & checksum**](https://tools.rr-dev.eu/hash-generator) | MD5, SHA-1, SHA-256, SHA-384 and SHA-512 of a text (live) or a file up to 2 GB, in hex and Base64, with a progress bar, cancel and a "compare with a checksum" field. |

### Security

Strong passwords and photo metadata.

| Tool | What it does |
|---|---|
| [**Password generator**](https://tools.rr-dev.eu/password-generator) | Random passwords (4-128 characters, choose the character sets, exclude ambiguous ones) and passphrases (3-12 words from the EFF large wordlist), with honest entropy in bits, a strength bar and the estimated time to guess. Nothing is stored. |
| [**EXIF viewer & remover**](https://tools.rr-dev.eu/exif-viewer) | See the EXIF, GPS, XMP and IPTC metadata of JPEG, PNG and WebP photos, with warnings for GPS, serial numbers and owner names, and remove it with no recompression (pixels stay identical). Before/after field counts, single or ZIP download. |

### Italy: tax & banking

Codice fiscale, IBAN, VAT number and electronic invoices.

| Tool | What it does |
|---|---|
| [**Italian tax code (codice fiscale)**](https://tools.rr-dev.eu/codice-fiscale) | Calculate the codice fiscale (official DM 23/12/1976 rules, Italian municipality with type-ahead search, foreign country or manual code) and check and decode a code: structure, check character, sex, birth date (century ambiguity) and place, omocodia included. |
| [**IBAN & Italian VAT validator**](https://tools.rr-dev.eu/iban-partita-iva) | One field that recognises an IBAN or a partita IVA, plus separate tabs and a bulk check (one value per line, CSV export). IBAN: mod-97, length and format per country, Italian CIN/ABI/CAB. VAT: check digit and office code. |
| [**Italian e-invoice viewer (FatturaPA XML/P7M)**](https://tools.rr-dev.eu/fattura-elettronica) | Open an electronic invoice as XML, signed .p7m (DER or Base64) or a ZIP of invoices and read it laid out: parties, lines, VAT summary, totals, payment, attachments. Print or save as PDF. The signature is not verified. |

More tools are coming, with the same rule: nothing leaves your browser.

### CSV → Dashboard

![CSV → Dashboard, light theme](docs/screenshots/dashboard-light.png)

<details>
<summary>Dark theme and mobile</summary>

![CSV → Dashboard, dark theme](docs/screenshots/dashboard-dark.png)
<img src="docs/screenshots/dashboard-mobile.png" width="320" alt="CSV → Dashboard on mobile">
</details>

- CSV (any delimiter, UTF-8 or Windows-1252) and XLSX/XLS files, via drag & drop or file picker.
- Automatic column type detection: date, number (Italian and English formats, currency, %), category, text.
- KPI cards: total, average, row count, change versus the previous period when there is a date column.
- Line/area/bar chart over time and bar/pie chart by category (Apache ECharts).
- Exports: a single offline HTML file, PNG and multi-page PDF.
- "Try with sample data" with a demo sales CSV.
- Italian and English UI, light and dark theme, responsive.

### Base64 Encode/Decode

![Base64 Encode/Decode](docs/screenshots/base64.png)

- Live encode/decode with correct UTF-8 (accents, emoji), URL-safe option, whitespace and padding tolerant decoding.
- Files up to 25 MB by drag & drop, optionally as a data URL, with an image preview.
- Decoding a data URL or binary Base64 offers "Download file" (MIME from the data URL or magic bytes: png, jpg, gif, webp, pdf, zip).

### Image compressor & converter

![Image compressor & converter](docs/screenshots/image-compressor.png)

- Up to 50 images (JPG, PNG, WebP, AVIF, GIF first frame, BMP), 50 MB each, by drag & drop or file picker.
- Output: original format, JPEG, WebP, PNG or AVIF (only the formats your browser can actually encode are offered); quality 1-100; resize by max width, max height or percentage (never enlarges); background colour for transparency in JPEG.
- Decoding, resizing and encoding run in a Web Worker (`createImageBitmap` + `OffscreenCanvas`), with a main-thread fallback. EXIF orientation is respected and all metadata, GPS included, is removed.
- Per-file before/after size and pixels, saving in %, a draggable (and keyboard-operable) before/after slider, single download and a ZIP of everything (fflate, MIT, loaded on demand). If a result is larger than the original in the same format, the original is kept.

### PDF tools: merge, split, rotate

![PDF tools](docs/screenshots/pdf-tools.png)

- Up to 20 PDFs (100 MB each) by drag & drop or file picker; password-protected files are skipped with a clear message. Every page of every file appears in one grid of thumbnails, with its number and a discreet colour and label for the source file.
- Per page: rotate left/right, delete, select. Reorder by drag & drop (native HTML5) or with the move buttons / Alt + arrow keys, with screen-reader announcements.
- Actions: merge everything in the current order and rotation, extract the selected pages, rotate all, or split (every page, every N pages, or by ranges such as `1-3, 5, 8-10`, validated with clear errors). Several output files come as a ZIP (fflate).
- Output PDFs are built with pdf-lib (MIT); Producer/Creator are "rrstudio Tools" and the title of the first file is kept. Thumbnails are drawn lazily, one at a time, with pdf.js (Apache-2.0); its worker and standard fonts are served from the same origin (no CDN, no `unsafe-eval`).

### Images to PDF

![Images to PDF](docs/screenshots/images-to-pdf.png)

- Route `/images-to-pdf`. Up to 100 images (JPG, PNG, WebP, 50 MB each) as thumbnails that can be reordered by drag & drop, with buttons or with Alt + arrow keys (screen-reader announcements). HEIC is not supported by browsers: a clear message explains how to export a JPG.
- Page: A4, Letter or "fit to image" (the page has the image's proportions at 150 dpi), orientation automatic/portrait/landscape, margins none/5/10/20 mm, 1, 2 or 4 images per page.
- Quality 100 keeps JPG and PNG files byte for byte (lossless); lower values re-encode them as JPEG. EXIF orientation is respected. The PDF is built with pdf-lib (MIT); pages are laid out by a pure, unit-tested function.
- The mode switch moves to `/pdf-to-images` (same page component, mode preset by the route).

### PDF to images

![PDF to images](docs/screenshots/pdf-to-images.png)

- Route `/pdf-to-images`. One PDF (100 MB; password-protected files are refused with a clear message), pages all or by range (same parser as the PDF tools, with clear errors), PNG or JPEG, 72, 150 or 300 dpi, up to 50 pages per run.
- Pages are drawn with pdf.js (Apache-2.0), whose worker comes from the same origin; very large pages are scaled down to 50 megapixels. Previews, single download or a ZIP (fflate).

### EXIF viewer & remover

![EXIF viewer & remover](docs/screenshots/exif-viewer.png)

- JPEG, PNG and WebP (HEIC is reported as unsupported). A purpose-written, bounds-checked parser reads EXIF/TIFF (JPEG APP1, PNG `eXIf`, WebP `EXIF`), XMP and IPTC, PNG text chunks and the embedded thumbnail, grouped as camera, date and time, shooting settings, software, author and copyright.
- Warnings for GPS, serial numbers and owner or author names. GPS shows coordinates, altitude and accuracy plus a plain text link "Open on OpenStreetMap": no map or external request is made unless you click it.
- Removal does not recompress: JPEG drops the APP1 (EXIF/XMP), APP13 (IPTC) and comment segments; PNG drops `eXIf`, `tEXt`, `zTXt`, `iTXt` and `tIME`; WebP drops the `EXIF` and `XMP ` chunks and updates the VP8X header and the RIFF size. For photos with an EXIF orientation other than 1 you choose between keeping a minimal EXIF with only the orientation, or rotating the pixels (which recompresses). Tests check that the cleaned file has no metadata left and that the image data is byte for byte identical.
- Before/after field counts and bytes saved; single download or ZIP.

### Password generator

![Password generator](docs/screenshots/password-generator.png)

- Passwords of 4-128 characters from lowercase, uppercase, digits and symbols (at least one set always on), optional "exclude ambiguous characters" (`0 O o 1 l I |`) and a guarantee of at least one character per chosen set. Passphrases of 3-12 words with a separator, capitalisation and an optional number.
- Randomness only from `crypto.getRandomValues`, with rejection sampling (no modulo bias); unit tests check the absence of bias and the set guarantee.
- Entropy is the log2 of the real number of possible results (inclusion-exclusion for the set guarantee), with a bar, a label (weak < 50, fair < 80, strong < 110, very strong) and the average time to guess at 10^10 guesses/s. "Generate 10" gives a copyable list; Ctrl/Cmd + Enter generates.
- Nothing is stored (not even in `localStorage`). Passphrases use the [EFF Large Wordlist](https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases) (CC BY 3.0 US, dice numbers removed), a static file loaded from the same origin only when needed.

### Hash & checksum

![Hash & checksum](docs/screenshots/hash-generator.png)

- MD5, SHA-1, SHA-256, SHA-384, SHA-512 of a text (live) or a file up to 2 GB read in blocks with `file.stream()`, with a progress bar and cancel; hex (optionally uppercase) and Base64, each copyable.
- SHA-1/256/384/512 use Web Crypto, which needs the whole buffer: up to 500 MB the file is assembled in memory. Above that, a warning appears and only MD5 and SHA-256 are computed, incrementally, by pure TypeScript implementations tested against the official vectors and Web Crypto.
- MD5 is not in Web Crypto (it is considered broken): it is implemented in TypeScript (RFC 1321 vectors) and flagged, like SHA-1, as not secure for cryptography.
- "Compare with a checksum": paste an expected hash (case and spaces ignored) and the matching algorithm is highlighted, or you get "No match".

### URL Encode/Decode

![URL Encode/Decode](docs/screenshots/url-encode.png)

- `encodeURIComponent` (component) or `encodeURI` (full URL), with "space as +" for form-urlencoded data.
- Clear errors on invalid `%` sequences; a table with protocol, host, path, hash and each decoded query parameter.

### JSON Viewer & Editor

![JSON Viewer & Editor](docs/screenshots/json-viewer.png)

- Tree view with lazy rendering and 100-children pages, so files up to 50 MB open without freezing the page; ARIA tree keyboard navigation.
- Search by key or value with next/previous, path as `$.users[0].name` and as JSON Pointer `/users/0/name`.
- Inline editing with type validation, key rename, add, delete, duplicate, move, change type; undo/redo (Ctrl/Cmd+Z); Tree and Text views.

### JSON Formatter and Validator

![JSON Formatter and Validator](docs/screenshots/json-formatter.png)

- Format, minify, sort keys recursively; copy, download as `.json` or load a `.json` file by drag & drop.
- Line numbers with the error line marked; line and column are worked out for V8/Chromium, Firefox and Safari messages.
- Hand-made syntax highlighting (no editor library, no `innerHTML`).

### Italian tax code (codice fiscale)

![Italian tax code](docs/screenshots/codice-fiscale.png)

- Calculation with the official rules (surname and name consonants, the 1st/3rd/4th consonant rule for names, month letters, day + 40 for women, cadastral code, check character); accents, apostrophes, spaces and compound surnames are handled.
- Birth place: municipality with a type-ahead combobox (ARIA pattern), or the cadastral/Z code typed by hand.
- Check and decode: length, structure, check character, sex, birth date (most plausible century plus the alternative) and place; omocodia (letters LMNPQRSTUV in place of digits) is supported in both directions and the seven omocodia variants are listed.
- The result is the "theoretical" code: the real one is assigned by the Agenzia delle Entrate. Nothing is sent or stored.
- Place data: ISTAT "Codici dei comuni, delle province e delle regioni", CC BY 4.0, saved in `public/data/luoghi.json` (about 220 kB, 74 kB gzipped, loaded only when needed) by `node scripts/update-places.mjs`. Abolished municipalities and foreign countries (Z codes) have to be exported from ISTAT's SITUAS portal and passed with `--soppressi` and `--esteri` (see the script header); until then the Z code can be typed by hand.

### Italian e-invoice viewer (FatturaPA XML/P7M)

![Italian e-invoice viewer](docs/screenshots/fattura-elettronica.png)

- Route `/fattura-elettronica`. Opens `.xml`, `.p7m` (CAdES, DER or Base64) and `.zip` files with several invoices. For `.p7m` a small ASN.1/DER reader (definite and indefinite lengths, fragmented OCTET STRINGs) extracts the XML from the CMS SignedData. **The signature is not verified**, and the page says so.
- Formats FPR12 (private parties), FPA12 (public bodies) and FSM10 (simplified), namespaces with or without prefix, several bodies per file. XML is read with `DOMParser` (no external stylesheets).
- Shows parties, general data (document type TD01-TD29, number, date, currency, reason, withholding, stamp duty, social security fund), references (orders, contracts, DDT), lines (quantity, price, discounts, VAT rate, nature N1-N7), VAT summary, totals and payment (terms, method MP01-MP23, due dates, IBAN). Code tables in Italian and English follow the public FatturaPA technical specifications, version 1.9.
- Attachments (Base64) are listed with name, format and size and can be downloaded. Print / save as PDF uses a dedicated print style with only the invoice; the XML extracted from a `.p7m` can be downloaded; the key details can be copied.

### IBAN & Italian VAT validator

![IBAN and VAT validator](docs/screenshots/iban-partita-iva.png)

- IBAN: normalisation, mod-97 (ISO 13616), length and BBAN format per country (about 77 countries, SWIFT registry), SEPA flag, grouping by four; Italian IBANs are split into CIN, ABI, CAB and account number and the CIN is verified. The tool never guesses a "corrected" IBAN.
- Partita IVA: 11 digits, check digit, office code (digits 8-10) with the province for the historical codes 001-099; the IT prefix is accepted. A valid format does not mean the number is active (links to VIES and the Agenzia delle Entrate, no calls from the site).
- Bulk check: one value per line, results table and CSV export (formulas are neutralised).

## Privacy

- **Everything runs client-side.** There is no backend: files are read and processed by your browser and are never uploaded.
- **No external requests.** No CDNs, web fonts or third-party scripts: everything is served from the same origin, and the Content Security Policy blocks connections to other servers.
- **No cookies, no tracking, no analytics.** Only your language and theme preferences are saved, in your browser's `localStorage`.

## Getting started

Requirements: Node.js 24 and npm.

```sh
git clone https://github.com/rrstudioapps/rrstudio-tools.git
cd rrstudio-tools
npm ci
npm start                 # dev server on http://localhost:4200
npm test                  # unit tests (Vitest)
npm run build             # static build in dist/rrstudio-tools/browser
```

The build is a set of static, prerendered files (`/index.html`, `/csv-dashboard/index.html`, `/base64/index.html`, JS, CSS, fonts):
upload `dist/rrstudio-tools/browser` to any static host. Configure the host to serve `<path>/index.html`
for `<path>` (most do by default). A ready-made Docker image (nginx, non-root, strict CSP) is in
[`Dockerfile`](Dockerfile) and [`deploy/`](deploy/).

### Adding a tool

Each tool lives in its own folder under `src/app/tools/<id>/` and is a lazy-loaded route. Add it to
`src/app/tools/tools.registry.ts` and it gets its route, its card on the home page and its SEO tags.
See [CONTRIBUTING.md](CONTRIBUTING.md).

### Tech stack

Angular 22 (standalone components, signals, zoneless, prerendering) · TypeScript · Apache ECharts via
ngx-echarts · PapaParse · SheetJS Community Edition · html2canvas · jsPDF · Fontsource (Inter Tight,
JetBrains Mono). Third-party licenses: [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## License

rrstudio Tools is © 2026 rrstudio and is released under the
[GNU Affero General Public License v3.0 or later](LICENSE) (AGPL-3.0-or-later).

- ✅ **Free to use** for any purpose, personal or commercial, and free to study, copy and modify.
- 🔁 **Share alike.** If you distribute a modified version, **or host it as a service that other people use over a network**, you must release your complete source code under the same license (AGPL-3.0, section 13).
- 🏷️ **Keep the attribution.** Keep the copyright headers, the [NOTICE](NOTICE) file and a visible "Based on rrstudio Tools by rrstudio" credit linking to this repository. The rrstudio name and logo are not licensed for promoting modified versions.

This is a summary, not legal advice: the [LICENSE](LICENSE) and [NOTICE](NOTICE) files are what count.

## Support

rrstudio Tools is free and has no ads. If it is useful to you:
[buy me a coffee on Ko-fi](https://ko-fi.com/rrstudioapps), or take a look at the
[premium dashboards](https://demo.rr-dev.eu) (live demos, free download, pay what you want).

---

## In italiano

**rrstudio Tools** è una raccolta di strumenti web gratuiti e open source che funzionano interamente
nel browser. **I tuoi dati restano sul tuo computer:** nessun backend, nessun upload, nessuna chiamata
a server esterni, nessun cookie, nessun tracciamento o analytics.

- **Prova online:** [tools.rr-dev.eu](https://tools.rr-dev.eu). Strumenti:
  [CSV → Dashboard](https://tools.rr-dev.eu/csv-dashboard), che da un CSV o un Excel genera KPI,
  grafici e tabella, esportabili in HTML autonomo, PNG e PDF. Poi
  [Base64](https://tools.rr-dev.eu/base64), [URL Encode/Decode](https://tools.rr-dev.eu/url-encode) e
  [JSON Formatter](https://tools.rr-dev.eu/json-formatter), [JSON Viewer ed Editor](https://tools.rr-dev.eu/json-viewer) (albero, ricerca, modifica con annulla/ripeti) e
  [Comprimi e converti immagini](https://tools.rr-dev.eu/image-compressor) (JPEG, WebP, PNG, AVIF, con
  confronto prima/dopo e ZIP) e [Strumenti PDF](https://tools.rr-dev.eu/pdf-tools) (unisci, dividi, ruota),
  [Generatore di password](https://tools.rr-dev.eu/password-generator) (password e passphrase, con
  entropia) e [Hash e checksum](https://tools.rr-dev.eu/hash-generator) (MD5, SHA-1, SHA-256, SHA-384,
  SHA-512 di testi e file), [Codice fiscale](https://tools.rr-dev.eu/codice-fiscale) (calcolo, verifica,
  omocodia), [Verifica IBAN e partita IVA](https://tools.rr-dev.eu/iban-partita-iva),
  [Visualizzatore fattura elettronica](https://tools.rr-dev.eu/fattura-elettronica) (XML e P7M),
  [Da immagini a PDF](https://tools.rr-dev.eu/images-to-pdf) e [Da PDF a immagini](https://tools.rr-dev.eu/pdf-to-images),
  [Metadati foto EXIF](https://tools.rr-dev.eu/exif-viewer) (visualizza e rimuovi senza ricomprimere), tutti con
  elaborazione solo nel browser.
- **Installazione:** `npm ci`, poi `npm start` per lo sviluppo e `npm run build` per la build
  statica (`dist/rrstudio-tools/browser`, pubblicabile su qualsiasi hosting statico).
- **Licenza:** AGPL-3.0-or-later. L'uso è libero, anche commerciale. Chi distribuisce una versione
  modificata **o la ospita come servizio online** deve rilasciarne il codice sorgente con la stessa
  licenza e mantenere l'attribuzione ("Based on rrstudio Tools by rrstudio", file NOTICE e
  intestazioni). Dettagli in [LICENSE](LICENSE) e [NOTICE](NOTICE).
- **Contribuire:** leggi [CONTRIBUTING.md](CONTRIBUTING.md).
