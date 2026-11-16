// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  CfInput,
  analyzeCodiceFiscale,
  checkChar,
  computeCodiceFiscale,
  lettersOnly,
  nameCode,
  normalizeCode,
  omocodiaVariants,
  surnameCode,
} from './codice-fiscale';
import { PlacesFile, PlacesIndex } from './places';

// Persone e codici inventati: i luoghi sono veri (Roma H501, Milano F205), le persone no.
const TODAY = new Date(2026, 10, 15); // 15/11/2026

const base: CfInput = { surname: 'Rossi', name: 'Mario', sex: 'M', year: 1980, month: 1, day: 1, placeCode: 'H501' };
const code = (o: Partial<CfInput>): string => {
  const r = computeCodiceFiscale({ ...base, ...o });
  if (!r.ok) throw new Error('errori: ' + r.errors.join());
  return r.code;
};

const FILE: PlacesFile = {
  updated: '2026-01-01',
  source: 'prova',
  comuni: [
    ['Roma', 'H501', 'RM'],
    ['Milano', 'F205', 'MI'],
    ['Bolzano/Bozen', 'A952', 'BZ'],
    ['Sant\'Angelo Lodigiano', 'I388', 'LO'],
  ],
  soppressi: [['Comune di prova soppresso', 'M999', 'XX', 2019]],
  esteri: [['Stato di prova', 'Z999']],
};
const places = new PlacesIndex(FILE);

describe('lettersOnly', () => {
  it('toglie accenti, apostrofi, spazi e simboli', () => {
    expect(lettersOnly("D'Angelo-Müller Ñandú")).toBe('DANGELOMULLERNANDU');
    expect(lettersOnly('Àèìòù çÇ')).toBe('AEIOUCC');
    expect(lettersOnly('Straße')).toBe('STRASSE');
    expect(lettersOnly('  123 !? ')).toBe('');
  });
});

describe('codice del cognome', () => {
  it.each([
    ['Rossi', 'RSS'],
    ['Bianchi', 'BNC'],
    ['Verdi', 'VRD'],
    ['Fo', 'FOX'], // due lettere: consonante, vocale, X
    ['Li', 'LIX'],
    ['Ai', 'AIX'], // solo vocali
    ['E', 'EXX'],
    ['Eio', 'EIO'], // tre vocali
    ['Rosa', 'RSO'], // 2 consonanti + vocale
    ['De Rossi', 'DRS'], // spazio ignorato
    ["D'Angelo", 'DNG'], // apostrofo ignorato
    ['Dell\'Orto', 'DLL'],
    ['Bianchi Rossi', 'BNC'], // doppio cognome: contano tutte le consonanti in ordine
    ['Nicolò', 'NCL'], // accento
    ['MÜLLER', 'MLL'],
  ])('%s -> %s', (s, c) => expect(surnameCode(s)).toBe(c));
});

describe('codice del nome', () => {
  it.each([
    ['Mario', 'MRA'], // 2 consonanti + vocale
    ['Giovanni', 'GNN'], // G V N N: 1ª, 3ª, 4ª
    ['Francesco', 'FNC'], // F R N C S C
    ['Alessandro', 'LSN'], // L S S N D R
    ['Cristian', 'CST'], // C R S T N
    ['Franco', 'FNC'], // F R N C
    ['Marco', 'MRC'], // esattamente 3 consonanti: tutte
    ['Luca', 'LCU'],
    ['Anna', 'NNA'],
    ['Eva', 'VEA'],
    ['Io', 'IOX'],
    ['Li', 'LIX'],
    ['Gian Luca', 'GLC'], // spazio ignorato: G N L C
    ['Maria Grazia', 'MGR'], // M R G R Z
    ['Gian-Franco', 'GFR'], // G N F R N C
    ['Renée', 'RNE'],
  ])('%s -> %s', (s, c) => expect(nameCode(s)).toBe(c));
});

