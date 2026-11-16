// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Fatture e buste firmate INVENTATE, usate solo nei test: nomi, partite IVA e IBAN non appartengono
 * a nessuno. La busta CMS è costruita a mano (struttura minima, senza firma valida).
 */

const NS = 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2';

export const ATTACHMENT_TEXT = 'Allegato di prova: condizioni di fornitura.';
export const ATTACHMENT_B64 = btoa(ATTACHMENT_TEXT);

/** FPR12 con tre righe (una con sconto e una esente), ritenuta, bollo, cassa, pagamento e un allegato. */
export function fpr12(prefix = ''): string {
  const p = prefix ? `${prefix}:` : '';
  const xmlns = prefix ? `xmlns:${prefix}="${NS}"` : `xmlns="${NS}"`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<${p}FatturaElettronica versione="FPR12" ${xmlns}>
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>09999999999</IdCodice></IdTrasmittente>
      <ProgressivoInvio>00042</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>ABC1234</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>09999999999</IdCodice></IdFiscaleIVA>
        <CodiceFiscale>09999999999</CodiceFiscale>
        <Anagrafica><Denominazione>Alfa Servizi di Prova S.r.l.</Denominazione></Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede><Indirizzo>Via dei Campioni</Indirizzo><NumeroCivico>10</NumeroCivico><CAP>00100</CAP><Comune>Roma</Comune><Provincia>RM</Provincia><Nazione>IT</Nazione></Sede>
      <Contatti><Telefono>0600000000</Telefono><Email>info@alfa.example</Email></Contatti>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>ZZZLSU80A41H501X</CodiceFiscale>
        <Anagrafica><Nome>Luisa</Nome><Cognome>Inventata</Cognome></Anagrafica>
      </DatiAnagrafici>
      <Sede><Indirizzo>Via Fittizia</Indirizzo><NumeroCivico>5</NumeroCivico><CAP>20100</CAP><Comune>Milano</Comune><Provincia>MI</Provincia><Nazione>IT</Nazione></Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-03-15</Data>
        <Numero>2026/0042</Numero>
        <DatiRitenuta><TipoRitenuta>RT01</TipoRitenuta><ImportoRitenuta>20.00</ImportoRitenuta><AliquotaRitenuta>20.00</AliquotaRitenuta><CausalePagamento>A</CausalePagamento></DatiRitenuta>
        <DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>2.00</ImportoBollo></DatiBollo>
        <DatiCassaPrevidenziale><TipoCassa>TC22</TipoCassa><AlCassa>4.00</AlCassa><ImportoContributoCassa>4.00</ImportoContributoCassa><ImponibileCassa>100.00</ImponibileCassa><AliquotaIVA>22.00</AliquotaIVA></DatiCassaPrevidenziale>
        <ImportoTotaleDocumento>414.00</ImportoTotaleDocumento>
        <Causale>Servizi di consulenza di prova, marzo 2026.</Causale>
      </DatiGeneraliDocumento>
      <DatiOrdineAcquisto><RiferimentoNumeroLinea>1</RiferimentoNumeroLinea><IdDocumento>ORD-7788</IdDocumento><Data>2026-02-20</Data></DatiOrdineAcquisto>
      <DatiDDT><NumeroDDT>DDT-15</NumeroDDT><DataDDT>2026-03-14</DataDDT><RiferimentoNumeroLinea>2</RiferimentoNumeroLinea></DatiDDT>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee><NumeroLinea>1</NumeroLinea><Descrizione>Consulenza oraria</Descrizione><Quantita>10.00</Quantita><UnitaMisura>ore</UnitaMisura><PrezzoUnitario>30.00</PrezzoUnitario><PrezzoTotale>300.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
      <DettaglioLinee><NumeroLinea>2</NumeroLinea><Descrizione>Materiale di consumo</Descrizione><Quantita>4.00</Quantita><PrezzoUnitario>12.50</PrezzoUnitario><ScontoMaggiorazione><Tipo>SC</Tipo><Percentuale>10.00</Percentuale></ScontoMaggiorazione><PrezzoTotale>45.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
      <DettaglioLinee><NumeroLinea>3</NumeroLinea><Descrizione>Formazione esente</Descrizione><PrezzoUnitario>50.00</PrezzoUnitario><PrezzoTotale>50.00</PrezzoTotale><AliquotaIVA>0.00</AliquotaIVA><Natura>N4</Natura></DettaglioLinee>
      <DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>349.00</ImponibileImporto><Imposta>76.78</Imposta><EsigibilitaIVA>I</EsigibilitaIVA></DatiRiepilogo>
      <DatiRiepilogo><AliquotaIVA>0.00</AliquotaIVA><Natura>N4</Natura><ImponibileImporto>50.00</ImponibileImporto><Imposta>0.00</Imposta><RiferimentoNormativo>Art. 10 DPR 633/72</RiferimentoNormativo></DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>2026-04-14</DataScadenzaPagamento><ImportoPagamento>414.00</ImportoPagamento><IBAN>IT00A0000000000000000000000</IBAN></DettaglioPagamento>
    </DatiPagamento>
    <Allegati><NomeAttachment>condizioni.txt</NomeAttachment><FormatoAttachment>TXT</FormatoAttachment><DescrizioneAttachment>Condizioni</DescrizioneAttachment><Attachment>${ATTACHMENT_B64}</Attachment></Allegati>
  </FatturaElettronicaBody>
</${p}FatturaElettronica>`;
}

/** FPA12 (verso la PA) con CIG e CUP e split payment. */
export function fpa12(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPA12" xmlns:p="${NS}">
  <FatturaElettronicaHeader>
    <DatiTrasmissione><IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>09999999999</IdCodice></IdTrasmittente><ProgressivoInvio>7</ProgressivoInvio><FormatoTrasmissione>FPA12</FormatoTrasmissione><CodiceDestinatario>UFABCD</CodiceDestinatario></DatiTrasmissione>
    <CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>09999999999</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Alfa Servizi di Prova S.r.l.</Denominazione></Anagrafica><RegimeFiscale>RF01</RegimeFiscale></DatiAnagrafici><Sede><Indirizzo>Via dei Campioni</Indirizzo><CAP>00100</CAP><Comune>Roma</Comune><Provincia>RM</Provincia><Nazione>IT</Nazione></Sede></CedentePrestatore>
    <CessionarioCommittente><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>08888888888</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Comune di Esempiopoli</Denominazione></Anagrafica></DatiAnagrafici><Sede><Indirizzo>Piazza Immaginaria</Indirizzo><NumeroCivico>1</NumeroCivico><CAP>10100</CAP><Comune>Torino</Comune><Provincia>TO</Provincia><Nazione>IT</Nazione></Sede></CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento><TipoDocumento>TD04</TipoDocumento><Divisa>EUR</Divisa><Data>2026-05-02</Data><Numero>NC-3</Numero><ImportoTotaleDocumento>100.00</ImportoTotaleDocumento></DatiGeneraliDocumento>
      <DatiOrdineAcquisto><IdDocumento>DET-55</IdDocumento><Data>2026-04-01</Data><CodiceCUP>CUPFITTIZIO000</CodiceCUP><CodiceCIG>CIGFITTIZIO</CodiceCIG></DatiOrdineAcquisto>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee><NumeroLinea>1</NumeroLinea><Descrizione>Storno parziale</Descrizione><PrezzoUnitario>81.97</PrezzoUnitario><PrezzoTotale>81.97</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
      <DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>81.97</ImponibileImporto><Imposta>18.03</Imposta><EsigibilitaIVA>S</EsigibilitaIVA></DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;
}

/** FSM10 (semplificata). */
export function fsm10(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronicaSemplificata versione="FSM10" xmlns="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.0">
  <FatturaElettronicaHeader>
    <DatiTrasmissione><IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>09999999999</IdCodice></IdTrasmittente><ProgressivoInvio>1</ProgressivoInvio><FormatoTrasmissione>FSM10</FormatoTrasmissione><CodiceDestinatario>0000000</CodiceDestinatario></DatiTrasmissione>
    <CedentePrestatore><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>09999999999</IdCodice></IdFiscaleIVA><Denominazione>Bar Fittizio</Denominazione><RegimeFiscale>RF01</RegimeFiscale><Sede><Indirizzo>Via Prova 3</Indirizzo><CAP>40100</CAP><Comune>Bologna</Comune><Provincia>BO</Provincia><Nazione>IT</Nazione></Sede></CedentePrestatore>
    <CessionarioCommittente><IdentificativiFiscali><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>08888888888</IdCodice></IdFiscaleIVA></IdentificativiFiscali><AltriDatiIdentificativi><Denominazione>Gamma Impianti S.n.c.</Denominazione></AltriDatiIdentificativi></CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD07</TipoDocumento><Data>2026-06-01</Data><Numero>S-1</Numero></DatiGeneraliDocumento></DatiGenerali>
    <DatiBeniServizi>
      <Descrizione>Ricambio</Descrizione><Importo>61.00</Importo><DatiIVA><Aliquota>22.00</Aliquota><Imposta>11.00</Imposta></DatiIVA>
      <Descrizione>Servizio esente</Descrizione><Importo>10.00</Importo><DatiIVA><Aliquota>0.00</Aliquota></DatiIVA><Natura>N4</Natura>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</FatturaElettronicaSemplificata>`;
}

