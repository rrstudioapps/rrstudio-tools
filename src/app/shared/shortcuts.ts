// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Scorciatoie da tastiera comuni agli strumenti. Le pagine non contengono logica: i pulsanti si marcano con
 * `data-shortcut="<azione>"` e il servizio (`shortcuts.service.ts`) clicca il primo marcato, visibile e abilitato.
 *
 * Scelta dei tasti (nessun conflitto noto con browser e lettori di schermo):
 * - Ctrl/⌘+Invio: esegui/genera (convenzione diffusa nei campi di testo multilinea);
 * - Alt+Maiusc+C/D/S/X/O: copia, scarica, scambia, pulisci, invia. NON Ctrl+Maiusc+C (apre i devtools in Chrome) e
 *   niente Alt+Maiusc+I/T/A/B (feedback, barra degli strumenti, dialog inattivo, preferiti in Chrome/Edge); i lettori
 *   di schermo usano Insert/CapsLock, non Alt+Maiusc;
 * - `?` apre l'aiuto, ma solo con il focus fuori dai campi (altrimenti impedirebbe di scrivere il carattere);
 * - Esc chiude pannelli e menu e non cancella mai i dati.
 * Con Alt si legge `event.code` (la posizione fisica del tasto): su macOS Option cambia il carattere in `event.key`.
 */
export type ShortcutAction = 'run' | 'copy' | 'download' | 'swap' | 'clear' | 'send';

export const SHORTCUT_ACTIONS: readonly ShortcutAction[] = ['run', 'copy', 'download', 'swap', 'clear', 'send'];

/** Tasto fisico (`event.code`) delle combinazioni Alt+Maiusc+<tasto>. */
const ALT_SHIFT_CODES: Record<Exclude<ShortcutAction, 'run'>, string> = {
  copy: 'KeyC',
  download: 'KeyD',
  swap: 'KeyS',
  clear: 'KeyX',
  send: 'KeyO',
};

/** Parte di KeyboardEvent che serve al riconoscimento (permette di provarlo senza eventi veri). */
export interface KeyLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat?: boolean;
  isComposing?: boolean;
}

export type ShortcutMatch = { kind: 'action'; action: ShortcutAction } | { kind: 'help' };

/** Quale scorciatoia (se una) corrisponde al tasto premuto; `typing` = il focus è in un campo di testo. */
export function matchShortcut(e: KeyLike, typing: boolean): ShortcutMatch | null {
  if (e.isComposing || e.key === 'Process') return null;
  // Ctrl/⌘+Invio: vale anche dentro i campi, ma non con Alt/Maiusc né a tasto tenuto premuto
  if ((e.code === 'Enter' || e.code === 'NumpadEnter') && (e.ctrlKey || e.metaKey) && !(e.ctrlKey && e.metaKey) && !e.altKey && !e.shiftKey) {
    return e.repeat ? null : { kind: 'action', action: 'run' };
  }
  // Alt+Maiusc+tasto, senza Ctrl/⌘ (su Windows AltGr = Ctrl+Alt: non va scambiato per una scorciatoia)
  if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) {
    if (e.repeat) return null;
    for (const action of SHORTCUT_ACTIONS) {
      if (action !== 'run' && ALT_SHIFT_CODES[action] === e.code) return { kind: 'action', action };
    }
    return null;
  }
  // "?" (Maiusc+/ o il tasto dedicato): solo fuori dai campi e senza altri modificatori
  if (e.key === '?' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) return { kind: 'help' };
  return null;
}

/** Il focus è in un campo dove i tasti singoli vanno lasciati alla digitazione. */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.getAttribute('role') === 'textbox';
}

/** Pulsante che si può premere ora: abilitato e a video (non nascosto, non in un'area `hidden`/`inert`). */
export function isActionable(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return false;
  if (el.closest('[hidden], [inert]')) return false;
  if (el.getClientRects().length === 0) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

/** Pulsanti marcati con l'azione dentro `root`, nell'ordine del documento. */
export function markedButtons(root: ParentNode, action: ShortcutAction): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[data-shortcut="${action}"]`));
}

/** `present`: lo strumento ha almeno un pulsante marcato; `target`: il primo utilizzabile ora. */
export function findTarget(root: ParentNode, action: ShortcutAction): { present: boolean; target: HTMLElement | null } {
  const all = markedButtons(root, action);
  return { present: all.length > 0, target: all.find(isActionable) ?? null };
}

/** Parti della combinazione da mostrare (Mac: simboli; altrove: nomi). `enter`/`shift` sono tradotti da chi chiama. */
export function shortcutKeys(action: ShortcutAction, mac: boolean, words: { enter: string; shift: string }): string[] {
  if (action === 'run') return mac ? ['⌘', words.enter] : ['Ctrl', words.enter];
  const letter = ALT_SHIFT_CODES[action].replace('Key', '');
  return mac ? ['⌥', '⇧', letter] : ['Alt', words.shift, letter];
}

/** Valore di `aria-keyshortcuts` (nomi dei tasti in inglese, come richiede la specifica). */
export function ariaKeyShortcuts(action: ShortcutAction): string {
  return action === 'run' ? 'Control+Enter Meta+Enter' : `Alt+Shift+${ALT_SHIFT_CODES[action].replace('Key', '')}`;
}
