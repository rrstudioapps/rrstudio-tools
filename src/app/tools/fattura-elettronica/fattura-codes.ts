// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Tabelle dei codici della fattura elettronica, con descrizione in italiano e inglese.
 * Fonte: specifiche tecniche pubbliche del formato FatturaPA (Agenzia delle Entrate), versione 1.9,
 * Allegato A "Rappresentazione tabellare del tracciato" (valori ammessi dei campi codificati).
 * Un codice sconosciuto non è un errore: si mostra com'è, senza descrizione.
 */
export type CodeTable = Record<string, { it: string; en: string }>;

export const TIPO_DOCUMENTO: CodeTable = {
  TD01: { it: 'Fattura', en: 'Invoice' },
  TD02: { it: 'Acconto/anticipo su fattura', en: 'Advance/down payment on invoice' },
  TD03: { it: 'Acconto/anticipo su parcella', en: 'Advance/down payment on fee note' },
  TD04: { it: 'Nota di credito', en: 'Credit note' },
  TD05: { it: 'Nota di debito', en: 'Debit note' },
  TD06: { it: 'Parcella', en: 'Fee note' },
  TD07: { it: 'Fattura semplificata', en: 'Simplified invoice' },
  TD08: { it: 'Nota di credito semplificata', en: 'Simplified credit note' },
  TD09: { it: 'Nota di debito semplificata', en: 'Simplified debit note' },
  TD16: { it: 'Integrazione fattura reverse charge interno', en: 'Domestic reverse charge invoice integration' },
  TD17: { it: 'Integrazione/autofattura per acquisto servizi dall\'estero', en: 'Integration/self-invoice for services purchased from abroad' },
  TD18: { it: 'Integrazione per acquisto di beni intracomunitari', en: 'Integration for intra-EU purchase of goods' },
  TD19: { it: 'Integrazione/autofattura per acquisto di beni ex art. 17 c.2 DPR 633/72', en: 'Integration/self-invoice for goods purchase under art. 17(2) DPR 633/72' },
  TD20: { it: 'Autofattura per regolarizzazione e integrazione delle fatture', en: 'Self-invoice to regularise and integrate invoices' },
  TD21: { it: 'Autofattura per splafonamento', en: 'Self-invoice for ceiling excess' },
  TD22: { it: 'Estrazione beni da Deposito IVA', en: 'Extraction of goods from VAT warehouse' },
  TD23: { it: 'Estrazione beni da Deposito IVA con versamento IVA', en: 'Extraction of goods from VAT warehouse with VAT payment' },
  TD24: { it: 'Fattura differita (art. 21 c.4 lett. a)', en: 'Deferred invoice (art. 21(4)(a))' },
  TD25: { it: 'Fattura differita (art. 21 c.4 terzo periodo lett. b)', en: 'Deferred invoice (art. 21(4) third sentence (b))' },
  TD26: { it: 'Cessione di beni ammortizzabili e passaggi interni', en: 'Sale of depreciable assets and internal transfers' },
  TD27: { it: 'Fattura per autoconsumo o per cessioni gratuite senza rivalsa', en: 'Invoice for self-consumption or free transfers without recharge' },
  TD28: { it: 'Acquisti da San Marino con IVA (fattura cartacea)', en: 'Purchases from San Marino with VAT (paper invoice)' },
  TD29: { it: 'Comunicazione per omessa o irregolare fatturazione', en: 'Communication for omitted or irregular invoicing' },
};

