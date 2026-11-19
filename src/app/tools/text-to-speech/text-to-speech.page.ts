// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Icon } from '../../shared/icon';
import { PrivacyNote } from '../../shared/privacy-note';
import {
  MAX_CHARS,
  Sentence,
  baseLang,
  clampPitch,
  clampRate,
  clampVolume,
  localVoices,
  pickVoice,
  sentenceAt,
  splitSentences,
  voiceLanguages,
} from './tts';
import { TTS_DICTIONARIES } from './text-to-speech.i18n';

type Support = 'unknown' | 'yes' | 'no';
type Playback = 'idle' | 'speaking' | 'paused' | 'done' | 'error';

const voiceKey = (v: SpeechSynthesisVoice): string => `${v.voiceURI}|${v.name}|${v.lang}`;

@Component({
  selector: 'app-text-to-speech',
  imports: [Icon, PrivacyNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-to-speech.page.html',
  styleUrl: './text-to-speech.page.scss',
})
export class TextToSpeechPage {
  protected readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxChars = MAX_CHARS;
  protected readonly support = signal<Support>('unknown');
  /** Solo voci con localService === true. */
  protected readonly voices = signal<SpeechSynthesisVoice[]>([]);
  protected readonly voicesLoaded = signal(false);
  protected readonly text = signal('');
  protected readonly langFilter = signal('');
  protected readonly voiceId = signal('');
  protected readonly rate = signal(1);
  protected readonly pitch = signal(1);
  protected readonly volume = signal(1);
  protected readonly playback = signal<Playback>('idle');
  protected readonly current = signal(-1);

  private readonly currentEl = viewChild<ElementRef<HTMLElement>>('currentSentence');
  private session = 0;

  protected readonly languages = computed(() => voiceLanguages(this.voices()));
  protected readonly filteredVoices = computed(() => {
    const f = this.langFilter();
    return f ? this.voices().filter((v) => baseLang(v.lang) === f) : this.voices();
  });
  protected readonly selectedVoice = computed(() => this.voices().find((v) => voiceKey(v) === this.voiceId()) ?? null);
  protected readonly truncated = computed(() => this.text().length > MAX_CHARS);
  private readonly speakText = computed(() => this.text().slice(0, MAX_CHARS));
  protected readonly sentences = computed<Sentence[]>(() => splitSentences(this.speakText(), baseLang(this.selectedVoice()?.lang ?? this.i18n.lang())));
  protected readonly active = computed(() => this.playback() === 'speaking' || this.playback() === 'paused');
  protected readonly pieces = computed(() => {
    const s = this.sentences();
    const i = this.current();
    const text = this.speakText();
    if (!this.active() || i < 0 || i >= s.length) return null;
    return { before: text.slice(0, s[i].start), now: text.slice(s[i].start, s[i].end), after: text.slice(s[i].end) };
  });
  protected readonly stateText = computed(() => {
    const total = this.sentences().length;
    switch (this.playback()) {
      case 'speaking':
        return this.i18n.t('tts.state.speaking', { n: this.current() + 1, total });
      case 'paused':
        return this.i18n.t('tts.state.paused', { n: this.current() + 1, total });
      case 'done':
        return this.i18n.t('tts.state.done');
      case 'error':
        return this.i18n.t('tts.state.error');
      default:
        return '';
    }
  });
  protected readonly canPlay = computed(() => !!this.selectedVoice() && this.sentences().length > 0);
  protected readonly hintKey = computed(() => (!this.selectedVoice() ? 'tts.novoice' : this.sentences().length === 0 ? 'tts.empty' : ''));
  protected readonly pct = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

  private get synth(): SpeechSynthesis | null {
    return typeof speechSynthesis === 'undefined' ? null : speechSynthesis;
  }

  constructor() {
    this.i18n.register(TTS_DICTIONARIES);
    afterNextRender(() => {
      const synth = this.synth;
      if (!synth) return void this.support.set('no');
      this.support.set('yes');
      const refresh = () => this.loadVoices();
      synth.addEventListener?.('voiceschanged', refresh);
      this.destroyRef.onDestroy(() => synth.removeEventListener?.('voiceschanged', refresh));
      refresh();
      // alcuni browser caricano le voci in ritardo e non avvisano
      const t = setTimeout(refresh, 600);
      const t2 = setTimeout(() => this.voicesLoaded.set(true), 1500);
      this.destroyRef.onDestroy(() => {
        clearTimeout(t);
        clearTimeout(t2);
      });
    });
    // tiene la frase corrente in vista durante la lettura
    effect(() => {
      const el = this.currentEl();
      if (el) el.nativeElement.scrollIntoView?.({ block: 'nearest' });
    });
    this.destroyRef.onDestroy(() => this.cancel());
  }

  private loadVoices(): void {
    const synth = this.synth;
    if (!synth) return;
    // PRIVACY: si tengono solo le voci locali; le voci di rete non entrano mai nell'elenco
    const list = localVoices(synth.getVoices());
    this.voices.set(list);
    if (list.length > 0) this.voicesLoaded.set(true);
    if (!list.some((v) => voiceKey(v) === this.voiceId())) {
      const lang = this.langFilter() || this.i18n.lang();
      const v = pickVoice(this.filteredVoices().length ? this.filteredVoices() : list, lang);
      this.voiceId.set(v ? voiceKey(v) : '');
    }
  }

  protected onLang(value: string): void {
    this.langFilter.set(value);
    const list = this.filteredVoices();
    if (!list.some((v) => voiceKey(v) === this.voiceId())) {
      const v = pickVoice(list, value || this.i18n.lang());
      this.voiceId.set(v ? voiceKey(v) : '');
      this.restart();
    }
  }

  protected voiceKeyOf(v: SpeechSynthesisVoice): string {
    return voiceKey(v);
  }

  protected setVoice(id: string): void {
    this.voiceId.set(id);
    this.restart();
  }

  protected setNumber(kind: 'rate' | 'pitch' | 'volume', value: string): void {
    const n = Number(value);
    if (kind === 'rate') this.rate.set(clampRate(n));
    else if (kind === 'pitch') this.pitch.set(clampPitch(n));
    else this.volume.set(clampVolume(n));
  }

  protected resetSettings(): void {
    this.rate.set(1);
    this.pitch.set(1);
    this.volume.set(1);
    this.restart();
  }

  protected loadExample(): void {
    this.cancel();
    this.text.set(this.i18n.t('tts.example.text'));
  }

  protected onText(value: string): void {
    if (this.active()) this.cancel();
    this.text.set(value);
    if (this.playback() !== 'idle') this.playback.set('idle');
  }

  // ---- lettura ----

  protected play(): void {
    const synth = this.synth;
    if (!synth || !this.canPlay()) return;
    this.speakFrom(0);
  }

  /** Rilegge dalla frase corrente quando cambiano voce o parametri durante la lettura. */
  protected restart(): void {
    if (this.playback() === 'speaking') this.speakFrom(Math.max(0, this.current()));
  }

  private speakFrom(index: number): void {
    const synth = this.synth;
    const voice = this.selectedVoice();
    const list = this.sentences();
    // senza una voce locale scelta non si legge mai: il motore userebbe la voce predefinita, che può essere di rete
    if (!synth || !voice || voice.localService !== true || index >= list.length) {
      this.finish('done');
      return;
    }
    const mySession = ++this.session;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(list[index].text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = this.rate();
    u.pitch = this.pitch();
    u.volume = this.volume();
    u.onend = () => {
      if (mySession !== this.session) return;
      this.speakFrom(index + 1);
    };
    u.onerror = (e) => {
      if (mySession !== this.session) return;
      const err = (e as SpeechSynthesisErrorEvent).error;
      if (err === 'canceled' || err === 'interrupted') return;
      this.finish('error');
    };
    this.current.set(index);
    this.playback.set('speaking');
    synth.speak(u);
  }

  private finish(state: 'done' | 'error'): void {
    this.session++;
    this.current.set(-1);
    this.playback.set(state);
  }

  protected pause(): void {
    const synth = this.synth;
    if (!synth || this.playback() !== 'speaking') return;
    synth.pause();
    this.playback.set('paused');
  }

  protected resume(): void {
    const synth = this.synth;
    if (!synth || this.playback() !== 'paused') return;
    synth.resume();
    this.playback.set('speaking');
  }

  protected stop(): void {
    this.cancel();
    this.playback.set('idle');
  }

  private cancel(): void {
    this.session++;
    this.current.set(-1);
    const synth = this.synth;
    if (synth && (synth.speaking || synth.pending || synth.paused)) synth.cancel();
  }

  @HostListener('window:pagehide')
  protected onPageHide(): void {
    this.cancel();
    if (this.playback() !== 'idle') this.playback.set('idle');
  }

  protected sentenceOf(position: number): number {
    return sentenceAt(this.sentences(), position);
  }
}
