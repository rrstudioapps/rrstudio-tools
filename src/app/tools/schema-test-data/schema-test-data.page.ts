// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { randomSeedText } from '../fake-data-generator/fake-data';
import { JSON_SCHEMA_XSD_DICTIONARIES } from '../json-schema-xsd/json-schema-xsd.i18n';
import { XML_DICTIONARIES } from '../xml-formatter/xml-formatter.i18n';
import { MAX_RECORDS, OutFormat, detectKind, generateRecords, renderRecords } from './schema-data';
import { SCHEMA_TEST_DATA_DICTIONARIES } from './schema-test-data.i18n';
import { SHARE_SCHEMA } from './schema-test-data.share';

type Prefix = '@' | '_' | '$';
const MAX_FILE = 5 * 1024 * 1024;
const OWN_WARNINGS = new Set(['patternUnsupported', 'rangeEmpty', 'lengthUnmet', 'uniqueUnmet']);
const SAMPLE = JSON.stringify(
  {
    type: 'object',
    properties: {
      id: { type: 'integer', minimum: 1000, maximum: 9999 },
      nome: { type: 'string' },
      cognome: { type: 'string' },
      email: { type: 'string', format: 'email' },
      citta: { type: 'string' },
      iscritto: { type: 'string', format: 'date' },
      codice: { type: 'string', pattern: '^[A-Z]{3}-\\d{4}$' },
      piano: { enum: ['base', 'plus', 'pro'] },
      credito: { type: 'number', minimum: 0, maximum: 100, multipleOf: 0.5 },
      attivo: { type: 'boolean' },
      tag: { type: 'array', items: { type: 'string', minLength: 3, maxLength: 8 }, minItems: 1, maxItems: 3 },
    },
    required: ['id', 'nome', 'cognome', 'email', 'citta', 'iscritto', 'codice', 'piano', 'credito', 'attivo'],
  },
  null,
  2,
);

@Component({
  selector: 'app-schema-test-data',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, Segmented, CopyButton, FileDrop, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schema-test-data.page.html',
  styleUrl: './schema-test-data.page.scss',
})
export class SchemaTestDataPage {
  protected readonly i18n = inject(I18nService);
  protected readonly maxRecords = MAX_RECORDS;
  protected readonly input = signal('');
  protected readonly seed = signal('1234');
  protected readonly count = signal('5');
  protected readonly format = signal<OutFormat>('json');
  protected readonly attrPrefix = signal<Prefix>('@');
  protected readonly fileError = signal('');

  protected readonly formats: SegmentOption<OutFormat>[] = [
    { value: 'json', label: 'JSON' },
    { value: 'xml', label: 'XML' },
    { value: 'csv', label: 'CSV' },
  ];
  protected readonly prefixes: SegmentOption<Prefix>[] = [
    { value: '@', label: '@' },
    { value: '_', label: '_' },
    { value: '$', label: '$' },
  ];

  protected readonly kind = computed(() => detectKind(this.input()));

  private readonly generated = computed(() => {
    const t = this.input();
    if (t.trim() === '') return null;
    const n = Math.floor(Number(this.count()));
    return generateRecords(t, { seed: this.seed(), count: Number.isFinite(n) && n >= 1 ? n : 1, attrPrefix: this.attrPrefix(), textKey: '#text' });
  });
  private readonly rendered = computed(() => {
    const g = this.generated();
    if (!g?.ok) return null;
    return renderRecords(g.records, this.format(), { attrPrefix: this.attrPrefix(), textKey: '#text', indent: 2 });
  });
  protected readonly output = computed(() => {
    const r = this.rendered();
    return r?.ok ? r.text : '';
  });
  protected readonly recordCount = computed(() => {
    const g = this.generated();
    return g?.ok ? g.records.length : 0;
  });
  protected readonly warnings = computed(() => {
    const g = this.generated();
    return g?.ok ? g.warnings : [];
  });
  protected readonly warningTexts = computed(() =>
    this.warnings().map((w) => ({
      text: this.i18n.t((OWN_WARNINGS.has(w.code) ? 'st.w.' + w.code : 'sx.w.' + w.code) as 'sx.w.ignored', { detail: w.detail ?? '' }),
      path: w.path,
    })),
  );
  protected readonly errorText = computed(() => {
    if (this.fileError()) return this.fileError();
    const g = this.generated();
    if (g && !g.ok) {
      const e = g.error;
      if (e.kind === 'xml') {
        const msg = this.i18n.t(('xml.err.' + e.xml.code) as 'xml.err.badName', { ...e.xml.params, col: e.xml.column, line: e.xml.params['line'] ?? e.xml.line });
        return this.i18n.t('sx.err.at', { line: e.xml.line, col: e.xml.column, msg });
      }
      if (e.kind === 'json') return e.line !== null ? this.i18n.t('sx.err.at', { line: e.line, col: e.column ?? 1, msg: e.message }) : e.message;
      return this.i18n.t('sx.err.' + e.code);
    }
    const r = this.rendered();
    if (r && !r.ok) return this.i18n.t('st.err.' + r.code, { detail: r.detail ?? '' });
    return '';
  });

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { input: this.input, seed: this.seed, count: this.count, format: this.format, attrPrefix: this.attrPrefix };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(XML_DICTIONARIES);
    this.i18n.register(JSON_SCHEMA_XSD_DICTIONARIES);
    this.i18n.register(SCHEMA_TEST_DATA_DICTIONARIES);
    const rx = inject(ToolHandoff).take('schema-test-data');
    if (rx?.text !== undefined) this.input.set(rx.text);
  }

  protected onInput(e: Event): void {
    this.fileError.set('');
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  protected newSeed(): void {
    this.seed.set(randomSeedText());
  }

  protected loadSample(): void {
    this.fileError.set('');
    this.input.set(SAMPLE);
  }

  protected clear(): void {
    this.fileError.set('');
    this.input.set('');
  }

  protected async onFile(file: File): Promise<void> {
    this.fileError.set('');
    if (file.size > MAX_FILE) {
      this.fileError.set(this.i18n.t('sx.err.tooBig'));
      return;
    }
    try {
      this.input.set(await file.text());
    } catch {
      this.fileError.set(this.i18n.t('sx.err.read'));
    }
  }

  protected download(): void {
    const out = this.output();
    if (!out) return;
    const f = this.format();
    const type = f === 'json' ? 'application/json' : f === 'xml' ? 'application/xml' : 'text/csv';
    const url = URL.createObjectURL(new Blob([out], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `dati-prova.${f}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  protected meta(text: string): string {
    return text === '' ? '' : this.i18n.t('sx.meta', { lines: text.split('\n').length, chars: text.length });
  }
}
