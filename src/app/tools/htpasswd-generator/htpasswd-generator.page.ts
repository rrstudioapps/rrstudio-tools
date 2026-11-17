// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { HtpasswdClient } from './htpasswd-client';
import { HT_DICTIONARIES } from './htpasswd-generator.i18n';
import { BCRYPT_MAX_BYTES, DEFAULT_COST, HtAlgo, MAX_COST, MIN_COST, VerifyResult, clampCost, passwordBytes } from './htpasswd';

interface Row {
  id: number;
  user: string;
  password: string;
}

const MAX_USERS = 50;

@Component({
  selector: 'app-htpasswd-generator',
  imports: [Icon, IoPanel, PrivacyNote, Segmented, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './htpasswd-generator.page.html',
  styleUrl: './htpasswd-generator.page.scss',
})
export class HtpasswdGeneratorPage {
  protected readonly i18n = inject(I18nService);
  private readonly client = new HtpasswdClient();
  protected readonly minCost = MIN_COST;
  protected readonly maxCost = MAX_COST;
  protected readonly maxUsers = MAX_USERS;

  protected readonly algo = signal<HtAlgo>('bcrypt');
  protected readonly algos = computed<SegmentOption<HtAlgo>[]>(() =>
    (['bcrypt', 'apr1', 'sha1'] as const).map((a) => ({ value: a, label: this.i18n.t('ht.algo.' + a) })),
  );
  protected readonly cost = signal(DEFAULT_COST);
  protected readonly rows = signal<Row[]>([{ id: 1, user: '', password: '' }]);
  protected readonly showPasswords = signal(false);
  protected readonly busy = signal(false);
  protected readonly lines = signal<string[]>([]);
  protected readonly errors = signal<string[]>([]);
  private nextId = 2;

  protected readonly text = computed(() => this.lines().join('\n'));
  protected readonly meta = computed(() => (this.lines().length ? this.i18n.t('ht.out.meta', { n: this.lines().length }) : ''));
  protected readonly longPassword = computed(
    () => this.algo() === 'bcrypt' && this.rows().some((r) => passwordBytes(r.password) > BCRYPT_MAX_BYTES),
  );
  protected readonly weak = computed(() => this.algo() !== 'bcrypt');

  // ---- verifica ----
  protected readonly verifyLineText = signal('');
  protected readonly verifyPassword = signal('');
  protected readonly verifyResult = signal<VerifyResult | null>(null);
  protected readonly verifyBusy = signal(false);
  protected readonly verifyError = computed(() => {
    const r = this.verifyResult();
    if (!r || r.ok) return '';
    return this.i18n.t('ht.verr.' + r.error, { type: r.type ? this.i18n.t('ht.type.' + r.type) : '' });
  });

  constructor() {
    this.i18n.register(HT_DICTIONARIES);
    inject(DestroyRef).onDestroy(() => this.client.dispose());
  }

  protected get fallback(): boolean {
    return this.client.fallback;
  }

  protected setCost(v: string): void {
    this.cost.set(clampCost(Number(v)));
  }

  protected addRow(): void {
    if (this.rows().length >= MAX_USERS) return;
    this.rows.update((l) => [...l, { id: this.nextId++, user: '', password: '' }]);
  }

  protected removeRow(id: number): void {
    this.rows.update((l) => (l.length > 1 ? l.filter((r) => r.id !== id) : [{ ...l[0], user: '', password: '' }]));
  }

  protected setRow(id: number, key: 'user' | 'password', value: string): void {
    this.rows.update((l) => l.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  protected async generate(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    const errors: string[] = [];
    const lines: string[] = [];
    const seen = new Set<string>();
    try {
      const rows = this.rows();
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const res = await this.client.make(r.user, r.password, this.algo(), this.cost());
        if (res.ok) {
          lines.push(res.line);
          if (seen.has(r.user)) errors.push(this.i18n.t('ht.err.dup', { user: r.user }));
          seen.add(r.user);
        } else {
          errors.push(this.i18n.t('ht.err.' + res.error, { n: i + 1 }));
        }
      }
    } catch {
      errors.push(this.i18n.t('ht.err.fail'));
    }
    this.lines.set(lines);
    this.errors.set(errors);
    this.busy.set(false);
  }

  protected download(): void {
    saveBytes(new TextEncoder().encode(this.text() + '\n'), '.htpasswd', 'text/plain;charset=utf-8');
  }

  protected async verify(): Promise<void> {
    if (this.verifyBusy()) return;
    this.verifyBusy.set(true);
    try {
      this.verifyResult.set(await this.client.verify(this.verifyLineText(), this.verifyPassword()));
    } catch {
      this.verifyResult.set({ ok: false, error: 'bad-hash' });
    }
    this.verifyBusy.set(false);
  }

  protected verifyInfo(r: Extract<VerifyResult, { ok: true }>): string {
    const base = this.i18n.t('ht.verify.info', { user: r.user, type: this.i18n.t('ht.type.' + r.type) });
    return r.cost !== undefined ? `${base} · ${this.i18n.t('ht.verify.cost', { n: r.cost })}` : base;
  }

  protected resetVerify(): void {
    this.verifyResult.set(null);
  }
}
