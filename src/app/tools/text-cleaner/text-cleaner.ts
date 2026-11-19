// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Massimo di caratteri accettati (circa 1 MB di testo). */
export const MAX_CHARS = 1_000_000;

export type BlankLines = 'keep' | 'single' | 'none';
export type CaseMode = 'keep' | 'sentence' | 'lower';

export interface CleanOptions {
  /** Un a capo singolo diventa spazio; le righe vuote restano separatori di paragrafo. */
  joinLines: boolean;
  /** «paro-\nla» diventa «parola» (solo se la riga dopo comincia con una minuscola). */
  dehyphen: boolean;
  /** Spazi e tabulazioni multipli diventano uno. */
  collapseSpaces: boolean;
  /** Toglie spazi e tabulazioni a inizio e fine riga. */
  trimLines: boolean;
  /** Righe vuote: lasciale, riducile a una sola o toglile tutte. */
  blankLines: BlankLines;
  /** Virgolette e apostrofi tipografici diventano semplici. */
  straightQuotes: boolean;
  /** Trattini lunghi e puntini di sospensione tipografici diventano semplici. */
  simpleDashes: boolean;
  /** Caratteri invisibili tolti, spazio unificatore trasformato in spazio. */
  invisibles: boolean;
  /** Toglie i tag HTML e decodifica le entità più comuni. */
  stripHtml: boolean;
  /** Toglie pallini e numeri d'elenco a inizio riga. */
  stripBullets: boolean;
  caseMode: CaseMode;
}

export const DEFAULT_OPTIONS: CleanOptions = {
  joinLines: true,
  dehyphen: false,
  collapseSpaces: true,
  trimLines: true,
  blankLines: 'single',
  straightQuotes: true,
  simpleDashes: false,
  invisibles: true,
  stripHtml: false,
  stripBullets: false,
  caseMode: 'keep',
};

/** Tutte le opzioni spente: il testo resta identico. */
export const NO_OPTIONS: CleanOptions = {
  joinLines: false,
  dehyphen: false,
  collapseSpaces: false,
  trimLines: false,
  blankLines: 'keep',
  straightQuotes: false,
  simpleDashes: false,
  invisibles: false,
  stripHtml: false,
  stripBullets: false,
  caseMode: 'keep',
};

// Invisibili: zero width space, segni di direzione, separatori invisibili, BOM, soft hyphen, ecc.
// ZWJ e ZWNJ (U+200C/D) restano: tengono insieme le emoji composte e alcune scritture.
// eslint-disable-next-line no-misleading-character-class
const INVISIBLE_RE = /[​‎‏‪-‮⁠-⁤⁦-⁩﻿­᠎؜]/g;
const NBSP_RE = /[  ]/g;
const BULLET_RE = /^[ \t]*(?:[•◦▪▫●○‣∙·*\-–—]|\d{1,3}[.)])[ \t]+/;
const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&nbsp;': ' ' };

/** Rimuove solo i tag (e i commenti): il testo tra i tag resta. */
function stripTags(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?[a-zA-Z][^<>]*>/g, '');
}

/** Decodifica in un solo passaggio (così «&amp;lt;» diventa «&lt;», non «<»). */
function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|nbsp);/g, (m) => ENTITIES[m]);
}

function isBlank(line: string): boolean {
  return line.trim() === '';
}

/** Unisce le righe «a capo» di una frase; le righe vuote e quelle d'elenco (se `bullets`) iniziano un blocco nuovo. */
function joinSoftLines(lines: string[], starts: boolean[]): string[] {
  const out: string[] = [];
  let parts: string[] = []; // pezzi del blocco in corso (evita concatenazioni ripetute: tempo lineare)
  let last = ''; // ultimo carattere del blocco in corso
  const flush = (): void => {
    if (parts.length > 0) out.push(parts.join(''));
    parts = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line)) {
      flush();
      out.push(line);
      continue;
    }
    if (parts.length > 0 && !starts[i]) {
      const sep = last === ' ' || last === '\t' || line[0] === ' ' || line[0] === '\t' ? '' : ' ';
      parts.push(sep + line);
    } else {
      flush();
      parts.push(line);
    }
    last = line[line.length - 1];
  }
  flush();
  return out;
}

