// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Routes } from '@angular/router';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { provideEchartsCore } from 'ngx-echarts';
import { CsvDashboardPage } from './csv-dashboard.page';

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

export const CSV_DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: CsvDashboardPage,
    providers: [provideEchartsCore({ echarts })],
  },
];
