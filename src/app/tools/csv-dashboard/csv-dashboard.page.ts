// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/theme/theme.service';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { ChartsPanel } from './charts-panel';
import type { ChartInstance } from './charts-panel';
import { CSV_DICTIONARIES } from './csv-dashboard.i18n';
import { CustomizePanel } from './customize-panel';
import { DashboardStore } from './dashboard.store';
import { DataTable } from './data-table';
import { EXPORT_MAX_ROWS, ExportService, currentColors } from './export.service';
import { FileParserService } from './file-parser.service';
import { formatNumber, formatPercent } from './format';
import { KpiCards } from './kpi-cards';
import { FileError } from './models';
import { UploadZone } from './upload-zone';

@Component({
  selector: 'app-csv-dashboard',
  imports: [Icon, PrivacyNote, UploadZone, KpiCards, ChartsPanel, CustomizePanel, DataTable],
  providers: [DashboardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './csv-dashboard.page.html',
  styleUrl: './csv-dashboard.page.scss',
})
export class CsvDashboardPage {
  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(DashboardStore);
  private readonly theme = inject(ThemeService);
  private readonly parser = inject(FileParserService);
  private readonly exporter = inject(ExportService);

  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly capture = viewChild<ElementRef<HTMLElement>>('capture');
  private timeChart: ChartInstance | null = null;
  private catChart: ChartInstance | null = null;

  protected readonly info = computed(() =>
    this.i18n.t('csv.file.info', {
      rows: formatNumber(this.store.rows().length, this.i18n.locale()),
      cols: this.store.columns().length,
    }),
  );

  constructor() {
    this.i18n.register(CSV_DICTIONARIES);
  }

  protected onFile(file: File): Promise<void> {
    return this.run(() => this.parser.parseFile(file));
  }

  protected onSample(): Promise<void> {
    return this.run(() => this.parser.loadSample());
  }

  private async run(load: () => Promise<import('./models').Dataset>): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      this.store.load(await load());
    } catch (e) {
      this.error.set(this.i18n.t(`csv.err.${e instanceof FileError ? e.code : 'failed'}`));
    } finally {
      this.loading.set(false);
    }
  }

  protected newFile(): void {
    this.timeChart = null;
    this.catChart = null;
    this.error.set(null);
    this.store.reset();
  }

  protected setTime(c: ChartInstance): void {
    this.timeChart = c;
  }
  protected setCat(c: ChartInstance): void {
    this.catChart = c;
  }

  private title(): string {
    return this.store.title().trim() || this.store.dataset()?.name || 'dashboard';
  }
  private dateLabel(): string {
    const d = new Intl.DateTimeFormat(this.i18n.locale(), { dateStyle: 'long' }).format(new Date());
    return this.i18n.t('csv.export.generated', { date: d });
  }

  private async guard(fn: () => Promise<void> | void): Promise<void> {
    this.error.set(null);
    this.exporting.set(true);
    try {
      await fn();
    } catch {
      this.error.set(this.i18n.t('csv.export.failed'));
    } finally {
      this.exporting.set(false);
    }
  }

  protected exportHtml(): Promise<void> {
    return this.guard(() => {
      const ds = this.store.dataset();
      if (!ds) return;
      const colors = currentColors();
      const loc = this.i18n.locale();
      const k = this.store.kpis();
      const change = this.store.change();
      const kpis = [];
      if (this.store.valueCol() !== null) {
        kpis.push({ label: this.i18n.t('csv.kpi.total'), value: formatNumber(k.total, loc) });
        kpis.push({ label: this.i18n.t('csv.kpi.avg'), value: formatNumber(k.average, loc) });
      }
      kpis.push({ label: this.i18n.t('csv.kpi.count'), value: formatNumber(k.count, loc) });
      if (change !== null) {
        kpis.push({
          label: this.i18n.t('csv.kpi.change'),
          value: formatPercent(change, loc),
          delta: { text: formatPercent(change, loc), up: change >= 0 },
        });
      }
      const charts: { title: string; dataUrl: string }[] = [];
      const grab = (c: ChartInstance | null, title: string) => {
        if (c) {
          charts.push({
            title,
            dataUrl: c.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: colors.bg }),
          });
        }
      };
      const aggLabel = this.i18n.t(`csv.agg.${this.store.effectiveAgg()}`);
      grab(this.store.time() ? this.timeChart : null, this.i18n.t('csv.chart.timeTitle', { agg: aggLabel }));
      const catCol = this.store.catCol();
      grab(
        catCol !== null ? this.catChart : null,
        this.i18n.t('csv.chart.catTitle', { agg: aggLabel, col: ds.columns[catCol ?? 0]?.name ?? '' }),
      );
      const n = Math.min(EXPORT_MAX_ROWS, ds.rows.length);
      const rows: string[][] = [];
      for (let i = 0; i < n; i++) rows.push(ds.columns.map((_, c) => this.store.cell(i, c)));
      this.exporter.exportHtml(
        {
          lang: this.i18n.lang(),
          title: this.title(),
          generatedLabel: this.dateLabel(),
          kpis,
          charts,
          headers: ds.columns.map((c) => c.name),
          rows,
          rowsNote: this.i18n.t('csv.export.firstRows', {
            n: formatNumber(n, loc),
            total: formatNumber(ds.rows.length, loc),
          }),
          credit: this.i18n.t('csv.export.credit'),
          colors,
        },
        this.title(),
      );
    });
  }

  protected exportPng(): Promise<void> {
    return this.guard(async () => {
      const el = this.capture()?.nativeElement;
      if (el) await this.exporter.exportPng(el, this.title(), currentColors().bg);
    });
  }

  protected exportPdf(): Promise<void> {
    return this.guard(async () => {
      const el = this.capture()?.nativeElement;
      if (el) await this.exporter.exportPdf(el, this.title(), this.dateLabel(), currentColors().bg);
    });
  }
}
