// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { IBAN_COUNTRIES, analyzeIban, bbanMismatch, formatIban, ibanCheckDigits, italianCin, mod97, normalizeIban } from './iban';

/** IBAN di esempio pubblici (registro IBAN SWIFT, documentazione ECBS e delle banche centrali). */
const EXAMPLES: Record<string, string> = {
  AD: 'AD1200012030200359100100',
  AE: 'AE070331234567890123456',
  AL: 'AL47212110090000000235698741',
  AT: 'AT611904300234573201',
  AZ: 'AZ21NABZ00000000137010001944',
  BA: 'BA391290079401028494',
  BE: 'BE68539007547034',
  BG: 'BG80BNBG96611020345678',
  BH: 'BH67BMAG00001299123456',
  BR: 'BR1800360305000010009795493C1',
  BY: 'BY13NBRB3600900000002Z00AB00',
  CH: 'CH9300762011623852957',
  CR: 'CR05015202001026284066',
  CY: 'CY17002001280000001200527600',
  CZ: 'CZ6508000000192000145399',
  DE: 'DE89370400440532013000',
  DK: 'DK5000400440116243',
  DO: 'DO28BAGR00000001212453611324',
  EE: 'EE382200221020145685',
  EG: 'EG380019000500000000263180002',
  ES: 'ES9121000418450200051332',
  FI: 'FI2112345600000785',
  FO: 'FO6264600001631634',
  FR: 'FR1420041010050500013M02606',
  GB: 'GB82WEST12345698765432',
  GE: 'GE29NB0000000101904917',
  GI: 'GI75NWBK000000007099453',
  GL: 'GL8964710001000206',
  GR: 'GR1601101250000000012300695',
  GT: 'GT82TRAJ01020000001210029690',
  HR: 'HR1210010051863000160',
  HU: 'HU42117730161111101800000000',
  IE: 'IE29AIBK93115212345678',
  IL: 'IL620108000000099999999',
  IQ: 'IQ98NBIQ850123456789012',
  IS: 'IS140159260076545510730339',
  IT: 'IT60X0542811101000000123456',
  JO: 'JO94CBJO0010000000000131000302',
  KW: 'KW81CBKU0000000000001234560101',
  KZ: 'KZ86125KZT5004100100',
  LB: 'LB62099900000001001901229114',
  LC: 'LC55HEMM000100010012001200023015',
  LI: 'LI21088100002324013AA',
  LT: 'LT121000011101001000',
  LU: 'LU280019400644750000',
  LV: 'LV80BANK0000435195001',
  LY: 'LY83002048000020100120361',
  MC: 'MC5811222000010123456789030',
  MD: 'MD24AG000225100013104168',
  ME: 'ME25505000012345678951',
  MK: 'MK07250120000058984',
  MR: 'MR1300020001010000123456753',
  MT: 'MT84MALT011000012345MTLCAST001S',
  MU: 'MU17BOMM0101101030300200000MUR',
  NL: 'NL91ABNA0417164300',
  NO: 'NO9386011117947',
  PK: 'PK36SCBL0000001123456702',
  PL: 'PL61109010140000071219812874',
  PS: 'PS92PALS000000000400123456702',
  PT: 'PT50000201231234567890154',
  QA: 'QA58DOHB00001234567890ABCDEFG',
  RO: 'RO49AAAA1B31007593840000',
  RS: 'RS35260005601001611379',
  RU: 'RU0304452522540817810538091310419',
  SA: 'SA0380000000608010167519',
  SC: 'SC18SSCB11010000000000001497USD',
  SD: 'SD2129010501234001',
  SE: 'SE4550000000058398257466',
  SI: 'SI56263300012039086',
  SK: 'SK3112000000198742637541',
  SM: 'SM86U0322509800000000270100',
  ST: 'ST68000100010051845310112',
  SV: 'SV62CENR00000000000000700025',
  TL: 'TL380080012345678910157',
  TN: 'TN5910006035183598478831',
  TR: 'TR330006100519786457841326',
  UA: 'UA213223130000026007233566001',
  VA: 'VA59001123000012345678',
  VG: 'VG96VPVG0000012345678901',
  XK: 'XK051212012345678906',
};

