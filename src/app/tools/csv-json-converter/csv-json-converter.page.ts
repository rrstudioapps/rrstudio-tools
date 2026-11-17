// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import {
  Cell,
  ConvertError,
  JsonShape,
  Table,
  cellToString,
  detectTextKind,
  tableFromJson,
  tableFromMatrix,
  tableToCsvRows,
  tableToJson,
  tableToXlsxRows,
} from './convert';
import { Delimiter, Workbook, decodeText, parseCsv, readWorkbook, unparseCsv, writeXlsx } from './convert-io';
import { CJ_DICTIONARIES } from './csv-json-converter.i18n';
import { SendTo } from '../../shared/send-to';
import { ToolHandoff } from '../../shared/tool-handoff';

type InputKind = 'auto' | 'csv' | 'json';
type Target = 'csv' | 'json' | 'xlsx';
type DelimChoice = 'auto' | ',' | ';' | '\t';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_SHOWN = 300_000;
const PREVIEW_ROWS = 20;
const PREVIEW_COLS = 30;

interface Converted {
  table: Table | null;
  /** Testo del risultato (CSV o JSON); vuoto per l'Excel. */
  text: string;
  /** Separatore usato nel CSV in uscita. */
  delimiter: Delimiter;
  error: { code: string; detail: string } | null;
}

const EMPTY: Converted = { table: null, text: '', delimiter: ',', error: null };

