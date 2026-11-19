// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { Injectable, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  aggregateByCategory,
  aggregateByPeriod,
  computeKpis,
  periodChange,
} from './aggregation';
import { Aggregation, CategoryChartType, Dataset, TimeChartType } from './models';
import { parseCellDate, parseNumber, pickValueColumn } from './type-detection';

// Colore principale: null = inchiostro del tema; poi 5 tinte sobrie (ardesia, salvia, terracotta, ocra, prugna)
export const COLOR_PRESETS = ['#3d5a80', '#4f7a5a', '#b5573a', '#a07a2c', '#7a4f6d'];
export const PAGE_SIZES = [25, 50, 100] as const;

export interface ColumnOption {
  index: number;
  name: string;
}

/** Stato della dashboard (signal), condiviso dai componenti del tool. */
@Injectable()
export class DashboardStore {
  private readonly i18n = inject(I18nService);

  readonly dataset = signal<Dataset | null>(null);
  readonly title = signal('');
  readonly valueCol = signal<number | null>(null);
  readonly catCol = signal<number | null>(null);
  readonly dateCol = signal<number | null>(null);
  readonly timeChart = signal<TimeChartType>('line');
  readonly catChart = signal<CategoryChartType>('bar');
  /** null = colore di default del tema (inchiostro). */
  readonly color = signal<string | null>(null);
  readonly aggregation = signal<Aggregation>('sum');

  readonly search = signal('');
  readonly sortCol = signal<number | null>(null);
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly pageSize = signal<number>(25);
  readonly page = signal(0);

  readonly rows = computed(() => this.dataset()?.rows ?? []);
  readonly columns = computed(() => this.dataset()?.columns ?? []);

  private options(types: string[]): ColumnOption[] {
    return this.columns()
      .map((c, index) => ({ index, name: c.name, type: c.type }))
      .filter((c) => types.includes(c.type));
  }
  readonly numberOptions = computed(() => this.options(['number']));
  readonly categoryOptions = computed(() => this.options(['category', 'text']));
  readonly dateOptions = computed(() => this.options(['date']));

  /** Senza colonna valori si può solo contare le righe. */
  readonly effectiveAgg = computed<Aggregation>(() =>
    this.valueCol() === null ? 'count' : this.aggregation(),
  );

  readonly values = computed(() => {
    const col = this.valueCol();
    return this.rows().map((r) => (col === null ? null : parseNumber(r[col])));
  });
  readonly dates = computed(() => {
    const col = this.dateCol();
    if (col === null) return [];
    const serial = this.columns()[col]?.serialDate ?? false;
    return this.rows().map((r) => parseCellDate(r[col], serial));
  });
  readonly cats = computed(() => {
    const col = this.catCol();
    return col === null ? [] : this.rows().map((r) => r[col] ?? '');
  });

  readonly kpis = computed(() => computeKpis(this.values(), this.rows().length));

  readonly time = computed(() =>
    this.dateCol() === null
      ? null
      : aggregateByPeriod(this.dates(), this.values(), this.effectiveAgg()),
  );
  readonly change = computed(() => {
    const t = this.time();
    return t ? periodChange(t.points) : null;
  });

  readonly categoryData = computed(() =>
    this.catCol() === null
      ? null
      : aggregateByCategory(
          this.cats(),
          this.values(),
          this.effectiveAgg(),
          this.i18n.t('csv.chart.other'),
        ),
  );

  /** Indici delle righe che passano il filtro testuale. */
  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const rows = this.rows();
    const idx: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      if (!q || rows[i].some((c) => c.toLowerCase().includes(q))) idx.push(i);
    }
    return idx;
  });

  /** Filtrate e ordinate; l'ordinamento rispetta il tipo della colonna. */
  readonly sorted = computed(() => {
    const idx = this.filtered();
    const col = this.sortCol();
    if (col === null) return idx;
    const info = this.columns()[col];
    const rows = this.rows();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    const key = (i: number): number | string | null => {
      const v = rows[i][col] ?? '';
      if (info.type === 'number') return parseNumber(v);
      if (info.type === 'date') return parseCellDate(v, info.serialDate)?.getTime() ?? null;
      return v.toLowerCase();
    };
    const keys = new Map<number, number | string | null>(idx.map((i) => [i, key(i)]));
    return [...idx].sort((a, b) => {
      const ka = keys.get(a) ?? null;
      const kb = keys.get(b) ?? null;
      if (ka === null && kb === null) return 0;
      if (ka === null) return 1; // i vuoti vanno sempre in fondo
      if (kb === null) return -1;
      if (typeof ka === 'number' && typeof kb === 'number') return (ka - kb) * dir;
      return String(ka).localeCompare(String(kb), this.i18n.locale(), { numeric: true }) * dir;
    });
  });

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.sorted().length / this.pageSize())));
  readonly pageRows = computed(() => {
    const start = Math.min(this.page(), this.pageCount() - 1) * this.pageSize();
    return this.sorted().slice(start, start + this.pageSize());
  });

  load(ds: Dataset): void {
    this.dataset.set(ds);
    this.title.set(ds.name);
    const first = (t: string) => {
      const i = ds.columns.findIndex((c) => c.type === t);
      return i >= 0 ? i : null;
    };
    this.valueCol.set(pickValueColumn(ds.columns));
    this.catCol.set(first('category'));
    this.dateCol.set(first('date'));
    this.search.set('');
    this.sortCol.set(null);
    this.page.set(0);
  }

  reset(): void {
    this.dataset.set(null);
  }

  /** Cella da mostrare (i seriali Excel diventano yyyy-mm-dd). */
  cell(row: number, col: number): string {
    const v = this.rows()[row][col] ?? '';
    const info = this.columns()[col];
    if (info.type === 'date' && info.serialDate) {
      return parseCellDate(v, true)?.toISOString().slice(0, 10) ?? v;
    }
    return v;
  }

  toggleSort(col: number): void {
    if (this.sortCol() !== col) {
      this.sortCol.set(col);
      this.sortDir.set('asc');
    } else if (this.sortDir() === 'asc') {
      this.sortDir.set('desc');
    } else {
      this.sortCol.set(null);
    }
    this.page.set(0);
  }
}
