// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { HtAlgo, MakeResult, VerifyResult, makeLine, verifyLine } from './htpasswd';

export type WorkerRequest =
  | { id: number; op: 'make'; user: string; password: string; algo: HtAlgo; cost: number }
  | { id: number; op: 'verify'; line: string; password: string };

export type WorkerResponse =
  | { id: number; ok: true; result: MakeResult | VerifyResult }
  | { id: number; ok: false; error: string };

const scope = self as unknown as {
  addEventListener(type: 'message', fn: (e: MessageEvent<WorkerRequest>) => void): void;
  postMessage(msg: WorkerResponse): void;
};

scope.addEventListener('message', async (e) => {
  const req = e.data;
  try {
    const result =
      req.op === 'make'
        ? await makeLine(req.user, req.password, req.algo, req.cost)
        : await verifyLine(req.line, req.password);
    scope.postMessage({ id: req.id, ok: true, result });
  } catch (err) {
    scope.postMessage({ id: req.id, ok: false, error: err instanceof Error ? err.message : 'error' });
  }
});
