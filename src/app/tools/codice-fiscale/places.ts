// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Luogo di nascita: comune attuale, comune soppresso o Stato estero (codice catastale / codice Z). */
export interface Place {
  kind: 'comune' | 'soppresso' | 'estero';
  name: string;
  /** Codice catastale (Belfiore): una lettera e tre cifre; per gli Stati esteri comincia con Z. */
  code: string;
  /** Sigla della provincia (solo comuni). */
  sigla: string;
  /** Anno di soppressione, se noto (solo comuni soppressi; 0 = non noto). */
  year: number;
}

/** Forma del file public/data/luoghi.json (rigenerato da scripts/update-places.mjs). */
export interface PlacesFile {
  updated: string;
  source: string;
  comuni: [string, string, string][];
  soppressi: [string, string, string, number][];
  esteri: [string, string][];
}

export const PLACES_URL = 'data/luoghi.json';

/** Minuscolo, senza accenti, solo lettere/cifre separate da un singolo spazio. */
export function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export class PlacesIndex {
  private readonly items: { place: Place; norm: string }[] = [];
  private readonly byCode = new Map<string, Place[]>();

  constructor(file: PlacesFile) {
    const add = (place: Place): void => {
      this.items.push({ place, norm: normalizeSearch(place.name) });
      const list = this.byCode.get(place.code);
      if (list) list.push(place);
      else this.byCode.set(place.code, [place]);
    };
    for (const [name, code, sigla] of file.comuni) add({ kind: 'comune', name, code, sigla, year: 0 });
    for (const [name, code, sigla, year] of file.soppressi ?? []) add({ kind: 'soppresso', name, code, sigla, year: year || 0 });
    for (const [name, code] of file.esteri ?? []) add({ kind: 'estero', name, code, sigla: '', year: 0 });
  }

  get size(): number {
    return this.items.length;
  }

  hasKind(kind: Place['kind']): boolean {
    return this.items.some((i) => i.place.kind === kind);
  }

  /** Luoghi con quel codice catastale (di norma uno; un comune soppresso può riusare un codice). */
  byCatastale(code: string): Place[] {
    return this.byCode.get(code.toUpperCase()) ?? [];
  }

  /**
   * Ricerca per nome (anche solo l'inizio di una parola, es. "bozen" per "Bolzano/Bozen") o per codice
   * catastale esatto. Prima i nomi che iniziano con il testo, poi le parole che iniziano, poi il resto.
   */
  search(query: string, kinds: readonly Place['kind'][], limit = 8): Place[] {
    const q = normalizeSearch(query);
    if (!q) return [];
    if (/^[a-z]\d{3}$/.test(q)) {
      const exact = this.byCatastale(q).filter((p) => kinds.includes(p.kind));
      if (exact.length) return exact.slice(0, limit);
    }
    const scored: { place: Place; rank: number; idx: number }[] = [];
    this.items.forEach((it, idx) => {
      if (!kinds.includes(it.place.kind)) return;
      let rank: number;
      if (it.norm === q) rank = 0;
      else if (it.norm.startsWith(q)) rank = 1;
      else if (it.norm.includes(' ' + q)) rank = 2;
      else if (it.norm.includes(q)) rank = 3;
      else return;
      // a parità, prima i comuni attuali
      if (it.place.kind === 'soppresso') rank += 0.5;
      scored.push({ place: it.place, rank, idx });
    });
    scored.sort((a, b) => a.rank - b.rank || a.idx - b.idx);
    return scored.slice(0, limit).map((s) => s.place);
  }
}

let cached: Promise<PlacesFile> | null = null;

/** Scarica l'elenco dei luoghi (stesso sito, una volta sola) quando serve. */
export function loadPlaces(): Promise<PlacesFile> {
  cached ??= fetch(PLACES_URL)
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json() as Promise<PlacesFile>;
    })
    .then((f) => {
      if (!Array.isArray(f.comuni) || f.comuni.length < 1000) throw new Error('elenco dei luoghi non valido');
      return f;
    })
    .catch((e) => {
      cached = null; // permette di riprovare
      throw e;
    });
  return cached;
}
