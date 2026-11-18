// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { KeyLike, altShortcutKeys, ariaKeyShortcuts, findTarget, isTypingTarget, matchShortcut, shortcutKeys } from './shortcuts';

function key(over: Partial<KeyLike>): KeyLike {
  return { key: '', code: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...over };
}

describe('matchShortcut', () => {
  it('Ctrl+Invio e ⌘+Invio eseguono, anche dentro un campo', () => {
    expect(matchShortcut(key({ code: 'Enter', key: 'Enter', ctrlKey: true }), true)).toEqual({ kind: 'action', action: 'run' });
    expect(matchShortcut(key({ code: 'Enter', key: 'Enter', metaKey: true }), false)).toEqual({ kind: 'action', action: 'run' });
    expect(matchShortcut(key({ code: 'NumpadEnter', key: 'Enter', ctrlKey: true }), true)).toEqual({ kind: 'action', action: 'run' });
  });

  it('Invio da solo, con Maiusc o a tasto tenuto premuto non esegue', () => {
    expect(matchShortcut(key({ code: 'Enter', key: 'Enter' }), true)).toBeNull();
    expect(matchShortcut(key({ code: 'Enter', key: 'Enter', ctrlKey: true, shiftKey: true }), true)).toBeNull();
    expect(matchShortcut(key({ code: 'Enter', key: 'Enter', ctrlKey: true, repeat: true }), true)).toBeNull();
  });

  it('Alt+Maiusc+C/D/S/X/O/P mappano sulle azioni', () => {
    const map = { KeyC: 'copy', KeyD: 'download', KeyS: 'swap', KeyX: 'clear', KeyO: 'send', KeyP: 'print' };
    for (const [code, action] of Object.entries(map)) {
      expect(matchShortcut(key({ code, altKey: true, shiftKey: true }), false)).toEqual({ kind: 'action', action });
      // anche dentro un campo: sono combinazioni con modificatori
      expect(matchShortcut(key({ code, altKey: true, shiftKey: true }), true)).toEqual({ kind: 'action', action });
    }
  });

  it('usa event.code: su macOS Option cambia il carattere di event.key', () => {
    expect(matchShortcut(key({ code: 'KeyC', key: 'Ç', altKey: true, shiftKey: true }), false)).toEqual({ kind: 'action', action: 'copy' });
    expect(matchShortcut(key({ code: 'KeyD', key: 'Î', altKey: true, shiftKey: true }), false)).toEqual({ kind: 'action', action: 'download' });
    // il carattere da solo non basta se il tasto fisico è un altro
    expect(matchShortcut(key({ code: 'KeyZ', key: 'c', altKey: true, shiftKey: true }), false)).toBeNull();
  });

  it('non scambia per scorciatoia Ctrl+Maiusc+C (devtools) né AltGr (Ctrl+Alt) né Alt senza Maiusc', () => {
    expect(matchShortcut(key({ code: 'KeyC', ctrlKey: true, shiftKey: true }), false)).toBeNull();
    expect(matchShortcut(key({ code: 'KeyC', ctrlKey: true, altKey: true, shiftKey: true }), false)).toBeNull();
    expect(matchShortcut(key({ code: 'KeyC', metaKey: true, altKey: true, shiftKey: true }), false)).toBeNull();
    expect(matchShortcut(key({ code: 'KeyC', altKey: true }), false)).toBeNull();
    expect(matchShortcut(key({ code: 'KeyC', shiftKey: true }), false)).toBeNull();
  });

  it('"?" apre l\'aiuto solo con il focus fuori dai campi', () => {
    const q = key({ key: '?', code: 'Slash', shiftKey: true });
    expect(matchShortcut(q, false)).toEqual({ kind: 'help' });
    expect(matchShortcut(q, true)).toBeNull();
    expect(matchShortcut(key({ key: '?', ctrlKey: true }), false)).toBeNull();
  });

  it('ignora la composizione (IME)', () => {
    expect(matchShortcut(key({ code: 'Enter', ctrlKey: true, isComposing: true }), true)).toBeNull();
    expect(matchShortcut(key({ code: 'KeyC', key: 'Process', altKey: true, shiftKey: true }), true)).toBeNull();
  });

  it('Esc non è mai una scorciatoia di azione', () => {
    expect(matchShortcut(key({ key: 'Escape', code: 'Escape' }), false)).toBeNull();
  });
});

