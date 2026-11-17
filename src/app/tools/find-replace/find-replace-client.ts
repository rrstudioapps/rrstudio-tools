// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { RunRequest, RunResult } from './find-replace-core';
import type { WorkerRequest, WorkerResponse } from './find-replace.worker';

/** Tempo massimo concesso alle regole prima di fermare il worker (backtracking catastrofico, testo enorme). */
export const FIND_REPLACE_TIMEOUT_MS = 3000;

/** La richiesta è stata sostituita da una più recente: va ignorata. */
export class StaleRun extends Error {}
/** Le regole non hanno risposto entro il tempo massimo: il worker è stato terminato. */
export class RunTimeout extends Error {}
/** I Web Worker non sono disponibili: le regole non si eseguono sul thread principale, che potrebbe bloccarsi. */
export class NoWorker extends Error {}

type Outcome = RunResult | { ok: false; error: string };

interface Pending {
  resolve: (r: Outcome) => void;
  reject: (e: Error) => void;
  msg: WorkerRequest;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Esegue le regole in un Web Worker con un tempo massimo. Allo scadere il worker viene terminato
 * (l'unico modo di fermare un ciclo di JavaScript) e se ne crea uno nuovo alla richiesta dopo.
 * Il conto del tempo parte quando il worker è pronto, non quando si carica il suo codice.
 */
export class FindReplaceClient {
  private worker: Worker | null = null;
  private ready = false;
  private failed = false;
  private nextId = 0;
  private pending: Pending | null = null;

  constructor(private readonly timeoutMs = FIND_REPLACE_TIMEOUT_MS) {}

  run(req: RunRequest): Promise<Outcome> {
    if (this.pending) {
      this.clearPending(new StaleRun());
      this.dispose();
    }
    const worker = this.ensureWorker();
    if (!worker) return Promise.reject(new NoWorker());
    return new Promise<Outcome>((resolve, reject) => {
      const msg: WorkerRequest = { ...req, id: ++this.nextId };
      const p: Pending = { resolve, reject, msg, timer: null };
      this.pending = p;
      worker.postMessage(msg);
      if (this.ready) this.arm(p);
    });
  }

  private arm(p: Pending): void {
    p.timer = setTimeout(() => {
      if (this.pending !== p) return;
      this.pending = null;
      this.dispose();
      p.reject(new RunTimeout());
    }, this.timeoutMs);
  }

  private clearPending(error: Error): void {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    p.reject(error);
  }

  private ensureWorker(): Worker | null {
    if (this.failed || typeof Worker === 'undefined') return null;
    if (this.worker) return this.worker;
    try {
      const w = new Worker(new URL('./find-replace.worker', import.meta.url), { type: 'module' });
      w.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
        if (e.data.ready) {
          this.ready = true;
          if (this.pending && !this.pending.timer) this.arm(this.pending);
          return;
        }
        const data = e.data as { id: number; result: Outcome };
        const p = this.pending;
        if (!p || p.msg.id !== data.id) return;
        if (p.timer) clearTimeout(p.timer);
        this.pending = null;
        p.resolve(data.result);
      });
      w.addEventListener('error', () => {
        this.failed = true;
        this.dispose();
        this.clearPending(new NoWorker());
      });
      this.worker = w;
      this.ready = false;
      return w;
    } catch {
      this.failed = true;
      return null;
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }
}
