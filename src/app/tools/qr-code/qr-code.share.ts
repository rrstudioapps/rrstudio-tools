// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import type { Schema, ShareData } from '../../shared/share-state';
import type { QrFields } from './qr-payload';

/** Campi testuali del codice che finiscono nel link. La password del Wi-Fi è un segreto: non ci va mai. */
export const SHARED_FIELDS = [
  'text',
  'url',
  'wifiSsid',
  'firstName',
  'lastName',
  'phone',
  'contactEmail',
  'company',
  'website',
  'emailTo',
  'emailSubject',
  'emailBody',
  'smsNumber',
  'smsBody',
  'geoLat',
  'geoLon',
] as const satisfies readonly (keyof QrFields)[];

const HEX = '#0123456789abcdefABCDEF';

/** Stato che finisce nel link: tipo, campi (senza password Wi-Fi), correzione errori e colori. Il logo non c'è (è un file). */
export const SHARE_SCHEMA: Schema = {
  type: { type: 'enum', values: ['text', 'url', 'wifi', 'contact', 'email', 'sms', 'geo'] },
  ...Object.fromEntries(SHARED_FIELDS.map((k) => [k, { type: 'string', max: 2000 } as const])),
  wifiSecurity: { type: 'enum', values: ['WPA', 'WEP', 'nopass'] },
  wifiHidden: { type: 'boolean' },
  ecl: { type: 'enum', values: ['L', 'M', 'Q', 'H'] },
  size: { type: 'number', min: 64, max: 4096, int: true },
  margin: { type: 'number', min: 0, max: 16, int: true },
  fg: { type: 'string', max: 7, chars: HEX, valid: (s) => /^#[0-9a-f]{6}$/i.test(s) },
  bg: { type: 'string', max: 7, chars: HEX, valid: (s) => /^#[0-9a-f]{6}$/i.test(s) },
};

/** Parte testuale dei campi presente nello stato letto dal link. */
export function fieldsFromShare(d: ShareData): Partial<QrFields> {
  const out: Partial<Record<(typeof SHARED_FIELDS)[number], string>> = {};
  for (const k of SHARED_FIELDS) if (typeof d[k] === 'string') out[k] = d[k];
  return out;
}
