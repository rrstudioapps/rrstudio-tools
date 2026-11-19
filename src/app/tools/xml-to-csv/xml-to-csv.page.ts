// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { Delimiter, unparseCsv } from '../csv-json-converter/convert-io';
import { tableToCsvRows } from '../csv-json-converter/convert';
import { XmlError, XmlNode, normalizeNewlines, parseXml } from '../xml-formatter/xml';
import { XML_DICTIONARIES } from '../xml-formatter/xml-formatter.i18n';
import { buildTable, findRepeating } from './xml-table';
import { XML_TO_CSV_DICTIONARIES } from './xml-to-csv.i18n';
import { SHARE_SCHEMA } from './xml-to-csv.share';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PREVIEW_ROWS = 50;
const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<catalogo>
  <libro id="b1" lingua="it">
    <titolo>I promessi sposi</titolo>
    <autore>Alessandro Manzoni</autore>
    <anno>1827</anno>
    <prezzo valuta="EUR">12.90</prezzo>
  </libro>
  <libro id="b2" lingua="it">
    <titolo>Il nome della rosa</titolo>
    <autore>Umberto Eco</autore>
    <anno>1980</anno>
    <prezzo valuta="EUR">14.50</prezzo>
  </libro>
  <libro id="b3" lingua="en">
    <titolo>Invisible Cities</titolo>
    <autore>Italo Calvino</autore>
    <anno>1972</anno>
    <prezzo valuta="USD">11.00</prezzo>
  </libro>
</catalogo>
`;

@Component({
  selector: 'app-xml-to-csv',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, FileDrop, CopyButton, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './xml-to-csv.page.html',
  styleUrl: './xml-to-csv.page.scss',
})
export class XmlToCsvPage {
  protected readonly i18n = inject(I18nService);
  protected readonly input = signal('');
  /** Elemento scelto per i record; se vuoto o non più valido si usa il più numeroso. */
  protected readonly record = signal('');
  protected readonly attrs = signal(true);
  protected readonly depth = signal('3');
  protected readonly typed = signal(false);
  protected readonly delimiter = signal<Delimiter>(',');
  protected readonly neutralize = signal(true);
  protected readonly fileError = signal('');
  protected readonly csv = signal('');
  protected readonly delimiters: { value: Delimiter; key: string }[] = [
    { value: ',', key: 'x2c.d.comma' },
    { value: ';', key: 'x2c.d.semi' },
    { value: '\t', key: 'x2c.d.tab' },
    { value: '|', key: 'x2c.d.pipe' },
  ];
  protected readonly depths = ['1', '2', '3', '4', '5'];

  private readonly parsed = computed<{ ok: true; nodes: XmlNode[] } | { ok: false; error: XmlError } | null>(() => {
    const src = this.input();
    if (src.trim() === '') return null;
    const r = parseXml(normalizeNewlines(src));
    return r.ok ? { ok: true, nodes: r.nodes } : r;
  });
  protected readonly candidates = computed(() => {
    const p = this.parsed();
    return p?.ok ? findRepeating(p.nodes) : [];
  });
  protected readonly selected = computed(() => {
    const c = this.candidates();
    return c.some((x) => x.path === this.record()) ? this.record() : (c[0]?.path ?? '');
  });
  protected readonly built = computed(() => {
    const p = this.parsed();
    const sel = this.selected();
    if (!p?.ok || !sel) return null;
    return buildTable(p.nodes, sel, { attrs: this.attrs(), depth: Number(this.depth()), typed: this.typed() });
  });
  protected readonly table = computed(() => this.built()?.table ?? null);
  protected readonly preview = computed(() => this.table()?.rows.slice(0, PREVIEW_ROWS) ?? []);
  protected readonly errorText = computed(() => {
    if (this.fileError()) return this.fileError();
    const p = this.parsed();
    if (!p || p.ok) return '';
    const e = p.error;
    const msg = this.i18n.t(('xml.err.' + e.code) as 'xml.err.badName', { ...e.params, col: e.column, line: e.params['line'] ?? e.line });
    return this.i18n.t('xml.err.at', { line: e.line, col: e.column, msg });
  });
  protected readonly noRecords = computed(() => this.parsed()?.ok === true && this.candidates().length === 0);
  protected readonly meta = computed(() => {
    const t = this.table();
    return t ? this.i18n.t('x2c.meta', { rows: t.rows.length, cols: t.columns.length }) : '';
  });

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    input: this.input,
    record: this.record,
    attrs: this.attrs,
    depth: this.depth,
    typed: this.typed,
    delimiter: this.delimiter,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  private seq = 0;

  constructor() {
    this.i18n.register(XML_DICTIONARIES);
    this.i18n.register(XML_TO_CSV_DICTIONARIES);
    const rx = inject(ToolHandoff).take('xml-to-csv');
    if (rx?.text !== undefined) this.input.set(rx.text);
    // il testo CSV si prepara in modo asincrono (papaparse si carica solo quando serve)
    effect(() => {
      const t = this.table();
      const d = this.delimiter();
      const neutral = this.neutralize();
      const n = ++this.seq;
      if (!t) {
        untracked(() => this.csv.set(''));
        return;
      }
      void unparseCsv(tableToCsvRows(t, neutral), d, false).then((out) => {
        if (n === this.seq) this.csv.set(out);
      });
    });
    inject(DestroyRef).onDestroy(() => this.seq++);
  }

  protected onInput(e: Event): void {
    this.fileError.set('');
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  protected setRecord(e: Event): void {
    this.record.set((e.target as HTMLSelectElement).value);
  }

  protected setDelimiter(e: Event): void {
    this.delimiter.set((e.target as HTMLSelectElement).value as Delimiter);
  }

  protected loadSample(): void {
    this.fileError.set('');
    this.record.set('');
    this.input.set(SAMPLE);
  }

  protected clear(): void {
    this.fileError.set('');
    this.record.set('');
    this.input.set('');
  }

  protected async onFile(file: File): Promise<void> {
    this.fileError.set('');
    if (file.size > MAX_FILE_BYTES) {
      this.fileError.set(this.i18n.t('xml.err.tooBig'));
      return;
    }
    try {
      this.record.set('');
      this.input.set(await file.text());
    } catch {
      this.fileError.set(this.i18n.t('xml.err.read'));
    }
  }

  protected download(): void {
    if (this.csv()) saveBytes(new TextEncoder().encode('﻿' + this.csv()), 'tabella.csv', 'text/csv;charset=utf-8');
  }

  protected cell(c: string | number | boolean | null): string {
    return c === null ? '' : String(c);
  }
}
