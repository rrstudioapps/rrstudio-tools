// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { DashboardStore } from './dashboard.store';
import { formatNumber, formatPercent } from './format';

@Component({
  selector: 'app-kpi-cards',
  
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kpis">
      @if (store.valueCol() !== null) {
        <div class="kpi">
          <span class="label">{{ i18n.t('csv.kpi.total') }}</span>
          <strong class="value">{{ total() }}</strong>
        </div>
        <div class="kpi">
          <span class="label">{{ i18n.t('csv.kpi.avg') }}</span>
          <strong class="value">{{ average() }}</strong>
        </div>
      }
      <div class="kpi">
        <span class="label">{{ i18n.t('csv.kpi.count') }}</span>
        <strong class="value">{{ count() }}</strong>
      </div>
      @if (store.change() !== null) {
        <div class="kpi">
          <span class="label">{{ i18n.t('csv.kpi.change') }}</span>
          <strong class="value" [class.up]="store.change()! >= 0" [class.down]="store.change()! < 0">
            <span aria-hidden="true">{{ store.change()! >= 0 ? '↑' : '↓' }}</span>
            <span class="visually-hidden">{{
              store.change()! >= 0 ? i18n.t('csv.kpi.up') : i18n.t('csv.kpi.down')
            }}</span>
            {{ change() }}
          </strong>
          <span class="hint">{{ i18n.t('csv.kpi.vsPrev', { unit: unit() }) }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
      border-top: 1px solid var(--line);
    }
    .kpi {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-4) var(--space-4) var(--space-4) 0;
    }
    .label {
      color: var(--muted);
      font-size: var(--fs-sm);
    }
    .hint {
      color: var(--muted);
      font-family: var(--mono);
      font-size: var(--fs-xs);
    }
    .value {
      font-size: var(--fs-kpi);
      font-weight: var(--fw-medium);
      letter-spacing: -0.035em;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    .down {
      color: var(--ink-2);
    }
  `,
})
export class KpiCards {
  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(DashboardStore);

  protected readonly total = computed(() => formatNumber(this.store.kpis().total, this.i18n.locale()));
  protected readonly average = computed(() =>
    formatNumber(this.store.kpis().average, this.i18n.locale()),
  );
  protected readonly count = computed(() => formatNumber(this.store.kpis().count, this.i18n.locale()));
  protected readonly change = computed(() => formatPercent(this.store.change() ?? 0, this.i18n.locale()));
  protected readonly unit = computed(() =>
    this.i18n.t(this.store.time()?.granularity === 'day' ? 'csv.unit.day' : 'csv.unit.month'),
  );
}