/** Implementazione indipendente del carattere di controllo, con le tabelle in forma diversa. */
function checkRef(first15: string): string {
  const oddByLetter = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];
  let sum = 0;
  [...first15].forEach((ch, i) => {
    const n = /\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 65; // posizione 0..25 (le cifre valgono come A..J)
    sum += (i + 1) % 2 === 1 ? oddByLetter[n] : n;
  });
  return String.fromCharCode(65 + (sum % 26));
}

describe('carattere di controllo', () => {
  it('caso di riferimento', () => {
    expect(checkChar('RSSMRA80A01H501')).toBe('U');
  });
  it('coincide con un\'implementazione indipendente su molti codici', () => {
    const surnames = ['Rossi', 'Bianchi', 'Fo', 'De Luca', 'Esposito', 'Ñandú'];
    const names = ['Mario', 'Anna', 'Io', 'Giovanni', 'Maria Grazia'];
    let n = 0;
    for (const sn of surnames)
      for (const nm of names)
        for (const place of ['H501', 'F205', 'Z999', 'A001'])
          for (const [year, month, day] of [[1980, 1, 1], [2005, 12, 31], [1999, 2, 28], [2000, 2, 29]]) {
            for (const sex of ['M', 'F'] as const) {
              const c = code({ surname: sn, name: nm, sex, year, month, day, placeCode: place });
              expect(c[15]).toBe(checkRef(c.slice(0, 15)));
              expect(c).toHaveLength(16);
              n++;
            }
          }
    expect(n).toBe(6 * 5 * 4 * 4 * 2);
  });
});

describe('calcolo', () => {
  it('Mario Rossi, Roma, 01/01/1980', () => {
    const r = computeCodiceFiscale(base);
    expect(r).toMatchObject({ ok: true, code: 'RSSMRA80A01H501U' });
    if (r.ok) expect(r.parts).toEqual({ surname: 'RSS', name: 'MRA', year: '80', month: 'A', day: '01', place: 'H501', check: 'U' });
  });
  it('le lettere dei mesi', () => {
    const letters = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => code({ month: m })[8]);
    expect(letters.join('')).toBe('ABCDEHLMPRST');
  });
  it('le donne hanno il giorno + 40 (anche il 31 diventa 71)', () => {
    expect(code({ sex: 'F' }).slice(9, 11)).toBe('41');
    expect(code({ sex: 'F', month: 3, day: 31 }).slice(9, 11)).toBe('71');
    expect(code({ sex: 'M', month: 3, day: 31 }).slice(9, 11)).toBe('31');
    expect(code({ sex: 'F', surname: 'Bianchi', name: 'Anna', year: 1991, month: 3, day: 31 }).slice(0, 11)).toBe('BNCNNA91C71');
  });
  it('anni: ultime due cifre, con zero iniziale', () => {
    expect(code({ year: 2005 }).slice(6, 8)).toBe('05');
    expect(code({ year: 2000 }).slice(6, 8)).toBe('00');
    expect(code({ year: 1999 }).slice(6, 8)).toBe('99');
    expect(code({ year: 1899 }).slice(6, 8)).toBe('99');
  });
  it('accenti, apostrofi e spazi non cambiano il risultato', () => {
    expect(code({ surname: "De' Rossì", name: 'Màrio' })).toBe(code({ surname: 'DE ROSSI', name: 'MARIO' }));
    expect(code({ surname: 'Rossi Bianchi', name: ' Mario  ' }).slice(0, 6)).toBe('RSSMRA');
  });
  it('nome e cognome corti, con una sola consonante o solo vocali', () => {
    const c = code({ surname: 'Fo', name: 'Io' });
    expect(c.slice(0, 6)).toBe('FOXIOX');
    expect(analyzeCodiceFiscale(c, TODAY).valid).toBe(true);
    expect(code({ surname: 'Ai', name: 'Eva' }).slice(0, 6)).toBe('AIXVEA');
  });
  it('luogo: minuscole accettate; Stato estero con codice Z', () => {
    expect(code({ placeCode: 'f205' }).slice(11, 15)).toBe('F205');
    expect(code({ placeCode: 'Z999' }).slice(11, 15)).toBe('Z999');
  });
  it('29 febbraio solo negli anni bisestili', () => {
    expect(computeCodiceFiscale({ ...base, year: 2000, month: 2, day: 29 }).ok).toBe(true);
    expect(computeCodiceFiscale({ ...base, year: 1900, month: 2, day: 29 })).toEqual({ ok: false, errors: ['date'] });
    expect(computeCodiceFiscale({ ...base, year: 1981, month: 2, day: 29 })).toEqual({ ok: false, errors: ['date'] });
  });
  it('errori sui dati mancanti o impossibili', () => {
    expect(computeCodiceFiscale({ ...base, surname: '12', name: '', placeCode: 'XX' })).toEqual({
      ok: false,
      errors: ['surname', 'name', 'place'],
    });
    expect(computeCodiceFiscale({ ...base, month: 13 })).toEqual({ ok: false, errors: ['date'] });
    expect(computeCodiceFiscale({ ...base, day: 31, month: 4 })).toEqual({ ok: false, errors: ['date'] });
    expect(computeCodiceFiscale({ ...base, sex: '' as 'M' })).toEqual({ ok: false, errors: ['sex'] });
  });
});