/** Lotto con due corpi (due fatture nello stesso file). */
export function lotto(): string {
  const one = fpr12();
  const body = /<FatturaElettronicaBody>[\s\S]*<\/FatturaElettronicaBody>/.exec(one)![0];
  const second = body.replace('2026/0042', '2026/0043').replace('Consulenza oraria', 'Seconda consulenza');
  return one.replace('</FatturaElettronica>', `${second}\n</FatturaElettronica>`);
}

// ---- busta CMS costruita a mano ----

const enc = (s: string) => new TextEncoder().encode(s);

export function derLen(n: number): number[] {
  if (n < 0x80) return [n];
  const bytes: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.unshift(v & 255);
  return [0x80 | bytes.length, ...bytes];
}

export function tlv(tag: number, ...parts: (number[] | Uint8Array)[]): number[] {
  const body = parts.flatMap((p) => Array.from(p));
  return [tag, ...derLen(body.length), ...body];
}

const OID_SIGNED_DATA = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02];
const OID_DATA = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01];
const OID_SHA256 = [0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01];

export type P7mStyle = 'definite' | 'fragmented' | 'indefinite';

/**
 * ContentInfo { SignedData { version, digestAlgorithms, encapContentInfo { data, [0] OCTET STRING },
 * signerInfos vuoto } }. Nello stile "fragmented" il contenuto è un OCTET STRING costruito in pezzi
 * da 1000 byte; in "indefinite" tutte le lunghezze esterne sono indefinite (BER, come fanno molti software).
 */
