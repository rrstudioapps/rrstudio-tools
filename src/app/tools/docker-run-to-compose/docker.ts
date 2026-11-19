// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools

/**
 * Da comandi `docker run` a un file docker-compose. Logica pura, senza DOM e senza Angular: il comando non viene
 * mai eseguito e le variabili della shell non vengono espanse.
 */
import { tokenize } from '../../shared/shell-tokenize';
import { Yv, toYaml } from './yaml-out';

/** Avviso con un codice (tradotto dall'interfaccia), un parametro e il servizio a cui si riferisce. */
export interface DockerWarning {
  code: string;
  param?: string;
  service?: string;
}

export type DockerError = 'empty' | 'notDocker' | 'noImage' | 'unterminatedQuote';

export interface ComposeService {
  name: string;
  fields: Record<string, Yv>;
}

export interface DockerResult {
  services: ComposeService[];
  volumes: string[];
  networks: string[];
  warnings: DockerWarning[];
}

// ---------- divisione in comandi ----------

/**
 * Divide il testo in comandi separati da a capo, `;`, `&&` e `||` fuori dalle virgolette. Un `\` prima
 * dell'a capo continua il comando; le righe che iniziano con `#` sono commenti. Restituisce null se manca una virgoletta.
 */
export function splitCommands(input: string): string[] | null {
  const out: string[] = [];
  let cur = '';
  let i = 0;
  const flush = () => {
    const t = cur.trim();
    if (t !== '' && !t.startsWith('#')) out.push(t);
    cur = '';
  };
  while (i < input.length) {
    const c = input[i];
    if (c === '\\') {
      if (input[i + 1] === '\n') {
        cur += ' ';
        i += 2;
      } else if (input[i + 1] === '\r' && input[i + 2] === '\n') {
        cur += ' ';
        i += 3;
      } else {
        cur += input.slice(i, i + 2);
        i += 2;
      }
    } else if (c === "'" || c === '"' || (c === '$' && input[i + 1] === "'")) {
      const ansi = c === '$';
      const q = ansi ? "'" : c;
      let j = i + (ansi ? 2 : 1);
      for (;;) {
        if (j >= input.length) return null;
        if (input[j] === '\\' && (q === '"' || ansi)) j += 2;
        else if (input[j] === q) break;
        else j++;
      }
      cur += input.slice(i, j + 1);
      i = j + 1;
    } else if (c === '\n') {
      flush();
      i++;
    } else if (c === ';') {
      flush();
      i++;
    } else if ((c === '&' && input[i + 1] === '&') || (c === '|' && input[i + 1] === '|')) {
      flush();
      i += 2;
    } else if (c === '#' && (cur === '' || /\s$/.test(cur))) {
      // commento fino a fine riga
      while (i < input.length && input[i] !== '\n') i++;
    } else {
      cur += c;
      i++;
    }
  }
  flush();
  return out;
}

// ---------- opzioni ----------

/** Opzioni brevi → nome lungo. */
const SHORT: Record<string, string> = { d: 'detach', i: 'interactive', t: 'tty', p: 'publish', P: 'publish-all', v: 'volume', e: 'env', u: 'user', w: 'workdir', m: 'memory', l: 'label', h: 'hostname', c: 'cpu-shares', a: 'attach', q: 'quiet' };
const SHORT_BOOL = new Set(['d', 'i', 't', 'P', 'q']);
const ALIASES: Record<string, string> = { net: 'network', 'net-alias': 'network-alias' };

