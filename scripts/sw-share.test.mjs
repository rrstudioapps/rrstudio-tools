// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
// Test della logica pura del Web Share Target (sw-share.mjs). Uso: node --test scripts/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHARE_MAX_FILES, SHARE_MAX_TEXT, SHARE_TTL, ShareStore, isShareRequest, pickShareLang, readShare, sharePath } from './sw-share.mjs';

test('riconosce solo il POST all\'indirizzo del share target', () => {
  assert.ok(isShareRequest('POST', '/condividi/'));
  assert.ok(isShareRequest('POST', '/condividi'));
  assert.ok(!isShareRequest('GET', '/condividi/'));
  assert.ok(!isShareRequest('POST', '/base64/'));
  assert.ok(!isShareRequest('POST', '/en/share/'));
  assert.ok(!isShareRequest('POST', '/condividi/altro'));
});

test('lingua della pagina di ricezione', () => {
  assert.equal(pickShareLang('en-US,en;q=0.9,it;q=0.8'), 'en');
  assert.equal(pickShareLang('en'), 'en');
  assert.equal(pickShareLang('it-IT,it;q=0.9,en;q=0.8'), 'it');
  assert.equal(pickShareLang('de-DE,en;q=0.5'), 'it');
  assert.equal(pickShareLang(''), 'it');
  assert.equal(pickShareLang(null), 'it');
  assert.equal(pickShareLang('english'), 'it');
});

test('indirizzi di rimando', () => {
  assert.equal(sharePath('it', 'received'), '/condividi/?received=1');
  assert.equal(sharePath('en', 'received'), '/en/share/?received=1');
  assert.equal(sharePath('it', 'retry'), '/condividi/?retry=1');
  assert.equal(sharePath('en', 'retry'), '/en/share/?retry=1');
});

test('lettura dei campi condivisi', () => {
  const fd = new FormData();
  fd.set('title', 'Titolo');
  fd.set('text', 'Un testo');
  fd.set('url', 'https://example.com/x');
  fd.append('files', new File(['ciao'], 'a.txt', { type: 'text/plain' }));
  const r = readShare(fd);
  assert.equal(r.title, 'Titolo');
  assert.equal(r.text, 'Un testo');
  assert.equal(r.url, 'https://example.com/x');
  assert.equal(r.files.length, 1);
  assert.equal(r.files[0].name, 'a.txt');
});

test('un invio vuoto non è utilizzabile', () => {
  assert.equal(readShare(new FormData()), null);
  const fd = new FormData();
  fd.set('text', '   ');
  fd.append('files', new File([], 'vuoto.txt'));
  assert.equal(readShare(fd), null);
});

test('i valori non testuali e i limiti sono ignorati o tagliati', () => {
  const fd = new FormData();
  fd.set('text', 'x'.repeat(SHARE_MAX_TEXT + 500));
  for (let i = 0; i < SHARE_MAX_FILES + 5; i++) fd.append('files', new File(['a'], `f${i}.txt`));
  fd.append('files', 'non-un-file');
  const r = readShare(fd);
  assert.equal(r.text.length, SHARE_MAX_TEXT);
  assert.equal(r.files.length, SHARE_MAX_FILES);
});

test('il contenuto si consegna una sola volta', () => {
  const s = new ShareStore();
  s.put({ text: 'a' }, 1000);
  assert.ok(s.pending);
  assert.deepEqual(s.claim(1500), { text: 'a' });
  assert.equal(s.claim(1600), null);
  assert.ok(!s.pending);
});

test('il contenuto scade e il più recente sostituisce il precedente', () => {
  const s = new ShareStore();
  s.put({ text: 'vecchio' }, 0);
  assert.equal(s.claim(SHARE_TTL + 1), null);
  s.put({ text: 'uno' }, 0);
  s.put({ text: 'due' }, 10);
  assert.deepEqual(s.claim(20), { text: 'due' });
  s.put({ text: 'tre' }, 0);
  s.clear();
  assert.equal(s.claim(1), null);
});

test('il service worker assemblato è sintatticamente valido e usa la logica del modulo', () => {
  const tpl = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
  const logic = readFileSync(new URL('./sw-share.mjs', import.meta.url), 'utf8').replace(/^export /gm, '');
  const sw = tpl.replace('/*__SW_SHARE__*/', () => logic).replace('__SW_DATA__', () => '{"VERSION":"t","SHELL":[],"ALL":[],"SIZE":0}');
  assert.doesNotThrow(() => new Function(sw));
  assert.ok(sw.includes('receiveShare') && sw.includes('share-claim'));
  assert.ok(!/^export /m.test(sw));
});
