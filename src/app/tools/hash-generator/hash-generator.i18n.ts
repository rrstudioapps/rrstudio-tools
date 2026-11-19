// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const it = {
  'hash.lead':
    'Calcola MD5, SHA-1, SHA-256, SHA-384 e SHA-512 di un testo (si aggiornano mentre scrivi) o di un file fino a 2 GB, e confrontali con un checksum. Il file non viene caricato da nessuna parte.',
  'hash.in': 'Testo da analizzare',
  'hash.ph': 'Scrivi o incolla un testo, oppure trascina un file…',
  'hash.drop': 'Trascina un file qui per calcolarne gli hash (fino a 2 GB), oppure',
  'hash.file.group': 'File caricato',
  'hash.file.remove': 'Rimuovi il file',
  'hash.upper': 'Esadecimale in maiuscolo',
  'hash.clear': 'Cancella',
  'hash.progress.read': 'Lettura del file… {pct}',
  'hash.progress.hash': 'Calcolo degli hash…',
  'hash.progress.label': 'Avanzamento',
  'hash.cancel': 'Annulla',
  'hash.cancelled': 'Calcolo annullato.',
  'hash.err.toolarge': 'Il file è troppo grande (massimo 2 GB).',
  'hash.err.read': 'Impossibile leggere il file.',
  'hash.err.crypto':
    'Questo browser non mette a disposizione Web Crypto (serve una pagina servita in HTTPS): SHA-1, SHA-384 e SHA-512 non sono calcolabili.',
  'hash.warn.large':
    'File molto grande ({size}): oltre {limit} non si può tenere in memoria, quindi la lettura è a blocchi e si calcolano solo MD5 e SHA-256. SHA-1, SHA-384 e SHA-512 non sono disponibili per questo file.',
  'hash.na': 'Non disponibile per i file oltre {limit}.',
  'hash.results': 'Risultati',
  'hash.hex': 'Esadecimale',
  'hash.b64': 'Base64',
  'hash.copy.hex': 'Copia {algo} in esadecimale',
  'hash.copy.b64': 'Copia {algo} in Base64',
  'hash.insecure': 'Non sicuro per la crittografia: serve solo a controllare l\'integrità di un file, non per firme o password.',
  'hash.md5note':
    'MD5 non esiste in Web Crypto perché è considerato rotto: qui è calcolato in TypeScript e va usato solo per verificare checksum pubblicati da altri.',
  'hash.cmp.label': 'Confronta con un checksum',
  'hash.cmp.ph': 'Incolla qui l\'hash atteso (maiuscole e spazi non contano)',
  'hash.cmp.match': 'Corrisponde a {algo}.',
  'hash.cmp.none': 'Nessuna corrispondenza.',
  'hash.cmp.badge': 'Corrisponde',
  'hash.stats': '{chars} caratteri · {bytes} byte',
  'hash.how.title': 'Come funziona',
  'hash.how.desc':
    'SHA-1, SHA-256, SHA-384 e SHA-512 usano Web Crypto del browser; MD5 e, per i file molto grandi, SHA-256 sono calcolati a blocchi in TypeScript puro (verificati con i vettori ufficiali e con Web Crypto). Un file fino a 500 MB si legge a blocchi con barra di avanzamento e si può annullare.',
};

const en: typeof it = {
  'hash.lead':
    'Compute MD5, SHA-1, SHA-256, SHA-384 and SHA-512 of a text (updated as you type) or of a file up to 2 GB, and compare them with a checksum. The file is never uploaded.',
  'hash.in': 'Text to hash',
  'hash.ph': 'Type or paste a text, or drop a file…',
  'hash.drop': 'Drop a file here to compute its hashes (up to 2 GB), or',
  'hash.file.group': 'Loaded file',
  'hash.file.remove': 'Remove the file',
  'hash.upper': 'Uppercase hex',
  'hash.clear': 'Clear',
  'hash.progress.read': 'Reading the file… {pct}',
  'hash.progress.hash': 'Computing the hashes…',
  'hash.progress.label': 'Progress',
  'hash.cancel': 'Cancel',
  'hash.cancelled': 'Calculation cancelled.',
  'hash.err.toolarge': 'The file is too large (2 GB max).',
  'hash.err.read': 'Could not read the file.',
  'hash.err.crypto':
    'This browser does not provide Web Crypto (the page must be served over HTTPS): SHA-1, SHA-384 and SHA-512 cannot be computed.',
  'hash.warn.large':
    'Very large file ({size}): above {limit} it cannot be held in memory, so it is read in blocks and only MD5 and SHA-256 are computed. SHA-1, SHA-384 and SHA-512 are not available for this file.',
  'hash.na': 'Not available for files over {limit}.',
  'hash.results': 'Results',
  'hash.hex': 'Hex',
  'hash.b64': 'Base64',
  'hash.copy.hex': 'Copy {algo} as hex',
  'hash.copy.b64': 'Copy {algo} as Base64',
  'hash.insecure': 'Not secure for cryptography: only use it to check a file\'s integrity, not for signatures or passwords.',
  'hash.md5note':
    'MD5 is not in Web Crypto because it is considered broken: here it is computed in TypeScript and should only be used to verify checksums published by others.',
  'hash.cmp.label': 'Compare with a checksum',
  'hash.cmp.ph': 'Paste the expected hash here (case and spaces are ignored)',
  'hash.cmp.match': 'Matches {algo}.',
  'hash.cmp.none': 'No match.',
  'hash.cmp.badge': 'Match',
  'hash.stats': '{chars} characters · {bytes} bytes',
  'hash.how.title': 'How it works',
  'hash.how.desc':
    'SHA-1, SHA-256, SHA-384 and SHA-512 use the browser\'s Web Crypto; MD5 and, for very large files, SHA-256 are computed block by block in plain TypeScript (checked against the official test vectors and Web Crypto). A file up to 500 MB is read in blocks with a progress bar and can be cancelled.',
};

export const HASH_DICTIONARIES: ToolDictionaries = { it, en };