describe('verifica e decodifica', () => {
  it('codice valido: sesso, data, luogo', () => {
    const a = analyzeCodiceFiscale('RSSMRA80A01H501U', TODAY, places);
    expect(a.valid).toBe(true);
    expect(a.issues).toEqual([]);
    expect(a.sex).toBe('M');
    expect(a.birth).toEqual({ year: 1980, month: 1, day: 1 });
    expect(a.birthAlt).toBeUndefined(); // 2080 è nel futuro
    expect(a.placeCode).toBe('H501');
    expect(a.places?.map((p) => p.name)).toEqual(['Roma']);
    expect(a.omocodiaLevel).toBe(0);
    expect(a.baseCode).toBeUndefined();
  });
  it('accetta minuscole, spazi e separatori', () => {
    expect(analyzeCodiceFiscale(' rssmra80a01h501u ', TODAY).valid).toBe(true);
    expect(analyzeCodiceFiscale('RSS MRA 80A01 H501 U', TODAY).valid).toBe(true);
    expect(normalizeCode('rss-mra.80a01/h501 u')).toBe('RSSMRA80A01H501U');
  });
  it('donna: giorno oltre 40 e sesso F', () => {
    const c = code({ surname: 'Bianchi', name: 'Anna', sex: 'F', year: 1991, month: 3, day: 31, placeCode: 'F205' });
    const a = analyzeCodiceFiscale(c, TODAY, places);
    expect(a).toMatchObject({ valid: true, sex: 'F', birth: { year: 1991, month: 3, day: 31 } });
    expect(a.places?.[0].name).toBe('Milano');
  });
  it('lunghezza sbagliata, partita IVA, caratteri non ammessi, vuoto', () => {
    expect(analyzeCodiceFiscale('RSSMRA80A01H501', TODAY).issues).toEqual(['length']);
    expect(analyzeCodiceFiscale('RSSMRA80A01H501UU', TODAY).issues).toEqual(['length']);
    expect(analyzeCodiceFiscale('12345678903', TODAY).issues).toEqual(['is-vat']);
    expect(analyzeCodiceFiscale('RSSMRA80A01H501!', TODAY).issues).toEqual(['chars']);
    expect(analyzeCodiceFiscale('   ', TODAY).issues).toEqual(['empty']);
  });
  it('carattere di controllo errato: dice quello atteso', () => {
    const a = analyzeCodiceFiscale('RSSMRA80A01H501X', TODAY);
    expect(a.valid).toBe(false);
    expect(a.issues).toEqual(['check']);
    expect(a.expectedCheck).toBe('U');
    // la decodifica resta disponibile
    expect(a.birth).toEqual({ year: 1980, month: 1, day: 1 });
  });
  it('un carattere cambiato in un punto qualsiasi rompe quasi sempre il controllo', () => {
    // il carattere di controllo individua ogni singolo errore sulle posizioni dispari/pari non equivalenti;
    // qui si controlla solo che la modifica non resti "valida" per le cifre del giorno
    const a = analyzeCodiceFiscale('RSSMRA80A02H501U', TODAY);
    expect(a.valid).toBe(false);
    expect(a.issues).toContain('check');
  });
  it('struttura errata: cifre nel cognome, lettera di mese non valida, giorno impossibile', () => {
    expect(analyzeCodiceFiscale('R5SMRA80A01H501U', TODAY).issues).toContain('surname');
    expect(analyzeCodiceFiscale('RSSMR180A01H501U', TODAY).issues).toContain('name');
    expect(analyzeCodiceFiscale('RSSMRA80Z01H501U', TODAY).issues).toContain('month');
    expect(analyzeCodiceFiscale('RSSMRA80A00H501U', TODAY).issues).toContain('day');
    expect(analyzeCodiceFiscale('RSSMRA80A32H501U', TODAY).issues).toContain('day');
    expect(analyzeCodiceFiscale('RSSMRA80A40H501U', TODAY).issues).toContain('day');
    expect(analyzeCodiceFiscale('RSSMRA80A72H501U', TODAY).issues).toContain('day');
    expect(analyzeCodiceFiscale('RSSMRA80B30H501U', TODAY).issues).toContain('date'); // 30 febbraio... giorno valido ma data no
    expect(analyzeCodiceFiscale('RSSMRAAAA01H501U', TODAY).issues).toContain('year');
    expect(analyzeCodiceFiscale('RSSMRA80A01H5A1U', TODAY).issues).toContain('place');
    expect(analyzeCodiceFiscale('RSSMRA80A01*501U', TODAY).issues).toEqual(['chars']);
  });
  it('mese con 30 giorni e febbraio', () => {
    expect(analyzeCodiceFiscale('RSSMRA80D31H501U', TODAY).issues).toContain('date'); // 31 aprile
    expect(analyzeCodiceFiscale(code({ year: 2000, month: 2, day: 29 }), TODAY).valid).toBe(true);
  });
});

