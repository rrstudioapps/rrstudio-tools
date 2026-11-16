// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Convertitore Markdown → HTML scritto per questo strumento: CommonMark essenziale + GFM
 * (tabelle, elenchi di attività, barrato, link automatici).
 *
 * SICUREZZA. L'HTML grezzo scritto nel Markdown NON viene eseguito: ogni `<` o `&` del testo è
 * convertito in entità. L'HTML prodotto contiene solo i tag e gli attributi elencati in
 * `ALLOWED_TAGS`/`ALLOWED_ATTRS` (i test lo verificano). I link ammessi sono http, https, mailto e relativi
 * (`javascript:`, `data:` ecc. diventano testo semplice). Le immagini non vengono mai caricate in
 * modalità anteprima: restano un segnaposto con l'indirizzo; solo le immagini `data:image/…;base64`
 * (già nel testo, nessuna richiesta di rete) si vedono subito.
 *
 * Differenze note da CommonMark: niente blocchi HTML né HTML in linea (sono mostrati come testo),
 * niente rientri "pigri" complessi nelle citazioni annidate e nessuna tabella dentro le citazioni
 * con righe senza `>`.
 */

export interface RenderOptions {
  /** 'placeholder': le immagini esterne diventano un segnaposto (anteprima); 'embed': `<img>` (HTML esportato). */
  images: 'placeholder' | 'embed';
  /** Testo del segnaposto di un'immagine esterna, con l'indirizzo. */
  externalImageLabel: (url: string) => string;
  /** Testo per le immagini non caricabili (indirizzi relativi nell'anteprima). */
  offImageLabel: (alt: string) => string;
}

export const DEFAULT_RENDER: RenderOptions = {
  images: 'placeholder',
  externalImageLabel: (url) => `immagine esterna: ${url}`,
  offImageLabel: (alt) => `immagine: ${alt}`,
};

/** Tag e attributi che il convertitore può produrre (usato anche dai test come lista bianca). */
export const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'pre', 'code', 'em', 'strong', 'del', 'a', 'img', 'br', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'input',
]);
export const ALLOWED_ATTRS: ReadonlySet<string> = new Set([
  'href', 'title', 'target', 'rel', 'src', 'alt', 'loading', 'class', 'start', 'data-lang', 'data-src', 'type', 'checked', 'disabled',
  'role', 'tabindex', 'aria-label', 'referrerpolicy',
]);

// ---------------------------------------------------------------- utilità

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', hellip: '…', mdash: '—', ndash: '–',
  laquo: '«', raquo: '»', euro: '€', deg: '°', middot: '·', bull: '•', times: '×', trade: '™', agrave: 'à', egrave: 'è',
  eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
};

/** Converte le entità HTML (numeriche e le più comuni con nome) in caratteri; le altre restano com'erano. */
function decodeEntities(s: string): string {
  return s.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,8}));/g, (m, dec: string, hex: string, name: string) => {
    if (name) return ENTITIES[name] ?? m;
    const cp = dec ? parseInt(dec, 10) : parseInt(hex, 16);
    if (cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '�';
    return String.fromCodePoint(cp);
  });
}

