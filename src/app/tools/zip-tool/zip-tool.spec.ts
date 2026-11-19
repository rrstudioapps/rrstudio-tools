// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { strFromU8, strToU8, zipSync } from 'fflate';
import {
  LIMITS, ZipError, archiveName, checkLimits, checkPath, cleanInputPath, createZip, dosToDate, extractEntry, extractable, filterEntries,
  listZip, uniquePaths, type Limits, type ZipEntry, type ZipLevel,
} from './zip-tool';

/** Scrive un valore a 32 bit nella prima directory centrale (campo a `field` byte dall'inizio dell'intestazione). */
function patchCentral(zipBytes: Uint8Array, field: number, value: number, bits: 16 | 32 = 32): Uint8Array {
  const out = zipBytes.slice();
  const dv = new DataView(out.buffer);
  for (let i = 0; i + 4 <= out.length; i++) {
    if (dv.getUint32(i, true) === 0x02014b50) {
      if (bits === 32) dv.setUint32(i + field, value, true);
      else dv.setUint16(i + field, value, true);
      return out;
    }
  }
  throw new Error('directory centrale non trovata');
}

const levels: ZipLevel[] = [0, 1, 6, 9];

async function expectCode(p: Promise<unknown> | (() => unknown), code: string): Promise<void> {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (e) {
    expect(e).toBeInstanceOf(ZipError);
    expect((e as ZipError).code).toBe(code);
    return;
  }
  throw new Error('atteso ZipError ' + code);
}

describe('percorsi', () => {
  it('checkPath normalizza i percorsi sicuri', () => {
    expect(checkPath('a/b.txt')).toEqual({ path: 'a/b.txt', unsafe: null });
    expect(checkPath('./a//b/')).toEqual({ path: 'a/b/', unsafe: null });
    expect(checkPath('a\\b\\c.txt')).toEqual({ path: 'a/b/c.txt', unsafe: null });
  });
  it('checkPath segnala percorsi pericolosi', () => {
    expect(checkPath('../evil.txt').unsafe).toBe('parent');
    expect(checkPath('a/../../evil').unsafe).toBe('parent');
    expect(checkPath('a\\..\\b').unsafe).toBe('parent');
    expect(checkPath('/etc/passwd').unsafe).toBe('absolute');
    expect(checkPath('\\\\server\\share').unsafe).toBe('absolute');
    expect(checkPath('C:\\Windows\\x').unsafe).toBe('absolute');
    expect(checkPath('c:x').unsafe).toBe('absolute');
    expect(checkPath('').unsafe).toBe('empty');
    expect(checkPath('./').unsafe).toBe('empty');
    expect(checkPath('a\u0000b').unsafe).toBe('control');
    // «..» dentro un nome non è un segmento
    expect(checkPath('a..b/..c').unsafe).toBeNull();
  });
  it('cleanInputPath toglie .. e percorsi assoluti', () => {
    expect(cleanInputPath('../../x/y.txt')).toBe('x/y.txt');
    expect(cleanInputPath('/abs/p.txt')).toBe('abs/p.txt');
    expect(cleanInputPath('cartella\\file.txt')).toBe('cartella/file.txt');
    expect(cleanInputPath('..')).toBe('file');
  });
  it('uniquePaths numera i doppioni ignorando le maiuscole', () => {
    expect(uniquePaths(['a.txt', 'A.txt', 'd/a.txt', 'a.txt', 'noext', 'noext', '.env', '.env'])).toEqual([
      'a.txt', 'A (2).txt', 'd/a.txt', 'a (3).txt', 'noext', 'noext (2)', '.env', '.env (2)',
    ]);
  });
  it('archiveName', () => {
    expect(archiveName('mio.zip')).toBe('mio.zip');
    expect(archiveName('  a/b:c  ')).toBe('a_b_c.zip');
    expect(archiveName('')).toBe('archivio.zip');
    expect(archiveName('...', 'x')).toBe('x.zip');
  });
  it('filterEntries cerca ignorando le maiuscole', () => {
    const list = [{ name: 'Docs/Letter.TXT' }, { name: 'img/a.png' }];
    expect(filterEntries(list, 'letter')).toHaveLength(1);
    expect(filterEntries(list, '  ')).toHaveLength(2);
    expect(filterEntries(list, 'zzz')).toHaveLength(0);
  });
  it('dosToDate', () => {
    // 2026-11-18 10:20:30 -> date = (46<<9)|(11<<5)|18, time = (10<<11)|(20<<5)|15
    expect(dosToDate((10 << 11) | (20 << 5) | 15, (46 << 9) | (11 << 5) | 18)).toEqual(new Date(2026, 10, 18, 10, 20, 30));
    expect(dosToDate(0, 0)).toBeNull();
    expect(dosToDate(0, (46 << 9) | (13 << 5) | 1)).toBeNull();
  });
});