/** Riunisce le parole spezzate con il trattino a fine riga (la riga dopo deve cominciare con una minuscola). */
function joinHyphenated(lines: string[], starts: boolean[]): { lines: string[]; starts: boolean[] } {
  const out: string[] = [];
  const outStarts: boolean[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = out.length - 1;
    if (prev >= 0 && !starts[i] && /\p{L}-[ \t]*$/u.test(out[prev]) && /^[ \t]*\p{Ll}/u.test(line)) {
      out[prev] = out[prev].replace(/-[ \t]*$/, '') + line.replace(/^[ \t]+/, '');
    } else {
      out.push(line);
      outStarts.push(starts[i]);
    }
  }
  return { lines: out, starts: outStarts };
}

function sentenceCase(text: string): string {
  return text.replace(
    /(^|[.!?…]+["')\]»”’]*\s+|\n[ \t]*\n[ \t]*)([«"'“‘(\[]*)(\p{Ll})/gu,
    (_m, pre: string, open: string, ch: string) => pre + open + ch.toLocaleUpperCase(),
  );
}

/** Conta le righe di un testo (0 se vuoto). */
export function countLines(text: string): number {
  return text === '' ? 0 : text.split(/\r\n|\r|\n/).length;
}

/** Almeno un'opzione attiva? */
export function hasAnyOption(o: CleanOptions): boolean {
  return (Object.keys(NO_OPTIONS) as (keyof CleanOptions)[]).some((k) => o[k] !== NO_OPTIONS[k]);
}

/**
 * Pulisce il testo secondo le opzioni. Funzione pura. Con tutte le opzioni spente restituisce il testo identico.
 * Se l'originale usa a capo CRLF, il risultato li mantiene.
 */
export function cleanText(text: string, o: CleanOptions): string {
  if (text === '' || !hasAnyOption(o)) return text;
  const crlf = text.includes('\r\n');
  let t = text.replace(/\r\n?/g, '\n');

  if (o.stripHtml) t = decodeEntities(stripTags(t));
  if (o.invisibles) t = t.replace(INVISIBLE_RE, '').replace(NBSP_RE, ' ');
  if (o.straightQuotes) t = t.replace(/[“”„‟]/g, '"').replace(/[‘’‚‛]/g, "'");
  if (o.simpleDashes) t = t.replace(/[‐-―−]/g, '-').replace(/…/g, '...');

  let lines = t.split('\n');
  let starts = lines.map(() => false);
  if (o.stripBullets) {
    starts = lines.map((l) => BULLET_RE.test(l));
    lines = lines.map((l) => l.replace(BULLET_RE, ''));
  }
  if (o.trimLines) lines = lines.map((l) => l.replace(/^[ \t]+|[ \t]+$/g, ''));
  if (o.dehyphen) ({ lines, starts } = joinHyphenated(lines, starts));
  if (o.joinLines) lines = joinSoftLines(lines, starts);
  if (o.collapseSpaces) lines = lines.map((l) => l.replace(/[ \t]{2,}/g, ' '));

  if (o.blankLines === 'none') lines = lines.filter((l) => !isBlank(l));
  else if (o.blankLines === 'single') {
    const kept: string[] = [];
    for (const l of lines) if (!(isBlank(l) && kept.length > 0 && isBlank(kept[kept.length - 1]))) kept.push(l);
    lines = kept;
  }

  t = lines.join('\n');
  if (o.caseMode === 'lower') t = t.toLocaleLowerCase();
  else if (o.caseMode === 'sentence') t = sentenceCase(t);
  return crlf ? t.replace(/\n/g, '\r\n') : t;
}

export interface CleanStats {
  charsRemoved: number;
  linesRemoved: number;
}

/** Caratteri e righe tolti (mai sotto zero, anche se il testo cresce, per esempio con «…» → «...»). */
export function cleanStats(before: string, after: string): CleanStats {
  return {
    charsRemoved: Math.max(0, before.length - after.length),
    linesRemoved: Math.max(0, countLines(before) - countLines(after)),
  };
}
