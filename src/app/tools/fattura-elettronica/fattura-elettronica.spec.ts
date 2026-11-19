// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { MODALITA_PAGAMENTO, NATURA, TIPO_DOCUMENTO, describeCode } from './fattura-codes';
import {
  ATTACHMENT_TEXT,
  buildP7m,
  fpa12,
  fpr12,
  fsm10,
  lotto,
  toBase64Lines,
} from './fattura-fixtures';
import { loadInvoiceFile } from './fattura-input';
import {
  FatturaError,
  addressLines,
  base64Size,
  decodeXmlBytes,
  formatDate,
  formatPercent,
  groupIban,
  parseFattura,
  partyName,
  totals,
} from './fattura-parser';
import { summaryText } from './fattura-text';
import { P7mError, extractP7m } from './p7m';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe('p7m', () => {
  const xml = fpr12();
  it('estrae il contenuto da una busta DER a lunghezze definite', () => {
    expect(dec(extractP7m(buildP7m(xml)))).toBe(xml);
  });
  it('ricompone un OCTET STRING frammentato', () => {
    expect(dec(extractP7m(buildP7m(xml, 'fragmented')))).toBe(xml);
  });
  it('gestisce lunghezze indefinite (BER)', () => {
    expect(dec(extractP7m(buildP7m(xml, 'indefinite')))).toBe(xml);
  });
  it('legge il Base64, anche con righe PEM', () => {
    const b64 = toBase64Lines(buildP7m(xml));
    expect(dec(extractP7m(enc(b64)))).toBe(xml);
    expect(dec(extractP7m(enc(`-----BEGIN PKCS7-----\n${b64}\n-----END PKCS7-----\n`)))).toBe(xml);
  });
  it('apre una doppia firma', () => {
    expect(dec(extractP7m(buildP7m(buildP7m(xml))))).toBe(xml);
  });
  it('rifiuta dati che non sono una busta CMS', () => {
    expect(() => extractP7m(enc('testo qualsiasi che non è Base64!'))).toThrow(P7mError);
    expect(() => extractP7m(Uint8Array.from([0x30, 0x03, 0x02, 0x01, 0x05]))).toThrow(P7mError);
    expect(() => extractP7m(new Uint8Array(0))).toThrow(P7mError);
  });
  it('rifiuta una busta troncata', () => {
    const full = buildP7m(xml);
    expect(() => extractP7m(full.subarray(0, full.length - 40))).toThrow(P7mError);
  });
});

describe('parseFattura FPR12', () => {
  const f = parseFattura(fpr12());
  const b = f.bodies[0];
  it('legge formato, parti e dati generali', () => {
    expect(f.formato).toBe('FPR12');
    expect(partyName(f.header.cedente)).toBe('Alfa Servizi di Prova S.r.l.');
    expect(f.header.cedente.partitaIva).toBe('09999999999');
    expect(f.header.cedente.regimeFiscale).toBe('RF01');
    expect(partyName(f.header.cessionario)).toBe('Luisa Inventata');
    expect(f.header.cessionario.codiceFiscale).toBe('ZZZLSU80A41H501X');
    expect(addressLines(f.header.cedente.sede)).toEqual(['Via dei Campioni 10', '00100 Roma (RM) IT']);
    expect(b.tipoDocumento).toBe('TD01');
    expect(b.numero).toBe('2026/0042');
    expect(b.causali).toEqual(['Servizi di consulenza di prova, marzo 2026.']);
    expect(b.bolloVirtuale).toBe('SI');
    expect(b.ritenute[0]).toMatchObject({ tipo: 'RT01', importo: '20.00' });
    expect(b.casse[0]).toMatchObject({ tipo: 'TC22', aliquota: '4.00' });
  });
  it('legge righe, sconti, natura, riepilogo e totali', () => {
    expect(b.righe).toHaveLength(3);
    expect(b.righe[1].sconti[0]).toMatchObject({ tipo: 'SC', percentuale: '10.00' });
    expect(b.righe[2].natura).toBe('N4');
    expect(b.riepilogo).toHaveLength(2);
    const t = totals(b);
    expect(t.totale).toBe(414);
    expect(t.imponibile).toBeCloseTo(399);
    expect(t.imposta).toBeCloseTo(76.78);
  });
  it('legge pagamento, ordini, DDT e allegato', () => {
    expect(b.pagamenti[0].condizioni).toBe('TP02');
    expect(b.pagamenti[0].dettagli[0]).toMatchObject({ modalita: 'MP05', dataScadenza: '2026-04-14' });
    expect(b.ordini[0]).toMatchObject({ id: 'ORD-7788', righe: '1' });
    expect(b.ddt[0]).toMatchObject({ numero: 'DDT-15', righe: '2' });
    expect(b.allegati).toHaveLength(1);
    expect(b.allegati[0]).toMatchObject({ nome: 'condizioni.txt', formato: 'TXT', bytes: ATTACHMENT_TEXT.length });
    expect(atob(b.allegati[0].base64)).toBe(ATTACHMENT_TEXT);
  });
  it('funziona anche con il prefisso di namespace', () => {
    const p = parseFattura(fpr12('ns3'));
    expect(p.bodies[0].righe).toHaveLength(3);
    expect(p.header.cedente.partitaIva).toBe('09999999999');
  });
});

