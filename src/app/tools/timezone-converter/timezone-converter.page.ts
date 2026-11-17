// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import { formatIso, parseIso, toDays } from '../date-calculator/dates';
import { TZ_DICTIONARIES } from './timezone-converter.i18n';
import {
  Resolved,
  cityOf,
  formatOffset,
  isDst,
  isValidZone,
  listZones,
  offsetMinutes,
  partsInZone,
  regionOf,
  searchZones,
  zoneShortName,
  zonedToInstant,
} from './timezones';

interface ZoneCard {
  zone: string;
  city: string;
  region: string;
  time: string;
  date: string;
  dayDiff: string;
  offset: string;
  abbr: string;
  dst: boolean;
  isSource: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

@Component({
  selector: 'app-timezone-converter',
  imports: [CopyButton, Icon, PrivacyNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timezone-converter.page.html',
  styleUrl: './timezone-converter.page.scss',
})
export class TimezoneConverterPage {
  protected readonly i18n = inject(I18nService);
  private readonly allZones = listZones();

  /** Prima dell'idratazione la pagina non conosce il fuso del visitatore: parte da una selezione fissa. */
  protected readonly zones = signal<string[]>(['Europe/Rome', 'UTC', 'America/New_York', 'Asia/Tokyo']);
  protected readonly source = signal('Europe/Rome');
  protected readonly dateText = signal('');
  protected readonly timeText = signal('');
  protected readonly query = signal('');

  constructor() {
    this.i18n.register(TZ_DICTIONARIES);
    // il fuso e l'ora del visitatore esistono solo nel browser: il prerender resta uguale per tutti
    afterNextRender(() => {
      const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (own && isValidZone(own)) {
        this.zones.update((z) => (z.includes(own) ? z : [own, ...z.slice(0, 3)]));
        this.source.set(own);
      }
      this.setNow();
    });
  }

  /** Ricava data e ora locali del fuso di partenza dall'istante attuale. */
  protected setNow(): void {
    this.setFromInstant(Date.now(), this.source());
  }

  private setFromInstant(ms: number, tz: string): void {
    const p = partsInZone(ms, tz);
    this.dateText.set(formatIso({ y: p.y, m: p.m, d: p.d }));
    this.timeText.set(`${pad(p.h)}:${pad(p.mi)}`);
  }

  private readonly parsed = computed(() => {
    const date = parseIso(this.dateText());
    const t = /^(\d{2}):(\d{2})$/.exec(this.timeText());
    if (!date || !t || Number(t[1]) > 23 || Number(t[2]) > 59) return null;
    return { ...date, h: Number(t[1]), mi: Number(t[2]) };
  });

  protected readonly inputError = computed(() => this.dateText() !== '' && this.timeText() !== '' && this.parsed() === null);

  protected readonly resolved = computed<Resolved | null>(() => {
    const p = this.parsed();
    return p ? zonedToInstant(this.source(), { y: p.y, m: p.m, d: p.d, h: p.h, mi: p.mi }) : null;
  });

  protected readonly warning = computed(() => {
    const r = this.resolved();
    return r && r.status !== 'ok' ? this.i18n.t(r.status === 'gap' ? 'tz.gap' : 'tz.ambiguous') : '';
  });

  protected readonly cards = computed<ZoneCard[]>(() => {
    const r = this.resolved();
    if (!r) return [];
    const locale = this.i18n.locale();
    const src = partsInZone(r.ms, this.source());
    const srcDay = toDays({ y: src.y, m: src.m, d: src.d });
    return this.zones().map((zone) => {
      const p = partsInZone(r.ms, zone);
      const diff = toDays({ y: p.y, m: p.m, d: p.d }) - srcDay;
      const n = Math.abs(diff);
      const t = (k: string) => this.i18n.t(k, { n });
      return {
        zone,
        city: cityOf(zone),
        region: regionOf(zone),
        time: `${pad(p.h)}:${pad(p.mi)}`,
        date: new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: zone }).format(r.ms),
        dayDiff: diff === 0 ? this.i18n.t('tz.sameDay') : diff > 0 ? t(n === 1 ? 'tz.dayPlus' : 'tz.dayPlusMany') : t(n === 1 ? 'tz.dayMinus' : 'tz.dayMinusMany'),
        offset: formatOffset(offsetMinutes(zone, r.ms)),
        abbr: zoneShortName(zone, r.ms, locale),
        dst: isDst(zone, r.ms),
        isSource: zone === this.source(),
      };
    });
  });

  protected readonly hits = computed(() =>
    searchZones(this.query(), this.allZones, this.i18n.locale(), 8).filter((z) => !this.zones().includes(z)),
  );
  protected readonly searching = computed(() => this.query().trim() !== '');

  protected readonly copyText = computed(() =>
    this.cards()
      .map((c) => `${c.city}\t${c.time}\t${c.date}\t${c.offset}`)
      .join('\n'),
  );

  protected zoneLabel(zone: string): string {
    const r = regionOf(zone);
    return r ? `${cityOf(zone)} (${r})` : cityOf(zone);
  }

  protected addZone(zone: string): void {
    this.zones.update((z) => (z.includes(zone) ? z : [...z, zone]));
    this.query.set('');
  }

  protected removeZone(zone: string): void {
    if (this.zones().length <= 1) return;
    const rest = this.zones().filter((z) => z !== zone);
    // se si toglie il fuso di partenza, la partenza passa al primo rimasto senza cambiare l'istante
    if (zone === this.source()) this.useAsSource(rest[0]);
    this.zones.set(rest);
  }

  /** Cambia il fuso di partenza mantenendo lo stesso istante: data e ora si riscrivono nel nuovo fuso. */
  protected useAsSource(zone: string): void {
    const r = this.resolved();
    if (r) this.setFromInstant(r.ms, zone);
    this.source.set(zone);
  }
}
