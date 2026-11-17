// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import type { Schema } from '../../shared/share-state';
import { MAX_SHADOWS, MAX_STOPS, MIN_STOPS, type Shadow, type Stop, clamp, normalizeHex } from './css-gen';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const NUM = '-?\\d+(?:\\.\\d+)?';
const STOP_RE = new RegExp(`^(#[0-9a-fA-F]{6})\\|(${NUM})\\|(${NUM})$`);
const SHADOW_RE = new RegExp(`^(${NUM})\\|(${NUM})\\|(${NUM})\\|(${NUM})\\|(#[0-9a-fA-F]{6})\\|(${NUM})\\|([01])$`);

/** Uno stop diventa `colore|alpha|posizione`. */
export const encodeStops = (stops: readonly Stop[]): string[] => stops.map((s) => `${s.color}|${s.alpha}|${s.pos}`);
/** Un'ombra diventa `x|y|sfocatura|diffusione|colore|alpha|inset`. */
export const encodeShadows = (list: readonly Shadow[]): string[] =>
  list.map((s) => `${s.x}|${s.y}|${s.blur}|${s.spread}|${s.color}|${s.alpha}|${s.inset ? 1 : 0}`);

/** Stop dal link (id nuovi, valori nei limiti); null se la lista non è valida. */
export function decodeStops(list: readonly string[]): Stop[] | null {
  if (list.length < MIN_STOPS || list.length > MAX_STOPS) return null;
  const out: Stop[] = [];
  for (const [i, item] of list.entries()) {
    const m = STOP_RE.exec(item);
    if (!m) return null;
    out.push({ id: i + 1, color: normalizeHex(m[1]) ?? '#000000', alpha: clamp(Number(m[2]), 0, 1), pos: clamp(Number(m[3]), 0, 100) });
  }
  return out;
}

/** Ombre dal link (id nuovi, valori nei limiti); null se la lista non è valida. */
export function decodeShadows(list: readonly string[]): Shadow[] | null {
  if (list.length < 1 || list.length > MAX_SHADOWS) return null;
  const out: Shadow[] = [];
  for (const [i, item] of list.entries()) {
    const m = SHADOW_RE.exec(item);
    if (!m) return null;
    out.push({
      id: i + 1,
      x: clamp(Number(m[1]), -500, 500),
      y: clamp(Number(m[2]), -500, 500),
      blur: clamp(Number(m[3]), 0, 500),
      spread: clamp(Number(m[4]), -500, 500),
      color: normalizeHex(m[5]) ?? '#000000',
      alpha: clamp(Number(m[6]), 0, 1),
      inset: m[7] === '1',
    });
  }
  return out;
}

/** Stato che finisce nel link: scheda, gradiente (stop come `colore|alpha|pos`) e ombre. */
export const SHARE_SCHEMA: Schema = {
  tab: { type: 'enum', values: ['gradient', 'shadow'] },
  kind: { type: 'enum', values: ['linear', 'radial', 'conic'] },
  angle: { type: 'number', min: 0, max: 360 },
  shape: { type: 'enum', values: ['circle', 'ellipse'] },
  cx: { type: 'number', min: 0, max: 100 },
  cy: { type: 'number', min: 0, max: 100 },
  repeating: { type: 'boolean' },
  stops: { type: 'strings', maxItems: MAX_STOPS, maxLength: 40, valid: (s) => STOP_RE.test(s) && HEX_COLOR.test(s.slice(0, 7)) },
  shadows: { type: 'strings', maxItems: MAX_SHADOWS, maxLength: 80, valid: (s) => SHADOW_RE.test(s) },
  shadowBg: { type: 'enum', values: ['light', 'dark'] },
};