describe('round-trip', () => {
  for (const level of levels) {
    it(`crea e rilegge a livello ${level}`, async () => {
      const big = new Uint8Array(100_000).map((_, i) => (i * 7) % 251);
      const out = await createZip(
        [
          { path: 'a.txt', data: strToU8('ciao mondo') },
          { path: 'cartella/sotto/b.bin', data: big },
          { path: 'vuoto.txt', data: new Uint8Array(0) },
        ],
        level,
      );
      const list = listZip(out);
      expect(list.map((e) => e.path)).toEqual(['a.txt', 'cartella/sotto/b.bin', 'vuoto.txt']);
      expect(list.every((e) => e.safe && !e.encrypted && !e.dir)).toBe(true);
      expect(list.map((e) => e.size)).toEqual([10, 100_000, 0]);
      expect(strFromU8(await extractEntry(out, list[0]))).toBe('ciao mondo');
      expect(await extractEntry(out, list[1])).toEqual(big);
      expect((await extractEntry(out, list[2])).length).toBe(0);
      if (level === 0) expect(list[1].method).toBe(0);
      else expect(list[1].method).toBe(8);
    });
  }
  it('nomi unicode e emoji', async () => {
    const names = ['è già così.txt', '日本語/ファイル.txt', 'emoji-😀.md', 'Ünïcödé/ß.txt'];
    const out = await createZip(names.map((n) => ({ path: n, data: strToU8(n) })), 6);
    const list = listZip(out);
    expect(list.map((e) => e.name)).toEqual(names);
    for (const e of list) expect(strFromU8(await extractEntry(out, e))).toBe(e.name);
  });
  it('archivio vuoto', async () => {
    const out = await createZip([], 6);
    expect(listZip(out)).toEqual([]);
  });
  it('doppioni e percorsi pericolosi in ingresso vengono resi sicuri', async () => {
    const out = await createZip(
      [
        { path: 'a.txt', data: strToU8('1') },
        { path: 'a.txt', data: strToU8('2') },
        { path: '../fuori.txt', data: strToU8('3') },
      ],
      1,
    );
    expect(listZip(out).map((e) => e.path)).toEqual(['a.txt', 'a (2).txt', 'fuori.txt']);
  });
  it('conserva la data di modifica', async () => {
    const t = new Date(2024, 4, 3, 12, 30, 0).getTime();
    const out = await createZip([{ path: 'a.txt', data: strToU8('x'), mtime: t }], 6);
    expect(listZip(out)[0].date?.getTime()).toBe(t);
  });
  it('data precedente al 1980 ignorata senza errori', async () => {
    const out = await createZip([{ path: 'a.txt', data: strToU8('x'), mtime: 0 }], 6);
    expect(listZip(out)).toHaveLength(1);
  });
});

describe('archivi non validi o pericolosi', () => {
  it('dati che non sono uno zip', async () => {
    await expectCode(() => listZip(strToU8('questo non è uno zip, è solo testo lungo abbastanza')), 'notZip');
    await expectCode(() => listZip(new Uint8Array(0)), 'notZip');
    await expectCode(() => listZip(new Uint8Array(100).fill(0x50)), 'notZip');
  });
  it('archivio troncato', async () => {
    const out = await createZip([{ path: 'a.txt', data: strToU8('x'.repeat(500)) }], 6);
    await expectCode(() => listZip(out.slice(0, out.length - 10)), 'notZip');
  });
  it('directory centrale che punta fuori dal file: danneggiato', async () => {
    const out = zipSync({ 'a.txt': strToU8('abc') });
    const dv = new DataView(out.buffer);
    const eocd = out.length - 22;
    dv.setUint32(eocd + 16, 0x00ffff00, true);
    await expectCode(() => listZip(out), 'corrupt');
  });
  it('voce con intestazione locale rovinata: danneggiato', async () => {
    const out = zipSync({ 'a.txt': strToU8('abc') });
    const [e] = listZip(out);
    const bad = out.slice();
    bad[0] = 0;
    await expectCode(extractEntry(bad, e), 'corrupt');
  });
  it('dati compressi corrotti: danneggiato, nessun errore non gestito', async () => {
    const out = zipSync({ 'a.txt': strToU8('abcabcabcabc'.repeat(100)) });
    const [e] = listZip(out);
    const bad = out.slice();
    for (let i = 40; i < 40 + e.csize; i++) bad[i] = 0xff;
    await expectCode(extractEntry(bad, e), 'corrupt');
  });
  it('archivio cifrato: voce segnalata e non estratta', async () => {
    const out = patchCentral(zipSync({ 'a.txt': strToU8('abc') }), 8, 0x0001, 16);
    const [e] = listZip(out);
    expect(e.encrypted).toBe(true);
    expect(extractable(e)).toBe(false);
    await expectCode(extractEntry(out, e), 'encrypted');
  });
  it('metodo di compressione non supportato', async () => {
    const out = patchCentral(zipSync({ 'a.txt': strToU8('abc') }), 10, 99, 16);
    const [e] = listZip(out);
    expect(extractable(e)).toBe(false);
    await expectCode(extractEntry(out, e), 'unsupported');
  });
  it('percorsi con .. o assoluti: elencati ma segnalati ed esclusi', () => {
    const out = zipSync({ '../evil.txt': strToU8('x'), '/abs.txt': strToU8('y'), 'ok/va.txt': strToU8('z'), 'a\\..\\b.txt': strToU8('w') });
    const list = listZip(out);
    expect(list.map((e) => [e.name, e.safe, e.unsafe])).toEqual([
      ['../evil.txt', false, 'parent'],
      ['/abs.txt', false, 'absolute'],
      ['ok/va.txt', true, null],
      ['a\\..\\b.txt', false, 'parent'],
    ]);
    expect(list.filter(extractable).map((e) => e.path)).toEqual(['ok/va.txt']);
    expect(list[0].path).toBe('');
  });
  it('voce che è una cartella', async () => {
    const out = zipSync({ 'dir/': new Uint8Array(0), 'dir/f.txt': strToU8('x') });
    const list = listZip(out);
    expect(list[0].dir).toBe(true);
    expect(extractable(list[0])).toBe(false);
    expect((await extractEntry(out, list[0])).length).toBe(0);
  });
});

