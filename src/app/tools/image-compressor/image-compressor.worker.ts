// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ProcessRequest, ProcessResult, processImage } from './image-processor';

export interface WorkerRequest extends ProcessRequest {
  id: number;
}
export type WorkerResponse =
  | { id: number; ok: true; result: ProcessResult }
  | { id: number; ok: false; error: string };

const scope = self as unknown as {
  addEventListener(type: 'message', fn: (e: MessageEvent<WorkerRequest>) => void): void;
  postMessage(msg: WorkerResponse): void;
};

scope.addEventListener('message', async (e) => {
  const { id, ...req } = e.data;
  try {
    scope.postMessage({ id, ok: true, result: await processImage(req) });
  } catch (err) {
    scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : 'decode' });
  }
});
