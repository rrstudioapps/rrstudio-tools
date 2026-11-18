// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { JsonDiffOptions, Outcome, compareTexts } from './json-diff';

export interface JsonDiffRequest {
  id: number;
  a: string;
  b: string;
  options: JsonDiffOptions;
}
export type JsonDiffResponse = { id: number; ok: true; outcome: Outcome } | { id: number; ok: false; error: string };

const scope = self as unknown as {
  addEventListener(type: 'message', fn: (e: MessageEvent<JsonDiffRequest>) => void): void;
  postMessage(msg: JsonDiffResponse): void;
};

scope.addEventListener('message', (e) => {
  const { id, a, b, options } = e.data;
  try {
    scope.postMessage({ id, ok: true, outcome: compareTexts(a, b, options) });
  } catch (err) {
    scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : 'json-diff' });
  }
});
