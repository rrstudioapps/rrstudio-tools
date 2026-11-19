// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import {
  ConfigError, DEFAULT_CONFIG, ExportFormat, FIELD_IDS, FakeConfig, FieldId, MAX_ROWS, MIN_ROWS, PREVIEW_ROWS, Row, Separator,
  generateRows, randomSeedText, toCsv, toJson, toSql, validTableName,
} from './fake-data';
import { FAKE_DATA_DICTIONARIES } from './fake-data-generator.i18n';
import { SHARE_SCHEMA } from './fake-data-generator.share';

@Component({
  selector: 'app-fake-data-generator',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, CopyButton, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fake-data-generator.page.html',
  styleUrl: './fake-data-generator.page.scss',
})
export class FakeDataGeneratorPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly minRows = MIN_ROWS;
  protected readonly maxRows = MAX_ROWS;
  protected readonly previewRows = PREVIEW_ROWS;

  protected readonly fields = signal<FieldId[]>([...DEFAULT_CONFIG.fields]);
  protected readonly count = signal(DEFAULT_CONFIG.count);
  protected readonly seed = signal('');
  protected readonly birthFrom = signal(DEFAULT_CONFIG.birthFrom);
  protected readonly birthTo = signal(DEFAULT_CONFIG.birthTo);
  protected readonly numberMin = signal(DEFAULT_CONFIG.numberMin);
  protected readonly numberMax = signal(DEFAULT_CONFIG.numberMax);
  protected readonly numberDecimals = signal(DEFAULT_CONFIG.numberDecimals);
  protected readonly format = signal<ExportFormat>('csv');
  protected readonly sep = signal<Separator>(',');
  protected readonly table = signal('utenti');

  /** Seme scelto a caso quando il campo è vuoto: resta lo stesso finché non si preme "Genera". */
  protected readonly autoSeed = signal('');
  protected readonly usedSeed = computed(() => this.seed().trim() || this.autoSeed());

  private readonly rows = signal<Row[]>([]);
  protected readonly rowsFields = signal<FieldId[]>([]);
  protected readonly error = signal<ConfigError | ''>('');
  protected readonly busy = signal(false);
  protected readonly progress = signal(0);
  private runId = 0;

  protected readonly unusedFields = computed(() => FIELD_IDS.filter((f) => !this.fields().includes(f)));
  protected readonly previewData = computed(() => this.rows().slice(0, PREVIEW_ROWS));
  protected readonly hasNumber = computed(() => this.fields().includes('number'));
  protected readonly hasBirth = computed(() => this.fields().some((f) => f === 'birth_date' || f === 'tax_code'));

  protected readonly formats = computed<SegmentOption<ExportFormat>[]>(() => [
    { value: 'csv', label: 'CSV' },
    { value: 'json', label: 'JSON' },
    { value: 'sql', label: 'SQL INSERT' },
  ]);

  protected readonly tableError = computed(() => this.format() === 'sql' && !validTableName(this.table()));

  /** Testo esportato nel formato scelto (vuoto se i dati non ci sono o il nome della tabella non è ammesso). */
  protected readonly text = computed(() => this.exportRows(this.rows(), this.rowsFields()));
  /** Le prime righe, per vedere la forma dell'esportazione. */
  protected readonly sample = computed(() => this.exportRows(this.rows().slice(0, 3), this.rowsFields()));
  protected readonly meta = computed(() =>
    this.rows().length ? this.i18n.t('fake.meta', { n: this.rows().length, shown: Math.min(PREVIEW_ROWS, this.rows().length) }) : '',
  );

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    fields: this.fields,
    count: this.count,
    seed: this.seed,
    birthFrom: this.birthFrom,
    birthTo: this.birthTo,
    numberMin: this.numberMin,
    numberMax: this.numberMax,
    numberDecimals: this.numberDecimals,
    format: this.format,
    sep: this.sep,
    table: this.table,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(FAKE_DATA_DICTIONARIES);
    inject(DestroyRef).onDestroy(() => this.runId++);
    // Rigenera quando cambia la configurazione (solo nel browser: la pagina prerenderizzata non contiene dati)
    effect(() => {
      const cfg = this.config();
      if (!this.browser) return;
      untracked(() => void this.run(cfg));
    });
  }

  private config(): FakeConfig {
    return {
      fields: this.fields(),
      count: this.count(),
      seed: this.seed().trim() || this.ensureSeed(),
      birthFrom: this.birthFrom(),
      birthTo: this.birthTo(),
      numberMin: this.numberMin(),
      numberMax: this.numberMax(),
      numberDecimals: this.numberDecimals(),
    };
  }

  private ensureSeed(): string {
    const s = untracked(() => this.autoSeed());
    if (s) return s;
    const n = this.browser ? randomSeedText() : '';
    untracked(() => this.autoSeed.set(n));
    return n;
  }

  private async run(cfg: FakeConfig): Promise<void> {
    const id = ++this.runId;
    this.busy.set(true);
    this.progress.set(0);
    const res = await generateRows(cfg, {
      isCancelled: () => id !== this.runId,
      onProgress: (n) => id === this.runId && this.progress.set(n),
    });
    if (res === null || id !== this.runId) return;
    this.busy.set(false);
    if (res.ok) {
      this.error.set('');
      this.rowsFields.set(cfg.fields);
      this.rows.set(res.rows);
    } else {
      this.error.set(res.error);
      this.rows.set([]);
    }
  }

  private exportRows(rows: Row[], fields: FieldId[]): string {
    if (!rows.length) return '';
    switch (this.format()) {
      case 'csv': return toCsv(fields, rows, this.sep());
      case 'json': return toJson(fields, rows);
      case 'sql': return toSql(fields, rows, this.table()) ?? '';
    }
  }

  protected label(f: string): string {
    return this.i18n.t('fake.f.' + f);
  }
  protected cellText(c: string | number | boolean): string {
    return String(c);
  }

  protected regenerate(): void {
    // con il seme vuoto si sceglie un seme nuovo (la configurazione cambia e la generazione riparte); con un seme fisso si rigenera uguale
    if (this.seed().trim()) void this.run(this.config());
    else this.autoSeed.set(randomSeedText());
  }

  protected keepSeed(): void {
    this.seed.set(this.usedSeed());
  }

  protected add(f: FieldId): void {
    this.fields.update((l) => (l.includes(f) ? l : [...l, f]));
  }
  protected remove(f: FieldId): void {
    this.fields.update((l) => l.filter((x) => x !== f));
  }
  protected move(i: number, d: -1 | 1): void {
    this.fields.update((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const copy = [...l];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }
  protected selectAll(): void {
    this.fields.set([...FIELD_IDS]);
  }
  protected selectNone(): void {
    this.fields.set([]);
  }

  protected setCount(value: string): void {
    const n = Math.round(Number(value));
    this.count.set(Number.isFinite(n) ? Math.min(MAX_ROWS, Math.max(MIN_ROWS, n)) : DEFAULT_CONFIG.count);
  }
  protected setNum(target: 'min' | 'max', value: string): void {
    const n = Number(value.replace(',', '.'));
    if (value.trim() === '' || !Number.isFinite(n)) return;
    (target === 'min' ? this.numberMin : this.numberMax).set(n);
  }
  protected setDecimals(value: string): void {
    const n = Math.round(Number(value));
    this.numberDecimals.set(Number.isFinite(n) ? Math.min(4, Math.max(0, n)) : 0);
  }
  protected onSep(value: string): void {
    this.sep.set(value === ';' ? ';' : value === '\t' ? '\t' : ',');
  }

  protected download(): void {
    const f = this.format();
    const body = this.text();
    if (!body) return;
    const text = f === 'csv' ? '﻿' + body : body;
    const mime = f === 'csv' ? 'text/csv' : f === 'json' ? 'application/json' : 'application/sql';
    saveBytes(new TextEncoder().encode(text), `dati-finti.${f}`, mime + ';charset=utf-8');
  }
}