/** Opzioni lunghe di `docker run` (docker CLI 27) che non vogliono valore (si scrive `--opzione=false` per spegnerle). */
const LONG_BOOL = new Set([
  'detach', 'disable-content-trust', 'help', 'init', 'interactive', 'no-healthcheck', 'oom-kill-disable', 'privileged', 'publish-all',
  'quiet', 'read-only', 'rm', 'sig-proxy', 'tty', 'use-api-socket',
]);
/** Opzioni lunghe di `docker run` (docker CLI 27) che vogliono un valore, anche nella forma `--opzione valore`. */
const LONG_ARG = new Set([
  'add-host', 'annotation', 'attach', 'blkio-weight', 'blkio-weight-device', 'cap-add', 'cap-drop', 'cgroup-parent', 'cgroupns', 'cidfile',
  'cpu-count', 'cpu-percent', 'cpu-period', 'cpu-quota', 'cpu-rt-period', 'cpu-rt-runtime', 'cpu-shares', 'cpus', 'cpuset-cpus', 'cpuset-mems',
  'detach-keys', 'device', 'device-cgroup-rule', 'device-read-bps', 'device-read-iops', 'device-write-bps', 'device-write-iops', 'dns',
  'dns-option', 'dns-opt', 'dns-search', 'domainname', 'entrypoint', 'env', 'env-file', 'expose', 'gidmap', 'gpus', 'group-add', 'health-cmd',
  'health-interval', 'health-retries', 'health-start-interval', 'health-start-period', 'health-timeout', 'hostname', 'io-maxbandwidth',
  'io-maxiops', 'ip', 'ip6', 'ipc', 'isolation', 'kernel-memory', 'label', 'label-file', 'link', 'link-local-ip', 'log-driver', 'log-opt',
  'mac-address', 'memory', 'memory-reservation', 'memory-swap', 'memory-swappiness', 'mount', 'name', 'network', 'network-alias',
  'oom-score-adj', 'pid', 'pids-limit', 'platform', 'publish', 'pull', 'restart', 'runtime', 'security-opt', 'shm-size', 'stop-signal',
  'stop-timeout', 'storage-opt', 'sysctl', 'tmpfs', 'ulimit', 'uidmap', 'user', 'userns', 'uts', 'volume', 'volume-driver', 'volumes-from',
  'workdir',
]);

/** Un token che potrebbe essere un riferimento a un'immagine (`nginx`, `ghcr.io/org/app:1.2`, `app@sha256:…`). */
function looksLikeImage(t: string): boolean {
  return /^[a-z0-9][a-z0-9._\-/:@]*$/i.test(t) && !/^\d+(:\d+)?$/.test(t);
}

interface Opt {
  name: string;
  value: string | null;
  /** Opzione sconosciuta senza `=`: il token dopo sembra un'immagine ma ce n'è un altro ancora, quindi non si sa se era un valore. */
  ambiguous?: string;
}
interface RunSpec {
  opts: Opt[];
  image: string;
  command: string[];
}

/** Legge i token di un `docker run`: opzioni, immagine e comando. */
function parseRunTokens(tokens: string[]): RunSpec | { error: 'noImage' } {
  const opts: Opt[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === '--') {
      i++;
      break;
    }
    if (!t.startsWith('-') || t === '-') break;
    if (t.startsWith('--')) {
      const eq = t.indexOf('=');
      const raw = eq >= 0 ? t.slice(2, eq) : t.slice(2);
      const name = ALIASES[raw] ?? raw;
      if (eq >= 0) opts.push({ name, value: t.slice(eq + 1) });
      else if (LONG_ARG.has(name) && !LONG_BOOL.has(name)) {
        opts.push({ name, value: tokens[i + 1] ?? '' });
        i++;
      } else if (!LONG_BOOL.has(name)) {
        // opzione sconosciuta: se il token dopo non sembra un'immagine lo si legge come valore; se sembra
        // un'immagine e ne segue un altro, resta ambiguo: lo si tratta come immagine e si avvisa
        const next = tokens[i + 1];
        if (next !== undefined && !next.startsWith('-') && !looksLikeImage(next)) {
          opts.push({ name, value: next });
          i++;
        } else if (next !== undefined && !next.startsWith('-') && tokens[i + 2] !== undefined) {
          opts.push({ name, value: null, ambiguous: `--${raw} ${next}` });
        } else opts.push({ name, value: null });
      } else opts.push({ name, value: null });
      i++;
      continue;
    }
    // opzioni brevi raggruppate: -itd, -p80:80, -dp 80:80
    let k = 1;
    while (k < t.length) {
      const ch = t[k];
      const name = SHORT[ch];
      if (!name) {
        opts.push({ name: '-' + ch, value: null });
        k++;
      } else if (SHORT_BOOL.has(ch)) {
        opts.push({ name, value: null });
        k++;
      } else {
        const rest = t.slice(k + 1);
        if (rest !== '') opts.push({ name, value: rest.startsWith('=') ? rest.slice(1) : rest });
        else {
          opts.push({ name, value: tokens[i + 1] ?? '' });
          i++;
        }
        break;
      }
    }
    i++;
  }
  if (i >= tokens.length) return { error: 'noImage' };
  return { opts, image: tokens[i], command: tokens.slice(i + 1) };
}

