// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';

// Solo i moduli ECharts necessari (tree-shaking)
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

/** Wrapper di ngx-echarts. Va usato solo nel browser (i dati arrivano da un file caricato). */
@Component({
  selector: 'app-chart',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
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
