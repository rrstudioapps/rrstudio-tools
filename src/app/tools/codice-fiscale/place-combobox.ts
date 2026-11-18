// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import type { Place, PlacesIndex } from './places';

let nextId = 0;

/**
 * Casella di ricerca con suggerimenti (pattern ARIA "combobox con listbox", ARIA 1.2):
 * frecce su/giù per scorrere, Invio per scegliere, Esc per chiudere. I suggerimenti vengono annunciati ai lettori di schermo.
 */
@Component({
  selector: 'app-place-combobox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="lbl" [attr.for]="id">{{ label() }}</label>
    <div class="combo">
      <input
        type="text"
        role="combobox"
        class="field"
        [id]="id"
        [value]="text()"
        [placeholder]="placeholder()"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="activeId()"
        [attr.aria-describedby]="describedBy() || null"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        aria-autocomplete="list"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        (input)="onInput($any($event.target).value)"
        (keydown)="onKey($event)"
        (focus)="onFocus()"
        (blur)="close()"
      />
      <ul class="list" role="listbox" [id]="listId" [attr.aria-label]="label()" [hidden]="!open()">
        @for (o of options(); track o.code + o.name; let i = $index) {
          <li
            role="option"
            class="opt"
            [id]="optionId(i)"
            [class.active]="i === active()"
            [attr.aria-selected]="i === active()"
            (mousedown)="$event.preventDefault(); choose(o)"
          >
            <span class="name">{{ o.name }}</span>
            <span class="meta">{{ meta(o) }}</span>
          </li>
        }
      </ul>
    </div>
    <span class="visually-hidden" role="status" aria-live="polite">{{ announce() }}</span>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      min-width: 0;
    }
    .lbl {
      font-size: var(--fs-sm);
      color: var(--ink-2);
    }
    .combo {
      position: relative;
    }
    .field {
      width: 100%;
    }
    .list {
      position: absolute;
      z-index: 20;
      inset-inline: 0;
      top: calc(100% + 4px);
      margin: 0;
      padding: var(--space-1);
      list-style: none;
      max-height: 280px;
      overflow-y: auto;
      border: 1px solid var(--ink);
      border-radius: var(--radius-sm);
      background: var(--surface);
      &[hidden] {
        display: none;
      }
    }
    .opt {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border-radius: 6px;
      cursor: pointer;
      font-size: var(--fs-sm);
      &.active {
        background: var(--ink);
        color: var(--bg);
      }
    }
    .name {
      overflow-wrap: anywhere;
    }
    .meta {
      flex: none;
      font-family: var(--mono);
      font-size: var(--fs-xs);
      opacity: 0.75;
    }
  `,
})
export class PlaceCombobox {
  protected readonly i18n = inject(I18nService);
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly index = input<PlacesIndex | null>(null);
  readonly kinds = input.required<readonly Place['kind'][]>();
  readonly invalid = input(false);
  readonly describedBy = input('');
  /** Testo da mostrare nella casella quando la pagina sceglie il luogo da sola (per esempio da un link condiviso). */
  readonly preset = input('');
  /** Luogo scelto (o null quando il testo cambia dopo una scelta). */
  readonly picked = output<Place | null>();
  /** Il campo ha preso il focus: la pagina può caricare l'elenco dei luoghi. */
  readonly wanted = output<void>();

  private readonly uid = nextId++;
  protected readonly id = `place-cb-${this.uid}`;
  protected readonly listId = `${this.id}-list`;
  protected readonly text = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  private readonly query = signal('');

  protected readonly options = computed<Place[]>(() => {
    const idx = this.index();
    const q = this.query();
    return idx && q ? idx.search(q, this.kinds()) : [];
  });
  protected readonly activeId = computed(() => (this.open() && this.options().length ? this.optionId(this.active()) : null));
  protected readonly announce = computed(() => {
    if (!this.open() && !this.query()) return '';
    if (!this.index()) return this.i18n.t('cf.place.loading');
    const n = this.options().length;
    return n ? this.i18n.t('cf.place.count', { n }) : this.query() ? this.i18n.t('cf.place.none') : '';
  });

  constructor() {
    effect(() => {
      const v = this.preset();
      if (v) untracked(() => this.text.set(v));
    });
    // quando cambiano i risultati si riparte dal primo
    effect(() => {
      this.options();
      untracked(() => this.active.set(0));
    });
  }

  protected optionId(i: number): string {
    return `${this.id}-opt-${i}`;
  }

  protected meta(p: Place): string {
    if (p.kind === 'estero') return p.code;
    const sopp = p.kind === 'soppresso' ? ` · ${this.i18n.t('cf.place.suppressed')}${p.year ? ' ' + p.year : ''}` : '';
    return `${p.sigla || '—'} · ${p.code}${sopp}`;
  }

  /** Testo mostrato nella casella dopo una scelta. */
  display(p: Place): string {
    return p.kind === 'estero' ? p.name : `${p.name}${p.sigla ? ` (${p.sigla})` : ''}`;
  }

  protected onFocus(): void {
    this.wanted.emit();
    if (this.query() && this.options().length) this.open.set(true);
  }

  protected onInput(v: string): void {
    this.text.set(v);
    this.query.set(v.trim());
    this.picked.emit(null);
    this.open.set(!!v.trim());
    this.wanted.emit();
  }

  protected close(): void {
    this.open.set(false);
  }

  protected choose(p: Place): void {
    this.text.set(this.display(p));
    this.query.set('');
    this.open.set(false);
    this.picked.emit(p);
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.options().length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open()) {
          if (this.text().trim()) this.open.set(true);
          this.query.set(this.text().trim());
        } else if (n) this.active.set((this.active() + 1) % n);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (this.open() && n) this.active.set((this.active() - 1 + n) % n);
        break;
      case 'Enter':
        if (this.open() && n) {
          e.preventDefault();
          this.choose(this.options()[this.active()]);
        }
        break;
      case 'Escape':
        if (this.open()) {
          e.preventDefault();
          this.open.set(false);
        }
        break;
    }
  }
}