const ESCAPABLE = /\\([!-/:-@[-`{-~])/g;
function unescapeBackslashes(s: string): string {
  return s.replace(ESCAPABLE, '$1');
}

/** Normalizza un'etichetta di riferimento: minuscole, spazi compressi. */
function normLabel(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

type UrlKind = 'web' | 'mail' | 'relative' | 'data-image' | 'unsafe';
interface SafeUrl {
  kind: UrlKind;
  url: string;
}

/** Valuta un indirizzo: ammessi http(s), mailto, relativi e immagini data: raster. Il resto è `unsafe`. */
export function classifyUrl(raw: string): SafeUrl {
  // via spazi, caratteri di controllo e invisibili che alcuni browser ignorano dentro lo schema ("java\tscript:")
  // eslint-disable-next-line no-control-regex
  const url = raw.replace(/[\u0000-\u0020\u007f-\u009f\u00ad\u200b-\u200f\u2028\u2029\ufeff]+/g, '');
  if (url === '') return { kind: 'unsafe', url: '' };
  if (/^(https?):\/\/[^/?#]/i.test(url)) return { kind: 'web', url };
  if (/^mailto:[^\s]+$/i.test(url)) return { kind: 'mail', url };
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(url)) return { kind: 'data-image', url };
  if (/^\/\//.test(url) || /^[\\]/.test(url)) return { kind: 'unsafe', url };
  // relativo: nessuno schema (nessun ':' prima del primo / ? #)
  if (/^[^:/?#]*([/?#]|$)/.test(url)) return { kind: 'relative', url };
  return { kind: 'unsafe', url };
}

// ---------------------------------------------------------------- parte in linea

interface RefDef {
  url: string;
  title: string;
}
type Refs = Map<string, RefDef>;

interface INode {
  k: 'text' | 'raw' | 'delim' | 'bracket';
  v: string;
  ch?: string;
  n?: number;
  orig?: number;
  canOpen?: boolean;
  canClose?: boolean;
  img?: boolean;
  active?: boolean;
  /** Posizione nel sorgente subito dopo `[`. */
  pos?: number;
}

const UNICODE_WS = /[\s   -   　]/u;
const PUNCT = /[!-/:-@[-`{-~\p{P}\p{S}]/u;

function isWs(c: string | undefined): boolean {
  return c === undefined || UNICODE_WS.test(c);
}
function isPunct(c: string | undefined): boolean {
  return c !== undefined && PUNCT.test(c);
}

function flanking(before: string | undefined, after: string | undefined): { left: boolean; right: boolean } {
  const wsB = isWs(before);
  const wsA = isWs(after);
  const pB = isPunct(before);
  const pA = isPunct(after);
  return {
    left: !wsA && (!pA || wsB || pB),
    right: !wsB && (!pB || wsA || pA),
  };
}

function renderNodes(nodes: readonly INode[]): string {
  let out = '';
  for (const n of nodes) out += n.k === 'raw' ? n.v : escapeHtml(n.k === 'delim' ? n.v.repeat(n.n ?? 0) : n.v);
  return out;
}

function processEmphasis(nodes: INode[], from: number): void {
  let ci = from;
  while (ci < nodes.length) {
    const c = nodes[ci];
    if (c.k !== 'delim' || !c.canClose || !c.n) {
      ci++;
      continue;
    }
    let oi = ci - 1;
    let found = -1;
    while (oi >= from) {
      const o = nodes[oi];
      if (o.k === 'delim' && o.canOpen && o.ch === c.ch && o.n) {
        const odd = (o.canClose || c.canOpen) && ((o.orig ?? 0) + (c.orig ?? 0)) % 3 === 0 && !((o.orig ?? 0) % 3 === 0 && (c.orig ?? 0) % 3 === 0);
        if (c.ch === '~') {
          if (o.n >= 2 && c.n >= 2) {
            found = oi;
            break;
          }
        } else if (!odd) {
          found = oi;
          break;
        }
      }
      oi--;
    }
    if (found < 0) {
      // niente da chiudere: se non può aprire non servirà più
      if (!c.canOpen) c.canClose = false;
      ci++;
      continue;
    }
    const o = nodes[found];
    const use = c.ch === '~' ? 2 : o.n! >= 2 && c.n >= 2 ? 2 : 1;
    const inner = renderNodes(nodes.slice(found + 1, ci));
    const tag = c.ch === '~' ? 'del' : use === 2 ? 'strong' : 'em';
    o.n! -= use;
    c.n -= use;
    const wrapped: INode = { k: 'raw', v: `<${tag}>${inner}</${tag}>` };
    // rimuove i nodi interni e inserisce l'elemento
    nodes.splice(found + 1, ci - found - 1, wrapped);
    ci = found + 2; // posizione del delimitatore di chiusura
    if (o.n === 0) {
      nodes.splice(found, 1);
      ci--;
    }
    if (c.n === 0) {
      nodes.splice(ci, 1);
    }
    // se c ha ancora delimitatori si riprova sullo stesso nodo
  }
}

/** Legge `(dest "titolo")` dopo la `]` di un link; ritorna null se non è un link in linea. */
function parseLinkTail(src: string, start: number): { dest: string; title: string; end: number } | null {
  let i = start;
  const ws = (): void => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };
  if (src[i] !== '(') return null;
  i++;
  ws();
  let dest = '';
  if (src[i] === '<') {
    i++;
    const s = i;
    while (i < src.length && src[i] !== '>' && src[i] !== '\n' && src[i] !== '<') i += src[i] === '\\' ? 2 : 1;
    if (src[i] !== '>') return null;
    dest = src.slice(s, i);
    i++;
  } else {
    let depth = 0;
    const s = i;
    while (i < src.length) {
      const c = src[i];
      if (c === '\\' && i + 1 < src.length) {
        i += 2;
        continue;
      }
      if (/[\s\u0000-\u001f]/.test(c)) break;
      if (c === '(') depth++;
      else if (c === ')') {
        if (depth === 0) break;
        depth--;
      }
      i++;
    }
    if (depth !== 0) return null;
    dest = src.slice(s, i);
  }
  const beforeWs = i;
  ws();
  let title = '';
  if (i > beforeWs && (src[i] === '"' || src[i] === "'" || src[i] === '(')) {
    const close = src[i] === '(' ? ')' : src[i];
    i++;
    const s = i;
    while (i < src.length && src[i] !== close) i += src[i] === '\\' ? 2 : 1;
    if (src[i] !== close) return null;
    title = src.slice(s, i);
    i++;
    ws();
  }
  if (src[i] !== ')') return null;
  return { dest, title, end: i + 1 };
}

function linkHtml(def: RefDef, inner: string): string {
  const u = classifyUrl(decodeEntities(unescapeBackslashes(def.url)));
  if (u.kind === 'unsafe' || u.kind === 'data-image') return inner;
  const title = def.title ? ` title="${escapeHtml(decodeEntities(unescapeBackslashes(def.title)))}"` : '';
  const ext = u.kind === 'web' ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a href="${escapeHtml(u.url)}"${title}${ext}>${inner}</a>`;
}

function imageHtml(def: RefDef, alt: string, opts: RenderOptions): string {
  const u = classifyUrl(decodeEntities(unescapeBackslashes(def.url)));
  const title = def.title ? ` title="${escapeHtml(decodeEntities(unescapeBackslashes(def.title)))}"` : '';
  if (u.kind === 'unsafe' || u.kind === 'mail') return escapeHtml(alt);
  if (u.kind === 'data-image') return `<img src="${escapeHtml(u.url)}" alt="${escapeHtml(alt)}"${title} loading="lazy">`;
  if (opts.images === 'embed') return `<img src="${escapeHtml(u.url)}" alt="${escapeHtml(alt)}"${title} loading="lazy" referrerpolicy="no-referrer">`;
  if (u.kind === 'web') {
    // niente richiesta automatica: un link che apre l'immagine in un'altra scheda, solo se l'utente lo vuole
    return `<a class="md-ext-img" href="${escapeHtml(u.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(opts.externalImageLabel(u.url))}</a>`;
  }
  return `<span class="md-img-off">${escapeHtml(opts.offImageLabel(alt))}</span>`;
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ''));
}

