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
import { XML_DICTIONARIES } from '../xml-formatter/xml-formatter.i18n';
import { ConvResult, jsonSchemaToXsd, xsdToJsonSchema } from './schema-convert';
import { JSON_SCHEMA_XSD_DICTIONARIES } from './json-schema-xsd.i18n';
import { SHARE_SCHEMA } from './json-schema-xsd.share';

type Mode = 'j2x' | 'x2j';
const MAX_FILE = 5 * 1024 * 1024;
const SAMPLE_JSON = JSON.stringify(
  {
    type: 'object',
    properties: {
      ordine: {
        type: 'object',
        properties: {
          '@data': { type: 'string', format: 'date' },
          cliente: { type: 'string', minLength: 1 },
          stato: { enum: ['nuovo', 'spedito'] },
          riga: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: { '@n': { type: 'integer' }, sku: { type: 'string', pattern: '^[A-Z]{3}-\\d{4}$' }, qta: { type: 'integer', minimum: 1 }, nota: { type: 'string' } },
              required: ['@n', 'sku', 'qta'],
            },
          },
        },
        required: ['cliente', 'stato', 'riga'],
        uniqueItems: true,
      },
    },
    required: ['ordine'],
  },
  null,
  2,
);
const SAMPLE_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="ordine">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="cliente" type="xs:string"/>
        <xs:element name="riga" maxOccurs="unbounded">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="sku" type="Sku"/>
              <xs:element name="qta" type="xs:positiveInteger"/>
              <xs:element name="nota" type="xs:string" minOccurs="0"/>
            </xs:sequence>
            <xs:attribute name="n" type="xs:int" use="required"/>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
      <xs:attribute name="data" type="xs:date"/>
    </xs:complexType>
  </xs:element>
  <xs:simpleType name="Sku">
    <xs:restriction base="xs:string">
      <xs:pattern value="[A-Z]{3}-\\d{4}"/>
    </xs:restriction>
  </xs:simpleType>
</xs:schema>
`;

@Component({
  selector: 'app-json-schema-xsd',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, Segmented, CopyButton, FileDrop, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './json-schema-xsd.page.html',
  styleUrl: './json-schema-xsd.page.scss',
})
export class JsonSchemaXsdPage {
  protected readonly i18n = inject(I18nService);
  protected readonly mode = signal<Mode>('j2x');
  protected readonly input = signal('');
  protected readonly attrPrefix = signal<'@' | '_' | '$'>('@');
  protected readonly rootName = signal('root');
  protected readonly indent = signal<'2' | '4'>('2');
  protected readonly fileError = signal('');

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'j2x', label: this.i18n.t('sx.m.j2x') },
    { value: 'x2j', label: this.i18n.t('sx.m.x2j') },
  ]);
  protected readonly prefixes = computed<SegmentOption<'@' | '_' | '$'>[]>(() => [
    { value: '@', label: '@' },
    { value: '_', label: '_' },
    { value: '$', label: '$' },
  ]);
  protected readonly indents = computed<SegmentOption<'2' | '4'>[]>(() => [
    { value: '2', label: '2' },
    { value: '4', label: '4' },
  ]);

  private readonly result = computed<ConvResult | null>(() => {
    const t = this.input();
    if (t.trim() === '') return null;
    const o = { attrPrefix: this.attrPrefix(), rootName: this.rootName().trim() || 'root', indent: Number(this.indent()) as 2 | 4 };
    return this.mode() === 'j2x' ? jsonSchemaToXsd(t, o) : xsdToJsonSchema(t, o);
  });
  protected readonly output = computed(() => {
    const r = this.result();
    return r?.ok ? r.text : '';
  });
  protected readonly warnings = computed(() => {
    const r = this.result();
    return r?.ok ? r.warnings : [];
  });
  protected readonly warningTexts = computed(() =>
    this.warnings().map((w) => ({
      text: this.i18n.t(('sx.w.' + w.code) as 'sx.w.ignored', { detail: w.detail ?? '' }),
      path: w.path,
    })),
  );
  protected readonly error = computed(() => this.fileError() !== '' || (this.result() !== null && !this.result()?.ok));
  protected readonly errorText = computed(() => {
    if (this.fileError()) return this.fileError();
    const r = this.result();
    if (!r || r.ok) return '';
    const e = r.error;
    if (e.kind === 'xml') {
      const msg = this.i18n.t(('xml.err.' + e.xml.code) as 'xml.err.badName', { ...e.xml.params, col: e.xml.column, line: e.xml.params['line'] ?? e.xml.line });
      return this.i18n.t('sx.err.at', { line: e.xml.line, col: e.xml.column, msg });
    }
    if (e.kind === 'json') return e.line !== null ? this.i18n.t('sx.err.at', { line: e.line, col: e.column ?? 1, msg: e.message }) : e.message;
    return this.i18n.t('sx.err.' + e.code);
  });

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { mode: this.mode, input: this.input, attrPrefix: this.attrPrefix, rootName: this.rootName, indent: this.indent };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(XML_DICTIONARIES);
    this.i18n.register(JSON_SCHEMA_XSD_DICTIONARIES);
    const rx = inject(ToolHandoff).take('json-schema-xsd');
    if (rx?.text !== undefined) {
      this.input.set(rx.text);
      if (/^\s*</.test(rx.text)) this.mode.set('x2j');
    }
  }

  protected onInput(e: Event): void {
    this.fileError.set('');
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  protected loadSample(): void {
    this.fileError.set('');
    this.input.set(this.mode() === 'j2x' ? SAMPLE_JSON : SAMPLE_XSD);
  }

  protected clear(): void {
    this.fileError.set('');
    this.input.set('');
  }

  /** Il risultato diventa il testo di partenza e la direzione si inverte. */
  protected swap(): void {
    const out = this.output();
    if (out === '') return;
    this.mode.set(this.mode() === 'j2x' ? 'x2j' : 'j2x');
    this.input.set(out);
  }

  protected async onFile(file: File): Promise<void> {
    this.fileError.set('');
    if (file.size > MAX_FILE) {
      this.fileError.set(this.i18n.t('sx.err.tooBig'));
      return;
    }
    try {
      const text = await file.text();
      if (/\.(xsd|xml)$/i.test(file.name)) this.mode.set('x2j');
      else if (/\.json$/i.test(file.name)) this.mode.set('j2x');
      this.input.set(text);
    } catch {
      this.fileError.set(this.i18n.t('sx.err.read'));
    }
  }

  protected download(): void {
    const out = this.output();
    if (!out) return;
    const j2x = this.mode() === 'j2x';
    const url = URL.createObjectURL(new Blob([out], { type: j2x ? 'application/xml' : 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = j2x ? 'schema.xsd' : 'schema.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  protected meta(text: string): string {
    return text === '' ? '' : this.i18n.t('sx.meta', { lines: text.split('\n').length, chars: text.length });
  }
}
