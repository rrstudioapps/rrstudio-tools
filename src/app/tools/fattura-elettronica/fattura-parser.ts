// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Lettura di una fattura elettronica FatturaPA (FPR12, FPA12, FSM10) in un modello semplice da mostrare. */

export type FatturaErrorCode = 'invalidXml' | 'notFattura';

export class FatturaError extends Error {
  constructor(readonly code: FatturaErrorCode) {
    super(code);
  }
}

export interface Address {
  indirizzo: string;
  civico: string;
  cap: string;
  comune: string;
  provincia: string;
  nazione: string;
}

export interface Party {
  denominazione: string;
  nome: string;
  cognome: string;
  titolo: string;
  codiceEori: string;
  idPaese: string;
  partitaIva: string;
  codiceFiscale: string;
  regimeFiscale: string;
  sede: Address | null;
  telefono: string;
  email: string;
  /** REA: ufficio, numero, stato di liquidazione. */
  rea: string;
}

export interface Trasmissione {
  idPaese: string;
  idCodice: string;
  progressivo: string;
  formato: string;
  codiceDestinatario: string;
  pecDestinatario: string;
}

export interface Header {
  trasmissione: Trasmissione;
  cedente: Party;
  rappresentante: Party | null;
  cessionario: Party;
  terzo: Party | null;
  soggettoEmittente: string;
}

export interface Ritenuta {
  tipo: string;
  importo: string;
  aliquota: string;
  causale: string;
}

export interface Cassa {
  tipo: string;
  aliquota: string;
  importo: string;
  imponibile: string;
  aliquotaIva: string;
  ritenuta: string;
  natura: string;
  riferimentoAmministrazione: string;
}

export interface ScontoMaggiorazione {
  tipo: string;
  percentuale: string;
  importo: string;
}

export interface DocRef {
  id: string;
  data: string;
  numItem: string;
  cup: string;
  cig: string;
  codiceCommessa: string;
  righe: string;
}

export interface Ddt {
  numero: string;
  data: string;
  righe: string;
}

export interface Riga {
  numero: string;
  descrizione: string;
  quantita: string;
  unitaMisura: string;
  dataInizio: string;
  dataFine: string;
  prezzoUnitario: string;
  sconti: ScontoMaggiorazione[];
  prezzoTotale: string;
  aliquotaIva: string;
  ritenuta: string;
  natura: string;
  riferimentoAmministrazione: string;
  codici: { tipo: string; valore: string }[];
  altriDati: { tipo: string; testo: string; numero: string; data: string }[];
}

export interface Riepilogo {
  aliquota: string;
  natura: string;
  speseAccessorie: string;
  arrotondamento: string;
  imponibile: string;
  imposta: string;
  esigibilita: string;
  riferimentoNormativo: string;
}

export interface DettaglioPagamento {
  beneficiario: string;
  modalita: string;
  dataRiferimento: string;
  giorniTermine: string;
  dataScadenza: string;
  importo: string;
  istituto: string;
  iban: string;
  abi: string;
  cab: string;
  bic: string;
  codicePagamento: string;
}

export interface Pagamento {
  condizioni: string;
  dettagli: DettaglioPagamento[];
}

export interface Allegato {
  nome: string;
  formato: string;
  descrizione: string;
  /** Contenuto in Base64, senza spazi. */
  base64: string;
  /** Dimensione stimata dei byte decodificati. */
  bytes: number;
}

export interface Body {
  tipoDocumento: string;
  divisa: string;
  data: string;
  numero: string;
  importoTotale: string;
  arrotondamento: string;
  causali: string[];
  bolloVirtuale: string;
  bolloImporto: string;
  ritenute: Ritenuta[];
  casse: Cassa[];
  sconti: ScontoMaggiorazione[];
  ordini: DocRef[];
  contratti: DocRef[];
  convenzioni: DocRef[];
  ricezioni: DocRef[];
  fattureCollegate: DocRef[];
  ddt: Ddt[];
  righe: Riga[];
  riepilogo: Riepilogo[];
  pagamenti: Pagamento[];
  allegati: Allegato[];
}

export interface Fattura {
  /** Attributo "versione" della radice (FPR12, FPA12, FSM10). */
  formato: string;
  header: Header;
  bodies: Body[];
}

// ---- utilità DOM (i nomi si confrontano senza prefisso di namespace) ----

function kids(el: Element | null | undefined, name: string): Element[] {
  if (!el) return [];
  return Array.from(el.children).filter((c) => c.localName === name);
}

