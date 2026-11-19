// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { ToolDictionaries } from '../../core/i18n/i18n.service';

/** Strumento solo italiano: la versione inglese esiste per completezza del tipo, ma non viene mai mostrata. */
const it = {
  'mutuo.lead':
    'Calcola la rata di un mutuo o di un prestito con ammortamento alla francese (rata costante): rata, totale degli interessi e piano di ammortamento completo, da esportare in CSV.',
  'mutuo.disclaimer':
    'Calcolo indicativo: considera solo capitale e TAN, senza spese di istruttoria, assicurazioni o imposte, e non è il TAEG. Il tasso periodico è proporzionale (TAN diviso il numero di rate all\'anno), come nei piani delle banche italiane.',
  'mutuo.capital': 'Capitale (€)',
  'mutuo.capital.ph': 'Per esempio 150.000',
  'mutuo.capital.err': 'Scrivi un capitale valido, maggiore di zero.',
  'mutuo.tan': 'TAN (% annuo)',
  'mutuo.tan.err': 'Scrivi un TAN valido tra 0 e 100, per esempio 3,25.',
  'mutuo.duration': 'Durata',
  'mutuo.years': 'Anni',
  'mutuo.months': 'Mesi',
  'mutuo.duration.err': 'La durata deve essere maggiore di zero e al massimo 50 anni.',
  'mutuo.multiple.err': 'La durata deve essere un multiplo del periodo tra le rate: scegli anni e mesi compatibili.',
  'mutuo.period': 'Periodicità delle rate',
  'mutuo.period.monthly': 'Mensile',
  'mutuo.period.quarterly': 'Trimestrale',
  'mutuo.period.semiannual': 'Semestrale',
  'mutuo.result': 'Risultato',
  'mutuo.summary': 'Riepilogo',
  'mutuo.payment': 'Rata',
  'mutuo.interest': 'Totale interessi',
  'mutuo.total': 'Totale da rimborsare',
  'mutuo.count': 'Numero di rate',
  'mutuo.rate': 'Tasso per rata',
  'mutuo.empty': 'Inserisci capitale, TAN e durata per vedere la rata.',
  'mutuo.plan': 'Piano di ammortamento',
  'mutuo.csv': 'Scarica CSV',
  'mutuo.col.n': 'N.',
  'mutuo.col.payment': 'Rata',
  'mutuo.col.interest': 'Quota interessi',
  'mutuo.col.principal': 'Quota capitale',
  'mutuo.col.balance': 'Debito residuo',
  'mutuo.page': 'Rate {from}-{to} di {total}',
  'mutuo.prev': 'Precedente',
  'mutuo.next': 'Successiva',
  'mutuo.lastNote': 'L\'ultima rata può differire di qualche centesimo per chiudere il debito a zero.',
};

const en: typeof it = {
  // Strumento solo italiano (italyOnly): nessuna pagina /en/. Le stesse stringhe, per completezza del tipo.
  ...it,
};

export const MUTUO_DICTIONARIES: ToolDictionaries = { it, en };
