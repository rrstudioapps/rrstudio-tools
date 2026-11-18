// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { validateState } from '../../shared/share-state';
import { SHARE_SCHEMA } from './pdf-to-text.share';
import {
  DEFAULT_OPTIONS,
  composeMarkdown,
  composeText,
  countWords,
  describePages,
  extractDocument,
  findGutter,
  linesToText,
  pageToLines,
  repeatKey,
  repeatedKeys,
  type RawItem,
  type TextOptions,
} from './pdf-to-text';

/** Elemento finto: larghezza proporzionale alla lunghezza (6 per carattere), corpo 10. */
const it_ = (str: string, x: number, y: number, width = str.length * 6): RawItem => ({ str, x, y, width, height: 10 });

/** Una riga di parole sparse come le darebbe pdf.js (un elemento per parola, senza spazi nel testo). */
const words = (text: string, x: number, y: number): RawItem[] => {
  const out: RawItem[] = [];
  let cx = x;
  for (const w of text.split(' ')) {
    out.push(it_(w, cx, y));
    cx += w.length * 6 + 3;
  }
  return out;
};

const opts = (o: Partial<TextOptions> = {}): TextOptions => ({ ...DEFAULT_OPTIONS, ...o });
const text = (items: RawItem[], o: Partial<TextOptions> = {}) => extractDocument([{ number: 1, items }], opts(o)).pages[0].text;

describe('righe', () => {
  it('raggruppa per ordinata con tolleranza e ordina per ascissa', () => {
    // gli elementi arrivano mescolati e con una ordinata leggermente diversa (apice)
    const items = [it_('mondo', 47, 700), it_('Ciao', 20, 701.5), it_('Seconda', 20, 686), it_('riga', 68, 686.2)];
    expect(text(items, { layout: 'keep' })).toContain('Ciao mondo');
    expect(text(items, { layout: 'keep' }).split('\n')).toEqual(['Ciao mondo', 'Seconda riga']);
  });

  it('mette uno spazio solo dove c\'è un vuoto', () => {
    const items = [it_('Cia', 20, 700), it_('o', 38, 700), it_('mondo', 60, 700)];
    // «Cia» + «o» attaccati; poi un vuoto prima di «mondo»
    expect(text(items)).toBe('Ciao mondo');
  });

  it('non raddoppia gli spazi già presenti nel testo', () => {
    const items = [it_('Ciao ', 20, 700), it_('mondo', 50, 700)];
    expect(text(items)).toBe('Ciao mondo');
  });

  it('ignora gli elementi vuoti e solo spazi', () => {
    const items = [it_('', 10, 700), it_('   ', 12, 700), it_('Testo', 20, 700)];
    expect(text(items)).toBe('Testo');
  });
});

describe('paragrafi', () => {
  const lines = (n: number, y0: number, gap: number, label: string) => Array.from({ length: n }, (_, i) => words(`${label} riga ${i + 1} del testo`, 20, y0 - i * gap)).flat();

  it('in modalità fluida unisce le righe e separa i paragrafi al salto verticale', () => {
    // interlinea 14, tra i due paragrafi 34
    const items = [...lines(3, 700, 14, 'Primo'), ...lines(3, 700 - 2 * 14 - 34, 14, 'Secondo')];
    const out = text(items, { layout: 'flow' });
    expect(out.split('\n\n')).toEqual(['Primo riga 1 del testo Primo riga 2 del testo Primo riga 3 del testo', 'Secondo riga 1 del testo Secondo riga 2 del testo Secondo riga 3 del testo']);
  });

  it('in modalità mantieni lascia una riga per riga e una riga vuota al salto', () => {
    const items = [...lines(2, 700, 14, 'A'), ...lines(2, 700 - 14 - 34, 14, 'B')];
    expect(text(items, { layout: 'keep' })).toBe('A riga 1 del testo\nA riga 2 del testo\n\nB riga 1 del testo\nB riga 2 del testo');
  });

  it('una riga corta che chiude con un punto finisce il capoverso (modalità fluida)', () => {
    const items = [...words('Una riga lunga che riempie quasi tutta la larghezza disponibile', 20, 700), ...words('Fine.', 20, 686), ...words('Nuovo capoverso qui', 20, 672)];
    expect(text(items, { layout: 'flow' }).split('\n\n')).toHaveLength(2);
  });
});

