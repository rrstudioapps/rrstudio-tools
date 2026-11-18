// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, type SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import {
  flipCoins, formatDice, parseDice, parseList, pickFromList, randomNumbers, rollDice, splitTeams,
} from './random-number-generator';
import { RND_DICTIONARIES } from './random-number-generator.i18n';
import { SHARE_SCHEMA } from './random-number-generator.share';

type Mode = 'number' | 'dice' | 'list' | 'coin';
type Action = 'pick' | 'teams';

/** Risultato mostrato: sempre l'ultimo ottenuto con il pulsante, mai ricalcolato mentre si cambiano i campi. */
type Shown =
  | { kind: 'numbers'; values: string[] }
  | { kind: 'dice'; label: string; rolls: number[]; total: number }
  | { kind: 'picked'; items: string[] }
  | { kind: 'teams'; teams: string[][] }
  | { kind: 'coin'; heads: number; tails: number; flips: boolean[] };

const toNumber = (text: string): number => (text.trim() === '' ? NaN : Number(text.trim().replace(',', '.')));

@Component({
  selector: 'app-random-number-generator',
  imports: [ShareLink, PrivacyNote, CopyButton, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './random-number-generator.page.html',
  styleUrl: './random-number-generator.page.scss',
})
export class RandomNumberGeneratorPage {
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<Mode>('number');
  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'number', label: this.i18n.t('rnd.mode.number') },
    { value: 'dice', label: this.i18n.t('rnd.mode.dice') },
    { value: 'list', label: this.i18n.t('rnd.mode.list') },
    { value: 'coin', label: this.i18n.t('rnd.mode.coin') },
  ]);

  // numeri
  protected readonly min = signal('1');
  protected readonly max = signal('100');
  protected readonly count = signal('1');
  protected readonly decimals = signal(0);
  protected readonly unique = signal(false);
  protected readonly sorted = signal(false);
  protected readonly decimalOptions = [0, 1, 2, 3, 4];
  // dadi
  protected readonly dice = signal('2d6');
  protected readonly faces = [4, 6, 8, 10, 12, 20, 100];
  // elenco
  protected readonly list = signal('');
  protected readonly action = signal<Action>('pick');
  protected readonly actions = computed<SegmentOption<Action>[]>(() => [
    { value: 'pick', label: this.i18n.t('rnd.list.pick') },
    { value: 'teams', label: this.i18n.t('rnd.list.teams') },
  ]);
  protected readonly pick = signal('1');
  protected readonly pickUnique = signal(true);
  protected readonly teams = signal('2');
  protected readonly items = computed(() => parseList(this.list()));
  // moneta
  protected readonly flips = signal('1');

  protected readonly shown = signal<Shown | null>(null);
  protected readonly error = signal('');

  protected readonly goLabel = computed(() => {
    const m = this.mode();
    return this.i18n.t('rnd.go.' + (m === 'list' ? this.action() : m));
  });

  protected readonly copyText = computed(() => {
    const s = this.shown();
    if (!s) return '';
    switch (s.kind) {
      case 'numbers':
        return s.values.join('\n');
      case 'dice':
        return `${s.label}: ${s.rolls.join(' + ')} → ${s.total}`;
      case 'picked':
        return s.items.join('\n');
      case 'teams':
        return s.teams.map((t, i) => `${this.i18n.t('rnd.team', { n: i + 1 })}: ${t.join(', ')}`).join('\n');
      case 'coin':
        return s.flips.length === 1
          ? this.i18n.t(s.heads ? 'rnd.coin.heads' : 'rnd.coin.tails')
          : this.i18n.t('rnd.coin.summary', { h: s.heads, t: s.tails });
    }
  });

  // Link di condivisione: solo le impostazioni, nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode, min: this.min, max: this.max, count: this.count, decimals: this.decimals, unique: this.unique, sorted: this.sorted,
    dice: this.dice, list: this.list, action: this.action, pick: this.pick, pickUnique: this.pickUnique, teams: this.teams, flips: this.flips,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
    this.shown.set(null);
    this.error.set('');
  }

  constructor() {
    this.i18n.register(RND_DICTIONARIES);
  }

  protected setMode(m: Mode): void {
    this.mode.set(m);
    this.shown.set(null);
    this.error.set('');
  }

  protected setFace(n: number): void {
    const spec = parseDice(this.dice());
    this.dice.set(formatDice({ count: spec?.count ?? 1, sides: n, mod: spec?.mod ?? 0 }));
  }

  protected generate(): void {
    this.error.set('');
    switch (this.mode()) {
      case 'number':
        return this.generateNumbers();
      case 'dice':
        return this.generateDice();
      case 'list':
        return this.generateList();
      case 'coin':
        return this.generateCoin();
    }
  }

  private fail(key: string): void {
    this.shown.set(null);
    this.error.set(this.i18n.t('rnd.err.' + key));
  }

  private generateNumbers(): void {
    const r = randomNumbers({
      min: toNumber(this.min()), max: toNumber(this.max()), count: toNumber(this.count()),
      unique: this.unique(), decimals: this.decimals(), sorted: this.sorted(),
    });
    if (!r.ok) return this.fail(r.error);
    const lang = this.i18n.lang();
    this.shown.set({ kind: 'numbers', values: r.values.map((v) => (lang === 'it' ? String(v).replace('.', ',') : String(v))) });
  }

  private generateDice(): void {
    const spec = parseDice(this.dice());
    if (!spec) return this.fail('dice');
    this.shown.set({ kind: 'dice', label: formatDice(spec), ...rollDice(spec) });
  }

  private generateList(): void {
    const items = this.items();
    if (items.length === 0) return this.fail('list');
    if (this.action() === 'pick') {
      const n = toNumber(this.pick());
      if (!Number.isInteger(n) || n < 1) return this.fail('pick');
      this.shown.set({ kind: 'picked', items: pickFromList(items, Math.min(n, 1000), this.pickUnique()) });
    } else {
      const n = toNumber(this.teams());
      if (!Number.isInteger(n) || n < 1 || n > 100) return this.fail('teams');
      this.shown.set({ kind: 'teams', teams: splitTeams(items, n) });
    }
  }

  private generateCoin(): void {
    const n = toNumber(this.flips());
    if (!Number.isInteger(n) || n < 1 || n > 10000) return this.fail('flips');
    this.shown.set({ kind: 'coin', ...flipCoins(n) });
  }

  /** Per i lettori di schermo e il testo: elenco di tiri ridotto se sono molti. */
  protected rollsText(rolls: number[]): string {
    return rolls.length > 60 ? rolls.slice(0, 60).join(' + ') + ' + …' : rolls.join(' + ');
  }

  protected coinLabel(s: Extract<Shown, { kind: 'coin' }>): string {
    return this.i18n.t(s.heads ? 'rnd.coin.heads' : 'rnd.coin.tails');
  }
}
