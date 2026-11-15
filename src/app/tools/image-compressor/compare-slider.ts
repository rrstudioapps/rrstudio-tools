// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * Confronto prima/dopo: le due immagini sono sovrapposte e una maniglia verticale trascinabile
 * (o spostabile con le frecce) decide quanta parte della seconda è visibile.
 */
@Component({
  selector: 'app-compare-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="box"
      [style.aspect-ratio]="width() + ' / ' + height()"
      (pointerdown)="onDown($event)"
      (pointermove)="onMove($event)"
      (pointerup)="onUp($event)"
      (pointercancel)="onUp($event)"
    >
      <img class="img" [src]="before()" [alt]="i18n.t('ic.cmp.before')" draggable="false" />
      <img
        class="img after"
        [src]="after()"
        [alt]="i18n.t('ic.cmp.after')"
        draggable="false"
        [style.clip-path]="'inset(0 0 0 ' + pos() + '%)'"
      />
      <span class="tag left" aria-hidden="true">{{ i18n.t('ic.cmp.before') }}</span>
      <span class="tag right" aria-hidden="true">{{ i18n.t('ic.cmp.after') }}</span>
      <div
        class="handle"
        role="slider"
        tabindex="0"
        [style.left.%]="pos()"
        [attr.aria-label]="i18n.t('ic.cmp.slider')"
        aria-orientation="horizontal"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="pos()"
        [attr.aria-valuetext]="i18n.t('ic.cmp.valuetext', { pct: 100 - pos() })"
        (keydown)="onKey($event)"
      >
        <span class="grip" aria-hidden="true">‹ ›</span>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .box {
      position: relative;
      width: 100%;
      max-height: 70vh;
      margin-inline: auto;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      touch-action: pan-y;
      cursor: ew-resize;
      user-select: none;
      // scacchiera per far vedere la trasparenza
      background:
        conic-gradient(var(--line-soft) 25%, var(--surface) 0 50%, var(--line-soft) 0 75%, var(--surface) 0) 0 0 / 16px 16px;
    }
    .img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
    }
    .tag {
      position: absolute;
      top: var(--space-2);
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--bg);
      color: var(--ink);
      border: 1px solid var(--line);
      font-family: var(--mono);
      font-size: var(--fs-xs);
      pointer-events: none;
      &.left {
        left: var(--space-2);
      }
      &.right {
        right: var(--space-2);
      }
    }
    .handle {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 44px;
      margin-left: -22px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: ew-resize;
      &::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        width: 2px;
        margin-left: -1px;
        background: var(--bg);
        box-shadow: 0 0 0 1px var(--ink);
      }
      &:focus-visible {
        outline: none;
        .grip {
          outline: var(--focus-ring);
          outline-offset: 2px;
        }
      }
    }
    .grip {
      position: relative;
      padding: 4px 8px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--ink);
      background: var(--bg);
      color: var(--ink);
      font-family: var(--mono);
      font-size: var(--fs-xs);
      white-space: nowrap;
    }
  `,
})
export class CompareSlider {
  protected readonly i18n = inject(I18nService);
  readonly before = input.required<string>();
  readonly after = input.required<string>();
  /** Dimensioni (per il rapporto d'aspetto del riquadro). */
  readonly width = input(4);
  readonly height = input(3);
  /** Posizione della maniglia, 0-100 (percentuale da sinistra). */
  protected readonly pos = signal(50);
  private dragging = false;

  protected onDown(e: PointerEvent): void {
    this.dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.setFrom(e);
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>('.handle')?.focus({ preventScroll: true });
  }

  protected onMove(e: PointerEvent): void {
    if (this.dragging) this.setFrom(e);
  }

  protected onUp(e: PointerEvent): void {
    this.dragging = false;
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }

  private setFrom(e: PointerEvent): void {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (r.width > 0) this.pos.set(clamp(Math.round(((e.clientX - r.left) / r.width) * 100)));
  }

  protected onKey(e: KeyboardEvent): void {
    const step = e.shiftKey ? 10 : 2;
    let next: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = this.pos() - step;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = this.pos() + step;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 100;
    if (next === null) return;
    e.preventDefault();
    this.pos.set(clamp(next));
  }
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, n));
}
