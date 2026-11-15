// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { Directive, ElementRef, OnDestroy, afterNextRender, inject, output } from '@angular/core';

/** Emette `appLazyVisible` una sola volta, quando l'elemento si avvicina alla zona visibile. */
@Directive({ selector: '[appLazyVisible]' })
export class LazyVisible implements OnDestroy {
  readonly appLazyVisible = output<void>();
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer: IntersectionObserver | null = null;

  constructor() {
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') {
        this.appLazyVisible.emit();
        return;
      }
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this.observer?.disconnect();
            this.observer = null;
            this.appLazyVisible.emit();
          }
        },
        { rootMargin: '300px' },
      );
      this.observer.observe(this.el.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
