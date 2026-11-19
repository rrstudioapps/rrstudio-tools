// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { describe, expect, it } from 'vitest';
import { TOOLS } from '../tools/tools.registry';
import { ContentType } from './content-detect';
import { accepts } from './handoff-targets';
import {
  ANY_FILE_TARGETS,
  FILE_TARGETS,
  MAX_SUGGESTIONS,
  TEXT_TARGETS,
  classifyFile,
  composeShared,
  isTextual,
  kindForType,
  suggestForFiles,
  suggestForText,
} from './smart-targets';

const KNOWN = new Set(TOOLS.map((t) => t.id));
const ids = (s: { toolId: string }[]) => s.map((x) => x.toolId);
const file = (name: string, type = '') => ({ name, type });

describe('mappe degli strumenti', () => {
  const usedText = Object.values(TEXT_TARGETS).flat();
  const usedFiles = [...Object.values(FILE_TARGETS).flat(), ...ANY_FILE_TARGETS].map((p) => p.id);

  it('ogni id delle mappe esiste nel registry', () => {
    for (const id of [...usedText, ...usedFiles]) expect(KNOWN.has(id), id).toBe(true);
  });

  it('ogni strumento accetta il tipo di contenuto che gli si manda', () => {
    for (const [type, list] of Object.entries(TEXT_TARGETS)) {
      for (const id of list) if (KNOWN.has(id)) expect(accepts(id, kindForType(type as ContentType)), `${id} <- ${type}`).toBe(true);
    }
  });

  it('i file: ogni strumento accetta il tipo con cui lo riceve', () => {
    for (const [cls, list] of Object.entries(FILE_TARGETS)) {
      for (const p of list) {
        if (!KNOWN.has(p.id)) continue;
        const kinds = p.via === 'files' ? (cls === 'image' ? ['image'] : ['files']) : [cls === 'json' || cls === 'csv' || cls === 'svg' ? cls : 'text'];
        expect(kinds.some((k) => accepts(p.id, k as never)), `${p.id} <- ${cls}`).toBe(true);
      }
    }
    for (const p of ANY_FILE_TARGETS) expect(accepts(p.id, 'files'), p.id).toBe(true);
  });

  it('i tipi json, csv e svg hanno un tipo di handoff loro, il resto è testo', () => {
    expect(kindForType('json')).toBe('json');
    expect(kindForType('csv')).toBe('csv');
    expect(kindForType('svg')).toBe('svg');
    expect(kindForType('iban')).toBe('text');
    expect(kindForType('text')).toBe('text');
  });
});

