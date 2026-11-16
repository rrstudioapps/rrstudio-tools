// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { I18nService, Lang } from '../i18n/i18n.service';
import { Alternate, hasLang, hreflangLinks, publicUrl } from '../i18n/lang-routing';
import { SITE_URL } from '../links';

/** Dati SEO di una route (chiavi i18n), da mettere in `data.seo`. */
export interface SeoData {
  titleKey: string;
  descriptionKey: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);

  private readonly current = signal<SeoData | null>(null);

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        const seo = this.findSeo(this.router.routerState.snapshot.root);
        if (seo) this.current.set(seo);
      }
    });
    // Si riapplica anche al cambio lingua
    effect(() => {
      const c = this.current();
      if (c) this.apply(c, this.i18n.slug(), this.i18n.lang());
    });
  }

  private findSeo(snap: ActivatedRouteSnapshot): SeoData | null {
    let found: SeoData | null = (snap.data['seo'] as SeoData | undefined) ?? null;
    for (const child of snap.children) found = this.findSeo(child) ?? found;
    return found;
  }

  private apply(seo: SeoData, slug: string, lang: Lang): void {
    const title = this.i18n.t(seo.titleKey);
    const description = this.i18n.t(seo.descriptionKey);
    const url = publicUrl(slug, lang);
    // Immagine social della pagina corrente (scripts/og-images.mjs); la home e le pagine senza immagine usano quella generica
    const image = slug !== '' && hasLang(slug, lang) ? `${SITE_URL}/og/${lang}/${slug}.png` : `${SITE_URL}/og-image.png`;
    this.title.setTitle(title);
    const tags: [string, string, 'name' | 'property'][] = [
      ['description', description, 'name'],
      ['og:title', title, 'property'],
      ['og:description', description, 'property'],
      ['og:type', 'website', 'property'],
      ['og:url', url, 'property'],
      ['og:image', image, 'property'],
      ['og:image:width', '1200', 'property'],
      ['og:image:height', '630', 'property'],
      ['og:image:alt', title, 'property'],
      ['og:locale', lang === 'it' ? 'it_IT' : 'en_US', 'property'],
      ['twitter:card', 'summary_large_image', 'name'],
      ['twitter:title', title, 'name'],
      ['twitter:description', description, 'name'],
      ['twitter:image', image, 'name'],
      ['twitter:image:alt', title, 'name'],
    ];
    for (const [key, content, attr] of tags) {
      this.meta.updateTag({ [attr]: key, content }, `${attr}='${key}'`);
    }
    this.setCanonical(url);
    this.setAlternates(hreflangLinks(slug));
  }

  private setCanonical(url: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /** Sostituisce i link hreflang con quelli della pagina corrente. */
  private setAlternates(alts: Alternate[]): void {
    this.doc.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((l) => l.remove());
    for (const a of alts) {
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', a.hreflang);
      link.setAttribute('href', a.href);
      this.doc.head.appendChild(link);
    }
  }
}
