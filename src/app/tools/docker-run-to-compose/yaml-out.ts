// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/**
 * Scrittura di YAML per strutture semplici (scalari, liste, mappe). Logica pura.
 * Le stringhe che il YAML 1.1 leggerebbe come altro tipo (`no`, `on`, `8080`, `22:22`, `1e3`…) si virgolettano,
 * così restano stringhe anche per i lettori più vecchi.
 */
export interface Flow {
  /** Lista su una riga: `["a", "b"]`. */
  flow: string[];
}
export type Yv = string | number | boolean | null | Yv[] | { [key: string]: Yv } | Flow;

const RESERVED = new Set(['y', 'n', 'yes', 'no', 'true', 'false', 'on', 'off', 'null', '~']);

/** Vero se la stringa si può scrivere senza virgolette e resta una stringa. */
export function isPlainSafe(s: string): boolean {
  if (s === '' || RESERVED.has(s.toLowerCase())) return false;
  // primo carattere: lettera, cifra, punto, barra, trattino basso, $ (interpolazione compose)
  if (!/^[A-Za-z0-9._/$]/.test(s)) return false;
  // niente caratteri speciali del YAML; i due punti solo se non sono seguiti da spazio né sono l'ultimo
  if (!/^[A-Za-z0-9._/$@=,+:{}-]+$/.test(s) || s.endsWith(':') || s.includes('{') || s.includes('}')) return false;
  // numeri, esadecimali, sessagesimali (22:22) e simili: andrebbero letti come numeri
  if (/^[-+.\d][\d_.:eE+-]*$/.test(s) && /\d/.test(s)) return false;
  if (/^0[xXoObB]/.test(s)) return false;
  return true;
}

export function scalar(v: string | number | boolean | null): string {
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
  // JSON.stringify produce una stringa tra virgolette doppie valida anche in YAML
  return isPlainSafe(v) ? v : JSON.stringify(v);
}

function isFlow(v: Yv): v is Flow {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && 'flow' in v && Array.isArray((v as Flow).flow);
}

function key(k: string): string {
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(k) && !RESERVED.has(k.toLowerCase()) ? k : JSON.stringify(k);
}

/** Linee di YAML per una mappa, con il rientro dato. `comments` aggiunge righe di commento prima di una chiave. */
export function toYaml(obj: { [key: string]: Yv }, comments: Record<string, string> = {}, indent = 0, path = ''): string[] {
  const pad = '  '.repeat(indent);
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    if (comments[p]) out.push(`${pad}# ${comments[p]}`);
    if (v === null || typeof v !== 'object') {
      out.push(`${pad}${key(k)}:${v === null ? '' : ' ' + scalar(v)}`);
    } else if (isFlow(v)) {
      out.push(`${pad}${key(k)}: [${v.flow.map((x) => scalar(x)).join(', ')}]`);
    } else if (Array.isArray(v)) {
      if (v.length === 0) {
        out.push(`${pad}${key(k)}: []`);
        continue;
      }
      out.push(`${pad}${key(k)}:`);
      for (const item of v) {
        if (item !== null && typeof item === 'object') {
          if (isFlow(item)) out.push(`${pad}  - [${item.flow.map((x) => scalar(x)).join(', ')}]`);
          else if (!Array.isArray(item)) {
            // lista di mappe: il primo campo sta sulla riga del trattino
            const inner = toYaml(item, {}, indent + 2);
            if (inner.length) {
              inner[0] = `${pad}  - ` + inner[0].trimStart();
              out.push(...inner);
            }
          }
        } else out.push(`${pad}  - ${scalar(item as string | number | boolean | null)}`);
      }
    } else if (Object.keys(v).length === 0) {
      out.push(`${pad}${key(k)}: {}`);
    } else {
      out.push(`${pad}${key(k)}:`);
      out.push(...toYaml(v, comments, indent + 1, p));
    }
  }
  return out;
}
