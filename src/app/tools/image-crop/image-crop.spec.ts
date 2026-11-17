// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import {
  ASPECTS,
  MIN_CROP,
  clampRect,
  cropFileName,
  defaultCrop,
  fitRatio,
  limitSize,
  moveRect,
  normalizeAngle,
  nudgeRect,
  outputSize,
  parseDimension,
  pngSize,
  resizeRect,
  rotatedSize,
  roundRect,
  type Rect,
} from './image-crop';

const B = { width: 1000, height: 800 };
const inside = (r: Rect, b = B) => r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= b.width + 1e-9 && r.y + r.h <= b.height + 1e-9;

describe('proporzioni', () => {
  it('la foto tessera è 35:45 e le altre sono quelle attese', () => {
    expect(ASPECTS.id).toBeCloseTo(35 / 45);
    expect(ASPECTS['16:9']).toBeCloseTo(1.7778, 3);
    expect(ASPECTS['9:16']).toBeCloseTo(0.5625, 3);
    expect(ASPECTS.free).toBeNull();
  });
});

describe('rotatedSize', () => {
  it('multipli di 90 scambiano i lati senza errori di virgola', () => {
    expect(rotatedSize(400, 300, 0)).toEqual({ width: 400, height: 300 });
    expect(rotatedSize(400, 300, 90)).toEqual({ width: 300, height: 400 });
    expect(rotatedSize(400, 300, 180)).toEqual({ width: 400, height: 300 });
    expect(rotatedSize(400, 300, 270)).toEqual({ width: 300, height: 400 });
    expect(rotatedSize(400, 300, -90)).toEqual({ width: 300, height: 400 });
  });
  it('a 45° il riquadro è la diagonale', () => {
    const s = rotatedSize(100, 100, 45);
    expect(s.width).toBe(142);
    expect(s.height).toBe(142);
  });
  it('un angolo libero allarga il riquadro', () => {
    const s = rotatedSize(400, 300, 10);
    expect(s.width).toBeGreaterThan(400);
    expect(s.height).toBeGreaterThan(300);
  });
  it('normalizza gli angoli', () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
  });
});

describe('limitSize', () => {
  it('riduce solo se oltre il massimo', () => {
    expect(limitSize({ width: 4000, height: 3000 }, 8192)).toEqual({ width: 4000, height: 3000 });
    expect(limitSize({ width: 16000, height: 8000 }, 8000)).toEqual({ width: 8000, height: 4000 });
  });
});

describe('defaultCrop', () => {
  it('libero: tutta l\'immagine', () => {
    expect(defaultCrop(B, null)).toEqual({ x: 0, y: 0, w: 1000, h: 800 });
  });
  it('con proporzioni: rispetta il rapporto, sta dentro ed è centrato', () => {
    for (const r of [1, 4 / 3, 16 / 9, 9 / 16, 35 / 45]) {
      const c = defaultCrop(B, r);
      expect(c.w / c.h).toBeCloseTo(r, 6);
      expect(inside(c)).toBe(true);
      expect(c.x + c.w / 2).toBeCloseTo(500);
      expect(c.y + c.h / 2).toBeCloseTo(400);
    }
  });
});

describe('clampRect / moveRect', () => {
  it('porta dentro i limiti e impone il lato minimo', () => {
    expect(clampRect({ x: -50, y: 900, w: 300, h: 100 }, B)).toEqual({ x: 0, y: 700, w: 300, h: 100 });
    expect(clampRect({ x: 0, y: 0, w: 1, h: 1 }, B)).toMatchObject({ w: MIN_CROP, h: MIN_CROP });
    expect(clampRect({ x: 0, y: 0, w: 5000, h: 5000 }, B)).toMatchObject({ w: 1000, h: 800 });
  });
  it('lo spostamento non esce dall\'immagine', () => {
    const r = { x: 100, y: 100, w: 200, h: 200 };
    expect(moveRect(r, -500, -500, B)).toMatchObject({ x: 0, y: 0 });
    expect(moveRect(r, 5000, 5000, B)).toMatchObject({ x: 800, y: 600 });
    expect(moveRect(r, 10, -20, B)).toEqual({ x: 110, y: 80, w: 200, h: 200 });
  });
});

