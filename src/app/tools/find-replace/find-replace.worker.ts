// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { RunRequest, RunResult, runRules } from './find-replace-core';

export type WorkerRequest = RunRequest & { id: number };
export type WorkerResponse = { ready: true } | { ready?: false; id: number; result: RunResult | { ok: false; error: string } };

const scope = self as unknown as {
  addEventListener(type: 'message', fn: (e: MessageEvent<WorkerRequest>) => void): void;
  postMessage(msg: WorkerResponse): void;
};

scope.addEventListener('message', (e) => {
  const { id, ...req } = e.data;
  let result: RunResult | { ok: false; error: string };
  try {
    result = runRules(req);
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : 'error' };
  }
  scope.postMessage({ id, result });
});
// una regola potrebbe bloccare il worker: la pagina lo ferma allo scadere del tempo; "ready" avvia il conto
scope.postMessage({ ready: true });