describe('azioni successivo/precedente e specifiche', () => {
  it('F7 e Maiusc+F7: successivo e precedente, anche nei campi e a tasto tenuto premuto', () => {
    expect(matchShortcut(key({ code: 'F7', key: 'F7' }), false)).toEqual({ kind: 'action', action: 'next' });
    expect(matchShortcut(key({ code: 'F7', key: 'F7' }), true)).toEqual({ kind: 'action', action: 'next' });
    expect(matchShortcut(key({ code: 'F7', key: 'F7', shiftKey: true }), true)).toEqual({ kind: 'action', action: 'prev' });
    expect(matchShortcut(key({ code: 'F7', key: 'F7', repeat: true }), false)).toEqual({ kind: 'action', action: 'next' });
    expect(matchShortcut(key({ code: 'F7', ctrlKey: true }), false)).toBeNull();
    expect(matchShortcut(key({ code: 'F7', altKey: true }), false)).toBeNull();
  });

  it('Alt+Maiusc+freccia giù/su: solo fuori dai campi', () => {
    expect(matchShortcut(key({ code: 'ArrowDown', altKey: true, shiftKey: true }), false)).toEqual({ kind: 'action', action: 'next' });
    expect(matchShortcut(key({ code: 'ArrowUp', altKey: true, shiftKey: true }), false)).toEqual({ kind: 'action', action: 'prev' });
    expect(matchShortcut(key({ code: 'ArrowDown', altKey: true, shiftKey: true }), true)).toBeNull();
    expect(matchShortcut(key({ code: 'ArrowDown', altKey: true }), false)).toBeNull();
  });

  it('Alt+Maiusc+V/U/W/H: vista, comprimi, spazi, testi', () => {
    const map = { KeyV: 'toggle-view', KeyU: 'toggle-collapse', KeyW: 'toggle-ws', KeyH: 'toggle-inputs' };
    for (const [code, action] of Object.entries(map)) {
      expect(matchShortcut(key({ code, altKey: true, shiftKey: true }), true)).toEqual({ kind: 'action', action });
      expect(matchShortcut(key({ code, altKey: true, shiftKey: true, repeat: true }), true)).toBeNull();
    }
  });

  it('tasti mostrati e aria-keyshortcuts', () => {
    const words = { enter: 'Invio', shift: 'Maiusc' };
    expect(shortcutKeys('next', false, words)).toEqual(['F7']);
    expect(shortcutKeys('prev', false, words)).toEqual(['Maiusc', 'F7']);
    expect(shortcutKeys('prev', true, words)).toEqual(['⇧', 'F7']);
    expect(shortcutKeys('toggle-inputs', false, words)).toEqual(['Alt', 'Maiusc', 'H']);
    expect(altShortcutKeys('next', false, words)).toEqual(['Alt', 'Maiusc', '↓']);
    expect(altShortcutKeys('prev', true, words)).toEqual(['⌥', '⇧', '↑']);
    expect(altShortcutKeys('copy', false, words)).toBeNull();
    expect(ariaKeyShortcuts('next')).toBe('F7 Alt+Shift+ArrowDown');
    expect(ariaKeyShortcuts('prev')).toBe('Shift+F7 Alt+Shift+ArrowUp');
    expect(ariaKeyShortcuts('toggle-view')).toBe('Alt+Shift+V');
  });

  it('findTarget: un pulsante marcato "next" disabilitato è presente ma senza bersaglio', () => {
    const root = document.createElement('div');
    root.innerHTML = '<button data-shortcut="next" disabled></button>';
    document.body.appendChild(root);
    expect(findTarget(root, 'next')).toEqual({ present: true, target: null });
    expect(findTarget(root, 'prev').present).toBe(false);
    root.remove();
  });
});

describe('isTypingTarget', () => {
  it('riconosce input, textarea, select, contenteditable e role=textbox', () => {
    for (const html of ['<input>', '<textarea></textarea>', '<select></select>', '<div contenteditable="true"></div>', '<div role="textbox"></div>']) {
      const host = document.createElement('div');
      host.innerHTML = html;
      document.body.appendChild(host);
      const el = host.firstElementChild as HTMLElement;
      // jsdom non calcola isContentEditable: lo simuliamo come fa il browser
      if (el.getAttribute('contenteditable')) Object.defineProperty(el, 'isContentEditable', { value: true });
      expect(isTypingTarget(el), html).toBe(true);
      host.remove();
    }
    const btn = document.createElement('button');
    expect(isTypingTarget(btn)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('findTarget', () => {
  function build(html: string): HTMLElement {
    const root = document.createElement('div');
    root.innerHTML = html;
    document.body.appendChild(root);
    // jsdom non fa layout: ogni elemento risulta "a video" salvo display:none, che simuliamo sui getClientRects
    root.querySelectorAll<HTMLElement>('*').forEach((el) => {
      el.getClientRects = () => ((el.style.display === 'none' || el.closest('[style*="display: none"]') ? [] : [{}]) as unknown as DOMRectList);
    });
    return root;
  }

  it('sceglie il primo pulsante marcato, abilitato e visibile', () => {
    const root = build(`
      <button data-shortcut="copy" disabled id="a"></button>
      <button data-shortcut="copy" style="display:none" id="b"></button>
      <button data-shortcut="copy" aria-disabled="true" id="c"></button>
      <div hidden><button data-shortcut="copy" id="d"></button></div>
      <button data-shortcut="copy" id="e"></button>
      <button data-shortcut="copy" id="f"></button>`);
    const r = findTarget(root, 'copy');
    expect(r.present).toBe(true);
    expect(r.target?.id).toBe('e');
    root.remove();
  });

  it('se tutti sono disabilitati o nascosti: presente ma nessun bersaglio', () => {
    const root = build('<button data-shortcut="download" disabled></button><button data-shortcut="download" style="display:none"></button>');
    expect(findTarget(root, 'download')).toEqual({ present: true, target: null });
    root.remove();
  });

  it('senza pulsanti marcati l\'azione non è presente (la combinazione resta al browser)', () => {
    const root = build('<button data-shortcut="copy"></button>');
    expect(findTarget(root, 'swap')).toEqual({ present: false, target: null });
    root.remove();
  });
});

describe('testi dei tasti', () => {
  const words = { enter: 'Invio', shift: 'Maiusc' };
  it('mostra i nomi altrove e i simboli su Mac', () => {
    expect(shortcutKeys('run', false, words)).toEqual(['Ctrl', 'Invio']);
    expect(shortcutKeys('run', true, words)).toEqual(['⌘', 'Invio']);
    expect(shortcutKeys('copy', false, words)).toEqual(['Alt', 'Maiusc', 'C']);
    expect(shortcutKeys('clear', true, words)).toEqual(['⌥', '⇧', 'X']);
  });
  it('aria-keyshortcuts in inglese', () => {
    expect(ariaKeyShortcuts('run')).toBe('Control+Enter Meta+Enter');
    expect(ariaKeyShortcuts('download')).toBe('Alt+Shift+D');
  });
});
