// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { FormatOptions, XmlError, domCheck, formatXml, minifyXml, xmlToJson } from './xml';
import { XML_DICTIONARIES } from './xml-formatter.i18n';
import { offsetOf } from '../yaml-json-converter/convert';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './xml-formatter.share';
import { SendTo } from '../../shared/send-to';
import { ToolHandoff } from '../../shared/tool-handoff';

type Mode = 'format' | 'minify' | 'json';
type IndentChoice = '2' | '4' | 'tab';

const MAX_FILE = 5 * 1024 * 1024;
const SAMPLE =
  '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Catalogo di esempio -->\n<catalogo xmlns:t="urn:esempio"><libro id="1" lingua="it"><titolo>Il barone rampante</titolo><autore>Italo Calvino</autore><nota><![CDATA[Prezzo < 10 & disponibile]]></nota></libro><libro id="2" lingua="en"><titolo>Invisible Cities</titolo><autore>Italo Calvino</autore><t:tag/></libro></catalogo>';

@Component({
  selector: 'app-xml-formatter',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, Segmented, CopyButton, FileDrop, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './xml-formatter.page.html',
  styleUrl: './xml-formatter.page.scss',
})
export class XmlFormatterPage {
  protected readonly i18n = inject(I18nService);
  private readonly inputEl = viewChild<ElementRef<HTMLTextAreaElement>>('inputEl');

  protected readonly mode = signal<Mode>('format');
  protected readonly indent = signal<IndentChoice>('2');
  protected readonly keepComments = signal(true);
  protected readonly input = signal('');
  protected readonly fileError = signal('');

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'format', label: this.i18n.t('xml.mode.format') },
    { value: 'minify', label: this.i18n.t('xml.mode.minify') },
    { value: 'json', label: this.i18n.t('xml.mode.json') },
  ]);
  protected readonly indents = computed<SegmentOption<IndentChoice>[]>(() => [
    { value: '2', label: this.i18n.t('xml.indent.2') },
    { value: '4', label: this.i18n.t('xml.indent.4') },
    { value: 'tab', label: this.i18n.t('xml.indent.tab') },
  ]);

  private readonly result = computed<{ ok: true; text: string } | { ok: false; error: XmlError } | null>(() => {
    const text = this.input();
    if (text.trim() === '') return null;
    const indent: FormatOptions['indent'] = this.indent() === 'tab' ? 'tab' : this.indent() === '4' ? 4 : 2;
    const opts: FormatOptions = { indent, keepComments: this.keepComments() };
    const mode = this.mode();
    if (mode === 'json') return xmlToJson(text, indent);
    const r = mode === 'format' ? formatXml(text, opts) : minifyXml(text, opts);
    if (!r.ok) return r;
    const second = domCheck(text); // seconda opinione del parser del browser
    return second ? { ok: false, error: second } : r;
  });
  protected readonly output = computed(() => {
    const r = this.result();
    return r?.ok ? r.text : '';
  });
  protected readonly errorText = computed(() => {
    const file = this.fileError();
    if (file) return file;
    const r = this.result();
    if (!r || r.ok) return '';
    const e = r.error;
    const msg = this.i18n.t('xml.err.' + e.code, { ...e.params, col: e.column, line: e.params['line'] ?? e.line });
    return e.code === 'noDom' ? msg : this.i18n.t('xml.err.at', { line: e.line, col: e.column, msg });
  });
  protected readonly errorPos = computed(() => {
    const r = this.result();
    return r && !r.ok && r.error.code !== 'noDom' ? r.error : null;
  });
  protected readonly note = computed(() => {
    const r = this.result();
    if (!r?.ok) return '';
    if (this.mode() === 'json') return this.i18n.t('xml.json.note');
    if (this.mode() === 'minify') {
      const from = this.input().length;
      const to = r.text.length;
      const pct = from > 0 ? Math.max(0, Math.round((1 - to / from) * 100)) : 0;
      return this.i18n.t('xml.saved', { from, to, pct });
    }
    return this.i18n.t('xml.ok');
  });
  protected readonly inputMeta = computed(() => this.meta(this.input()));
  protected readonly outputMeta = computed(() => this.meta(this.output()));

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode,
    indent: this.indent,
    keepComments: this.keepComments,
    input: this.input,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(XML_DICTIONARIES);
    const rx = inject(ToolHandoff).take('xml-formatter');
    if (rx?.text !== undefined) this.input.set(rx.text);
  }

  private meta(text: string): string {
    return text === '' ? '' : this.i18n.t('xml.meta', { lines: text.split('\n').length, chars: text.length });
  }

  protected onInput(e: Event): void {
    this.fileError.set('');
    this.input.set((e.target as HTMLTextAreaElement).value);
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
      this.fileError.set(this.i18n.t('xml.err.tooBig'));
      return;
    }
    try {
      this.input.set(await file.text());
    } catch {
      this.fileError.set(this.i18n.t('xml.err.read'));
    }
  }

  protected download(): void {
    const json = this.mode() === 'json';
    saveBytes(new TextEncoder().encode(this.output()), json ? 'converted.json' : 'formatted.xml', json ? 'application/json;charset=utf-8' : 'application/xml;charset=utf-8');
  }

  protected goToError(): void {
    const e = this.errorPos();
    const el = this.inputEl()?.nativeElement;
    if (!e || !el) return;
    const text = this.input().replace(/\r\n?/g, '\n');
    const at = offsetOf(text, e.line, e.column);
    el.focus();
    el.setSelectionRange(at, Math.min(at + 1, el.value.length));
  }
}