describe('secolo ambiguo', () => {
  const at = (yy: number, month: number, day: number, y = 2000 + yy) => {
    const c = code({ year: y, month, day });
    return analyzeCodiceFiscale(c, TODAY);
  };
  it('anno già passato nel 2000: più plausibile il 2000, alternativa il 1900', () => {
    const a = at(5, 6, 15);
    expect(a.birth).toEqual({ year: 2005, month: 6, day: 15 });
    expect(a.birthAlt).toEqual({ year: 1905, month: 6, day: 15 });
  });
  it('anno futuro nel 2000: solo il 1900', () => {
    const a = at(80, 6, 15, 1980);
    expect(a.birth?.year).toBe(1980);
    expect(a.birthAlt).toBeUndefined();
  });
  it('anno corrente: dipende dal giorno rispetto a oggi', () => {
    expect(at(26, 3, 1).birth?.year).toBe(2026);
    expect(at(26, 3, 1).birthAlt?.year).toBe(1926);
    expect(at(26, 12, 31).birth?.year).toBe(1926); // il 31/12/2026 non è ancora arrivato
    expect(at(26, 12, 31).birthAlt).toBeUndefined();
    expect(at(26, 11, 15).birth?.year).toBe(2026); // oggi
  });
  it('29 febbraio: il 1900 non era bisestile', () => {
    const a = at(0, 2, 29);
    expect(a.birth).toEqual({ year: 2000, month: 2, day: 29 });
    expect(a.birthAlt).toBeUndefined();
    const b = at(4, 2, 29);
    expect(b.birth?.year).toBe(2004);
    expect(b.birthAlt?.year).toBe(1904);
  });
});

