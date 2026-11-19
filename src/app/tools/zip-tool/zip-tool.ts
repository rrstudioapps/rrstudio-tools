// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { Inflate, zip } from 'fflate';

/**
 * Logica pura dello strumento ZIP. La lettura non usa `unzip` di fflate: l'elenco si ricava dalla directory
 * centrale (senza decomprimere nulla), i limiti si controllano sulle dimensioni dichiarate e la decompressione
 * di ogni voce è a blocchi e si interrompe appena supera la dimensione dichiarata (zip bomb con dimensioni false).
 */

export interface Limits {
  /** Dimensione massima dell'archivio compresso (byte). */
  maxCompressed: number;
  /** Dimensione massima totale dei contenuti espansi (byte). */
  maxExpanded: number;
  /** Numero massimo di voci. */
  maxEntries: number;
}

export const LIMITS: Limits = { maxCompressed: 200 * 1024 * 1024, maxExpanded: 500 * 1024 * 1024, maxEntries: 20_000 };

export type ZipErrorCode = 'notZip' | 'corrupt' | 'tooBigCompressed' | 'tooBigExpanded' | 'tooManyEntries' | 'zip64' | 'unsupported' | 'encrypted';

export class ZipError extends Error {
  constructor(readonly code: ZipErrorCode) {
    super(code);
    this.name = 'ZipError';
  }
}

export type UnsafeReason = 'absolute' | 'parent' | 'empty' | 'control';

export interface ZipEntry {
  /** Posizione nella directory centrale. */
  index: number;
  /** Nome come scritto nell'archivio. */
  name: string;
  /** Percorso normalizzato (barre `/`, senza `./`): vuoto se il nome è pericoloso. */
  path: string;
  dir: boolean;
  /** Dimensione espansa dichiarata. */
  size: number;
  /** Dimensione compressa dichiarata. */
  csize: number;
  method: number;
  encrypted: boolean;
  date: Date | null;
  offset: number;
  /** false per percorsi assoluti, con `..` o con caratteri di controllo: mai estratti. */
  safe: boolean;
  unsafe: UnsafeReason | null;
}

// ---------- percorsi ----------

/** Controlla un nome di voce e restituisce il percorso normalizzato oppure il motivo per cui è pericoloso. */
export function checkPath(name: string): { path: string; unsafe: UnsafeReason | null } {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(name)) return { path: '', unsafe: 'control' };
  const slashed = name.replace(/\\/g, '/');
  if (slashed.startsWith('/') || /^[A-Za-z]:/.test(slashed)) return { path: '', unsafe: 'absolute' };
  const parts = slashed.split('/').filter((p) => p !== '' && p !== '.');
  if (parts.includes('..')) return { path: '', unsafe: 'parent' };
  if (parts.length === 0) return { path: '', unsafe: 'empty' };
  return { path: parts.join('/') + (slashed.endsWith('/') ? '/' : ''), unsafe: null };
}

/** Percorso pulito per un file da aggiungere all'archivio (cartelle mantenute, niente `..` né percorsi assoluti). */
export function cleanInputPath(raw: string): string {
  const parts = raw
    .replace(/\\/g, '/')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]/g, '_')
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p !== '' && p !== '.' && p !== '..');
  return parts.join('/') || 'file';
}

