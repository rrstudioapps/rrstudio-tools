// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ToolHandoff } from './tool-handoff';

@Component({ template: '' })
class Dummy {}

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'a', component: Dummy },
        { path: 'b', component: Dummy },
        { path: 'c', component: Dummy },
      ]),
    ],
  });
  return { handoff: TestBed.inject(ToolHandoff), router: TestBed.inject(Router) };
}

describe('ToolHandoff', () => {
  it('consegna il contenuto una sola volta (take-and-clear)', () => {
    const { handoff } = setup();
    expect(handoff.offer({ kind: 'json', text: '{"a":1}', from: 'json-formatter' }, 'json-viewer')).toBe(true);
    expect(handoff.take('json-viewer')?.text).toBe('{"a":1}');
    expect(handoff.take('json-viewer')).toBeNull();
    expect(handoff.received()?.from).toBe('json-formatter');
  });

  it('lo consegna solo allo strumento destinatario', () => {
    const { handoff } = setup();
    handoff.offer({ kind: 'text', text: 'ciao', from: 'base64' }, 'word-counter');
    expect(handoff.take('sort-lines')).toBeNull();
    expect(handoff.take('word-counter')?.text).toBe('ciao');
  });

  it('rifiuta i contenuti incompatibili o vuoti', () => {
    const { handoff } = setup();
    expect(handoff.offer({ kind: 'text', text: 'x', from: 'base64' }, 'image-crop')).toBe(false);
    expect(handoff.offer({ kind: 'image', files: [], from: 'image-crop' }, 'image-compressor')).toBe(false);
    expect(handoff.hasPending).toBe(false);
  });

  it('tiene un solo contenuto: il nuovo sostituisce il vecchio', () => {
    const { handoff } = setup();
    handoff.offer({ kind: 'text', text: 'uno', from: 'base64' }, 'sort-lines');
    handoff.offer({ kind: 'text', text: 'due', from: 'base64' }, 'sort-lines');
    expect(handoff.take('sort-lines')?.text).toBe('due');
    expect(handoff.take('sort-lines')).toBeNull();
  });

  it('scade con la navigazione successiva se non viene preso', async () => {
    const { handoff, router } = setup();
    handoff.offer({ kind: 'text', text: 'x', from: 'base64' }, 'sort-lines');
    await router.navigateByUrl('/a');
    // lo strumento di destinazione si crea dopo NavigationEnd: qui il contenuto è ancora disponibile
    expect(handoff.hasPending).toBe(true);
    await router.navigateByUrl('/b');
    expect(handoff.hasPending).toBe(false);
    expect(handoff.take('sort-lines')).toBeNull();
  });

  it("l'avviso di ricezione sparisce alla navigazione successiva", async () => {
    const { handoff, router } = setup();
    await router.navigateByUrl('/a');
    handoff.offer({ kind: 'text', text: 'x', from: 'base64' }, 'sort-lines');
    handoff.take('sort-lines');
    expect(handoff.received()).not.toBeNull();
    await router.navigateByUrl('/b');
    expect(handoff.received()).toBeNull();
  });
});
