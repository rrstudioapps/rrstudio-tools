// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Logica pura della decodifica JWT: nessuna verifica della firma, solo lettura. */

export type JwtPart = 'header' | 'payload' | 'signature';

export type JwtError =
  | { kind: 'empty' }
  | { kind: 'segments'; count: number }
  | { kind: 'base64'; part: JwtPart; char: string }
  | { kind: 'utf8'; part: JwtPart }
  | { kind: 'json'; part: JwtPart; message: string }
  | { kind: 'header-type' };

/** Claim di data standard (NumericDate, secondi Unix). */
export const DATE_CLAIMS = ['exp', 'iat', 'nbf', 'auth_time'] as const;
export type DateClaim = (typeof DATE_CLAIMS)[number];

export interface JwtDate {
  claim: DateClaim;
  seconds: number;
  /** Istante in millisecondi (null se fuori dall'intervallo rappresentabile da Date). */
  ms: number | null;
}

export interface JwtDecoded {
  type: 'jws';
  header: Record<string, unknown>;
  payload: unknown;
  headerText: string;
  payloadText: string;
  alg: string | null;
  typ: string | null;
  kid: string | null;
  /** Byte della firma (0 per i token non firmati, "alg": "none"). */
  signatureBytes: number;
  unsecured: boolean;
  dates: JwtDate[];
  /** Claim di data presenti ma non numerici. */
  badDates: DateClaim[];
}

export interface JweInfo {
  type: 'jwe';
  header: Record<string, unknown> | null;
  headerText: string;
  alg: string | null;
  enc: string | null;
  kid: string | null;
  /** Lunghezze (in caratteri) dei cinque segmenti. */
  lengths: number[];
}

export type JwtResult = { ok: true; token: JwtDecoded | JweInfo } | { ok: false; error: JwtError };

