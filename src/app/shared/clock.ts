// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, Signal, inject, signal } from '@angular/core';

/**
 * Signal con l'ora corrente (ms) che si aggiorna ogni `intervalMs`, solo nel browser:
 * nel prerender resta fermo e non lascia timer attivi. Va chiamata in un contesto di iniezione.
 */
export function useNow(intervalMs = 1000): Signal<number> {
  const now = signal(Date.now());
  if (isPlatformBrowser(inject(PLATFORM_ID))) {
    const id = setInterval(() => now.set(Date.now()), intervalMs);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
  return now.asReadonly();
}