function kid(el: Element | null | undefined, name: string): Element | null {
  return kids(el, name)[0] ?? null;
}

/** Discendente più vicino con quel nome (primo in ordine di documento). */
function desc(el: Element | null | undefined, name: string): Element | null {
  if (!el) return null;
  const all = el.getElementsByTagNameNS('*', name);
  return all.length > 0 ? all[0] : null;
}

function txt(el: Element | null | undefined, ...path: string[]): string {
  let cur: Element | null | undefined = el;
  for (const p of path) cur = kid(cur, p);
  return (cur?.textContent ?? '').trim();
}

// ---- parti ----

function parseAddress(sede: Element | null): Address | null {
  if (!sede) return null;
  return {
    indirizzo: txt(sede, 'Indirizzo'),
    civico: txt(sede, 'NumeroCivico'),
    cap: txt(sede, 'CAP'),
    comune: txt(sede, 'Comune'),
    provincia: txt(sede, 'Provincia'),
    nazione: txt(sede, 'Nazione'),
  };
}

/**
 * Cedente, cessionario e simili. Nelle fatture ordinarie i dati stanno in DatiAnagrafici, in quelle
 * semplificate possono stare in IdentificativiFiscali / AltriDatiIdentificativi: si cercano in entrambi.
 */
function parseParty(el: Element | null): Party {
  const da = kid(el, 'DatiAnagrafici') ?? el;
  const anag = kid(da, 'Anagrafica') ?? kid(el, 'AltriDatiIdentificativi') ?? da;
  const idf = kid(da, 'IdFiscaleIVA') ?? kid(kid(el, 'IdentificativiFiscali'), 'IdFiscaleIVA');
  const cf = txt(da, 'CodiceFiscale') || txt(kid(el, 'IdentificativiFiscali'), 'CodiceFiscale');
  const reaEl = kid(el, 'IscrizioneREA');
  const rea = reaEl ? [txt(reaEl, 'Ufficio'), txt(reaEl, 'NumeroREA')].filter(Boolean).join(' ') : '';
  const contatti = kid(el, 'Contatti');
  return {
    denominazione: txt(anag, 'Denominazione'),
    nome: txt(anag, 'Nome'),
    cognome: txt(anag, 'Cognome'),
    titolo: txt(anag, 'Titolo'),
    codiceEori: txt(anag, 'CodEORI'),
    idPaese: txt(idf, 'IdPaese'),
    partitaIva: txt(idf, 'IdCodice'),
    codiceFiscale: cf,
    regimeFiscale: txt(da, 'RegimeFiscale'),
    sede: parseAddress(kid(el, 'Sede') ?? kid(anag, 'Sede')),
    telefono: txt(contatti, 'Telefono'),
    email: txt(contatti, 'Email'),
    rea,
  };
}

const emptyParty = (): Party => parseParty(null);

/** Nome da mostrare: denominazione oppure "titolo nome cognome". */
export function partyName(p: Party): string {
  if (p.denominazione) return p.denominazione;
  return [p.titolo, p.nome, p.cognome].filter(Boolean).join(' ');
}

// ---- corpo ----

function parseSconti(el: Element, tag: string): ScontoMaggiorazione[] {
  return kids(el, tag).map((s) => ({
    tipo: txt(s, 'Tipo'),
    percentuale: txt(s, 'Percentuale'),
    importo: txt(s, 'Importo'),
  }));
}

function parseRefs(el: Element | null, tag: string): DocRef[] {
  return kids(el, tag).map((d) => ({
    id: txt(d, 'IdDocumento'),
    data: txt(d, 'Data'),
    numItem: txt(d, 'NumItem'),
    cup: txt(d, 'CodiceCUP'),
    cig: txt(d, 'CodiceCIG'),
    codiceCommessa: txt(d, 'CodiceCommessaConvenzione'),
    righe: kids(d, 'RiferimentoNumeroLinea')
      .map((r) => (r.textContent ?? '').trim())
      .filter(Boolean)
      .join(', '),
  }));
}

