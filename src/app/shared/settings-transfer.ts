// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ChainsService } from '../core/chains/chains.service';
import { FavoritesService } from '../core/favorites/favorites.service';
import { I18nService } from '../core/i18n/i18n.service';
import { exportSettings, parseSettings, Settings } from '../core/settings/settings.logic';
import { MAX_IMPORT_CHARS } from '../core/favorites/favorites.logic';
import { ThemeService } from '../core/theme/theme.service';
import { saveBytes } from './download';
import { Icon } from './icon';

const HINT_KEY = 'rrtools.hint.en';

/**
 * Esporta e importa tutte le impostazioni (tema, barra «available in English», preferiti e menu, catene) in un
 * solo file JSON, per passare da un dispositivo all'altro. Mai bozze né dati degli strumenti. L'importazione
 * mostra prima che cosa verrà sostituito e chiede conferma.
 */
@Component({
  selector: 'app-settings-transfer',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="actions">
      <button type="button" class="btn" (click)="exportFile()"><app-icon name="download" /> {{ i18n.t('settings.export') }}</button>
      <button type="button" class="btn" (click)="file.click()"><app-icon name="upload" /> {{ i18n.t('settings.import') }}</button>
      <input #file type="file" class="visually-hidden" tabindex="-1" accept=".json,application/json" [attr.aria-label]="i18n.t('settings.import')" (change)="onFile($event)" />
    </div>
    @if (pending(); as p) {
      <div class="preview" role="group" aria-labelledby="settings-imp-h">
        <h3 id="settings-imp-h" tabindex="-1">{{ i18n.t('settings.import.title') }}</h3>
        <p>{{ i18n.t('settings.import.from', { name: name() }) }}</p>
        <ul>
          @if (p.theme) {
            <li>{{ i18n.t('settings.theme', { v: i18n.t('settings.theme.' + p.theme) }) }}</li>
          }
          @if (p.hintEnDismissed) {
            <li>{{ i18n.t('settings.hint') }}</li>
          }
          @if (p.favorites; as f) {
            <li>{{ i18n.t('settings.favs', { f: f.favorites.length, g: f.groups.length }) }}</li>
          }
          @if (p.chains; as c) {
            <li>{{ i18n.t('settings.chains', { n: c.length }) }}</li>
          }
        </ul>
        <p>{{ i18n.t('settings.import.replace') }}</p>
        @if (dropped() > 0) {
          <p class="muted">{{ i18n.t('settings.import.dropped', { n: dropped() }) }}</p>
        }
        <div class="actions">
          <button type="button" class="btn" (click)="apply()">{{ i18n.t('settings.import.confirm') }}</button>
          <button type="button" class="btn" (click)="pending.set(null)">{{ i18n.t('settings.import.cancel') }}</button>
        </div>
      </div>
    }
    <p class="notice" [class.err]="notice().error" role="status" aria-live="polite">{{ notice().text }}</p>
  `,
  styles: `
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: var(--space-2) 0;
    }
    .preview {
      margin: var(--space-3) 0;
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--surface);
    }
    h3 {
      margin: 0 0 var(--space-2);
      font-size: 1rem;
    }
    .muted {
      color: var(--ink-2);
    }
    .notice.err {
      color: var(--danger, #b3261e);
    }
    .notice:empty {
      display: none;
    }
  `,
})
export class SettingsTransfer {
  protected readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private readonly fav = inject(FavoritesService);
  private readonly chains = inject(ChainsService);
  protected readonly pending = signal<Settings | null>(null);
  protected readonly dropped = signal(0);
  protected readonly name = signal('');
  protected readonly notice = signal<{ text: string; error: boolean }>({ text: '', error: false });

  private hintDismissed(): boolean {
    try {
      return localStorage.getItem(HINT_KEY) === '1';
    } catch {
      return false;
    }
  }

  protected exportFile(): void {
    let storedTheme: 'light' | 'dark' | null = null;
    try {
      const v = localStorage.getItem('rrtools.theme');
      if (v === 'light' || v === 'dark') storedTheme = v;
    } catch {
      /* nessun tema salvato */
    }
    const text = exportSettings({ theme: storedTheme, hintEnDismissed: this.hintDismissed(), favorites: this.fav.state(), chains: this.chains.saved() });
    saveBytes(new Blob([text], { type: 'application/json' }), 'rrstudio-tools-settings.json', 'application/json');
    this.notice.set({ text: this.i18n.t('settings.exported'), error: false });
  }

  protected async onFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.pending.set(null);
    if (file.size > MAX_IMPORT_CHARS * 8) return this.fail('tooBig');
    let text: string;
    try {
      text = await file.text();
    } catch {
      return this.fail('read');
    }
    const r = parseSettings(text, this.fav.known);
    if (!r.ok) return this.fail(r.error);
    this.notice.set({ text: '', error: false });
    this.name.set(file.name);
    this.dropped.set(r.dropped);
    this.pending.set(r.settings);
    setTimeout(() => document.getElementById('settings-imp-h')?.focus());
  }

  private fail(code: string): void {
    this.notice.set({ text: this.i18n.t('settings.err.' + code), error: true });
  }

  protected apply(): void {
    const p = this.pending();
    if (!p) return;
    if (p.theme) this.theme.set(p.theme);
    if (p.hintEnDismissed) {
      try {
        localStorage.setItem(HINT_KEY, '1');
      } catch {
        /* chiusura non ricordata */
      }
    }
    if (p.favorites) this.fav.replace(p.favorites);
    if (p.chains) this.chains.replaceSaved(p.chains);
    this.pending.set(null);
    this.notice.set({ text: this.i18n.t('settings.imported'), error: false });
  }
}