/** Nome del servizio dall'immagine: `ghcr.io/org/app:1.2@sha256:…` → `app`. */
export function serviceNameFromImage(image: string): string {
  const noDigest = image.split('@')[0];
  const last = noDigest.split('/').pop() ?? noDigest;
  const base = last.split(':')[0];
  return sanitizeName(base) || 'app';
}

function sanitizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/-+$/, '');
}

const isNamedVolume = (src: string) => /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(src);

/** Rete predefinita di docker: non serve dichiararla. */
const BUILTIN_NETWORKS = new Set(['bridge', 'default']);

class Collector {
  readonly fields: Record<string, Yv> = {};
  constructor(
    private readonly service: string,
    private readonly warnings: DockerWarning[],
    private readonly volumes: Set<string>,
    private readonly networks: Set<string>,
  ) {}
  warn(code: string, param?: string): void {
    this.warnings.push({ code, param, service: this.service });
  }
  set(k: string, v: Yv): void {
    this.fields[k] = v;
  }
  push(k: string, v: string): void {
    const cur = this.fields[k];
    if (Array.isArray(cur)) cur.push(v);
    else this.fields[k] = [v];
  }
  map(k: string): Record<string, Yv> {
    const cur = this.fields[k];
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) return cur as Record<string, Yv>;
    const m: Record<string, Yv> = {};
    this.fields[k] = m;
    return m;
  }
  namedVolume(n: string): void {
    this.volumes.add(n);
  }
  network(n: string): void {
    this.networks.add(n);
  }
}

function boolValue(v: string | null): boolean {
  return v === null || !/^(false|0|no|off)$/i.test(v);
}

function toNumber(v: string): number | null {
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) ? n : null;
}

/** Elenco JSON `["a","b"]` oppure null. */
function parseJsonList(v: string): string[] | null {
  const t = v.trim();
  if (!t.startsWith('[')) return null;
  try {
    const a = JSON.parse(t) as unknown;
    return Array.isArray(a) && a.every((x) => typeof x === 'string') ? (a as string[]) : null;
  } catch {
    return null;
  }
}

function applyVolume(c: Collector, v: string): void {
  const parts = v.split(':');
  if (parts.length >= 2 && isNamedVolume(parts[0])) c.namedVolume(parts[0]);
  c.push('volumes', v);
}

/** `--mount type=bind,source=/a,target=/b,readonly` → `/a:/b:ro` (o tmpfs). */
function applyMount(c: Collector, v: string): void {
  const kv: Record<string, string> = {};
  for (const part of v.split(',')) {
    const eq = part.indexOf('=');
    const k = (eq >= 0 ? part.slice(0, eq) : part).trim().toLowerCase();
    kv[k] = eq >= 0 ? part.slice(eq + 1) : 'true';
  }
  const type = kv['type'] ?? 'volume';
  const src = kv['source'] ?? kv['src'];
  const dst = kv['target'] ?? kv['destination'] ?? kv['dst'];
  if (!dst) {
    c.warn('mountNoTarget', v);
    return;
  }
  const known = new Set(['type', 'source', 'src', 'target', 'destination', 'dst', 'readonly', 'ro']);
  for (const k of Object.keys(kv)) if (!known.has(k)) c.warn('mountOption', k);
  const ro = 'readonly' in kv || 'ro' in kv ? boolValue(kv['readonly'] ?? kv['ro']) : false;
  if (type === 'tmpfs') {
    c.push('tmpfs', dst);
    return;
  }
  if (type !== 'bind' && type !== 'volume') {
    c.warn('mountType', type);
    return;
  }
  if (!src) {
    c.push('volumes', dst);
    return;
  }
  if (type === 'volume') c.namedVolume(src);
  c.push('volumes', `${src}:${dst}${ro ? ':ro' : ''}`);
}

function applyNetwork(c: Collector, v: string): void {
  if (v === 'host' || v === 'none') c.set('network_mode', v);
  else if (v.startsWith('container:') || v.startsWith('service:')) c.set('network_mode', v);
  else if (BUILTIN_NETWORKS.has(v)) c.warn('defaultNetwork', v);
  else {
    c.network(v);
    c.push('networks', v);
    c.warn('externalNetwork', v);
  }
}