function parseRiga(l: Element): Riga {
  return {
    numero: txt(l, 'NumeroLinea'),
    descrizione: txt(l, 'Descrizione'),
    quantita: txt(l, 'Quantita'),
    unitaMisura: txt(l, 'UnitaMisura'),
    dataInizio: txt(l, 'DataInizioPeriodo'),
    dataFine: txt(l, 'DataFinePeriodo'),
    prezzoUnitario: txt(l, 'PrezzoUnitario'),
    sconti: parseSconti(l, 'ScontoMaggiorazione'),
    prezzoTotale: txt(l, 'PrezzoTotale'),
    aliquotaIva: txt(l, 'AliquotaIVA'),
    ritenuta: txt(l, 'Ritenuta'),
    natura: txt(l, 'Natura'),
    riferimentoAmministrazione: txt(l, 'RiferimentoAmministrazione'),
    codici: kids(l, 'CodiceArticolo').map((c) => ({ tipo: txt(c, 'CodiceTipo'), valore: txt(c, 'CodiceValore') })),
    altriDati: kids(l, 'AltriDatiGestionali').map((a) => ({
      tipo: txt(a, 'TipoDato'),
      testo: txt(a, 'RiferimentoTesto'),
      numero: txt(a, 'RiferimentoNumero'),
      data: txt(a, 'RiferimentoData'),
    })),
  };
}

const emptyRiga = (): Riga => ({
  numero: '', descrizione: '', quantita: '', unitaMisura: '', dataInizio: '', dataFine: '', prezzoUnitario: '',
  sconti: [], prezzoTotale: '', aliquotaIva: '', ritenuta: '', natura: '', riferimentoAmministrazione: '',
  codici: [], altriDati: [],
});

function parseRiepilogo(r: Element): Riepilogo {
  return {
    aliquota: txt(r, 'AliquotaIVA'),
    natura: txt(r, 'Natura'),
    speseAccessorie: txt(r, 'SpeseAccessorie'),
    arrotondamento: txt(r, 'Arrotondamento'),
    imponibile: txt(r, 'ImponibileImporto'),
    imposta: txt(r, 'Imposta'),
    esigibilita: txt(r, 'EsigibilitaIVA'),
    riferimentoNormativo: txt(r, 'RiferimentoNormativo'),
  };
}

function parsePagamento(p: Element): Pagamento {
  return {
    condizioni: txt(p, 'CondizioniPagamento'),
    dettagli: kids(p, 'DettaglioPagamento').map((d) => ({
      beneficiario: txt(d, 'Beneficiario'),
      modalita: txt(d, 'ModalitaPagamento'),
      dataRiferimento: txt(d, 'DataRiferimentoTerminiPagamento'),
      giorniTermine: txt(d, 'GiorniTerminiPagamento'),
      dataScadenza: txt(d, 'DataScadenzaPagamento'),
      importo: txt(d, 'ImportoPagamento'),
      istituto: txt(d, 'IstitutoFinanziario'),
      iban: txt(d, 'IBAN').replace(/\s+/g, ''),
      abi: txt(d, 'ABI'),
      cab: txt(d, 'CAB'),
      bic: txt(d, 'BIC'),
      codicePagamento: txt(d, 'CodicePagamento'),
    })),
  };
}

/** Dimensione dei byte che un Base64 (senza spazi) decodifica. */
export function base64Size(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
}

