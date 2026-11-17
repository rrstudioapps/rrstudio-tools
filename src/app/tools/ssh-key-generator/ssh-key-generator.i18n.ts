// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

const it = {
  'ssh.lead':
    'Genera una coppia di chiavi SSH nel browser: Ed25519 oppure RSA 2048, 3072 o 4096 bit. Ottieni la chiave pubblica nel formato di authorized_keys, la privata in formato OpenSSH o PKCS#8 e l\'impronta SHA256 come la mostra ssh-keygen -l.',
  'ssh.options': 'Impostazioni',
  'ssh.type': 'Tipo di chiave',
  'ssh.noEd': 'Questo browser non sa generare chiavi Ed25519 con WebCrypto: sono disponibili solo le chiavi RSA.',
  'ssh.comment': 'Commento (facoltativo)',
  'ssh.comment.ph': 'es. mario@portatile',
  'ssh.generate': 'Genera la coppia di chiavi',
  'ssh.clear': 'Cancella',
  'ssh.hint': 'Ed25519 è la scelta consigliata: chiavi corte e veloci. RSA serve solo per sistemi più vecchi; 4096 bit può richiedere alcuni secondi.',
  'ssh.busy': 'Generazione in corso…',
  'ssh.empty': 'Scegli il tipo di chiave e premi il pulsante per generare la coppia.',
  'ssh.fingerprint': 'Impronta (fingerprint)',
  'ssh.bits.ed': 'Ed25519, {bits} bit',
  'ssh.bits.rsa': 'RSA, {bits} bit',
  'ssh.public': 'Chiave pubblica',
  'ssh.public.desc': 'Una sola riga: incollala in ~/.ssh/authorized_keys sul server o nelle impostazioni del servizio (GitHub, GitLab…).',
  'ssh.private': 'Chiave privata',
  'ssh.private.warn': 'La chiave privata è mostrata NON cifrata: chiunque la copi può accedere ai server che accettano la chiave pubblica. Non condividerla, non incollarla in chat o ticket e, se la salvi, proteggi il file (chmod 600).',
  'ssh.openssh': 'Formato OpenSSH (BEGIN OPENSSH PRIVATE KEY)',
  'ssh.pkcs8': 'Formato PKCS#8 (BEGIN PRIVATE KEY)',
  'ssh.passphrase':
    'Non è possibile proteggere la chiave con una passphrase qui: il formato OpenSSH cifrato richiede bcrypt_pbkdf, che il browser non offre e che non aggiungiamo come dipendenza. Aggiungila dopo, in locale, con ssh-keygen -p -f nome_file.',
  'ssh.err.generate': 'Non è stato possibile generare la chiave con questo browser.',
  'ssh.info.use.title': 'Come si usa',
  'ssh.info.use.desc':
    'Salva la privata come ~/.ssh/id_ed25519 (o id_rsa) con permessi 600 e la pubblica accanto come .pub; poi copia la riga pubblica sul server o nel servizio che vuoi usare.',
  'ssh.info.which.title': 'Ed25519 o RSA',
  'ssh.info.which.desc':
    'Ed25519 è moderno, veloce e con chiavi brevi, supportato da OpenSSH da anni. RSA da almeno 3072 bit resta utile per software molto datato.',
  'ssh.info.priv.title': 'Privacy',
  'ssh.info.priv.desc':
    'Le chiavi sono create nel tuo browser con WebCrypto e non vengono mai inviate, salvate né messe in un link. Chiudendo la pagina spariscono: scaricale se ti servono.',
};

const en: typeof it = {
  'ssh.lead':
    'Generate an SSH key pair in your browser: Ed25519 or RSA 2048, 3072 or 4096 bits. You get the public key in authorized_keys format, the private key in OpenSSH or PKCS#8 format and the SHA256 fingerprint as ssh-keygen -l shows it.',
  'ssh.options': 'Settings',
  'ssh.type': 'Key type',
  'ssh.noEd': 'This browser cannot generate Ed25519 keys with WebCrypto: only RSA keys are available.',
  'ssh.comment': 'Comment (optional)',
  'ssh.comment.ph': 'e.g. mario@laptop',
  'ssh.generate': 'Generate the key pair',
  'ssh.clear': 'Clear',
  'ssh.hint': 'Ed25519 is the recommended choice: short, fast keys. RSA is only for older systems; 4096 bits can take a few seconds.',
  'ssh.busy': 'Generating…',
  'ssh.empty': 'Pick the key type and press the button to generate the pair.',
  'ssh.fingerprint': 'Fingerprint',
  'ssh.bits.ed': 'Ed25519, {bits} bits',
  'ssh.bits.rsa': 'RSA, {bits} bits',
  'ssh.public': 'Public key',
  'ssh.public.desc': 'A single line: paste it into ~/.ssh/authorized_keys on the server or into the service settings (GitHub, GitLab…).',
  'ssh.private': 'Private key',
  'ssh.private.warn': 'The private key is shown UNENCRYPTED: anyone who copies it can log in to the servers that accept the public key. Do not share it, do not paste it into chats or tickets and, if you save it, protect the file (chmod 600).',
  'ssh.openssh': 'OpenSSH format (BEGIN OPENSSH PRIVATE KEY)',
  'ssh.pkcs8': 'PKCS#8 format (BEGIN PRIVATE KEY)',
  'ssh.passphrase':
    'Protecting the key with a passphrase is not possible here: the encrypted OpenSSH format needs bcrypt_pbkdf, which the browser does not offer and which we do not add as a dependency. Add one afterwards, locally, with ssh-keygen -p -f file_name.',
  'ssh.err.generate': 'The key could not be generated with this browser.',
  'ssh.info.use.title': 'How to use it',
  'ssh.info.use.desc':
    'Save the private key as ~/.ssh/id_ed25519 (or id_rsa) with permissions 600 and the public one next to it as .pub; then copy the public line to the server or service you want to use.',
  'ssh.info.which.title': 'Ed25519 or RSA',
  'ssh.info.which.desc':
    'Ed25519 is modern, fast and has short keys, supported by OpenSSH for years. RSA of at least 3072 bits is still useful for very old software.',
  'ssh.info.priv.title': 'Privacy',
  'ssh.info.priv.desc':
    'Keys are created in your browser with WebCrypto and are never sent, stored or put in a link. They disappear when you close the page: download them if you need them.',
};

export const SSH_DICTIONARIES: ToolDictionaries = { it, en };
