// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Tokenizzatore di righe di comando in stile shell POSIX (senza espansioni), condiviso dagli strumenti che leggono
 * comandi incollati (cURL, docker run): virgolette singole e doppie, `$'...'`, continuazioni con `\`.
 * Logica pura, senza DOM e senza Angular.
 */

const OCTAL = /[0-7]/;

/** Decodifica i byte accumulati dagli escape \xHH e \nnn come UTF-8. */
function flushBytes(bytes: number[]): string {
  if (bytes.length === 0) return '';
  const s = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  bytes.length = 0;
  return s;
}

/** Contenuto di una stringa `$'...'` (escape ANSI-C). `i` punta al carattere dopo l'apice iniziale. */
function readAnsiC(src: string, start: number): { text: string; end: number } | null {
  let i = start;
  let out = '';
  const bytes: number[] = [];
  while (i < src.length) {
    const c = src[i];
    if (c === "'") {
      out += flushBytes(bytes);
      return { text: out, end: i + 1 };
    }
    if (c !== '\\') {
      out += flushBytes(bytes) + c;
      i++;
      continue;
    }
    const n = src[i + 1];
    if (n === undefined) return null;
    i += 2;
    const simple: Record<string, string> = { a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', "'": "'", '"': '"', '?': '?' };
    if (n === 'x') {
      const m = /^[0-9a-fA-F]{1,2}/.exec(src.slice(i, i + 2));
      if (m) {
        bytes.push(parseInt(m[0], 16));
        i += m[0].length;
      } else out += flushBytes(bytes) + '\\x';
    } else if (OCTAL.test(n)) {
      let d = n;
      while (d.length < 3 && OCTAL.test(src[i] ?? '')) d += src[i++];
      bytes.push(parseInt(d, 8) & 0xff);
    } else if (n === 'u' || n === 'U') {
      const m = new RegExp(`^[0-9a-fA-F]{1,${n === 'u' ? 4 : 8}}`).exec(src.slice(i, i + 8));
      out += flushBytes(bytes);
      if (m) {
        const cp = parseInt(m[0], 16);
        out += cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
        i += m[0].length;
      } else out += '\\' + n;
    } else if (n === 'c' && src[i] !== undefined) {
      out += flushBytes(bytes) + String.fromCharCode(src[i].charCodeAt(0) & 0x1f);
      i++;
    } else if (n in simple) out += flushBytes(bytes) + simple[n];
    else out += flushBytes(bytes) + '\\' + n;
  }
  return null;
}

export interface Tokenized {
  tokens: string[];
  /** Se la riga continua con una pipe, un `;`, un reindirizzamento o `&&`: il resto è stato ignorato. */
  stoppedAt: string | null;
  unterminated: boolean;
}

/** Spezza una riga di comando come farebbe una shell POSIX (senza espansioni). */
export function tokenize(input: string): Tokenized {
  const src = input;
  const tokens: string[] = [];
  let cur = '';
  let has = false;
  let i = 0;
  let stoppedAt: string | null = null;
  const push = () => {
    if (has) tokens.push(cur);
    cur = '';
    has = false;
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      const n = src[i + 1];
      if (n === '\n') i += 2;
      else if (n === '\r' && src[i + 2] === '\n') i += 3;
      else if (n === undefined) i++;
      else {
        cur += n;
        has = true;
        i += 2;
      }
    } else if (c === "'") {
      const end = src.indexOf("'", i + 1);
      if (end < 0) return { tokens, stoppedAt, unterminated: true };
      cur += src.slice(i + 1, end);
      has = true;
      i = end + 1;
    } else if (c === '$' && src[i + 1] === "'") {
      const r = readAnsiC(src, i + 2);
      if (!r) return { tokens, stoppedAt, unterminated: true };
      cur += r.text;
      has = true;
      i = r.end;
    } else if (c === '"') {
      i++;
      let closed = false;
      while (i < src.length) {
        const d = src[i];
        if (d === '"') {
          closed = true;
          i++;
          break;
        }
        if (d === '\\') {
          const n = src[i + 1];
          if (n === '\n') i += 2;
          else if (n === '\r' && src[i + 2] === '\n') i += 3;
          else if (n === '"' || n === '\\' || n === '$' || n === '`') {
            cur += n;
            i += 2;
          } else {
            cur += d;
            i++;
          }
        } else {
          cur += d;
          i++;
        }
      }
      if (!closed) return { tokens, stoppedAt, unterminated: true };
      has = true;
    } else if (/\s/.test(c)) {
      push();
      i++;
    } else if (c === '|' || c === ';' || c === '&' || c === '>' || c === '<') {
      push();
      stoppedAt = c === '&' && src[i + 1] === '&' ? '&&' : c === '|' && src[i + 1] === '|' ? '||' : c === '>' && src[i + 1] === '>' ? '>>' : c;
      return { tokens, stoppedAt, unterminated: false };
    } else {
      cur += c;
      has = true;
      i++;
    }
  }
  push();
  return { tokens, stoppedAt, unterminated: false };
}
