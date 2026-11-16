// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { Route, Routes } from '@angular/router';
import { TOOLS, ToolDefinition } from './tools/tools.registry';

function toRoute(tool: ToolDefinition): Route {
  const seo = { titleKey: tool.seo.titleKey, descriptionKey: tool.seo.descriptionKey };
  return {
    path: tool.path,
    data: { seo, ...tool.routeData },
    ...(tool.loadChildren
      ? { loadChildren: tool.loadChildren }
      : { loadComponent: tool.loadComponent }),
  };
}

const HOME: Route = {
  path: '',
  pathMatch: 'full',
  loadComponent: () => import('./pages/home').then((m) => m.Home),
  data: { seo: { titleKey: 'seo.home.title', descriptionKey: 'seo.home.desc' } },
};

const PRIVACY: Route = {
  path: 'privacy',
  loadComponent: () => import('./pages/privacy').then((m) => m.Privacy),
  data: { seo: { titleKey: 'seo.privacy.title', descriptionKey: 'seo.privacy.desc' } },
};

/**
 * Route generate dal registry dei tool, più la home. La radice è italiana; la versione inglese
 * sta sotto /en/ con gli stessi slug, tranne gli strumenti `italyOnly` (solo in italiano).
 */
export const routes: Routes = [
  HOME,
  ...TOOLS.map(toRoute),
  PRIVACY,
  {
    path: 'en',
    children: [
      HOME,
      ...TOOLS.filter((t) => !t.italyOnly).map(toRoute),
      PRIVACY,
      // /en/<sconosciuto> → home inglese
      { path: '**', redirectTo: '/en' },
    ],
  },
  { path: '**', redirectTo: '' },
];
