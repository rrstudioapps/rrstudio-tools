// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ContentType, Detection, detectContent } from './content-detect';
import { HandoffKind, accepts } from './handoff-targets';

/**
 * Dalla rilevazione del contenuto (incolla, trascinamento, condivisione dal sistema) agli strumenti da proporre.
 * Logica pura: usa solo id di strumento. Gli id che non sono (ancora) nel registry vengono scartati al volo da
 * `known`, quindi una voce "in arrivo" può restare nelle mappe senza rompere nulla.
 */

/** Massimo di strumenti proposti. */
export const MAX_SUGGESTIONS = 8;

// ---------------------------------------------------------------- testo

/** Strumenti per tipo di contenuto, dal più pertinente. */
export const TEXT_TARGETS: Readonly<Record<ContentType, readonly string[]>> = {
  json: ['json-formatter', 'json-viewer', 'json-query', 'json-diff', 'yaml-json-converter', 'csv-json-converter', 'xml-json-converter'],
  jwt: ['jwt-decoder', 'base64'],
  url: ['url-parser', 'url-encode', 'qr-code-generator'],
  base64: ['base64'],
  color: ['color-converter'],
  cron: ['cron-expression'],
  iban: ['iban-partita-iva'],
  'codice-fiscale': ['codice-fiscale'],
  'partita-iva': ['iban-partita-iva'],
  svg: ['svg-to-png', 'svg-optimizer', 'xml-formatter', 'base64'],
  curl: ['curl-converter'],
  'docker-run': ['docker-run-to-compose'],
  csv: ['csv-json-converter', 'csv-dashboard', 'statistics-calculator', 'sort-lines'],
  yaml: ['yaml-json-converter'],
  xml: ['xml-formatter', 'xml-viewer', 'xml-to-csv', 'xml-json-converter', 'html-entities'],
  sql: ['sql-formatter'],
  'unix-timestamp': ['timestamp-converter', 'date-calculator'],
  uuid: ['uuid-generator'],
  hash: ['hash-generator'],
  pem: ['certificate-decoder', 'base64'],
  ip: ['subnet-calculator'],
  roman: ['roman-numerals'],
  morse: ['morse-code'],
  date: ['date-calculator', 'timestamp-converter'],
  text: [
    'word-counter',
    'text-diff',
    'case-converter',
    'find-replace',
    'sort-lines',
    'base64',
    'hash-generator',
    'qr-code-generator',
    'markdown-editor',
    'unicode-inspector',
  ],
};

/** Tipo di contenuto da passare con l'handoff: json, csv e svg hanno un tipo loro, il resto è testo. */
export function kindForType(type: ContentType): HandoffKind {
  if (type === 'json' || type === 'csv' || type === 'svg') return type;
  return 'text';
}

export interface Suggestion {
  toolId: string;
  /** Pertinenza, più alto = prima. */
  score: number;
  /** Tipo di contenuto da consegnare. */
  kind: HandoffKind;
  /** `text`: si passa il testo (anche leggendo un file); `files`: si passano i file così come sono. */
  via: 'text' | 'files';
  /** Perché lo proponiamo (tipo rilevato o classe del file): serve all'etichetta e ai test. */
  reason: string;
}

/** Strumenti per un elenco di rilevazioni (già ordinato): un solo suggerimento per strumento, col punteggio migliore. */
export function suggestFromDetections(dets: readonly Detection[], known: ReadonlySet<string>, max = MAX_SUGGESTIONS): Suggestion[] {
  const best = new Map<string, Suggestion>();
  // il testo generico è l'ultima spiaggia: se qualcosa è stato riconosciuto non si mescola agli strumenti specifici
  const specific = dets.length > 1;
  for (const d of dets) {
    if (specific && d.type === 'text') continue;
    const kind = kindForType(d.type);
    TEXT_TARGETS[d.type].forEach((toolId, rank) => {
      if (!known.has(toolId) || !accepts(toolId, kind)) return;
      const score = d.score - rank * 4;
      const cur = best.get(toolId);
      if (!cur || score > cur.score) best.set(toolId, { toolId, score, kind, via: 'text', reason: d.type });
    });
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, max);
}

