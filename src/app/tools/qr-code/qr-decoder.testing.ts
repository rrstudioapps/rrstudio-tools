// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Decoder QR minimale SOLO per i test (non entra nella build): legge una matrice di moduli o i pixel
 * di un'immagine, corregge gli errori con Reed-Solomon (Berlekamp-Massey) e restituisce il testo.
 * Serve a verificare che l'encoder produca simboli leggibili, anche con un logo che copre il centro.
 */
import { Ecl, alignmentPositions, blockLayout } from './qr-encoder';

const ECLS: Ecl[] = ['M', 'L', 'H', 'Q']; // indice = bit del formato (00=M, 01=L, 10=H, 11=Q)

// ---- GF(256) ----
const EXP = new Array<number>(512).fill(0);
const LOG = new Array<number>(256).fill(0);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Corregge un blocco (dati + ecc); lancia se gli errori superano la capacità. */
function rsCorrect(block: number[], eccLen: number): number[] {
  const n = block.length;
  const synd: number[] = [];
  let bad = false;
  for (let i = 0; i < eccLen; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s = mul(s, EXP[i]) ^ block[j];
    synd.push(s);
    if (s) bad = true;
  }
  if (!bad) return block;
  // Berlekamp-Massey
  let C = [1];
  let B = [1];
  let L = 0;
  let m = 1;
  let b = 1;
  for (let i = 0; i < eccLen; i++) {
    let d = synd[i];
    for (let j = 1; j <= L; j++) d ^= mul(C[j] ?? 0, synd[i - j]);
    if (d === 0) {
      m++;
    } else {
      const T = C.slice();
      const coef = mul(d, EXP[255 - LOG[b]]);
      while (C.length < B.length + m) C.push(0);
      for (let j = 0; j < B.length; j++) C[j + m] ^= mul(coef, B[j]);
      if (2 * L <= i) {
        L = i + 1 - L;
        B = T;
        b = d;
        m = 1;
      } else m++;
    }
  }
  if (L * 2 > eccLen) throw new Error('troppi errori');
  // Chien: posizioni (indice dall'inizio del blocco) in cui Λ(α^-pos_da_fine) = 0
  const out = block.slice();
  const positions: number[] = [];
  for (let p = 0; p < n; p++) {
    const xinv = EXP[(255 - p) % 255]; // α^-p con p = distanza dalla fine
    let v = 0;
    for (let j = 0; j < C.length; j++) v ^= C[j] === 0 ? 0 : EXP[(LOG[C[j]] + LOG[xinv] * j) % 255];
    if (v === 0) positions.push(p);
  }
  if (positions.length !== L) throw new Error('correzione fallita');
  // Ω = S(x)·Λ(x) mod x^eccLen ; Forney
  const omega: number[] = new Array(eccLen).fill(0);
  for (let i = 0; i < eccLen; i++) for (let j = 0; j < C.length && j <= i; j++) omega[i] ^= mul(synd[i - j], C[j]);
  for (const p of positions) {
    const x = EXP[p];
    const xinv = EXP[(255 - p) % 255];
    let num = 0;
    for (let j = 0; j < omega.length; j++) num ^= omega[j] === 0 ? 0 : EXP[(LOG[omega[j]] + LOG[xinv] * j) % 255];
    let den = 0;
    for (let j = 1; j < C.length; j += 2) den ^= C[j] === 0 ? 0 : EXP[(LOG[C[j]] + LOG[xinv] * (j - 1)) % 255];
    const mag = mul(x, mul(num, EXP[255 - LOG[den]])); // b=0 → fattore X
    out[n - 1 - p] ^= mag;
  }
  // verifica finale
  for (let i = 0; i < eccLen; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s = mul(s, EXP[i]) ^ out[j];
    if (s) throw new Error('correzione non valida');
  }
  return out;
}

function bchFormat(data: number): number {
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}
const popcount = (x: number): number => x.toString(2).split('1').length - 1;

function functionMap(version: number): boolean[][] {
  const n = version * 4 + 17;
  const f = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const rect = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < n && y < n) f[y][x] = true;
  };
  rect(0, 0, 8, 8);
  rect(n - 8, 0, n - 1, 8);
  rect(0, n - 8, 8, n - 1);
  for (let i = 0; i < n; i++) f[6][i] = f[i][6] = true;
  const pos = alignmentPositions(version);
  pos.forEach((cy, i) =>
    pos.forEach((cx, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) return;
      rect(cx - 2, cy - 2, cx + 2, cy + 2);
    }),
  );
  if (version >= 7) {
    rect(n - 11, 0, n - 9, 5);
    rect(0, n - 11, 5, n - 9);
  }
  return f;
}

