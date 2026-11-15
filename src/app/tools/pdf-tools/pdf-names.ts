// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Nome senza estensione .pdf e senza caratteri vietati nei nomi di file; mai vuoto. */
export function baseName(fileName: string, fallback = 'documento'): string {
  const cleaned = fileName
    .replace(/\.pdf$/i, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return cleaned || fallback;
}

/** "contratto" + "unito" → "contratto-unito.pdf". */
export function pdfName(base: string, suffix: string): string {
  return suffix ? `${base}-${suffix}.pdf` : `${base}.pdf`;
}

/** Rende unici i nomi (senza distinguere maiuscole): il secondo uguale diventa "nome (2).pdf". */
export function uniqueNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let candidate = name;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${stem} (${n})${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

export interface SplitWords {
  /** Singolare e plurale della parola "pagina" (es. "pagina", "pagine"). */
  page: string;
  pages: string;
  /** "parte" per i gruppi di pagine non consecutive. */
  part: string;
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');

/**
 * Nomi dei file di una divisione: "base-pagina-03.pdf", "base-pagine-01-03.pdf" se il gruppo è un
 * blocco consecutivo, "base-parte-02.pdf" altrimenti. Sempre distinti tra loro (anche con intervalli
 * sovrapposti o ripetuti).
 */
export function splitNames(base: string, groups: readonly (readonly number[])[], total: number, words: SplitWords): string[] {
  const width = String(Math.max(total, 1)).length;
  const raw = groups.map((g, i) => {
    const consecutive = g.every((p, k) => k === 0 || p === g[k - 1] + 1);
    let label: string;
    if (g.length === 1) label = `${words.page}-${pad(g[0], width)}`;
    else if (consecutive) label = `${words.pages}-${pad(g[0], width)}-${pad(g[g.length - 1], width)}`;
    else label = `${words.part}-${pad(i + 1, width)}`;
    return pdfName(base, label);
  });
  return uniqueNames(raw);
}
