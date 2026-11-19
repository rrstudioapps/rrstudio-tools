// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import {
  SHORTCUT_ACTIONS,
  ShortcutAction,
  altShortcutKeys,
  ariaKeyShortcuts,
  findTarget,
  isTypingTarget,
  markedButtons,
  matchShortcut,
  shortcutKeys,
} from './shortcuts';

/** Quanto resta visibile il messaggio e quanto vale la conferma di "Pulisci" (ms). */
const MESSAGE_MS = 2500;
const CONFIRM_MS = 4000;

/**
 * Scorciatoie da tastiera dello strumento corrente (vedi shortcuts.ts). Va fornito dalla cornice `tool-frame`,
 * che gli passa il proprio elemento: i pulsanti marcati si cercano solo lì dentro. Il feedback sta in `message`
 * (da mostrare in una regione aria-live) e il pannello di aiuto si apre con `helpOpen`.
 */
@Injectable()
export class ShortcutsService {
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  readonly message = signal('');
  readonly helpOpen = signal(false);
  /** Mac (⌘, ⌥, ⇧) o altro: decide come si mostrano i tasti. */
  readonly mac = signal(false);
  private root: HTMLElement | null = null;
  private msgTimer: ReturnType<typeof setTimeout> | undefined;
  private clearArmedAt = 0;
  private observer: MutationObserver | undefined;
  private scanPending = false;

  /** Da chiamare nel browser, dopo il primo render della cornice. */
  attach(root: HTMLElement): void {
    this.root = root;
    this.mac.set(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    const onKey = (e: KeyboardEvent) => this.onKey(e);
    document.addEventListener('keydown', onKey);
    // aria-keyshortcuts sui pulsanti marcati, anche quelli che compaiono dopo (risultati, schede)
    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(root, { childList: true, subtree: true });
    this.scan();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', onKey);
      this.observer?.disconnect();
      clearTimeout(this.msgTimer);
    });
  }

  /** Azioni disponibili ora nello strumento (almeno un pulsante marcato), con i tasti da mostrare. */
  available(): { action: ShortcutAction; keys: string[]; alt: string[] | null }[] {
    if (!this.root) return [];
    return SHORTCUT_ACTIONS.filter((a) => markedButtons(this.root!, a).length > 0).map((action) => ({ action, keys: this.keys(action), alt: altShortcutKeys(action, this.mac(), { shift: this.i18n.t('shortcuts.key.shift') }) }));
  }

  keys(action: ShortcutAction): string[] {
    return shortcutKeys(action, this.mac(), { enter: this.i18n.t('shortcuts.key.enter'), shift: this.i18n.t('shortcuts.key.shift') });
  }

  openHelp(): void {
    this.helpOpen.set(true);
  }

  private onKey(e: KeyboardEvent): void {
    // niente mentre un pannello modale è aperto (aiuto, "Usa offline"): gestisce i tasti da sé
    if (e.defaultPrevented || this.helpOpen() || document.querySelector('dialog[open]')) return;
    const m = matchShortcut(e, isTypingTarget(e.target));
    if (!m || !this.root) return;
    if (m.kind === 'help') {
      e.preventDefault();
      this.openHelp();
      return;
    }
    const { present, target } = findTarget(this.root, m.action);
    // lo strumento non ha quell'azione: la combinazione resta al browser
    if (!present) return;
    e.preventDefault();
    if (!target) {
      this.say(this.i18n.t('shortcuts.unavailable'));
      return;
    }
    if (m.action === 'clear' && !this.confirmClear()) return;
    target.click();
    if (m.action === 'send') target.focus();
    // "Copia" si annuncia da sé (pulsante "Copiato"); le altre azioni hanno il loro messaggio
    if (m.action !== 'copy' && m.action !== 'next' && m.action !== 'prev') this.say(this.i18n.t('shortcuts.done.' + m.action));
  }

  /** Pulisci cancella dei dati: alla prima pressione chiede conferma (annunciata), alla seconda entro 4 s procede. */
  private confirmClear(): boolean {
    const now = Date.now();
    if (now - this.clearArmedAt <= CONFIRM_MS) {
      this.clearArmedAt = 0;
      return true;
    }
    this.clearArmedAt = now;
    this.say(this.i18n.t('shortcuts.confirmClear', { keys: this.keys('clear').join('+') }), CONFIRM_MS);
    return false;
  }

  private say(text: string, ms = MESSAGE_MS): void {
    this.message.set(text);
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => this.message.set(''), ms);
  }

  private scheduleScan(): void {
    if (this.scanPending) return;
    this.scanPending = true;
    queueMicrotask(() => {
      this.scanPending = false;
      this.scan();
    });
  }

  private scan(): void {
    if (!this.root) return;
    for (const action of SHORTCUT_ACTIONS) {
      for (const el of markedButtons(this.root, action)) {
        if (!el.hasAttribute('aria-keyshortcuts')) el.setAttribute('aria-keyshortcuts', ariaKeyShortcuts(action));
      }
    }
  }
}