describe('suggerimenti per il testo', () => {
  it('un JSON propone prima il formatter, poi gli altri strumenti JSON', () => {
    const { suggestions } = suggestForText('{"a":1}', KNOWN);
    expect(ids(suggestions).slice(0, 3)).toEqual(['json-formatter', 'json-viewer', 'json-query']);
    expect(suggestions.every((s) => s.kind === 'json' && s.via === 'text')).toBe(true);
  });

  it('un IBAN propone lo strumento IBAN e un cron lo strumento cron', () => {
    expect(ids(suggestForText('IT60X0542811101000000123456', KNOWN).suggestions)[0]).toBe('iban-partita-iva');
    expect(ids(suggestForText('*/5 * * * *', KNOWN).suggestions)[0]).toBe('cron-expression');
    expect(ids(suggestForText('RSSMRA85M01H501Q', KNOWN).suggestions)[0]).toBe('codice-fiscale');
    expect(ids(suggestForText('#ff8800', KNOWN).suggestions)[0]).toBe('color-converter');
    expect(ids(suggestForText('curl https://example.com', KNOWN).suggestions)[0]).toBe('curl-converter');
    expect(ids(suggestForText('MMXXIV', KNOWN).suggestions)[0]).toBe('roman-numerals');
    expect(ids(suggestForText('... --- ...', KNOWN).suggestions)[0]).toBe('morse-code');
    expect(ids(suggestForText('1700000000', KNOWN).suggestions)[0]).toBe('timestamp-converter');
    expect(ids(suggestForText('SELECT * FROM t', KNOWN).suggestions)[0]).toBe('sql-formatter');
    expect(ids(suggestForText('550e8400-e29b-41d4-a716-446655440000', KNOWN).suggestions)[0]).toBe('uuid-generator');
  });

  it('un SVG è consegnato come svg e arriva a svg-to-png e svg-optimizer', () => {
    const { suggestions } = suggestForText('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>', KNOWN);
    expect(ids(suggestions)).toEqual(expect.arrayContaining(['svg-to-png', 'svg-optimizer']));
    expect(suggestions.find((s) => s.toolId === 'svg-to-png')?.kind).toBe('svg');
  });

  it('un CSV è consegnato come csv; la dashboard lo riceve', () => {
    const { suggestions } = suggestForText('a,b,c\n1,2,3\n4,5,6', KNOWN);
    expect(ids(suggestions)).toEqual(expect.arrayContaining(['csv-json-converter', 'csv-dashboard']));
    expect(suggestions.every((s) => s.kind === 'csv')).toBe(true);
  });

  it('un testo senza formato propone gli strumenti di testo generici (al massimo MAX_SUGGESTIONS)', () => {
    const { suggestions, detections } = suggestForText('Una frase qualunque, niente di speciale.', KNOWN);
    expect(detections[0].type).toBe('text');
    expect(ids(suggestions)).toContain('word-counter');
    expect(suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
    expect(suggestions.every((s) => s.kind === 'text')).toBe(true);
  });

  it('gli strumenti fuori dal registry (o non ancora pronti a riceverlo) non compaiono', () => {
    const none = suggestForText('192.168.0.0/24', new Set(['json-formatter']));
    expect(none.suggestions).toEqual([]);
    // anche se l'id è "noto", senza una voce in HANDOFF_ACCEPTS non si propone
    const ip = suggestForText('192.168.0.0/24', new Set(['subnet-calculator']));
    expect(ids(ip.suggestions).every((id) => accepts(id, 'text'))).toBe(true);
  });

  it('un CIDR propone il calcolatore di sottoreti, un docker run lo convertitore in compose', () => {
    expect(ids(suggestForText('192.168.0.0/24', KNOWN).suggestions)).toContain('subnet-calculator');
    expect(ids(suggestForText('docker run -d -p 80:80 nginx', KNOWN).suggestions)).toContain('docker-run-to-compose');
  });

  it('un solo suggerimento per strumento, in ordine di pertinenza', () => {
    const { suggestions } = suggestForText('2024-03-15', KNOWN);
    expect(new Set(ids(suggestions)).size).toBe(suggestions.length);
    const scores = suggestions.map((s) => s.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(ids(suggestions)[0]).toBe('date-calculator');
  });

  it('il testo vuoto non propone nulla', () => {
    expect(suggestForText('   ', KNOWN).suggestions).toEqual([]);
  });
});

describe('classificazione dei file', () => {
  it('dal MIME e dall\'estensione', () => {
    expect(classifyFile('a.png', 'image/png')).toBe('image');
    expect(classifyFile('foto.JPG', '')).toBe('image');
    expect(classifyFile('x.heic', '')).toBe('image');
    expect(classifyFile('logo.svg', 'image/svg+xml')).toBe('svg');
    expect(classifyFile('logo.svg', '')).toBe('svg');
    expect(classifyFile('doc.pdf', 'application/pdf')).toBe('pdf');
    expect(classifyFile('DOC.PDF', '')).toBe('pdf');
    expect(classifyFile('dati.csv', 'text/csv')).toBe('csv');
    expect(classifyFile('dati.tsv', '')).toBe('csv');
    expect(classifyFile('x.json', 'application/json')).toBe('json');
    expect(classifyFile('x.geojson', '')).toBe('json');
    expect(classifyFile('conf.yml', '')).toBe('yaml');
    expect(classifyFile('feed.xml', 'application/xml')).toBe('xml');
    expect(classifyFile('index.html', 'text/html')).toBe('xml');
    expect(classifyFile('cert.pem', '')).toBe('pem');
    expect(classifyFile('sito.crt', 'application/x-x509-ca-cert')).toBe('pem');
    expect(classifyFile('note.txt', 'text/plain')).toBe('text');
    expect(classifyFile('README.md', '')).toBe('text');
    expect(classifyFile('archivio.zip', 'application/zip')).toBe('other');
    expect(classifyFile('senza-estensione', '')).toBe('other');
  });

  it('il MIME ha la precedenza sull\'estensione per immagini e PDF; l\'estensione completa un MIME generico', () => {
    expect(classifyFile('strano.dat', 'image/webp')).toBe('image');
    expect(classifyFile('dati.csv', 'application/octet-stream')).toBe('csv');
    expect(classifyFile('x.json', 'application/octet-stream')).toBe('json');
  });

  it('quali classi si leggono come testo', () => {
    expect(isTextual('json')).toBe(true);
    expect(isTextual('csv')).toBe(true);
    expect(isTextual('image')).toBe(false);
    expect(isTextual('pdf')).toBe(false);
    expect(isTextual('other')).toBe(false);
  });
});

describe('suggerimenti per i file', () => {
  it('un\'immagine: compressione e conversione per prime, poi ritaglio, EXIF, filigrana, contagocce, favicon, QR, PDF', () => {
    const s = suggestForFiles([file('a.png', 'image/png')], KNOWN, 20);
    expect(ids(s).slice(0, 2)).toEqual(['image-compressor', 'image-converter']);
    expect(ids(s)).toEqual(
      expect.arrayContaining(['image-crop', 'exif-viewer', 'image-watermark', 'image-color-picker', 'favicon-generator', 'qr-code-reader', 'images-to-pdf', 'hash-generator', 'file-encrypt']),
    );
    expect(s.find((x) => x.toolId === 'image-crop')?.kind).toBe('image');
    expect(s.find((x) => x.toolId === 'image-crop')?.via).toBe('files');
  });

  it('più immagini: solo gli strumenti che le accettano insieme', () => {
    const s = ids(suggestForFiles([file('a.png', 'image/png'), file('b.jpg', 'image/jpeg')], KNOWN, 20));
    expect(s).toEqual(expect.arrayContaining(['image-compressor', 'image-converter', 'image-watermark', 'images-to-pdf']));
    for (const single of ['image-crop', 'exif-viewer', 'image-color-picker', 'favicon-generator', 'qr-code-reader', 'hash-generator', 'file-encrypt']) {
      expect(s, single).not.toContain(single);
    }
  });

  it('un PDF: strumenti PDF, firma e filigrana (kind files)', () => {
    const s = suggestForFiles([file('a.pdf', 'application/pdf')], KNOWN, 20);
    expect(ids(s).slice(0, 3)).toEqual(['pdf-tools', 'pdf-sign', 'image-watermark']);
    expect(s.every((x) => x.kind === 'files')).toBe(true);
    expect(ids(s)).not.toContain('image-compressor');
  });

  it('più PDF: strumenti PDF e filigrana, non la firma', () => {
    const s = ids(suggestForFiles([file('a.pdf'), file('b.pdf')], KNOWN, 20));
    expect(s).toEqual(expect.arrayContaining(['pdf-tools', 'image-watermark']));
    expect(s).not.toContain('pdf-sign');
  });

  it('immagini e PDF insieme: solo la filigrana (che prende entrambi), come files', () => {
    const s = suggestForFiles([file('a.png', 'image/png'), file('b.pdf', 'application/pdf')], KNOWN, 20);
    expect(ids(s)).toEqual(['image-watermark']);
    expect(s[0].kind).toBe('files');
  });

  it('un CSV: dashboard come file, convertitore come testo csv', () => {
    const s = suggestForFiles([file('dati.csv', 'text/csv')], KNOWN, 20);
    expect(s[0]).toMatchObject({ toolId: 'csv-dashboard', via: 'files', kind: 'files' });
    expect(s.find((x) => x.toolId === 'csv-json-converter')).toMatchObject({ via: 'text', kind: 'csv' });
  });

  it('JSON, YAML, XML, SVG e testo: formatter e convertitori, letti come testo', () => {
    expect(suggestForFiles([file('a.json')], KNOWN)[0]).toMatchObject({ toolId: 'json-formatter', via: 'text', kind: 'json' });
    expect(ids(suggestForFiles([file('a.yaml')], KNOWN))).toContain('yaml-json-converter');
    expect(ids(suggestForFiles([file('a.xml')], KNOWN))).toContain('xml-formatter');
    expect(suggestForFiles([file('a.svg', 'image/svg+xml')], KNOWN)[0]).toMatchObject({ toolId: 'svg-to-png', via: 'text', kind: 'svg' });
    expect(ids(suggestForFiles([file('a.txt', 'text/plain')], KNOWN))).toEqual(expect.arrayContaining(['word-counter', 'text-diff']));
  });

  it('PEM e CRT: decoder dei certificati', () => {
    expect(suggestForFiles([file('sito.crt')], KNOWN)[0]).toMatchObject({ toolId: 'certificate-decoder', via: 'text', kind: 'text' });
    expect(suggestForFiles([file('chiave.pem')], KNOWN)[0].toolId).toBe('certificate-decoder');
  });

  it('qualunque file: almeno hash e cifratura', () => {
    expect(ids(suggestForFiles([file('archivio.zip', 'application/zip')], KNOWN))).toEqual(['hash-generator', 'file-encrypt']);
  });

  it('più file di testo o di tipo sconosciuto: nessuno strumento li prende insieme', () => {
    expect(suggestForFiles([file('a.json'), file('b.json')], KNOWN)).toEqual([]);
    expect(suggestForFiles([file('a.zip'), file('b.zip')], KNOWN)).toEqual([]);
    expect(suggestForFiles([file('a.csv'), file('b.csv')], KNOWN)).toEqual([]);
  });

  it('nessun file, nessun suggerimento; gli strumenti non noti non compaiono', () => {
    expect(suggestForFiles([], KNOWN)).toEqual([]);
    expect(suggestForFiles([file('a.png', 'image/png')], new Set(['image-compressor']))).toHaveLength(1);
  });

  it('non supera il massimo richiesto', () => {
    expect(suggestForFiles([file('a.png', 'image/png')], KNOWN, 3)).toHaveLength(3);
  });
});

describe('contenuto condiviso dal sistema', () => {
  const f = new File(['x'], 'a.txt');
  it('i file hanno la precedenza', () => {
    expect(composeShared({ text: 'ciao', files: [f] })).toEqual({ kind: 'files', files: [f] });
  });
  it('testo e url si uniscono, ma l\'url già nel testo non si ripete', () => {
    expect(composeShared({ text: 'guarda qui', url: 'https://a.it/x' })).toEqual({ kind: 'text', text: 'guarda qui\nhttps://a.it/x' });
    expect(composeShared({ text: 'guarda https://a.it/x', url: 'https://a.it/x' })).toEqual({ kind: 'text', text: 'guarda https://a.it/x' });
    expect(composeShared({ url: 'https://a.it/x' })).toEqual({ kind: 'text', text: 'https://a.it/x' });
  });
  it('il titolo conta solo se non c\'è altro; il vuoto non dà nulla', () => {
    expect(composeShared({ title: 'Solo titolo' })).toEqual({ kind: 'text', text: 'Solo titolo' });
    expect(composeShared({ title: 'T', text: 'corpo' })).toEqual({ kind: 'text', text: 'corpo' });
    expect(composeShared({ title: ' ', text: '', url: '', files: [] })).toBeNull();
    expect(composeShared({})).toBeNull();
  });
});
