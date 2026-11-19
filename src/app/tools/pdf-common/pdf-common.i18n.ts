// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

/** Testi comuni agli strumenti PDF a un solo file. */
const it = {
  'pc.drop': 'Trascina un PDF su questa area (massimo 100 MB), oppure',
  'pc.loading': 'Lettura del PDF…',
  'pc.info': '{name} · {pages} pagine · {size}',
  'pc.err.type': 'Il file non è un PDF.',
  'pc.err.size': 'Il file è troppo grande (massimo 100 MB).',
  'pc.err.password': 'Il PDF è protetto da password: questo strumento non può aprirlo.',
  'pc.err.encrypted': 'Il PDF è cifrato e non si può riscrivere: questo strumento non può modificarlo.',
  'pc.err.invalid': 'Impossibile leggere il PDF: il file è danneggiato o non valido.',
  'pc.working': 'Elaborazione…',
  'pc.download': 'Scarica il PDF',
  'pc.done': 'Fatto: {name} ({size}).',
  'pc.err.build': 'Impossibile creare il PDF.',
  'pc.privacy': 'Il PDF resta nel tuo browser: non viene inviato a nessun server.',
};
const en: Record<keyof typeof it, string> = {
  'pc.drop': 'Drop a PDF on this area (100 MB max), or',
  'pc.loading': 'Reading the PDF…',
  'pc.info': '{name} · {pages} pages · {size}',
  'pc.err.type': 'The file is not a PDF.',
  'pc.err.size': 'The file is too large (100 MB max).',
  'pc.err.password': 'The PDF is password-protected: this tool cannot open it.',
  'pc.err.encrypted': 'The PDF is encrypted and cannot be rewritten: this tool cannot modify it.',
  'pc.err.invalid': 'Could not read the PDF: the file is damaged or invalid.',
  'pc.working': 'Working…',
  'pc.download': 'Download the PDF',
  'pc.done': 'Done: {name} ({size}).',
  'pc.err.build': 'Could not create the PDF.',
  'pc.privacy': 'The PDF stays in your browser: it is not sent to any server.',
};
export const PDF_COMMON_DICTIONARIES: ToolDictionaries = { it, en };
