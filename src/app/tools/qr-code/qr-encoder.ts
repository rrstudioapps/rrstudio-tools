// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Encoder QR Code (ISO/IEC 18004, Model 2) in TypeScript puro: modi numerico, alfanumerico e byte,
 * versioni 1-40, correzione d'errore L/M/Q/H con Reed-Solomon su GF(256), scelta della maschera
 * con le quattro penalità della norma. Nessuna dipendenza.
 */
export type Ecl = 'L' | 'M' | 'Q' | 'H';
export type QrMode = 'numeric' | 'alphanumeric' | 'byte';

export const MIN_VERSION = 1;
export const MAX_VERSION = 40;

const ECL_INDEX: Record<Ecl, number> = { L: 0, M: 1, Q: 2, H: 3 };
/** Bit del livello nel campo "format information" (L=01, M=00, Q=11, H=10). */
const ECL_FORMAT_BITS: Record<Ecl, number> = { L: 1, M: 0, Q: 3, H: 2 };

/** Byte di correzione per blocco, per [livello][versione] (indice 0 non usato). */
const ECC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
/** Numero di blocchi di correzione, per [livello][versione]. */
const NUM_ERROR_CORRECTION_BLOCKS: readonly (readonly number[])[] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

export class QrError extends Error {
  constructor(readonly code: 'too-long') {
    super(code);
  }
}

export interface QrCode {
  version: number;
  ecl: Ecl;
  mask: number;
  mode: QrMode;
  /** Lato in moduli (17 + 4 * versione). */
  size: number;
  /** modules[y][x]: true = modulo scuro. */
  modules: boolean[][];
  /** Codeword di dati (senza correzione), utili per i test. */
  dataCodewords: number[];
}

export interface EncodeOptions {
  ecl: Ecl;
  /** Versione minima (default 1): la versione effettiva è la più piccola che contiene i dati. */
  minVersion?: number;
  /** Maschera 0-7 forzata (per i test); di norma si sceglie quella con la penalità minore. */
  mask?: number;
}

export function utf8Bytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

export function detectMode(text: string): QrMode {
  if (/^[0-9]*$/.test(text)) return 'numeric';
  if ([...text].every((c) => ALPHANUMERIC.includes(c))) return 'alphanumeric';
  return 'byte';
}

/** Numero di bit del contatore di caratteri per modo e versione. */
function charCountBits(mode: QrMode, version: number): number {
  const i = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  return { numeric: [10, 12, 14], alphanumeric: [9, 11, 13], byte: [8, 16, 16] }[mode][i];
}

/** Moduli disponibili per i dati (tolti i pattern di funzione), compresi i bit di resto. */
export function numRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** Codeword di dati (senza correzione) che stanno in una versione. */
export function numDataCodewords(version: number, ecl: Ecl): number {
  const e = ECL_INDEX[ecl];
  return Math.floor(numRawDataModules(version) / 8) - ECC_CODEWORDS_PER_BLOCK[e][version] * NUM_ERROR_CORRECTION_BLOCKS[e][version];
}

