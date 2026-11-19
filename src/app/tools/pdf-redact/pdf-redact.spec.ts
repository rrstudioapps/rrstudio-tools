// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { countAreas, rectFromDrag, textHits } from './pdf-redact';

const near = (r: { x: number; y: number; w: number; h: number } | null, e: [number, number, number, number]): void => {
  expect(r).not.toBeNull();
  [r!.x, r!.y, r!.w, r!.h].forEach((v, k) => expect(v).toBeCloseTo(e[k], 9));
};

describe('rectFromDrag', () => {
  it('qualunque verso di trascinamento dà lo stesso rettangolo, nei limiti della pagina', () => {
    near(rectFromDrag(0.2, 0.3, 0.6, 0.5), [0.2, 0.3, 0.4, 0.2]);
    near(rectFromDrag(0.6, 0.5, 0.2, 0.3), [0.2, 0.3, 0.4, 0.2]);
    near(rectFromDrag(-0.5, 0.1, 2, 0.2), [0, 0.1, 1, 0.1]);
  });
  it('un clic senza trascinare non crea nulla', () => {
    expect(rectFromDrag(0.5, 0.5, 0.5, 0.5)).toBeNull();
    expect(rectFromDrag(0.5, 0.5, 0.501, 0.9)).toBeNull();
  });
});

describe('textHits', () => {
  const item = { str: 'Codice fiscale RSSMRA80A01H501U del cliente', transform: [10, 0, 0, 10, 50, 700], width: 420, height: 10 };
  it('trova ogni occorrenza senza badare alle maiuscole', () => {
    const hits = textHits([item, { ...item, transform: [10, 0, 0, 10, 50, 500] }], 'rssmra80a01h501u', 600, 800);
    expect(hits).toHaveLength(2);
    // dentro la pagina, a destra dell'inizio dell'elemento e più in alto del secondo
    expect(hits[0].x).toBeGreaterThan(50 / 600);
    expect(hits[0].y).toBeLessThan(hits[1].y);
    expect(hits[0].w).toBeCloseTo((16 * (420 / item.str.length) + 3) / 600, 3);
  });
  it('più occorrenze nello stesso elemento e query vuota', () => {
    expect(textHits([{ ...item, str: 'ab ab ab', width: 80 }], 'ab', 600, 800)).toHaveLength(3);
    expect(textHits([item], '   ', 600, 800)).toEqual([]);
    expect(textHits([item], 'assente', 600, 800)).toEqual([]);
  });
});

describe('countAreas', () => {
  it('conta aree e pagine toccate', () => {
    expect(countAreas({ 0: [{ x: 0, y: 0, w: 1, h: 1 }], 2: [], 3: [{ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 }] })).toEqual({ areas: 3, pages: 2 });
  });
});
