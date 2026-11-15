// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { Route, Routes } from '@angular/router';
import { TOOLS, ToolDefinition } from './tools/tools.registry';

function toRoute(tool: ToolDefinition): Route {
  const seo = { titleKey: tool.seo.titleKey, descriptionKey: tool.seo.descriptionKey };
  return {
    path: tool.path,
    data: { seo },
    ...(tool.loadChildren
      ? { loadChildren: tool.loadChildren }
      : { loadComponent: tool.loadComponent }),
  };
}

/** Route generate dal registry dei tool, più la home. */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home').then((m) => m.Home),
    data: { seo: { titleKey: 'seo.home.title', descriptionKey: 'seo.home.desc' } },
  },
  ...TOOLS.map(toRoute),
  { path: '**', redirectTo: '' },
];
