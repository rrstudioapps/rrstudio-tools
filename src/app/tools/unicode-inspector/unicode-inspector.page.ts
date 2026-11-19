// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { UNICODE_DICTIONARIES } from './unicode-inspector.i18n';
import { SHARE_SCHEMA } from './unicode-inspector.share';
import { InspectedChar, MAX_INSPECTED, inspectText, normalizeText, removeInvisibles } from './unicode';

type Transform = 'clean' | 'nfc' | 'nfkc';

/** Esempio: omoglifo cirillico, zero-width, NBSP, accento combinante ed emoji. */
const SAMPLE = 'pаypal.com​ café é a b 👨‍👩‍👧';

@Component({
  selector: 'app-unicode-inspector',
  imports: [ShareLink, Icon, PrivacyNote, IoPanel, CopyButton, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unicode-inspector.page.html',
  styleUrl: './unicode-inspector.page.scss',
})
export class UnicodeInspectorPage {
  protected readonly i18n = inject(I18nService);

  protected readonly input = signal('');
  protected readonly keepEmoji = signal(true);
  protected readonly transform = signal<Transform | null>(null);
  protected readonly maxShown = MAX_INSPECTED;

  protected readonly report = computed(() => inspectText(this.input()));

  protected readonly output = computed(() => {
    const t = this.transform();
    const s = this.input();
    if (!t) return '';
    if (t === 'clean') return removeInvisibles(s, { keepEmoji: this.keepEmoji() });
    return normalizeText(s, t === 'nfc' ? 'NFC' : 'NFKC');
  });
  protected readonly outputNote = computed(() => {
    if (!this.transform()) return '';
    const before = [...this.input()].length;
    const after = [...this.output()].length;
    const changed = this.output() !== this.input();
    return changed ? this.i18n.t('uni.out.changed', { n: Math.abs(before - after) || 1 }) : this.i18n.t('uni.out.same');
  });

  protected readonly scriptsText = computed(() => {
    const s = this.report().scripts;
    return this.i18n.t('uni.sum.scripts', { list: s.length ? s.join(', ') : this.i18n.t('uni.sum.none') });
  });
  protected readonly clean = computed(() => {
    const r = this.report();
    return r.codePointCount > 0 && r.invisibleCount === 0 && r.mixedWords.length === 0 && r.homoglyphCount === 0;
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { input: this.input };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(UNICODE_DICTIONARIES);
    const rx = inject(ToolHandoff).take('unicode-inspector');
    if (rx?.text !== undefined) this.input.set(rx.text);
  }

  protected onInput(v: string): void {
    this.input.set(v);
    this.transform.set(null);
  }

  protected loadSample(): void {
    this.onInput(SAMPLE);
  }

  protected useOutput(): void {
    this.input.set(this.output());
    this.transform.set(null);
  }

  /** Come mostrare il carattere nella tabella: gli invisibili con un segnaposto. */
  protected shown(c: InspectedChar): string {
    if (c.invisible === 'space' || c.cp === 0x20) return '␣';
    if (c.invisible) return '∅';
    if (c.cp === 0x0a || c.cp === 0x0d || c.cp === 0x09) return '↵';
    if (c.category === 'Mn' || c.category === 'Me' || c.category === 'Mc') return '◌' + c.char;
    return c.char;
  }

  protected flags(c: InspectedChar): string[] {
    const out: string[] = [];
    if (c.invisible) out.push(this.i18n.t('uni.flag.' + c.invisible));
    if (c.homoglyphOf) out.push(this.i18n.t('uni.flag.homoglyph', { c: c.homoglyphOf }));
    return out;
  }
}
