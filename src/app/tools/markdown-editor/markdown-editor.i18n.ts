// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const SAMPLE_IT = `# Guida rapida al Markdown

Scrivi a sinistra, leggi a destra. Puoi usare il **grassetto**, il *corsivo*, il ~~barrato~~ e il \`codice in linea\`.
Per andare a capo senza aprire un nuovo paragrafo, finisci la riga con due spazi.  
Questa riga è la successiva.

## Elenchi

- Prima voce
- Seconda voce
  - una voce annidata
  - un'altra
    1. con un elenco numerato
    2. dentro l'elenco annidato

1. Primo passo
2. Secondo passo

### Attività

- [x] Scrivere la bozza
- [ ] Rileggere il testo
- [ ] Esportare in HTML o PDF

## Citazioni e codice

> Un buon testo si legge due volte:
> la prima per capirlo, la seconda per migliorarlo.

\`\`\`js
function saluta(nome) {
  return \`Ciao, \${nome}!\`;
}
\`\`\`

## Tabella

| Frutto  | Colore | Prezzo (€/kg) |
| :------ | :----: | ------------: |
| Mela    | rosso  |          2,40 |
| Banana  | giallo |          1,90 |
| Mirtillo | blu   |         12,00 |

---

Un [link di esempio](https://example.com "Sito di esempio") e un'immagine esterna, che qui non viene caricata da sola:

![Logo di esempio](https://example.com/logo.png)
`;

const SAMPLE_EN = `# Markdown quick guide

Write on the left, read on the right. You can use **bold**, *italic*, ~~strikethrough~~ and \`inline code\`.
To start a new line without a new paragraph, end the line with two spaces.  
This line is the next one.

## Lists

- First item
- Second item
  - a nested item
  - another one
    1. with a numbered list
    2. inside the nested list

1. First step
2. Second step

### Tasks

- [x] Write the draft
- [ ] Proofread the text
- [ ] Export to HTML or PDF

## Quotes and code

> A good text is read twice:
> the first time to understand it, the second to improve it.

\`\`\`js
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Table

| Fruit     | Colour | Price (€/kg) |
| :-------- | :----: | -----------: |
| Apple     | red    |         2.40 |
| Banana    | yellow |         1.90 |
| Blueberry | blue   |        12.00 |

---

An [example link](https://example.com "Example site") and an external image, which is not loaded by itself here:

![Example logo](https://example.com/logo.png)
`;

const it = {
  'md.lead':
    'Scrivi in Markdown e guarda subito il risultato accanto. Titoli, elenchi (anche di attività), tabelle, citazioni e codice: poi esporta in .md, in HTML o in PDF. Niente viene caricato né inviato: la bozza resta nel tuo browser.',
  'md.toolbar': 'Formattazione',
  'md.bold': 'Grassetto',
  'md.italic': 'Corsivo',
  'md.link': 'Link',
  'md.heading': 'Titolo',
  'md.list': 'Elenco',
  'md.code': 'Codice',
  'md.input': 'Markdown',
  'md.input.ph': 'Scrivi qui in Markdown…',
  'md.preview': 'Anteprima',
  'md.preview.empty': 'L’anteprima appare qui mentre scrivi.',
  'md.open': 'Apri file',
  'md.open.err': 'Impossibile leggere il file come testo (massimo 5 MB).',
  'md.sample': 'Carica un esempio',
  'md.export': 'Esporta',
  'md.export.md': 'Scarica .md',
  'md.export.html': 'Scarica HTML',
  'md.export.pdf': 'PDF (stampa)',
  'md.export.hint': 'Il PDF si ottiene dalla finestra di stampa del browser: scegli «Salva come PDF». Si stampa solo l’anteprima; le immagini esterne non vengono caricate.',
  'md.stats': '{words} parole · {chars} caratteri · lettura {reading}',
  'md.stats.empty': '0 parole',
  'md.draft.saved': 'Bozza salvata in questo browser',
  'md.draft.none': 'Nessuna bozza salvata',
  'md.draft.clear': 'Cancella bozza',
  'md.draft.note': 'La bozza si salva solo nel tuo browser (localStorage) e non viene mai inviata. «Cancella bozza» la elimina da qui.',
  'md.draft.off': 'Il browser non permette di salvare la bozza: il testo resta solo finché la pagina è aperta.',
  'md.safe':
    'Anteprima sicura: l’HTML scritto nel testo non viene eseguito, sono ammessi solo link http, https e mailto, e le immagini esterne non si caricano da sole.',
  'md.img.ext': 'immagine esterna: {url}',
  'md.img.off': 'immagine: {alt}',
  'md.title.fallback': 'documento',
  'md.link.ph': 'https://',
  'md.text.ph': 'testo',
  'md.sample.text': SAMPLE_IT,
} as const;

const en: Record<keyof typeof it, string> = {
  'md.lead':
    'Write Markdown and see the result next to it. Headings, lists (task lists too), tables, quotes and code: then export as .md, HTML or PDF. Nothing is uploaded or sent: the draft stays in your browser.',
  'md.toolbar': 'Formatting',
  'md.bold': 'Bold',
  'md.italic': 'Italic',
  'md.link': 'Link',
  'md.heading': 'Heading',
  'md.list': 'List',
  'md.code': 'Code',
  'md.input': 'Markdown',
  'md.input.ph': 'Write Markdown here…',
  'md.preview': 'Preview',
  'md.preview.empty': 'The preview appears here as you write.',
  'md.open': 'Open file',
  'md.open.err': 'Could not read the file as text (5 MB at most).',
  'md.sample': 'Load an example',
  'md.export': 'Export',
  'md.export.md': 'Download .md',
  'md.export.html': 'Download HTML',
  'md.export.pdf': 'PDF (print)',
  'md.export.hint': 'The PDF comes from the browser print dialog: choose “Save as PDF”. Only the preview is printed; external images are not loaded.',
  'md.stats': '{words} words · {chars} characters · reading {reading}',
  'md.stats.empty': '0 words',
  'md.draft.saved': 'Draft saved in this browser',
  'md.draft.none': 'No draft saved',
  'md.draft.clear': 'Clear draft',
  'md.draft.note': 'The draft is saved only in your browser (localStorage) and never sent anywhere. “Clear draft” removes it from here.',
  'md.draft.off': 'The browser does not allow saving the draft: the text lasts only while the page is open.',
  'md.safe':
    'Safe preview: HTML written in the text is not run, only http, https and mailto links are allowed, and external images do not load by themselves.',
  'md.img.ext': 'external image: {url}',
  'md.img.off': 'image: {alt}',
  'md.title.fallback': 'document',
  'md.link.ph': 'https://',
  'md.text.ph': 'text',
  'md.sample.text': SAMPLE_EN,
};

export const MD_DICTIONARIES: ToolDictionaries = { it, en };