export function buildP7m(content: string | Uint8Array, style: P7mStyle = 'definite'): Uint8Array {
  const data = typeof content === 'string' ? enc(content) : content;
  const digestAlgs = tlv(0x31, tlv(0x30, OID_SHA256));
  const version = tlv(0x02, [1]);
  const signerInfos = tlv(0x31);
  if (style === 'indefinite') {
    const pieces: number[] = [];
    for (let i = 0; i < data.length; i += 1000) pieces.push(...tlv(0x04, data.subarray(i, i + 1000)));
    const octet = [0x24, 0x80, ...pieces, 0, 0];
    const encap = [0x30, 0x80, ...OID_DATA, 0xa0, 0x80, ...octet, 0, 0, 0, 0];
    const signed = [0x30, 0x80, ...version, ...digestAlgs, ...encap, ...signerInfos, 0, 0];
    return Uint8Array.from([0x30, 0x80, ...OID_SIGNED_DATA, 0xa0, 0x80, ...signed, 0, 0, 0, 0]);
  }
  let octet: number[];
  if (style === 'fragmented') {
    const pieces: number[] = [];
    for (let i = 0; i < data.length; i += 1000) pieces.push(...tlv(0x04, data.subarray(i, i + 1000)));
    octet = tlv(0x24, pieces);
  } else octet = tlv(0x04, data);
  const encap = tlv(0x30, OID_DATA, tlv(0xa0, octet));
  const signed = tlv(0x30, version, digestAlgs, encap, signerInfos);
  return Uint8Array.from(tlv(0x30, OID_SIGNED_DATA, tlv(0xa0, signed)));
}

/** Base64 a righe di 76 caratteri, come un .p7m testuale. */
export function toBase64Lines(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return (btoa(s).match(/.{1,76}/g) ?? []).join('\n');
}
