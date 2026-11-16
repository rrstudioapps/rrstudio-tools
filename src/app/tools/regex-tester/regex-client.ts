// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { RegexRequest, RegexResult } from './regex-core';
import type { WorkerRequest, WorkerResponse } from './regex.worker';

/** Tempo massimo concesso a una regex prima di fermare il worker (backtracking catastrofico). */
export const REGEX_TIMEOUT_MS = 1000;

/** La richiesta è stata sostituita da una più recente (il worker è stato fermato): va ignorata. */
export class StaleRegex extends Error {}
/** La regex non ha risposto entro il tempo massimo: il worker è stato terminato. */
export class RegexTimeout extends Error {}
/** I Web Worker non sono disponibili: non si esegue la regex sul thread principale, che potrebbe bloccarsi. */
export class NoWorker extends Error {}

interface Pending {
  resolve: (r: RegexResult) => void;
  reject: (e: Error) => void;
  msg: WorkerRequest;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Esegue le regex in un Web Worker con un tempo massimo. Se non risponde, il worker viene terminato
 * (l'unico modo per fermare un ciclo infinito di JavaScript) e se ne crea uno nuovo alla richiesta dopo.
 * Il tempo comincia quando il worker è pronto, non quando si carica il suo codice.
 */
export class RegexClient {
  private worker: Worker | null = null;
  private ready = false;
  private failed = false;
  private nextId = 0;
  private pending: Pending | null = null;

  constructor(private readonly timeoutMs = REGEX_TIMEOUT_MS) {}

  run(req: RegexRequest): Promise<RegexResult> {
    if (this.pending) {
      // la richiesta precedente è superata: si ferma il worker (potrebbe essere bloccato)
      this.clearPending(new StaleRegex());
      this.dispose();
    }
    const worker = this.ensureWorker();
    if (!worker) return Promise.reject(new NoWorker());
    return new Promise<RegexResult>((resolve, reject) => {
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
      p.reject(new RegexTimeout());
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
      const w = new Worker(new URL('./regex.worker', import.meta.url), { type: 'module' });
      w.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
        if (e.data.ready) {
          this.ready = true;
          if (this.pending && !this.pending.timer) this.arm(this.pending);
          return;
        }
        const data = e.data as { id: number; result: RegexResult };
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
