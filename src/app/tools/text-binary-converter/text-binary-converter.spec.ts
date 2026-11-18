// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import {
  charTable, decodeBytes, encodeText, formatBytes, hexDump, parseBytes, textStats, visibleChar,
  ENCODINGS, type ByteFormat, type Encoding,
} from './text-binary-converter';

const b = (...v: number[]): Uint8Array => Uint8Array.from(v);
const bytesOf = (text: string, enc: Encoding): number[] => [...encodeText(text, enc).bytes];
const text = (bytes: Uint8Array, enc: Encoding, strict = true): string => {
  const r = decodeBytes(bytes, enc, { strict });
  if (!r.ok) throw new Error('decodifica fallita alla posizione ' + r.position);
  return r.text;
};

describe('encodeText', () => {
  it('ASCII e UTF-8 coincidono', () => {
    expect(bytesOf('Hi!', 'utf-8')).toEqual([0x48, 0x69, 0x21]);
    expect(bytesOf('Hi!', 'ascii')).toEqual([0x48, 0x69, 0x21]);
  });
  it('accento: è = C3 A8 in UTF-8, E8 in Latin-1 e Windows-1252', () => {
    expect(bytesOf('è', 'utf-8')).toEqual([0xc3, 0xa8]);
    expect(bytesOf('è', 'latin1')).toEqual([0xe8]);
    expect(bytesOf('è', 'windows-1252')).toEqual([0xe8]);
  });
  it('emoji: 4 byte in UTF-8, coppia di surrogati in UTF-16', () => {
    expect(bytesOf('😀', 'utf-8')).toEqual([0xf0, 0x9f, 0x98, 0x80]);
    expect(bytesOf('😀', 'utf-16be')).toEqual([0xd8, 0x3d, 0xde, 0x00]);
    expect(bytesOf('😀', 'utf-16le')).toEqual([0x3d, 0xd8, 0x00, 0xde]);
  });
  it('Windows-1252: i byte 0x80-0x9F', () => {
    expect(bytesOf('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ', 'windows-1252')).toEqual([
      0x80, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8e, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9e, 0x9f,
    ]);
    // lo stesso testo in Latin-1 non esiste
    expect(encodeText('€', 'latin1').unmappable).toBe(1);
  });
  it('caratteri non rappresentabili: «?» e conteggio', () => {
    const r = encodeText('a€😀b', 'ascii');
    expect([...r.bytes]).toEqual([0x61, 0x3f, 0x3f, 0x62]);
    expect(r.unmappable).toBe(2);
    expect(encodeText('ab', 'ascii').unmappable).toBe(0);
  });
  it('BOM', () => {
    expect([...encodeText('a', 'utf-8', { bom: true }).bytes]).toEqual([0xef, 0xbb, 0xbf, 0x61]);
    expect([...encodeText('a', 'utf-16le', { bom: true }).bytes]).toEqual([0xff, 0xfe, 0x61, 0]);
    expect([...encodeText('a', 'latin1', { bom: true }).bytes]).toEqual([0x61]);
  });
  it('testo vuoto', () => {
    for (const e of ENCODINGS) expect(encodeText('', e).bytes.length).toBe(0);
  });
});

