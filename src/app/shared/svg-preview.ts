// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { DestroyRef, WritableSignal, effect, inject } from '@angular/core';

/**
 * Anteprima di un SVG servito come immagine da un object URL: ad ogni cambio dell'SVG crea l'URL e rilascia
 * il precedente, alla distruzione del componente azzera il segnale. Da chiamare nel costruttore (contesto di iniezione).
 */
export function bindSvgPreview(svg: () => string, target: WritableSignal<string | null>): void {
  effect((onCleanup) => {
    const text = svg();
    if (!text || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      target.set(null);
      return;
    }
    let url: string;
    try {
      url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    } catch {
      target.set(null);
      return;
    }
    target.set(url);
    onCleanup(() => URL.revokeObjectURL(url));
  });
  inject(DestroyRef).onDestroy(() => target.set(null));
}