describe('fitRatio', () => {
  it('adatta al rapporto mantenendo il centro', () => {
    const r = fitRatio({ x: 100, y: 100, w: 400, h: 400 }, B, 16 / 9);
    expect(r.w / r.h).toBeCloseTo(16 / 9, 6);
    expect(r.x + r.w / 2).toBeCloseTo(300);
    expect(inside(r)).toBe(true);
  });
  it('non esce dai limiti nemmeno vicino ai bordi', () => {
    const r = fitRatio({ x: 0, y: 0, w: 1000, h: 800 }, B, 9 / 16);
    expect(r.w / r.h).toBeCloseTo(9 / 16, 6);
    expect(inside(r)).toBe(true);
  });
  it('libero: solo clamp', () => {
    expect(fitRatio({ x: -5, y: 0, w: 100, h: 100 }, B, null).x).toBe(0);
  });
});

describe('resizeRect', () => {
  const r = { x: 200, y: 200, w: 400, h: 300 };
  it('libero: l\'angolo SE cresce, il NW resta fermo', () => {
    expect(resizeRect(r, 'se', 50, 20, B, null)).toEqual({ x: 200, y: 200, w: 450, h: 320 });
  });
  it('libero: la maniglia W sposta il bordo sinistro', () => {
    expect(resizeRect(r, 'w', -100, 0, B, null)).toEqual({ x: 100, y: 200, w: 500, h: 300 });
  });
  it('libero: non si può invertire né scendere sotto il minimo', () => {
    const a = resizeRect(r, 'e', -1000, 0, B, null);
    expect(a.w).toBe(MIN_CROP);
    expect(a.x).toBe(200);
    const b = resizeRect(r, 'n', 0, 1000, B, null);
    expect(b.h).toBe(MIN_CROP);
    expect(b.y + b.h).toBe(500);
  });
  it('libero: non esce dall\'immagine', () => {
    expect(inside(resizeRect(r, 'se', 5000, 5000, B, null))).toBe(true);
    expect(inside(resizeRect(r, 'nw', -5000, -5000, B, null))).toBe(true);
  });
  it('con proporzioni fisse le mantiene da ogni maniglia', () => {
    const ratio = 4 / 3;
    const start = { x: 300, y: 250, w: 400, h: 300 };
    for (const h of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const) {
      for (const [dx, dy] of [[40, 30], [-60, -20], [300, 300], [-300, -300]]) {
        const out = resizeRect(start, h, dx, dy, B, ratio);
        expect(out.w / out.h).toBeCloseTo(ratio, 5);
        expect(inside(out)).toBe(true);
        expect(out.w).toBeGreaterThanOrEqual(MIN_CROP - 1e-9);
      }
    }
  });
  it('con proporzioni fisse l\'angolo opposto resta fermo', () => {
    const out = resizeRect({ x: 300, y: 250, w: 400, h: 300 }, 'se', 80, 0, B, 4 / 3);
    expect(out.x).toBeCloseTo(300);
    expect(out.y).toBeCloseTo(250);
    expect(out.w).toBeCloseTo(480);
    expect(out.h).toBeCloseTo(360);
  });
  it('con proporzioni fisse e maniglia laterale resta centrato sull\'altro asse', () => {
    const out = resizeRect({ x: 300, y: 250, w: 400, h: 300 }, 'e', 80, 0, B, 4 / 3);
    expect(out.w).toBeCloseTo(480);
    expect(out.y + out.h / 2).toBeCloseTo(400);
  });
});

