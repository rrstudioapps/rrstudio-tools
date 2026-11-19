// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, ElementRef, Injectable, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FavoritesService } from '../core/favorites/favorites.service';
import { I18nService } from '../core/i18n/i18n.service';
import { TOOLS, ToolDefinition } from '../tools/tools.registry';
import { Icon } from './icon';
import { PaletteItem, searchPalette } from './palette-search';
import { isTypingTarget } from './shortcuts';

/** Stato di apertura della palette: il pulsante dell'header e la scorciatoia lo accendono, il componente lo legge. */
@Injectable({ providedIn: 'root' })
export class PaletteService {
  readonly isOpen = signal(false);
  open(): void {
    this.isOpen.set(true);
  }
}

/**
 * Palette di ricerca globale (Ctrl/⌘+K): finestra modale con campo di ricerca e elenco degli strumenti
 * (pattern combobox + listbox, frecce, Invio, Esc). La scorciatoia non vale dentro i campi di testo e nella
 * home, dove Ctrl/⌘+K porta già il focus sulla ricerca della pagina. Tutto locale, niente richieste.
 */
@Component({
  selector: 'app-command-palette',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg class="palette" [attr.aria-label]="i18n.t('palette.title')" (close)="onClose()" (click)="onBackdrop($event)">
      <div class="field">
        <app-icon name="search" />
        <input
          #input
          type="text"
          role="combobox"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-controls="palette-list"
          aria-expanded="true"
          [attr.aria-activedescendant]="results().length ? 'palette-opt-' + active() : null"
          [attr.aria-label]="i18n.t('palette.label')"
          [placeholder]="i18n.t('palette.placeholder')"
          [value]="query()"
          (input)="onInput($event)"
          (keydown)="onKey($event)"
        />
      </div>
      <ul id="palette-list" role="listbox" [attr.aria-label]="i18n.t('palette.results')">
        @for (r of results(); track r.id; let i = $index) {
          <li
            role="option"
            [id]="'palette-opt-' + i"
            [class.on]="i === active()"
            [attr.aria-selected]="i === active()"
            (mousemove)="active.set(i)"
            (click)="go(r)"
          >
            <span class="t">{{ r.title }}</span>
            <span class="d">{{ r.description }}</span>
          </li>
        }
      </ul>
      <p class="status" role="status" aria-live="polite">{{ status() }}</p>
    </dialog>
  `,
  styles: `
    dialog {
      width: min(38rem, calc(100vw - 2 * var(--space-4)));
      margin-top: 12vh;
      padding: 0;
      background: var(--surface);
      color: var(--ink);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
    }
    dialog::backdrop {
      background: rgb(0 0 0 / 45%);
    }
    .field {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--line);
      color: var(--ink-2);
    }
    input {
      flex: 1;
      min-width: 0;
      border: 0;
      background: transparent;
      color: var(--ink);
      font: inherit;
      font-size: 1.05rem;
      outline: none;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: var(--space-2);
      max-height: min(50vh, 24rem);
      overflow-y: auto;
    }
    li {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      cursor: pointer;
    }
    li.on {
      background: var(--primary);
      color: var(--on-primary);
    }
    .t {
      font-weight: 600;
    }
    .d {
      font-size: var(--fs-xs);
      opacity: 0.8;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .status {
      margin: 0;
      padding: 0 var(--space-4) var(--space-3);
      font-size: var(--fs-xs);
      color: var(--ink-2);
    }
    @media print {
      :host {
        display: none;
      }
    }
  `,
})
export class CommandPalette {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly palette = inject(PaletteService);
  private readonly favorites = inject(FavoritesService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  protected readonly query = signal('');
  protected readonly active = signal(0);
  private restore: HTMLElement | null = null;

  /** Voci nella lingua corrente; gli strumenti solo italiani non si offrono in inglese. I preferiti vengono prima. */
  private readonly items = computed<(PaletteItem & { tool: ToolDefinition })[]>(() => {
    const en = this.i18n.lang() === 'en';
    const fav = this.favorites.favoriteSet();
    const list = TOOLS.filter((t) => !(en && t.italyOnly)).map((tool) => ({
      id: tool.id,
      tool,
      title: this.i18n.t(tool.titleKey),
      description: this.i18n.t(tool.descriptionKey),
      keywords: `${tool.keywords?.it ?? ''} ${tool.keywords?.en ?? ''}`,
    }));
    return [...list.filter((i) => fav.has(i.id)), ...list.filter((i) => !fav.has(i.id))];
  });
  protected readonly results = computed(() => searchPalette(this.items(), this.query()));
  protected readonly status = computed(() => {
    const n = this.results().length;
    return n === 0 ? this.i18n.t('palette.empty') : this.i18n.t(n === 1 ? 'palette.count.one' : 'palette.count', { n });
  });

  constructor() {
    effect(() => {
      const open = this.palette.isOpen();
      const d = this.dlg().nativeElement;
      if (open && !d.open) {
        this.restore = document.activeElement as HTMLElement | null;
        this.query.set('');
        this.active.set(0);
        d.showModal();
        this.input().nativeElement.focus();
      } else if (!open && d.open) d.close();
    });
    afterNextRender(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.defaultPrevented || e.isComposing || e.repeat) return;
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k' || (e.ctrlKey && e.metaKey)) return;
        // dentro i campi di testo e nei pannelli modali la combinazione non si tocca; nella home ci pensa la home
        if (isTypingTarget(e.target) || document.querySelector('dialog[open]') || this.i18n.slug() === '') return;
        e.preventDefault();
        this.palette.open();
      };
      document.addEventListener('keydown', onKey);
    });
  }

  protected onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.results().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (n) this.active.update((a) => (a + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
      this.scrollActive();
    } else if (e.key === 'Home' || e.key === 'End') {
      if (n && !this.query()) {
        e.preventDefault();
        this.active.set(e.key === 'Home' ? 0 : n - 1);
        this.scrollActive();
      }
    } else if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      const r = this.results()[this.active()];
      if (r) this.go(r);
    }
  }

  protected go(r: { tool: ToolDefinition }): void {
    this.restore = null; // si va altrove: il focus non torna al punto di partenza
    this.palette.isOpen.set(false);
    void this.router.navigateByUrl(r.tool.italyOnly ? '/' + r.tool.path : this.i18n.link(r.tool.path));
  }

  protected onClose(): void {
    this.palette.isOpen.set(false);
    this.restore?.focus();
    this.restore = null;
  }

  protected onBackdrop(e: MouseEvent): void {
    if (e.target === this.dlg().nativeElement) this.dlg().nativeElement.close();
  }

  private scrollActive(): void {
    queueMicrotask(() => document.getElementById('palette-opt-' + this.active())?.scrollIntoView({ block: 'nearest' }));
  }
}