describe('tabella dei paesi', () => {
  it('la lunghezza di ogni formato BBAN coincide con la lunghezza dell\'IBAN meno 4', () => {
    for (const [cc, spec] of Object.entries(IBAN_COUNTRIES)) {
      if (!spec.bban) continue;
      const total = [...spec.bban.matchAll(/(\d+)[nac]/g)].reduce((s, m) => s + Number(m[1]), 0);
      expect(total, cc).toBe(spec.length - 4);
    }
  });
  it('un IBAN costruito dal formato con cifre di controllo calcolate è valido, per ogni paese', () => {
    for (const [cc, spec] of Object.entries(IBAN_COUNTRIES)) {
      let bban = '';
      for (const [, count, kind] of spec.bban!.matchAll(/(\d+)([nac])/g)) {
        for (let i = 0; i < Number(count); i++) bban += kind === 'n' ? String((i * 7 + 3) % 10) : kind === 'a' ? 'K' : i % 2 ? '5' : 'M';
      }
      if (cc === 'IT') bban = italianCin(bban.slice(1)) + bban.slice(1); // il CIN italiano deve tornare
      const iban = cc + ibanCheckDigits(cc, bban) + bban;
      const a = analyzeIban(iban);
      expect(a.issues, iban).toEqual([]);
      expect(a.valid).toBe(true);
    }
  });
  it('contiene i paesi SEPA principali e quelli extra-SEPA', () => {
    expect(Object.keys(IBAN_COUNTRIES).length).toBeGreaterThanOrEqual(75);
    for (const cc of ['IT', 'DE', 'FR', 'ES', 'NL', 'BE', 'AT', 'PT', 'IE', 'LU', 'GB', 'CH', 'SM', 'VA']) expect(IBAN_COUNTRIES[cc].sepa, cc).toBe(true);
    for (const cc of ['TR', 'BR', 'SA', 'AE', 'UA']) expect(IBAN_COUNTRIES[cc].sepa, cc).toBe(false);
  });
});

describe('IBAN di esempio pubblici', () => {
  it.each(Object.entries(EXAMPLES))('%s: %s', (cc, iban) => {
    const a = analyzeIban(iban);
    expect(a.issues).toEqual([]);
    expect(a.valid).toBe(true);
    expect(a.country).toBe(cc);
    expect(a.length).toBe(IBAN_COUNTRIES[cc].length);
    expect(mod97(iban)).toBe(1);
  });
  it('gli esempi coprono tutti i paesi della tabella', () => {
    expect(Object.keys(EXAMPLES).sort()).toEqual(Object.keys(IBAN_COUNTRIES).sort());
  });
});

