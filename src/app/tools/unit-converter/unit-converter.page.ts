// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { formatNumber, parseDecimal } from '../../shared/decimal';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { UC_DICTIONARIES } from './unit-converter.i18n';
import { CATEGORIES, CategoryId, Unit, UnitHit, convert, findUnit, getCategory, normalize, searchUnits } from './units';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './unit-converter.share';

interface TableRow {
  unit: Unit;
  text: string;
  /** Testo copiato: cifre senza raggruppamento, con il separatore della lingua. */
  plain: string;
}

@Component({
  selector: 'app-unit-converter',
  imports: [ShareLink, CopyButton, Icon, PrivacyNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unit-converter.page.html',
  styleUrl: './unit-converter.page.scss',
})
export class UnitConverterPage {
  protected readonly i18n = inject(I18nService);
  protected readonly categories = CATEGORIES;

  protected readonly category = signal<CategoryId>('length');
  protected readonly valueText = signal('1');
  protected readonly from = signal(getCategory('length').defaultFrom);
  protected readonly to = signal(getCategory('length').defaultTo);
  protected readonly query = signal('');

  protected readonly units = computed(() => getCategory(this.category()).units);
  private readonly lang = computed(() => this.i18n.lang());

  protected readonly value = computed(() => (this.valueText().trim() === '' ? null : parseDecimal(this.valueText(), this.lang())));
  protected readonly valueError = computed(() => this.valueText().trim() !== '' && this.value() === null);

  /** Risultato principale da → a. */
  protected readonly main = computed<{ text: string; error: string } | null>(() => {
    const v = this.value();
    if (v === null) return null;
    const r = convert(this.category(), v, this.from(), this.to());
    if (!r.ok) return { text: '', error: this.i18n.t('uc.err.' + r.error) };
    return { text: formatNumber(r.value, this.lang(), 10), error: '' };
  });

  /** Ricerca: unità di tutte le categorie che corrispondono. */
  protected readonly hits = computed<UnitHit[]>(() => searchUnits(this.query(), this.lang()).slice(0, 8));
  protected readonly searching = computed(() => this.query().trim() !== '');

  /** Tabella con il valore in tutte le unità della categoria (filtrata dalla ricerca). */
  protected readonly table = computed<TableRow[]>(() => {
    const v = this.value();
    if (v === null) return [];
    const q = normalize(this.query().trim());
    const allowed = q ? new Set(searchUnits(this.query(), this.lang(), this.category()).map((h) => h.unit.id)) : null;
    const rows: TableRow[] = [];
    for (const un of this.units()) {
      if (allowed && !allowed.has(un.id)) continue;
      const r = convert(this.category(), v, this.from(), un.id);
      if (!r.ok) return [];
      rows.push({
        unit: un,
        text: formatNumber(r.value, this.lang(), 10),
        plain: formatNumber(r.value, this.lang(), 10).replace(this.lang() === 'it' ? /\./g : /,/g, ''),
      });
    }
    return rows;
  });

  protected readonly fromUnit = computed(() => this.units().find((x) => x.id === this.from())!);
  protected readonly toUnit = computed(() => this.units().find((x) => x.id === this.to())!);
  protected readonly note = computed(() => (['data', 'time', 'volume'].includes(this.category()) ? 'uc.note.' + this.category() : ''));

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    category: this.category,
    valueText: this.valueText,
    from: this.from,
    to: this.to,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
    // le unità devono appartenere alla categoria: altrimenti si usano quelle di partenza
    const cat = getCategory(this.category());
    if (!findUnit(cat.id, this.from())) this.from.set(cat.defaultFrom);
    if (!findUnit(cat.id, this.to())) this.to.set(cat.defaultTo);
  }

  constructor() {
    this.i18n.register(UC_DICTIONARIES);
  }

  protected unitName(category: CategoryId, u: Unit): string {
    return this.i18n.t(`u.${category}.${u.id}`);
  }

  protected setCategory(id: CategoryId): void {
    if (id === this.category()) return;
    const c = getCategory(id);
    this.category.set(id);
    this.from.set(c.defaultFrom);
    this.to.set(c.defaultTo);
  }

  protected useHit(h: UnitHit): void {
    this.setCategory(h.category);
    this.from.set(h.unit.id);
    const c = getCategory(h.category);
    if (this.to() === h.unit.id) this.to.set(c.units.find((x) => x.id !== h.unit.id)!.id);
    this.query.set('');
  }

  protected swap(): void {
    const f = this.from();
    this.from.set(this.to());
    this.to.set(f);
  }
}
