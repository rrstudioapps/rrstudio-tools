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
   The route (URL slug) is in **English** for general-purpose tools (`/pdf-tools`, `/exif-viewer`) and in
   **Italian** for tools that only make sense in Italy (`/codice-fiscale`, `/fattura-elettronica`). /
   L'indirizzo è in inglese per gli strumenti generici e in italiano per quelli solo italiani.
2. Add an entry to `src/app/tools/tools.registry.ts` (route, home card, SEO data).
3. **English version:** the language comes from the URL, so a general-purpose tool automatically gets
   `/en/<slug>` (same slug) from the registry, plus its hreflang links; just write the `seo.*` and `tool.*`
   texts in both dictionaries. A tool that only makes sense in Italy gets `italyOnly: true` in the registry:
   it has no `/en/` page and appears in the "Tools for Italy" line of the English home (add its
   `home.italy.<id>` label in both dictionaries). / La versione inglese (`/en/<slug>`) è automatica dal
   registry; per gli strumenti solo italiani usa `italyOnly: true`.
4. Internal links go through `i18n.link('<slug>')`, never a hard-coded `'/slug'`, so they stay in the current language.
5. **Social image:** run `npm run og-images` (needs the Playwright Chromium; `CHROMIUM_PATH` if it is not found).
   It reads the tool name and description from the dictionaries and the registry and writes
   `public/og/it/<slug>.png` and `public/og/en/<slug>.png` (1200×630, "Carta" style; `italyOnly` tools get only `it`).
   The SEO service points `og:image` and `twitter:image` to them; commit the new files.
   / Immagine social: `npm run og-images` genera `public/og/<lingua>/<slug>.png`, poi committa i file.
6. Regenerate the sitemap with `UPDATE_SITEMAP=1 npm test` (the test fails if `public/sitemap.xml` is out of date).
7. Run `npm run typecheck`, `npm test` and `npm run build`, then `npm run smoke`, `npm run e2e` and, if you touched the service worker, `npm run pwa-check` (they need the Playwright Chromium; `CHROMIUM_PATH` if it is not found).

## Development / Sviluppo

Lighthouse thresholds (`scripts/lighthouse.mjs`, mobile and desktop presets, sample of 11 pages, also run in CI): accessibility = 100, SEO = 100 (except `noindex` pages), best practices >= 95, performance >= 60 on mobile and >= 85 on desktop. Performance floors are deliberately well below the measured scores (mobile 78-96, desktop 95-100) because simulated throttling is noisy on busy machines; they catch real regressions, not decimals. `LH_RUNS=3` takes the median of three runs, `LH_ONLY=privacy,json` filters pages, `LH_REPORT=1` prints the numbers without failing.

```sh
npm ci
npm start            # dev server
npm test             # unit tests (Angular + node:test for scripts/sw-manifest)
npm run build        # ng build + scripts/build-sw.mjs (writes sw.js): static build in dist/rrstudio-tools/browser
npm run smoke        # after a build: every page (IT/EN, 360 and 1280 px) for console errors, horizontal scroll, axe (light and dark)
npm run e2e          # after a build: runs the tool interactions of the screenshot script without writing files
npm run pwa-check    # after a build: service worker, offline navigation, offline page, update message
npm run lighthouse   # after a build: Lighthouse (mobile and desktop) on 11 sample pages, fails below the thresholds
npm run pwa-icons    # regenerates the PWA icons in public/ from favicon.svg
```