describe('normalizzazione e formattazione', () => {
  it('spazi, minuscole, trattini e etichetta', () => {
    expect(normalizeIban('de89 3704 0044 0532 0130 00')).toBe('DE89370400440532013000');
    expect(normalizeIban('  IBAN: it60-x054 2811 1010 0000 0123 456 ')).toBe('IT60X0542811101000000123456');
    expect(normalizeIban('gb82 west\n1234 5698 7654 32')).toBe('GB82WEST12345698765432');
  });
  it('gruppi di quattro', () => {
    expect(formatIban('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
    expect(formatIban('NO9386011117947')).toBe('NO93 8601 1117 947');
    expect(formatIban('ABCD')).toBe('ABCD');
    expect(formatIban('')).toBe('');
    expect(analyzeIban('it60x0542811101000000123456').formatted).toBe('IT60 X054 2811 1010 0000 0123 456');
  });
  it('mod 97 su un esempio noto e uno modificato', () => {
    expect(mod97('GB82WEST12345698765432')).toBe(1);
    expect(mod97('GB83WEST12345698765432')).not.toBe(1);
  });
});

describe('IBAN italiano', () => {
  it('scomposizione in CIN, ABI, CAB e conto', () => {
    const a = analyzeIban('IT60 X054 2811 1010 0000 0123 456');
    expect(a.valid).toBe(true);
    expect(a.sepa).toBe(true);
    expect(a.it).toEqual({ cin: 'X', abi: '05428', cab: '11101', account: '000000123456', expectedCin: 'X' });
  });
  it('CIN calcolato', () => {
    expect(italianCin('0542811101000000123456')).toBe('X');
  });
  it('CIN sbagliato anche se il mod-97 torna (cifre di controllo ricalcolate)', () => {
    const bban = 'Y0542811101000000123456';
    const iban = 'IT' + ibanCheckDigits('IT', bban) + bban;
    const a = analyzeIban(iban);
    expect(a.mod97Ok).toBe(true);
    expect(a.issues).toEqual(['cin']);
    expect(a.valid).toBe(false);
    expect(a.it?.expectedCin).toBe('X');
  });
  it('conto con lettere', () => {
    const bban = 'X05428111010000AB0123456'.slice(0, 23);
    const cin = italianCin(bban.slice(1));
    const full = cin + bban.slice(1);
    const iban = 'IT' + ibanCheckDigits('IT', full) + full;
    expect(analyzeIban(iban)).toMatchObject({ valid: true, it: { account: bban.slice(11) } });
  });
});

describe('errori', () => {
  it('vuoto', () => expect(analyzeIban('  ').issues).toEqual(['empty']));
  it('caratteri non ammessi', () => {
    expect(analyzeIban('DE89 3704 0044 0532 0130 0!').issues).toEqual(['chars']);
    expect(analyzeIban('DE89_370400440532013000').issues).toEqual(['chars']);
  });
  it('non inizia con un codice paese', () => {
    expect(analyzeIban('12345678901234').issues).toEqual(['country-format']);
  });
  it('paese sconosciuto', () => {
    expect(analyzeIban('ZZ89370400440532013000')).toMatchObject({ valid: false, issues: ['country-unknown'], country: 'ZZ' });
  });
  it('lunghezza: troppo corto e troppo lungo, con quella attesa', () => {
    const short = analyzeIban('DE8937040044053201300');
    expect(short.issues).toEqual(['length']);
    expect(short).toMatchObject({ length: 21, expectedLength: 22 });
    expect(analyzeIban('DE893704004405320130001').issues).toEqual(['length']);
    expect(analyzeIban('IT60').issues).toEqual(['length']);
    expect(analyzeIban('IT').issues).toEqual(['length']);
  });
  it('cifre di controllo non numeriche', () => {
    expect(analyzeIban('DEXX370400440532013000').issues).toEqual(['check-format']);
  });
  it('cifre di controllo (mod 97) sbagliate: una cifra cambiata', () => {
    const a = analyzeIban('DE89370400440532013001');
    expect(a.valid).toBe(false);
    expect(a.issues).toEqual(['mod97']);
    expect(a.mod97Ok).toBe(false);
    // lo strumento non propone mai un IBAN "corretto"
    expect(JSON.stringify(a)).not.toContain('DE89370400440532013000');
  });
  it('ogni singola cifra cambiata in un IBAN valido viene scoperta (mod 97 individua tutti gli errori singoli)', () => {
    const ok = 'DE89370400440532013000';
    for (let i = 2; i < ok.length; i++) {
      for (const d of '0123456789') {
        if (d === ok[i]) continue;
        if (!/\d/.test(ok[i])) continue;
        const bad = ok.slice(0, i) + d + ok.slice(i + 1);
        expect(analyzeIban(bad).valid, bad).toBe(false);
      }
    }
  });
  it('due cifre scambiate: spesso il controllo non basta, ma il caso comune è coperto', () => {
    expect(analyzeIban('DE89370400440532013000').valid).toBe(true);
    expect(analyzeIban('DE89370400445032013000').valid).toBe(false);
  });
  it('formato del BBAN: lettera dove servono cifre, con la posizione', () => {
    const bban = '3704004405A2013000';
    const a = analyzeIban('DE' + ibanCheckDigits('DE', bban) + bban);
    expect(a.issues).toEqual(['bban-format']);
    expect(a.badPosition).toBe(15);
  });
  it('bbanMismatch', () => {
    expect(bbanMismatch('WEST12345698765432', '4a6n8n')).toBe(-1);
    expect(bbanMismatch('WES112345698765432', '4a6n8n')).toBe(3);
    expect(bbanMismatch('', '4a')).toBe(0);
  });
  it('IBAN italiano con IBAN troppo corto: nessuna scomposizione', () => {
    expect(analyzeIban('IT60X05428111010000001234').it).toBeUndefined();
  });
});
