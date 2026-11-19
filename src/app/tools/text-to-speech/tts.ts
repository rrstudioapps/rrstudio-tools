// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Sintesi vocale con la Web Speech API. Logica pura.
 *
 * PRIVACY: si usano SOLO le voci con `localService === true`, cioè quelle installate nel dispositivo.
 * Le voci "di rete" (per esempio le voci Google di Chrome) inviano il testo a server esterni per
 * sintetizzarlo: qui non vengono mostrate né usate.
 */

export interface VoiceLike {
  name: string;
  lang: string;
  localService: boolean;
  default?: boolean;
  voiceURI?: string;
}

export const MIN_RATE = 0.5;
export const MAX_RATE = 2;
export const MIN_PITCH = 0;
export const MAX_PITCH = 2;
export const MAX_CHARS = 100_000;

export const clampRate = (n: number): number => clamp(n, MIN_RATE, MAX_RATE, 1);
export const clampPitch = (n: number): number => clamp(n, MIN_PITCH, MAX_PITCH, 1);
export const clampVolume = (n: number): number => clamp(n, 0, 1, 1);

function clamp(n: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Solo le voci locali (mai quelle di rete), senza doppioni e in ordine di lingua e nome. */
export function localVoices<T extends VoiceLike>(voices: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of voices) {
    if (v.localService !== true) continue;
    const key = v.voiceURI ?? `${v.name}|${v.lang}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out.sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
}

/** Codice lingua di base ("it-IT" e "it_IT" diventano "it"). */
export function baseLang(lang: string): string {
  return lang.toLowerCase().split(/[-_]/)[0];
}

/** Lingue presenti tra le voci (codice di base), in ordine alfabetico. */
export function voiceLanguages(voices: readonly VoiceLike[]): string[] {
  return [...new Set(voices.map((v) => baseLang(v.lang)))].sort();
}

/** Voce da preselezionare: della lingua indicata (la predefinita, se c'è), altrimenti la prima disponibile. */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], lang: string): T | null {
  if (voices.length === 0) return null;
  const same = voices.filter((v) => baseLang(v.lang) === baseLang(lang));
  const pool = same.length ? same : voices;
  return pool.find((v) => v.default) ?? pool[0];
}

export interface Sentence {
  start: number;
  end: number;
  text: string;
}

/** Divide il testo in frasi (Intl.Segmenter dove c'è, altrimenti per punteggiatura); gli intervalli non si sovrappongono. */
export function splitSentences(text: string, lang = 'it'): Sentence[] {
  const out: Sentence[] = [];
  const push = (start: number, end: number) => {
    const raw = text.slice(start, end);
    const trimmedStart = start + (raw.length - raw.trimStart().length);
    const trimmedEnd = end - (raw.length - raw.trimEnd().length);
    if (trimmedEnd > trimmedStart) out.push({ start: trimmedStart, end: trimmedEnd, text: text.slice(trimmedStart, trimmedEnd) });
  };
  const Segmenter = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment(s: string): Iterable<{ index: number; segment: string }> } }).Segmenter;
  if (Segmenter) {
    for (const seg of new Segmenter(lang, { granularity: 'sentence' }).segment(text)) push(seg.index, seg.index + seg.segment.length);
  } else {
    const re = /[^.!?…\n]+(?:[.!?…]+|\n|$)/g;
    for (const m of text.matchAll(re)) push(m.index!, m.index! + m[0].length);
  }
  // frasi molto lunghe: alcuni motori vocali si fermano oltre i ~200 caratteri senza pause
  return out.flatMap((s) => (s.text.length > 400 ? splitLong(s, 300) : [s]));
}

function splitLong(s: Sentence, max: number): Sentence[] {
  const parts: Sentence[] = [];
  let from = 0;
  while (from < s.text.length) {
    let to = Math.min(s.text.length, from + max);
    if (to < s.text.length) {
      const cut = Math.max(s.text.lastIndexOf(',', to), s.text.lastIndexOf(';', to), s.text.lastIndexOf(' ', to));
      if (cut > from + max / 3) to = cut + 1;
    }
    const piece = s.text.slice(from, to);
    const lead = piece.length - piece.trimStart().length;
    const trimmed = piece.trim();
    if (trimmed) parts.push({ start: s.start + from + lead, end: s.start + from + lead + trimmed.length, text: trimmed });
    from = to;
  }
  return parts;
}

/** Indice della frase che contiene la posizione (o l'ultima che la precede); -1 se non ce n'è. */
export function sentenceAt(sentences: readonly Sentence[], position: number): number {
  let found = -1;
  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].start <= position) found = i;
    else break;
  }
  return found;
}
