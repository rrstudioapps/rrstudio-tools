// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { COLOR_PRESETS, DashboardStore } from './dashboard.store';
import { Aggregation, CategoryChartType, TimeChartType } from './models';

const colIndex = (v: string): number | null => (v === '' ? null : Number(v));

@Component({
  selector: 'app-customize-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" [attr.aria-label]="i18n.t('csv.cust.title')">
      <h3>{{ i18n.t('csv.cust.title') }}</h3>
      <div class="fields">
        <label class="field wide">
          <span>{{ i18n.t('csv.cust.titleField') }}</span>
          <input type="text" [value]="store.title()" (input)="store.title.set(val($event))" />
        </label>

        <label class="field">
          <span>{{ i18n.t('csv.cust.value') }}</span>
          <select (change)="store.valueCol.set(idx($event))">
            <option value="" [selected]="store.valueCol() === null">{{ i18n.t('csv.cust.none') }}</option>
            @for (o of store.numberOptions(); track o.index) {
              <option [value]="o.index" [selected]="store.valueCol() === o.index">{{ o.name }}</option>
            }
          </select>
        </label>

        <label class="field">
          <span>{{ i18n.t('csv.cust.cat') }}</span>
          <select (change)="store.catCol.set(idx($event))">
            <option value="" [selected]="store.catCol() === null">{{ i18n.t('csv.cust.none') }}</option>
            @for (o of store.categoryOptions(); track o.index) {
              <option [value]="o.index" [selected]="store.catCol() === o.index">{{ o.name }}</option>
            }
          </select>
        </label>

        <label class="field">
          <span>{{ i18n.t('csv.cust.date') }}</span>
          <select (change)="store.dateCol.set(idx($event))">
            <option value="" [selected]="store.dateCol() === null">{{ i18n.t('csv.cust.none') }}</option>
            @for (o of store.dateOptions(); track o.index) {
              <option [value]="o.index" [selected]="store.dateCol() === o.index">{{ o.name }}</option>
            }
          </select>
        </label>

        <label class="field">
          <span>{{ i18n.t('csv.cust.agg') }}</span>
          <select [disabled]="store.valueCol() === null" (change)="store.aggregation.set(agg($event))">
            @for (a of aggs; track a) {
              <option [value]="a" [selected]="store.effectiveAgg() === a">{{ i18n.t('csv.agg.' + a) }}</option>
            }
          </select>
        </label>

        <label class="field">
          <span>{{ i18n.t('csv.cust.timeChart') }}</span>
          <select (change)="store.timeChart.set(timeType($event))">
            @for (t of timeTypes; track t) {
              <option [value]="t" [selected]="store.timeChart() === t">{{ i18n.t('csv.chart.' + t) }}</option>
            }
          </select>
        </label>

        <label class="field">
          <span>{{ i18n.t('csv.cust.catChart') }}</span>
          <select (change)="store.catChart.set(catType($event))">
            @for (t of catTypes; track t) {
              <option [value]="t" [selected]="store.catChart() === t">{{ i18n.t('csv.chart.' + t) }}</option>
            }
          </select>
        </label>

        <div class="field wide">
          <span id="color-label">{{ i18n.t('csv.cust.color') }}</span>
          <div class="colors" role="group" aria-labelledby="color-label">
            <input
              type="color"
              [value]="store.color() ?? inkDefault"
              [attr.aria-label]="i18n.t('csv.cust.color')"
              (input)="store.color.set(val($event))"
            />
            <button
              type="button"
              class="swatch"
              style="background: var(--ink)"
              [class.on]="store.color() === null"
              [attr.aria-pressed]="store.color() === null"
              [attr.aria-label]="i18n.t('csv.cust.colorPreset', { color: 'ink' })"
              (click)="store.color.set(null)"
            ></button>
            @for (c of presets; track c) {
              <button
                type="button"
                class="swatch"
                [style.background]="c"
                [class.on]="store.color() === c"
                [attr.aria-pressed]="store.color() === c"
                [attr.aria-label]="i18n.t('csv.cust.colorPreset', { color: c })"
                (click)="store.color.set(c)"
              ></button>
            }
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .panel {
      border-top: 1px solid var(--line);
      padding-top: var(--space-4);
    }
    h3 {
      font-family: var(--mono);
      font-weight: 400;
      font-size: var(--fs-sm);
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
      gap: var(--space-4);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      font-size: var(--fs-sm);
      color: var(--muted);
    }
    .wide {
      grid-column: 1 / -1;
    }
    .colors {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }
    input[type='color'] {
      width: var(--control-h);
      height: var(--control-h);
      padding: 2px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: transparent;
    }
    .swatch {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 1px solid var(--line);
      outline: 2px solid transparent;
      outline-offset: 2px;
      cursor: pointer;
      transition: outline-color var(--dur) var(--ease);
    }
    .swatch.on {
      outline-color: var(--ink);
    }
  `,
})
export class CustomizePanel {
  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(DashboardStore);
  protected readonly presets = COLOR_PRESETS;
  protected readonly inkDefault = '#1c1c1e';
  protected readonly aggs: Aggregation[] = ['sum', 'avg', 'count'];
  protected readonly timeTypes: TimeChartType[] = ['line', 'area', 'bar'];
  protected readonly catTypes: CategoryChartType[] = ['bar', 'hbar', 'pie'];

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }
  protected idx(e: Event): number | null {
    return colIndex(this.val(e));
  }
  protected agg(e: Event): Aggregation {
    return this.val(e) as Aggregation;
  }
  protected timeType(e: Event): TimeChartType {
    return this.val(e) as TimeChartType;
  }
  protected catType(e: Event): CategoryChartType {
    return this.val(e) as CategoryChartType;
  }
}