function parseBody(b: Element, simplified: boolean): Body {
  const dg = kid(b, 'DatiGenerali');
  const doc = kid(dg, 'DatiGeneraliDocumento');
  const beni = kid(b, 'DatiBeniServizi');
  const bollo = kid(doc, 'DatiBollo');

  let righe: Riga[];
  let riepilogo: Riepilogo[];
  if (simplified) {
    // FSM10: gli elementi sono fratelli (Descrizione, Importo, DatiIVA, Natura, RiferimentoNormativo): ogni Descrizione apre una riga
    righe = [];
    let cur: Riga | null = null;
    for (const c of Array.from(beni?.children ?? [])) {
      if (c.localName === 'Descrizione') {
        cur = { ...emptyRiga(), numero: String(righe.length + 1), descrizione: (c.textContent ?? '').trim() };
        righe.push(cur);
      } else if (cur) {
        const v = (c.textContent ?? '').trim();
        if (c.localName === 'Importo') cur.prezzoTotale = v;
        else if (c.localName === 'DatiIVA') {
          cur.aliquotaIva = txt(c, 'Aliquota');
        } else if (c.localName === 'Natura') cur.natura = v;
        else if (c.localName === 'RiferimentoNormativo') {
          cur.altriDati.push({ tipo: 'RiferimentoNormativo', testo: v, numero: '', data: '' });
        }
      }
    }
    riepilogo = kids(beni, 'DatiIVA').map((d) => ({
      aliquota: txt(d, 'Aliquota'),
      natura: '',
      speseAccessorie: '',
      arrotondamento: '',
      imponibile: '',
      imposta: txt(d, 'Imposta'),
      esigibilita: '',
      riferimentoNormativo: '',
    }));
  } else {
    righe = kids(beni, 'DettaglioLinee').map(parseRiga);
    riepilogo = kids(beni, 'DatiRiepilogo').map(parseRiepilogo);
  }

  return {
    tipoDocumento: txt(doc, 'TipoDocumento'),
    divisa: txt(doc, 'Divisa'),
    data: txt(doc, 'Data'),
    numero: txt(doc, 'Numero'),
    importoTotale: txt(doc, 'ImportoTotaleDocumento'),
    arrotondamento: txt(doc, 'Arrotondamento'),
    causali: kids(doc, 'Causale').map((c) => (c.textContent ?? '').trim()).filter(Boolean),
    bolloVirtuale: txt(bollo, 'BolloVirtuale'),
    bolloImporto: txt(bollo, 'ImportoBollo'),
    ritenute: kids(doc, 'DatiRitenuta').map((r) => ({
      tipo: txt(r, 'TipoRitenuta'),
      importo: txt(r, 'ImportoRitenuta'),
      aliquota: txt(r, 'AliquotaRitenuta'),
      causale: txt(r, 'CausalePagamento'),
    })),
    casse: kids(doc, 'DatiCassaPrevidenziale').map((c) => ({
      tipo: txt(c, 'TipoCassa'),
      aliquota: txt(c, 'AlCassa'),
      importo: txt(c, 'ImportoContributoCassa'),
      imponibile: txt(c, 'ImponibileCassa'),
      aliquotaIva: txt(c, 'AliquotaIVA'),
      ritenuta: txt(c, 'Ritenuta'),
      natura: txt(c, 'Natura'),
      riferimentoAmministrazione: txt(c, 'RiferimentoAmministrazione'),
    })),
    sconti: parseSconti(doc ?? b, 'ScontoMaggiorazione'),
    ordini: parseRefs(dg, 'DatiOrdineAcquisto'),
    contratti: parseRefs(dg, 'DatiContratto'),
    convenzioni: parseRefs(dg, 'DatiConvenzione'),
    ricezioni: parseRefs(dg, 'DatiRicezione'),
    fattureCollegate: parseRefs(dg, 'DatiFattureCollegate'),
    ddt: kids(dg, 'DatiDDT').map((d) => ({
      numero: txt(d, 'NumeroDDT'),
      data: txt(d, 'DataDDT'),
      righe: kids(d, 'RiferimentoNumeroLinea')
        .map((r) => (r.textContent ?? '').trim())
        .filter(Boolean)
        .join(', '),
    })),
    righe,
    riepilogo,
    pagamenti: kids(b, 'DatiPagamento').map(parsePagamento),
    allegati: kids(b, 'Allegati').map((a) => {
      const base64 = txt(a, 'Attachment').replace(/\s+/g, '');
      return {
        nome: txt(a, 'NomeAttachment'),
        formato: txt(a, 'FormatoAttachment'),
        descrizione: txt(a, 'DescrizioneAttachment'),
        base64,
        bytes: base64Size(base64),
      };
    }),
  };
}

// ---- documento ----