describe('decodeBytes', () => {
  it('UTF-8 e Latin-1 con gli stessi byte danno testi diversi', () => {
    expect(text(b(0xc3, 0xa8), 'utf-8')).toBe('è');
    expect(text(b(0xc3, 0xa8), 'latin1')).toBe('Ã¨');
    expect(text(b(0xe8), 'latin1')).toBe('è');
  });
  it('UTF-16 con coppia di surrogati', () => {
    expect(text(b(0x3d, 0xd8, 0x00, 0xde), 'utf-16le')).toBe('😀');
    expect(text(b(0xd8, 0x3d, 0xde, 0x00), 'utf-16be')).toBe('😀');
  });
  it('BOM tolto e segnalato', () => {
    const r = decodeBytes(b(0xef, 0xbb, 0xbf, 0x61), 'utf-8');
    expect(r).toEqual({ ok: true, text: 'a', replaced: 0, bom: true });
    const r16 = decodeBytes(b(0xff, 0xfe, 0x61, 0), 'utf-16le');
    expect(r16).toMatchObject({ ok: true, text: 'a', bom: true });
  });
  it('UTF-8: byte isolato 0xFF segnalato con la posizione', () => {
    expect(decodeBytes(b(0x61, 0x62, 0xff), 'utf-8')).toEqual({ ok: false, position: 2, byte: 0xff });
  });
  it('UTF-8: sequenza troncata, byte di continuazione, forma ridondante, surrogato', () => {
    expect(decodeBytes(b(0x61, 0xc3), 'utf-8')).toMatchObject({ ok: false, position: 2 });
    expect(decodeBytes(b(0x80), 'utf-8')).toMatchObject({ ok: false, position: 0 });
    expect(decodeBytes(b(0xc0, 0xaf), 'utf-8')).toMatchObject({ ok: false, position: 0 });
    expect(decodeBytes(b(0xed, 0xa0, 0x80), 'utf-8')).toMatchObject({ ok: false, position: 0 });
    expect(decodeBytes(b(0xe2, 0x28, 0xa1), 'utf-8')).toMatchObject({ ok: false, position: 1 });
  });
  it('errore con BOM: la posizione conta anche il BOM', () => {
    expect(decodeBytes(b(0xef, 0xbb, 0xbf, 0xff), 'utf-8')).toMatchObject({ ok: false, position: 3 });
  });
  it('non strict: sostituisce con � e conta', () => {
    const r = decodeBytes(b(0x61, 0xff, 0x62), 'utf-8', { strict: false });
    expect(r).toEqual({ ok: true, text: 'a�b', replaced: 1, bom: false });
  });
  it('UTF-16: lunghezza dispari e surrogato spaiato', () => {
    expect(decodeBytes(b(0x61, 0x00, 0x62), 'utf-16le')).toMatchObject({ ok: false, position: 2 });
    expect(decodeBytes(b(0x00, 0xd8, 0x61, 0x00), 'utf-16le')).toMatchObject({ ok: false, position: 0 });
    expect(decodeBytes(b(0x61, 0x00, 0x62), 'utf-16le', { strict: false })).toMatchObject({ ok: true, text: 'a�', replaced: 1 });
  });
  it('ASCII: byte sopra 0x7F', () => {
    expect(decodeBytes(b(0x61, 0xe8), 'ascii')).toMatchObject({ ok: false, position: 1 });
    expect(text(b(0x61, 0xe8), 'ascii', false)).toBe('a�');
  });
  it('Windows-1252: 0x80 è €, 0x81 non è definito', () => {
    expect(text(b(0x80, 0x93, 0x94, 0xe8), 'windows-1252')).toBe('€“”è');
    expect(decodeBytes(b(0x81), 'windows-1252')).toMatchObject({ ok: false, position: 0 });
    expect(text(b(0x81), 'windows-1252', false)).toBe('�');
  });
  it('input vuoto', () => {
    for (const e of ENCODINGS) expect(text(new Uint8Array(0), e)).toBe('');
  });
});

describe('formatBytes', () => {
  const hello = b(0x48, 0x65, 0x6c, 0x6c, 0x6f);
  it('esadecimale: maiuscole, minuscole, separatori', () => {
    expect(formatBytes(hello, 'hex')).toBe('48 65 6C 6C 6F');
    expect(formatBytes(hello, 'hex', { uppercase: false, separator: 'none' })).toBe('48656c6c6f');
    expect(formatBytes(hello, 'hex', { separator: 'comma' })).toBe('48,65,6C,6C,6F');
    expect(formatBytes(hello, 'hex', { separator: 'dash' })).toBe('48-65-6C-6C-6F');
    expect(formatBytes(hello, 'hex', { separator: 'bs-x' })).toBe('\\x48\\x65\\x6C\\x6C\\x6F');
    expect(formatBytes(hello, 'hex', { separator: '0x' })).toBe('0x48, 0x65, 0x6C, 0x6C, 0x6F');
  });
  it('byte con zero iniziale', () => {
    expect(formatBytes(b(0, 1, 10), 'hex')).toBe('00 01 0A');
  });
  it('raggruppamento', () => {
    expect(formatBytes(hello, 'hex', { group: 2 })).toBe('4865 6C6C 6F');
    expect(formatBytes(hello, 'hex', { group: 4, separator: 'none' })).toBe('4865 6C6C6F'.replace(' ', ''));
    expect(formatBytes(b(1, 2, 3), 'bin', { group: 2 })).toBe('0000000100000010 00000011');
  });
  it('binario con e senza riempimento', () => {
    expect(formatBytes(b(1, 65, 255), 'bin')).toBe('00000001 01000001 11111111');
    expect(formatBytes(b(1, 65), 'bin', { pad: false })).toBe('1 1000001');
  });
  it('decimale e ottale', () => {
    expect(formatBytes(b(5, 72, 255), 'dec')).toBe('005 072 255');
    expect(formatBytes(b(5, 72, 255), 'dec', { pad: false })).toBe('5 72 255');
    expect(formatBytes(b(8, 255), 'oct')).toBe('010 377');
    expect(formatBytes(b(8, 255), 'oct', { pad: false, separator: 'comma' })).toBe('10,377');
  });
  it('prefissi solo per l\'esadecimale', () => {
    expect(formatBytes(b(65), 'dec', { separator: '0x' })).toBe('065');
  });
  it('Base64', () => {
    expect(formatBytes(hello, 'base64')).toBe('SGVsbG8=');
    expect(formatBytes(new Uint8Array(0), 'base64')).toBe('');
  });
  it('righe di N byte', () => {
    expect(formatBytes(b(1, 2, 3, 4, 5), 'hex', { perLine: 2 })).toBe('01 02\n03 04\n05');
    expect(formatBytes(b(1, 2, 3), 'hex', { perLine: 2, separator: '0x' })).toBe('0x01, 0x02,\n0x03');
    expect(formatBytes(b(1, 2, 3), 'hex', { perLine: 0 })).toBe('01 02 03');
  });
  it('vuoto', () => {
    expect(formatBytes(new Uint8Array(0), 'hex')).toBe('');
    expect(formatBytes(new Uint8Array(0), 'bin', { perLine: 4 })).toBe('');
  });
});

