// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { safeFileName, saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { formatBytes } from '../../shared/text-stats';
import { ToolHandoff } from '../../shared/tool-handoff';
import { pagesFromRanges } from '../image-watermark/image-watermark';
import { parseRanges } from '../pdf-tools/page-ranges';
import { uniqueNames } from '../pdf-tools/pdf-names';
import {
  DEFAULT_OPTIONS,
  composeMarkdown,
  composeText,
  countWords,
  describePages,
  extractDocument,
  type DocumentText,
  type LayoutMode,
  type RawItem,
} from './pdf-to-text';
import { MAX_PAGES, PasswordNeededError, readPdfItems } from './pdf-to-text-read';
import { PDF_TO_TEXT_DICTIONARIES } from './pdf-to-text.i18n';
import { SHARE_SCHEMA } from './pdf-to-text.share';

const MAX_FILES = 20;
const MAX_BYTES = 60 * 1024 * 1024;
const ACCEPT = 'application/pdf,.pdf';

type Status = 'reading' | 'ok' | 'password' | 'error';

interface Item {
  id: number;
  file: File;
  status: Status;
  /** Con `password`: quella data prima non era giusta. */
  wrong: boolean;
  /** Messaggio d'errore (chiave i18n + parametri). */
  errorKey: string;
  progress: string;
  /** Elementi di testo di ogni pagina (vuoto finché non è letto). */
  raw: RawItem[][];
}

interface Result {
  item: Item;
  doc: DocumentText;
  /** Pagine (da 1) senza livello di testo. */
  noText: number[];
  /** Totale pagine del file. */
  total: number;
  words: number;
  chars: number;
}

const isPdf = (f: File): boolean => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