describe('parseFattura altri formati', () => {
  it('FPA12: riferimenti CIG/CUP, nota di credito e split payment', () => {
    const f = parseFattura(fpa12());
    expect(f.formato).toBe('FPA12');
    expect(f.bodies[0].tipoDocumento).toBe('TD04');
    expect(f.bodies[0].ordini[0]).toMatchObject({ cig: 'CIGFITTIZIO', cup: 'CUPFITTIZIO000' });
    expect(f.bodies[0].riepilogo[0].esigibilita).toBe('S');
  });
  it('FSM10: righe dai blocchi Descrizione/Importo e cessionario in AltriDatiIdentificativi', () => {
    const f = parseFattura(fsm10());
    expect(f.formato).toBe('FSM10');
    expect(partyName(f.header.cedente)).toBe('Bar Fittizio');
    expect(partyName(f.header.cessionario)).toBe('Gamma Impianti S.n.c.');
    expect(f.header.cessionario.partitaIva).toBe('08888888888');
    const b = f.bodies[0];
    expect(b.righe.map((r) => [r.descrizione, r.prezzoTotale, r.aliquotaIva, r.natura])).toEqual([
      ['Ricambio', '61.00', '22.00', ''],
      ['Servizio esente', '10.00', '0.00', 'N4'],
    ]);
    expect(b.riepilogo[0].imposta).toBe('11.00');
    expect(totals(b)).toMatchObject({ imposta: 11, calcolato: true });
  });
  it('lotto: due corpi', () => {
    const f = parseFattura(lotto());
    expect(f.bodies).toHaveLength(2);
    expect(f.bodies.map((x) => x.numero)).toEqual(['2026/0042', '2026/0043']);
    expect(f.bodies[1].righe[0].descrizione).toBe('Seconda consulenza');
  });
  it('errori: XML rotto e XML che non è una fattura', () => {
    expect(() => parseFattura('<a><b></a>')).toThrow(FatturaError);
    try {
      parseFattura('<a><b></a>');
    } catch (e) {
      expect((e as FatturaError).code).toBe('invalidXml');
    }
    try {
      parseFattura('<root><x/></root>');
    } catch (e) {
      expect((e as FatturaError).code).toBe('notFattura');
    }
  });
});

