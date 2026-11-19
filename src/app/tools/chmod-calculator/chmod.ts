// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/** Permessi Unix come numero 0..0o7777 (setuid 0o4000, setgid 0o2000, sticky 0o1000). */
export const SETUID = 0o4000;
export const SETGID = 0o2000;
export const STICKY = 0o1000;

export type PermClass = 'owner' | 'group' | 'other';
export type PermBit = 'r' | 'w' | 'x';
export type SpecialBit = 'setuid' | 'setgid' | 'sticky';

export const CLASSES: readonly PermClass[] = ['owner', 'group', 'other'];
export const BITS: readonly PermBit[] = ['r', 'w', 'x'];
export const SPECIALS: readonly SpecialBit[] = ['setuid', 'setgid', 'sticky'];

const SHIFT: Record<PermClass, number> = { owner: 6, group: 3, other: 0 };
const BIT_VALUE: Record<PermBit, number> = { r: 4, w: 2, x: 1 };
const SPECIAL_VALUE: Record<SpecialBit, number> = { setuid: SETUID, setgid: SETGID, sticky: STICKY };

export function bitMask(cls: PermClass, bit: PermBit): number {
  return BIT_VALUE[bit] << SHIFT[cls];
}

export function specialMask(bit: SpecialBit): number {
  return SPECIAL_VALUE[bit];
}

export function hasBit(mode: number, cls: PermClass, bit: PermBit): boolean {
  return (mode & bitMask(cls, bit)) !== 0;
}

export function hasSpecial(mode: number, bit: SpecialBit): boolean {
  return (mode & SPECIAL_VALUE[bit]) !== 0;
}

/** Attiva o disattiva un singolo bit e restituisce il nuovo permesso. */
export function setBit(mode: number, cls: PermClass, bit: PermBit, on: boolean): number {
  const m = bitMask(cls, bit);
  return on ? mode | m : mode & ~m;
}

export function setSpecial(mode: number, bit: SpecialBit, on: boolean): number {
  const m = SPECIAL_VALUE[bit];
  return on ? mode | m : mode & ~m;
}

export type ChmodError = 'empty' | 'octal-chars' | 'octal-length' | 'sym-length' | 'sym-chars' | 'expr-empty' | 'expr-syntax' | 'expr-op' | 'expr-perm';
export type Parsed = { ok: true; mode: number } | { ok: false; error: ChmodError; at?: string };

/** Ottale a 3 o 4 cifre (anche con zero iniziale, es. 0755); accetta il prefisso `0o`. */
export function parseOctal(input: string): Parsed {
  let s = input.trim();
  if (s === '') return { ok: false, error: 'empty' };
  if (/^0o/i.test(s)) s = s.slice(2);
  if (!/^[0-7]+$/.test(s)) return { ok: false, error: 'octal-chars' };
  if (s.length < 3 || s.length > 4) return { ok: false, error: 'octal-length' };
  return { ok: true, mode: parseInt(s, 8) };
}

/** Ottale: tre cifre, quattro se c'è un bit speciale (o se `forceFour`). */
export function toOctal(mode: number, forceFour = false): string {
  const m = mode & 0o7777;
  const s = m.toString(8);
  if (forceFour || m > 0o777) return s.padStart(4, '0');
  return s.padStart(3, '0');
}

/** Forma simbolica a 9 caratteri, con s/S (setuid, setgid) e t/T (sticky). */
export function toSymbolic(mode: number): string {
  const out: string[] = [];
  for (const cls of CLASSES) {
    const r = hasBit(mode, cls, 'r') ? 'r' : '-';
    const w = hasBit(mode, cls, 'w') ? 'w' : '-';
    const x = hasBit(mode, cls, 'x');
    let xc = x ? 'x' : '-';
    if (cls === 'owner' && hasSpecial(mode, 'setuid')) xc = x ? 's' : 'S';
    if (cls === 'group' && hasSpecial(mode, 'setgid')) xc = x ? 's' : 'S';
    if (cls === 'other' && hasSpecial(mode, 'sticky')) xc = x ? 't' : 'T';
    out.push(r, w, xc);
  }
  return out.join('');
}

