// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import {
  PRESETS,
  applySymbolic,
  chmodCommand,
  chmodCommandSymbolic,
  classDigit,
  hasBit,
  hasSpecial,
  parseOctal,
  parseSymbolic,
  setBit,
  setSpecial,
  shellQuote,
  toOctal,
  toSymbolic,
} from './chmod';

const mode = (r: ReturnType<typeof applySymbolic>) => (r.ok ? r.mode : -1);

describe('ottale', () => {
  it('legge 3 e 4 cifre', () => {
    expect(parseOctal('755')).toEqual({ ok: true, mode: 0o755 });
    expect(parseOctal('0644')).toEqual({ ok: true, mode: 0o644 });
    expect(parseOctal(' 4755 ')).toEqual({ ok: true, mode: 0o4755 });
    expect(parseOctal('0o700')).toEqual({ ok: true, mode: 0o700 });
  });
  it('rifiuta input non valido', () => {
    expect(parseOctal('')).toMatchObject({ ok: false, error: 'empty' });
    expect(parseOctal('758')).toMatchObject({ ok: false, error: 'octal-chars' });
    expect(parseOctal('rwx')).toMatchObject({ ok: false, error: 'octal-chars' });
    expect(parseOctal('75')).toMatchObject({ ok: false, error: 'octal-length' });
    expect(parseOctal('07555')).toMatchObject({ ok: false, error: 'octal-length' });
  });
  it('scrive 3 cifre, 4 con i bit speciali', () => {
    expect(toOctal(0o755)).toBe('755');
    expect(toOctal(0o7)).toBe('007');
    expect(toOctal(0o4755)).toBe('4755');
    expect(toOctal(0o644, true)).toBe('0644');
    expect(toOctal(0)).toBe('000');
  });
});

describe('simbolico', () => {
  it('converte da ottale', () => {
    expect(toSymbolic(0o755)).toBe('rwxr-xr-x');
    expect(toSymbolic(0o644)).toBe('rw-r--r--');
    expect(toSymbolic(0o000)).toBe('---------');
    expect(toSymbolic(0o777)).toBe('rwxrwxrwx');
  });
  it('mostra s, S, t e T', () => {
    expect(toSymbolic(0o4755)).toBe('rwsr-xr-x');
    expect(toSymbolic(0o4644)).toBe('rwSr--r--');
    expect(toSymbolic(0o2755)).toBe('rwxr-sr-x');
    expect(toSymbolic(0o2745)).toBe('rwxr-Sr-x');
    expect(toSymbolic(0o1777)).toBe('rwxrwxrwt');
    expect(toSymbolic(0o1776)).toBe('rwxrwxrwT');
    expect(toSymbolic(0o7777)).toBe('rwsrwsrwt');
  });
  it('ha un viaggio di andata e ritorno per ogni permesso', () => {
    for (let m = 0; m <= 0o7777; m++) {
      expect(parseSymbolic(toSymbolic(m))).toEqual({ ok: true, mode: m });
    }
  });
  it('accetta il tipo davanti come in ls -l', () => {
    expect(parseSymbolic('-rw-r--r--')).toEqual({ ok: true, mode: 0o644 });
    expect(parseSymbolic('drwxr-xr-t')).toEqual({ ok: true, mode: 0o1755 });
  });
  it('rifiuta lunghezze e caratteri errati', () => {
    expect(parseSymbolic('')).toMatchObject({ error: 'empty' });
    expect(parseSymbolic('rwxr-xr-')).toMatchObject({ error: 'sym-length' });
    expect(parseSymbolic('rwxr-xr-xx')).toMatchObject({ error: 'sym-length' });
    expect(parseSymbolic('rwxr-xr-q')).toMatchObject({ error: 'sym-chars', at: 'q' });
    expect(parseSymbolic('rwxr-xr-s')).toMatchObject({ error: 'sym-chars' }); // s nella posizione "altri" non esiste
    expect(parseSymbolic('wrxr-xr-x')).toMatchObject({ error: 'sym-chars' });
  });
});

describe('bit singoli', () => {
  it('imposta e legge', () => {
    let m = 0;
    m = setBit(m, 'owner', 'r', true);
    m = setBit(m, 'owner', 'w', true);
    m = setBit(m, 'group', 'r', true);
    m = setBit(m, 'other', 'r', true);
    expect(toOctal(m)).toBe('644');
    expect(hasBit(m, 'group', 'w')).toBe(false);
    m = setBit(m, 'owner', 'w', false);
    expect(toOctal(m)).toBe('444');
    m = setSpecial(m, 'sticky', true);
    expect(hasSpecial(m, 'sticky')).toBe(true);
    expect(toOctal(m)).toBe('1444');
    expect(classDigit(0o4750, 'group')).toBe(5);
  });
});

