// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const it = {
  'b64.lead':
    'Codifica e decodifica testo o file in Base64. Il risultato si aggiorna mentre scrivi, con UTF-8 corretto per accenti ed emoji.',
  'b64.mode': 'Modalità',
  'b64.mode.encode': 'Codifica',
  'b64.mode.decode': 'Decodifica',
  'b64.urlsafe': 'URL-safe',
  'b64.dataurl': 'Come data URL',
  'b64.in.encode': 'Testo da codificare',
  'b64.in.decode': 'Base64 o data URL da decodificare',
  'b64.out.encode': 'Base64',
  'b64.out.decode': 'Testo decodificato',
  'b64.ph.encode': 'Scrivi o incolla il testo da codificare…',
  'b64.ph.decode': 'Incolla Base64 (standard o URL-safe) oppure un data URL…',
  'b64.drop': 'Trascina un file qui per ottenerne il Base64 (massimo 25 MB), oppure',
  'b64.file.remove': 'Rimuovi il file',
  'b64.file.group': 'File caricato',
  'b64.binary': '[Dati binari · {size}{type}]',
  'b64.download': 'Scarica file',
  'b64.preview': 'Anteprima',
  'b64.preview.alt': 'Anteprima dell\'immagine',
  'b64.truncated':
    'Mostrati i primi {shown} caratteri su {total}: Copia include tutto il risultato.',
  'b64.err.chars': 'Il Base64 non è valido: carattere non ammesso «{ch}».',
  'b64.err.length': 'Il Base64 non è valido: la lunghezza è sbagliata, forse è incompleto o troncato.',
  'b64.err.dataurl': 'Il data URL non è valido.',
  'b64.err.toolarge': 'Il file è troppo grande (massimo 25 MB).',
  'b64.err.read': 'Impossibile leggere il file.',
};

const en: typeof it = {
  'b64.lead':
    'Encode and decode text or files to Base64. The result updates as you type, with proper UTF-8 for accents and emoji.',
  'b64.mode': 'Mode',
  'b64.mode.encode': 'Encode',
  'b64.mode.decode': 'Decode',
  'b64.urlsafe': 'URL-safe',
  'b64.dataurl': 'As data URL',
  'b64.in.encode': 'Text to encode',
  'b64.in.decode': 'Base64 or data URL to decode',
  'b64.out.encode': 'Base64',
  'b64.out.decode': 'Decoded text',
  'b64.ph.encode': 'Type or paste the text to encode…',
  'b64.ph.decode': 'Paste Base64 (standard or URL-safe) or a data URL…',
  'b64.drop': 'Drop a file here to get its Base64 (25 MB max), or',
  'b64.file.remove': 'Remove the file',
  'b64.file.group': 'Loaded file',
  'b64.binary': '[Binary data · {size}{type}]',
  'b64.download': 'Download file',
  'b64.preview': 'Preview',
  'b64.preview.alt': 'Image preview',
  'b64.truncated': 'Showing the first {shown} of {total} characters: Copy includes the whole result.',
  'b64.err.chars': 'Invalid Base64: character not allowed "{ch}".',
  'b64.err.length': 'Invalid Base64: wrong length, it may be incomplete or truncated.',
  'b64.err.dataurl': 'The data URL is not valid.',
  'b64.err.toolarge': 'The file is too large (25 MB max).',
  'b64.err.read': 'Could not read the file.',
};

export const BASE64_DICTIONARIES: ToolDictionaries = { it, en };