export const NATURA: CodeTable = {
  N1: { it: 'Escluse ex art. 15', en: 'Excluded under art. 15' },
  'N2.1': { it: 'Non soggette ad IVA - artt. da 7 a 7-septies DPR 633/72', en: 'Outside VAT scope - arts. 7 to 7-septies DPR 633/72' },
  'N2.2': { it: 'Non soggette - altri casi', en: 'Not subject - other cases' },
  N2: { it: 'Non soggette', en: 'Not subject' },
  'N3.1': { it: 'Non imponibili - esportazioni', en: 'Not taxable - exports' },
  'N3.2': { it: 'Non imponibili - cessioni intracomunitarie', en: 'Not taxable - intra-EU supplies' },
  'N3.3': { it: 'Non imponibili - cessioni verso San Marino', en: 'Not taxable - supplies to San Marino' },
  'N3.4': { it: 'Non imponibili - operazioni assimilate alle cessioni all\'esportazione', en: 'Not taxable - operations treated as exports' },
  'N3.5': { it: 'Non imponibili - a seguito di dichiarazioni d\'intento', en: 'Not taxable - following declarations of intent' },
  'N3.6': { it: 'Non imponibili - altre operazioni che non concorrono alla formazione del plafond', en: 'Not taxable - other operations not counting towards the ceiling' },
  N3: { it: 'Non imponibili', en: 'Not taxable' },
  N4: { it: 'Esenti', en: 'Exempt' },
  N5: { it: 'Regime del margine / IVA non esposta in fattura', en: 'Margin scheme / VAT not shown on the invoice' },
  'N6.1': { it: 'Inversione contabile - cessione di rottami e materiali di recupero', en: 'Reverse charge - scrap and recovered materials' },
  'N6.2': { it: 'Inversione contabile - cessione di oro e argento puro', en: 'Reverse charge - pure gold and silver' },
  'N6.3': { it: 'Inversione contabile - subappalto nel settore edile', en: 'Reverse charge - construction subcontracting' },
  'N6.4': { it: 'Inversione contabile - cessione di fabbricati', en: 'Reverse charge - sale of buildings' },
  'N6.5': { it: 'Inversione contabile - cessione di telefoni cellulari', en: 'Reverse charge - mobile phones' },
  'N6.6': { it: 'Inversione contabile - cessione di prodotti elettronici', en: 'Reverse charge - electronic products' },
  'N6.7': { it: 'Inversione contabile - prestazioni comparto edile e settori connessi', en: 'Reverse charge - construction and related services' },
  'N6.8': { it: 'Inversione contabile - operazioni settore energetico', en: 'Reverse charge - energy sector operations' },
  'N6.9': { it: 'Inversione contabile - altri casi', en: 'Reverse charge - other cases' },
  N6: { it: 'Inversione contabile', en: 'Reverse charge' },
  'N7': { it: 'IVA assolta in altro stato UE (vendite a distanza, servizi di telecomunicazione, teleradiodiffusione ed elettronici)', en: 'VAT paid in another EU state (distance sales, telecommunication, broadcasting and electronic services)' },
};

export const MODALITA_PAGAMENTO: CodeTable = {
  MP01: { it: 'Contanti', en: 'Cash' },
  MP02: { it: 'Assegno', en: 'Cheque' },
  MP03: { it: 'Assegno circolare', en: 'Banker\'s draft' },
  MP04: { it: 'Contanti presso Tesoreria', en: 'Cash at Treasury' },
  MP05: { it: 'Bonifico', en: 'Bank transfer' },
  MP06: { it: 'Vaglia cambiario', en: 'Promissory note' },
  MP07: { it: 'Bollettino bancario', en: 'Bank bulletin' },
  MP08: { it: 'Carta di pagamento', en: 'Payment card' },
  MP09: { it: 'RID', en: 'Direct debit (RID)' },
  MP10: { it: 'RID utenze', en: 'Direct debit for utilities' },
  MP11: { it: 'RID veloce', en: 'Fast direct debit' },
  MP12: { it: 'RIBA', en: 'Bank receipt (RIBA)' },
  MP13: { it: 'MAV', en: 'Payment by notice (MAV)' },
  MP14: { it: 'Quietanza erario', en: 'Treasury receipt' },
  MP15: { it: 'Giroconto su conti di contabilità speciale', en: 'Transfer to special accounting accounts' },
  MP16: { it: 'Domiciliazione bancaria', en: 'Bank domiciliation' },
  MP17: { it: 'Domiciliazione postale', en: 'Postal domiciliation' },
  MP18: { it: 'Bollettino di c/c postale', en: 'Postal current account slip' },
  MP19: { it: 'SEPA Direct Debit', en: 'SEPA Direct Debit' },
  MP20: { it: 'SEPA Direct Debit CORE', en: 'SEPA Direct Debit CORE' },
  MP21: { it: 'SEPA Direct Debit B2B', en: 'SEPA Direct Debit B2B' },
  MP22: { it: 'Trattenuta su somme già riscosse', en: 'Deduction from sums already collected' },
  MP23: { it: 'PagoPA', en: 'PagoPA' },
};

