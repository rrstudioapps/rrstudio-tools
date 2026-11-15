# Contributing / Come contribuire

Thanks for your interest in rrstudio Tools! / Grazie per l'interesse verso rrstudio Tools!

## Ground rules / Regole

- **Privacy first:** everything runs in the browser. No backend, no external requests (CDNs,
  web fonts, analytics), no cookies. User files never leave the browser.
  / Tutto gira nel browser: niente backend, richieste esterne o cookie.
- **License:** contributions are released under **AGPL-3.0-or-later**. Every new source file starts
  with the header / I contributi sono rilasciati con la AGPL-3.0-or-later. Ogni nuovo file sorgente inizia con:
  ```
  // SPDX-License-Identifier: AGPL-3.0-or-later
  // © 2026 rrstudio — rrstudio Tools
  ```
- **Dependencies:** only free and open source libraries with an AGPL-compatible license; list them in
  `THIRD_PARTY_LICENSES.md`. / Solo librerie open source compatibili, elencate in `THIRD_PARTY_LICENSES.md`.
- **i18n:** every UI string in Italian and English. / Ogni testo in italiano e inglese.

## Adding a tool / Aggiungere uno strumento

1. Create `src/app/tools/<id>/` with its component(s), lazy routes and i18n dictionaries.
2. Add an entry to `src/app/tools/tools.registry.ts` (route, home card, SEO data).
3. Add the page to `public/sitemap.xml`.
4. Run `npm run typecheck`, `npm test` and `npm run build`.

## Development / Sviluppo

```sh
npm ci
npm start            # dev server
npm test             # unit tests
npm run build        # static build in dist/rrstudio-tools/browser
```