describe('caricamento file', () => {
  it('xml', () => {
    const r = loadInvoiceFile('fattura.xml', enc(fpr12()));
    expect(r.errors).toEqual([]);
    expect(r.items[0]).toMatchObject({ from: 'xml', xmlName: 'fattura.xml' });
  });
  it('p7m DER, frammentato e Base64: stesso XML e nome .xml', () => {
    for (const bytes of [buildP7m(fpr12()), buildP7m(fpr12(), 'fragmented'), enc(toBase64Lines(buildP7m(fpr12(), 'indefinite')))]) {
      const r = loadInvoiceFile('IT09999999999_00042.xml.p7m', bytes);
      expect(r.errors).toEqual([]);
      expect(r.items[0].from).toBe('p7m');
      expect(r.items[0].xmlName).toBe('IT09999999999_00042.xml');
      expect(dec(r.items[0].xmlBytes)).toBe(fpr12());
    }
  });
  it('zip con più fatture (xml e p7m) e file estranei ignorati', () => {
    const zip = zipSync({
      'a.xml': enc(fpr12()),
      'cartella/b.xml.p7m': buildP7m(fsm10()),
      'leggimi.txt': enc('ignorato'),
    });
    const r = loadInvoiceFile('lotto.zip', zip);
    expect(r.errors).toEqual([]);
    expect(r.items.map((i) => i.name)).toEqual(['lotto.zip / a.xml', 'lotto.zip / cartella/b.xml.p7m']);
    expect(r.items[1].xmlName).toBe('b.xml');
  });
  it('segnala gli errori con codici chiari', () => {
    expect(loadInvoiceFile('x.xml', enc('<a><b></a>')).errors[0].code).toBe('invalidXml');
    expect(loadInvoiceFile('x.xml', enc('<root/>')).errors[0].code).toBe('notFattura');
    expect(loadInvoiceFile('x.pdf', enc('%PDF-1.7 ....')).errors[0].code).toBe('unrecognized');
    expect(loadInvoiceFile('x.p7m', Uint8Array.from([0x30, 0x03, 0x02, 0x01, 0x05])).errors[0].code).toBe('p7m');
    expect(loadInvoiceFile('x.xml', new Uint8Array(0)).errors[0].code).toBe('empty');
    expect(loadInvoiceFile('x.zip', zipSync({ 'a.txt': enc('x') })).errors[0].code).toBe('zipEmpty');
  });
  it('decodifica una codifica diversa da UTF-8', () => {
    const latin = Uint8Array.from([...enc('<?xml version="1.0" encoding="ISO-8859-1"?><a>caff'), 0xe8, ...enc('</a>')]);
    expect(decodeXmlBytes(latin)).toContain('caffè');
  });
});

describe('codici e formattazione', () => {
  it('descrive i codici in italiano e inglese', () => {
    expect(describeCode(TIPO_DOCUMENTO, 'TD04', 'it')).toBe('Nota di credito');
    expect(describeCode(TIPO_DOCUMENTO, 'TD04', 'en')).toBe('Credit note');
    expect(describeCode(MODALITA_PAGAMENTO, 'MP05', 'it')).toBe('Bonifico');
    expect(describeCode(NATURA, 'N6.3', 'en')).toContain('subcontracting');
    expect(describeCode(NATURA, 'XX', 'it')).toBe('');
  });
  it('copre tutte le tabelle principali', () => {
    for (let i = 1; i <= 23; i++) expect(MODALITA_PAGAMENTO['MP' + String(i).padStart(2, '0')]).toBeTruthy();
    for (const c of ['TD01', 'TD02', 'TD03', 'TD04', 'TD05', 'TD06', 'TD07', 'TD08', 'TD09', 'TD16', 'TD17', 'TD18', 'TD19', 'TD20', 'TD21', 'TD22', 'TD23', 'TD24', 'TD25', 'TD26', 'TD27', 'TD28', 'TD29']) {
      expect(TIPO_DOCUMENTO[c], c).toBeTruthy();
    }
  });
  it('formatta date, percentuali, IBAN e dimensioni Base64', () => {
    expect(formatDate('2026-03-15', 'it-IT')).toBe('15/03/2026');
    expect(formatDate('boh', 'it-IT')).toBe('boh');
    expect(formatPercent('22.00', 'it-IT')).toBe('22%');
    expect(groupIban('IT00A0000000000000000000000')).toBe('IT00 A000 0000 0000 0000 0000 000');
    expect(base64Size('QUJD')).toBe(3);
    expect(base64Size('QUI=')).toBe(2);
  });
  it('costruisce il riepilogo da copiare', () => {
    const f = parseFattura(fpr12());
    const t = (k: string) => k;
    const s = summaryText(f, 0, t, 'it', 'it-IT');
    expect(s).toContain('Fattura fe.number 2026/0042');
    expect(s).toContain('Alfa Servizi di Prova S.r.l.');
    expect(s).toContain('IBAN: IT00 A000');
  });
});