/** Toglie spazi, a capo, virgolette e il prefisso "Bearer " (o "Authorization: Bearer "). */
export function cleanToken(input: string): string {
  let s = input.trim();
  s = s.replace(/^authorization\s*:\s*/i, '');
  s = s.replace(/^bearer\s+/i, '');
  s = s.replace(/^["'`]+|["'`]+$/g, '');
  return s.replace(/\s+/g, '');
}

const B64URL = /^[A-Za-z0-9_-]*$/;

/** Base64URL → byte; lancia un errore con il primo carattere non valido. Il padding finale `=` è tollerato. */
export function decodeBase64Url(segment: string, part: JwtPart): Uint8Array {
  const s = segment.replace(/={0,2}$/, '');
  if (!B64URL.test(s)) {
    const bad = [...s].find((c) => !/[A-Za-z0-9_-]/.test(c)) ?? '';
    throw { kind: 'base64', part, char: bad } satisfies JwtError;
  }
  if (s.length % 4 === 1) throw { kind: 'base64', part, char: '' } satisfies JwtError;
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(std + '='.repeat((4 - (std.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJson(segment: string, part: JwtPart): { value: unknown; text: string } {
  const bytes = decodeBase64Url(segment, part);
  let raw: string;
  try {
    raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw { kind: 'utf8', part } satisfies JwtError;
  }
  try {
    const value: unknown = JSON.parse(raw);
    return { value, text: JSON.stringify(value, null, 2) };
  } catch (e) {
    throw { kind: 'json', part, message: e instanceof Error ? e.message : String(e) } satisfies JwtError;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Istante (ms) da un NumericDate in secondi, null se Date non lo può rappresentare. */
export function secondsToMs(seconds: number): number | null {
  const ms = seconds * 1000;
  return Math.abs(ms) <= 8.64e15 ? ms : null;
}

/** Decodifica un token (JWS o JWE). Non verifica nessuna firma. */
export function parseJwt(input: string): JwtResult {
  const token = cleanToken(input);
  if (token === '') return { ok: false, error: { kind: 'empty' } };
  const parts = token.split('.');
  try {
    if (parts.length === 5) {
      let header: Record<string, unknown> | null = null;
      let headerText = '';
      try {
        const h = decodeJson(parts[0], 'header');
        if (isObject(h.value)) {
          header = h.value;
          headerText = h.text;
        }
      } catch {
        /* intestazione illeggibile: il JWE si riconosce comunque dai cinque segmenti */
      }
      return {
        ok: true,
        token: {
          type: 'jwe',
          header,
          headerText,
          alg: str(header?.['alg']),
          enc: str(header?.['enc']),
          kid: str(header?.['kid']),
          lengths: parts.map((p) => p.length),
        },
      };
    }
    if (parts.length !== 3) return { ok: false, error: { kind: 'segments', count: parts.length } };
    const h = decodeJson(parts[0], 'header');
    if (!isObject(h.value)) return { ok: false, error: { kind: 'header-type' } };
    const p = decodeJson(parts[1], 'payload');
    const sig = decodeBase64Url(parts[2], 'signature');
    const header = h.value;
    const dates: JwtDate[] = [];
    const badDates: DateClaim[] = [];
    if (isObject(p.value)) {
      for (const claim of DATE_CLAIMS) {
        if (!(claim in p.value)) continue;
        const v = p.value[claim];
        if (typeof v === 'number' && Number.isFinite(v)) dates.push({ claim, seconds: v, ms: secondsToMs(v) });
        else badDates.push(claim);
      }
    }
    const alg = str(header['alg']);
    return {
      ok: true,
      token: {
        type: 'jws',
        header,
        payload: p.value,
        headerText: h.text,
        payloadText: p.text,
        alg,
        typ: str(header['typ']),
        kid: str(header['kid']),
        signatureBytes: sig.length,
        unsecured: alg?.toLowerCase() === 'none',
        dates,
        badDates,
      },
    };
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e) return { ok: false, error: e as JwtError };
    throw e;
  }
}

export type TimeState = 'future' | 'past' | 'now';

export interface Remaining {
  state: TimeState;
  /** Distanza assoluta in secondi interi. */
  seconds: number;
}

/** Distanza tra `ms` e `nowMs`: `future` se l'istante deve ancora arrivare. */
export function remaining(ms: number, nowMs: number): Remaining {
  const diff = Math.round((ms - nowMs) / 1000);
  return { state: diff > 0 ? 'future' : diff < 0 ? 'past' : 'now', seconds: Math.abs(diff) };
}

export interface DurationParts {
  unit: 'year' | 'day' | 'hour' | 'minute' | 'second';
  value: number;
}

/** Scompone i secondi nelle due unità più grandi non nulle (anni di 365 giorni): "2 giorni, 3 ore". */
export function splitDuration(seconds: number): DurationParts[] {
  const units: [DurationParts['unit'], number][] = [
    ['year', 365 * 86400],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  let rest = Math.max(0, Math.floor(seconds));
  const out: DurationParts[] = [];
  for (const [unit, size] of units) {
    const value = Math.floor(rest / size);
    rest -= value * size;
    if (value > 0) out.push({ unit, value });
    if (out.length === 2) break;
  }
  return out.length ? out : [{ unit: 'second', value: 0 }];
}

export type TokenStatus = 'expired' | 'not-yet' | 'valid' | 'no-exp';

/** Stato di validità temporale dichiarato dai claim (non è una verifica della firma). */
export function statusOf(dates: readonly JwtDate[], nowMs: number): TokenStatus {
  const exp = dates.find((d) => d.claim === 'exp');
  const nbf = dates.find((d) => d.claim === 'nbf');
  if (exp?.ms != null && exp.ms <= nowMs) return 'expired';
  if (nbf?.ms != null && nbf.ms > nowMs) return 'not-yet';
  return exp?.ms != null ? 'valid' : 'no-exp';
}

/** Codifica un oggetto JSON come segmento Base64URL (UTF-8). */
export function encodeSegment(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Token d'esempio con dati inventati e firma finta (non verificabile): emesso 5 minuti prima di `nowSeconds`, valido un'ora. */
export function sampleToken(nowSeconds: number): string {
  const issued = nowSeconds - 300;
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: '1234567890',
    name: 'Mario Rossi',
    role: 'editor',
    iss: 'https://auth.example.com',
    aud: 'esempio-app',
    iat: issued,
    nbf: issued,
    exp: issued + 3600,
  };
  return `${encodeSegment(header)}.${encodeSegment(payload)}.c2lnbmF0dXJhLWRpLWVzZW1waW8tbm9uLXZhbGlkYQ`;
}
