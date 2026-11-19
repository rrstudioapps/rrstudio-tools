// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Disposizione delle immagini sulle pagine di un PDF (misure in punti PDF: 1 pt = 1/72 pollice). */
export type PageFormat = 'a4' | 'letter' | 'fit';
export type Orientation = 'auto' | 'portrait' | 'landscape';
export type PerPage = 1 | 2 | 4;

export interface LayoutOptions {
  format: PageFormat;
  orientation: Orientation;
  /** Margine in millimetri. */
  marginMm: number;
  perPage: PerPage;
}

export interface Size {
  width: number;
  height: number;
}

export interface Placement {
  /** Indice dell'immagine nell'elenco di partenza. */
  index: number;
  /** Angolo in basso a sinistra (le coordinate PDF partono dal basso). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PagePlan {
  width: number;
  height: number;
  placements: Placement[];
}

export const MM = 72 / 25.4;
export const PAGE_SIZES: Record<'a4' | 'letter', Size> = {
  a4: { width: 210 * MM, height: 297 * MM },
  letter: { width: 612, height: 792 },
};
/** Per "adatta all'immagine": 150 dpi, con lato massimo di 3000 pt (limite pratico dei lettori PDF). */
const FIT_DPI = 150;
const FIT_MAX = 3000;

export const MARGINS_MM = [0, 5, 10, 20] as const;

/** Numero di pagine necessarie. */
export function pageCount(images: number, perPage: PerPage, format: PageFormat): number {
  const n = format === 'fit' ? 1 : perPage;
  return Math.ceil(images / n);
}

/** Dimensione della pagina "adatta all'immagine": l'immagine a 150 dpi più i margini. */
export function fitPageSize(img: Size, marginMm: number): Size {
  const scale = Math.min(72 / FIT_DPI, FIT_MAX / Math.max(img.width, img.height));
  const m = marginMm * MM;
  return { width: img.width * scale + 2 * m, height: img.height * scale + 2 * m };
}

/** Rientra un rettangolo nel riquadro dato, centrato, senza ingrandire oltre il riquadro. */
function contain(img: Size, box: { x: number; y: number; width: number; height: number }) {
  const s = Math.min(box.width / img.width, box.height / img.height);
  const width = img.width * s;
  const height = img.height * s;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

/**
 * Calcola le pagine. Con "adatta" ogni immagine ha una pagina della sua misura (una per pagina).
 * Con A4/Letter l'orientamento "auto" segue le immagini del foglio (verticale se prevalgono le
 * verticali o in parità). Con 2 per pagina le immagini stanno una sopra l'altra (verticale) o
 * affiancate (orizzontale); con 4 in griglia 2 × 2. Tra le celle c'è lo stesso spazio del margine.
 */
export function layoutPages(images: readonly Size[], o: LayoutOptions): PagePlan[] {
  const m = o.marginMm * MM;
  const plans: PagePlan[] = [];
  if (o.format === 'fit') {
    images.forEach((img, index) => {
      const page = fitPageSize(img, o.marginMm);
      plans.push({ ...page, placements: [{ index, x: m, y: m, width: page.width - 2 * m, height: page.height - 2 * m }] });
    });
    return plans;
  }
  const base = PAGE_SIZES[o.format];
  for (let start = 0; start < images.length; start += o.perPage) {
    const group = images.slice(start, start + o.perPage);
    let landscape: boolean;
    if (o.orientation === 'auto') {
      const wide = group.filter((g) => g.width > g.height).length;
      landscape = wide > group.length - wide;
    } else landscape = o.orientation === 'landscape';
    const page: Size = landscape ? { width: base.height, height: base.width } : { ...base };
    const [cols, rows] = o.perPage === 1 ? [1, 1] : o.perPage === 4 ? [2, 2] : landscape ? [2, 1] : [1, 2];
    const gap = o.perPage === 1 ? 0 : m;
    const cellW = (page.width - 2 * m - gap * (cols - 1)) / cols;
    const cellH = (page.height - 2 * m - gap * (rows - 1)) / rows;
    const placements = group.map((img, k) => {
      const col = k % cols;
      const row = Math.floor(k / cols);
      const box = {
        x: m + col * (cellW + gap),
        // le righe si contano dall'alto, le coordinate PDF dal basso
        y: page.height - m - (row + 1) * cellH - row * gap,
        width: cellW,
        height: cellH,
      };
      return { index: start + k, ...contain(img, box) };
    });
    plans.push({ ...page, placements });
  }
  return plans;
}
