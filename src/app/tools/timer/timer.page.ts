// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { PrivacyNote } from '../../shared/privacy-note';
import { Segmented, type SegmentOption } from '../../shared/segmented';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { SHARE_SCHEMA } from './timer.share';
import { TIMER_DICTIONARIES } from './timer.i18n';
import {
  DEFAULT_POMODORO, addLap, elapsed, formatClock, lapExtremes, newDown, newUp, parseDuration, pauseDown, pauseUp, pomodoroPhase,
  remaining, resetDown, startDown, startUp, type Down, type Lap, type PomodoroConfig, type Up,
} from './timer';

type Mode = 'countdown' | 'stopwatch' | 'pomodoro';

@Component({
  selector: 'app-timer',
  imports: [ShareLink, PrivacyNote, CopyButton, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timer.page.html',
  styleUrl: './timer.page.scss',
})
export class TimerPage {
  protected readonly i18n = inject(I18nService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly mode = signal<Mode>('countdown');
  protected readonly modes = computed<SegmentOption<Mode>[]>(() => [
    { value: 'countdown', label: this.i18n.t('tm.mode.countdown') },
    { value: 'stopwatch', label: this.i18n.t('tm.mode.stopwatch') },
    { value: 'pomodoro', label: this.i18n.t('tm.mode.pomodoro') },
  ]);
  protected readonly sound = signal(true);
  /** Istante corrente, aggiornato dal ciclo di controllo solo mentre qualcosa è in corso. */
  protected readonly now = signal(Date.now());

  // --- timer ---
  protected readonly durationText = signal('5:00');
  protected readonly cd = signal<Down>(newDown(300_000));
  protected readonly cdDone = signal(false);
  protected readonly presets = [1, 5, 10, 15, 25, 30, 45, 60];
  protected readonly durationMs = computed(() => parseDuration(this.durationText()));
  protected readonly cdLeft = computed(() => remaining(this.cd(), this.now()));
  protected readonly cdText = computed(() => formatClock(this.cdLeft()));
  protected readonly cdProgress = computed(() => (this.cd().total > 0 ? 1 - this.cdLeft() / this.cd().total : 0));
  protected readonly cdStarted = computed(() => this.cd().running || this.cdLeft() < this.cd().total);

  // --- cronometro ---
  protected readonly sw = signal<Up>(newUp());
  protected readonly laps = signal<Lap[]>([]);
  protected readonly swText = computed(() => formatClock(elapsed(this.sw(), this.now()), { centis: true }));
  protected readonly extremes = computed(() => lapExtremes(this.laps()));
  /** Giri dal più recente, con il tempo già formattato. */
  protected readonly lapRows = computed(() => {
    const ex = this.extremes();
    return this.laps()
      .map((l, i) => ({ ...l, splitText: formatClock(l.split, { centis: true, up: true }), totalText: formatClock(l.total, { centis: true, up: true }), tag: ex?.best === i ? 'best' : ex?.worst === i ? 'worst' : '' }))
      .reverse();
  });
  protected readonly lapsText = computed(() =>
    this.laps()
      .map((l) => `${l.n}\t${formatClock(l.split, { centis: true, up: true })}\t${formatClock(l.total, { centis: true, up: true })}`)
      .join('\n'),
  );

  // --- pomodoro ---
  protected readonly cfg = signal<PomodoroConfig>({ ...DEFAULT_POMODORO });
  protected readonly autoNext = signal(true);
  protected readonly pIndex = signal(0);
  protected readonly pm = signal<Down>(newDown(DEFAULT_POMODORO.work * 60_000));
  protected readonly phase = computed(() => pomodoroPhase(this.pIndex(), this.cfg()));
  protected readonly pmLeft = computed(() => remaining(this.pm(), this.now()));
  protected readonly pmText = computed(() => formatClock(this.pmLeft()));
  protected readonly pmProgress = computed(() => (this.pm().total > 0 ? 1 - this.pmLeft() / this.pm().total : 0));
  protected readonly pmDone = computed(() => Math.floor(this.pIndex() / 2));
  protected readonly pmNotice = signal('');
  protected readonly pmFields = [
    { key: 'work', max: 180 },
    { key: 'short', max: 60 },
    { key: 'long', max: 120 },
    { key: 'cycles', max: 12 },
  ] as const;

  // --- stato condiviso ---
  protected readonly shareSchema = SHARE_SCHEMA;
  protected readonly shareState = (): ShareData => ({
    mode: this.mode(),
    duration: this.durationText().slice(0, 20),
    work: this.cfg().work,
    short: this.cfg().short,
    long: this.cfg().long,
    cycles: this.cfg().cycles,
    auto: this.autoNext(),
    sound: this.sound(),
  });
  protected restoreShared(data: ShareData): void {
    const s = data as Partial<Record<string, unknown>>;
    if (s['mode'] === 'countdown' || s['mode'] === 'stopwatch' || s['mode'] === 'pomodoro') this.mode.set(s['mode']);
    if (typeof s['duration'] === 'string') this.setDuration(s['duration']);
    const c = { ...this.cfg() };
    for (const f of this.pmFields) if (typeof s[f.key] === 'number') c[f.key] = s[f.key] as number;
    this.cfg.set(c);
    this.pm.set(newDown(this.phase().ms));
    if (typeof s['auto'] === 'boolean') this.autoNext.set(s['auto']);
    if (typeof s['sound'] === 'boolean') this.sound.set(s['sound']);
  }

  private tick: ReturnType<typeof setInterval> | null = null;
  private tickMs = 0;
  private audio: AudioContext | null = null;
  private wake: { release(): Promise<void> } | null = null;

  constructor() {
    this.i18n.register(TIMER_DICTIONARIES);
    inject(DestroyRef).onDestroy(() => {
      this.stopTick();
      void this.releaseWake();
      void this.audio?.close();
    });
  }

  // ---------------------------------------------------------------------------------------------------------------

  protected setDuration(text: string): void {
    this.durationText.set(text);
    const ms = parseDuration(text);
    if (ms !== null && !this.cd().running) {
      this.cd.set(newDown(ms));
      this.cdDone.set(false);
    }
  }

  protected setPreset(min: number): void {
    this.setDuration(String(min));
  }

  protected toggleCountdown(): void {
    const now = Date.now();
    this.unlockAudio();
    if (this.cd().running) {
      this.cd.set(pauseDown(this.cd(), now));
    } else {
      const ms = this.durationMs();
      let d = this.cd();
      // finito, oppure durata cambiata a mano: riparte dalla durata scritta
      if (d.left <= 0 || (!this.cdStarted() && ms !== null)) d = newDown(ms ?? d.total);
      if (d.total <= 0) return;
      this.cdDone.set(false);
      this.cd.set(startDown(d, now));
    }
    this.now.set(now);
    this.sync();
  }

  protected resetCountdown(): void {
    const ms = this.durationMs();
    this.cd.set(newDown(ms ?? this.cd().total));
    this.cdDone.set(false);
    this.sync();
  }

  protected toggleStopwatch(): void {
    const now = Date.now();
    this.sw.set(this.sw().running ? pauseUp(this.sw(), now) : startUp(this.sw(), now));
    this.now.set(now);
    this.sync();
  }

  protected lap(): void {
    const total = elapsed(this.sw(), Date.now());
    if (total > 0) this.laps.set(addLap(this.laps(), total));
  }

  protected resetStopwatch(): void {
    this.sw.set(newUp());
    this.laps.set([]);
    this.sync();
  }

  protected togglePomodoro(): void {
    const now = Date.now();
    this.unlockAudio();
    this.pmNotice.set('');
    this.pm.set(this.pm().running ? pauseDown(this.pm(), now) : startDown(this.pm(), now));
    this.now.set(now);
    this.sync();
  }

  protected setCfg(key: keyof PomodoroConfig, raw: string, max: number): void {
    const n = Math.min(max, Math.max(1, Math.floor(Number(raw)) || 1));
    this.cfg.update((c) => ({ ...c, [key]: n }));
    if (!this.pm().running) this.pm.set(newDown(this.phase().ms));
  }

  protected skipPhase(): void {
    this.advancePhase(Date.now(), this.pm().running);
  }

  protected restartPomodoro(): void {
    this.pIndex.set(0);
    this.pm.set(newDown(pomodoroPhase(0, this.cfg()).ms));
    this.pmNotice.set('');
    this.sync();
  }

  /** Passa alla fase successiva; `start` dice se farla partire subito. */
  private advancePhase(now: number, start: boolean): void {
    this.pIndex.update((i) => i + 1);
    const next = newDown(this.phase().ms);
    this.pm.set(start ? startDown(next, now) : next);
    this.sync();
  }

  // --- ciclo di controllo ---------------------------------------------------------------------------------------

  private anyRunning(): boolean {
    return this.cd().running || this.sw().running || this.pm().running;
  }

  /** Avvia o ferma il ciclo di controllo e il blocco dello schermo secondo ciò che è in corso. */
  private sync(): void {
    if (!this.browser) return;
    if (!this.anyRunning()) {
      this.stopTick();
      void this.releaseWake();
      return;
    }
    const ms = this.sw().running ? 50 : 200;
    if (this.tick === null || this.tickMs !== ms) {
      this.stopTick();
      this.tickMs = ms;
      this.tick = setInterval(() => this.onTick(), ms);
    }
    void this.acquireWake();
  }

  private stopTick(): void {
    if (this.tick !== null) clearInterval(this.tick);
    this.tick = null;
  }

  private onTick(): void {
    const now = Date.now();
    this.now.set(now);
    if (this.cd().running && remaining(this.cd(), now) <= 0) {
      this.cd.set({ ...this.cd(), running: false, endAt: 0, left: 0 });
      this.cdDone.set(true);
      this.beep();
      this.sync();
    }
    if (this.pm().running && remaining(this.pm(), now) <= 0) {
      const done = this.i18n.t('tm.pm.' + this.phase().kind);
      this.pmNotice.set(this.i18n.t('tm.pm.phaseDone', { phase: done }));
      this.beep();
      this.advancePhase(now, this.autoNext());
    }
  }

  // --- suono e schermo ------------------------------------------------------------------------------------------

  /** Il browser permette l'audio solo dopo un gesto dell'utente: si prepara al clic su «Avvia». */
  private unlockAudio(): void {
    if (!this.browser || !this.sound()) return;
    try {
      const AC = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.audio ??= new AC();
      void this.audio.resume();
    } catch {
      /* senza audio il timer funziona lo stesso */
    }
  }

  private beep(): void {
    const ctx = this.audio;
    if (!this.sound() || !ctx) return;
    try {
      const t0 = ctx.currentTime + 0.02;
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        const t = t0 + i * 0.3;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
      }
    } catch {
      /* ignora */
    }
  }

  private acquiring = false;

  private async acquireWake(): Promise<void> {
    if (this.wake || this.acquiring || !this.browser) return;
    this.acquiring = true;
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
      if (wl) this.wake = await wl.request('screen');
    } catch {
      /* non supportato o negato */
    } finally {
      this.acquiring = false;
    }
  }

  private async releaseWake(): Promise<void> {
    const w = this.wake;
    this.wake = null;
    try {
      await w?.release();
    } catch {
      /* già rilasciato */
    }
  }

  protected pct(v: number): string {
    return `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`;
  }
}
