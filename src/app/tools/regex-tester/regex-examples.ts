// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

export interface RegexExample {
  id: string;
  name: { it: string; en: string };
  pattern: string;
  flags: string;
  /** Testo di prova con dati inventati. */
  text: string;
  replacement: string;
}

/** Libreria di esempi. Gli indirizzi e i codici nei testi sono inventati. */
export const EXAMPLES: readonly RegexExample[] = [
  {
    id: 'email',
    name: { it: 'Indirizzo email', en: 'Email address' },
    pattern: String.raw`[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}`,
    flags: 'g',
    text: 'Scrivi a mario.rossi@example.com oppure a info+ordini@esempio.it.\nNon valido: nome@, @dominio.it',
    replacement: '<$&>',
  },
  {
    id: 'url',
    name: { it: 'URL http/https', en: 'http/https URL' },
    pattern: String.raw`https?:\/\/(?<host>[\w.-]+)(?::\d+)?(?<path>\/[^\s?#]*)?(?:\?[^\s#]*)?(?:#\S*)?`,
    flags: 'gi',
    text: 'Visita https://www.example.com/guida/avvio?lingua=it#intro o http://localhost:8080/api.\nSolo host: https://example.org',
    replacement: '[$<host>]',
  },
  {
    id: 'date',
    name: { it: 'Data gg/mm/aaaa', en: 'Date dd/mm/yyyy' },
    pattern: String.raw`\b(?<giorno>0[1-9]|[12]\d|3[01])[\/.-](?<mese>0[1-9]|1[0-2])[\/.-](?<anno>\d{4})\b`,
    flags: 'g',
    text: 'Consegna il 05/03/2026, ritiro il 17-11-2027; errata: 31/13/2026.',
    replacement: '$<anno>-$<mese>-$<giorno>',
  },
  {
    id: 'cap',
    name: { it: 'CAP italiano', en: 'Italian postal code (CAP)' },
    pattern: String.raw`\b\d{5}\b`,
    flags: 'g',
    text: 'Via Esempio 12, 00100 Roma. Via Prova 3, 20100 Milano. Codice 1234 non è un CAP.',
    replacement: '[$&]',
  },
  {
    id: 'cf',
    name: { it: 'Codice fiscale', en: 'Italian tax code (codice fiscale)' },
    pattern: String.raw`\b[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]\b`,
    flags: 'g',
    text: 'Titolare: RSSMRA85T10A562S (esempio inventato). Non valido: ABC123.',
    replacement: '***',
  },
  {
    id: 'iban',
    name: { it: 'IBAN italiano', en: 'Italian IBAN' },
    pattern: String.raw`\bIT\d{2}[A-Z]\d{10}[A-Z0-9]{12}\b`,
    flags: 'g',
    text: 'Bonifico a IT60X0542811101000000123456 intestato a Esempio Srl.',
    replacement: 'IT** **** ****',
  },
];
