// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { XML_DICTIONARIES } from '../xml-formatter/xml-formatter.i18n';
import { ToolHandoff } from '../../shared/tool-handoff';
import { DEFAULT_OPTIONS, ConvertError, XmlJsonOptions, jsonToXml, xmlToJson } from './xml-json';
import { SHARE_SCHEMA } from './xml-json-converter.share';
import { XML_JSON_DICTIONARIES } from './xml-json-converter.i18n';

type Mode = 'x2j' | 'j2x';
const MAX_FILE = 5 * 1024 * 1024;
const SAMPLES: Record<Mode, string> = {
  x2j: '<?xml version="1.0" encoding="UTF-8"?>\n<catalogo lingua="it">\n  <libro id="1" disponibile="true">\n    <titolo>Il nome della rosa</titolo>\n    <autore>Umberto Eco</autore>\n    <prezzo valuta="EUR">12.50</prezzo>\n  </libro>\n  <libro id="2">\n    <titolo>Se questo è un uomo</titolo>\n    <autore>Primo Levi</autore>\n    <prezzo valuta="EUR">9</prezzo>\n  </libro>\n</catalogo>\n',
  j2x: '{\n  "catalogo": {\n    "@lingua": "it",\n    "libro": [\n      { "@id": "1", "titolo": "Il nome della rosa", "autore": "Umberto Eco", "prezzo": { "@valuta": "EUR", "#text": "12.50" } },\n      { "@id": "2", "titolo": "Se questo è un uomo", "autore": "Primo Levi", "prezzo": null }\n    ]\n  }\n}\n',
};

interface ErrorInfo {
  title: string;
  text: string;
  line?: number;
  column?: number;
}

@Component({
  selector: 'app-xml-json-converter',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, Segmented, CopyButton, FileDrop, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './xml-json-converter.page.html',
  styleUrl: './xml-json-converter.page.scss',
})
export class XmlJsonConverterPage {
  protected readonly i18n = inject(I18nService);
  private readonly inputEl = viewChild<ElementRef<HTMLTextAreaElement>>('inputEl');

