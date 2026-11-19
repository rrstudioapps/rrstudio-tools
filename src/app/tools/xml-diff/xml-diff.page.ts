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
import { XML_DICTIONARIES } from '../xml-formatter/xml-formatter.i18n';
import { Change, DiffResult, MAX_CHANGES, diffXml, summarize } from './xml-diff';
import { XML_DIFF_DICTIONARIES } from './xml-diff.i18n';
import { SHARE_SCHEMA } from './xml-diff.share';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const SAMPLE_A = `<?xml version="1.0"?>
<catalogo aggiornato="2026-11-01">
  <libro id="1" lingua="it">
    <titolo>I promessi sposi</titolo>
    <prezzo>12.90</prezzo>
  </libro>
  <libro id="2" lingua="it">
    <titolo>Il nome della rosa</titolo>
    <prezzo>14.50</prezzo>
  </libro>
</catalogo>
`;
const SAMPLE_B = `<?xml version="1.0"?>
<catalogo aggiornato="2026-11-19" versione="2">
  <libro id="0" lingua="it">
    <titolo>Il Gattopardo</titolo>
    <prezzo>11.00</prezzo>
  </libro>
  <libro id="1" lingua="it">
    <titolo>I promessi sposi</titolo>
    <prezzo>13.50</prezzo>
  </libro>
  <libro id="2">
    <titolo>Il nome della rosa</titolo>
    <prezzo>14.50</prezzo>
    <note>Edizione tascabile</note>
  </libro>
</catalogo>
`;

type Side = 'a' | 'b';

@Component({
  selector: 'app-xml-diff',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, FileDrop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './xml-diff.page.html',
  styleUrl: './xml-diff.page.scss',
})
export class XmlDiffPage {
  protected readonly i18n = inject(I18nService);
  protected readonly a = signal('');
  protected readonly b = signal('');
  protected readonly ignoreWs = signal(true);
  protected readonly fileError = signal('');
  protected readonly maxChanges = MAX_CHANGES;

  protected readonly result = computed<DiffResult | null>(() =>
    this.a().trim() === '' || this.b().trim() === '' ? null : diffXml(this.a(), this.b(), { ignoreWhitespace: this.ignoreWs() }),
  );
  protected readonly changes = computed<Change[]>(() => {
    const r = this.result();
    return r?.ok ? r.changes : [];
  });
  protected readonly truncated = computed(() => {
    const r = this.result();
    return r?.ok === true && r.truncated;
  });
  protected readonly summary = computed(() => summarize(this.changes()));
  protected readonly same = computed(() => this.result()?.ok === true && this.changes().length === 0);
  protected readonly errorText = computed(() => {
    if (this.fileError()) return this.fileError();
    const r = this.result();
    if (!r || r.ok) return '';
    const e = r.error;
    const msg = this.i18n.t(('xml.err.' + e.code) as 'xml.err.badName', { ...e.params, col: e.column, line: e.params['line'] ?? e.line });
    return this.i18n.t('xd.err.side', { side: this.i18n.t(r.side === 'a' ? 'xd.a' : 'xd.b'), line: e.line, col: e.column, msg });
  });

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { a: this.a, b: this.b, ignoreWs: this.ignoreWs };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(XML_DICTIONARIES);
    this.i18n.register(XML_DIFF_DICTIONARIES);
    const rx = inject(ToolHandoff).take('xml-diff');
    if (rx?.text !== undefined) this.a.set(rx.text);
  }

  protected onInput(e: Event, side: Side): void {
    this.fileError.set('');
    (side === 'a' ? this.a : this.b).set((e.target as HTMLTextAreaElement).value);
  }

  protected loadSample(): void {
    this.fileError.set('');
    this.a.set(SAMPLE_A);
    this.b.set(SAMPLE_B);
  }

  protected swap(): void {
    const t = this.a();
    this.a.set(this.b());
    this.b.set(t);
  }

  protected clear(): void {
    this.fileError.set('');
    this.a.set('');
    this.b.set('');
  }

  protected async onFile(file: File, side: Side): Promise<void> {
    this.fileError.set('');
    if (file.size > MAX_FILE_BYTES) {
      this.fileError.set(this.i18n.t('xml.err.tooBig'));
      return;
    }
    try {
      (side === 'a' ? this.a : this.b).set(await file.text());
    } catch {
      this.fileError.set(this.i18n.t('xml.err.read'));
    }
  }

  protected kindLabel(c: Change): string {
    return this.i18n.t(('xd.kind.' + c.kind) as 'xd.kind.added');
  }

  protected tone(c: Change): string {
    return c.kind === 'added' || c.kind === 'attr-added' ? 'add' : c.kind === 'removed' || c.kind === 'attr-removed' ? 'del' : 'chg';
  }

  protected meta(text: string): string {
    return text === '' ? '' : this.i18n.t('xml.meta', { lines: text.split('\n').length, chars: text.length });
  }
}