/** Rende unici i percorsi: `a.txt`, `a (2).txt`, `a (3).txt`… (il confronto ignora maiuscole e minuscole). */
export function uniquePaths(paths: readonly string[]): string[] {
  const used = new Set<string>();
  return paths.map((p) => {
    let candidate = p;
    let n = 1;
    const slash = p.lastIndexOf('/');
    const dir = p.slice(0, slash + 1);
    const file = p.slice(slash + 1);
    const dot = file.lastIndexOf('.');
    const stem = dot > 0 ? file.slice(0, dot) : file;
    const ext = dot > 0 ? file.slice(dot) : '';
    while (used.has(candidate.toLowerCase())) candidate = `${dir}${stem} (${++n})${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

/** Nome dell'archivio con estensione .zip e senza caratteri vietati. */
export function archiveName(input: string, fallback = 'archivio'): string {
  const base = input
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\.zip$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return `${base || fallback}.zip`;
}

// ---------- limiti ----------

export function formatLimit(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** Controlla i limiti sulle dimensioni dichiarate, prima di decomprimere qualsiasi cosa. */
export function checkLimits(entries: readonly Pick<ZipEntry, 'size'>[], compressedBytes: number, limits: Limits = LIMITS): ZipErrorCode | null {
  if (compressedBytes > limits.maxCompressed) return 'tooBigCompressed';
  if (entries.length > limits.maxEntries) return 'tooManyEntries';
  let total = 0;
  for (const e of entries) {
    total += e.size;
    if (total > limits.maxExpanded) return 'tooBigExpanded';
  }
  return null;
}

// ---------- lettura ----------

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

function view(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

/** Decodifica un nome: UTF-8 se possibile, altrimenti Latin-1 (vecchi archivi senza il flag UTF-8). */
function decodeName(bytes: Uint8Array, utf8Flag: boolean): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    if (utf8Flag) return new TextDecoder('utf-8').decode(bytes);
    return Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  }
}

/** Data/ora DOS del formato ZIP; null se non valida. */
export function dosToDate(time: number, date: number): Date | null {
  if (date === 0) return null;
  const year = ((date >> 9) & 0x7f) + 1980;
  const month = (date >> 5) & 0x0f;
  const day = date & 0x1f;
  const h = (time >> 11) & 0x1f;
  const m = (time >> 5) & 0x3f;
  const s = (time & 0x1f) * 2;
  if (month < 1 || month > 12 || day < 1 || day > 31 || h > 23 || m > 59 || s > 59) return null;
  return new Date(year, month - 1, day, h, m, s);
}

/** Elenco delle voci dalla directory centrale, senza decomprimere. Lancia ZipError se non è uno ZIP valido o supera i limiti. */
export function listZip(data: Uint8Array, limits: Limits = LIMITS): ZipEntry[] {
  if (data.length > limits.maxCompressed) throw new ZipError('tooBigCompressed');
  if (data.length < 22) throw new ZipError('notZip');
  const dv = view(data);
  // fine della directory centrale: si cerca all'indietro (può seguire un commento di al massimo 65535 byte)
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 0xffff); i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('notZip');
  const total = dv.getUint16(eocd + 10, true);
  const cdSize = dv.getUint32(eocd + 12, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new ZipError('zip64');
  if (total > limits.maxEntries) throw new ZipError('tooManyEntries');
  if (cdOffset + cdSize > eocd) throw new ZipError('corrupt');

  const entries: ZipEntry[] = [];
  let p = cdOffset;
  const end = cdOffset + cdSize;
  for (let i = 0; i < total; i++) {
    if (p + 46 > end || dv.getUint32(p, true) !== SIG_CENTRAL) throw new ZipError('corrupt');
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const time = dv.getUint16(p + 12, true);
    const dosDate = dv.getUint16(p + 14, true);
    const csize = dv.getUint32(p + 20, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    if (p + 46 + nameLen + extraLen + commentLen > end) throw new ZipError('corrupt');
    if (csize === 0xffffffff || size === 0xffffffff || offset === 0xffffffff) throw new ZipError('zip64');
    const name = decodeName(data.subarray(p + 46, p + 46 + nameLen), (flags & 0x800) !== 0);
    const checked = checkPath(name);
    entries.push({
      index: i,
      name,
      path: checked.path,
      dir: name.endsWith('/') || name.endsWith('\\'),
      size,
      csize,
      method,
      encrypted: (flags & 0x41) !== 0,
      date: dosToDate(time, dosDate),
      offset,
      safe: checked.unsafe === null,
      unsafe: checked.unsafe,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const err = checkLimits(entries, data.length, limits);
  if (err) throw new ZipError(err);
  return entries;
}

const CHUNK = 64 * 1024;

/** Cede il controllo al browser, così la pagina resta reattiva durante estrazioni lunghe. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Estrae una voce. La dimensione dichiarata è un tetto: se i dati veri la superano o non la raggiungono l'archivio è danneggiato. */
export async function extractEntry(data: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  if (entry.dir) return new Uint8Array(0);
  if (entry.encrypted) throw new ZipError('encrypted');
  if (entry.method !== 0 && entry.method !== 8) throw new ZipError('unsupported');
  const dv = view(data);
  const o = entry.offset;
  if (o + 30 > data.length || dv.getUint32(o, true) !== SIG_LOCAL) throw new ZipError('corrupt');
  const start = o + 30 + dv.getUint16(o + 26, true) + dv.getUint16(o + 28, true);
  const stop = start + entry.csize;
  if (stop > data.length) throw new ZipError('corrupt');
  const packed = data.subarray(start, stop);

  if (entry.method === 0) {
    if (entry.csize !== entry.size) throw new ZipError('corrupt');
    return packed.slice();
  }
  const out = new Uint8Array(entry.size);
  let written = 0;
  let overflow = false;
  const inflate = new Inflate((chunk) => {
    if (written + chunk.length > entry.size) {
      overflow = true;
      return;
    }
    out.set(chunk, written);
    written += chunk.length;
  });
  try {
    let pos = 0;
    let last = false;
    for (let n = 1; !last; n++) {
      const next = pos + CHUNK;
      last = next >= packed.length;
      inflate.push(packed.subarray(pos, next), last);
      pos = next;
      if (overflow) throw new ZipError('corrupt');
      if (n % 32 === 0) await tick();
    }
  } catch (e) {
    throw e instanceof ZipError ? e : new ZipError('corrupt');
  }
  if (written !== entry.size) throw new ZipError('corrupt');
  return out;
}

// ---------- creazione ----------

export type ZipLevel = 0 | 1 | 6 | 9;
export const ZIP_LEVELS: readonly ZipLevel[] = [0, 1, 6, 9];

export interface ZipInput {
  path: string;
  data: Uint8Array;
  /** Data di modifica in millisecondi (opzionale). */
  mtime?: number;
}

/** Crea l'archivio (compressione in un Worker di fflate, la pagina resta reattiva). Percorsi già puliti e unici. */
export function createZip(files: readonly ZipInput[], level: ZipLevel, limits: Limits = LIMITS): Promise<Uint8Array> {
  if (files.length > limits.maxEntries) return Promise.reject(new ZipError('tooManyEntries'));
  const total = files.reduce((n, f) => n + f.data.length, 0);
  if (total > limits.maxExpanded) return Promise.reject(new ZipError('tooBigExpanded'));
  const tree: Record<string, [Uint8Array, { level: ZipLevel; mtime?: number }]> = {};
  const paths = uniquePaths(files.map((f) => cleanInputPath(f.path)));
  files.forEach((f, i) => {
    // le date prima del 1980 non si possono scrivere in uno ZIP
    const mtime = f.mtime !== undefined && f.mtime >= Date.UTC(1980, 0, 2) ? f.mtime : undefined;
    tree[paths[i]] = [f.data, { level, mtime }];
  });
  return new Promise((resolve, reject) => {
    zip(tree, (err, out) => (err ? reject(new ZipError('corrupt')) : resolve(out)));
  });
}

/** Filtro di ricerca sull'elenco (ignora maiuscole e minuscole; cerca nel nome originale). */
export function filterEntries<T extends { name: string }>(entries: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  return q ? entries.filter((e) => e.name.toLowerCase().includes(q)) : [...entries];
}

/** Voci che si possono estrarre: file sicuri e non cifrati. */
export function extractable(e: ZipEntry): boolean {
  return !e.dir && e.safe && !e.encrypted && (e.method === 0 || e.method === 8);
}