const AUTOLINK_URI = /^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*)>/;
const AUTOLINK_MAIL = /^<([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)>/;
const BARE_URL = /^(?:https?:\/\/|www\.)[^\s<>]+/i;

export function renderInline(src: string, refs: Refs, opts: RenderOptions): string {
  const nodes: INode[] = [];
  const brackets: number[] = [];
  let text = '';
  const flush = (): void => {
    if (text) nodes.push({ k: 'text', v: text });
    text = '';
  };
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];
    if (c === '\\') {
      const next = src[i + 1];
      if (next === '\n') {
        flush();
        nodes.push({ k: 'raw', v: '<br>\n' });
        i += 2;
        while (src[i] === ' ' || src[i] === '\t') i++;
        continue;
      }
      if (next !== undefined && /[!-/:-@[-`{-~]/.test(next)) {
        text += next;
        i += 2;
        continue;
      }
      text += c;
      i++;
      continue;
    }
    if (c === '`') {
      let j = i;
      while (src[j] === '`') j++;
      const len = j - i;
      let k = j;
      let close = -1;
      while (k < n) {
        if (src[k] === '`') {
          let e = k;
          while (src[e] === '`') e++;
          if (e - k === len) {
            close = k;
            break;
          }
          k = e;
        } else k++;
      }
      if (close < 0) {
        text += '`'.repeat(len);
        i = j;
        continue;
      }
      let code = src.slice(j, close).replace(/\n/g, ' ');
      if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim() !== '') code = code.slice(1, -1);
      flush();
      nodes.push({ k: 'raw', v: `<code>${escapeHtml(code)}</code>` });
      i = close + len;
      continue;
    }
    if (c === '&') {
      const m = /^&(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,8});/.exec(src.slice(i, i + 12));
      if (m) {
        const dec = decodeEntities(m[0]);
        text += dec;
        i += m[0].length;
        continue;
      }
      text += c;
      i++;
      continue;
    }
    if (c === '<') {
      const rest = src.slice(i);
      let m = AUTOLINK_URI.exec(rest);
      if (m) {
        const u = classifyUrl(m[1]);
        if (u.kind === 'web' || u.kind === 'mail') {
          flush();
          nodes.push({ k: 'raw', v: linkHtml({ url: m[1], title: '' }, escapeHtml(m[1])) });
          i += m[0].length;
          continue;
        }
      }
      m = AUTOLINK_MAIL.exec(rest);
      if (m) {
        flush();
        nodes.push({ k: 'raw', v: linkHtml({ url: 'mailto:' + m[1], title: '' }, escapeHtml(m[1])) });
        i += m[0].length;
        continue;
      }
      text += c; // HTML in linea: mostrato come testo
      i++;
      continue;
    }
    if (c === '*' || c === '_' || c === '~') {
      let j = i;
      while (src[j] === c) j++;
      const len = j - i;
      const prev = i > 0 ? lastChar(src, i) : undefined;
      const nextCh = j < n ? String.fromCodePoint(src.codePointAt(j)!) : undefined;
      const { left, right } = flanking(prev, nextCh);
      let canOpen = left;
      let canClose = right;
      if (c === '_') {
        canOpen = left && (!right || isPunct(prev));
        canClose = right && (!left || isPunct(nextCh));
      }
      if (c === '~' && len !== 2) {
        text += src.slice(i, j);
        i = j;
        continue;
      }
      flush();
      nodes.push({ k: 'delim', v: c, ch: c, n: len, orig: len, canOpen, canClose });
      i = j;
      continue;
    }
    if (c === '!' && src[i + 1] === '[') {
      flush();
      brackets.push(nodes.length);
      nodes.push({ k: 'bracket', v: '![', img: true, active: true, pos: i + 2 });
      i += 2;
      continue;
    }
    if (c === '[') {
      flush();
      brackets.push(nodes.length);
      nodes.push({ k: 'bracket', v: '[', img: false, active: true, pos: i + 1 });
      i++;
      continue;
    }
    if (c === ']') {
      flush();
      const bi = brackets.pop();
      if (bi === undefined) {
        text += ']';
        i++;
        continue;
      }
      const opener = nodes[bi];
      if (!opener.active) {
        nodes[bi] = { k: 'text', v: opener.v };
        text += ']';
        i++;
        continue;
      }
      let def: RefDef | null = null;
      let end = i + 1;
      const tail = parseLinkTail(src, i + 1);
      if (tail) {
        def = { url: tail.dest, title: tail.title };
        end = tail.end;
      } else {
        const label = src.slice(opener.pos!, i);
        const second = /^\[([^\]]*)\]/.exec(src.slice(i + 1));
        if (second) {
          const key = normLabel(second[1] === '' ? label : second[1]);
          const r = refs.get(key);
          if (r) {
            def = r;
            end = i + 1 + second[0].length;
          }
        } else {
          const r = refs.get(normLabel(label));
          if (r && label.trim() !== '') def = r;
        }
      }
      if (!def) {
        nodes[bi] = { k: 'text', v: opener.v };
        text += ']';
        i++;
        continue;
      }
      processEmphasis(nodes, bi + 1);
      const inner = renderNodes(nodes.slice(bi + 1));
      nodes.length = bi;
      if (opener.img) {
        nodes.push({ k: 'raw', v: imageHtml(def, plainText(inner), opts) });
      } else {
        const plainInner = inner.replace(/<a class="md-ext-img"[^>]*>([^<]*)<\/a>/g, '<span class="md-img-off">$1</span>');
        nodes.push({ k: 'raw', v: linkHtml(def, plainInner) });
        // niente link dentro un link
        for (const b of brackets) if (!nodes[b]?.img) nodes[b].active = false;
      }
      i = end;
      continue;
    }
    if (c === '\n') {
      // a capo forzato: due o più spazi alla fine della riga
      const hard = / {2,}$/.test(text);
      text = text.replace(/ +$/, '');
      flush();
      nodes.push({ k: 'raw', v: hard ? '<br>\n' : '\n' });
      i++;
      while (src[i] === ' ' || src[i] === '\t') i++;
      continue;
    }
    // link automatici GFM per http(s):// e www.
    if ((c === 'h' || c === 'H' || c === 'w' || c === 'W') && (i === 0 || /[\s*_~(]/.test(src[i - 1]))) {
      const m = BARE_URL.exec(src.slice(i));
      if (m) {
        let url = m[0];
        // punteggiatura finale e parentesi non chiuse non fanno parte dell'indirizzo
        for (;;) {
          const last = url[url.length - 1];
          if (/[?!.,:*_~'"]/.test(last)) url = url.slice(0, -1);
          else if (last === ')' && (url.match(/\)/g) ?? []).length > (url.match(/\(/g) ?? []).length) url = url.slice(0, -1);
          else break;
        }
        const href = /^www\./i.test(url) ? 'http://' + url : url;
        if (url.length > 7 && classifyUrl(href).kind === 'web') {
          flush();
          nodes.push({ k: 'raw', v: linkHtml({ url: href, title: '' }, escapeHtml(url)) });
          i += url.length;
          continue;
        }
      }
    }
    text += c;
    i++;
  }
  flush();
  // parentesi quadre rimaste senza chiusura sono testo
  for (let b = 0; b < nodes.length; b++) if (nodes[b].k === 'bracket') nodes[b] = { k: 'text', v: nodes[b].v };
  processEmphasis(nodes, 0);
  return renderNodes(nodes);
}

/** Ultimo carattere (punto di codice) prima della posizione `i`. */
function lastChar(s: string, i: number): string {
  const lo = s.charCodeAt(i - 1);
  if (lo >= 0xdc00 && lo <= 0xdfff && i >= 2) return s.slice(i - 2, i);
  return s[i - 1];
}

// ---------------------------------------------------------------- blocchi

interface Ctx {
  refs: Refs;
  opts: RenderOptions;
  depth: number;
}

/** Annidamento massimo di citazioni ed elenchi: oltre, il testo resta com'è (evita lo stack overflow). */
const MAX_DEPTH = 40;

const RE_ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const RE_FENCE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^\n]*)$/;
const RE_HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const RE_LIST = /^( {0,3})([-+*]|\d{1,9}[.)])([ \t]+|$)(.*)$/;
const RE_QUOTE = /^ {0,3}>[ \t]?/;
const RE_SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const RE_TABLE_DELIM = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const RE_REFDEF = /^ {0,3}\[((?:[^\]\\]|\\.)+)\]:[ \t]*\n?[ \t]*(<[^>\n]*>|[^\s<][^\s]*)(?:[ \t]*\n?[ \t]*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\((?:[^)\\]|\\.)*\)))?[ \t]*(?:\n|$)/;

