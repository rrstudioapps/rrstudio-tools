// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { DiffModel, DiffOptions, computeDiff } from './diff-core';

export interface DiffRequest {
  id: number;
  a: string;
  b: string;
  options: DiffOptions;
}
export type DiffResponse = { id: number; ok: true; model: DiffModel } | { id: number; ok: false; error: string };

const scope = self as unknown as {
  addEventListener(type: 'message', fn: (e: MessageEvent<DiffRequest>) => void): void;
  postMessage(msg: DiffResponse): void;
};

scope.addEventListener('message', (e) => {
  const { id, a, b, options } = e.data;
  try {
    scope.postMessage({ id, ok: true, model: computeDiff(a, b, options) });
  } catch (err) {
    scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : 'diff' });
  }
});