  protected readonly mode = signal<Mode>('x2j');
  protected readonly attrPrefix = signal<'@' | '_' | '$'>('@');
  protected readonly forceArrays = signal(false);
  protected readonly infer = signal(false);
  protected readonly indent = signal<'0' | '2' | '4'>('2');
  protected readonly declaration = signal(true);
  protected readonly rootName = signal('root');
  protected readonly input = signal('');
  protected readonly fileError = signal('');

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'x2j', label: this.i18n.t('xj.mode.x2j') },
    { value: 'j2x', label: this.i18n.t('xj.mode.j2x') },
  ]);
  protected readonly prefixes = computed<SegmentOption<'@' | '_' | '$'>[]>(() => [
    { value: '@', label: '@' },
    { value: '_', label: '_' },
    { value: '$', label: '$' },
  ]);
  protected readonly indents = computed<SegmentOption<'0' | '2' | '4'>[]>(() => [
    { value: '2', label: this.i18n.t('xj.indent.2') },
    { value: '4', label: this.i18n.t('xj.indent.4') },
    { value: '0', label: this.i18n.t('xj.indent.0') },
  ]);

  private readonly options = computed<XmlJsonOptions>(() => ({
    ...DEFAULT_OPTIONS,
    attrPrefix: this.attrPrefix(),
    forceArrays: this.forceArrays(),
    infer: this.infer(),
    indent: Number(this.indent()),
    declaration: this.declaration(),
    rootName: this.rootName().trim() || 'root',
  }));

  private readonly result = computed(() => {
    const text = this.input();
    if (text.trim() === '') return null;
    return this.mode() === 'x2j' ? xmlToJson(text, this.options()) : jsonToXml(text, this.options());
  });
  protected readonly output = computed(() => {
    const r = this.result();
    return r?.ok ? r.text : '';
  });
  protected readonly error = computed<ErrorInfo | null>(() => {
    const file = this.fileError();
    if (file) return { title: '', text: file };
    const r = this.result();
    if (!r || r.ok) return null;
    return this.describe(r.error);
  });
  protected readonly note = computed(() => (this.result()?.ok ? this.i18n.t('xj.ok.' + this.mode()) : ''));
  protected readonly inputMeta = computed(() => this.meta(this.input()));
  protected readonly outputMeta = computed(() => this.meta(this.output()));

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode,
    attrPrefix: this.attrPrefix,
    forceArrays: this.forceArrays,
    infer: this.infer,
    indent: this.indent,
    declaration: this.declaration,
    rootName: this.rootName,
    input: this.input,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(XML_DICTIONARIES);
    this.i18n.register(XML_JSON_DICTIONARIES);
    const rx = inject(ToolHandoff).take('xml-json-converter');
    if (rx?.text !== undefined) {
      this.mode.set(rx.kind === 'json' ? 'j2x' : 'x2j');
      this.input.set(rx.text);
    }
  }

  private describe(e: ConvertError): ErrorInfo {
    if (e.stage === 'xml') {
      const key = 'xml.err.' + e.error.code;
      const msg = this.i18n.has(key) ? this.i18n.t(key, e.error.params) : e.error.code;
      return { title: this.i18n.t('xj.err.xml'), line: e.error.line, column: e.error.column, text: this.i18n.t('xj.err.at', { line: e.error.line, col: e.error.column, msg }) };
    }
    if (e.stage === 'json') {
      const title = this.i18n.t('xj.err.json');
      if (e.line !== undefined && e.column !== undefined) {
        return { title, line: e.line, column: e.column, text: this.i18n.t('xj.err.at', { line: e.line, col: e.column, msg: e.message }) };
      }
      return { title, text: e.message };
    }
    return { title: this.i18n.t('xj.err.write'), text: this.i18n.t('xj.err.' + e.code, { path: e.path, name: e.detail ?? '' }) };
  }

  private meta(text: string): string {
    return text === '' ? '' : this.i18n.t('xj.meta', { lines: text.split('\n').length, chars: text.length });
  }

  protected onInput(e: Event): void {
    this.fileError.set('');
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  /** Scambia i versi e porta il risultato come nuovo ingresso. */
  protected swap(): void {
    const out = this.output();
    this.mode.update((m) => (m === 'x2j' ? 'j2x' : 'x2j'));
    if (out) this.input.set(out);
  }

  protected loadSample(): void {
    this.fileError.set('');
    this.input.set(SAMPLES[this.mode()]);
  }

  protected clear(): void {
    this.fileError.set('');
    this.input.set('');
  }

  protected async onFile(file: File): Promise<void> {
    this.fileError.set('');
    if (file.size > MAX_FILE) {
      this.fileError.set(this.i18n.t('xj.err.tooBig'));
      return;
    }
    try {
      const text = await file.text();
      if (/\.json$/i.test(file.name)) this.mode.set('j2x');
      else if (/\.(xml|svg|rss|atom|xsd|xslt?)$/i.test(file.name)) this.mode.set('x2j');
      this.input.set(text);
    } catch {
      this.fileError.set(this.i18n.t('xj.err.read'));
    }
  }

  protected download(): void {
    const j = this.mode() === 'x2j';
    saveBytes(new TextEncoder().encode(this.output()), j ? 'converted.json' : 'converted.xml', (j ? 'application/json' : 'application/xml') + ';charset=utf-8');
  }

  protected goToError(): void {
    const e = this.error();
    const el = this.inputEl()?.nativeElement;
    if (!e?.line || !e.column || !el) return;
    const lines = this.input().split('\n');
    let at = 0;
    for (let i = 0; i < e.line - 1 && i < lines.length; i++) at += lines[i].length + 1;
    at = Math.min(at + e.column - 1, this.input().length);
    el.focus();
    el.setSelectionRange(at, Math.min(at + 1, this.input().length));
  }
}