describe('limiti (zip bomb)', () => {
  const small: Limits = { maxCompressed: 10_000, maxExpanded: 5_000, maxEntries: 3 };

  it('checkLimits sulle dimensioni dichiarate', () => {
    expect(checkLimits([{ size: 100 }], 100, small)).toBeNull();
    expect(checkLimits([{ size: 100 }], 10_001, small)).toBe('tooBigCompressed');
    expect(checkLimits([{ size: 1 }, { size: 1 }, { size: 1 }, { size: 1 }], 10, small)).toBe('tooManyEntries');
    expect(checkLimits([{ size: 3000 }, { size: 2001 }], 10, small)).toBe('tooBigExpanded');
    expect(checkLimits([{ size: 5000 }], 10, small)).toBeNull();
    expect(LIMITS).toEqual({ maxCompressed: 209_715_200, maxExpanded: 524_288_000, maxEntries: 20_000 });
  });
  it('archivio compresso troppo grande: rifiutato senza leggere', async () => {
    await expectCode(() => listZip(new Uint8Array(10_001), small), 'tooBigCompressed');
  });
  it('troppe voci', async () => {
    const files = Object.fromEntries([1, 2, 3, 4].map((n) => [`f${n}.txt`, strToU8('x')]));
    await expectCode(() => listZip(zipSync(files), small), 'tooManyEntries');
  });
  it('dimensioni espanse totali oltre il limite', async () => {
    const out = zipSync({ 'a.txt': new Uint8Array(3000), 'b.txt': new Uint8Array(3000) });
    await expectCode(() => listZip(out, small), 'tooBigExpanded');
  });
  it('dimensione dichiarata falsificata verso l\'alto: rifiutata dal controllo dei limiti', async () => {
    const out = patchCentral(zipSync({ 'a.txt': strToU8('piccolo') }), 24, 600 * 1024 * 1024);
    await expectCode(() => listZip(out), 'tooBigExpanded');
  });
  it('dimensione dichiarata falsificata verso il basso: la decompressione si ferma e segnala il danno', async () => {
    const bomb = zipSync({ 'a.txt': new Uint8Array(2_000_000) }, { level: 9 });
    const forged = patchCentral(bomb, 24, 10);
    const [e] = listZip(forged);
    expect(e.size).toBe(10);
    await expectCode(extractEntry(forged, e), 'corrupt');
  });
  it('dimensione dichiarata troppo grande rispetto ai dati veri: danneggiato', async () => {
    const out = patchCentral(zipSync({ 'a.txt': strToU8('x'.repeat(200)) }), 24, 5000);
    const [e] = listZip(out);
    await expectCode(extractEntry(out, e), 'corrupt');
  });
  it('zip64 non supportato, con messaggio dedicato', async () => {
    const out = patchCentral(zipSync({ 'a.txt': strToU8('x') }), 20, 0xffffffff);
    await expectCode(() => listZip(out), 'zip64');
  });
  it('createZip rispetta gli stessi limiti', async () => {
    await expectCode(createZip([{ path: 'a', data: new Uint8Array(6000) }], 6, small), 'tooBigExpanded');
    const many = [1, 2, 3, 4].map((n) => ({ path: `f${n}`, data: new Uint8Array(1) }));
    await expectCode(createZip(many, 6, small), 'tooManyEntries');
  });
  it('estrazione di un file grande a blocchi (oltre 64 KB compressi)', async () => {
    let seed = 12345;
    const noisy = new Uint8Array(300_000).map(() => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 16) & 255);
    const out = await createZip([{ path: 'r.bin', data: noisy }], 1);
    const [e] = listZip(out);
    expect(e.csize).toBeGreaterThan(65_536);
    expect(await extractEntry(out, e as ZipEntry)).toEqual(noisy);
  });
});
