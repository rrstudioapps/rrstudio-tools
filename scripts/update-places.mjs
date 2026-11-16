// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
//
// Rigenera public/data/luoghi.json (luoghi di nascita per il codice fiscale) dalle fonti ISTAT.
// Uso:  node scripts/update-places.mjs [--soppressi=file.csv] [--esteri=file.csv]
//
// Fonti (ISTAT, licenza CC BY 4.0, https://www.istat.it/note-legali/):
//  - Dallo stesso CSV si ricava anche src/app/tools/iban-partita-iva/vat-offices.ts: codici storici di
//    provincia 001-099, usati come codice dell'ufficio IVA (cifre 8-10 della partita IVA).
//  - comuni attuali: https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv
//    (pagina "Codici dei comuni, delle province e delle regioni"); scaricato dallo script.
//  - comuni soppressi e Stati esteri (codice Z): ISTAT li pubblica solo nel portale SITUAS
//    (https://situas.istat.it, "Storico comuni" e "Unità territoriali/Paesi esteri") senza un file
//    scaricabile a indirizzo stabile. Si esportano da lì in CSV (separatore ";", UTF-8) e si passano con
//    --soppressi e --esteri. Colonne attese (intestazione obbligatoria, ordine libero):
//      soppressi: denominazione;codice catastale;sigla;anno (anno di soppressione, facoltativo)
//      esteri:    denominazione;codice catastale (Z...)
//    Se non vengono passati, restano quelli già presenti nel JSON esistente.
// Il file prodotto contiene la data di aggiornamento e le fonti.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const OUT = `${root}public/data/luoghi.json`;
const OUT_VAT = `${root}src/app/tools/iban-partita-iva/vat-offices.ts`;
const COMUNI_URL = 'https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));

/** Parser CSV minimale (campi tra virgolette con a capo e "" ammessi). */
function parseCsv(text, sep = ';') {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) (row.push(cell), (cell = ''));
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) (row.push(cell), rows.push(row));
  return rows;
}

const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
function table(text) {
  const [head, ...body] = parseCsv(text.replace(/^﻿/, ''));
  const h = head.map(norm);
  const col = (...names) => h.findIndex((x) => names.some((n) => x.startsWith(n)));
  return { body, col };
}

async function comuni() {
  const res = await fetch(COMUNI_URL, { headers: { 'user-agent': 'rrstudio-tools update-places' } });
  if (!res.ok) throw new Error(`ISTAT: HTTP ${res.status} su ${COMUNI_URL}`);
  // il file ISTAT è in Windows-1252
  const text = new TextDecoder('windows-1252').decode(await res.arrayBuffer());
  const { body, col } = table(text);
  const iName = col('denominazione (italiana e straniera)');
  const iCat = col('codice catastale');
  const iSig = col('sigla automobilistica');
  const iHist = col('codice provincia (storico)');
  const iUts = col("denominazione dell'unità territoriale sovracomunale");
  if ([iName, iCat, iSig, iHist, iUts].includes(-1)) throw new Error('Intestazioni del CSV ISTAT cambiate: aggiornare lo script');
  const list = body
    .map((r) => [r[iName].trim(), r[iCat].trim().toUpperCase(), r[iSig].trim().toUpperCase()])
    .filter((r) => /^[A-Z]\d{3}$/.test(r[1]));
  if (list.length < 7000) throw new Error(`Solo ${list.length} comuni: file ISTAT inatteso`);
  // codice storico di provincia 001-099 → [sigla, provincia]
  const offices = {};
  for (const r of body) {
    const h = r[iHist].trim();
    if (/^0\d\d$/.test(h) && h !== '000') offices[h] ??= [r[iSig].trim().toUpperCase(), r[iUts].trim()];
  }
  return { list: list.sort((a, b) => a[0].localeCompare(b[0], 'it')), offices };
}

function writeOffices(offices, updated) {
  const rows = Object.keys(offices)
    .sort()
    .map((k) => `  '${k}': ['${offices[k][0]}', ${JSON.stringify(offices[k][1])}],`)
    .join('\n');
  mkdirSync(`${root}src/app/tools/iban-partita-iva`, { recursive: true });
  writeFileSync(
    OUT_VAT,
    `// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

// FILE GENERATO da scripts/update-places.mjs: non modificare a mano.
// Codici storici di provincia 001-099 (ISTAT, CC BY 4.0, aggiornato al ${updated}), usati come codice
// dell'ufficio IVA nelle cifre 8-10 della partita IVA: [sigla, provincia].
export const VAT_OFFICES: Readonly<Record<string, readonly [string, string]>> = {
${rows}
};
`,
  );
}

function fromFile(path, kind) {
  const { body, col } = table(readFileSync(path, 'utf8'));
  const iName = col('denominazione');
  const iCat = col('codice catastale');
  const iSig = col('sigla');
  const iYear = col('anno');
  if (iName === -1 || iCat === -1) throw new Error(`${path}: servono le colonne "denominazione" e "codice catastale"`);
  const re = kind === 'esteri' ? /^Z\d{3}$/ : /^[A-Y]\d{3}$/;
  return body
    .map((r) => {
      const base = [r[iName].trim(), r[iCat].trim().toUpperCase()];
      if (kind === 'soppressi') base.push(iSig === -1 ? '' : r[iSig].trim().toUpperCase(), iYear === -1 ? 0 : Number(r[iYear]) || 0);
      return base;
    })
    .filter((r) => re.test(r[1]))
    .sort((a, b) => a[0].localeCompare(b[0], 'it'));
}

const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const { list, offices } = await comuni();
const updated = new Date().toISOString().slice(0, 10);
const data = {
  updated,
  source: 'Comuni attuali e soppressi: ISTAT (CSV dei comuni e report SITUAS 128), CC BY 4.0. Stati esteri: ANPR, Ministero dell\'Interno (tab_Stati_Esteri), CC BY 4.0',
  comuni: list,
  // un comune soppresso da poco può essere ancora nel CSV dei comuni attuali: lo stesso codice
  // catastale comparirebbe due volte nei suggerimenti, quindi vale la voce dei comuni attuali
  soppressi: (args.soppressi ? fromFile(args.soppressi, 'soppressi') : (old.soppressi ?? [])).filter(
    (s) => !list.some((c) => c[1] === s[1]),
  ),
  esteri: args.esteri ? fromFile(args.esteri, 'esteri') : (old.esteri ?? []),
};
writeFileSync(OUT, JSON.stringify(data));
writeOffices(offices, updated);
console.log(`${OUT}: ${data.comuni.length} comuni, ${data.soppressi.length} soppressi, ${data.esteri.length} Stati esteri, aggiornato al ${data.updated}`);
if (!data.soppressi.length || !data.esteri.length) console.warn('Attenzione: mancano i comuni soppressi e/o gli Stati esteri (vedi l\'intestazione dello script).');