function indentOf(line: string): number {
  let n = 0;
  for (const ch of line) {
    if (ch === ' ') n++;
    else break;
  }
  return n;
}

function isBlank(line: string): boolean {
  return line.trim() === '';
}

/** Vero se la riga può interrompere un paragrafo (apre un altro blocco). */
function interruptsParagraph(line: string): boolean {
  if (RE_ATX.test(line) || RE_HR.test(line) || RE_QUOTE.test(line)) return true;
  const f = RE_FENCE.exec(line);
  if (f && !(f[2][0] === '`' && f[3].includes('`'))) return true;
  const l = RE_LIST.exec(line);
  if (l && l[4].trim() !== '' && (/^[-+*]$/.test(l[2]) || l[2] === '1.' || l[2] === '1)')) return true;
  return false;
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (s[i] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

function listMarkerKind(marker: string): string {
  return /^\d/.test(marker) ? 'o' + marker.slice(-1) : 'b' + marker;
}

function renderBlocks(lines: string[], ctx: Ctx, tight: boolean): string {
  if (ctx.depth > MAX_DEPTH) return `<p>${escapeHtml(lines.join('\n').trim())}</p>`;
  const out: string[] = [];
  let i = 0;
  const para = (text: string): void => {
    const html = renderInline(text, ctx.refs, ctx.opts);
    out.push(tight ? html : `<p>${html}</p>`);
  };

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    const ind = indentOf(line);

    // codice con rientro
    if (ind >= 4) {
      const buf: string[] = [];
      while (i < lines.length && (isBlank(lines[i]) || indentOf(lines[i]) >= 4)) {
        buf.push(lines[i].slice(Math.min(4, indentOf(lines[i]))));
        i++;
      }
      while (buf.length && isBlank(buf[buf.length - 1])) buf.pop();
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}\n</code></pre>`);
      continue;
    }

    // codice delimitato
    const fence = RE_FENCE.exec(line);
    if (fence && !(fence[2][0] === '`' && fence[3].includes('`'))) {
      const [, fIndent, marker, info] = fence;
      const buf: string[] = [];
      i++;
      const closeRe = new RegExp(`^ {0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},}[ \\t]*$`);
      while (i < lines.length && !closeRe.test(lines[i])) {
        const strip = Math.min(fIndent.length, indentOf(lines[i]));
        buf.push(lines[i].slice(strip));
        i++;
      }
      i++; // riga di chiusura (o fine del testo)
      const lang = decodeEntities(unescapeBackslashes(info.trim().split(/\s+/)[0] ?? ''));
      const okLang = /^[\w+#.-]{1,30}$/.test(lang) ? lang : '';
      const cls = okLang ? ` class="language-${escapeHtml(okLang)}"` : '';
      const dl = okLang ? ` data-lang="${escapeHtml(okLang)}"` : '';
      out.push(`<pre${dl}><code${cls}>${escapeHtml(buf.join('\n'))}${buf.length ? '\n' : ''}</code></pre>`);
      continue;
    }

    const atx = RE_ATX.exec(line);
    if (atx) {
      const level = atx[1].length;
      out.push(`<h${level}>${renderInline((atx[2] ?? '').trim(), ctx.refs, ctx.opts)}</h${level}>`);
      i++;
      continue;
    }

    if (RE_HR.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // citazione
    if (RE_QUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (RE_QUOTE.test(l)) {
          buf.push(l.replace(RE_QUOTE, ''));
          i++;
        } else if (!isBlank(l) && buf.length && !isBlank(buf[buf.length - 1]) && !interruptsParagraph(l)) {
          buf.push(l); // continuazione "pigra" del paragrafo
          i++;
        } else break;
      }
      out.push(`<blockquote>\n${renderBlocks(buf, { ...ctx, depth: ctx.depth + 1 }, false)}\n</blockquote>`);
      continue;
    }

    // elenco
    const lm = RE_LIST.exec(line);
    if (lm) {
      const r = parseList(lines, i, ctx);
      out.push(r.html);
      i = r.next;
      continue;
    }

    // tabella GFM
    if (i + 1 < lines.length && line.includes('|') && RE_TABLE_DELIM.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(line);
      const delim = splitRow(lines[i + 1]);
      if (head.length === delim.length && (lines[i + 1].includes('|') || head.length === 1)) {
        const aligns = delim.map((d) => (d.startsWith(':') && d.endsWith(':') ? 'c' : d.endsWith(':') ? 'r' : d.startsWith(':') ? 'l' : ''));
        const cell = (tag: 'th' | 'td', text: string, a: string): string =>
          `<${tag}${a ? ` class="al-${a}"` : ''}>${renderInline(text, ctx.refs, ctx.opts)}</${tag}>`;
        let html = '<table>\n<thead>\n<tr>' + head.map((h, k) => cell('th', h, aligns[k])).join('') + '</tr>\n</thead>';
        i += 2;
        const rows: string[] = [];
        while (i < lines.length && !isBlank(lines[i]) && !interruptsParagraph(lines[i]) && indentOf(lines[i]) < 4) {
          const cells = splitRow(lines[i]);
          const row: string[] = [];
          for (let k = 0; k < head.length; k++) row.push(cell('td', cells[k] ?? '', aligns[k]));
          rows.push('<tr>' + row.join('') + '</tr>');
          i++;
        }
        if (rows.length) html += '\n<tbody>\n' + rows.join('\n') + '\n</tbody>';
        out.push(html + '\n</table>');
        continue;
      }
    }

    // definizione di riferimento ([id]: url "titolo")
    const defMatch = RE_REFDEF.exec(lines.slice(i, i + 4).join('\n'));
    if (defMatch) {
      const key = normLabel(defMatch[1]);
      if (key && !ctx.refs.has(key)) {
        const dest = defMatch[2].startsWith('<') ? defMatch[2].slice(1, -1) : defMatch[2];
        ctx.refs.set(key, { url: dest, title: defMatch[3] ? defMatch[3].slice(1, -1) : '' });
      }
      i += defMatch[0].replace(/\n$/, '').split('\n').length;
      continue;
    }

    // paragrafo (con titolo setext)
    const buf: string[] = [line];
    i++;
    let setext = 0;
    while (i < lines.length && !isBlank(lines[i])) {
      const se = RE_SETEXT.exec(lines[i]);
      if (se && indentOf(lines[i]) < 4) {
        setext = se[1][0] === '=' ? 1 : 2;
        i++;
        break;
      }
      if (interruptsParagraph(lines[i])) break;
      // una tabella può iniziare subito dopo un paragrafo solo se ha la riga delimitatrice
      buf.push(lines[i]);
      i++;
    }
    const text = buf.map((l) => l.replace(/^[ \t]+/, '')).join('\n').replace(/[ \t]+$/, '');
    if (setext) out.push(`<h${setext}>${renderInline(text, ctx.refs, ctx.opts)}</h${setext}>`);
    else para(text);
  }
  return out.join('\n');
}

/** Legge una lista a partire da `start`; restituisce l'HTML e la riga successiva. */
function parseList(lines: string[], start: number, ctx: Ctx): { html: string; next: number } {
  const first = RE_LIST.exec(lines[start])!;
  const kind = listMarkerKind(first[2]);
  const ordered = kind[0] === 'o';
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const items: { lines: string[]; blankBefore: boolean }[] = [];
  let i = start;
  let loose = false;

  while (i < lines.length) {
    const m = RE_LIST.exec(lines[i]);
    if (!m || listMarkerKind(m[2]) !== kind || RE_HR.test(lines[i])) break;
    const markerEnd = m[1].length + m[2].length;
    const spaces = m[3].replace(/\t/g, '    ').length;
    let contentIndent: number;
    let firstText = m[4];
    if (m[4].trim() === '') {
      contentIndent = markerEnd + 1;
      firstText = '';
    } else if (spaces >= 5) {
      contentIndent = markerEnd + 1;
      firstText = ' '.repeat(spaces - 1) + m[4];
    } else contentIndent = markerEnd + spaces;

    const body: string[] = [firstText];
    i++;
    let pendingBlank = 0;
    let fenceMark = '';
    const fm0 = RE_FENCE.exec(firstText);
    if (fm0) fenceMark = fm0[2];
    while (i < lines.length) {
      const l = lines[i];
      if (isBlank(l)) {
        pendingBlank++;
        i++;
        continue;
      }
      const li = indentOf(l);
      if (li >= contentIndent) {
        for (let b = 0; b < pendingBlank; b++) body.push('');
        pendingBlank = 0;
        const stripped = l.slice(contentIndent);
        body.push(stripped);
        const f = RE_FENCE.exec(stripped);
        if (f) {
          if (!fenceMark) fenceMark = f[2];
          else if (f[2][0] === fenceMark[0] && f[2].length >= fenceMark.length && f[3].trim() === '') fenceMark = '';
        }
        i++;
        continue;
      }
      // continuazione pigra di un paragrafo
      if (pendingBlank === 0 && !fenceMark && !interruptsParagraph(l) && !RE_LIST.test(l) && !isBlank(body[body.length - 1]) && body[body.length - 1] !== '') {
        body.push(l.replace(/^[ \t]+/, ''));
        i++;
        continue;
      }
      break;
    }
    // righe vuote finali non fanno parte dell'elemento; se segue un altro elemento della stessa lista è "larga"
    const next = i < lines.length ? RE_LIST.exec(lines[i]) : null;
    const continues = !!next && listMarkerKind(next[2]) === kind && !RE_HR.test(lines[i]) && indentOf(lines[i]) < contentIndent;
    if (pendingBlank > 0 && continues) loose = true;
    items.push({ lines: body, blankBefore: pendingBlank > 0 });
    if (!continues) {
      break;
    }
  }

  // un elemento con due blocchi separati da una riga vuota (fuori da un blocco di codice) rende larga la lista
  for (const it of items) if (hasBlankBetweenBlocks(it.lines)) loose = true;

  const html = items
    .map((it) => {
      let body = it.lines;
      let task = '';
      const t = /^\[([ xX])\][ \t]+/.exec(body[0] ?? '');
      if (t) body = [body[0].slice(t[0].length), ...body.slice(1)];
      const inner = renderBlocks(body, { ...ctx, depth: ctx.depth + 1 }, !loose);
      if (t) {
        const done = t[1] !== ' ';
        // il testo della voce (senza tag, solo la prima parte prima di una sotto-lista) è il nome accessibile della casella
        const name = inner.split(/<(?:ul|ol)[\s>]/)[0].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
        task = `<input type="checkbox" class="md-task"${done ? ' checked' : ''} disabled aria-label="${name}"> `;
      }
      const cls = t ? ' class="md-task-item"' : '';
      // elemento "stretto": il testo sta direttamente nel <li>, le sotto-liste vanno a capo
      const sep = !loose && /^<(ul|ol|pre|blockquote|table|h\d|hr)/.test(inner) ? '\n' : loose ? '\n' : '';
      const closeSep = loose || /<\/(ul|ol|pre|blockquote|table)>$/.test(inner) ? '\n' : '';
      return `<li${cls}>${sep}${task}${inner}${closeSep}</li>`;
    })
    .join('\n');
  const tag = ordered ? 'ol' : 'ul';
  const startAttr = ordered && startNum !== 1 ? ` start="${startNum}"` : '';
  return { html: `<${tag}${startAttr}>\n${html}\n</${tag}>`, next: i };
}

function hasBlankBetweenBlocks(lines: string[]): boolean {
  let fence = '';
  for (let k = 0; k < lines.length; k++) {
    const l = lines[k];
    const f = RE_FENCE.exec(l);
    if (f) {
      if (!fence) fence = f[2];
      else if (f[2][0] === fence[0] && f[2].length >= fence.length && f[3].trim() === '') fence = '';
    }
    if (!fence && isBlank(l) && k > 0 && k < lines.length - 1 && indentOf(lines[k + 1]) === 0 && !isBlank(lines[k + 1])) return true;
  }
  return false;
}

/** Converte un testo Markdown in HTML (vedi l'intestazione del file per la sicurezza). */
export function renderMarkdown(source: string, options: Partial<RenderOptions> = {}): string {
  const opts: RenderOptions = { ...DEFAULT_RENDER, ...options };
  const text = source
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '�')
    .replace(/^﻿/, '')
    .split('\n')
    .map((l) => (l.includes('\t') ? expandTabs(l) : l));
  const ctx: Ctx = { refs: new Map(), opts, depth: 0 };
  const html = renderBlocks(text, ctx, false);
  // le definizioni di riferimento possono stare dopo l'uso: se ce ne sono, si rifà il conteggio con tutte
  return ctx.refs.size > 0 ? renderBlocks(text, ctx, false) : html;
}

/** Sostituisce le tabulazioni con spazi (tabulazione ogni 4 colonne). */
function expandTabs(line: string): string {
  let out = '';
  for (const ch of line) {
    if (ch === '\t') out += ' '.repeat(4 - (out.length % 4));
    else out += ch;
  }
  return out;
}
