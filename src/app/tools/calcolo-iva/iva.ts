// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Calcoli di IVA, scorporo e notula/fattura di un professionista (rivalsa INPS, cassa previdenziale,
 * ritenuta d'acconto, bollo, regime forfettario). Tutti gli importi sono interi in CENTESIMI e le
 * aliquote in PUNTI BASE (centesimi di punto percentuale: 22% = 2200): nessun errore di virgola mobile.
 * Gli arrotondamenti sono al centesimo, "mezzo in su" (0,005 diventa 0,01).
 *
 * Strumento indicativo, non consulenza fiscale. Aliquote e regole aggiornate al 2026.
 */

export const VAT_RATES_BP = [2200, 1000, 500, 400, 0] as const;
export const BOLLO_CENTS = 200;
/** Il bollo si applica sopra 77,47 euro (art. 13 della tariffa allegata al DPR 642/1972). */
export const BOLLO_THRESHOLD_CENTS = 7747;
export const RIVALSA_INPS_BP = 400;
export const RITENUTA_BP = 2000;

/** Natura dell'operazione senza IVA (codici dello standard della fattura elettronica). */
export type VatNature = 'N1' | 'N2.1' | 'N2.2' | 'N3.1' | 'N4' | 'N6.9';
export const VAT_NATURES: readonly VatNature[] = ['N2.2', 'N4', 'N2.1', 'N1', 'N3.1', 'N6.9'];
/** Con questa natura e importo oltre soglia scatta il bollo; N6.9 (inversione contabile) è un'operazione con IVA. */
const NATURES_WITH_BOLLO: readonly VatNature[] = ['N1', 'N2.1', 'N2.2', 'N3.1', 'N4'];

/** Divisione intera arrotondata "mezzo in su" (lontano da zero per i negativi). */
export function roundDiv(n: number, d: number): number {
  if (n < 0) return -roundDiv(-n, d);
  return Math.floor((2 * n + d) / (2 * d));
}

/** Percentuale (in punti base) di un importo in centesimi, arrotondata al centesimo. */
export function percentOf(cents: number, bp: number): number {
  return roundDiv(cents * bp, 10000);
}

// ---- Lettura e formattazione dei numeri digitati ----

/**
 * Importo digitato → centesimi. Accetta "1.234,56", "1234,56", "1234.56", "1.234" (migliaia all'italiana),
 * simbolo € e spazi. Oltre due decimali arrotonda al centesimo. null se non è un numero valido o è negativo.
 */
export function parseMoney(input: string): number | null {
  let v = input.replace(/[€\s ]/g, '');
  if (!v || !/^[\d.,]+$/.test(v)) return null;
  const lastComma = v.lastIndexOf(',');
  const lastDot = v.lastIndexOf('.');
  let intPart: string;
  let frac = '';
  if (lastComma >= 0 && lastDot >= 0) {
    // l'ultimo separatore è il decimale
    const dec = Math.max(lastComma, lastDot);
    if (v.split(v[dec]).length !== 2) return null;
    intPart = v.slice(0, dec).replace(/[.,]/g, '');
    frac = v.slice(dec + 1);
  } else if (lastComma >= 0) {
    if (v.indexOf(',') !== lastComma) return null;
    intPart = v.slice(0, lastComma);
    frac = v.slice(lastComma + 1);
  } else if (lastDot >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(v)) {
      intPart = v.replace(/\./g, '');
    } else if (v.indexOf('.') === lastDot) {
      intPart = v.slice(0, lastDot);
      frac = v.slice(lastDot + 1);
    } else return null;
  } else {
    intPart = v;
  }
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(frac) || (intPart === '' && frac === '')) return null;
  v = (intPart || '0') + '.' + (frac || '0');
  const [i, f] = v.split('.');
  const cents = Number(i) * 100 + Number((f + '00').slice(0, 2));
  const rounded = f.length > 2 && f.charCodeAt(2) >= 53 ? cents + 1 : cents;
  return Number.isSafeInteger(rounded) && rounded <= 100_000_000_000_00 ? rounded : null;
}

/** Percentuale digitata ("2,5" o "4") → punti base (0-10000); null se non valida. */
export function parsePercent(input: string): number | null {
  const v = input.replace(/[%\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const bp = Math.round(Number(v) * 100);
  return bp <= 10000 ? bp : null;
}

/** Centesimi → "1.234,56" (separatori della lingua). */
export function formatMoney(cents: number, locale = 'it-IT'): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const it = locale.startsWith('it');
  // raggruppamento a mano: Intl in italiano non raggruppa i numeri sotto le cinque cifre
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, it ? '.' : ',');
  return `${sign}${grouped}${it ? ',' : '.'}${frac}`;
}

export function formatPercent(bp: number, locale = 'it-IT'): string {
  const v = bp / 100;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '');
  return (locale.startsWith('it') ? s.replace('.', ',') : s) + '%';
}

// ---- Aggiungi IVA / scorporo ----

export interface VatResult {
  net: number;
  vat: number;
  gross: number;
}

/** Dall'imponibile al lordo: IVA = imponibile × aliquota. */
export function addVat(netCents: number, vatBp: number): VatResult {
  const vat = percentOf(netCents, vatBp);
  return { net: netCents, vat, gross: netCents + vat };
}

/** Dal lordo all'imponibile: imponibile = lordo / (1 + aliquota), IVA = differenza (la somma torna sempre al lordo). */
export function extractVat(grossCents: number, vatBp: number): VatResult {
  const net = roundDiv(grossCents * 10000, 10000 + vatBp);
  return { net, vat: grossCents - net, gross: grossCents };
}

// ---- Notula / fattura di un professionista ----

