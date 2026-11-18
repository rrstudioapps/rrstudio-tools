// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { JsonDiffOptions, Outcome, compareTexts } from './json-diff';
import type { JsonDiffRequest, JsonDiffResponse } from './json-diff.worker';

/** Richiesta superata da una più recente (il worker viene fermato): il chiamante la ignora. */
export class StaleCompare extends Error {}

/** Sopra questa dimensione (caratteri dei due testi insieme) il confronto gira in un Web Worker. */
export const WORKER_THRESHOLD = 200_000;

/**
 * Confronta i due testi: sul thread principale se sono piccoli, in un Web Worker se sono grandi (qualche MB),
 * così la pagina resta reattiva. Se il worker non si può creare o va in errore, ripiega sul thread principale.
 */
export class JsonDiffClient {
  private worker: Worker | null = null;
  private failed = false;
  private nextId = 0;
  private pending = new Map<number, { resolve: (o: Outcome) => void; reject: (e: Error) => void }>();

  run(a: string, b: string, options: JsonDiffOptions): Promise<Outcome> {
    if (this.pending.size) {
      for (const p of this.pending.values()) p.reject(new StaleCompare());
      this.pending.clear();
      this.dispose();
    }
    const local = (): Promise<Outcome> => new Promise((resolve) => setTimeout(() => resolve(compareTexts(a, b, options)), 0));
    if (a.length + b.length < WORKER_THRESHOLD) return local();
    const worker = this.ensureWorker();
    if (!worker) return local();
    return new Promise<Outcome>((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      const msg: JsonDiffRequest = { id, a, b, options };
      worker.postMessage(msg);
    }).catch((e: unknown) => (e instanceof StaleCompare ? Promise.reject(e) : compareTexts(a, b, options)));
  }

  private ensureWorker(): Worker | null {
    if (this.failed) return null;
    if (this.worker) return this.worker;
    try {
      const w = new Worker(new URL('./json-diff.worker', import.meta.url), { type: 'module' });
      w.addEventListener('message', (e: MessageEvent<JsonDiffResponse>) => {
        const p = this.pending.get(e.data.id);
        if (!p) return;
        this.pending.delete(e.data.id);
        if (e.data.ok) p.resolve(e.data.outcome);
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
