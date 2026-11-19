// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const it = {
  'hmac.lead':
    'Calcola l\'HMAC di un testo o di un file con una chiave segreta (SHA-1, SHA-256, SHA-384, SHA-512) e verifica una firma attesa, per esempio quella di un webhook. La chiave può essere testo, esadecimale o Base64.',
  'hmac.options': 'Impostazioni',
  'hmac.algorithm': 'Algoritmo',
  'hmac.output': 'Formato dell\'uscita',
  'hmac.key': 'Chiave segreta',
  'hmac.key.format': 'Formato della chiave',
  'hmac.key.text': 'Testo',
  'hmac.key.hint': 'La chiave non viene mai inviata né salvata. Una chiave vuota è ammessa (equivale a una chiave di zeri).',
  'hmac.show': 'Mostra',
  'hmac.hide': 'Nascondi',
  'hmac.message': 'Messaggio',
  'hmac.source.text': 'Testo',
  'hmac.source.file': 'File',
  'hmac.file.hint': 'Trascina qui un file oppure sceglilo',
  'hmac.file.none': 'Nessun file scelto',
  'hmac.result': 'HMAC calcolato',
  'hmac.verify.title': 'Verifica una firma',
  'hmac.verify.desc': 'Incolla la firma che ti aspetti (hex, Base64 o Base64url, anche con prefisso come sha256=): il confronto avviene a tempo costante.',
  'hmac.verify.label': 'Firma attesa',
  'hmac.verify.match': 'La firma coincide.',
  'hmac.verify.mismatch': 'La firma non coincide.',
  'hmac.verify.unreadable': 'La firma attesa non è leggibile: usa hex, Base64 o Base64url.',
  'hmac.err.hex': 'La chiave non è esadecimale valida (cifre 0-9 e a-f, in numero pari).',
  'hmac.err.base64': 'La chiave non è Base64 valida.',
  'hmac.err.crypto': 'Questo browser non supporta le funzioni crittografiche necessarie (serve una pagina HTTPS).',
  'hmac.err.size': 'Il file è troppo grande (massimo 200 MB).',
  'hmac.info.how.title': 'Come funziona',
  'hmac.info.how.desc':
    'L\'HMAC (RFC 2104) mescola il messaggio con una chiave segreta usando una funzione di hash: chi non conosce la chiave non può produrre una firma valida né modificare il messaggio senza che si veda.',
  'hmac.info.use.title': 'Dove si usa',
  'hmac.info.use.desc':
    'Firma dei webhook (GitHub, Stripe…), API autenticate, token e cookie firmati. Per le firme dei webhook calcola l\'HMAC sul corpo grezzo, byte per byte.',
  'hmac.info.priv.title': 'Privacy',
  'hmac.info.priv.desc': 'Chiave e messaggio restano nel tuo browser e sono elaborati con WebCrypto: non sono inviati né salvati e non finiscono mai nei link.',
};

const en: typeof it = {
  'hmac.lead':
    'Compute the HMAC of a text or file with a secret key (SHA-1, SHA-256, SHA-384, SHA-512) and verify an expected signature, for example a webhook\'s. The key can be text, hexadecimal or Base64.',
  'hmac.options': 'Settings',
  'hmac.algorithm': 'Algorithm',
  'hmac.output': 'Output format',
  'hmac.key': 'Secret key',
  'hmac.key.format': 'Key format',
  'hmac.key.text': 'Text',
  'hmac.key.hint': 'The key is never sent or stored. An empty key is allowed (it is the same as a key of zeros).',
  'hmac.show': 'Show',
  'hmac.hide': 'Hide',
  'hmac.message': 'Message',
  'hmac.source.text': 'Text',
  'hmac.source.file': 'File',
  'hmac.file.hint': 'Drop a file here or choose one',
  'hmac.file.none': 'No file chosen',
  'hmac.result': 'Computed HMAC',
  'hmac.verify.title': 'Verify a signature',
  'hmac.verify.desc': 'Paste the signature you expect (hex, Base64 or Base64url, a prefix such as sha256= is fine): the comparison is constant-time.',
  'hmac.verify.label': 'Expected signature',
  'hmac.verify.match': 'The signature matches.',
  'hmac.verify.mismatch': 'The signature does not match.',
  'hmac.verify.unreadable': 'The expected signature cannot be read: use hex, Base64 or Base64url.',
  'hmac.err.hex': 'The key is not valid hexadecimal (digits 0-9 and a-f, an even number of them).',
  'hmac.err.base64': 'The key is not valid Base64.',
  'hmac.err.crypto': 'This browser does not support the required cryptographic functions (an HTTPS page is needed).',
  'hmac.err.size': 'The file is too large (200 MB at most).',
  'hmac.info.how.title': 'How it works',
  'hmac.info.how.desc':
    'HMAC (RFC 2104) mixes the message with a secret key using a hash function: whoever does not know the key cannot produce a valid signature nor change the message unnoticed.',
  'hmac.info.use.title': 'Where it is used',
  'hmac.info.use.desc':
    'Webhook signatures (GitHub, Stripe…), authenticated APIs, signed tokens and cookies. For webhook signatures compute the HMAC over the raw body, byte for byte.',
  'hmac.info.priv.title': 'Privacy',
  'hmac.info.priv.desc': 'Key and message stay in your browser and are processed with WebCrypto: they are neither sent nor stored and never end up in links.',
};

export const HMAC_DICTIONARIES: ToolDictionaries = { it, en };