function applyUlimit(c: Collector, v: string): void {
  const eq = v.indexOf('=');
  if (eq < 0) {
    c.warn('badValue', `--ulimit ${v}`);
    return;
  }
  const name = v.slice(0, eq);
  const [soft, hard] = v.slice(eq + 1).split(':');
  const s = toNumber(soft);
  const h = hard === undefined ? null : toNumber(hard);
  if (s === null || (hard !== undefined && h === null)) {
    c.warn('badValue', `--ulimit ${v}`);
    return;
  }
  c.map('ulimits')[name] = h === null ? s : { soft: s, hard: h };
}

function applyHealth(c: Collector, name: string, v: string): void {
  const hc = c.map('healthcheck');
  switch (name) {
    case 'health-cmd': {
      const list = parseJsonList(v);
      hc['test'] = list ? { flow: list } : { flow: ['CMD-SHELL', v] };
      break;
    }
    case 'health-interval':
      hc['interval'] = v;
      break;
    case 'health-timeout':
      hc['timeout'] = v;
      break;
    case 'health-retries': {
      const n = toNumber(v);
      if (n === null) c.warn('badValue', `--health-retries ${v}`);
      else hc['retries'] = n;
      break;
    }
    case 'health-start-period':
      hc['start_period'] = v;
      break;
    case 'health-start-interval':
      hc['start_interval'] = v;
      break;
  }
}

function applyGpus(c: Collector, v: string): void {
  const m = /^(all|\d+)$/.exec(v.trim());
  if (!m) {
    c.warn('unmapped', '--gpus ' + v);
    return;
  }
  const deploy = c.map('deploy');
  const resources = (deploy['resources'] ??= {}) as Record<string, Yv>;
  const res = (resources['reservations'] ??= {}) as Record<string, Yv>;
  res['devices'] = [{ driver: 'nvidia', count: m[1] === 'all' ? 'all' : Number(m[1]), capabilities: { flow: ['gpu'] } }];
}

