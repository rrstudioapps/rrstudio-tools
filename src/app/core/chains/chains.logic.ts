// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Logica pura delle catene di strumenti: percorsi lineari di 2-8 strumenti (es. Base64 → JSON → Hash) che si
 * percorrono con «Invia a…». Una catena contiene solo nome e id degli strumenti, mai i dati inseriti.
 * Nessun accesso a storage, DOM o Angular: gli id validi li passa il chiamante (`known`).
 */
export const CHAINS_KEY = 'rrtools.chains';
export const MAX_CHAINS = 20;
export const MIN_STEPS = 2;
export const MAX_STEPS = 8;
export const MAX_CHAIN_NAME = 40;

export interface Chain {
  id: string;
  name: string;
  steps: string[];
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

export function cleanChainName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, MAX_CHAIN_NAME).join('').trim();
}

/** Id nuovo, diverso da quelli presenti. */
export function newChainId(taken: Iterable<string>, rand: () => number = Math.random): string {
  const used = new Set(taken);
  for (;;) {
    const id = 'c' + Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0');
    if (!used.has(id)) return id;
  }
}

export interface SanitizedChains {
  chains: Chain[];
  /** Catene o passi scartati (non validi, sconosciuti o oltre i limiti). */
  dropped: number;
}

/** Valida qualunque cosa: scarta catene malformate o con meno di 2 passi noti, applica i limiti, id unici. */
export function sanitizeChains(raw: unknown, known: ReadonlySet<string>): SanitizedChains {
  const chains: Chain[] = [];
  let dropped = 0;
  if (!Array.isArray(raw)) return { chains, dropped: raw === undefined || raw === null ? 0 : 1 };
  const ids = new Set<string>();
  for (const c of raw) {
    if (!isObj(c) || chains.length >= MAX_CHAINS) {
      dropped++;
      continue;
    }
    const name = cleanChainName(c['name']);
    const steps = (Array.isArray(c['steps']) ? c['steps'] : []).filter((s): s is string => typeof s === 'string' && known.has(s));
    if (Array.isArray(c['steps']) && steps.length < c['steps'].length) dropped++;
    if (!name || steps.length < MIN_STEPS) {
      dropped++;
      continue;
    }
    const rawId = typeof c['id'] === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(c['id']) ? c['id'] : '';
    const id = rawId && !ids.has(rawId) ? rawId : newChainId(ids);
    ids.add(id);
    chains.push({ id, name, steps: steps.slice(0, MAX_STEPS) });
  }
  return { chains, dropped };
}

/** Legge il testo salvato: dati illeggibili = nessuna catena. */
export function parseStoredChains(text: string | null, known: ReadonlySet<string>): Chain[] {
  if (!text) return [];
  try {
    return sanitizeChains(JSON.parse(text), known).chains;
  } catch {
    return [];
  }
}

export const serializeChains = (c: readonly Chain[]): string => JSON.stringify(c);

/** Aggiunge una catena (null se nome o passi non validi o troppe catene). */
export function addChain(list: readonly Chain[], name: string, steps: readonly string[], known: ReadonlySet<string>): Chain[] | null {
  const n = cleanChainName(name);
  if (!n || list.length >= MAX_CHAINS || steps.length < MIN_STEPS || steps.length > MAX_STEPS || !steps.every((s) => known.has(s))) return null;
  return [...list, { id: newChainId(list.map((c) => c.id)), name: n, steps: [...steps] }];
}

export const removeChain = (list: readonly Chain[], id: string): Chain[] => list.filter((c) => c.id !== id);

/** Unisce catene importate a quelle esistenti: stesso nome e stessi passi = già presente. Rispetta il limite. */
export function mergeChains(base: readonly Chain[], incoming: readonly Chain[]): Chain[] {
  const out = [...base];
  const same = (a: Chain, b: Chain) => a.name === b.name && a.steps.join() === b.steps.join();
  for (const c of incoming) {
    if (out.length >= MAX_CHAINS) break;
    if (out.some((x) => same(x, c))) continue;
    out.push({ ...c, id: out.some((x) => x.id === c.id) ? newChainId(out.map((x) => x.id)) : c.id });
  }
  return out;
}

/**
 * Posizione nella catena dopo essere arrivati in `toolId`: il passo successivo, poi quello corrente,
 * poi un passo qualunque (se si è saltati); null se lo strumento non fa parte della catena.
 */
export function stepFor(steps: readonly string[], index: number, toolId: string): number | null {
  if (steps[index + 1] === toolId) return index + 1;
  if (steps[index] === toolId) return index;
  const j = steps.indexOf(toolId);
  return j === -1 ? null : j;
}

/** Sposta un passo (fuori intervallo = nessun cambiamento). */
export function moveStep<T>(steps: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= steps.length || to >= steps.length) return [...steps];
  const next = [...steps];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}