/** Simbolico completo: `rwxr-xr-x`, anche con il tipo davanti (`-rwxr-xr-x`, `drwxr-xr-t`) come in `ls -l`. */
export function parseSymbolic(input: string): Parsed {
  let s = input.trim();
  if (s === '') return { ok: false, error: 'empty' };
  if (s.length === 10 && /^[-dlcbps]/.test(s)) s = s.slice(1);
  if (s.length !== 9) return { ok: false, error: 'sym-length' };
  let mode = 0;
  for (let i = 0; i < 9; i++) {
    const ch = s[i];
    const cls = CLASSES[Math.floor(i / 3)];
    const pos = i % 3;
    if (pos === 0) {
      if (ch === 'r') mode |= bitMask(cls, 'r');
      else if (ch !== '-') return { ok: false, error: 'sym-chars', at: ch };
    } else if (pos === 1) {
      if (ch === 'w') mode |= bitMask(cls, 'w');
      else if (ch !== '-') return { ok: false, error: 'sym-chars', at: ch };
    } else {
      const special: SpecialBit = cls === 'owner' ? 'setuid' : cls === 'group' ? 'setgid' : 'sticky';
      const exec = cls === 'other' ? 't' : 's';
      if (ch === 'x') mode |= bitMask(cls, 'x');
      else if (ch === exec) mode |= bitMask(cls, 'x') | SPECIAL_VALUE[special];
      else if (ch === exec.toUpperCase()) mode |= SPECIAL_VALUE[special];
      else if (ch !== '-') return { ok: false, error: 'sym-chars', at: ch };
    }
  }
  return { ok: true, mode };
}

export interface ApplyOptions {
  /** `X` imposta l'esecuzione solo per le cartelle o se qualcuno ha già l'esecuzione. */
  isDir?: boolean;
}

/**
 * Applica un'espressione simbolica di `chmod` (`u+x,go-w`, `a=rX`, `g=u`, `u+s`…) a un permesso di partenza.
 * Senza chi (`+x`) vale `a`, come con umask 000: la umask del tuo sistema non viene applicata.
 */
export function applySymbolic(expr: string, start: number, opts: ApplyOptions = {}): Parsed {
  const text = expr.trim();
  if (text === '') return { ok: false, error: 'expr-empty' };
  let mode = start & 0o7777;
  for (const clause of text.split(',')) {
    const m = /^([ugoa]*)(.*)$/.exec(clause);
    if (!m) return { ok: false, error: 'expr-syntax', at: clause };
    const whoText = m[1];
    let rest = m[2];
    if (clause === '') return { ok: false, error: 'expr-syntax', at: clause };
    if (rest === '') return { ok: false, error: whoText ? 'expr-op' : 'expr-syntax', at: clause };
    const who = new Set<PermClass>();
    for (const c of whoText) {
      if (c === 'u') who.add('owner');
      else if (c === 'g') who.add('group');
      else if (c === 'o') who.add('other');
      else CLASSES.forEach((k) => who.add(k));
    }
    const explicitWho = whoText !== '';
    if (!explicitWho) CLASSES.forEach((k) => who.add(k));
    // una o più operazioni di seguito: u+r-w
    let any = false;
    while (rest !== '') {
      const op = rest[0];
      if (op !== '+' && op !== '-' && op !== '=') return { ok: false, error: 'expr-op', at: rest[0] };
      rest = rest.slice(1);
      let permText = '';
      while (rest !== '' && !'+-='.includes(rest[0])) {
        permText += rest[0];
        rest = rest.slice(1);
      }
      const value = permissionValue(permText, who, mode, opts);
      if (typeof value === 'string') return { ok: false, error: 'expr-perm', at: value };
      mode = applyOp(mode, op, value, who, whoText);
      any = true;
    }
    if (!any) return { ok: false, error: 'expr-op', at: clause };
  }
  return { ok: true, mode };
}

