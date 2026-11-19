// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const it = {
  'sss.lead':
    'Dividi un segreto (una password, una frase di recupero, una chiave) in più parti da affidare a persone o luoghi diversi: ne bastano K su N per ricostruirlo, con meno di K non si ricava nulla. È la condivisione di segreti di Shamir su GF(256).',
  'sss.mode': 'Operazione',
  'sss.mode.split': 'Dividi',
  'sss.mode.combine': 'Ricostruisci',
  'sss.secret': 'Segreto da dividere',
  'sss.secret.meta': '{n} / {max} byte',
  'sss.total': 'Parti totali (N, 2-255)',
  'sss.threshold': 'Parti necessarie (K)',
  'sss.format': 'Formato delle parti',
  'sss.hint': 'Le parti dipendono da numeri casuali: dividendo due volte lo stesso segreto si ottengono parti diverse e non combinabili tra loro. Il segreto è trattato come testo UTF-8.',
  'sss.split': 'Dividi il segreto',
  'sss.clear': 'Cancella',
  'sss.shares': 'Parti',
  'sss.split.summary': 'Il segreto è stato diviso in {n} parti: ne servono {k} per ricostruirlo.',
  'sss.shares.warn': 'Ogni parte va tenuta separata dalle altre: chi ne riunisce K ottiene il segreto. Non conservarle tutte nello stesso posto.',
  'sss.share.n': 'Parte {i} di {n}',
  'sss.downloadAll': 'Scarica tutte (un file per parte)',
  'sss.copyAll': 'Copia tutte le parti',
  'sss.print': 'Stampa le parti',
  'sss.paste': 'Parti (una per riga)',
  'sss.paste.ph': 'S1H-3-5-1-…\nS1H-3-5-4-…\nS1H-3-5-5-…',
  'sss.combine.ok': 'Segreto ricostruito con {n} parti.',
  'sss.result': 'Segreto ricostruito',
  'sss.err.params': 'Servono almeno 2 parti totali (massimo 255) e una soglia tra 2 e il numero di parti.',
  'sss.err.empty': 'Scrivi il segreto da dividere.',
  'sss.err.too-long': 'Il segreto è troppo lungo (massimo 16 KiB).',
  'sss.err.format': 'Una parte non è valida (riga {line}): deve avere la forma S1H-K-N-indice-dati oppure S1B-K-N-indice-dati.',
  'sss.err.too-few': 'Parti insufficienti: ne hai {have}, ne servono {need}.',
  'sss.err.inconsistent': 'Le parti non sono coerenti: provengono da divisioni diverse (soglia, numero di parti o lunghezza non coincidono).',
  'sss.err.duplicate': 'La parte {index} è presente più volte: servono parti diverse.',
  'sss.err.checksum': 'Le parti non ricostruiscono un segreto valido: una è sbagliata, alterata o appartiene a un altro segreto.',
  'sss.err.crypto': 'Questo browser non offre un generatore di numeri casuali sicuro (serve una pagina HTTPS).',
  'sss.err.utf8': 'Il segreto ricostruito non è testo UTF-8 valido.',
  'sss.info.how.title': 'Come funziona',
  'sss.info.how.desc':
    'Per ogni byte del segreto si sceglie un polinomio casuale di grado K-1 sul campo GF(256) che ha il byte come termine noto; ogni parte contiene i valori dei polinomi in un punto. Con K punti il polinomio si ricostruisce per interpolazione, con K-1 qualunque segreto resta possibile.',
  'sss.info.use.title': 'A cosa serve',
  'sss.info.use.desc':
    'Per custodire frasi di recupero, chiavi o password importanti senza un unico punto di rottura: per esempio 3 parti su 5 affidate a persone di fiducia. Alla fine della divisione viene aggiunto un controllo (CRC-32) che permette di accorgersi di parti errate.',
  'sss.info.priv.title': 'Privacy',
  'sss.info.priv.desc':
    'Segreto e parti sono calcolati nel tuo browser con numeri casuali di crypto.getRandomValues: non sono inviati, salvati né messi in un link. Chiudendo la pagina spariscono.',
};

const en: typeof it = {
  'sss.lead':
    'Split a secret (a password, a recovery phrase, a key) into several shares to give to different people or places: any K out of N rebuild it, fewer than K reveal nothing. It is Shamir secret sharing over GF(256).',
  'sss.mode': 'Operation',
  'sss.mode.split': 'Split',
  'sss.mode.combine': 'Combine',
  'sss.secret': 'Secret to split',
  'sss.secret.meta': '{n} / {max} bytes',
  'sss.total': 'Total shares (N, 2-255)',
  'sss.threshold': 'Shares needed (K)',
  'sss.format': 'Share format',
  'sss.hint': 'Shares depend on random numbers: splitting the same secret twice gives different shares that cannot be mixed. The secret is treated as UTF-8 text.',
  'sss.split': 'Split the secret',
  'sss.clear': 'Clear',
  'sss.shares': 'Shares',
  'sss.split.summary': 'The secret was split into {n} shares: {k} are needed to rebuild it.',
  'sss.shares.warn': 'Keep each share apart from the others: whoever gathers K of them gets the secret. Do not store them all in the same place.',
  'sss.share.n': 'Share {i} of {n}',
  'sss.downloadAll': 'Download all (one file per share)',
  'sss.copyAll': 'Copy all shares',
  'sss.print': 'Print the shares',
  'sss.paste': 'Shares (one per line)',
  'sss.paste.ph': 'S1H-3-5-1-…\nS1H-3-5-4-…\nS1H-3-5-5-…',
  'sss.combine.ok': 'Secret rebuilt from {n} shares.',
  'sss.result': 'Rebuilt secret',
  'sss.err.params': 'At least 2 shares in total (255 at most) and a threshold between 2 and the number of shares are required.',
  'sss.err.empty': 'Type the secret to split.',
  'sss.err.too-long': 'The secret is too long (16 KiB at most).',
  'sss.err.format': 'A share is not valid (line {line}): it must look like S1H-K-N-index-data or S1B-K-N-index-data.',
  'sss.err.too-few': 'Not enough shares: you have {have}, {need} are needed.',
  'sss.err.inconsistent': 'The shares are not consistent: they come from different splits (threshold, share count or length do not match).',
  'sss.err.duplicate': 'Share {index} appears more than once: different shares are needed.',
  'sss.err.checksum': 'The shares do not rebuild a valid secret: one is wrong, altered or belongs to another secret.',
  'sss.err.crypto': 'This browser offers no secure random number generator (an HTTPS page is needed).',
  'sss.err.utf8': 'The rebuilt secret is not valid UTF-8 text.',
  'sss.info.how.title': 'How it works',
  'sss.info.how.desc':
    'For every byte of the secret a random polynomial of degree K-1 over the field GF(256) is chosen with the byte as its constant term; each share holds the polynomials\' values at one point. With K points the polynomial is rebuilt by interpolation, with K-1 every secret stays possible.',
  'sss.info.use.title': 'What it is for',
  'sss.info.use.desc':
    'To safeguard recovery phrases, keys or important passwords without a single point of failure: for example 3 shares out of 5 given to trusted people. A check (CRC-32) is added before splitting so wrong shares can be noticed.',
  'sss.info.priv.title': 'Privacy',
  'sss.info.priv.desc':
    'Secret and shares are computed in your browser with random numbers from crypto.getRandomValues: they are not sent, stored or put in a link. They disappear when you close the page.',
};

export const SHAMIR_DICTIONARIES: ToolDictionaries = { it, en };
