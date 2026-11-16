// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Scorciatoie della barra: modificano il testo attorno alla selezione. Logica pura, testata a parte. */

export type FormatAction = 'bold' | 'italic' | 'link' | 'heading' | 'list' | 'code';

export interface EditState {
  text: string;
  /** Inizio e fine della selezione (indici UTF-16). */
  start: number;
  end: number;
}

function wrap(s: EditState, left: string, right: string, placeholder: string): EditState {
  const sel = s.text.slice(s.start, s.end);
  // già racchiuso: toglie i segni (secondo clic = annulla)
  const before = s.text.slice(Math.max(0, s.start - left.length), s.start);
  const after = s.text.slice(s.end, s.end + right.length);
  if (sel !== '' && before === left && after === right) {
    return {
      text: s.text.slice(0, s.start - left.length) + sel + s.text.slice(s.end + right.length),
      start: s.start - left.length,
      end: s.end - left.length,
    };
  }
  const inner = sel || placeholder;
  const text = s.text.slice(0, s.start) + left + inner + right + s.text.slice(s.end);
  return { text, start: s.start + left.length, end: s.start + left.length + inner.length };
}

/** Inizio e fine delle righe toccate dalla selezione. */
function lineBounds(s: EditState): { from: number; to: number } {
  const from = s.text.lastIndexOf('\n', s.start - 1) + 1;
  const nl = s.text.indexOf('\n', s.end > s.start && s.text[s.end - 1] === '\n' ? s.end - 1 : s.end);
  return { from, to: nl === -1 ? s.text.length : nl };
}

export function applyFormat(s: EditState, action: FormatAction, placeholders: { link: string; text: string } = { link: 'https://', text: 'testo' }): EditState {
  switch (action) {
    case 'bold':
      return wrap(s, '**', '**', placeholders.text);
    case 'italic':
      return wrap(s, '*', '*', placeholders.text);
    case 'code': {
      const sel = s.text.slice(s.start, s.end);
      if (sel.includes('\n')) {
        const block = '```\n' + sel + '\n```';
        const text = s.text.slice(0, s.start) + block + s.text.slice(s.end);
        return { text, start: s.start + 4, end: s.start + 4 + sel.length };
      }
      return wrap(s, '`', '`', placeholders.text);
    }
    case 'link': {
      const sel = s.text.slice(s.start, s.end) || placeholders.text;
      const insert = `[${sel}](${placeholders.link})`;
      const text = s.text.slice(0, s.start) + insert + s.text.slice(s.end);
      const urlStart = s.start + sel.length + 3;
      return { text, start: urlStart, end: urlStart + placeholders.link.length };
    }
    case 'heading': {
      // livelli in sequenza: nessuno → # → ## → ### → nessuno
      const { from, to } = lineBounds(s);
      const line = s.text.slice(from, to);
      const m = /^(#{1,6})\s+/.exec(line);
      const level = m ? m[1].length : 0;
      const rest = m ? line.slice(m[0].length) : line;
      const next = level >= 3 ? '' : '#'.repeat(level + 1) + ' ';
      const text = s.text.slice(0, from) + next + rest + s.text.slice(to);
      const delta = next.length - (m ? m[0].length : 0);
      return { text, start: Math.max(from, s.start + delta), end: Math.max(from, s.end + delta) };
    }
    case 'list': {
      const { from, to } = lineBounds(s);
      const lines = s.text.slice(from, to).split('\n');
      const allBullets = lines.every((l) => /^\s*[-*+]\s/.test(l));
      const out = lines.map((l) => (allBullets ? l.replace(/^(\s*)[-*+]\s/, '$1') : /^\s*$/.test(l) && lines.length > 1 ? l : '- ' + l));
      const joined = out.join('\n');
      const text = s.text.slice(0, from) + joined + s.text.slice(to);
      const delta = joined.length - (to - from);
      return { text, start: from, end: to + delta };
    }
  }
}