function appendBits(bits: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

/** Bit del segmento (indicatore di modo + contatore + dati) per una data versione. */
function segmentBits(text: string, mode: QrMode, version: number): number[] {
  const bits: number[] = [];
  if (mode === 'numeric') {
    appendBits(bits, 0b0001, 4);
    appendBits(bits, text.length, charCountBits(mode, version));
    for (let i = 0; i < text.length; ) {
      const n = Math.min(3, text.length - i);
      appendBits(bits, parseInt(text.substr(i, n), 10), n * 3 + 1);
      i += n;
    }
  } else if (mode === 'alphanumeric') {
    appendBits(bits, 0b0010, 4);
    appendBits(bits, text.length, charCountBits(mode, version));
    let i = 0;
    for (; i + 2 <= text.length; i += 2) {
      appendBits(bits, ALPHANUMERIC.indexOf(text[i]) * 45 + ALPHANUMERIC.indexOf(text[i + 1]), 11);
    }
    if (i < text.length) appendBits(bits, ALPHANUMERIC.indexOf(text[i]), 6);
  } else {
    const bytes = utf8Bytes(text);
    appendBits(bits, 0b0100, 4);
    appendBits(bits, bytes.length, charCountBits(mode, version));
    for (const b of bytes) appendBits(bits, b, 8);
  }
  return bits;
}

/** Quanti byte UTF-8 (in modo byte) entrano al massimo con un livello di correzione: guida per l'interfaccia. */
export function maxByteCapacity(ecl: Ecl): number {
  const cap = numDataCodewords(MAX_VERSION, ecl) * 8 - 4 - charCountBits('byte', MAX_VERSION);
  return Math.floor(cap / 8);
}

// ---- Reed-Solomon su GF(2^8), polinomio 0x11D ----

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const result: number[] = new Array(degree - 1).fill(0);
  result.push(1);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result: number[] = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= gfMultiply(coef, factor)));
  }
  return result;
}

/** Struttura a blocchi di una versione/livello (usata anche dal decoder dei test). */
export function blockLayout(version: number, ecl: Ecl): { numBlocks: number; eccLen: number; rawCodewords: number } {
  const e = ECL_INDEX[ecl];
  return {
    numBlocks: NUM_ERROR_CORRECTION_BLOCKS[e][version],
    eccLen: ECC_CODEWORDS_PER_BLOCK[e][version],
    rawCodewords: Math.floor(numRawDataModules(version) / 8),
  };
}

/** Aggiunge la correzione a ogni blocco e interleava i codeword come richiede la norma. */
export function addEccAndInterleave(data: readonly number[], version: number, ecl: Ecl): number[] {
  const e = ECL_INDEX[ecl];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e][version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e][version];
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const blocks: number[][] = [];
  const divisor = rsDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      // il byte "finto" dei blocchi corti non va emesso
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

/** Posizioni (riga/colonna) dei pattern di allineamento. */
export function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = version * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

const getBit = (x: number, i: number): boolean => ((x >>> i) & 1) !== 0;

