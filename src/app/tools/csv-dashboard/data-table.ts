// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { DashboardStore, PAGE_SIZES } from './dashboard.store';
import { formatNumber } from './format';

@Component({
  selector: 'app-data-table',
  
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" [attr.aria-label]="i18n.t('csv.table.title')">
      <div class="top">
        <h3>{{ i18n.t('csv.table.title') }}</h3>
        <label class="search">
          <span class="visually-hidden">{{ i18n.t('csv.table.search') }}</span>
          <input
            type="search"
            [placeholder]="i18n.t('csv.table.searchPh')"
            [value]="store.search()"
            (input)="onSearch($event)"
          />
        </label>
      </div>

      <div class="scroll">
        <table>
          <thead>
            <tr>
              @for (c of store.columns(); track $index) {
                <th
                  scope="col"
                  [attr.aria-sort]="
                    store.sortCol() === $index
                      ? store.sortDir() === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  "
                >
                  <button
                    type="button"
                    class="sort"
                    [attr.aria-label]="i18n.t('csv.table.sort', { col: c.name })"
                    (click)="store.toggleSort($index)"
                  >
                    <span>{{ c.name }}</span>
                    <span aria-hidden="true">{{
                      store.sortCol() === $index ? (store.sortDir() === 'asc' ? '↑' : '↓') : '↕'
                    }}</span>
                  </button>
                  <span class="type">{{ i18n.t('csv.type.' + c.type) }}</span>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (r of store.pageRows(); track r) {
              <tr>
                @for (c of store.columns(); track $index) {
                  <td [class.num]="c.type === 'number'" [attr.title]="store.cell(r, $index)">
                    {{ store.cell(r, $index) }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
        @if (store.sorted().length === 0) {
          <p class="empty">{{ i18n.t('csv.table.empty') }}</p>
        }
      </div>

      <div class="pager">
        <label>
          {{ i18n.t('csv.table.perPage') }}
          <select (change)="onSize($event)">
            @for (s of sizes; track s) {
              <option [value]="s" [selected]="store.pageSize() === s">{{ s }}</option>
            }
          </select>
        </label>
        <span aria-live="polite">{{ range() }}</span>
        <button
          type="button"
          class="btn"
          [disabled]="currentPage() === 0"
          [attr.aria-label]="i18n.t('csv.table.prev')"
          (click)="store.page.set(currentPage() - 1)"
        >
          ‹
        </button>
        <button
          type="button"
          class="btn"
          [disabled]="currentPage() >= store.pageCount() - 1"
          [attr.aria-label]="i18n.t('csv.table.next')"
          (click)="store.page.set(currentPage() + 1)"
        >
          ›
        </button>
      </div>
    </section>
  `,
  styles: `
    .panel {
      border-top: 1px solid var(--ink);
      padding-top: var(--space-4);
      min-width: 0;
    }
    .top {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-3);
    }
    h3 {
      font-size: var(--fs-xl);
      margin: 0;
    }
    .scroll {
      overflow-x: auto;
      margin-top: var(--space-4);
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: var(--fs-sm);
    }
    th,
    td {
      padding: var(--space-3);
      text-align: left;
      border-bottom: 1px solid var(--line);
      white-space: nowrap;
      max-width: 16rem;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    tbody tr:last-child td {
      border-bottom: 0;
    }
    th {
      font-family: var(--mono);
      font-weight: 400;
      font-size: var(--fs-xs);
      text-transform: uppercase;
      color: var(--muted);
      letter-spacing: 0.04em;
    }
    td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .sort {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      border: 0;
      background: none;
      cursor: pointer;
      padding: 0;
      font: inherit;
      text-transform: inherit;
      letter-spacing: inherit;
      color: inherit;
    }
    .sort:hover {
      color: var(--ink);
    }
    .type {
      display: inline-block;
      margin-top: var(--space-1);
      padding: 0 6px;
      border: 1px solid var(--line);
      border-radius: var(--radius-pill);
      font-family: var(--mono);
      font-size: 10px;
      text-transform: none;
      color: var(--muted);
    }
    .empty {
      color: var(--muted);
      padding: var(--space-3);
      margin: 0;
    }
    .pager {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      margin-top: var(--space-4);
      font-family: var(--mono);
      font-size: var(--fs-xs);
      color: var(--muted);
    }
    .pager .btn {
      padding: 0 var(--space-4);
    }
  `,
})
export class DataTable {
  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(DashboardStore);
  protected readonly sizes = PAGE_SIZES;

  protected readonly currentPage = computed(() =>
    Math.min(this.store.page(), this.store.pageCount() - 1),
  );
  protected readonly range = computed(() => {
    const total = this.store.sorted().length;
    const from = total === 0 ? 0 : this.currentPage() * this.store.pageSize() + 1;
    const to = Math.min(total, from + this.store.pageSize() - 1);
    const loc = this.i18n.locale();
    return this.i18n.t('csv.table.range', {
      from: formatNumber(from, loc),
      to: formatNumber(to, loc),
      total: formatNumber(total, loc),
    });
  });

  protected onSearch(e: Event): void {
    this.store.search.set((e.target as HTMLInputElement).value);
    this.store.page.set(0);
  }
  protected onSize(e: Event): void {
    this.store.pageSize.set(Number((e.target as HTMLSelectElement).value));
    this.store.page.set(0);
  }
}
