// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { WorkerRequest, WorkerResponse } from './image-compressor.worker';
import { ProcessRequest, ProcessResult, processImage } from './image-processor';

/**
 * Esegue le elaborazioni in un Web Worker; se non è disponibile (niente OffscreenCanvas o worker
 * bloccato) ripiega sul main thread con un canvas normale.
 */
export class ProcessorClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (r: ProcessResult) => void; reject: (e: Error) => void }
  >();
  private useMainThread = typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined';

  /** True se si sta usando il ripiego sul main thread. */
  get fallback(): boolean {
    return this.useMainThread;
  }

  async process(req: ProcessRequest): Promise<ProcessResult> {
    if (!this.useMainThread) {
      try {
        return await this.viaWorker(req);
      } catch (e) {
        if (!(e instanceof WorkerUnavailable)) throw e;
        this.useMainThread = true;
      }
    }
    return processImage(req);
  }

  private viaWorker(req: ProcessRequest): Promise<ProcessResult> {
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const msg: WorkerRequest = { id, ...req };
      worker.postMessage(msg);
    });
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    let w: Worker;
    try {
      w = new Worker(new URL('./image-compressor.worker', import.meta.url), { type: 'module' });
    } catch {
      throw new WorkerUnavailable();
    }
    w.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error));
    });
    // errore di caricamento o di esecuzione del worker: si passa al main thread
    w.addEventListener('error', () => {
      this.dispose();
      this.rejectAll(new WorkerUnavailable());
    });
    this.worker = w;
    return w;
  }

  private rejectAll(err: Error): void {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

class WorkerUnavailable extends Error {}