/** Testo dell'XML dai byte, rispettando una dichiarazione di codifica diversa da UTF-8. */
export function decodeXmlBytes(bytes: Uint8Array): string {
  let label = 'utf-8';
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200));
  const m = /<\?xml[^>]*encoding\s*=\s*["']([A-Za-z0-9_.:-]+)["']/i.exec(head);
  if (m) label = m[1].toLowerCase();
  let text: string;
  try {
    text = new TextDecoder(label).decode(bytes);
  } catch {
    text = new TextDecoder('utf-8').decode(bytes);
  }
  // BOM e eventuali byte di troppo prima del primo "<" e dopo l'ultimo ">"
  const start = text.indexOf('<');
  const end = text.lastIndexOf('>');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

/** Legge l'XML di una fattura. Lancia FatturaError se non è XML valido o non è una fattura elettronica. */
export function parseFattura(xml: string): Fattura {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml');
  } catch {
    throw new FatturaError('invalidXml');
  }
  if (doc.getElementsByTagName('parsererror').length > 0 || !doc.documentElement) {
    throw new FatturaError('invalidXml');
  }
  const root = doc.documentElement;
  const isSimplified = root.localName === 'FatturaElettronicaSemplificata';
  if (root.localName !== 'FatturaElettronica' && !isSimplified) throw new FatturaError('notFattura');
  const bodies = kids(root, 'FatturaElettronicaBody');
  const headerEl = kid(root, 'FatturaElettronicaHeader');
  if (!headerEl || bodies.length === 0) throw new FatturaError('notFattura');

  const dt = kid(headerEl, 'DatiTrasmissione');
  const idt = kid(dt, 'IdTrasmittente');
  const rapp = kid(headerEl, 'RappresentanteFiscale');
  const terzo = kid(headerEl, 'TerzoIntermediarioOSoggettoEmittente');
  const formato = root.getAttribute('versione') ?? txt(dt, 'FormatoTrasmissione');
  return {
    formato,
    header: {
      trasmissione: {
        idPaese: txt(idt, 'IdPaese'),
        idCodice: txt(idt, 'IdCodice'),
        progressivo: txt(dt, 'ProgressivoInvio'),
        formato: txt(dt, 'FormatoTrasmissione') || formato,
        codiceDestinatario: txt(dt, 'CodiceDestinatario'),
        pecDestinatario: txt(dt, 'PECDestinatario'),
      },
      cedente: parseParty(kid(headerEl, 'CedentePrestatore')),
      rappresentante: rapp ? parseParty(rapp) : null,
      cessionario: kid(headerEl, 'CessionarioCommittente') ? parseParty(kid(headerEl, 'CessionarioCommittente')) : emptyParty(),
      terzo: terzo ? parseParty(terzo) : null,
      soggettoEmittente: txt(headerEl, 'SoggettoEmittente'),
    },
    bodies: bodies.map((b) => parseBody(b, isSimplified)),
  };
}

// ---- formattazione e totali ----

/** Numero da stringa del tracciato ("1234.56"); NaN se assente. */
export function num(s: string): number {
  return s.trim() === '' ? NaN : Number(s);
}

/** Totali di un corpo: imponibile e imposta dal riepilogo IVA, totale dichiarato o calcolato. */
export function totals(b: Body): { imponibile: number; imposta: number; totale: number; calcolato: boolean } {
  const imponibile = b.riepilogo.reduce((s, r) => s + (num(r.imponibile) || 0), 0);
  const imposta = b.riepilogo.reduce((s, r) => s + (num(r.imposta) || 0), 0);
  const dichiarato = num(b.importoTotale);
  if (!Number.isNaN(dichiarato)) return { imponibile, imposta, totale: dichiarato, calcolato: false };
  return { imponibile, imposta, totale: Math.round((imponibile + imposta) * 100) / 100, calcolato: true };
}

/** Data del tracciato (AAAA-MM-GG, con o senza fuso) in forma leggibile; il testo non riconosciuto resta com'è. */
export function formatDate(s: string, locale: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return s;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(d);
}

/** Importo con la divisa (codice ISO, se valido). */
export function formatMoney(value: number | string, currency: string, locale: string): string {
  const n = typeof value === 'string' ? num(value) : value;
  if (Number.isNaN(n)) return '';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'EUR' }).format(n);
  } catch {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + (currency ? ` ${currency}` : '');
  }
}

/** Quantità o prezzo unitario: fino a 8 decimali, senza zeri inutili. */
export function formatQty(value: string, locale: string): string {
  const n = num(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(n);
}

/** Aliquota IVA o percentuale ("22.00" diventa "22%"). */
export function formatPercent(value: string, locale: string): string {
  const n = num(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n) + '%';
}

/** Dimensione in KB/MB. */
export function formatBytes(n: number, locale: string): string {
  const f = (v: number, u: string) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(v)} ${u}`;
  if (n < 1024) return f(n, 'B');
  if (n < 1024 * 1024) return f(n / 1024, 'KB');
  return f(n / 1024 / 1024, 'MB');
}

/** IBAN a gruppi di quattro caratteri. */
export function groupIban(iban: string): string {
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/** Indirizzo su due righe: "Via Roma 1" e "00100 Roma (RM) IT". */
export function addressLines(a: Address | null): string[] {
  if (!a) return [];
  const l1 = [a.indirizzo, a.civico].filter(Boolean).join(' ');
  const l2 = [[a.cap, a.comune].filter(Boolean).join(' '), a.provincia ? `(${a.provincia})` : '', a.nazione].filter(Boolean).join(' ');
  return [l1, l2].filter(Boolean);
}