function applyOpts(c: Collector, opts: Opt[]): void {
  const logOpts: Record<string, string> = {};
  for (const { name, value, ambiguous } of opts) {
    if (ambiguous) c.warn('ambiguousOption', ambiguous);
    const v = value ?? '';
    const flag = (): boolean => boolValue(value);
    switch (name) {
      case 'detach':
        c.warn('detach');
        break;
      case 'name':
        c.set('container_name', v);
        break;
      case 'publish':
        c.push('ports', v);
        break;
      case 'publish-all':
        c.warn('publishAll');
        break;
      case 'expose':
        c.push('expose', v);
        break;
      case 'volume':
        applyVolume(c, v);
        break;
      case 'mount':
        applyMount(c, v);
        break;
      case 'tmpfs':
        c.push('tmpfs', v);
        break;
      case 'env':
        c.push('environment', v);
        break;
      case 'env-file':
        c.push('env_file', v);
        break;
      case 'label':
        c.push('labels', v);
        break;
      case 'restart':
        c.set('restart', v);
        break;
      case 'network':
        applyNetwork(c, v);
        break;
      case 'hostname':
        c.set('hostname', v);
        break;
      case 'domainname':
        c.set('domainname', v);
        break;
      case 'user':
        c.set('user', v);
        break;
      case 'workdir':
        c.set('working_dir', v);
        break;
      case 'entrypoint': {
        const list = parseJsonList(v);
        c.set('entrypoint', list ? { flow: list } : v);
        break;
      }
      case 'cap-add':
        c.push('cap_add', v);
        break;
      case 'cap-drop':
        c.push('cap_drop', v);
        break;
      case 'read-only':
        if (flag()) c.set('read_only', true);
        break;
      case 'security-opt':
        c.push('security_opt', /^no-new-privileges(=true)?$/.test(v) ? 'no-new-privileges:true' : v);
        break;
      case 'memory':
        c.set('mem_limit', v);
        break;
      case 'memory-swap':
        c.set('memswap_limit', v);
        break;
      case 'memory-reservation':
        c.set('mem_reservation', v);
        break;
      case 'cpus': {
        const n = toNumber(v);
        if (n === null) c.warn('badValue', `--cpus ${v}`);
        else c.set('cpus', n);
        break;
      }
      case 'cpu-shares': {
        const n = toNumber(v);
        if (n === null) c.warn('badValue', `--cpu-shares ${v}`);
        else c.set('cpu_shares', n);
        break;
      }
      case 'cpuset-cpus':
        c.set('cpuset', v);
        break;
      case 'shm-size':
        c.set('shm_size', v);
        break;
      case 'pids-limit': {
        const n = toNumber(v);
        if (n === null) c.warn('badValue', `--pids-limit ${v}`);
        else c.set('pids_limit', n);
        break;
      }
      case 'oom-kill-disable':
        if (flag()) c.set('oom_kill_disable', true);
        break;
      case 'oom-score-adj': {
        const n = toNumber(v);
        if (n === null) c.warn('badValue', `--oom-score-adj ${v}`);
        else c.set('oom_score_adj', n);
        break;
      }
      case 'device':
        c.push('devices', v);
        break;
      case 'privileged':
        if (flag()) c.set('privileged', true);
        break;
      case 'health-cmd':
      case 'health-interval':
      case 'health-timeout':
      case 'health-retries':
      case 'health-start-period':
      case 'health-start-interval':
        applyHealth(c, name, v);
        break;
      case 'no-healthcheck':
        if (flag()) c.map('healthcheck')['disable'] = true;
        break;
      case 'log-driver':
        c.map('logging')['driver'] = v;
        break;
      case 'log-opt': {
        const eq = v.indexOf('=');
        if (eq < 0) c.warn('badValue', `--log-opt ${v}`);
        else logOpts[v.slice(0, eq)] = v.slice(eq + 1);
        break;
      }
      case 'add-host':
        c.push('extra_hosts', v);
        break;
      case 'dns':
        c.push('dns', v);
        break;
      case 'dns-search':
        c.push('dns_search', v);
        break;
      case 'dns-option':
      case 'dns-opt':
        c.push('dns_opt', v);
        break;
      case 'pull':
        if (v === 'always' || v === 'missing' || v === 'never') c.set('pull_policy', v);
        else c.warn('badValue', `--pull ${v}`);
        break;
      case 'init':
        if (flag()) c.set('init', true);
        break;
      case 'rm':
        c.warn('rm');
        break;
      case 'pid':
        c.set('pid', v);
        break;
      case 'ipc':
        c.set('ipc', v);
        break;
      case 'uts':
        c.set('uts', v);
        break;
      case 'userns':
        c.set('userns_mode', v);
        break;
      case 'cgroup-parent':
        c.set('cgroup_parent', v);
        break;
      case 'ulimit':
        applyUlimit(c, v);
        break;
      case 'sysctl':
        c.push('sysctls', v);
        break;
      case 'interactive':
        if (flag()) c.set('stdin_open', true);
        break;
      case 'tty':
        if (flag()) c.set('tty', true);
        break;
      case 'group-add':
        c.push('group_add', v);
        break;
      case 'platform':
        c.set('platform', v);
        break;
      case 'stop-signal':
        c.set('stop_signal', v);
        break;
      case 'stop-timeout':
        if (toNumber(v) === null) c.warn('badValue', `--stop-timeout ${v}`);
        else c.set('stop_grace_period', `${v}s`);
        break;
      case 'runtime':
        c.set('runtime', v);
        break;
      case 'link':
        c.push('links', v);
        break;
      case 'volumes-from':
        c.push('volumes_from', v);
        break;
      case 'mac-address':
        c.set('mac_address', v);
        break;
      case 'gpus':
        applyGpus(c, v);
        break;
      case 'quiet':
      case 'attach':
      case 'sig-proxy':
      case 'disable-content-trust':
      case 'detach-keys':
      case 'cidfile':
        c.warn('ignored', '--' + name);
        break;
      case 'help':
        break;
      default:
        c.warn('unmapped', name.startsWith('-') ? name : '--' + name);
    }
  }
  if (Object.keys(logOpts).length) c.map('logging')['options'] = logOpts;
}

/** Ordine delle chiavi di un servizio nel file generato. */
const KEY_ORDER = [
  'image', 'container_name', 'platform', 'pull_policy', 'entrypoint', 'command', 'user', 'working_dir', 'hostname', 'domainname', 'restart',
  'init', 'privileged', 'read_only', 'stdin_open', 'tty', 'network_mode', 'ports', 'expose', 'volumes', 'volumes_from', 'tmpfs',
  'environment', 'env_file', 'labels', 'networks', 'links', 'cap_add', 'cap_drop', 'security_opt', 'devices', 'group_add', 'mem_limit',
  'memswap_limit', 'mem_reservation', 'cpus', 'cpu_shares', 'cpuset', 'shm_size', 'pids_limit', 'oom_kill_disable', 'oom_score_adj', 'deploy',
  'healthcheck', 'logging', 'extra_hosts', 'dns', 'dns_search', 'dns_opt', 'mac_address', 'pid', 'ipc', 'uts', 'userns_mode',
  'cgroup_parent', 'runtime', 'ulimits', 'sysctls', 'stop_signal', 'stop_grace_period',
];