export const CONDIZIONI_PAGAMENTO: CodeTable = {
  TP01: { it: 'Pagamento a rate', en: 'Payment in instalments' },
  TP02: { it: 'Pagamento completo', en: 'Full payment' },
  TP03: { it: 'Anticipo', en: 'Advance payment' },
};

export const REGIME_FISCALE: CodeTable = {
  RF01: { it: 'Ordinario', en: 'Ordinary' },
  RF02: { it: 'Contribuenti minimi', en: 'Minimum taxpayers' },
  RF04: { it: 'Agricoltura e attività connesse e pesca', en: 'Agriculture, related activities and fishing' },
  RF05: { it: 'Vendita sali e tabacchi', en: 'Sale of salt and tobacco' },
  RF06: { it: 'Vendita fiammiferi', en: 'Matches trade' },
  RF07: { it: 'Editoria', en: 'Publishing' },
  RF08: { it: 'Gestione servizi telefonia pubblica', en: 'Public telephony services' },
  RF09: { it: 'Rivendita documenti di trasporto pubblico e di sosta', en: 'Resale of public transport and parking tickets' },
  RF10: { it: 'Intrattenimenti, giochi e altre attività', en: 'Entertainment, games and other activities' },
  RF11: { it: 'Agenzie viaggi e turismo', en: 'Travel agencies' },
  RF12: { it: 'Agriturismo', en: 'Farm holidays' },
  RF13: { it: 'Vendite a domicilio', en: 'Door-to-door sales' },
  RF14: { it: 'Rivendita beni usati, oggetti d\'arte, antiquariato', en: 'Resale of used goods, art and antiques' },
  RF15: { it: 'Agenzie di vendite all\'asta', en: 'Auction agencies' },
  RF16: { it: 'IVA per cassa P.A.', en: 'Cash-basis VAT (public bodies)' },
  RF17: { it: 'IVA per cassa', en: 'Cash-basis VAT' },
  RF18: { it: 'Altro', en: 'Other' },
  RF19: { it: 'Forfettario', en: 'Flat-rate regime' },
  RF20: { it: 'Transfrontaliero (regime di franchigia IVA)', en: 'Cross-border (VAT exemption scheme)' },
};

