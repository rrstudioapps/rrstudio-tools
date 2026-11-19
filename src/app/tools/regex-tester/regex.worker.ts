// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { RegexRequest, RegexResult, runRegex } from './regex-core';

export type WorkerRequest = RegexRequest & { id: number };
export type WorkerResponse = { ready: true } | { ready?: false; id: number; result: RegexResult };

const scope = self as unknown as {
  addEventListener(type: 'message', fn: (e: MessageEvent<WorkerRequest>) => void): void;
  postMessage(msg: WorkerResponse): void;
};

scope.addEventListener('message', (e) => {
  const { id, ...req } = e.data;
  let result: RegexResult;
  try {
    result = runRegex(req);
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : 'regex' };
  }
  scope.postMessage({ id, result });
});
// il pattern potrebbe bloccare il worker: la pagina lo ferma allo scadere del tempo; "ready" avvia il conto
scope.postMessage({ ready: true });
