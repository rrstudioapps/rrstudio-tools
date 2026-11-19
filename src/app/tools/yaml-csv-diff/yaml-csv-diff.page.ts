// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { FileDrop } from '../../shared/file-drop';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { decodeText, parseCsv } from '../csv-json-converter/convert-io';
import { ArrayMode } from '../json-diff/json-diff';
import { DiffRow, MAX_ROWS, diffCsv, diffYaml, parseKeyColumns, rowsToText, summarize } from './yaml-csv-diff';
import { YAML_CSV_DIFF_DICTIONARIES } from './yaml-csv-diff.i18n';
import { SHARE_SCHEMA } from './yaml-csv-diff.share';

type Mode = 'yaml' | 'csv';
type Side = 'a' | 'b';
type Outcome = { rows: DiffRow[]; truncated: boolean; total: number; error: string };

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const SAMPLES: Record<Mode, [string, string]> = {
  yaml: [
    'servizio: api\nrepliche: 2\nporte: [80, 443]\nambiente:\n  LOG_LEVEL: info\n  DEBUG: "false"\nutenti:\n  - id: 1\n    nome: Mario\n  - id: 2\n    nome: Anna\n',
    '# nuova configurazione\nservizio: api\nrepliche: 3\nporte: [80, 8443]\nambiente:\n  LOG_LEVEL: warn\n  REGION: eu\nutenti:\n  - id: 2\n    nome: Anna Verdi\n  - id: 3\n    nome: Luca\n',
  ],
  csv: [
    'id,nome,prezzo\n1,Pane,2.50\n2,Latte,1.20\n3,Uova,3.00\n',
    'id,nome,prezzo,iva\n1,Pane,2.80,4\n3,Uova,3.00,4\n4,Miele,6.00,10\n',
  ],
};

@Component({
  selector: 'app-yaml-csv-diff',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, FileDrop, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './yaml-csv-diff.page.html',
  styleUrl: './yaml-csv-diff.page.scss',
})
export class YamlCsvDiffPage {
  protected readonly i18n = inject(I18nService);
  protected readonly mode = signal<Mode>('yaml');
  protected readonly a = signal('');
  protected readonly b = signal('');
  protected readonly arrayMode = signal<ArrayMode>('index');
  protected readonly key = signal('');
  protected readonly keyCols = signal('');
  protected readonly trim = signal(true);
  protected readonly ignoreCase = signal(false);
  protected readonly fileError = signal('');
  protected readonly maxRows = MAX_ROWS;
  protected readonly arrayModes: readonly ArrayMode[] = ['index', 'set', 'key'];
  protected readonly modes: SegmentOption<Mode>[] = [
    { value: 'yaml', label: 'YAML' },
    { value: 'csv', label: 'CSV' },
  ];

  /** Risultato dei CSV: la lettura è asincrona (PapaParse si carica solo quando serve), quindi sta in un signal. */
  private readonly csvOutcome = signal<Outcome | null>(null);
  private csvToken = 0;

  private readonly outcome = computed<Outcome | null>(() => {
    if (this.a().trim() === '' || this.b().trim() === '') return null;
    if (this.mode() === 'csv') return this.csvOutcome();
    const r = diffYaml(this.a(), this.b(), { arrayMode: this.arrayMode(), key: this.key(), ignoreCase: this.ignoreCase() });
    if (r.ok) return { rows: r.rows, truncated: r.truncated, total: r.total, error: '' };
    const where = r.line ? this.i18n.t('yc.err.at', { line: r.line, col: r.column ?? 1 }) : '';
    return { rows: [], truncated: false, total: 0, error: this.i18n.t('yc.err.yaml', { side: this.i18n.t(r.side === 'a' ? 'yc.a' : 'yc.b'), where, msg: r.message }) };
  });
  protected readonly rows = computed(() => this.outcome()?.rows ?? []);
  protected readonly total = computed(() => this.outcome()?.total ?? 0);
  protected readonly truncated = computed(() => this.outcome()?.truncated === true);
  protected readonly summary = computed(() => summarize(this.rows()));
  protected readonly same = computed(() => {
    const o = this.outcome();
    return o !== null && o.error === '' && o.total === 0;
  });
  protected readonly errorText = computed(() => this.fileError() || this.outcome()?.error || '');
  protected readonly reportText = computed(() => rowsToText(this.rows()));

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode,
    a: this.a,
    b: this.b,
    arrayMode: this.arrayMode,
    key: this.key,
    keyCols: this.keyCols,
    trim: this.trim,
    ignoreCase: this.ignoreCase,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(YAML_CSV_DIFF_DICTIONARIES);
    const rx = inject(ToolHandoff).take('yaml-csv-diff');
    if (rx?.text !== undefined) this.a.set(rx.text);
    effect(() => {
      if (this.mode() !== 'csv') return;
      const [ta, tb, keys, trim, ic] = [this.a(), this.b(), this.keyCols(), this.trim(), this.ignoreCase()];
      if (ta.trim() === '' || tb.trim() === '') {
        this.csvOutcome.set(null);
        return;
      }
      void this.runCsv(ta, tb, keys, trim, ic);
    });
  }

  private async runCsv(ta: string, tb: string, keys: string, trim: boolean, ignoreCase: boolean): Promise<void> {
    const token = ++this.csvToken;
    const [pa, pb] = await Promise.all([parseCsv(ta, 'auto'), parseCsv(tb, 'auto')]);
    if (token !== this.csvToken) return;
    const r = diffCsv(pa.rows, pb.rows, { keyColumns: parseKeyColumns(keys), trim, ignoreCase });
    if (r.ok) {
      this.csvOutcome.set({ rows: r.rows, truncated: r.truncated, total: r.total, error: '' });
      return;
    }
    const side = this.i18n.t(r.side === 'b' ? 'yc.b' : 'yc.a');
    const error = r.error === 'key' ? this.i18n.t('yc.err.key', { side, column: r.column ?? '' }) : this.i18n.t('yc.err.empty', { side });
    this.csvOutcome.set({ rows: [], truncated: false, total: 0, error });
  }

  protected setMode(m: Mode): void {
    if (m === this.mode()) return;
    this.mode.set(m);
    this.fileError.set('');
    this.a.set('');
    this.b.set('');
  }

  protected onInput(e: Event, side: Side): void {
    this.fileError.set('');
    (side === 'a' ? this.a : this.b).set((e.target as HTMLTextAreaElement).value);
  }

  protected loadSample(): void {
    this.fileError.set('');
    const [sa, sb] = SAMPLES[this.mode()];
    this.a.set(sa);
    this.b.set(sb);
    if (this.mode() === 'yaml') {
      this.arrayMode.set('key');
      this.key.set('id');
    } else this.keyCols.set('id');
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
      this.fileError.set(this.i18n.t('yc.err.tooBig'));
      return;
    }
    try {
      (side === 'a' ? this.a : this.b).set(decodeText(await file.arrayBuffer()));
    } catch {
      this.fileError.set(this.i18n.t('yc.err.read'));
    }
  }

  protected tone(r: DiffRow): string {
    return r.kind === 'added' ? 'add' : r.kind === 'removed' ? 'del' : 'chg';
  }

  protected meta(text: string): string {
    return text === '' ? '' : this.i18n.t('yc.meta', { lines: text.split('\n').length, chars: text.length });
  }
}