describe('paragrafi con poche righe', () => {
  it('un titolo staccato dal corpo resta un paragrafo a sé anche con intestazione e piè di pagina', () => {
    const items = [...words('Intestazione', 20, 800), ...words('Titolo grande', 20, 700), ...words('Prima riga', 20, 650), ...words('Seconda riga', 20, 634), ...words('Altro paragrafo', 20, 586)];
    expect(text(items, { stripRepeated: false }).split('\n\n')).toEqual(['Intestazione', 'Titolo grande', 'Prima riga Seconda riga', 'Altro paragrafo']);
  });
});

describe('impaginazione', () => {
  it('approssima con gli spazi la distanza fra gli elementi', () => {
    const items = [it_('Voce', 20, 700), it_('Importo', 140, 700), it_('Pane', 20, 686), it_('2,50', 140, 686)];
    const out = text(items, { layout: 'keep' }).split('\n');
    expect(out[0].indexOf('Importo')).toBe(out[1].indexOf('2,50'));
    expect(out[0].indexOf('Importo')).toBeGreaterThan(10);
  });

  it('un rientro a sinistra si conserva rispetto al margine', () => {
    const items = [it_('Titolo', 20, 700), it_('rientrato', 56, 686)];
    expect(text(items, { layout: 'keep' }).split('\n')[1].startsWith('      rientrato')).toBe(true);
  });
});

describe('trattini a fine riga', () => {
  const split = [...words('Questo è un esempio di parola spez-', 20, 700), ...words('zata e di altro testo', 20, 686)];

  it('unisce la parola spezzata quando la riga dopo comincia con una minuscola', () => {
    expect(text(split, { layout: 'flow', dehyphenate: true })).toBe('Questo è un esempio di parola spezzata e di altro testo');
  });

  it('con l\'opzione spenta lascia il trattino', () => {
    expect(text(split, { layout: 'flow', dehyphenate: false })).toBe('Questo è un esempio di parola spez- zata e di altro testo');
  });

  it('non unisce se la riga dopo comincia con una maiuscola o un numero', () => {
    const a = [...words('Il periodo 2020-', 20, 700), ...words('2024 è lungo', 20, 686)];
    expect(text(a, { dehyphenate: true })).toBe('Il periodo 2020- 2024 è lungo');
    const b = [...words('Anglo-', 20, 700), ...words('Americano', 20, 686)];
    expect(text(b, { dehyphenate: true })).toBe('Anglo- Americano');
  });

  it('in modalità mantieni sposta la prima parola sulla riga precedente', () => {
    const out = text(split, { layout: 'keep', dehyphenate: true });
    expect(out.split('\n')[0]).toBe('Questo è un esempio di parola spezzata');
    expect(out.split('\n')[1].trim()).toBe('e di altro testo');
  });

  it('riconosce anche il trattino morbido', () => {
    const a = [...words('parola spez­', 20, 700), ...words('zata', 20, 686)];
    expect(text(a)).toBe('parola spezzata');
  });
});