describe('nudgeRect (tastiera)', () => {
  const r = { x: 400, y: 300, w: 200, h: 200 };
  it('le frecce spostano', () => {
    expect(nudgeRect(r, 'ArrowRight', 10, false, B, null)).toMatchObject({ x: 410, y: 300 });
    expect(nudgeRect(r, 'ArrowUp', 10, false, B, null)).toMatchObject({ x: 400, y: 290 });
  });
  it('con resize le frecce ingrandiscono e riducono dal centro', () => {
    const bigger = nudgeRect(r, 'ArrowRight', 10, true, B, null)!;
    expect(bigger.w).toBe(220);
    expect(bigger.x + bigger.w / 2).toBeCloseTo(500);
    const smaller = nudgeRect(r, 'ArrowDown', 10, true, B, null)!;
    expect(smaller.h).toBe(220);
    expect(nudgeRect(r, 'ArrowLeft', 10, true, B, null)!.w).toBe(180);
  });
  it('+ e - cambiano la scala, con proporzioni fisse le mantengono', () => {
    const out = nudgeRect(r, '+', 10, false, B, 1)!;
    expect(out.w).toBeCloseTo(210);
    expect(out.w / out.h).toBeCloseTo(1);
    expect(nudgeRect(r, '-', 10, false, B, null)!.w).toBeLessThan(200);
  });
  it('tasti non gestiti: null', () => {
    expect(nudgeRect(r, 'a', 10, false, B, null)).toBeNull();
  });
  it('non esce dai limiti', () => {
    expect(inside(nudgeRect({ x: 0, y: 0, w: 1000, h: 800 }, '+', 10, false, B, null)!)).toBe(true);
  });
});

describe('roundRect', () => {
  it('arrotonda a interi senza uscire', () => {
    expect(roundRect({ x: 10.4, y: 20.6, w: 100.5, h: 50.2 }, B)).toEqual({ x: 10, y: 21, w: 101, h: 50 });
    expect(roundRect({ x: 999.9, y: 799.9, w: 50, h: 50 }, B)).toEqual({ x: 999, y: 799, w: 1, h: 1 });
  });
});

describe('outputSize', () => {
  const crop = { width: 800, height: 600 };
  it('senza richieste: dimensioni del ritaglio', () => {
    expect(outputSize(crop, { width: null, height: null, lock: true })).toEqual({ width: 800, height: 600 });
  });
  it('con blocco: segue le proporzioni dal lato indicato', () => {
    expect(outputSize(crop, { width: 400, height: null, lock: true })).toEqual({ width: 400, height: 300 });
    expect(outputSize(crop, { width: 400, height: 90, lock: true, driver: 'height' })).toEqual({ width: 120, height: 90 });
    expect(outputSize(crop, { width: null, height: 300, lock: true })).toEqual({ width: 400, height: 300 });
  });
  it('senza blocco: lati indipendenti', () => {
    expect(outputSize(crop, { width: 100, height: 100, lock: false })).toEqual({ width: 100, height: 100 });
    expect(outputSize(crop, { width: 100, height: null, lock: false })).toEqual({ width: 100, height: 600 });
  });
  it('valori non validi ignorati; mai sotto 1', () => {
    expect(outputSize(crop, { width: -5, height: Number.NaN, lock: false })).toEqual({ width: 800, height: 600 });
    expect(outputSize({ width: 1000, height: 1 }, { width: 10, height: null, lock: true }).height).toBe(1);
  });
});

describe('nomi e utilità', () => {
  it('nome del file di uscita', () => {
    expect(cropFileName('foto.JPG', 'png')).toBe('foto-ritaglio.png');
    expect(cropFileName('a.b.c.webp', 'jpeg', 'crop')).toBe('a.b.c-crop.jpg');
    expect(cropFileName('', 'webp')).toBe('immagine-ritaglio.webp');
    expect(cropFileName('a/b:c.png', 'png')).toBe('a_b_c-ritaglio.png');
  });
  it('parseDimension', () => {
    expect(parseDimension('300')).toBe(300);
    expect(parseDimension(' 12,6 ')).toBe(13);
    expect(parseDimension('')).toBeNull();
    expect(parseDimension('abc')).toBeNull();
    expect(parseDimension('0')).toBeNull();
  });
  it('pngSize legge l\'intestazione', () => {
    const b = new Uint8Array(33);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(b.buffer).setUint32(16, 640);
    new DataView(b.buffer).setUint32(20, 480);
    expect(pngSize(b)).toEqual({ width: 640, height: 480 });
    expect(pngSize(new Uint8Array(10))).toBeNull();
  });
});