describe('omocodia', () => {
  const orig = 'RSSMRA80A01H501U';
  const prefixes = [
    'RSSMRA80A01H50M', // livello 1: ultima cifra del codice catastale
    'RSSMRA80A01H5LM',
    'RSSMRA80A01HRLM',
    'RSSMRA80A0MHRLM', // livello 4: ultima cifra del giorno
    'RSSMRA80ALMHRLM',
    'RSSMRA8LALMHRLM', // livello 6: ultima cifra dell'anno
    'RSSMRAULALMHRLM', // livello 7: tutte le sette cifre
  ];
  it('genera i sette codici omocodici nell\'ordine usato dall\'Agenzia (da destra a sinistra)', () => {
    const v = omocodiaVariants(orig);
    expect(v).toHaveLength(7);
    expect(v.map((c) => c.slice(0, 15))).toEqual(prefixes);
    v.forEach((c) => expect(c[15]).toBe(checkRef(c.slice(0, 15))));
  });
  it.each([1, 2, 3, 4, 5, 6, 7])('livello %i: valido e decodifica come l\'originale', (level) => {
    const c = omocodiaVariants(orig)[level - 1];
    const a = analyzeCodiceFiscale(c, TODAY, places);
    expect(a.valid).toBe(true);
    expect(a.omocodiaLevel).toBe(level);
    expect(a.omocodiaNonStandard).toBe(false);
    expect(a.baseCode).toBe(orig);
    expect(a.sex).toBe('M');
    expect(a.birth).toEqual({ year: 1980, month: 1, day: 1 });
    expect(a.places?.[0].name).toBe('Roma');
  });
  it('da una variante si ottengono le stesse sette', () => {
    const v = omocodiaVariants(orig);
    expect(omocodiaVariants(v[2])).toEqual(v);
  });
  it('la sostituzione non da destra è valida ma segnalata', () => {
    // sostituisce solo la cifra dell'anno (posizione 7) e ricalcola il controllo
    const first15 = 'RSSMRA8LA01H501';
    const c = first15 + checkRef(first15);
    const a = analyzeCodiceFiscale(c, TODAY);
    expect(a.valid).toBe(true);
    expect(a.omocodiaLevel).toBe(1);
    expect(a.omocodiaNonStandard).toBe(true);
    expect(a.birth?.year).toBe(1980);
  });
  it('donna e giorno 71 in omocodia', () => {
    const c = code({ surname: 'Bianchi', name: 'Anna', sex: 'F', year: 1991, month: 3, day: 31 });
    const a = analyzeCodiceFiscale(omocodiaVariants(c)[4], TODAY); // livello 5: cifre del giorno sostituite
    expect(a).toMatchObject({ valid: true, sex: 'F', omocodiaLevel: 5, birth: { year: 1991, month: 3, day: 31 } });
  });
  it('lettera non ammessa al posto di una cifra', () => {
    expect(analyzeCodiceFiscale('RSSMRAA0A01H501U', TODAY).issues).toContain('year'); // A non è una cifra omocodica
    expect(analyzeCodiceFiscale('RSSMRA80A01HA01U', TODAY).issues).toContain('place');
  });
  it('un codice senza omocodia non ha varianti se non valido', () => {
    expect(omocodiaVariants('corto')).toEqual([]);
    expect(omocodiaVariants('RSSMRAAAA01H501U')).toEqual([]);
  });
});

describe('luogo di nascita nei dati', () => {
  it('comune soppresso e Stato estero', () => {
    const sop = analyzeCodiceFiscale(code({ placeCode: 'M999' }), TODAY, places);
    expect(sop.valid).toBe(true);
    expect(sop.places).toMatchObject([{ kind: 'soppresso', year: 2019 }]);
    const est = analyzeCodiceFiscale(code({ placeCode: 'Z999' }), TODAY, places);
    expect(est.places).toMatchObject([{ kind: 'estero', name: 'Stato di prova' }]);
  });
  it('codice non presente nell\'elenco: valido ma senza luogo; senza elenco: nessuna ricerca', () => {
    expect(analyzeCodiceFiscale(code({ placeCode: 'A000' }), TODAY, places)).toMatchObject({ valid: true, places: [] });
    expect(analyzeCodiceFiscale(code({ placeCode: 'A000' }), TODAY).places).toBeUndefined();
  });
});
