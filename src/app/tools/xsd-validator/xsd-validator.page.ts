// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { XmlError } from '../xml-formatter/xml';
import { XML_DICTIONARIES } from '../xml-formatter/xml-formatter.i18n';
import { MAX_ISSUES, XsdIssue, XsdResult, validateXsd } from './xsd';
import { XSD_DICTIONARIES } from './xsd-validator.i18n';
import { SHARE_SCHEMA } from './xsd-validator.share';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const SAMPLE_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="ordine">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="cliente" type="xs:string"/>
        <xs:element name="riga" maxOccurs="unbounded">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="prodotto" type="xs:string"/>
              <xs:element name="quantita" type="xs:positiveInteger"/>
              <xs:element name="prezzo" type="Importo"/>
            </xs:sequence>
            <xs:attribute name="codice" type="Codice" use="required"/>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
      <xs:attribute name="data" type="xs:date" use="required"/>
    </xs:complexType>
  </xs:element>
  <xs:simpleType name="Codice">
    <xs:restriction base="xs:string"><xs:pattern value="[A-Z]{2}\\d{3}"/></xs:restriction>
  </xs:simpleType>
  <xs:simpleType name="Importo">
    <xs:restriction base="xs:decimal"><xs:minInclusive value="0"/><xs:fractionDigits value="2"/></xs:restriction>
  </xs:simpleType>
</xs:schema>
`;
const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ordine data="2026-13-01">
  <cliente>Mario Rossi</cliente>
  <riga codice="AB123">
    <prodotto>Penna</prodotto>
    <quantita>10</quantita>
    <prezzo>1.20</prezzo>
  </riga>
  <riga codice="X9">
    <prodotto>Quaderno</prodotto>
    <quantita>0</quantita>
    <prezzo>-2</prezzo>
  </riga>
  <nota>da consegnare</nota>
</ordine>
`;

type Side = 'xsd' | 'xml';

@Component({
  selector: 'app-xsd-validator',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, FileDrop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './xsd-validator.page.html',
  styleUrl: './xsd-validator.page.scss',
})
export class XsdValidatorPage {
  protected readonly i18n = inject(I18nService);
  protected readonly xsd = signal('');
  protected readonly xml = signal('');
  protected readonly fileError = signal('');
  protected readonly maxIssues = MAX_ISSUES;

  protected readonly result = computed<XsdResult | null>(() =>
    this.xsd().trim() === '' || this.xml().trim() === '' ? null : validateXsd(this.xsd(), this.xml()),
  );
  protected readonly issues = computed<XsdIssue[]>(() => {
    const r = this.result();
    return r?.ok ? r.issues : [];
  });
  protected readonly truncated = computed(() => {
    const r = this.result();
    return r?.ok === true && r.truncated;
  });
  protected readonly valid = computed(() => this.result()?.ok === true && this.issues().length === 0);
  protected readonly errorText = computed(() => {
    if (this.fileError()) return this.fileError();
    const r = this.result();
    if (!r || r.ok) return '';
    if (r.which === 'schema') return this.i18n.t(('xsd.schema.' + r.code) as 'xsd.schema.notSchema', r.params);
    return this.fmt(r.error, r.which === 'xsd' ? this.i18n.t('xsd.schemaSide') : this.i18n.t('xsd.docSide'));
  });

  private fmt(e: XmlError, side: string): string {
    const msg = this.i18n.t(('xml.err.' + e.code) as 'xml.err.badName', { ...e.params, col: e.column, line: e.params['line'] ?? e.line });
    return this.i18n.t('xsd.err.side', { side, line: e.line, col: e.column, msg });
  }

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { xsd: this.xsd, xml: this.xml };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(XML_DICTIONARIES);
    this.i18n.register(XSD_DICTIONARIES);
    const rx = inject(ToolHandoff).take('xsd-validator');
    if (rx?.text !== undefined) this.xml.set(rx.text);
  }

  protected message(i: XsdIssue): string {
    return this.i18n.t(('xsd.issue.' + i.code) as 'xsd.issue.missing', i.params);
  }

  protected onInput(e: Event, side: Side): void {
    this.fileError.set('');
    (side === 'xsd' ? this.xsd : this.xml).set((e.target as HTMLTextAreaElement).value);
  }

  protected loadSample(): void {
    this.fileError.set('');
    this.xsd.set(SAMPLE_XSD);
    this.xml.set(SAMPLE_XML);
  }

  protected clear(): void {
    this.fileError.set('');
    this.xsd.set('');
    this.xml.set('');
  }

  protected async onFile(file: File, side: Side): Promise<void> {
    this.fileError.set('');
    if (file.size > MAX_FILE_BYTES) {
      this.fileError.set(this.i18n.t('xml.err.tooBig'));
      return;
    }
    try {
      (side === 'xsd' ? this.xsd : this.xml).set(await file.text());
    } catch {
      this.fileError.set(this.i18n.t('xml.err.read'));
    }
  }

  protected meta(text: string): string {
    return text === '' ? '' : this.i18n.t('xml.meta', { lines: text.split('\n').length, chars: text.length });
  }
}
