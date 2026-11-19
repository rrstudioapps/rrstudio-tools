// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'rrtools.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  readonly theme = signal<Theme>('light');
  readonly isDark = computed(() => this.theme() === 'dark');
  private ready = false;

  constructor() {
    effect(() => {
      const t = this.theme();
      if (this.ready) this.doc.documentElement.setAttribute('data-theme', t);
    });
  }

  /** Solo nel browser: legge il tema già applicato dallo script inline in index.html. */
  initFromBrowser(): void {
    let t: Theme = this.doc.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') t = saved;
      else if (!this.doc.documentElement.hasAttribute('data-theme')) {
        t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } catch {
      /* tema di sistema */
    }
    this.ready = true;
    this.theme.set(t);
    this.doc.documentElement.setAttribute('data-theme', t);
  }

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.ready = true;
    this.theme.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* preferenza non salvata */
    }
  }
}
