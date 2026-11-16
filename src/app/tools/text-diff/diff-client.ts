// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { DiffModel, DiffOptions, computeDiff } from './diff-core';
import type { DiffRequest, DiffResponse } from './text-diff.worker';

/** Richiesta superata da una più recente (il worker viene fermato): il chiamante la ignora. */
export class StaleDiff extends Error {}

/**
 * Esegue il confronto in un Web Worker, così la pagina resta reattiva con testi da migliaia di righe.
 * Se il worker non si può creare o va in errore, ripiega sul thread principale.
 */
export class DiffClient {
  private worker: Worker | null = null;
  private failed = false;
  private nextId = 0;
  private pending = new Map<number, { resolve: (m: DiffModel) => void; reject: (e: Error) => void }>();

  run(a: string, b: string, options: DiffOptions): Promise<DiffModel> {
    // una richiesta ancora in corso è superata: si ferma il worker invece di aspettarla
    if (this.pending.size) {
      for (const p of this.pending.values()) p.reject(new StaleDiff());
      this.pending.clear();
      this.dispose();
    }
    const worker = this.ensureWorker();
    if (!worker) return new Promise((resolve) => setTimeout(() => resolve(computeDiff(a, b, options)), 0));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      const msg: DiffRequest = { id, a, b, options };
      worker.postMessage(msg);
    }).catch((e: unknown) => (e instanceof StaleDiff ? Promise.reject(e) : computeDiff(a, b, options))) as Promise<DiffModel>;
  }

  private ensureWorker(): Worker | null {
    if (this.failed) return null;
    if (this.worker) return this.worker;
    try {
      const w = new Worker(new URL('./text-diff.worker', import.meta.url), { type: 'module' });
      w.addEventListener('message', (e: MessageEvent<DiffResponse>) => {
        const p = this.pending.get(e.data.id);
        if (!p) return;
        this.pending.delete(e.data.id);
        if (e.data.ok) p.resolve(e.data.model);
        else p.reject(new Error(e.data.error));
      });
      w.addEventListener('error', () => {
        this.failed = true;
        this.dispose();
        for (const p of this.pending.values()) p.reject(new Error('worker'));
        this.pending.clear();
      });
      this.worker = w;
      return w;
    } catch {
      this.failed = true;
      return null;
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