export const TIPO_CASSA: CodeTable = {
  TC01: { it: 'Cassa nazionale previdenza e assistenza avvocati e procuratori legali', en: 'National pension fund for lawyers' },
  TC02: { it: 'Cassa previdenza dottori commercialisti', en: 'Pension fund for chartered accountants' },
  TC03: { it: 'Cassa previdenza e assistenza geometri', en: 'Pension fund for surveyors' },
  TC04: { it: 'Cassa nazionale previdenza e assistenza ingegneri e architetti liberi professionisti', en: 'National pension fund for engineers and architects' },
  TC05: { it: 'Cassa nazionale del notariato', en: 'National notaries fund' },
  TC06: { it: 'Cassa nazionale previdenza e assistenza ragionieri e periti commerciali', en: 'National pension fund for accountants and commercial experts' },
  TC07: { it: 'Ente nazionale assistenza agenti e rappresentanti di commercio (ENASARCO)', en: 'National agents and sales representatives fund (ENASARCO)' },
  TC08: { it: 'Ente nazionale previdenza e assistenza consulenti del lavoro (ENPACL)', en: 'National pension fund for employment consultants (ENPACL)' },
  TC09: { it: 'Ente nazionale previdenza e assistenza medici (ENPAM)', en: 'National pension fund for doctors (ENPAM)' },
  TC10: { it: 'Ente nazionale previdenza e assistenza farmacisti (ENPAF)', en: 'National pension fund for pharmacists (ENPAF)' },
  TC11: { it: 'Ente nazionale previdenza e assistenza veterinari (ENPAV)', en: 'National pension fund for veterinarians (ENPAV)' },
  TC12: { it: 'Ente nazionale previdenza e assistenza impiegati dell\'agricoltura (ENPAIA)', en: 'National pension fund for agricultural employees (ENPAIA)' },
  TC13: { it: 'Fondo previdenza impiegati imprese di spedizione e agenzie marittime', en: 'Pension fund for shipping and maritime agency employees' },
  TC14: { it: 'Istituto nazionale previdenza giornalisti italiani (INPGI)', en: 'National pension institute for journalists (INPGI)' },
  TC15: { it: 'Opera nazionale assistenza orfani sanitari italiani (ONAOSI)', en: 'National aid for orphans of Italian health workers (ONAOSI)' },
  TC16: { it: 'Cassa autonoma assistenza integrativa giornalisti italiani (CASAGIT)', en: 'Supplementary aid fund for journalists (CASAGIT)' },
  TC17: { it: 'Ente previdenza periti industriali e periti industriali laureati (EPPI)', en: 'Pension fund for industrial experts (EPPI)' },
  TC18: { it: 'Ente previdenza e assistenza pluricategoriale (EPAP)', en: 'Multi-category pension and aid fund (EPAP)' },
  TC19: { it: 'Ente nazionale previdenza e assistenza biologi (ENPAB)', en: 'National pension fund for biologists (ENPAB)' },
  TC20: { it: 'Ente nazionale previdenza e assistenza professione infermieristica (ENPAPI)', en: 'National pension fund for nurses (ENPAPI)' },
  TC21: { it: 'Ente nazionale previdenza e assistenza psicologi (ENPAP)', en: 'National pension fund for psychologists (ENPAP)' },
  TC22: { it: 'INPS', en: 'INPS (national social security)' },
};

export const TIPO_RITENUTA: CodeTable = {
  RT01: { it: 'Ritenuta di persone fisiche', en: 'Withholding on natural persons' },
  RT02: { it: 'Ritenuta di persone giuridiche', en: 'Withholding on legal entities' },
  RT03: { it: 'Contributo INPS', en: 'INPS contribution' },
  RT04: { it: 'Contributo ENASARCO', en: 'ENASARCO contribution' },
  RT05: { it: 'Contributo ENPAM', en: 'ENPAM contribution' },
  RT06: { it: 'Altro contributo previdenziale', en: 'Other social security contribution' },
};

export const ESIGIBILITA_IVA: CodeTable = {
  I: { it: 'Esigibilità immediata', en: 'Immediate VAT due' },
  D: { it: 'Esigibilità differita', en: 'Deferred VAT due' },
  S: { it: 'Scissione dei pagamenti (split payment)', en: 'Split payment' },
};

export const SOGGETTO_EMITTENTE: CodeTable = {
  CC: { it: 'Cessionario/committente', en: 'Customer' },
  TZ: { it: 'Terzo', en: 'Third party' },
};

export const TIPO_SCONTO: CodeTable = {
  SC: { it: 'Sconto', en: 'Discount' },
  MG: { it: 'Maggiorazione', en: 'Surcharge' },
};

export const FORMATI: Record<string, { it: string; en: string }> = {
  FPR12: { it: 'Fattura tra privati (FPR12)', en: 'Invoice between private parties (FPR12)' },
  FPA12: { it: 'Fattura verso la Pubblica Amministrazione (FPA12)', en: 'Invoice to a public body (FPA12)' },
  FSM10: { it: 'Fattura semplificata (FSM10)', en: 'Simplified invoice (FSM10)' },
};

/** Descrizione di un codice nella lingua data; stringa vuota se il codice non è in tabella. */
export function describeCode(table: CodeTable, code: string, lang: 'it' | 'en'): string {
  return table[code.trim().toUpperCase()]?.[lang] ?? '';
}