class Matrix {
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];
  constructor(
    readonly size: number,
    readonly version: number,
    readonly ecl: Ecl,
  ) {
    const grid = () => Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.modules = grid();
    this.isFunction = grid();
    this.drawFunctionPatterns();
  }

  private setFunction(x: number, y: number, dark: boolean): void {
    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  }

  private drawFunctionPatterns(): void {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      this.setFunction(6, i, i % 2 === 0);
      this.setFunction(i, 6, i % 2 === 0);
    }
    this.finder(3, 3);
    this.finder(n - 4, 3);
    this.finder(3, n - 4);
    const pos = alignmentPositions(this.version);
    const last = pos.length - 1;
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
        this.alignment(pos[i], pos[j]);
      }
    }
    this.drawFormat(0); // riserva i moduli (il valore vero arriva dopo la scelta della maschera)
    this.drawVersion();
  }

  private finder(cx: number, cy: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) this.setFunction(x, y, dist !== 2 && dist !== 4);
      }
    }
  }

  private alignment(cx: number, cy: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) this.setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  drawFormat(mask: number): void {
    const data = (ECL_FORMAT_BITS[this.ecl] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const n = this.size;
    for (let i = 0; i <= 5; i++) this.setFunction(8, i, getBit(bits, i));
    this.setFunction(8, 7, getBit(bits, 6));
    this.setFunction(8, 8, getBit(bits, 7));
    this.setFunction(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) this.setFunction(14 - i, 8, getBit(bits, i));
    for (let i = 0; i < 8; i++) this.setFunction(n - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) this.setFunction(8, n - 15 + i, getBit(bits, i));
    this.setFunction(8, n - 8, true); // modulo scuro fisso
  }

  private drawVersion(): void {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = getBit(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunction(a, b, dark);
      this.setFunction(b, a, dark);
    }
  }

  drawCodewords(data: readonly number[]): void {
    const n = this.size;
    let i = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < n; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? n - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  applyMask(mask: number): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert: boolean;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (invert && !this.isFunction[y][x]) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  /** Penalità della norma: serie di 5+ moduli uguali, blocchi 2x2, pattern tipo finder, squilibrio chiari/scuri. */
  penalty(): number {
    const n = this.size;
    const m = this.modules;
    let result = 0;
    const scanLine = (get: (i: number) => boolean): void => {
      let runColor = false;
      let runLen = 0;
      const history = [0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < n; i++) {
        if (get(i) === runColor) {
          runLen++;
          if (runLen === 5) result += 3;
          else if (runLen > 5) result++;
        } else {
          this.addHistory(runLen, history);
          if (!runColor) result += this.countPatterns(history) * 40;
          runColor = get(i);
          runLen = 1;
        }
      }
      result += this.terminateAndCount(runColor, runLen, history) * 40;
    };
    for (let y = 0; y < n; y++) scanLine((x) => m[y][x]);
    for (let x = 0; x < n; x++) scanLine((y) => m[y][x]);
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) result += 3;
      }
    }
    let dark = 0;
    for (const row of m) for (const c of row) if (c) dark++;
    const total = n * n;
    result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return result;
  }

  private countPatterns(h: readonly number[]): number {
    const n = h[1];
    const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
    return (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0);
  }

  private terminateAndCount(runColor: boolean, runLen: number, h: number[]): number {
    if (runColor) {
      this.addHistory(runLen, h);
      runLen = 0;
    }
    runLen += this.size;
    this.addHistory(runLen, h);
    return this.countPatterns(h);
  }

  private addHistory(runLen: number, h: number[]): void {
    if (h[0] === 0) runLen += this.size; // il bordo chiaro conta come parte della prima serie
    h.pop();
    h.unshift(runLen);
  }
}

/** Codeword di dati: segmento, terminatore, riempimento a byte e byte di padding 0xEC/0x11. */
export function buildDataCodewords(text: string, mode: QrMode, version: number, ecl: Ecl): number[] {
  const capacityBits = numDataCodewords(version, ecl) * 8;
  const bits = segmentBits(text, mode, version);
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
    bytes.push(b);
  }
  for (let pad = 0xec; bytes.length < capacityBits / 8; pad ^= 0xec ^ 0x11) bytes.push(pad);
  return bytes;
}

/** Codifica un testo (UTF-8 quando serve il modo byte) nel QR più piccolo che lo contiene. */
export function encodeQr(text: string, opts: EncodeOptions): QrCode {
  const mode = detectMode(text);
  let version = Math.max(MIN_VERSION, opts.minVersion ?? MIN_VERSION);
  for (; ; version++) {
    if (version > MAX_VERSION) throw new QrError('too-long');
    if (segmentBits(text, mode, version).length <= numDataCodewords(version, opts.ecl) * 8) break;
  }
  const dataCodewords = buildDataCodewords(text, mode, version, opts.ecl);
  const all = addEccAndInterleave(dataCodewords, version, opts.ecl);
  const matrix = new Matrix(version * 4 + 17, version, opts.ecl);
  matrix.drawCodewords(all);
  let mask = opts.mask ?? -1;
  if (mask < 0) {
    let best = Infinity;
    for (let m = 0; m < 8; m++) {
      matrix.applyMask(m);
      matrix.drawFormat(m);
      const p = matrix.penalty();
      if (p < best) {
        best = p;
        mask = m;
      }
      matrix.applyMask(m); // annulla (xor)
    }
  }
  matrix.applyMask(mask);
  matrix.drawFormat(mask);
  return { version, ecl: opts.ecl, mask, mode, size: matrix.size, modules: matrix.modules, dataCodewords };
}