/** Riconosce il testo e propone gli strumenti. */
export function suggestForText(raw: string, known: ReadonlySet<string>): { detections: Detection[]; suggestions: Suggestion[] } {
  const detections = detectContent(raw);
  return { detections, suggestions: suggestFromDetections(detections, known) };
}

// ---------------------------------------------------------------- file

export type FileClass = 'image' | 'svg' | 'pdf' | 'csv' | 'json' | 'yaml' | 'xml' | 'pem' | 'text' | 'other';

export interface FileMeta {
  name: string;
  type: string;
  size?: number;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|tiff?|heic|heif|ico)$/i;

/** Classe di un file dal MIME e dall'estensione (il MIME può mancare o essere generico: l'estensione lo completa). */
export function classifyFile(name: string, mime: string): FileClass {
  const n = name.toLowerCase();
  const t = (mime || '').toLowerCase().split(';')[0].trim();
  if (t === 'image/svg+xml' || /\.svgz?$/.test(n)) return 'svg';
  if (t === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf';
  if (t.startsWith('image/') || IMAGE_EXT.test(n)) return 'image';
  if (/\.(pem|crt|cer|cert|csr|key)$/.test(n) || t === 'application/x-pem-file' || t === 'application/x-x509-ca-cert' || t === 'application/pkix-cert') return 'pem';
  if (/\.(csv|tsv)$/.test(n) || t === 'text/csv' || t === 'text/tab-separated-values') return 'csv';
  if (/\.(json|geojson|jsonl|ndjson)$/.test(n) || t === 'application/json' || t.endsWith('+json')) return 'json';
  if (/\.(ya?ml)$/.test(n) || t === 'application/yaml' || t === 'application/x-yaml' || t === 'text/yaml' || t === 'text/x-yaml') return 'yaml';
  if (/\.(xml|html?|xhtml|xsd|xsl|rss|atom)$/.test(n) || t === 'application/xml' || t === 'text/xml' || t === 'text/html' || t.endsWith('+xml')) return 'xml';
  if (t.startsWith('text/') || /\.(txt|md|markdown|log|sql|ini|conf|cfg|env|toml|js|ts|css|scss|sh|py|php|java|c|cpp|h|go|rs|rb)$/.test(n)) return 'text';
  return 'other';
}

/** Vero se il file si può leggere come testo e proporre agli strumenti di testo. */
export const isTextual = (c: FileClass): boolean => c !== 'image' && c !== 'pdf' && c !== 'other';

interface FilePick {
  id: string;
  via: 'text' | 'files';
  /** Accetta più file insieme. */
  multi?: boolean;
}

/** Strumenti per classe di file, dal più pertinente. */
export const FILE_TARGETS: Readonly<Record<FileClass, readonly FilePick[]>> = {
  image: [
    { id: 'image-compressor', via: 'files', multi: true },
    { id: 'image-converter', via: 'files', multi: true },
    { id: 'image-crop', via: 'files' },
    { id: 'exif-viewer', via: 'files' },
    { id: 'image-watermark', via: 'files', multi: true },
    { id: 'image-color-picker', via: 'files' },
    { id: 'favicon-generator', via: 'files' },
    { id: 'qr-code-reader', via: 'files' },
    { id: 'images-to-pdf', via: 'files', multi: true },
  ],
  pdf: [
    { id: 'pdf-tools', via: 'files', multi: true },
    { id: 'pdf-sign', via: 'files' },
    { id: 'image-watermark', via: 'files', multi: true },
    { id: 'pdf-to-images', via: 'files' },
    { id: 'pdf-to-text', via: 'files', multi: true },
  ],
  csv: [
    { id: 'csv-dashboard', via: 'files' },
    { id: 'csv-json-converter', via: 'text' },
    { id: 'statistics-calculator', via: 'text' },
  ],
  json: [
    { id: 'json-formatter', via: 'text' },
    { id: 'json-viewer', via: 'text' },
    { id: 'json-query', via: 'text' },
    { id: 'json-diff', via: 'text' },
    { id: 'yaml-json-converter', via: 'text' },
    { id: 'csv-json-converter', via: 'text' },
  ],
  yaml: [{ id: 'yaml-json-converter', via: 'text' }],
  xml: [
    { id: 'xml-formatter', via: 'text' },
    { id: 'html-entities', via: 'text' },
  ],
  svg: [
    { id: 'svg-to-png', via: 'text' },
    { id: 'svg-optimizer', via: 'text' },
    { id: 'xml-formatter', via: 'text' },
  ],
  pem: [
    { id: 'certificate-decoder', via: 'text' },
    { id: 'base64', via: 'text' },
  ],
  text: [
    { id: 'word-counter', via: 'text' },
    { id: 'text-diff', via: 'text' },
    { id: 'case-converter', via: 'text' },
    { id: 'find-replace', via: 'text' },
    { id: 'sort-lines', via: 'text' },
    { id: 'markdown-editor', via: 'text' },
  ],
  other: [],
};

/** Per qualunque file (un solo file alla volta): impronta e cifratura. */
export const ANY_FILE_TARGETS: readonly FilePick[] = [
  { id: 'hash-generator', via: 'files' },
  { id: 'file-encrypt', via: 'files' },
];

function kindForClass(c: FileClass): HandoffKind {
  return c === 'json' || c === 'csv' || c === 'svg' ? c : 'text';
}

/** Strumenti per uno o più file. Con più file restano solo quelli che li accettano tutti insieme. */
export function suggestForFiles(files: readonly FileMeta[], known: ReadonlySet<string>, max = MAX_SUGGESTIONS): Suggestion[] {
  if (!files.length) return [];
  const classes = files.map((f) => classifyFile(f.name, f.type));
  const allImages = classes.every((c) => c === 'image');
  const single = files.length === 1;
  const filesKind: HandoffKind = allImages ? 'image' : 'files';
  const out = new Map<string, Suggestion>();

  const lists = classes.map((c, i) => {
    const picks = [
      ...FILE_TARGETS[c].map((p, rank) => ({ ...p, score: 100 - rank * 4, c, any: false })),
      // hash e cifratura prendono qualunque file, anche un'immagine: sempre come `files`
      ...ANY_FILE_TARGETS.map((p, rank) => ({ ...p, score: 40 - rank * 4, c, any: true })),
    ];
    return { c, i, picks };
  });

  const [first, ...others] = lists;
  for (const p of first.picks) {
    if (!known.has(p.id)) continue;
    if (!single && !p.multi) continue; // più file solo a chi li accetta insieme
    // con più file lo strumento deve essere proposto per ognuno di essi
    if (!others.every((o) => o.picks.some((q) => q.id === p.id))) continue;
    if (p.via === 'text' && !single) continue;
    const kind = p.via === 'files' ? (p.any ? 'files' : filesKind) : kindForClass(first.c);
    if (!accepts(p.id, kind)) continue;
    const score = Math.min(p.score, ...others.map((o) => o.picks.find((q) => q.id === p.id)!.score));
    const cur = out.get(p.id);
    if (!cur || score > cur.score) out.set(p.id, { toolId: p.id, score, kind, via: p.via, reason: first.c });
  }
  return [...out.values()].sort((a, b) => b.score - a.score).slice(0, max);
}

// ---------------------------------------------------------------- condivisione dal sistema

export interface SharedData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

/**
 * Dal contenuto condiviso dal sistema (title, text, url, files) a quello da analizzare: i file se ci sono;
 * altrimenti il testo con l'indirizzo (molte app mettono l'URL dentro `text`, e allora non si ripete);
 * il titolo conta solo se non c'è altro.
 */
export function composeShared(d: SharedData): { kind: 'files'; files: File[] } | { kind: 'text'; text: string } | null {
  if (d.files?.length) return { kind: 'files', files: d.files };
  const text = (d.text ?? '').trim();
  const url = (d.url ?? '').trim();
  const parts: string[] = [];
  if (text) parts.push(text);
  if (url && !text.includes(url)) parts.push(url);
  if (!parts.length && (d.title ?? '').trim()) parts.push((d.title ?? '').trim());
  return parts.length ? { kind: 'text', text: parts.join('\n') } : null;
}