@Component({
  selector: 'app-csv-json-converter',
  imports: [Icon, PrivacyNote, Segmented, IoPanel, CopyButton, FileDrop, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './csv-json-converter.page.html',
  styleUrl: './csv-json-converter.page.scss',
})
export class CsvJsonConverterPage {
  protected readonly i18n = inject(I18nService);

  protected readonly input = signal('');
  protected readonly inputKind = signal<InputKind>('auto');
  protected readonly target = signal<Target>('json');
  protected readonly delimiter = signal<DelimChoice>('auto');
  protected readonly header = signal(true);
  protected readonly typed = signal(true);
  protected readonly flatten = signal(true);
  protected readonly unflatten = signal(true);
  protected readonly shape = signal<JsonShape>('objects');
  protected readonly quoteAll = signal(false);
  protected readonly bom = signal(true);
  protected readonly neutralize = signal(true);

  /** File Excel caricato (la cartella di lavoro è già aperta). */
  protected readonly xlsx = signal<{ name: string; book: Workbook } | null>(null);
  protected readonly sheet = signal(0);
  protected readonly fileName = signal('');
  protected readonly fileError = signal<'size' | 'read' | null>(null);
  protected readonly result = signal<Converted>(EMPTY);

  protected readonly inputKinds = computed<SegmentOption<InputKind>[]>(() => [
    { value: 'auto', label: this.i18n.t('cj.kind.auto') },
    { value: 'csv', label: this.i18n.t('cj.kind.csv') },
    { value: 'json', label: this.i18n.t('cj.kind.json') },
  ]);
  protected readonly targets = computed<SegmentOption<Target>[]>(() => [
    { value: 'csv', label: this.i18n.t('cj.target.csv') },
    { value: 'json', label: this.i18n.t('cj.target.json') },
    { value: 'xlsx', label: this.i18n.t('cj.target.xlsx') },
  ]);
  protected readonly shapes = computed<SegmentOption<JsonShape>[]>(() => [
    { value: 'objects', label: this.i18n.t('cj.shape.objects') },
    { value: 'arrays', label: this.i18n.t('cj.shape.arrays') },
  ]);

  /** Il formato di ingresso effettivo: un file Excel, oppure quello scelto/rilevato per il testo. */
  protected readonly effectiveKind = computed<'xlsx' | 'csv' | 'json'>(() => {
    if (this.xlsx()) return 'xlsx';
    const k = this.inputKind();
    return k === 'auto' ? detectTextKind(this.input()) : k;
  });

  protected readonly table = computed(() => this.result().table);
  protected readonly outText = computed(() => this.result().text);
  protected readonly shownText = computed(() => {
    const t = this.outText();
    return t.length > MAX_SHOWN ? t.slice(0, MAX_SHOWN) : t;
  });
  protected readonly truncatedNote = computed(() => {
    const total = this.outText().length;
    if (total <= MAX_SHOWN) return '';
    const nf = new Intl.NumberFormat(this.i18n.locale());
    return this.i18n.t('cj.truncated', { shown: nf.format(MAX_SHOWN), total: nf.format(total) });
  });
  protected readonly errorMessage = computed(() => {
    const fe = this.fileError();
    if (fe) return this.i18n.t(`cj.file.err.${fe}`);
    const e = this.result().error;
    return e ? this.i18n.t(`cj.err.${e.code}`, { detail: e.detail }) : '';
  });
  protected readonly outputMeta = computed(() => {
    const t = this.outText();
    return t ? this.i18n.t('cj.out.counter', { chars: new Intl.NumberFormat(this.i18n.locale()).format(t.length) }) : '';
  });

  protected readonly previewHead = computed(() => this.table()?.columns.slice(0, PREVIEW_COLS) ?? []);
  protected readonly previewRows = computed<string[][]>(() => {
    const t = this.table();
    return t ? t.rows.slice(0, PREVIEW_ROWS).map((r) => r.slice(0, PREVIEW_COLS).map(cellToString)) : [];
  });
  protected readonly previewMeta = computed(() => {
    const t = this.table();
    if (!t) return '';
    const nf = new Intl.NumberFormat(this.i18n.locale());
    return this.i18n.t('cj.preview.meta', { rows: nf.format(t.rows.length), cols: nf.format(t.columns.length) });
  });
  protected readonly previewTruncated = computed(() => {
    const t = this.table();
    return !!t && (t.rows.length > PREVIEW_ROWS || t.columns.length > PREVIEW_COLS);
  });
  protected readonly previewMore = computed(() => {
    const t = this.table();
    if (!t) return '';
    return this.i18n.t('cj.preview.more', { shown: Math.min(PREVIEW_ROWS, t.rows.length), cols: Math.min(PREVIEW_COLS, t.columns.length) });
  });

  protected readonly ext = computed(() => ({ csv: '.csv', json: '.json', xlsx: '.xlsx' })[this.target()]);
  protected readonly canDownload = computed(() => this.table() !== null && !this.result().error);

  constructor() {
    this.i18n.register(CJ_DICTIONARIES);
    const rx = inject(ToolHandoff).take('csv-json-converter');
    if (rx?.text !== undefined) this.input.set(rx.text);
    // conversione a ogni cambio di ingresso o di opzione; le risposte superate vengono scartate
    effect((onCleanup) => {
      const snapshot = {
        text: this.input(),
        xlsx: this.xlsx(),
        sheet: this.sheet(),
        kind: this.effectiveKind(),
        target: this.target(),
        delim: this.delimiter(),
        header: this.header(),
        typed: this.typed(),
        flatten: this.flatten(),
        unflatten: this.unflatten(),
        shape: this.shape(),
        quoteAll: this.quoteAll(),
        neutralize: this.neutralize(),
      };
      let cancelled = false;
      onCleanup(() => (cancelled = true));
      const hasInput = snapshot.xlsx !== null || snapshot.text.trim() !== '';
      if (!hasInput) {
        this.result.set(EMPTY);
        return;
      }
      const timer = setTimeout(() => {
        convert(snapshot).then((r) => !cancelled && this.result.set(r));
      }, 120);
      onCleanup(() => clearTimeout(timer));
    });
  }

  protected onInput(e: Event): void {
    this.fileError.set(null);
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  protected onSheet(e: Event): void {
    this.sheet.set(Number((e.target as HTMLSelectElement).value));
  }

  protected async onFile(f: File): Promise<void> {
    this.fileError.set(null);
    if (f.size > MAX_FILE_BYTES) {
      this.fileError.set('size');
      return;
    }
    try {
      const buffer = await f.arrayBuffer();
      const ext = (f.name.split('.').pop() ?? '').toLowerCase();
      if (ext === 'xlsx' || ext === 'xls') {
        const book = await readWorkbook(buffer);
        if (book.sheets.length === 0) throw new Error('vuoto');
        this.sheet.set(0);
        this.input.set('');
        this.xlsx.set({ name: f.name, book });
      } else {
        this.xlsx.set(null);
        this.input.set(decodeText(buffer));
        this.inputKind.set(ext === 'json' ? 'json' : 'auto');
      }
      this.fileName.set(f.name);
    } catch {
      this.fileError.set('read');
    }
  }

  protected removeFile(): void {
    this.xlsx.set(null);
    this.fileName.set('');
    this.fileError.set(null);
  }

  protected clear(): void {
    this.input.set('');
    this.xlsx.set(null);
    this.fileName.set('');
    this.fileError.set(null);
    this.inputKind.set('auto');
  }

  protected loadSample(): void {
    this.xlsx.set(null);
    this.fileName.set('');
    this.inputKind.set('auto');
    this.input.set(this.i18n.t('cj.sample.csv'));
  }

  private baseName(): string {
    const n = this.fileName().replace(/\.[^./\\]+$/, '');
    return n || 'dati';
  }

  protected async download(): Promise<void> {
    const r = this.result();
    if (!r.table) return;
    const name = this.baseName() + this.ext();
    if (this.target() === 'xlsx') {
      try {
        const bytes = await writeXlsx(tableToXlsxRows(r.table, this.neutralize()));
        saveBytes(bytes, name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } catch {
        this.result.update((x) => ({ ...x, error: { code: 'xlsx', detail: '' } }));
      }
      return;
    }
    if (this.target() === 'csv') {
      const text = (this.bom() ? '﻿' : '') + r.text;
      saveBytes(new Blob([text], { type: 'text/csv;charset=utf-8' }), name, 'text/csv');
    } else {
      saveBytes(new Blob([r.text], { type: 'application/json;charset=utf-8' }), name, 'application/json');
    }
  }
}

interface Snapshot {
  text: string;
  xlsx: { name: string; book: Workbook } | null;
  sheet: number;
  kind: 'xlsx' | 'csv' | 'json';
  target: Target;
  delim: DelimChoice;
  header: boolean;
  typed: boolean;
  flatten: boolean;
  unflatten: boolean;
  shape: JsonShape;
  quoteAll: boolean;
  neutralize: boolean;
}

/** Lettura dell'ingresso e scrittura dell'uscita: l'unico punto in cui si usano PapaParse e SheetJS. */
async function convert(s: Snapshot): Promise<Converted> {
  try {
    let table: Table;
    let detected: Delimiter = ',';
    if (s.kind === 'xlsx' && s.xlsx) {
      table = tableFromMatrix(s.xlsx.book.read(s.sheet), { header: s.header, typed: false });
    } else if (s.kind === 'json') {
      table = tableFromJson(s.text, { flatten: s.flatten, header: s.header });
    } else {
      const parsed = await parseCsv(s.text, s.delim);
      detected = parsed.delimiter;
      table = tableFromMatrix(parsed.rows as Cell[][], { header: s.header, typed: s.typed });
    }
    const delimiter: Delimiter = s.delim === 'auto' ? detected : s.delim;
    if (s.target === 'json') return { table, text: tableToJson(table, s.shape, s.unflatten), delimiter, error: null };
    if (s.target === 'csv') {
      return { table, text: await unparseCsv(tableToCsvRows(table, s.neutralize), delimiter, s.quoteAll), delimiter, error: null };
    }
    return { table, text: '', delimiter, error: null };
  } catch (e) {
    if (e instanceof ConvertError) return { ...EMPTY, error: { code: e.code, detail: e.detail } };
    return { ...EMPTY, error: { code: 'empty', detail: '' } };
  }
}
