// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { WorkerRequest, WorkerResponse } from './htpasswd.worker';
import { HtAlgo, MakeResult, VerifyResult, makeLine, verifyLine } from './htpasswd';

type Distribute<T> = T extends unknown ? Omit<T, 'id'> : never;
type Job = Distribute<WorkerRequest>;

class WorkerUnavailable extends Error {}

/**
 * Esegue bcrypt (lento di proposito) in un Web Worker, così la pagina resta reattiva.
 * Se il worker non è disponibile ripiega sul thread principale (bcryptjs asincrono cede comunque il controllo).
 */
export class HtpasswdClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private useMainThread = typeof Worker === 'undefined';
  private readonly pending = new Map<number, { resolve: (r: MakeResult | VerifyResult) => void; reject: (e: Error) => void }>();

  /** True se si sta usando il ripiego sul thread principale. */
  get fallback(): boolean {
    return this.useMainThread;
  }

  make(user: string, password: string, algo: HtAlgo, cost: number): Promise<MakeResult> {
    return this.run({ op: 'make', user, password, algo, cost }, () => makeLine(user, password, algo, cost)) as Promise<MakeResult>;
  }

  verify(line: string, password: string): Promise<VerifyResult> {
    return this.run({ op: 'verify', line, password }, () => verifyLine(line, password)) as Promise<VerifyResult>;
  }

  private async run(job: Job, local: () => Promise<MakeResult | VerifyResult>): Promise<MakeResult | VerifyResult> {
    if (!this.useMainThread) {
      try {
        return await this.viaWorker(job);
      } catch (e) {
        if (!(e instanceof WorkerUnavailable)) throw e;
        this.useMainThread = true;
      }
    }
    return local();
  }

  private viaWorker(job: Job): Promise<MakeResult | VerifyResult> {
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ ...job, id } as WorkerRequest);
    });
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    let w: Worker;
    try {
      w = new Worker(new URL('./htpasswd.worker', import.meta.url), { type: 'module' });
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
    // errore di caricamento o di esecuzione: si passa al thread principale
    w.addEventListener('error', () => {
      this.dispose();
      for (const p of this.pending.values()) p.reject(new WorkerUnavailable());
      this.pending.clear();
    });
    this.worker = w;
    return w;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