describe('espressioni simboliche', () => {
  it('aggiunge e toglie', () => {
    expect(mode(applySymbolic('u+x', 0o644))).toBe(0o744);
    expect(mode(applySymbolic('go-w', 0o666))).toBe(0o644);
    expect(mode(applySymbolic('u+x,go-w', 0o666))).toBe(0o744);
    expect(mode(applySymbolic('a+r', 0o000))).toBe(0o444);
    expect(mode(applySymbolic('+x', 0o644))).toBe(0o755);
    expect(mode(applySymbolic('-rwx', 0o755))).toBe(0);
  });
  it('imposta con =', () => {
    expect(mode(applySymbolic('u=rwx,g=rx,o=', 0o000))).toBe(0o750);
    expect(mode(applySymbolic('a=r', 0o777))).toBe(0o444);
    expect(mode(applySymbolic('g=', 0o777))).toBe(0o707);
    expect(mode(applySymbolic('=rw', 0o755))).toBe(0o666);
  });
  it('copia i permessi di un\'altra classe', () => {
    expect(mode(applySymbolic('g=u', 0o700))).toBe(0o770);
    expect(mode(applySymbolic('o=g', 0o750))).toBe(0o755);
    expect(mode(applySymbolic('go+u', 0o740))).toBe(0o777);
  });
  it('gestisce i bit speciali', () => {
    expect(mode(applySymbolic('u+s', 0o755))).toBe(0o4755);
    expect(mode(applySymbolic('g+s', 0o755))).toBe(0o2755);
    expect(mode(applySymbolic('+t', 0o777))).toBe(0o1777);
    expect(mode(applySymbolic('u-s', 0o4755))).toBe(0o755);
    expect(mode(applySymbolic('a-t', 0o1777))).toBe(0o777);
    expect(mode(applySymbolic('ug+s', 0o755))).toBe(0o6755);
    expect(mode(applySymbolic('u=rwx', 0o4755))).toBe(0o755); // = azzera anche setuid
  });
  it('la X dipende da cartella o da esecuzione già presente', () => {
    expect(mode(applySymbolic('a+X', 0o644))).toBe(0o644);
    expect(mode(applySymbolic('a+X', 0o644, { isDir: true }))).toBe(0o755);
    expect(mode(applySymbolic('a+X', 0o744))).toBe(0o755);
  });
  it('più operazioni nella stessa clausola', () => {
    expect(mode(applySymbolic('u+x-w', 0o644))).toBe(0o544);
    expect(mode(applySymbolic('go=u-w', 0o755))).toBe(0o755);
  });
  it('segnala gli errori', () => {
    expect(applySymbolic('', 0)).toMatchObject({ ok: false, error: 'expr-empty' });
    expect(applySymbolic('u', 0)).toMatchObject({ ok: false, error: 'expr-op' });
    expect(applySymbolic('x+u', 0)).toMatchObject({ ok: false });
    expect(applySymbolic('u+q', 0)).toMatchObject({ ok: false, error: 'expr-perm', at: 'q' });
    expect(applySymbolic('u+x,', 0)).toMatchObject({ ok: false, error: 'expr-syntax' });
    expect(applySymbolic('z+x', 0)).toMatchObject({ ok: false });
  });
});

describe('comando', () => {
  it('chmod ottale', () => {
    expect(chmodCommand(0o755)).toBe('chmod 755 file');
    expect(chmodCommand(0o644, { path: 'index.html' })).toBe('chmod 644 index.html');
    expect(chmodCommand(0o4755, { path: '/usr/local/bin/app', recursive: true })).toBe('chmod -R 4755 /usr/local/bin/app');
    expect(chmodCommand(0o644, { fourDigits: true })).toBe('chmod 0644 file');
  });
  it('racchiude tra apici i nomi con spazi o caratteri speciali', () => {
    expect(shellQuote('mio file.txt')).toBe("'mio file.txt'");
    expect(shellQuote("l'uno")).toBe("'l'\\''uno'");
    expect(shellQuote('a;b')).toBe("'a;b'");
    expect(shellQuote('$HOME/x')).toBe("'$HOME/x'");
    expect(chmodCommand(0o600, { path: 'chiave privata.pem' })).toBe("chmod 600 'chiave privata.pem'");
  });
  it('chmod simbolico', () => {
    expect(chmodCommandSymbolic(0o755)).toBe('chmod u=rwx,g=rx,o=rx file');
    expect(chmodCommandSymbolic(0o4750, { path: 'x' })).toBe('chmod u=rwxs,g=rx,o= x');
    expect(chmodCommandSymbolic(0o1777, { path: '/tmp' })).toBe('chmod u=rwx,g=rwx,o=rwxt /tmp');
  });
});

describe('preset', () => {
  it('hanno ottale e simbolico coerenti e id unici', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) {
      expect(toOctal(p.mode)).toBe(p.id);
      expect(parseSymbolic(toSymbolic(p.mode))).toEqual({ ok: true, mode: p.mode });
    }
  });
});
