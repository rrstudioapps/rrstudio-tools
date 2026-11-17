// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { formatBytes, textStats } from '../../shared/text-stats';
import { JSON_FORMATTER_DICTIONARIES } from './json-formatter.i18n';
import { Indent, JsonToken, formatJson, jsonStats, minifyJson, parseJson, tokenizeJson } from './json-tools';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './json-formatter.share';

type Action = 'format' | 'minify';
type IndentChoice = '2' | '4' | 'tab';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Oltre questa lunghezza l'output non viene evidenziato (troppi nodi nel DOM). */
const MAX_HIGHLIGHT = 150_000;
/** Altezza di riga e padding verticale della textarea: devono coincidere con lo SCSS. */
const LINE_H = 20;
const PAD_Y = 12;

const SAMPLE =
  '{"nome":"Mario Rossi","eta":34,"attivo":true,"punteggio":4.5,' +
  '"indirizzo":{"via":"Via Roma 1","citta":"Milano","cap":"20121"},' +
  '"tag":["dev","json","test"],"note":null,"ordini":[{"id":2,"totale":19.9},{"id":1,"totale":5}]}';

@Component({
  selector: 'app-json-formatter',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, IoPanel, CopyButton, FileDrop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './json-formatter.page.html',
  styleUrl: './json-formatter.page.scss',
})
export class JsonFormatterPage {
  protected readonly i18n = inject(I18nService);

  protected readonly input = signal('');
  protected readonly action = signal<Action>('format');
  protected readonly indent = signal<IndentChoice>('2');
  protected readonly sortKeys = signal(false);
  protected readonly scrollTop = signal(0);
  private readonly fileError = signal<'toolarge' | 'read' | null>(null);

  protected readonly actions = computed<SegmentOption<Action>[]>(() => [
    { value: 'format', label: this.i18n.t('json.action.format') },
    { value: 'minify', label: this.i18n.t('json.action.minify') },
  ]);
  protected readonly indents = computed<SegmentOption<IndentChoice>[]>(() => [
    { value: '2', label: this.i18n.t('json.indent.2') },
    { value: '4', label: this.i18n.t('json.indent.4') },
    { value: 'tab', label: this.i18n.t('json.indent.tab') },
  ]);

  private readonly parsed = computed(() => {
    const text = this.input();
    return text.trim() === '' ? null : parseJson(text);
  });

  protected readonly output = computed(() => {
    const p = this.parsed();
    if (!p || !p.ok) return '';
    if (this.action() === 'minify') return minifyJson(p.value, this.sortKeys());
    const ind = this.indent();
    return formatJson(p.value, (ind === 'tab' ? 'tab' : Number(ind)) as Indent, this.sortKeys());
  });

  protected readonly tokens = computed<JsonToken[] | null>(() => {
    const out = this.output();
    return out && out.length <= MAX_HIGHLIGHT ? tokenizeJson(out) : null;
  });

  protected readonly errorLine = computed(() => {
    const p = this.parsed();
    return p && !p.ok ? p.error.line : null;
  });

  /** Riga di stato: o "valido" con le statistiche o l'errore. */
  protected readonly status = computed(() => {
    const fe = this.fileError();
    if (fe) return { kind: 'error' as const, text: this.i18n.t(fe === 'toolarge' ? 'json.err.toolarge' : 'json.err.read') };
    const p = this.parsed();
    if (!p) return null;
    if (!p.ok) {
      const e = p.error;
      const at =
        e.line !== null && e.column !== null
          ? ` (${this.i18n.t('json.error.at', { line: e.line, column: e.column })})`
          : '';
      return { kind: 'error' as const, text: `${this.i18n.t('json.error')}${at}: ${e.message}` };
    }
    const s = jsonStats(p.value);
    const nf = new Intl.NumberFormat(this.i18n.locale());
    const size = formatBytes(textStats(this.input()).bytes, this.i18n.locale());
    return {
      kind: 'ok' as const,
      text: [
        this.i18n.t('json.valid'),
        this.i18n.t('json.size', { size }),
        this.i18n.t('json.keys', { n: nf.format(s.keys) }),
        this.i18n.t('json.depth', { n: s.depth }),
      ].join(' · '),
    };
  });

  protected readonly lineCount = computed(() => {
    const t = this.input();
    let n = 1;
    for (let i = t.indexOf('\n'); i !== -1; i = t.indexOf('\n', i + 1)) n++;
    return n;
  });
  protected readonly gutterText = computed(() =>
    Array.from({ length: this.lineCount() }, (_, i) => i + 1).join('\n'),
  );
  protected readonly gutterWidth = computed(() => String(this.lineCount()).length);
  protected readonly bandTop = computed(() => {
    const l = this.errorLine();
    return l === null ? null : PAD_Y + (l - 1) * LINE_H - this.scrollTop();
  });
  protected readonly lineHeight = LINE_H;

  protected readonly inputMeta = computed(() => {
    const s = textStats(this.input());
    const nf = new Intl.NumberFormat(this.i18n.locale());
    return this.i18n.t('common.counter', { chars: nf.format(s.chars), bytes: nf.format(s.bytes) });
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    input: this.input,
    action: this.action,
    indent: this.indent,
    sortKeys: this.sortKeys,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(JSON_FORMATTER_DICTIONARIES);
  }

  protected onInput(e: Event): void {
    this.fileError.set(null);
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  protected onScroll(e: Event): void {
    this.scrollTop.set((e.target as HTMLTextAreaElement).scrollTop);
  }

  protected setIndent(v: IndentChoice): void {
    this.indent.set(v);
    this.action.set('format');
  }

  protected loadSample(): void {
    this.fileError.set(null);
    this.input.set(SAMPLE);
  }

  protected clear(): void {
    this.input.set('');
    this.fileError.set(null);
  }

  protected onFile(f: File): void {
    this.fileError.set(null);
    if (f.size > MAX_FILE_BYTES) {
      this.fileError.set('toolarge');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.input.set(String(reader.result ?? ''));
    reader.onerror = () => this.fileError.set('read');
    reader.readAsText(f);
  }

  protected download(): void {
    const out = this.output();
    if (!out) return;
    const url = URL.createObjectURL(new Blob([out], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