describe('parseBytes', () => {
  const ok = (t: string, f: ByteFormat): number[] => {
    const r = parseBytes(t, f);
    if (!r.ok) throw new Error(`${r.error} @${r.position} ${r.token}`);
    return [...r.bytes];
  };
  it('esadecimale: separatori e prefissi misti, maiuscole e minuscole', () => {
    expect(ok('48 65,6c-6C;6f', 'hex')).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(ok('0x48 0X65, \\x6c\\x6C %6f', 'hex')).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(ok('%C3%A8', 'hex')).toEqual([0xc3, 0xa8]);
    expect(ok('48656c6c6f', 'hex')).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(ok('48:65\n6C\t6C', 'hex')).toEqual([0x48, 0x65, 0x6c, 0x6c]);
  });
  it('esadecimale: una cifra sola è un byte', () => {
    expect(ok('4 8 A', 'hex')).toEqual([4, 8, 10]);
  });
  it('esadecimale: errori con posizione', () => {
    expect(parseBytes('48 6G 65', 'hex')).toEqual({ ok: false, error: 'invalidChar', position: 4, token: 'G' });
    expect(parseBytes('48 123', 'hex')).toEqual({ ok: false, error: 'oddHex', position: 3, token: '123' });
    expect(parseBytes('0x', 'hex')).toMatchObject({ ok: false, error: 'invalidChar', position: 0 });
    expect(parseBytes('48 zz', 'hex')).toMatchObject({ ok: false, position: 3, token: 'z' });
  });
  it('binario', () => {
    expect(ok('01001000 01100101', 'bin')).toEqual([0x48, 0x65]);
    expect(ok('0b1001000,0b1100101', 'bin')).toEqual([0x48, 0x65]);
    expect(ok('0100100001100101', 'bin')).toEqual([0x48, 0x65]);
    expect(parseBytes('0100 12', 'bin')).toMatchObject({ ok: false, error: 'invalidChar', position: 6, token: '2' });
    expect(parseBytes('010010000', 'bin')).toMatchObject({ ok: false, error: 'badBinaryLength', position: 0 });
  });
  it('decimale', () => {
    expect(ok('72 101,108-108 111', 'dec')).toEqual([72, 101, 108, 108, 111]);
    expect(parseBytes('72 256', 'dec')).toEqual({ ok: false, error: 'outOfRange', position: 3, token: '256' });
    expect(parseBytes('72 a', 'dec')).toMatchObject({ ok: false, position: 3 });
  });
  it('ottale', () => {
    expect(ok('110 145 \\154 0o154', 'oct')).toEqual([0x48, 0x65, 0x6c, 0x6c]);
    expect(parseBytes('400', 'oct')).toMatchObject({ ok: false, error: 'outOfRange' });
    expect(parseBytes('18', 'oct')).toMatchObject({ ok: false, error: 'invalidChar', position: 1, token: '8' });
  });
  it('Base64: standard, URL-safe, senza padding, con a capo', () => {
    expect(ok('SGVsbG8=', 'base64')).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(ok('SGVs\nbG8', 'base64')).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(ok('-_8=', 'base64')).toEqual([0xfb, 0xff]);
    expect(parseBytes('SGV$bG8=', 'base64')).toMatchObject({ ok: false, error: 'badBase64', position: 3, token: '$' });
    expect(parseBytes('A', 'base64')).toMatchObject({ ok: false, error: 'badBase64' });
  });
  it('input vuoto o solo separatori', () => {
    for (const f of ['hex', 'bin', 'dec', 'oct', 'base64'] as const) expect(ok('', f)).toEqual([]);
    expect(ok(' , \n', 'hex')).toEqual([]);
  });
});