/** Bit richiesti da `permText` per le classi `who`; una stringa se contiene un carattere non valido. */
function permissionValue(permText: string, who: Set<PermClass>, mode: number, opts: ApplyOptions): number | string {
  if (permText.length === 1 && 'ugo'.includes(permText)) {
    // copia i permessi di una classe: g=u
    const src: PermClass = permText === 'u' ? 'owner' : permText === 'g' ? 'group' : 'other';
    const bits = (mode >> SHIFT[src]) & 7;
    let v = 0;
    for (const cls of who) v |= bits << SHIFT[cls];
    return v;
  }
  let v = 0;
  for (const ch of permText) {
    if (ch === 'r' || ch === 'w' || ch === 'x') {
      for (const cls of who) v |= bitMask(cls, ch);
    } else if (ch === 'X') {
      if (opts.isDir || (mode & 0o111) !== 0) for (const cls of who) v |= bitMask(cls, 'x');
    } else if (ch === 's') {
      if (who.has('owner')) v |= SETUID;
      if (who.has('group')) v |= SETGID;
    } else if (ch === 't') {
      v |= STICKY;
    } else {
      return ch;
    }
  }
  return v;
}

function applyOp(mode: number, op: string, value: number, who: Set<PermClass>, whoText: string): number {
  if (op === '+') return mode | value;
  if (op === '-') return mode & ~value;
  // '=': azzera rwx delle classi indicate (e setuid per u, setgid per g, tutti per a) poi imposta
  let clear = 0;
  for (const cls of who) clear |= 7 << SHIFT[cls];
  if (whoText === '' || whoText.includes('a')) clear |= SETUID | SETGID | STICKY;
  else {
    if (who.has('owner')) clear |= SETUID;
    if (who.has('group')) clear |= SETGID;
  }
  return (mode & ~clear) | value;
}

export interface CommandOptions {
  path?: string;
  recursive?: boolean;
  /** Scrive sempre quattro cifre. */
  fourDigits?: boolean;
}

/** Il nome del file viene racchiuso tra apici solo se contiene caratteri che la shell interpreterebbe. */
export function shellQuote(path: string): string {
  if (/^[A-Za-z0-9_@%+=:,./~-]+$/.test(path)) return path;
  return "'" + path.replace(/'/g, "'\\''") + "'";
}

export function chmodCommand(mode: number, opts: CommandOptions = {}): string {
  const parts = ['chmod'];
  if (opts.recursive) parts.push('-R');
  parts.push(toOctal(mode, opts.fourDigits));
  parts.push(shellQuote(opts.path?.trim() || 'file'));
  return parts.join(' ');
}

/** Comando con la forma simbolica (`chmod u=rwx,g=rx,o=rx file`), valida anche per i bit speciali. */
export function chmodCommandSymbolic(mode: number, opts: CommandOptions = {}): string {
  const parts = ['chmod'];
  if (opts.recursive) parts.push('-R');
  const groups: string[] = [];
  const letters: Record<PermClass, string> = { owner: 'u', group: 'g', other: 'o' };
  for (const cls of CLASSES) {
    let p = '';
    for (const b of BITS) if (hasBit(mode, cls, b)) p += b;
    if (cls === 'owner' && hasSpecial(mode, 'setuid')) p += 's';
    if (cls === 'group' && hasSpecial(mode, 'setgid')) p += 's';
    if (cls === 'other' && hasSpecial(mode, 'sticky')) p += 't';
    groups.push(`${letters[cls]}=${p}`);
  }
  parts.push(groups.join(','));
  parts.push(shellQuote(opts.path?.trim() || 'file'));
  return parts.join(' ');
}

export interface Preset {
  id: string;
  mode: number;
}

/** Permessi di uso comune; la spiegazione sta nel dizionario (`chmod.preset.<id>`). */
export const PRESETS: readonly Preset[] = [
  { id: '644', mode: 0o644 },
  { id: '664', mode: 0o664 },
  { id: '600', mode: 0o600 },
  { id: '640', mode: 0o640 },
  { id: '400', mode: 0o400 },
  { id: '444', mode: 0o444 },
  { id: '755', mode: 0o755 },
  { id: '775', mode: 0o775 },
  { id: '700', mode: 0o700 },
  { id: '750', mode: 0o750 },
  { id: '777', mode: 0o777 },
  { id: '1777', mode: 0o1777 },
  { id: '2775', mode: 0o2775 },
  { id: '4755', mode: 0o4755 },
];

/** Cifra ottale (0-7) di una classe. */
export function classDigit(mode: number, cls: PermClass): number {
  return (mode >> SHIFT[cls]) & 7;
}
