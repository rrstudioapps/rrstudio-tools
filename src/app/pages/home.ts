// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService } from '../core/i18n/i18n.service';
import { CATEGORIES, TOOLS, ToolCategory, ToolCategoryId, ToolDefinition } from '../tools/tools.registry';
import { categoryFromUrl, filterTools, groupByCategory } from './tool-filter';

interface Pill {
  id: ToolCategoryId | null;
  label: string;
  count: number;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly i18n = inject(I18nService);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);

  /** In /en/ niente strumenti italyOnly né la loro categoria: restano in una riga discreta in fondo. */
  protected readonly english = computed(() => this.i18n.lang() === 'en');
  protected readonly italyTools: readonly ToolDefinition[] = TOOLS.filter((t) => t.italyOnly);
  private readonly shownTools = computed(() => (this.english() ? TOOLS.filter((t) => !t.italyOnly) : TOOLS));
  private readonly shownCategories = computed(() =>
    this.english() ? CATEGORIES.filter((c) => TOOLS.some((t) => !t.italyOnly && t.category === c.id)) : CATEGORIES,
  );

  /** Ordine di visualizzazione = ordine delle categorie: dà anche la numerazione 01, 02… */
  protected readonly ordered = computed(() =>
    groupByCategory(this.shownTools(), this.shownCategories()).flatMap((g) => g.tools),
  );
  protected readonly total = computed(() => this.ordered().length);
  protected readonly numbers = computed(() => new Map(this.ordered().map((t, i) => [t.id, i + 1])));

  /** Il filtro si applica solo nel browser, dopo l'idratazione: il prerender mostra tutto (SEO). */
  private readonly ready = signal(false);
  private readonly urlCategory = signal<ToolCategoryId | null>(null);
  protected readonly query = signal('');
  protected readonly category = computed(() => (this.ready() ? this.urlCategory() : null));

  private readonly matches = computed(() => {
    const q = this.ready() ? this.query() : '';
    return filterTools(this.ordered(), null, q, (t) => ({
      title: this.i18n.t(t.titleKey),
      description: this.i18n.t(t.descriptionKey),
    }));
  });

  protected readonly pills = computed<Pill[]>(() => {
    const m = this.matches();
    return [
      { id: null, label: this.i18n.t('home.filter.all'), count: m.length },
      ...this.shownCategories().map((c) => ({
        id: c.id,
        label: this.i18n.t(c.titleKey),
        count: m.filter((t) => t.category === c.id).length,
      })),
    ];
  });

  protected readonly sections = computed(() => {
    const cat = this.category();
    return groupByCategory(
      this.matches().filter((t) => cat === null || t.category === cat),
      this.shownCategories(),
    );
  });

  protected readonly resultCount = computed(() => this.sections().reduce((n, g) => n + g.tools.length, 0));
  protected readonly filtering = computed(() => this.category() !== null || this.query().trim() !== '');
  protected readonly resultText = computed(() => {
    if (!this.filtering()) return '';
    const n = this.resultCount();
    return n === 0
      ? this.i18n.t('home.empty')
      : this.i18n.t(n === 1 ? 'home.results.one' : 'home.results', { n });
  });

  constructor() {
    afterNextRender(() => {
      // stato iniziale: dall'URL con cui si è arrivati
      const snap = this.route.snapshot;
      const param = snap.queryParamMap.get('categoria') ?? snap.queryParamMap.get('category');
      const slugUrl = '/?' + (param ? 'categoria=' + param : '') + (snap.fragment ? '#' + snap.fragment : '');
      this.urlCategory.set(categoryFromUrl(slugUrl));
      this.ready.set(true);
    });
    // tasto indietro/avanti: il router non vede gli URL scritti con location.go, ci pensiamo noi
    const sub = this.location.subscribe((e) => this.urlCategory.set(categoryFromUrl(e.url ?? '')));
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  protected select(id: ToolCategoryId | null): void {
    if (id === this.urlCategory()) return;
    this.urlCategory.set(id);
    // location.go aggiunge una voce alla cronologia senza far scattare la navigazione del router
    // (che riporterebbe la pagina in cima a ogni clic sui filtri)
    const cat = CATEGORIES.find((c) => c.id === id);
    // ?categoria=slug nelle pagine italiane, ?category=slug in quelle inglesi
    const query = !cat ? '' : this.english() ? `category=${cat.slugEn}` : `categoria=${cat.slug}`;
    this.location.go(this.i18n.link(''), query);
  }

  protected onSearch(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }

  protected reset(): void {
    this.query.set('');
    this.select(null);
  }

  protected anchor(c: ToolCategory): string {
    return this.english() ? c.slugEn : c.slug;
  }

  protected title(c: ToolCategory): string {
    return this.i18n.t(c.titleKey);
  }
}