export interface InvoiceInput {
  /** Compenso (imponibile) in centesimi. */
  compenso: number;
  /** Rivalsa INPS 4% (gestione separata): si aggiunge al compenso, concorre alla base IVA. */
  rivalsa: boolean;
  /** Contributo cassa previdenziale in punti base (0 = nessuno), calcolato sul compenso. */
  cassaBp: number;
  /** La cassa è soggetta a IVA (di solito sì per il contributo integrativo). */
  cassaVat: boolean;
  vatBp: number;
  nature: VatNature;
  /** Ritenuta d'acconto in punti base (di norma 2000; 0 = nessuna). */
  ritenutaBp: number;
  /** Ritenuta calcolata anche sulla cassa (di default solo su compenso + rivalsa INPS). */
  ritenutaOnCassa: boolean;
  /** Bollo di 2 euro addebitato al cliente (sommato al totale). */
  bolloCharged: boolean;
  /** Regime forfettario: niente IVA, niente ritenuta. */
  forfettario: boolean;
}

export type InvoiceNote = 'forfettario' | 'ritenutaForfettario' | 'bollo' | 'natura' | 'cassaFuoriIva';

export interface InvoiceResult {
  compenso: number;
  rivalsa: number;
  cassa: number;
  /** Base su cui si calcola l'IVA. */
  vatBase: number;
  vatBp: number;
  vat: number;
  /** Bollo dovuto (0 o 200), anche se non addebitato. */
  bolloDue: number;
  /** Bollo sommato al totale (0 se a carico del professionista). */
  bollo: number;
  /** Compenso + rivalsa + cassa + IVA + bollo addebitato. */
  totalDocument: number;
  ritenutaBase: number;
  ritenuta: number;
  netToPay: number;
  nature: VatNature | null;
  notes: InvoiceNote[];
}

export function computeInvoice(i: InvoiceInput): InvoiceResult {
  const vatBp = i.forfettario ? 0 : i.vatBp;
  const ritenutaBp = i.forfettario ? 0 : i.ritenutaBp;
  const rivalsa = i.rivalsa ? percentOf(i.compenso, RIVALSA_INPS_BP) : 0;
  const cassa = i.cassaBp > 0 ? percentOf(i.compenso, i.cassaBp) : 0;
  const cassaTaxed = i.cassaVat || vatBp === 0;
  const vatBase = i.compenso + rivalsa + (cassaTaxed ? cassa : 0);
  const vat = percentOf(vatBase, vatBp);
  const nature: VatNature | null = vatBp === 0 ? (i.forfettario ? 'N2.2' : i.nature) : null;
  const noVatTotal = i.compenso + rivalsa + cassa;
  const bolloDue = vatBp === 0 && nature !== null && NATURES_WITH_BOLLO.includes(nature) && noVatTotal > BOLLO_THRESHOLD_CENTS ? BOLLO_CENTS : 0;
  const bollo = i.bolloCharged ? bolloDue : 0;
  const totalDocument = i.compenso + rivalsa + cassa + vat + bollo;
  // La rivalsa INPS 4% fa parte del compenso ai fini IRPEF, quindi è soggetta a ritenuta; il contributo
  // integrativo delle casse professionali no (solo se l'utente lo chiede esplicitamente).
  const ritenutaBase = ritenutaBp > 0 ? i.compenso + rivalsa + (i.ritenutaOnCassa ? cassa : 0) : 0;
  const ritenuta = percentOf(ritenutaBase, ritenutaBp);
  const notes: InvoiceNote[] = [];
  if (i.forfettario) notes.push('forfettario', 'ritenutaForfettario');
  else if (nature) notes.push('natura');
  if (bolloDue) notes.push('bollo');
  if (cassa > 0 && !cassaTaxed) notes.push('cassaFuoriIva');
  return { compenso: i.compenso, rivalsa, cassa, vatBase, vatBp, vat, bolloDue, bollo, totalDocument, ritenutaBase, ritenuta, netToPay: totalDocument - ritenuta, nature, notes };
}

export interface ReverseResult {
  /** Compenso trovato (centesimi) e fattura risultante. */
  compenso: number;
  invoice: InvoiceResult;
  /** Differenza tra il netto ottenuto e quello desiderato (0 = esatto; con gli arrotondamenti può restare qualche centesimo). */
  difference: number;
}

/**
 * Dal netto da incassare al compenso. Il netto è quasi lineare nel compenso: si stima con la formula chiusa
 * e si cerca, in una finestra di pochi centesimi, il compenso che lo riproduce (o che gli si avvicina di più).
 * Il bollo dipende dall'importo, quindi si prova con e senza.
 */
export function solveCompenso(targetNet: number, base: Omit<InvoiceInput, 'compenso'>): ReverseResult | null {
  if (targetNet <= 0) return null;
  const at = (compenso: number) => computeInvoice({ ...base, compenso });
  // fattore del netto per ogni euro di compenso (con compenso=1 euro in grande scala per limitare l'arrotondamento)
  const probe = at(100_000_000);
  const factor = (probe.netToPay - probe.bollo) / 100_000_000;
  let best: ReverseResult | null = null;
  for (const bolloGuess of [0, BOLLO_CENTS]) {
    const guess = Math.round((targetNet - (base.bolloCharged ? bolloGuess : 0)) / factor);
    for (let c = Math.max(1, guess - 5); c <= guess + 5; c++) {
      const inv = at(c);
      if (inv.bolloDue !== bolloGuess) continue; // la stima del bollo deve essere coerente con l'importo
      const diff = inv.netToPay - targetNet;
      if (!best || Math.abs(diff) < Math.abs(best.difference) || (Math.abs(diff) === Math.abs(best.difference) && c < best.compenso)) {
        best = { compenso: c, invoice: inv, difference: diff };
      }
    }
    if (best && best.difference === 0) break;
  }
  return best;
}