describe('colonne', () => {
  /** Pagina con due colonne di testo da 8 righe: sinistra a x=20, destra a x=320. */
  const twoCols = (): RawItem[] => {
    const out: RawItem[] = [];
    for (let i = 0; i < 8; i++) {
      out.push(...words(`Sinistra ${i + 1} alfa beta`, 20, 700 - i * 14));
      out.push(...words(`Destra ${i + 1} gamma delta`, 320, 700 - i * 14));
    }
    return out;
  };

  it('trova il canale fra due colonne', () => {
    const g = findGutter(twoCols().map((i) => ({ ...i, str: i.str })));
    expect(g).not.toBeNull();
    expect(g!).toBeGreaterThan(150);
    expect(g!).toBeLessThan(320);
  });

  it('legge prima tutta la colonna sinistra e poi la destra', () => {
    const out = text(twoCols(), { layout: 'keep', columns: true });
    expect(out.indexOf('Sinistra 8')).toBeLessThan(out.indexOf('Destra 1'));
    expect(out.indexOf('Sinistra 1')).toBeLessThan(out.indexOf('Sinistra 2'));
  });

  it('con l\'opzione spenta legge riga per riga attraverso le colonne', () => {
    const out = text(twoCols(), { layout: 'keep', columns: false });
    expect(out.indexOf('Destra 1')).toBeLessThan(out.indexOf('Sinistra 2'));
  });

  it('un titolo a tutta larghezza in cima resta in cima', () => {
    const items = [it_('Titolo che attraversa entrambe le colonne della pagina intera', 20, 740, 500), ...twoCols()];
    const out = text(items, { layout: 'keep', columns: true });
    expect(out.startsWith('Titolo')).toBe(true);
    expect(out.indexOf('Sinistra 8')).toBeLessThan(out.indexOf('Destra 1'));
  });

  it('un testo a colonna singola non viene diviso', () => {
    const items: RawItem[] = [];
    for (let i = 0; i < 12; i++) items.push(...words(`Riga numero ${i + 1} di un testo lungo che occupa tutta la larghezza della pagina`, 20, 700 - i * 14));
    expect(findGutter(items)).toBeNull();
    const out = extractDocument([{ number: 1, items }], opts({ layout: 'keep' }));
    expect(out.twoColumnPages).toBe(0);
  });

  it('una riga che attraversa il canale in mezzo alle colonne annulla l\'ordine a colonne', () => {
    const items = [...twoCols(), it_('Riga a tutta larghezza fra le due colonne ' + 'x'.repeat(40), 20, 700 - 4 * 14 - 7, 500)];
    expect(extractDocument([{ number: 1, items }], opts()).twoColumnPages).toBe(0);
  });
});

describe('intestazioni e piè di pagina ripetuti', () => {
  const page = (n: number, body: string): RawItem[] => [
    ...words('Rapporto annuale', 20, 800),
    ...words(body, 20, 700),
    ...words(`Pagina ${n} di 4`, 20, 30),
  ];

  it('toglie le righe ripetute in alto e in basso (numeri compresi)', () => {
    const doc = extractDocument(
      [1, 2, 3, 4].map((n) => ({ number: n, items: page(n, `Contenuto unico ${'x'.repeat(n)} qui`) })),
      opts({ stripRepeated: true }),
    );
    for (const p of doc.pages) {
      expect(p.text).not.toContain('Rapporto');
      expect(p.text).not.toContain('Pagina');
      expect(p.text).toContain('Contenuto unico');
    }
  });

  it('con l\'opzione spenta le lascia', () => {
    const doc = extractDocument(
      [1, 2, 3, 4].map((n) => ({ number: n, items: page(n, `Contenuto ${n}`) })),
      opts({ stripRepeated: false }),
    );
    expect(doc.pages[0].text).toContain('Rapporto annuale');
    expect(doc.pages[0].text).toContain('Pagina 1 di 4');
  });

  it('non toglie una riga che compare in meno della metà delle pagine', () => {
    const pages = [1, 2, 3, 4].map((n) => ({ number: n, items: n <= 1 ? page(n, 'x') : [...words('Solo corpo del testo', 20, 700)] }));
    const doc = extractDocument(pages, opts());
    expect(doc.pages[0].text).toContain('Rapporto annuale');
  });

  it('con meno di tre pagine non decide', () => {
    const pages = [1, 2].map((n) => pageToLines(page(n, 'corpo')));
    expect(repeatedKeys(pages).size).toBe(0);
  });

  it('repeatKey ignora i numeri e le maiuscole', () => {
    expect(repeatKey('Pagina 12 di 40')).toBe(repeatKey('PAGINA 3 DI 40'));
  });

  it('non tocca le righe del corpo uguali fra loro', () => {
    // la stessa riga ripetuta nel corpo (non in cima né in fondo) resta
    const body = (n: number) => [...words('Intestazione', 20, 800), ...words('Prima ' + 'x'.repeat(n), 20, 700), ...words('Ripetuta nel corpo', 20, 600), ...words('Altra riga ' + 'y'.repeat(n), 20, 500), ...words('Ancora ' + 'z'.repeat(n), 20, 400), ...words('Fine ' + 'w'.repeat(n), 20, 30)];
    const doc = extractDocument([1, 2, 3].map((n) => ({ number: n, items: body(n) })), opts());
    expect(doc.pages[0].text).toContain('Ripetuta nel corpo');
    expect(doc.pages[0].text).not.toContain('Intestazione');
  });
});

