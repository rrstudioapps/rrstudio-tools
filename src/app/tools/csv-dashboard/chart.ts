// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';

/** Wrapper di ngx-echarts. Va usato solo nel browser (i dati arrivano da un file caricato). */
@Component({
  selector: 'app-chart',
  imports: [NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div
    class="chart"
    echarts
    role="img"
    [attr.aria-label]="label()"
    [options]="options()"
    [autoResize]="true"
    (chartInit)="chartInit.emit($event)"
  ></div>`,
  styles: `
    :host {
      display: block;
    }
    .chart {
      height: var(--chart-height);
      width: 100%;
    }
  `,
})
export class Chart {
  readonly options = input.required<EChartsCoreOption>();
  readonly label = input('');
  // Istanza ECharts (tipo opaco: serve solo per getDataURL nell'export)
  readonly chartInit = output<unknown>();
}
