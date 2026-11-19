// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Routes } from '@angular/router';
import { CsvDashboardPage } from './csv-dashboard.page';

export const CSV_DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: CsvDashboardPage,
  },
];
