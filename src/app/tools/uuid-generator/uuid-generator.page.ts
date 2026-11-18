// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { UUID_DICTIONARIES } from './uuid-generator.i18n';
import { IdKind, Inspection, MAX_COUNT, MIN_COUNT, clampCount, formatId, generateIds, inspectId, newState } from './uuid';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './uuid-generator.share';
import { ToolHandoff } from '../../shared/tool-handoff';

@Component({
  selector: 'app-uuid-generator',
  imports: [ShareLink, Icon, IoPanel, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './uuid-generator.page.html',
  styleUrl: './uuid-generator.page.scss',
})
export class UuidGeneratorPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly minCount = MIN_COUNT;
  protected readonly maxCount = MAX_COUNT;

  protected readonly kind = signal<IdKind>('v4');
  protected readonly count = signal(5);
  protected readonly upper = signal(false);
  protected readonly hyphens = signal(true);
  protected readonly braces = signal(false);
  /** Identificativi in forma canonica: le opzioni di formato li riscrivono senza rigenerarli. */
  private readonly ids = signal<string[]>([]);
  private state = newState();

  protected readonly kinds = computed<SegmentOption<IdKind>[]>(() => [
    { value: 'v4', label: this.i18n.t('uuid.type.v4') },
    { value: 'v7', label: this.i18n.t('uuid.type.v7') },
    { value: 'ulid', label: this.i18n.t('uuid.type.ulid') },
  ]);

  protected readonly lines = computed(() => {
    const k = this.kind();
    const o = { upper: this.upper(), hyphens: this.hyphens(), braces: this.braces() };
    return this.ids().map((id) => formatId(id, k, o));
  });
  protected readonly text = computed(() => this.lines().join('\n'));
  protected readonly meta = computed(() => (this.lines().length ? this.i18n.t('uuid.out.meta', { n: this.lines().length }) : ''));

  // ---- validatore ----
  protected readonly checkInput = signal('');
  protected readonly inspection = computed<Inspection | null>(() =>
    this.checkInput().trim() === '' ? null : inspectId(this.checkInput()),
  );
  protected readonly errorText = computed(() => {
    const r = this.inspection();
    return r && !r.ok ? this.i18n.t('uuid.err.' + r.error) : '';
  });
  protected readonly versionText = computed(() => {
    const r = this.inspection();
    if (!r?.ok || r.kind !== 'uuid') return '';
    const key = 'uuid.res.v' + r.version;
    return r.version >= 0 && r.version <= 8 ? this.i18n.t(key) : this.i18n.t('uuid.res.vx', { n: r.version });
  });
  protected readonly dateInfo = computed(() => {
    const r = this.inspection();
    if (!r?.ok || r.ms === null) return null;
    const date = new Date(r.ms);
    if (Number.isNaN(date.getTime())) return null;
    const loc = this.i18n.locale();
    const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, timeZoneName: 'short' };
    return {
      iso: date.toISOString(),
      utc: new Intl.DateTimeFormat(loc, { ...opts, timeZone: 'UTC' }).format(date),
      local: new Intl.DateTimeFormat(loc, opts).format(date),
    };
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    kind: this.kind,
    count: this.count,
    upper: this.upper,
    hyphens: this.hyphens,
    braces: this.braces,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(UUID_DICTIONARIES);
    // contenuto ricevuto da un altro strumento ("Invia a…", incolla o trascina dalla home)
    const rx = inject(ToolHandoff).take('uuid-generator');
    if (rx?.text !== undefined) this.checkInput.set(rx.text.trim());
    // Rigenera al cambio di tipo o quantità (solo nel browser: la pagina prerenderizzata non contiene identificativi)
    effect(() => {
      const kind = this.kind();
      const count = this.count();
      if (!this.browser) return;
      untracked(() => this.run(kind, count));
    });
  }

  private run(kind: IdKind, count: number): void {
    this.state = newState();
    this.ids.set(generateIds(kind, count, this.state));
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.altKey) {
      e.preventDefault();
      this.generate();
    }
  }

  protected generate(): void {
    this.run(this.kind(), this.count());
  }

  protected setCount(value: string): void {
    this.count.set(clampCount(Number(value)));
  }

  protected download(): void {
    const name = `${this.kind() === 'ulid' ? 'ulid' : 'uuid-' + this.kind()}.txt`;
    saveBytes(new TextEncoder().encode(this.text() + '\n'), name, 'text/plain;charset=utf-8');
  }

  protected checkFirst(): void {
    const first = this.ids()[0];
    if (first) this.checkInput.set(first);
  }

  protected onCheck(e: Event): void {
    this.checkInput.set((e.target as HTMLInputElement).value);
  }
}
