// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import {
  BirthDate,
  CfParts,
  Sex,
  analyzeCodiceFiscale,
  computeCodiceFiscale,
  lettersOnly,
  omocodiaVariants,
} from './codice-fiscale';
import { CF_DICTIONARIES } from './codice-fiscale.i18n';
import { PlaceCombobox } from './place-combobox';
import { Place, PlacesFile, PlacesIndex, loadPlaces } from './places';

type Mode = 'compute' | 'verify';
type PlaceKind = 'comune' | 'estero' | 'codice';

interface PartRow {
  key: keyof CfParts;
  label: string;
  chars: string;
  from: string;
}

@Component({
  selector: 'app-codice-fiscale',
  imports: [Icon, PrivacyNote, Segmented, CopyButton, PlaceCombobox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './codice-fiscale.page.html',
  styleUrl: './codice-fiscale.page.scss',
})
export class CodiceFiscalePage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  /** Data di riferimento per scegliere il secolo più plausibile. */
  private readonly today = new Date();
  protected readonly maxDate = this.isoDate(this.today);

  protected readonly mode = signal<Mode>('compute');
  protected readonly surname = signal('');
  protected readonly name = signal('');
  protected readonly sex = signal<Sex | ''>('');
  protected readonly date = signal('');
  protected readonly placeKind = signal<PlaceKind>('comune');
  protected readonly place = signal<Place | null>(null);
  protected readonly manualCode = signal('');
  protected readonly verifyInput = signal('');

  private readonly file = signal<PlacesFile | null>(null);
  protected readonly placesError = signal(false);
  private loading = false;
  protected readonly index = computed(() => {
    const f = this.file();
    return f ? new PlacesIndex(f) : null;
  });
  protected readonly placesUpdated = computed(() => {
    const u = this.file()?.updated;
    return u ? new Intl.DateTimeFormat(this.i18n.locale(), { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(u + 'T00:00:00Z')) : '';
  });
  protected readonly hasEsteri = computed(() => this.index()?.hasKind('estero') ?? true);

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'compute', label: this.i18n.t('cf.mode.compute') },
    { value: 'verify', label: this.i18n.t('cf.mode.verify') },
  ]);

  protected readonly placeKinds = computed<{ value: PlaceKind; label: string }[]>(() => [
    { value: 'comune', label: this.i18n.t('cf.placeKind.comune') },
    { value: 'estero', label: this.i18n.t('cf.placeKind.estero') },
    { value: 'codice', label: this.i18n.t('cf.placeKind.codice') },
  ]);
  protected readonly comuneKinds: Place['kind'][] = ['comune', 'soppresso'];
  protected readonly esteroKinds: Place['kind'][] = ['estero'];

  protected readonly placeCode = computed(() => {
    if (this.placeKind() === 'codice') {
      const c = this.manualCode().trim().toUpperCase();
      return /^[A-Z]\d{3}$/.test(c) ? c : '';
    }
    return this.place()?.code ?? '';
  });
  protected readonly manualInvalid = computed(() => this.manualCode().trim() !== '' && this.placeCode() === '');

  private parsedDate(): { year: number; month: number; day: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(this.date());
    return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
  }

  /** Campi ancora da compilare, nell'ordine del modulo. */
  protected readonly missing = computed<string[]>(() => {
    const out: string[] = [];
    if (!lettersOnly(this.surname())) out.push('surname');
    if (!lettersOnly(this.name())) out.push('name');
    if (!this.sex()) out.push('sex');
    if (!this.parsedDate()) out.push('date');
    if (!this.placeCode()) out.push('place');
    return out;
  });
  protected readonly missingText = computed(() =>
    this.i18n.t('cf.missing', { fields: this.missing().map((k) => this.i18n.t('cf.missing.' + k)).join(', ') }),
  );

  protected readonly calc = computed(() => {
    const d = this.parsedDate();
    if (this.missing().length || !d) return null;
    const r = computeCodiceFiscale({
      surname: this.surname(),
      name: this.name(),
      sex: this.sex() as Sex,
      year: d.year,
      month: d.month,
      day: d.day,
      placeCode: this.placeCode(),
    });
    return r.ok ? r : null;
  });
  protected readonly dateError = computed(() => this.date() !== '' && this.parsedDate() !== null && !this.calc() && this.missing().length === 0);

  protected readonly parts = computed<PartRow[]>(() => {
    const r = this.calc();
    const d = this.parsedDate();
    if (!r || !d) return [];
    const p = r.parts;
    const t = (k: string, params?: Record<string, string | number>) => this.i18n.t(k, params);
    const monthName = new Intl.DateTimeFormat(this.i18n.locale(), { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2001, d.month - 1, 1)));
    const placeName = this.placeKind() === 'codice' ? '' : this.place() ? ` — ${this.place()!.name}` : '';
    const dayShown = String(d.day);
    return [
      { key: 'surname', label: t('cf.parts.surname'), chars: p.surname, from: t('cf.from.surname', { v: this.surname().trim() }) },
      { key: 'name', label: t('cf.parts.name'), chars: p.name, from: t('cf.from.name', { v: this.name().trim() }) },
      { key: 'year', label: t('cf.parts.year'), chars: p.year, from: t('cf.from.year', { v: d.year }) },
      { key: 'month', label: t('cf.parts.month'), chars: p.month, from: t('cf.from.month', { v: monthName }) },
      { key: 'day', label: t('cf.parts.day'), chars: p.day, from: t(this.sex() === 'F' ? 'cf.from.dayF' : 'cf.from.dayM', { v: dayShown }) },
      { key: 'place', label: t('cf.parts.place'), chars: p.place, from: t('cf.from.place', { v: placeName }) },
      { key: 'check', label: t('cf.parts.check'), chars: p.check, from: t('cf.from.check') },
    ];
  });

  protected readonly variants = computed(() => {
    const r = this.calc();
    return r ? omocodiaVariants(r.code) : [];
  });

  protected readonly chosenText = computed(() => {
    const p = this.place();
    return p && this.placeKind() !== 'codice'
      ? this.i18n.t('cf.place.selected', { name: p.kind === 'estero' ? p.name : `${p.name}${p.sigla ? ` (${p.sigla})` : ''}`, code: p.code })
      : '';
  });

  protected readonly analysis = computed(() => analyzeCodiceFiscale(this.verifyInput(), this.today, this.index()));
  protected readonly issueTexts = computed(() => {
    const a = this.analysis();
    return a.issues.map((i) => this.i18n.t('cf.issue.' + i, { len: a.code.length, expected: a.expectedCheck ?? '' }));
  });
  protected readonly omocodiaLevelText = computed(() => this.i18n.t('cf.verify.homoYes', { n: this.analysis().omocodiaLevel }));

  constructor() {
    this.i18n.register(CF_DICTIONARIES);
  }

  private isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Carica l'elenco dei luoghi (stesso sito, una sola volta) alla prima necessità. */
  protected ensurePlaces(): void {
    if (!this.browser || this.file() || this.loading) return;
    this.loading = true;
    this.placesError.set(false);
    loadPlaces()
      .then((f) => this.file.set(f))
      .catch(() => this.placesError.set(true))
      .finally(() => (this.loading = false));
  }

  protected setPlaceKind(k: PlaceKind): void {
    this.placeKind.set(k);
    this.place.set(null);
  }

  protected onVerifyInput(v: string): void {
    this.verifyInput.set(v);
    if (v.trim()) this.ensurePlaces();
  }

  protected formatBirth(b: BirthDate): string {
    return new Intl.DateTimeFormat(this.i18n.locale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(b.year, b.month - 1, b.day)),
    );
  }

  protected century(b: BirthDate): string {
    return this.i18n.t('cf.verify.century.' + (b.year < 1900 ? '18' : b.year < 2000 ? '19' : '20'));
  }

  protected placeLines = computed<string[]>(() => {
    const a = this.analysis();
    if (!a.placeCode) return [];
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k, p);
    if (!this.index()) return [this.placesError() ? t('cf.verify.placeCode', { code: a.placeCode }) : t('cf.verify.placeLoading')];
    if (!a.places?.length) {
      return [t(a.placeCode.startsWith('Z') ? 'cf.verify.placeForeignUnknown' : 'cf.verify.placeUnknown', { code: a.placeCode })];
    }
    return a.places.map((p) => {
      if (p.kind === 'estero') return `${p.name} · ${t('cf.verify.placeForeign', { code: p.code })}`;
      const base = `${p.name}${p.sigla ? ` (${p.sigla})` : ''} · ${p.code}`;
      return p.kind === 'soppresso' ? `${base} · ${p.year ? t('cf.verify.suppressedYear', { year: p.year }) : t('cf.verify.suppressed')}` : base;
    });
  });

  protected clearCompute(): void {
    this.surname.set('');
    this.name.set('');
    this.sex.set('');
    this.date.set('');
    this.place.set(null);
    this.manualCode.set('');
    // ricrea il combobox del luogo
    const k = this.placeKind();
    this.placeKind.set('codice');
    queueMicrotask(() => this.placeKind.set(k));
  }
}
