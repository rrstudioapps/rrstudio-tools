// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { ToolHandoff } from '../../shared/tool-handoff';
import { MORSE_TABLE, MorseWords, Tone, formatMorse, morseTimeline, parseMorse, textToWords, totalMs, wordsToText } from './morse';
import { MORSE_DICTIONARIES } from './morse-code.i18n';
import { SHARE_SCHEMA } from './morse-code.share';

type Mode = 'encode' | 'decode';
type Symbols = 'ascii' | 'dots';
type LetterSep = 'space' | 'double';
type WordSep = 'slash' | 'spaces' | 'bar';

/** La riproduzione non supera cinque minuti. */
const MAX_PLAY_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-morse-code',
  imports: [ShareLink, Icon, PrivacyNote, Segmented, IoPanel, CopyButton, SendTo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './morse-code.page.html',
  styleUrl: './morse-code.page.scss',
})
export class MorseCodePage {
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<Mode>('encode');
  protected readonly input = signal('');
  protected readonly wpm = signal(15);
  protected readonly freq = signal(600);
  protected readonly symbols = signal<Symbols>('ascii');
  protected readonly letterSep = signal<LetterSep>('space');
  protected readonly wordSep = signal<WordSep>('slash');
  protected readonly flash = signal(true);
  protected readonly playing = signal(false);
  /** Stato del segnale durante la riproduzione (per il riquadro visivo). */
  protected readonly signalOn = signal(false);
  protected readonly audioError = signal(false);

  protected readonly reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  protected readonly table = MORSE_TABLE;

  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'encode', label: this.i18n.t('morse.mode.encode') },
    { value: 'decode', label: this.i18n.t('morse.mode.decode') },
  ]);

  /** Parole in codice, qualunque sia la direzione (servono anche per la riproduzione). */
  private readonly parsed = computed(() => {
    const src = this.input();
    if (this.mode() === 'encode') {
      const r = textToWords(src);
      return { words: r.words, unknownChars: r.unknown, unknownGroups: [] as string[] };
    }
    const words = parseMorse(src);
    return { words, unknownChars: [] as string[], unknownGroups: wordsToText(words).unknown };
  });

  protected readonly output = computed(() => {
    const p = this.parsed();
    if (this.mode() === 'decode') return wordsToText(p.words).text;
    return formatMorse(p.words, {
      dot: this.symbols() === 'ascii' ? '.' : '•',
      dash: this.symbols() === 'ascii' ? '-' : '—',
      letterSep: this.letterSep() === 'space' ? ' ' : '  ',
      wordSep: { slash: ' / ', spaces: '   ', bar: ' | ' }[this.wordSep()],
    });
  });

  protected readonly warnings = computed(() => {
    const p = this.parsed();
    const out: string[] = [];
    if (p.unknownChars.length) out.push(this.i18n.t('morse.unknown', { list: p.unknownChars.join(' ') }));
    if (p.unknownGroups.length) out.push(this.i18n.t('morse.unknownGroups', { list: p.unknownGroups.join(' ') }));
    return out;
  });

  private readonly tones = computed<Tone[]>(() => this.capped(morseTimeline(this.knownWords(this.parsed().words), this.wpm())));
  protected readonly durationText = computed(() => {
    const ms = totalMs(this.tones());
    return ms > 0 ? this.i18n.t('morse.duration', { s: Math.max(1, Math.round(ms / 1000)) }) : '';
  });
  protected readonly truncated = computed(() => totalMs(morseTimeline(this.knownWords(this.parsed().words), this.wpm())) > MAX_PLAY_MS);

  protected readonly inputPlaceholder = computed(() => this.i18n.t(this.mode() === 'encode' ? 'morse.in.ph.text' : 'morse.in.ph.morse'));

  // Link di condivisione: lo stato sta nell'hash dell'URL (vedi shared/share-link.ts)
  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = {
    mode: this.mode,
    input: this.input,
    wpm: this.wpm,
    freq: this.freq,
    symbols: this.symbols,
    letterSep: this.letterSep,
    wordSep: this.wordSep,
  };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  private ctx: AudioContext | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private osc: OscillatorNode | null = null;

  constructor() {
    this.i18n.register(MORSE_DICTIONARIES);
    const rx = inject(ToolHandoff).take('morse-code');
    if (rx?.text !== undefined) {
      this.mode.set('encode');
      this.input.set(rx.text);
    }
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      void this.ctx?.close();
    });
  }

  /** In decodifica solo i gruppi validi si possono riprodurre. */
  private knownWords(words: MorseWords): MorseWords {
    return words.map((w) => w.filter((c) => /^[.-]+$/.test(c))).filter((w) => w.length > 0);
  }

  private capped(tones: Tone[]): Tone[] {
    const out: Tone[] = [];
    let t = 0;
    for (const x of tones) {
      if (t >= MAX_PLAY_MS) break;
      out.push(x);
      t += x.ms;
    }
    return out;
  }

  protected onMode(m: Mode): void {
    // porta l'uscita nell'ingresso: ciò che era il risultato diventa il testo di partenza
    if (m !== this.mode() && this.output() !== '') this.input.set(this.output());
    this.mode.set(m);
    this.stop();
  }

  protected clear(): void {
    this.input.set('');
    this.stop();
  }

  protected play(): void {
    const tones = this.tones();
    if (tones.length === 0) return;
    this.stop();
    this.playing.set(true);
    this.audioError.set(false);
    let t0 = 0;
    const AC = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      try {
        this.ctx ??= new AC();
        void this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.value = this.freq();
        gain.gain.value = 0;
        osc.connect(gain).connect(this.ctx.destination);
        t0 = this.ctx.currentTime + 0.05;
        let t = t0;
        for (const tone of tones) {
          if (tone.on) {
            // rampe di 5 ms per evitare i "click" all'accensione e allo spegnimento
            const dur = tone.ms / 1000;
            const ramp = Math.min(0.005, dur / 4);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.4, t + ramp);
            gain.gain.setValueAtTime(0.4, t + dur - ramp);
            gain.gain.linearRampToValueAtTime(0, t + dur);
          }
          t += tone.ms / 1000;
        }
        osc.start(t0);
        osc.stop(t + 0.05);
        this.osc = osc;
      } catch {
        this.audioError.set(true);
      }
    } else this.audioError.set(true);
    // indicatore visivo: stessa sequenza, con i timer del browser (precisione sufficiente per un lampeggio)
    let at = 50;
    for (const tone of tones) {
      const on = tone.on;
      this.timers.push(setTimeout(() => this.signalOn.set(on), at));
      at += tone.ms;
    }
    this.timers.push(setTimeout(() => this.stop(), at + 50));
  }

  protected stop(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    try {
      this.osc?.stop();
    } catch {
      // già fermo
    }
    this.osc?.disconnect();
    this.osc = null;
    this.signalOn.set(false);
    this.playing.set(false);
  }
}
