// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { PrivacyNote } from '../../shared/privacy-note';
import {
  BITS,
  CLASSES,
  PRESETS,
  PermBit,
  PermClass,
  Parsed,
  SPECIALS,
  SpecialBit,
  applySymbolic,
  chmodCommand,
  chmodCommandSymbolic,
  classDigit,
  hasBit,
  hasSpecial,
  parseOctal,
  parseSymbolic,
  setBit,
  setSpecial,
  toOctal,
  toSymbolic,
} from './chmod';
import { CHMOD_DICTIONARIES } from './chmod-calculator.i18n';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './chmod-calculator.share';

type Field = 'octal' | 'symbolic';

@Component({
  selector: 'app-chmod-calculator',
  imports: [ShareLink, PrivacyNote, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chmod-calculator.page.html',
  styleUrl: './chmod-calculator.page.scss',
})
export class ChmodCalculatorPage {
  protected readonly i18n = inject(I18nService);

  protected readonly classes = CLASSES;
  protected readonly bits = BITS;
  protected readonly specials = SPECIALS;
  protected readonly presets = PRESETS;

  protected readonly mode = signal(0o644);
  /** Testo che l'utente sta scrivendo in un campo: finché non cambia altro, resta com'è (anche se non valido). */
  private readonly draft = signal<{ field: Field; text: string } | null>(null);
  protected readonly path = signal('file');
  protected readonly recursive = signal(false);
  protected readonly expr = signal('');
  protected readonly exprDir = signal(false);

  protected readonly octalText = computed(() => {
    const d = this.draft();
    return d?.field === 'octal' ? d.text : toOctal(this.mode());
  });
  protected readonly symbolicText = computed(() => {
    const d = this.draft();
    return d?.field === 'symbolic' ? d.text : toSymbolic(this.mode());
  });
  protected readonly octalError = computed(() => this.draftError('octal'));
  protected readonly symbolicError = computed(() => this.draftError('symbolic'));

  protected readonly command = computed(() =>
    chmodCommand(this.mode(), { path: this.path(), recursive: this.recursive() }),
  );
  protected readonly commandSymbolic = computed(() =>
    chmodCommandSymbolic(this.mode(), { path: this.path(), recursive: this.recursive() }),
  );

  protected readonly summary = computed(() => {
    const m = this.mode();
    return CLASSES.map((cls) => {
      const acts: string[] = BITS.filter((b) => hasBit(m, cls, b)).map((b) => this.i18n.t('chmod.act.' + b));
      const special: SpecialBit = cls === 'owner' ? 'setuid' : cls === 'group' ? 'setgid' : 'sticky';
      if (hasSpecial(m, special)) acts.push(this.i18n.t('chmod.act.' + special));
      return this.i18n.t('chmod.summary.line', {
        classe: this.i18n.t('chmod.class.' + cls),
        azioni: acts.length ? acts.join(', ') : this.i18n.t('chmod.summary.none'),
      });
    });
  });

  protected readonly currentPreset = computed(() => PRESETS.find((p) => p.mode === this.mode()) ?? null);

  private readonly exprResult = computed<Parsed | null>(() =>
    this.expr().trim() === '' ? null : applySymbolic(this.expr(), this.mode(), { isDir: this.exprDir() }),
  );
  protected readonly exprPreview = computed(() => {
    const r = this.exprResult();
    return r?.ok ? r : null;
  });
  protected readonly exprError = computed(() => {
    const r = this.exprResult();
    return r && !r.ok ? this.errorText(r) : '';
  });

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode,
    path: this.path,
    recursive: this.recursive,
    expr: this.expr,
    exprDir: this.exprDir,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);

  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
    this.draft.set(null);
  }

  constructor() {
    this.i18n.register(CHMOD_DICTIONARIES);
  }

  protected digit(cls: PermClass): number {
    return classDigit(this.mode(), cls);
  }

  protected has(cls: PermClass, bit: PermBit): boolean {
    return hasBit(this.mode(), cls, bit);
  }

  protected hasSpecialBit(bit: SpecialBit): boolean {
    return hasSpecial(this.mode(), bit);
  }

  protected toggle(cls: PermClass, bit: PermBit, on: boolean): void {
    this.setMode(setBit(this.mode(), cls, bit, on));
  }

  protected toggleSpecial(bit: SpecialBit, on: boolean): void {
    this.setMode(setSpecial(this.mode(), bit, on));
  }

  protected bitLabel(cls: PermClass, bit: PermBit): string {
    return this.i18n.t('chmod.bit.aria', { classe: this.i18n.t('chmod.class.' + cls), permesso: this.i18n.t('chmod.bit.' + bit) });
  }

  protected setMode(mode: number): void {
    this.draft.set(null);
    this.mode.set(mode & 0o7777);
  }

  protected onOctal(text: string): void {
    this.draft.set({ field: 'octal', text });
    const r = parseOctal(text);
    if (r.ok) this.mode.set(r.mode);
  }

  protected onSymbolic(text: string): void {
    this.draft.set({ field: 'symbolic', text });
    const r = parseSymbolic(text);
    if (r.ok) this.mode.set(r.mode);
  }

  protected applyExpression(): void {
    const r = this.exprPreview();
    if (!r) return;
    this.setMode(r.mode);
    this.expr.set('');
  }

  protected presetDescription(id: string): string {
    return this.i18n.t('chmod.preset.' + id);
  }

  private draftError(field: Field): string {
    const d = this.draft();
    if (d?.field !== field) return '';
    const r = field === 'octal' ? parseOctal(d.text) : parseSymbolic(d.text);
    return r.ok ? '' : this.errorText(r);
  }

  private errorText(r: Extract<Parsed, { ok: false }>): string {
    return this.i18n.t('chmod.err.' + r.error, { at: r.at ?? '' });
  }

  protected formatOctal(mode: number): string {
    return toOctal(mode);
  }

  protected formatSymbolic(mode: number): string {
    return toSymbolic(mode);
  }
}
