// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { DIALECTS, Dialect, KeywordCase, SqlError, formatSql, minifySql } from './sql';
import { SQL_DICTIONARIES } from './sql-formatter.i18n';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './sql-formatter.share';
import { SendTo } from '../../shared/send-to';
import { ToolHandoff } from '../../shared/tool-handoff';

type Mode = 'format' | 'minify';
type IndentChoice = '2' | '4' | 'tab';

const MAX_FILE = 2 * 1024 * 1024;
const SAMPLE =
  "select u.id, u.name, count(o.id) as orders, sum(o.total) as revenue from users u left join orders o on o.user_id = u.id and o.status in ('paid','shipped') where u.created_at >= '2026-01-01' -- solo i nuovi\n group by u.id, u.name having count(o.id) > 0 order by revenue desc limit 10;";

@Component({
  selector: 'app-sql-formatter',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, Segmented, CopyButton, FileDrop, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sql-formatter.page.html',
  styleUrl: './sql-formatter.page.scss',
})
export class SqlFormatterPage {
  protected readonly i18n = inject(I18nService);

  protected readonly dialects = DIALECTS;
  protected readonly mode = signal<Mode>('format');
  protected readonly dialect = signal<Dialect>('sql');
  protected readonly keywordCase = signal<KeywordCase>('upper');
  protected readonly indent = signal<IndentChoice>('2');
  protected readonly input = signal('');
  protected readonly fileError = signal('');

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'format', label: this.i18n.t('sql.mode.format') },
    { value: 'minify', label: this.i18n.t('sql.mode.minify') },
  ]);
  protected readonly cases = computed<SegmentOption<KeywordCase>[]>(() => [
    { value: 'upper', label: this.i18n.t('sql.case.upper') },
    { value: 'lower', label: this.i18n.t('sql.case.lower') },
    { value: 'preserve', label: this.i18n.t('sql.case.preserve') },
  ]);
  protected readonly indents = computed<SegmentOption<IndentChoice>[]>(() => [
    { value: '2', label: this.i18n.t('sql.indent.2') },
    { value: '4', label: this.i18n.t('sql.indent.4') },
    { value: 'tab', label: this.i18n.t('sql.indent.tab') },
  ]);

  private readonly result = computed<{ ok: true; text: string } | { ok: false; error: SqlError } | null>(() => {
    const text = this.input();
    if (text.trim() === '') return null;
    if (this.mode() === 'minify') return { ok: true, text: minifySql(text, this.dialect()) };
    const ind = this.indent();
    return formatSql(text, {
      dialect: this.dialect(),
      keywordCase: this.keywordCase(),
      indent: ind === 'tab' ? 'tab' : ind === '4' ? 4 : 2,
      linesBetweenQueries: 1,
    });
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
    return e.line !== undefined && e.column !== undefined
      ? this.i18n.t('sql.err.at', { line: e.line, col: e.column, msg: e.message })
      : this.i18n.t('sql.err.plain', { msg: e.message });
  });
  protected readonly note = computed(() => {
    const r = this.result();
    if (!r?.ok) return '';
    if (this.mode() === 'minify') {
      const from = this.input().length;
      const to = r.text.length;
      return this.i18n.t('sql.saved', { from, to, pct: Math.max(0, Math.round((1 - to / from) * 100)) });
    }
    return this.i18n.t('sql.ok');
  });
  protected readonly inputMeta = computed(() => this.meta(this.input()));
  protected readonly outputMeta = computed(() => this.meta(this.output()));

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode,
    dialect: this.dialect,
    keywordCase: this.keywordCase,
    indent: this.indent,
    input: this.input,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(SQL_DICTIONARIES);
    const rx = inject(ToolHandoff).take('sql-formatter');
    if (rx?.text !== undefined) this.input.set(rx.text);
  }

  private meta(text: string): string {
    return text === '' ? '' : this.i18n.t('sql.meta', { lines: text.split('\n').length, chars: text.length });
  }

  protected onInput(e: Event): void {
    this.fileError.set('');
    this.input.set((e.target as HTMLTextAreaElement).value);
  }

  protected onDialect(e: Event): void {
    this.dialect.set((e.target as HTMLSelectElement).value as Dialect);
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
      this.fileError.set(this.i18n.t('sql.err.tooBig'));
      return;
    }
    try {
      this.input.set(await file.text());
    } catch {
      this.fileError.set(this.i18n.t('sql.err.read'));
    }
  }

  protected download(): void {
    saveBytes(new TextEncoder().encode(this.output()), this.mode() === 'minify' ? 'query.min.sql' : 'query.sql', 'text/plain;charset=utf-8');
  }
}
