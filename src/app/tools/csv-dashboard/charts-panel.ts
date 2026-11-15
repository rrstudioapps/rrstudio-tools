// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/theme/theme.service';
import { Chart } from './chart';
import { DARK_CHART, LIGHT_CHART, categoryOption, timeOption } from './chart-options';
import { DashboardStore } from './dashboard.store';

export interface ChartInstance {
  getDataURL(opts: { type: 'png'; pixelRatio: number; backgroundColor: string }): string;
}

@Component({
  selector: 'app-charts-panel',
  imports: [Chart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="charts">
      <section class="panel">
        <h3>{{ timeTitle() }}</h3>
        @if (timeOpt(); as opt) {
          <app-chart [options]="opt" [label]="i18n.t('csv.chart.alt', { title: timeTitle() })"
            (chartInit)="timeInit.emit($any($event))" />
        } @else {
          <p class="empty">{{ i18n.t('csv.chart.noDate') }}</p>
        }
      </section>
      <section class="panel">
        <h3>{{ catTitle() }}</h3>
        @if (catOpt(); as opt) {
          <app-chart [options]="opt" [label]="i18n.t('csv.chart.alt', { title: catTitle() })"
            (chartInit)="catInit.emit($any($event))" />
        } @else {
          <p class="empty">{{ i18n.t('csv.chart.noCat') }}</p>
        }
      </section>
    </div>
  `,
  styles: `
    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
      gap: var(--space-5);
      border-top: 1px solid var(--line);
      padding-top: var(--space-4);
    }
    .panel {
      min-width: 0;
    }
    h3 {
      font-family: var(--mono);
      font-weight: 400;
      font-size: var(--fs-sm);
      color: var(--muted);
      letter-spacing: 0;
    }
    .empty {
      color: var(--muted);
    }
  `,
})
export class ChartsPanel {
  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(DashboardStore);
  private readonly theme = inject(ThemeService);
  readonly timeInit = output<ChartInstance>();
  readonly catInit = output<ChartInstance>();

  private readonly aggLabel = computed(() => this.i18n.t(`csv.agg.${this.store.effectiveAgg()}`));
  protected readonly timeTitle = computed(() =>
    this.i18n.t('csv.chart.timeTitle', { agg: this.aggLabel() }),
  );
  protected readonly catTitle = computed(() => {
    const col = this.store.catCol();
    return this.i18n.t('csv.chart.catTitle', {
      agg: this.aggLabel(),
      col: col === null ? '' : (this.store.columns()[col]?.name ?? ''),
    });
  });
  private readonly palette = computed(() => (this.theme.isDark() ? DARK_CHART : LIGHT_CHART));

  protected readonly timeOpt = computed(() => {
    const t = this.store.time();
    return t
      ? timeOption(t.points, t.granularity, this.store.timeChart(), this.store.color(), this.palette(), this.i18n.locale())
      : null;
  });
  protected readonly catOpt = computed(() => {
    const d = this.store.categoryData();
    return d
      ? categoryOption(d, this.store.catChart(), this.store.color(), this.palette(), this.i18n.locale())
      : null;
  });
}
