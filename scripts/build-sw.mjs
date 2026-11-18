// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
// Eseguito DOPO `ng build`: legge dist/rrstudio-tools/browser, calcola versione (hash dei contenuti),
// SHELL (precaricato all'installazione) e ALL (download completo su richiesta) e scrive sw.js nella radice
// della build a partire da scripts/sw-template.js. La logica di classificazione sta in sw-manifest.mjs.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { buildLists, versionInput } from './sw-manifest.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist/rrstudio-tools/browser');

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

const files = [];
const hashes = [];
const htmlByUrl = {};
for (const abs of walk(dist)) {
  const path = relative(dist, abs).split(sep).join('/');
  if (path === 'sw.js') continue; // il SW non entra nel proprio hash
  const buf = readFileSync(abs);
  hashes.push({ path, hash: createHash('sha256').update(buf).digest('hex') });
  const size = statSync(abs).size;
  // il peso stimato del download usa la dimensione compressa per i file di testo (nginx fa gzip)
  files.push({ path, size, gzip: /\.(html|js|mjs|css|json|txt|svg|csv|webmanifest)$/i.test(path) ? gzipSync(buf).length : undefined });
  if (path === 'index.html') htmlByUrl['/'] = buf.toString('utf8');
  if (path === 'en/index.html') htmlByUrl['/en/'] = buf.toString('utf8');
}
if (!htmlByUrl['/'] || !htmlByUrl['/en/']) {
  console.error('build-sw: index.html o en/index.html mancanti in ' + dist + ' (esegui prima ng build)');
  process.exit(1);
}

const { shell, all, pages, size } = buildLists(files, htmlByUrl);
const VERSION = createHash('sha256').update(versionInput(hashes)).digest('hex').slice(0, 12);

const template = readFileSync(join(import.meta.dirname, 'sw-template.js'), 'utf8');
if (!template.includes('__SW_DATA__')) throw new Error('segnaposto __SW_DATA__ mancante in sw-template.js');
if (!template.includes('/*__SW_SHARE__*/')) throw new Error('segnaposto __SW_SHARE__ mancante in sw-template.js');
// logica del Web Share Target (modulo testabile): il SW è uno script classico, quindi si tolgono le `export`
const shareLogic = readFileSync(join(import.meta.dirname, 'sw-share.mjs'), 'utf8').replace(/^export /gm, '');
const data = { VERSION, SHELL: shell, ALL: all, SIZE: size };
writeFileSync(
  join(dist, 'sw.js'),
  template.replace('/*__SW_SHARE__*/', () => shareLogic).replace('__SW_DATA__', () => JSON.stringify(data)),
);

// riepilogo: dimensioni reali (non compresse) di SHELL e ALL
const sizeOf = (urls) => {
  const byUrl = new Map(files.map((f) => [f.path.endsWith('index.html') ? (f.path === 'index.html' ? '/' : '/' + f.path.slice(0, -10)) : '/' + f.path, f.size]));
  return urls.reduce((s, u) => s + (byUrl.get(u) ?? 0), 0);
};
const mb = (n) => (n / 1048576).toFixed(2);
console.log(`sw.js scritto: versione ${VERSION}`);
console.log(`  SHELL: ${shell.length} file, ${mb(sizeOf(shell))} MB`);
console.log(`  ALL:   ${all.length} file (${pages.length} pagine), ${mb(sizeOf(all))} MB (circa ${mb(size)} MB compressi)`);