describe('round trip', () => {
  const samples = ['', 'Hello', 'è à ù €', '😀 e 👨‍👩‍👧', 'a\nb\tc\u0000', 'ｗｉｄｅ'];
  const formats: ByteFormat[] = ['hex', 'bin', 'dec', 'oct', 'base64'];
  it('testo → byte → testo → byte in tutti i formati e le codifiche Unicode', () => {
    for (const t of samples) {
      for (const enc of ['utf-8', 'utf-16le', 'utf-16be'] as const) {
        for (const f of formats) {
          for (const sep of ['space', 'none', 'comma', 'dash'] as const) {
            if (f !== 'base64' && sep === 'none' && f === 'dec') continue; // il decimale senza separatore è ambiguo
            if (f === 'oct' && sep === 'none') continue;
            const bytes = encodeText(t, enc).bytes;
            const s = formatBytes(bytes, f, { separator: sep, perLine: 7 });
            const back = parseBytes(s, f);
            if (!back.ok) throw new Error(`${enc} ${f} ${sep} ${JSON.stringify(t)}: ${back.error}@${back.position}`);
            expect([...back.bytes]).toEqual([...bytes]);
            expect(text(back.bytes, enc)).toBe(t);
          }
        }
      }
    }
  });
  it('prefissi esadecimali e gruppi si rileggono', () => {
    const bytes = encodeText('Ciao è 😀', 'utf-8').bytes;
    for (const o of [{ separator: 'bs-x' as const }, { separator: '0x' as const }, { group: 4, separator: 'none' as const }, { uppercase: false }]) {
      const back = parseBytes(formatBytes(bytes, 'hex', o), 'hex');
      expect(back.ok && [...back.bytes]).toEqual([...bytes]);
    }
  });
  it('Latin-1 e Windows-1252: tutti i 256 byte tornano (Latin-1) o i mappabili (1252)', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect([...encodeText(text(all, 'latin1'), 'latin1').bytes]).toEqual([...all]);
    const some = b(0x41, 0x80, 0x93, 0xe8);
    expect([...encodeText(text(some, 'windows-1252'), 'windows-1252').bytes]).toEqual([...some]);
  });
});

describe('tabella, statistiche, hex dump', () => {
  it('visibleChar: simboli per i caratteri di controllo', () => {
    expect(visibleChar(' ')).toBe('␣');
    expect(visibleChar('\n')).toBe('␊');
    expect(visibleChar('\t')).toBe('␉');
    expect(visibleChar('\u0000')).toBe('␀');
    expect(visibleChar('a')).toBe('a');
    expect(visibleChar('😀')).toBe('😀');
  });
  it('charTable: code point e byte nella codifica scelta', () => {
    const rows = charTable('è😀€', 'utf-8');
    expect(rows[0]).toEqual({ shown: 'è', codePoint: 'U+00E8', bytes: 'C3 A8', unmappable: false });
    expect(rows[1]).toMatchObject({ codePoint: 'U+1F600', bytes: 'F0 9F 98 80' });
    expect(charTable('è€', 'latin1')[1]).toMatchObject({ bytes: '3F', unmappable: true });
  });
  it('charTable: massimo 200 righe, per code point', () => {
    expect(charTable('😀'.repeat(300), 'utf-8')).toHaveLength(200);
    expect(charTable('', 'utf-8')).toEqual([]);
  });
  it('textStats: caratteri percepiti, code point, byte', () => {
    expect(textStats('a😀', 5)).toEqual({ graphemes: 2, codePoints: 2, bytes: 5 });
    expect(textStats('👨‍👩‍👧', 18)).toMatchObject({ graphemes: 1, codePoints: 5 });
    expect(textStats('', 0)).toEqual({ graphemes: 0, codePoints: 0, bytes: 0 });
  });
  it('hexDump: offset, byte e colonna ASCII', () => {
    const d = hexDump(Uint8Array.from([...'Hello, world!\n'].map((c) => c.charCodeAt(0)).concat([0, 255, 0x41])));
    expect(d).toBe('00000000  48 65 6c 6c 6f 2c 20 77 6f 72 6c 64 21 0a 00 ff  |Hello, world!...|\n00000010  41                                               |A|');
  });
  it('hexDump: solo i primi byte richiesti e vuoto', () => {
    expect(hexDump(new Uint8Array(100), 16).split('\n')).toHaveLength(1);
    expect(hexDump(new Uint8Array(0))).toBe('');
  });
});