function ordered(fields: Record<string, Yv>): Record<string, Yv> {
  const out: Record<string, Yv> = {};
  for (const k of KEY_ORDER) if (k in fields) out[k] = fields[k];
  for (const k of Object.keys(fields)) if (!(k in out)) out[k] = fields[k];
  return out;
}

/** Interpreta uno o più comandi `docker run` incollati. */
export function parseDockerRun(input: string): { ok: true; result: DockerResult } | { ok: false; error: DockerError } {
  if (input.trim() === '') return { ok: false, error: 'empty' };
  const chunks = splitCommands(input);
  if (chunks === null) return { ok: false, error: 'unterminatedQuote' };
  const warnings: DockerWarning[] = [];
  const services: ComposeService[] = [];
  const volumes = new Set<string>();
  const networks = new Set<string>();
  const usedNames = new Set<string>();
  let sawDocker = false;
  let noImage = false;
  let dollar = false;

  for (const chunk of chunks) {
    const tk = tokenize(chunk);
    if (tk.unterminated) return { ok: false, error: 'unterminatedQuote' };
    let tokens = tk.tokens;
    if (tokens[0] === 'sudo') tokens = tokens.slice(1);
    const bin = tokens[0];
    const isRun = (bin === 'docker' || bin === 'podman') && (tokens[1] === 'run' || (tokens[1] === 'container' && tokens[2] === 'run'));
    if (!isRun) {
      if (tokens.length) warnings.push({ code: 'skipped', param: tokens.slice(0, 3).join(' ') });
      continue;
    }
    sawDocker = true;
    if (tk.stoppedAt) warnings.push({ code: 'stoppedAt', param: tk.stoppedAt });
    const spec = parseRunTokens(tokens.slice(tokens[1] === 'run' ? 2 : 3));
    if ('error' in spec) {
      noImage = true;
      continue;
    }
    const nameOpt = spec.opts.find((o) => o.name === 'name')?.value;
    let name = sanitizeName(nameOpt ?? '') || serviceNameFromImage(spec.image);
    if (usedNames.has(name)) {
      let n = 2;
      while (usedNames.has(`${name}-${n}`)) n++;
      name = `${name}-${n}`;
    }
    usedNames.add(name);

    const c = new Collector(name, warnings, volumes, networks);
    c.set('image', spec.image);
    applyOpts(c, spec.opts);
    if (spec.command.length === 1 && !/\s/.test(spec.command[0])) c.set('command', spec.command[0]);
    else if (spec.command.length > 0) c.set('command', { flow: spec.command });
    if (!dollar && JSON.stringify([spec.opts, spec.command]).includes('$')) dollar = true;
    services.push({ name, fields: ordered(c.fields) });
  }
  if (!sawDocker) return { ok: false, error: 'notDocker' };
  if (services.length === 0 && noImage) return { ok: false, error: 'noImage' };
  if (noImage) warnings.push({ code: 'noImageSkipped' });
  if (dollar) warnings.push({ code: 'dollar' });
  return { ok: true, result: { services, volumes: [...volumes], networks: [...networks], warnings } };
}

export interface YamlOptions {
  /** Commento sopra ogni rete esterna (testo già tradotto). */
  externalNetworkComment?: string;
}

/** File docker-compose in YAML (senza la chiave `version`, obsoleta). */
export function generateCompose(r: DockerResult, opts: YamlOptions = {}): string {
  const root: Record<string, Yv> = {};
  const services: Record<string, Yv> = {};
  for (const s of r.services) services[s.name] = s.fields;
  root['services'] = services;
  const comments: Record<string, string> = {};
  if (r.volumes.length) root['volumes'] = Object.fromEntries(r.volumes.map((v) => [v, null]));
  if (r.networks.length) {
    root['networks'] = Object.fromEntries(r.networks.map((n) => [n, { external: true }]));
    if (opts.externalNetworkComment) for (const n of r.networks) comments[`networks.${n}`] = opts.externalNetworkComment.replace('{name}', n);
  }
  return toYaml(root, comments).join('\n') + '\n';
}
