// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { SeoService } from '../core/seo/seo.service';

export interface GuideFaq {
  q: string;
  a: string;
}

/** Tetto di sicurezza alla ricerca delle chiavi numerate del dizionario. */
const MAX_ITEMS = 12;

/**
 * Guida sotto uno strumento: "Come si usa" (passi), domande frequenti e, se c'è, una nota sulla privacy.
 * I testi stanno nel dizionario dello strumento con chiavi `guide.<toolId>.step.N`, `guide.<toolId>.q.N` /
 * `guide.<toolId>.a.N` e `guide.<toolId>.privacy`; senza la prima domanda la guida non compare.
 * Le stesse domande e risposte diventano il JSON-LD FAQPage (stesso testo di quello visibile).
 */
@Component({
  selector: 'app-tool-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (faqs().length > 0) {
      <section class="container guide" [attr.aria-labelledby]="'guide-how-' + toolId()">
        @if (steps().length > 0) {
          <h2 [id]="'guide-how-' + toolId()">{{ i18n.t('guide.how') }}</h2>
          <ol class="steps">
            @for (s of steps(); track $index) {
              <li>{{ s }}</li>
            }
          </ol>
        }
        <h2>{{ i18n.t('guide.faq') }}</h2>
        <div class="faq">
          @for (f of faqs(); track $index) {
            <details>
              <summary>{{ f.q }}</summary>
              <p>{{ f.a }}</p>
            </details>
          }
        </div>
        @if (privacy(); as p) {
          <h2>{{ i18n.t('guide.privacy') }}</h2>
          <p class="body">{{ p }}</p>
        }
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .guide {
      padding-block: 0 var(--space-6);
    }
    .guide > * {
      max-width: 72ch;
    }
    h2 {
      font-size: var(--fs-lg);
      margin-top: var(--space-5);
      &:first-child {
        margin-top: 0;
      }
    }
    .steps {
      margin: 0;
      padding-left: 1.4em;
      color: var(--ink-2);
      li {
        margin-bottom: var(--space-2);
        padding-left: var(--space-1);
      }
    }
    .body {
      margin: 0;
      color: var(--ink-2);
    }
    details {
      border-bottom: 1px solid var(--line-soft);
      padding-block: var(--space-3);
    }
    summary {
      cursor: pointer;
      font-weight: var(--fw-bold);
    }
    details p {
      margin: var(--space-2) 0 0;
      color: var(--ink-2);
    }
    @media print {
      :host {
        display: none;
      }
    }
  `,
})
export class ToolGuide {
  protected readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);

  readonly toolId = input.required<string>();

  protected readonly steps = computed(() => this.collect(`guide.${this.toolId()}.step.`));
  protected readonly faqs = computed<GuideFaq[]>(() => {
    const prefix = `guide.${this.toolId()}.`;
    const out: GuideFaq[] = [];
    for (let n = 1; n <= MAX_ITEMS && this.i18n.has(`${prefix}q.${n}`); n++) {
      out.push({ q: this.i18n.t(`${prefix}q.${n}`), a: this.i18n.t(`${prefix}a.${n}`) });
    }
    return out;
  });
  protected readonly privacy = computed(() => {
    const key = `guide.${this.toolId()}.privacy`;
    return this.i18n.has(key) ? this.i18n.t(key) : '';
  });

  constructor() {
    effect(() => {
      const faqs = this.faqs();
      this.seo.setJsonLd(
        'faq',
        faqs.length === 0
          ? null
          : {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqs.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            },
      );
    });
    inject(DestroyRef).onDestroy(() => this.seo.setJsonLd('faq', null));
  }

  private collect(prefix: string): string[] {
    const out: string[] = [];
    for (let n = 1; n <= MAX_ITEMS && this.i18n.has(`${prefix}${n}`); n++) out.push(this.i18n.t(`${prefix}${n}`));
    return out;
  }
}