@Component({
  selector: 'app-pdf-to-text',
  imports: [FileDrop, Icon, PrivacyNote, Segmented, SendTo, ShareLink, CopyButton, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-to-text.page.html',
  styleUrl: './pdf-to-text.page.scss',
})
export class PdfToTextPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly accept = ACCEPT;
  protected readonly maxFiles = MAX_FILES;
  protected readonly shareSchema = SHARE_SCHEMA;

  // ---- opzioni ----
  protected readonly layout = signal<LayoutMode>(DEFAULT_OPTIONS.layout);
  protected readonly dehyphenate = signal(DEFAULT_OPTIONS.dehyphenate);
  protected readonly markers = signal(true);
  protected readonly stripRepeated = signal(DEFAULT_OPTIONS.stripRepeated);
  protected readonly columns = signal(DEFAULT_OPTIONS.columns);
  protected readonly pages = signal('');

  protected readonly layouts = computed<SegmentOption<LayoutMode>[]>(() => [
    { value: 'flow', label: this.i18n.t('p2t.layout.flow') },
    { value: 'keep', label: this.i18n.t('p2t.layout.keep') },
  ]);

  // ---- file ----
  protected readonly items = signal<Item[]>([]);
  protected readonly error = signal('');
  protected readonly status = signal('');
  private nextId = 1;

  /** Intervallo di pagine scritto: `null` = tutte; `false` = non valido. */
  private readonly ranges = computed(() => {
    const t = this.pages().trim();
    if (t === '') return null;
    const r = parseRanges(t, 1_000_000);
    return r.ok ? r.ranges : false;
  });
  protected readonly rangeInvalid = computed(() => this.ranges() === false);

  /** Testo estratto di ogni file letto, ricalcolato a ogni cambio di opzioni (solo logica pura, niente rilettura). */
  protected readonly results = computed<Result[]>(() => {
    const ranges = this.ranges();
    if (ranges === false) return [];
    const opts = { layout: this.layout(), dehyphenate: this.dehyphenate(), columns: this.columns(), stripRepeated: this.stripRepeated() };
    const out: Result[] = [];
    for (const item of this.items()) {
      if (item.status !== 'ok') continue;
      const total = item.raw.length;
      const sel = pagesFromRanges(ranges, total);
      const doc = extractDocument(
        sel.map((i) => ({ number: i + 1, items: item.raw[i] })),
        opts,
      );
      const plain = composeText(doc.pages, { markers: false, pageLabel: '' });
      out.push({
        item,
        doc,
        total,
        noText: doc.pages.filter((p) => !p.hasText).map((p) => p.number),
        words: countWords(plain),
        chars: [...plain].length,
      });
    }
    return out;
  });

  protected readonly pending = computed(() => this.items().filter((i) => i.status === 'password'));
  protected readonly reading = computed(() => this.items().some((i) => i.status === 'reading'));
  protected readonly totals = computed(() => {
    const r = this.results();
    return {
      words: r.reduce((n, x) => n + x.words, 0),
      chars: r.reduce((n, x) => n + x.chars, 0),
      withText: r.reduce((n, x) => n + x.doc.withText, 0),
      withoutText: r.reduce((n, x) => n + x.doc.withoutText, 0),
    };
  });
  protected readonly empty = computed(() => this.results().length === 0 || this.results().every((r) => r.doc.pages.length === 0));

  private label(): string {
    return this.i18n.t('p2t.pageWord');
  }
  private textOf(r: Result): string {
    return composeText(r.doc.pages, { markers: this.markers(), pageLabel: this.label() });
  }
  /** Tutto il testo (con il nome del file sopra ciascuno quando i file sono più d'uno). */
  protected readonly allText = computed(() => {
    const rs = this.results();
    if (rs.length === 1) return this.textOf(rs[0]);
    return rs.map((r) => `=== ${r.item.file.name} ===\n\n${this.textOf(r)}`.trimEnd()).join('\n\n');
  });
  protected readonly hasOutput = computed(() => this.results().some((r) => r.doc.pages.some((p) => p.text !== '')));

  // Link di condivisione: solo le opzioni
  protected readonly shared = {
    layout: this.layout,
    dehyphenate: this.dehyphenate,
    markers: this.markers,
    stripRepeated: this.stripRepeated,
    columns: this.columns,
    pages: this.pages,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(PDF_TO_TEXT_DICTIONARIES);
    // PDF ricevuti da un altro strumento o dal trascinamento nella home
    const rx = inject(ToolHandoff).take('pdf-to-text');
    if (rx?.files?.length) afterNextRender(() => void this.onFiles(rx.files!));
  }

  protected size(bytes: number): string {
    return formatBytes(bytes, this.i18n.locale());
  }

  // ======== caricamento ========
  protected async onFiles(list: File[]): Promise<void> {
    this.error.set('');
    this.status.set('');
    let notPdf = 0;
    let tooBig = 0;
    let tooMany = 0;
    const added: Item[] = [];
    const room = MAX_FILES - this.items().length;
    for (const file of list) {
      if (!isPdf(file)) notPdf++;
      else if (file.size > MAX_BYTES) tooBig++;
      else if (added.length >= room) tooMany++;
      else added.push({ id: this.nextId++, file, status: 'reading', wrong: false, errorKey: '', progress: '', raw: [] });
    }
    const msgs: string[] = [];
    if (notPdf) msgs.push(this.i18n.t('p2t.err.type', { n: notPdf }));
    if (tooBig) msgs.push(this.i18n.t('p2t.err.size', { n: tooBig }));
    if (tooMany) msgs.push(this.i18n.t('p2t.err.count', { n: tooMany, max: MAX_FILES }));
    this.error.set(msgs.join(' '));
    if (added.length === 0) return;
    this.items.update((l) => [...l, ...added]);
    // uno alla volta: pdf.js è pesante e il server di chi usa lo strumento può essere piccolo
    for (const it of added) await this.read(it, undefined);
  }

  private patch(id: number, p: Partial<Item>): void {
    this.items.update((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }

  private async read(item: Item, password: string | undefined): Promise<void> {
    if (!this.browser) return;
    this.patch(item.id, { status: 'reading', errorKey: '', progress: '' });
    try {
      const bytes = new Uint8Array(await item.file.arrayBuffer());
      const { pages } = await readPdfItems(bytes, password, (done, total) => this.patch(item.id, { progress: `${done}/${total}` }));
      this.patch(item.id, { status: 'ok', raw: pages, wrong: false, progress: '' });
    } catch (e) {
      if (e instanceof PasswordNeededError) this.patch(item.id, { status: 'password', wrong: e.wrong, progress: '' });
      else this.patch(item.id, { status: 'error', errorKey: e instanceof RangeError ? 'p2t.err.pages' : 'p2t.err.invalid', progress: '' });
    }
  }

  /** La password si legge dal campo, serve solo ad aprire il file e il campo si svuota subito: non resta in nessuno stato. */
  protected async unlock(item: Item, input: HTMLInputElement, ev: Event): Promise<void> {
    ev.preventDefault();
    const pw = input.value;
    input.value = '';
    if (pw === '') return;
    await this.read(item, pw);
  }

  protected remove(item: Item): void {
    this.items.update((l) => l.filter((i) => i.id !== item.id));
  }
  protected clearAll(): void {
    this.items.set([]);
    this.error.set('');
    this.status.set('');
  }

  protected errorOf(item: Item): string {
    return this.i18n.t(item.errorKey, { name: item.file.name, max: MAX_PAGES });
  }

  protected noTextList(r: Result): string {
    return describePages(r.noText);
  }

  // ======== uscita ========
  private baseName(r: Result): string {
    return safeFileName(r.item.file.name.replace(/\.pdf$/i, ''), 'documento');
  }

  /** Un file di testo per PDF; con più PDF, uno ZIP. */
  private async save(ext: 'txt' | 'md'): Promise<void> {
    const rs = this.results();
    if (rs.length === 0) return;
    const label = this.label();
    const body = (r: Result) => (ext === 'txt' ? this.textOf(r) + '\n' : composeMarkdown(r.item.file.name, r.doc.pages, label));
    const mime = ext === 'txt' ? 'text/plain;charset=utf-8' : 'text/markdown;charset=utf-8';
    const enc = new TextEncoder();
    if (rs.length === 1) {
      saveBytes(enc.encode(body(rs[0])), `${this.baseName(rs[0])}.${ext}`, mime);
      this.status.set(this.i18n.t('p2t.saved', { n: 1 }));
      return;
    }
    const names = uniqueNames(rs.map((r) => `${this.baseName(r)}.${ext}`));
    const files: Record<string, Uint8Array> = {};
    rs.forEach((r, i) => (files[names[i]] = enc.encode(body(r))));
    const { zipSync } = await import('fflate');
    saveBytes(new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: 'application/zip' }), this.i18n.lang() === 'en' ? `pdf-text-${ext}.zip` : `testo-pdf-${ext}.zip`, 'application/zip');
    this.status.set(this.i18n.t('p2t.saved', { n: rs.length }));
  }
  protected downloadTxt(): Promise<void> {
    return this.save('txt');
  }
  protected downloadMd(): Promise<void> {
    return this.save('md');
  }
}
