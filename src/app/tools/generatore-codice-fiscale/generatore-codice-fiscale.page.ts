// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { PlaceCombobox } from '../codice-fiscale/place-combobox';
import { Place, PlacesFile, PlacesIndex, loadPlaces } from '../codice-fiscale/places';
import { randomSeedText } from '../fake-data-generator/fake-data';
import { VAT_OFFICES } from '../iban-partita-iva/vat-offices';
import { GENERATORE_CF_DICTIONARIES } from './generatore-codice-fiscale.i18n';
import { SHARE_SCHEMA } from './generatore-codice-fiscale.share';
import {
  CfConfig, CfResult, DEFAULT_CF_CONFIG, GenError, HomocodiaLevel, MAX_COUNT, MIN_COUNT, PlaceChoice, SexFilter, VatConfig, VatResult,
  cfToCsv, cfToJson, generateCodiciFiscali, generatePartiteIva, vatToCsv, vatToJson,
} from './generatore-codice-fiscale';

type Mode = 'cf' | 'vat';
type PlaceKind = 'any' | 'comune' | 'estero';
type FileFormat = 'csv' | 'json';

/** Righe mostrate nell'anteprima (copia e download comprendono tutto). */
const PREVIEW_ROWS = 100;

@Component({
  selector: 'app-generatore-codice-fiscale',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, CopyButton, SendTo, PlaceCombobox, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './generatore-codice-fiscale.page.html',
  styleUrl: './generatore-codice-fiscale.page.scss',
})
export class GeneratoreCodiceFiscalePage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly minCount = MIN_COUNT;
  protected readonly maxCount = MAX_COUNT;
  protected readonly previewRows = PREVIEW_ROWS;
  protected readonly currentYear = new Date().getFullYear();

  // opzioni (condivise nel link)
  protected readonly mode = signal<Mode>('cf');
  protected readonly count = signal(DEFAULT_CF_CONFIG.count);
  protected readonly seed = signal('');
  protected readonly sex = signal<SexFilter>('any');
  protected readonly birthExact = signal('');
  protected readonly yearFrom = signal(DEFAULT_CF_CONFIG.yearFrom);
  protected readonly yearTo = signal(DEFAULT_CF_CONFIG.yearTo);
  protected readonly placeCode = signal('');
  protected readonly homocodia = signal<HomocodiaLevel>(0);
  protected readonly office = signal('');
  protected readonly prefix = signal(false);

  // stato non condiviso
  protected readonly placeKind = signal<PlaceKind>('any');
  private readonly pickedPlace = signal<Place | null>(null);
  private readonly fromShare = signal(false);
  protected readonly format = signal<FileFormat>('csv');
  protected readonly autoSeed = signal('');
  protected readonly usedSeed = computed(() => this.seed().trim() || this.autoSeed());
  private readonly generation = signal(0);
  private readonly cleared = signal(false);

  // elenco dei luoghi (stesso sito, scaricato solo se serve)
  private readonly file = signal<PlacesFile | null>(null);
  protected readonly placesError = signal(false);
  private loading = false;
  protected readonly index = computed(() => {
    const f = this.file();
    return f ? new PlacesIndex(f) : null;
  });
  protected readonly comuneKinds: Place['kind'][] = ['comune', 'soppresso'];
  protected readonly esteroKinds: Place['kind'][] = ['estero'];

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'cf', label: this.i18n.t('gcf.mode.cf') },
    { value: 'vat', label: this.i18n.t('gcf.mode.vat') },
  ]);
  protected readonly sexes = computed<SegmentOption<SexFilter>[]>(() => [
    { value: 'any', label: this.i18n.t('gcf.sex.any') },
    { value: 'M', label: this.i18n.t('gcf.sex.M') },
    { value: 'F', label: this.i18n.t('gcf.sex.F') },
  ]);
  protected readonly placeKinds = computed<SegmentOption<PlaceKind>[]>(() => [
    { value: 'any', label: this.i18n.t('gcf.place.any') },
    { value: 'comune', label: this.i18n.t('gcf.place.comune') },
    { value: 'estero', label: this.i18n.t('gcf.place.estero') },
  ]);
  protected readonly formats: SegmentOption<FileFormat>[] = [
    { value: 'csv', label: 'CSV' },
    { value: 'json', label: 'JSON' },
  ];
  protected readonly homocodiaLevels = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
  protected readonly offices = Object.entries(VAT_OFFICES).map(([code, [sigla, name]]) => ({ code, label: `${code} · ${name} (${sigla})` }));

  /** Luogo scelto: quello cliccato nell'elenco o, da un link condiviso, quello con il codice catastale salvato. */
  private readonly place = computed<PlaceChoice | null>(() => {
    const code = this.placeCode();
    if (!code || this.placeKind() === 'any') return null;
    const p = this.pickedPlace();
    const found = p && p.code === code ? p : (this.index()?.byCatastale(code).find((x) => x.kind !== 'soppresso') ?? this.index()?.byCatastale(code)[0]);
    return found ? { code: found.code, name: found.name, sigla: found.sigla } : null;
  });
  /** Un luogo è richiesto ma l'elenco non l'ha ancora risolto: si aspetta prima di generare. */
  protected readonly placePending = computed(() => this.mode() === 'cf' && this.placeKind() !== 'any' && !!this.placeCode() && !this.place());
  protected readonly comboPreset = computed(() => {
    const p = this.place();
    return this.fromShare() && p ? (p.sigla ? `${p.name} (${p.sigla})` : p.name) : '';
  });

  protected readonly cfResult = computed<CfResult | null>(() => {
    this.generation();
    if (!this.browser || this.mode() !== 'cf' || this.cleared() || this.placePending()) return null;
    const cfg: CfConfig = {
      count: this.count(), seed: this.usedSeed(), sex: this.sex(), birthExact: this.birthExact(),
      yearFrom: this.yearFrom(), yearTo: this.yearTo(), place: this.place(), homocodia: this.homocodia(),
    };
    return generateCodiciFiscali(cfg);
  });
  protected readonly vatResult = computed<VatResult | null>(() => {
    this.generation();
    if (!this.browser || this.mode() !== 'vat' || this.cleared()) return null;
    const cfg: VatConfig = { count: this.count(), seed: this.usedSeed(), office: this.office(), prefix: this.prefix() };
    return generatePartiteIva(cfg);
  });

  protected readonly error = computed<GenError | ''>(() => {
    const r = this.mode() === 'cf' ? this.cfResult() : this.vatResult();
    return r && !r.ok ? r.error : '';
  });
  protected readonly cfRows = computed(() => {
    const r = this.cfResult();
    return r?.ok ? r.rows : [];
  });
  protected readonly vatRows = computed(() => {
    const r = this.vatResult();
    return r?.ok ? r.rows : [];
  });
  protected readonly short = computed(() => {
    const r = this.cfResult();
    return r?.ok && r.short ? r.rows.length : 0;
  });
  protected readonly total = computed(() => (this.mode() === 'cf' ? this.cfRows().length : this.vatRows().length));
  protected readonly cfPreview = computed(() => this.cfRows().slice(0, PREVIEW_ROWS));
  protected readonly vatPreview = computed(() => this.vatRows().slice(0, PREVIEW_ROWS));
  protected readonly meta = computed(() => {
    const n = this.total();
    if (!n) return '';
    return n > PREVIEW_ROWS ? this.i18n.t('gcf.meta', { n, shown: PREVIEW_ROWS }) : this.i18n.t('gcf.meta.all', { n });
  });
  /** Un valore per riga: è il testo che si copia e si invia ai validatori. */
  protected readonly text = computed(() =>
    (this.mode() === 'cf' ? this.cfRows().map((r) => r.code) : this.vatRows().map((r) => r.value)).join('\n'),
  );
  protected readonly hasHomocodia = computed(() => this.homocodia() !== 0);

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode, count: this.count, seed: this.seed, sex: this.sex, birthExact: this.birthExact,
    yearFrom: this.yearFrom, yearTo: this.yearTo, placeCode: this.placeCode, homocodia: this.homocodia,
    office: this.office, prefix: this.prefix,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
    const code = this.placeCode();
    this.pickedPlace.set(null);
    this.fromShare.set(!!code);
    this.placeKind.set(!code ? 'any' : code.startsWith('Z') ? 'estero' : 'comune');
    if (code) this.ensurePlaces();
  }

  constructor() {
    this.i18n.register(GENERATORE_CF_DICTIONARIES);
    if (this.browser) this.autoSeed.set(randomSeedText());
    // ogni cambio di opzione riporta in vista i risultati dopo uno "Svuota"
    effect(() => {
      this.mode(); this.count(); this.seed(); this.sex(); this.birthExact(); this.yearFrom(); this.yearTo();
      this.placeCode(); this.homocodia(); this.office(); this.prefix();
      untracked(() => this.cleared.set(false));
    });
  }

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
    this.pickedPlace.set(null);
    this.fromShare.set(false);
    this.placeCode.set('');
    if (k !== 'any') this.ensurePlaces();
  }
  protected onPicked(p: Place | null): void {
    this.fromShare.set(false);
    this.pickedPlace.set(p);
    this.placeCode.set(p?.code ?? '');
  }

  protected setCount(value: string): void {
    const n = Math.round(Number(value));
    this.count.set(Number.isFinite(n) ? Math.min(MAX_COUNT, Math.max(MIN_COUNT, n)) : DEFAULT_CF_CONFIG.count);
  }
  protected setYear(target: 'from' | 'to', value: string): void {
    const n = Math.round(Number(value));
    if (value.trim() === '' || !Number.isFinite(n)) return;
    (target === 'from' ? this.yearFrom : this.yearTo).set(n);
  }
  protected setHomocodia(value: string): void {
    const n = Number(value);
    this.homocodia.set((Number.isInteger(n) && n >= 0 && n <= 8 ? n : 0) as HomocodiaLevel);
  }

  protected regenerate(): void {
    this.cleared.set(false);
    // con il seme vuoto se ne sceglie uno nuovo; con un seme fisso si rigenera uguale
    if (this.seed().trim()) this.generation.update((n) => n + 1);
    else this.autoSeed.set(randomSeedText());
  }
  protected clear(): void {
    this.cleared.set(true);
  }
  protected keepSeed(): void {
    this.seed.set(this.usedSeed());
  }

  protected download(): void {
    const body = this.fileText();
    if (!body) return;
    const f = this.format();
    const name = `${this.mode() === 'cf' ? 'codici-fiscali' : 'partite-iva'}-di-prova.${f}`;
    saveBytes(new TextEncoder().encode(f === 'csv' ? '﻿' + body : body), name, (f === 'csv' ? 'text/csv' : 'application/json') + ';charset=utf-8');
  }

  private fileText(): string {
    if (this.mode() === 'cf') {
      const rows = this.cfRows();
      return !rows.length ? '' : this.format() === 'csv' ? cfToCsv(rows) : cfToJson(rows);
    }
    const rows = this.vatRows();
    return !rows.length ? '' : this.format() === 'csv' ? vatToCsv(rows) : vatToJson(rows);
  }
}
