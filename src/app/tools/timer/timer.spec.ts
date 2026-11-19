// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import {
  DEFAULT_POMODORO, addLap, elapsed, formatClock, lapExtremes, newDown, newUp, parseDuration, pauseDown, pauseUp,
  pomodoroPhase, remaining, resetDown, startDown, startUp,
} from './timer';

describe('parseDuration', () => {
  it('formati con i due punti', () => {
    expect(parseDuration('1:30')).toBe(90_000);
    expect(parseDuration('1:02:03')).toBe(3_723_000);
    expect(parseDuration('0:45')).toBe(45_000);
  });
  it('unità scritte, anche in italiano', () => {
    expect(parseDuration('1h 30m')).toBe(5_400_000);
    expect(parseDuration('90s')).toBe(90_000);
    expect(parseDuration('2 ore 15 min')).toBe(8_100_000);
    expect(parseDuration('1,5h')).toBe(5_400_000);
    expect(parseDuration('10 minuti')).toBe(600_000);
  });
  it('un numero senza unità vale minuti', () => {
    expect(parseDuration('25')).toBe(1_500_000);
    expect(parseDuration('0,5')).toBe(30_000);
  });
  it('rifiuta valori non validi o fuori limite', () => {
    for (const bad of ['', 'abc', '1:75', '0', '0:00', '100h', '5 foo', '5m x', '-3']) expect(parseDuration(bad), bad).toBeNull();
  });
});

describe('formatClock', () => {
  it('minuti e secondi, ore solo se servono', () => {
    expect(formatClock(90_000)).toBe('01:30');
    expect(formatClock(3_723_000)).toBe('01:02:03');
    expect(formatClock(5000, { alwaysHours: true })).toBe('00:00:05');
  });
  it('il conto alla rovescia arrotonda per eccesso, il cronometro per difetto', () => {
    expect(formatClock(1)).toBe('00:01');
    expect(formatClock(1999)).toBe('00:02');
    expect(formatClock(1999, { up: true })).toBe('00:01');
  });
  it('centesimi', () => {
    expect(formatClock(61_234, { centis: true })).toBe('01:01.23');
    expect(formatClock(-5, { centis: true })).toBe('00:00.00');
  });
});

describe('conto alla rovescia', () => {
  it('parte, si ferma e riparte senza perdere tempo', () => {
    let d = startDown(newDown(10_000), 1000);
    expect(remaining(d, 4000)).toBe(7000);
    d = pauseDown(d, 4000);
    expect(d.running).toBe(false);
    expect(remaining(d, 99_999)).toBe(7000);
    d = startDown(d, 50_000);
    expect(remaining(d, 52_000)).toBe(5000);
    expect(remaining(d, 80_000)).toBe(0);
  });
  it('azzera alla durata iniziale; non riparte da zero', () => {
    expect(resetDown(pauseDown(startDown(newDown(5000), 0), 2000)).left).toBe(5000);
    expect(startDown({ total: 5000, running: false, endAt: 0, left: 0 }, 0).running).toBe(false);
  });
});

describe('cronometro e giri', () => {
  it('somma i tratti di tempo', () => {
    let u = startUp(newUp(), 100);
    expect(elapsed(u, 600)).toBe(500);
    u = pauseUp(u, 600);
    u = startUp(u, 1000);
    expect(elapsed(u, 1250)).toBe(750);
  });
  it('giri: durata come differenza e giro migliore/peggiore', () => {
    let laps = addLap([], 30_000);
    laps = addLap(laps, 50_000);
    laps = addLap(laps, 90_000);
    expect(laps.map((l) => l.split)).toEqual([30_000, 20_000, 40_000]);
    expect(lapExtremes(laps)).toEqual({ best: 1, worst: 2 });
    expect(lapExtremes(laps.slice(0, 1))).toBeNull();
    expect(lapExtremes(addLap(addLap([], 10), 20))).toBeNull(); // pari: nessuna evidenza
  });
});

describe('pomodoro', () => {
  it('alterna lavoro e pause, con la pausa lunga ogni quattro pomodori', () => {
    const kinds = Array.from({ length: 8 }, (_, i) => pomodoroPhase(i, DEFAULT_POMODORO).kind);
    expect(kinds).toEqual(['work', 'short', 'work', 'short', 'work', 'short', 'work', 'long']);
    expect(pomodoroPhase(7, DEFAULT_POMODORO)).toEqual({ kind: 'long', ms: 900_000, pomodoro: 4 });
    expect(pomodoroPhase(8, DEFAULT_POMODORO)).toEqual({ kind: 'work', ms: 1_500_000, pomodoro: 5 });
  });
});