const maskFn = [
  (x: number, y: number) => (x + y) % 2 === 0,
  (_x: number, y: number) => y % 2 === 0,
  (x: number) => x % 3 === 0,
  (x: number, y: number) => (x + y) % 3 === 0,
  (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

export interface Decoded {
  text: string;
  version: number;
  ecl: Ecl;
  mask: number;
  /** Codeword corretti dal Reed-Solomon (0 = lettura pulita). */
  corrected: number;
}

/** Decodifica la matrice di moduli (true = scuro). Lancia se illeggibile. */
export function decodeMatrix(m: readonly (readonly boolean[])[]): Decoded {
  const n = m.length;
  const version = (n - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || version > 40) throw new Error('dimensione non valida');
  // informazioni di formato (prima copia), con la distanza di Hamming minima
  let raw = 0;
  const first: [number, number][] = [];
  for (let i = 0; i <= 5; i++) first.push([8, i]);
  first.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i < 15; i++) first.push([14 - i, 8]);
  first.forEach(([x, y], i) => (raw |= (m[y][x] ? 1 : 0) << i));
  let best = -1;
  let dist = 99;
  for (let d = 0; d < 32; d++) {
    const dd = popcount(bchFormat(d) ^ raw);
    if (dd < dist) {
      dist = dd;
      best = d;
    }
  }
  if (dist > 3) throw new Error('formato illeggibile');
  const ecl = ECLS[best >> 3];
  const mask = best & 7;
  const fmap = functionMap(version);
  const bits: boolean[] = [];
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? n - 1 - vert : vert;
        if (!fmap[y][x]) bits.push(m[y][x] !== maskFn[mask](x, y));
      }
    }
  }
  const { numBlocks, eccLen, rawCodewords } = blockLayout(version, ecl);
  const cw: number[] = [];
  for (let i = 0; i < rawCodewords; i++) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | (bits[i * 8 + k] ? 1 : 0);
    cw.push(b);
  }
  // de-interleave
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortLen = Math.floor(rawCodewords / numBlocks);
  const blocks: number[][] = Array.from({ length: numBlocks }, () => []);
  let k = 0;
  const dataShort = shortLen - eccLen;
  for (let i = 0; i < dataShort + 1; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i === dataShort && j < numShort) continue;
      blocks[j].push(cw[k++]);
    }
  }
  for (let i = 0; i < eccLen; i++) for (let j = 0; j < numBlocks; j++) blocks[j].push(cw[k++]);
  let corrected = 0;
  const data: number[] = [];
  for (const b of blocks) {
    const fixed = rsCorrect(b, eccLen);
    corrected += fixed.filter((v, i) => v !== b[i]).length;
    data.push(...fixed.slice(0, fixed.length - eccLen));
  }
  return { text: parseSegments(data, version), version, ecl, mask, corrected };
}

function parseSegments(data: number[], version: number): string {
  let pos = 0;
  const read = (n: number): number => {
    let v = 0;
    for (let i = 0; i < n; i++, pos++) v = (v << 1) | ((data[pos >> 3] >> (7 - (pos & 7))) & 1);
    return v;
  };
  const total = data.length * 8;
  const cc = (a: number, b: number, c: number) => (version <= 9 ? a : version <= 26 ? b : c);
  const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  let out = '';
  const bytes: number[] = [];
  while (pos + 4 <= total) {
    const mode = read(4);
    if (mode === 0) break;
    if (mode === 1) {
      let n = read(cc(10, 12, 14));
      while (n > 0) {
        const c = Math.min(3, n);
        out += String(read(c * 3 + 1)).padStart(c, '0');
        n -= c;
      }
    } else if (mode === 2) {
      let n = read(cc(9, 11, 13));
      while (n >= 2) {
        const v = read(11);
        out += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45];
        n -= 2;
      }
      if (n === 1) out += ALNUM[read(6)];
    } else if (mode === 4) {
      const n = read(cc(8, 16, 16));
      bytes.length = 0;
      for (let i = 0; i < n; i++) bytes.push(read(8));
      out += new TextDecoder().decode(new Uint8Array(bytes));
    } else throw new Error('modo non supportato: ' + mode);
  }
  return out;
}

/**
 * Da pixel RGBA a matrice: cerca il riquadro dei pixel scuri, ricava il lato del modulo dal pattern finder
 * (7 moduli) e campiona il centro di ogni modulo. Basta per immagini senza rotazione, come l'export PNG.
 */
export function matrixFromPixels(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): boolean[][] {
  const lum = (i: number) => 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  let min = 255;
  let max = 0;
  for (let i = 0; i < width * height; i++) {
    const l = lum(i);
    if (l < min) min = l;
    if (l > max) max = l;
  }
  const thr = (min + max) / 2;
  const dark = (x: number, y: number) => lum(y * width + x) < thr;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (dark(x, y)) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new Error('nessun modulo scuro');
  // il finder in alto a sinistra: serie scura iniziale sulla prima riga = 7 moduli
  let run = 0;
  while (x0 + run <= x1 && dark(x0 + run, y0)) run++;
  const mod = run / 7;
  // lato in moduli: tra quelli validi (17 + 4v) il più vicino alla stima dal finder (l'arrotondamento dei pixel sposta di poco)
  const span = x1 - x0 + 1;
  let size = 21;
  let bestErr = Infinity;
  for (let v = 1; v <= 40; v++) {
    const err = Math.abs(span / (17 + 4 * v) - mod);
    if (err < bestErr) {
      bestErr = err;
      size = 17 + 4 * v;
    }
  }
  const unit = (x1 - x0 + 1) / size;
  const grid: boolean[][] = [];
  for (let j = 0; j < size; j++) {
    const row: boolean[] = [];
    for (let i = 0; i < size; i++) row.push(dark(Math.floor(x0 + (i + 0.5) * unit), Math.floor(y0 + (j + 0.5) * unit)));
    grid.push(row);
  }
  return grid;
}
