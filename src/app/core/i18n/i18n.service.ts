// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { DOCUMENT, PlatformLocation } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { RoutesRecognized, Router } from '@angular/router';
import { en } from './en';
import { it } from './it';
import { Lang, LANGS, alternatePath, langFromPath, routePath, slugFromPath } from './lang-routing';

export { LANGS };
export type { Lang };
export type Dictionary = Record<string, string>;
/** Dizionari aggiuntivi di un singolo tool (stesse chiavi in entrambe le lingue). */
export type ToolDictionaries = Record<Lang, Dictionary>;

/**
 * La lingua la decide l'URL (radice = italiano, /en/… = inglese), anche durante il prerender:
 * nessuna preferenza salvata e nessuna lingua del browser cambiano una pagina.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly initialPath = inject(PlatformLocation).pathname;
  readonly lang = signal<Lang>(langFromPath(this.initialPath));
  /** Slug della pagina corrente senza prefisso di lingua ('' = home). */
  readonly slug = signal<string>(slugFromPath(this.initialPath));
  /** Locale BCP 47 per Intl. */
  readonly locale = computed(() => (this.lang() === 'it' ? 'it-IT' : 'en-GB'));
  /** La stessa pagina nell'altra lingua (null: strumento solo italiano). */
  readonly otherLang = computed<Lang>(() => (this.lang() === 'it' ? 'en' : 'it'));
  readonly otherPath = computed(() => alternatePath(routePath(this.slug(), this.lang()), this.otherLang()));
  private readonly extra = signal<ToolDictionaries[]>([]);

  constructor() {
    effect(() => {
      this.doc.documentElement.lang = this.lang();
    });
    // prima dell'attivazione dei componenti, dopo i redirect (/en/sconosciuto → /en)
    this.router.events.subscribe((e) => {
      if (e instanceof RoutesRecognized) {
        this.lang.set(langFromPath(e.urlAfterRedirects));
        this.slug.set(slugFromPath(e.urlAfterRedirects));
      }
    });
  }

  /** Percorso (per routerLink) di una pagina nella lingua corrente: link('') = home, link('pdf-tools'). */
  link(slug: string): string {
    return routePath(slug, this.lang());
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
