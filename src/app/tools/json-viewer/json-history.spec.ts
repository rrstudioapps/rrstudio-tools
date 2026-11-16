// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, createHistory, pushState, redo, undo } from './json-history';

describe('cronologia', () => {
  it('parte senza undo né redo', () => {
    const h = createHistory('a');
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
  it('annulla e ripeti', () => {
    let h = createHistory(1);
    h = pushState(h, 2);
    h = pushState(h, 3);
    expect(h.present).toBe(3);
    h = undo(h);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    h = redo(h);
    expect(h.present).toBe(3);
    expect(canRedo(h)).toBe(false);
  });
  it('un nuovo stato dopo un annulla azzera il ripeti', () => {
    let h = pushState(pushState(createHistory(1), 2), 3);
    h = undo(h);
    h = pushState(h, 9);
    expect(canRedo(h)).toBe(false);
    expect(h.present).toBe(9);
    expect(undo(h).present).toBe(2);
  });
  it('lo stesso riferimento non crea una voce', () => {
    const o = {};
    const h = createHistory(o);
    expect(pushState(h, o)).toBe(h);
  });
  it('rispetta il limite scartando i più vecchi', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 10; i++) h = pushState(h, i, 3);
    expect(h.past).toEqual([7, 8, 9]);
    expect(h.present).toBe(10);
    h = undo(undo(undo(h)));
    expect(h.present).toBe(7);
    expect(canUndo(h)).toBe(false);
  });
  it('non modifica gli oggetti di partenza', () => {
    const h = createHistory(1);
    const h2 = pushState(h, 2);
    expect(h.past).toEqual([]);
    expect(h2.past).toEqual([1]);
  });
});
