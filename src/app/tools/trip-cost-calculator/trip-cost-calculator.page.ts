// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { formatNumber } from '../../shared/decimal';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, type SegmentOption } from '../../shared/segmented';
import { ShareLink } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { MODES, RANGE_BY, SHARE_SCHEMA } from './trip-cost-calculator.share';
import { TRIP_DICTIONARIES } from './trip-cost-calculator.i18n';
import {
  CONS_UNITS, DIST_UNITS, FUELS, KM_PER_MILE, MAX_CONSUMPTION, MAX_DISTANCE, MAX_FIXED_CENTS, MAX_PEOPLE, MAX_PRICE, VOL_UNITS,
  averageConsumption, convertConsumption, convertPrice, kmFrom, kmTo, litersPer, parseField, pricePerLiter, rangeFor, toCents, toL100, tripCost, volumeOf,
  type ConsUnit, type DistUnit, type Fuel, type Parsed, type VolUnit,
} from './trip-cost-calculator';

type Mode = (typeof MODES)[number];
type RangeBy = (typeof RANGE_BY)[number];

const POS = (max: number) => ({ allowZero: false, max });
const NONNEG = (max: number) => ({ allowZero: true, max });

@Component({
  selector: 'app-trip-cost-calculator',
  imports: [ShareLink, PrivacyNote, CopyButton, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-cost-calculator.page.html',
  styleUrl: './trip-cost-calculator.page.scss',
})
export class TripCostCalculatorPage {
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<Mode>('cost');
  protected readonly modes = computed<SegmentOption<Mode>[]>(() => MODES.map((m) => ({ value: m, label: this.i18n.t('trip.mode.' + m) })));
  protected readonly rangeBy = signal<RangeBy>('budget');
  protected readonly rangeBys = computed<SegmentOption<RangeBy>[]>(() => RANGE_BY.map((m) => ({ value: m, label: this.i18n.t('trip.by.' + m) })));

  protected readonly distUnit = signal<DistUnit>('km');
  protected readonly distance = signal('');
  protected readonly roundTrip = signal(false);
  protected readonly fuel = signal<Fuel>('petrol');
  protected readonly consUnit = signal<ConsUnit>('l100');
  protected readonly consumption = signal('');
  protected readonly price = signal('');
  protected readonly evCons = signal('');
  protected readonly evPrice = signal('');
  protected readonly fixed = signal('');
  protected readonly people = signal('1');
  protected readonly co2 = signal(false);
  protected readonly liters = signal('');
  protected readonly volUnit = signal<VolUnit>('l');
  protected readonly spend = signal('');
  protected readonly budget = signal('');
  protected readonly tank = signal('');
  /** Gli errori di campo vuoto compaiono solo dopo che l'utente ha cominciato a scrivere. */
  protected readonly touched = signal(false);

  protected readonly distUnits = DIST_UNITS;
  protected readonly consUnits = CONS_UNITS;
  protected readonly volUnits = VOL_UNITS;
  protected readonly fuels = FUELS;
  protected readonly maxPeople = MAX_PEOPLE;

  protected readonly isEv = computed(() => this.fuel() === 'electric');
  /** Unità di volume del prezzo e del serbatoio (il gallone solo con mpg). */
  protected readonly priceVol = computed<VolUnit>(() => volumeOf(this.consUnit()));
  protected readonly showDistance = computed(() => this.mode() !== 'range');
  protected readonly showVehicle = computed(() => this.mode() !== 'avg');

  // --- lettura dei campi ---
  private lang(): 'it' | 'en' {
    return this.i18n.lang();
  }
  protected readonly distP = computed(() => parseField(this.distance(), this.lang(), POS(MAX_DISTANCE)));
  protected readonly consP = computed(() => parseField(this.isEv() ? this.evCons() : this.consumption(), this.lang(), POS(MAX_CONSUMPTION)));
  protected readonly priceP = computed(() =>
    parseField(this.isEv() ? this.evPrice() : this.price(), this.lang(), this.mode() === 'range' && this.rangeBy() === 'budget' ? POS(MAX_PRICE) : NONNEG(MAX_PRICE)),
  );
  protected readonly fixedP = computed<Parsed>(() => (this.fixed().trim() === '' ? { ok: true, value: 0 } : parseField(this.fixed(), this.lang(), NONNEG(MAX_FIXED_CENTS / 100))));
  protected readonly peopleP = computed<Parsed>(() => {
    const p = parseField(this.people(), this.lang(), POS(MAX_PEOPLE));
    return p.ok && !Number.isInteger(p.value) ? { ok: false, error: 'nan' } : p;
  });
  protected readonly litersP = computed(() => parseField(this.liters(), this.lang(), POS(MAX_DISTANCE)));
  protected readonly spendP = computed<Parsed>(() => (this.spend().trim() === '' ? { ok: true, value: 0 } : parseField(this.spend(), this.lang(), NONNEG(MAX_FIXED_CENTS / 100))));
  protected readonly budgetP = computed(() => parseField(this.budget(), this.lang(), POS(MAX_FIXED_CENTS / 100)));
  protected readonly tankP = computed(() => parseField(this.tank(), this.lang(), POS(MAX_DISTANCE)));

  /** Chiave del messaggio d'errore di un campo; stringa vuota se non c'è nulla da mostrare. */
  protected err(p: Parsed, optional = false): string {
    if (p.ok) return '';
    if (p.error === 'empty' && (optional || !this.touched())) return '';
    return 'trip.err.' + p.error;
  }
  protected readonly peopleErr = computed(() => (this.peopleP().ok ? '' : this.touched() || this.people().trim() !== '' ? 'trip.err.people' : ''));
  /** Il prezzo è facoltativo nel serbatoio. */
  protected readonly priceErr = computed(() => this.err(this.priceP(), this.mode() === 'range' && this.rangeBy() === 'tank'));

  // --- valori numerici derivati ---
  private readonly per100 = computed(() => {
    const c = this.consP();
    if (!c.ok) return null;
    const v = this.isEv() ? c.value : toL100(c.value, this.consUnit());
    return Number.isFinite(v) && v > 0 ? v : null;
  });
  /** Prezzo al litro (o al kWh); null se non valido o assente. */
  private readonly unitPrice = computed(() => {
    const p = this.priceP();
    if (!p.ok) return null;
    return this.isEv() ? p.value : pricePerLiter(p.value, this.priceVol());
  });
  private readonly distKm = computed(() => {
    const d = this.distP();
    return d.ok ? kmFrom(d.value, this.distUnit()) : null;
  });

  // --- risultati ---
  private readonly tripRaw = computed(() => {
    const km = this.distKm();
    const per100 = this.per100();
    const price = this.unitPrice();
    const fixed = this.fixedP();
    const people = this.peopleP();
    if (km === null || per100 === null || price === null || !fixed.ok || !people.ok) return null;
    return tripCost({ distanceKm: km, roundTrip: this.roundTrip(), fuel: this.fuel(), per100, unitPrice: price, fixedCents: toCents(fixed.value), people: people.value });
  });
  protected readonly trip = computed(() => {
    const r = this.tripRaw();
    return r && r.ok ? r : null;
  });
  private readonly avgRaw = computed(() => {
    const km = this.distKm();
    const l = this.litersP();
    const s = this.spendP();
    if (km === null || !l.ok || !s.ok) return null;
    return averageConsumption(km, l.value * litersPer(this.volUnit()), this.spend().trim() === '' ? null : toCents(s.value));
  });
  protected readonly avg = computed(() => {
    const r = this.avgRaw();
    return r && r.ok ? r : null;
  });
  private readonly rangeRaw = computed(() => {
    const per100 = this.per100();
    if (per100 === null) return null;
    const price = this.priceP();
    if (this.rangeBy() === 'budget') {
      const b = this.budgetP();
      const unit = this.unitPrice();
      if (!b.ok || unit === null) return null;
      return rangeFor('budget', toCents(b.value), per100, unit);
    }
    const t = this.tankP();
    const hasPrice = (this.isEv() ? this.evPrice() : this.price()).trim() !== '';
    if (!t.ok || (hasPrice && !price.ok)) return null;
    const amount = this.isEv() ? t.value : t.value * litersPer(this.priceVol());
    return rangeFor('tank', amount, per100, hasPrice ? this.unitPrice() : null);
  });
  protected readonly range = computed(() => {
    const r = this.rangeRaw();
    return r && r.ok ? r : null;
  });
  /** Errore di calcolo della modalità corrente (valori enormi o incompatibili), se i campi sono tutti validi. */
  protected readonly calcError = computed(() => {
    const m = this.mode();
    const r = m === 'cost' ? this.tripRaw() : m === 'avg' ? this.avgRaw() : this.rangeRaw();
    return r && !r.ok ? 'trip.err.' + r.error : '';
  });
  protected readonly perUnitCost = computed(() => {
    const t = this.trip();
    return t ? (this.distUnit() === 'mi' ? t.perKm * KM_PER_MILE : t.perKm) : 0;
  });
  protected readonly rangeMiles = computed(() => kmTo(this.range()?.km ?? 0, 'mi'));
  protected readonly distShown = computed(() => kmTo(this.trip()?.distanceKm ?? 0, this.distUnit()));

  // --- formattazione ---
  protected num(n: number, max = 2): string {
    return new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: max }).format(n);
  }
  protected eur(cents: number): string {
    return new Intl.NumberFormat(this.i18n.locale(), { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }
  protected eurPrecise(euro: number): string {
    return new Intl.NumberFormat(this.i18n.locale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(euro);
  }
  protected readonly energyUnit = computed(() => this.i18n.t(this.isEv() ? 'trip.u.kwh' : 'trip.u.l'));

  protected readonly summary = computed(() => {
    const t = (k: string) => this.i18n.t('trip.' + k);
    const ev = this.isEv();
    const du = t('u.' + this.distUnit());
    const lines: string[] = [];
    const tr = this.trip();
    const av = this.avg();
    const rg = this.range();
    if (this.mode() === 'cost' && tr) {
      lines.push(`${t('r.distance')}: ${this.num(this.distShown())} ${du}`);
      lines.push(`${t(ev ? 'r.energy.ev' : 'r.energy')}: ${this.num(tr.energy)} ${this.energyUnit()}`);
      lines.push(`${t(ev ? 'r.fuel.ev' : 'r.fuel')}: ${this.eur(tr.fuelCents)}`);
      if (tr.fixedCents > 0) lines.push(`${t('r.fixed')}: ${this.eur(tr.fixedCents)}`);
      lines.push(`${t('r.total')}: ${this.eur(tr.totalCents)}`);
      const people = this.peopleP();
      if (people.ok && people.value > 1) lines.push(`${t('r.person')}: ${this.eur(tr.perPersonCents)}`);
      lines.push(`${t(this.distUnit() === 'mi' ? 'r.perMi' : 'r.perKm')}: ${this.eurPrecise(this.perUnitCost())}`);
      if (this.co2() && tr.co2Kg !== null) lines.push(`${t('r.co2')}: ${this.num(tr.co2Kg, 1)} ${t('u.kg')}`);
    } else if (this.mode() === 'avg' && av) {
      lines.push(`${t('r.l100')}: ${this.num(av.l100)}`, `${t('r.kml')}: ${this.num(av.kml)}`, `${t('r.mpgUk')}: ${this.num(av.mpgUk)}`, `${t('r.mpgUs')}: ${this.num(av.mpgUs)}`);
      if (av.costPerKm !== null) lines.push(`${t('r.perKm')}: ${this.eurPrecise(av.costPerKm)}`, `${t('r.cost100')}: ${this.eurPrecise(av.costPer100Km ?? 0)}`);
    } else if (this.mode() === 'range' && rg) {
      lines.push(`${t('r.km')}: ${this.num(rg.km, 1)}`, `${t('r.mi')}: ${this.num(this.rangeMiles(), 1)}`);
      lines.push(`${t(ev ? 'r.used.ev' : 'r.used')}: ${this.num(rg.energy)} ${this.energyUnit()}`);
      if (rg.costCents !== null) lines.push(`${t('r.cost')}: ${this.eur(rg.costCents)}`);
    }
    return lines.join('\n');
  });

  // --- link condivisibile ---
  protected readonly shareSchema = SHARE_SCHEMA;
  protected readonly shareState = (): ShareData => {
    const p = this.peopleP();
    return {
      mode: this.mode(), distUnit: this.distUnit(), distance: this.distance().slice(0, 20), roundTrip: this.roundTrip(), fuel: this.fuel(),
      consUnit: this.consUnit(), consumption: this.consumption().slice(0, 20), price: this.price().slice(0, 20),
      evCons: this.evCons().slice(0, 20), evPrice: this.evPrice().slice(0, 20), fixed: this.fixed().slice(0, 20),
      people: p.ok ? p.value : 1, co2: this.co2(), liters: this.liters().slice(0, 20), volUnit: this.volUnit(), spend: this.spend().slice(0, 20),
      rangeBy: this.rangeBy(), budget: this.budget().slice(0, 20), tank: this.tank().slice(0, 20),
    };
  };
  protected restoreShared(data: ShareData): void {
    const s = data as Partial<Record<string, unknown>>;
    const pick = <T extends string>(v: unknown, list: readonly T[]): T | undefined => list.find((x) => x === v);
    const text = (key: string, sig: { set(v: string): void }) => {
      const v = s[key];
      if (typeof v === 'string') sig.set(v);
    };
    this.mode.set(pick(s['mode'], MODES) ?? this.mode());
    this.distUnit.set(pick(s['distUnit'], DIST_UNITS) ?? this.distUnit());
    this.fuel.set(pick(s['fuel'], FUELS) ?? this.fuel());
    this.consUnit.set(pick(s['consUnit'], CONS_UNITS) ?? this.consUnit());
    this.volUnit.set(pick(s['volUnit'], VOL_UNITS) ?? this.volUnit());
    this.rangeBy.set(pick(s['rangeBy'], RANGE_BY) ?? this.rangeBy());
    if (typeof s['roundTrip'] === 'boolean') this.roundTrip.set(s['roundTrip']);
    if (typeof s['co2'] === 'boolean') this.co2.set(s['co2']);
    if (typeof s['people'] === 'number') this.people.set(String(s['people']));
    text('distance', this.distance); text('consumption', this.consumption); text('price', this.price);
    text('evCons', this.evCons); text('evPrice', this.evPrice); text('fixed', this.fixed);
    text('liters', this.liters); text('spend', this.spend); text('budget', this.budget); text('tank', this.tank);
  }

  constructor() {
    this.i18n.register(TRIP_DICTIONARIES);
  }

  // --- cambio di unità con conversione del valore già scritto ---
  protected setDistUnit(value: string): void {
    const to = DIST_UNITS.find((x) => x === value);
    if (!to) return;
    const d = this.distP();
    if (d.ok) this.distance.set(formatNumber(kmTo(kmFrom(d.value, this.distUnit()), to), this.lang(), 5));
    this.distUnit.set(to);
  }
  protected setConsUnit(value: string): void {
    const to = CONS_UNITS.find((x) => x === value);
    if (!to) return;
    const from = this.consUnit();
    const c = parseField(this.consumption(), this.lang(), POS(MAX_CONSUMPTION));
    if (c.ok) this.consumption.set(formatNumber(convertConsumption(c.value, from, to), this.lang(), 5));
    const p = parseField(this.price(), this.lang(), NONNEG(MAX_PRICE));
    if (p.ok) this.price.set(formatNumber(convertPrice(p.value, volumeOf(from), volumeOf(to)), this.lang(), 5));
    const t = parseField(this.tank(), this.lang(), POS(MAX_DISTANCE));
    if (t.ok && !this.isEv()) this.tank.set(formatNumber((t.value * litersPer(volumeOf(from))) / litersPer(volumeOf(to)), this.lang(), 5));
    this.consUnit.set(to);
  }
  protected setVolUnit(value: string): void {
    const to = VOL_UNITS.find((x) => x === value);
    if (!to) return;
    const l = this.litersP();
    if (l.ok) this.liters.set(formatNumber((l.value * litersPer(this.volUnit())) / litersPer(to), this.lang(), 5));
    this.volUnit.set(to);
  }
  protected setFuel(value: string): void {
    const f = FUELS.find((x) => x === value);
    if (f) this.fuel.set(f);
  }

  protected clear(): void {
    this.distance.set('');
    this.roundTrip.set(false);
    this.consumption.set('');
    this.price.set('');
    this.evCons.set('');
    this.evPrice.set('');
    this.fixed.set('');
    this.people.set('1');
    this.co2.set(false);
    this.liters.set('');
    this.spend.set('');
    this.budget.set('');
    this.tank.set('');
    this.touched.set(false);
  }
}
