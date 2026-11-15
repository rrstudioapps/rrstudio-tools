// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { en } from './en';
import { it } from './it';

export type Lang = 'it' | 'en';
export const LANGS: readonly Lang[] = ['it', 'en'];
export type Dictionary = Record<string, string>;
/** Dizionari aggiuntivi di un singolo tool (stesse chiavi in entrambe le lingue). */
export type ToolDictionaries = Record<Lang, Dictionary>;

const STORAGE_KEY = 'rrtools.lang';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly doc = inject(DOCUMENT);
  readonly lang = signal<Lang>('it');
  /** Locale BCP 47 per Intl. */
  readonly locale = computed(() => (this.lang() === 'it' ? 'it-IT' : 'en-GB'));
  private readonly extra = signal<ToolDictionaries[]>([]);

  constructor() {
    effect(() => {
      this.doc.documentElement.lang = this.lang();
    });
  }

  /** Da chiamare solo nel browser: lingua salvata oppure quella del browser. */
  initFromBrowser(): void {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage non disponibile: si usa la lingua del browser */
    }
    if (saved === 'it' || saved === 'en') {
      this.lang.set(saved);
      return;
    }
    const nav = (typeof navigator !== 'undefined' ? navigator.language : 'it') || 'it';
    this.lang.set(nav.toLowerCase().startsWith('it') ? 'it' : 'en');
  }

  setLang(lang: Lang): void {
    this.lang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* preferenza non salvata */
    }
  }

  /** Registra i dizionari di un tool (idempotente). */
  register(dicts: ToolDictionaries): void {
    if (!this.extra().includes(dicts)) this.extra.update((list) => [...list, dicts]);
  }

  /** Traduce una chiave, con segnaposto {nome}. Legge i signal: reattivo nei template. */
  t(key: string, params?: Record<string, string | number>): string {
    const lang = this.lang();
    const base: Dictionary = lang === 'it' ? it : en;
    let text = base[key];
    if (text === undefined) {
      for (const d of this.extra()) {
        const v = d[lang][key];
        if (v !== undefined) {
          text = v;
          break;
        }
      }
    }
    text ??= key;
    if (params) {
      for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
    }
    return text;
  }
}