describe('pagine senza testo', () => {
  it('una pagina senza elementi non ha testo', () => {
    const doc = extractDocument(
      [
        { number: 1, items: words('Testo vero', 20, 700) },
        { number: 2, items: [] },
        { number: 3, items: [it_('   ', 20, 700)] },
      ],
      opts(),
    );
    expect(doc.withText).toBe(1);
    expect(doc.withoutText).toBe(2);
    expect(doc.pages.map((p) => p.hasText)).toEqual([true, false, false]);
    expect(doc.pages[1].text).toBe('');
  });

  it('un documento tutto senza testo', () => {
    const doc = extractDocument([{ number: 1, items: [] }], opts());
    expect(doc.withText).toBe(0);
    expect(doc.withoutText).toBe(1);
  });
});

describe('uscita', () => {
  const pages = [
    { number: 1, text: 'Uno', hasText: true },
    { number: 2, text: '', hasText: false },
    { number: 3, text: 'Tre', hasText: true },
  ];

  it('testo con separatori di pagina', () => {
    expect(composeText(pages, { markers: true, pageLabel: 'Pagina' })).toBe('--- Pagina 1 ---\n\nUno\n\n--- Pagina 2 ---\n\n--- Pagina 3 ---\n\nTre');
  });

  it('testo senza separatori: le pagine vuote spariscono', () => {
    expect(composeText(pages, { markers: false, pageLabel: 'Pagina' })).toBe('Uno\n\nTre');
  });

  it('markdown con titolo e titoli di pagina', () => {
    expect(composeMarkdown('Contratto.pdf', pages, 'Pagina')).toBe('# Contratto.pdf\n\n## Pagina 1\n\nUno\n\n## Pagina 2\n\n## Pagina 3\n\nTre\n');
  });

  it('conta le parole', () => {
    expect(countWords('uno  due\ntre')).toBe(3);
    expect(countWords('   ')).toBe(0);
  });

  it('descrive le pagine a intervalli', () => {
    expect(describePages([1, 2, 3, 5, 7, 8])).toBe('1-3, 5, 7-8');
    expect(describePages([])).toBe('');
  });
});

describe('linesToText', () => {
  it('una pagina senza righe dà una stringa vuota', () => {
    expect(linesToText({ lines: [], charWidth: 6, hasText: false, twoColumns: false }, { layout: 'flow', dehyphenate: true })).toBe('');
  });
});

describe('link di condivisione', () => {
  it('accetta le opzioni e scarta valori non validi', () => {
    expect(validateState(SHARE_SCHEMA, { layout: 'keep', dehyphenate: false, markers: true, stripRepeated: true, columns: false, pages: '1-3, 5' })).toEqual({
      layout: 'keep',
      dehyphenate: false,
      markers: true,
      stripRepeated: true,
      columns: false,
      pages: '1-3, 5',
    });
    expect(validateState(SHARE_SCHEMA, { layout: 'zip' })).toBeNull();
    expect(validateState(SHARE_SCHEMA, { pages: 'abc' })).toBeNull();
  });

  it('non prevede campi per file, testo o password', () => {
    expect(Object.keys(SHARE_SCHEMA).sort()).toEqual(['columns', 'dehyphenate', 'layout', 'markers', 'pages', 'stripRepeated']);
  });
});
