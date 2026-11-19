// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { I18nService } from '../../core/i18n/i18n.service';
import { PrivacyNote } from '../../shared/privacy-note';
import { ShareLink } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { saveBytes } from '../../shared/download';
import { SHARE_SCHEMA } from './countdown.share';
import { CDT_DICTIONARIES } from './countdown.i18n';
import { HOLIDAYS, ZONES, breakdown, buildIcs, nextOccurrence, parseWall, wallToMs, type HolidayId } from './countdown';

@Component({
  selector: 'app-countdown',
  imports: [ShareLink, PrivacyNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './countdown.page.html',
  styleUrl: './countdown.page.scss',
})
export class CountdownPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly at = signal('');
  protected readonly name = signal('');
  protected readonly zone = signal('local');
  /** Istante corrente: si aggiorna ogni secondo, solo mentre la pagina è aperta. */
  protected readonly now = signal(Date.now());

  protected readonly zones = ZONES;
  protected readonly holidays = HOLIDAYS;
  protected readonly wall = computed(() => parseWall(this.at()));
  protected readonly invalid = computed(() => this.at().trim() !== '' && this.wall() === null);
  protected readonly result = computed(() => {
    const w = this.wall();
    return w ? breakdown(wallToMs(w, this.zone()), this.now(), this.zone()) : null;
  });
  protected readonly targetText = computed(() => {
    const w = this.wall();
    if (!w) return '';
    // la data civile si formatta in UTC per non subire il fuso del dispositivo
    const d = new Date(Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s));
    return new Intl.DateTimeFormat(this.i18n.locale(), { dateStyle: 'full', timeStyle: 'short', timeZone: 'UTC' }).format(d);
  });
  private readonly nf = computed(() => new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 1 }));

  protected readonly shareSchema = SHARE_SCHEMA;
  protected readonly shareState = (): ShareData => ({ at: this.wall() ? this.at() : '', name: this.name().slice(0, 80), zone: this.zone() });
  protected restoreShared(data: ShareData): void {
    const s = data as Partial<Record<string, unknown>>;
    if (typeof s['at'] === 'string') this.at.set(s['at']);
    if (typeof s['name'] === 'string') this.name.set(s['name'].slice(0, 80));
    if (typeof s['zone'] === 'string') this.zone.set(s['zone']);
    this.now.set(Date.now());
  }

  constructor() {
    this.i18n.register(CDT_DICTIONARIES);
    if (this.browser) {
      // si calcola sempre dalla data corrente: i battiti persi o rallentati non falsano il risultato
      const timer = setInterval(() => this.now.set(Date.now()), 1000);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
  }

  protected num(n: number): string {
    return this.nf().format(n);
  }

  protected setZone(value: string): void {
    this.zone.set(value === 'local' || ZONES.includes(value) ? value : 'local');
    this.now.set(Date.now());
  }

  protected pickHoliday(id: HolidayId): void {
    const now = Date.now();
    this.now.set(now);
    this.at.set(nextOccurrence(id, now, this.zone()));
    this.name.set(this.i18n.t('cdt.h.' + id));
  }

  protected clear(): void {
    this.at.set('');
    this.name.set('');
    this.zone.set('local');
  }

  protected downloadIcs(): void {
    const w = this.wall();
    if (!w) return;
    const summary = this.name().trim() || this.i18n.t('cdt.event');
    const ics = buildIcs({ summary, wall: w, zone: this.zone(), now: Date.now() });
    saveBytes(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'evento.ics', 'text/calendar');
  }
}
