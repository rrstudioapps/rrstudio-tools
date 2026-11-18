// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { DockerResult, generateCompose, parseDockerRun, serviceNameFromImage, splitCommands } from './docker';
import { isPlainSafe, scalar, toYaml } from './yaml-out';

function parse(cmd: string): DockerResult {
  const r = parseDockerRun(cmd);
  if (!r.ok) throw new Error('errore: ' + r.error);
  return r.result;
}
const yaml = (cmd: string) => generateCompose(parse(cmd));
const codes = (r: DockerResult) => r.warnings.map((w) => w.code);

describe('YAML: virgolette', () => {
  it('stringhe che il YAML leggerebbe come altro', () => {
    for (const s of ['no', 'yes', 'on', 'off', 'true', 'null', '8080', '8080:80', '22:22', '127.0.0.1:8080:80', '1e3', '0x1f', '1.5', '', '-g', 'a: b', 'a #b', ':x', 'x:']) {
      expect(isPlainSafe(s), JSON.stringify(s)).toBe(false);
    }
  });
  it('stringhe che restano semplici', () => {
    for (const s of ['nginx:alpine', 'data:/var/lib/mysql', './conf:/etc/nginx:ro', 'KEY=value', '/etc/hosts', 'unless-stopped', 'on-failure:3', 'host.docker.internal:host-gateway', '512m']) {
      expect(isPlainSafe(s), s).toBe(true);
    }
  });
  it('scalari', () => {
    expect(scalar('8080:80')).toBe('"8080:80"');
    expect(scalar('a"b')).toBe('"a\\"b"');
    expect(scalar('riga\nuno')).toBe('"riga\\nuno"');
    expect(scalar(true)).toBe('true');
    expect(scalar(0.5)).toBe('0.5');
  });
  it('struttura annidata', () => {
    expect(toYaml({ a: { b: ['x', 'z'], c: null }, d: [] }).join('\n')).toBe('a:\n  b:\n    - x\n    - z\n  c:\nd: []');
    expect(toYaml({ l: [{ k: 1, v: 'a' }] }).join('\n')).toBe('l:\n  - k: 1\n    v: a');
  });
});

describe('divisione in comandi', () => {
  it('a capo, ; e &&, con continuazioni e commenti', () => {
    expect(splitCommands('docker run a\ndocker run b; docker run c && docker run d')).toEqual(['docker run a', 'docker run b', 'docker run c', 'docker run d']);
    expect(splitCommands('docker run \\\n  -p 80:80 \\\n  nginx')).toEqual(['docker run    -p 80:80    nginx']);
    expect(splitCommands('# commento\ndocker run a # in coda\n\n')).toEqual(['docker run a']);
  });
  it('non divide dentro le virgolette', () => {
    expect(splitCommands(`docker run -e "A=1;2" -e 'B=x\ny' img`)).toEqual([`docker run -e "A=1;2" -e 'B=x\ny' img`]);
  });
  it('virgoletta aperta', () => {
    expect(splitCommands(`docker run -e "A=1 img`)).toBeNull();
  });
});

describe('docker run → compose', () => {
  it('esempio tipico', () => {
    const y = yaml(`docker run -d --name web -p 8080:80 -v ./html:/usr/share/nginx/html:ro -e TZ=Europe/Rome --restart unless-stopped nginx:alpine`);
    expect(y).toBe(
      [
        'services:',
        '  web:',
        '    image: nginx:alpine',
        '    container_name: web',
        '    restart: unless-stopped',
        '    ports:',
        '      - "8080:80"',
        '    volumes:',
        '      - ./html:/usr/share/nginx/html:ro',
        '    environment:',
        '      - TZ=Europe/Rome',
        '',
      ].join('\n'),
    );
  });
  it('niente chiave version', () => {
    expect(yaml('docker run nginx')).not.toMatch(/version/);
    expect(yaml('docker run nginx')).toBe('services:\n  nginx:\n    image: nginx\n');
  });
  it('volumi con nome vanno anche nella sezione volumes', () => {
    const r = parse('docker run -v pgdata:/var/lib/postgresql/data -v /host:/c -v ./rel:/r -v /anon postgres:16');
    expect(r.volumes).toEqual(['pgdata']);
    const y = generateCompose(r);
    expect(y).toContain('volumes:\n  pgdata:\n');
    expect(y).toContain('      - /anon\n');
  });
  it('--mount: bind, volume e tmpfs', () => {
    const r = parse('docker run --mount type=bind,source=/srv/a,target=/a,readonly --mount type=volume,src=data,dst=/d --mount type=tmpfs,target=/t img');
    expect(r.services[0].fields['volumes']).toEqual(['/srv/a:/a:ro', 'data:/d']);
    expect(r.services[0].fields['tmpfs']).toEqual(['/t']);
    expect(r.volumes).toEqual(['data']);
    expect(codes(parse('docker run --mount type=bind,source=/a,target=/b,bind-propagation=rshared img'))).toContain('mountOption');
  });
  it('reti: host e none sono network_mode, le altre external con avviso', () => {
    expect(parse('docker run --network host img').services[0].fields['network_mode']).toBe('host');
    const r = parse('docker run --network nginx-proxy-manager_default --net bridge img');
    expect(r.networks).toEqual(['nginx-proxy-manager_default']);
    expect(r.services[0].fields['networks']).toEqual(['nginx-proxy-manager_default']);
    expect(codes(r)).toEqual(expect.arrayContaining(['externalNetwork', 'defaultNetwork']));
    const y = generateCompose(r, { externalNetworkComment: 'crea la rete {name}' });
    expect(y).toContain('networks:\n  # crea la rete nginx-proxy-manager_default\n  nginx-proxy-manager_default:\n    external: true\n');
  });
  it('opzioni di sicurezza e risorse', () => {
    const r = parse('docker run --read-only --cap-drop ALL --cap-add NET_BIND_SERVICE --security-opt no-new-privileges -m 256m --cpus 0.5 --pids-limit 100 --init img');
    expect(r.services[0].fields).toMatchObject({
      read_only: true,
      cap_drop: ['ALL'],
      cap_add: ['NET_BIND_SERVICE'],
      security_opt: ['no-new-privileges:true'],
      mem_limit: '256m',
      cpus: 0.5,
      pids_limit: 100,
      init: true,
    });
    const y = generateCompose(r);
    expect(y).toContain('    mem_limit: 256m\n');
    expect(y).toContain('    cpus: 0.5\n');
  });
  it('utente, directory, hostname, entrypoint e comando', () => {
    const r = parse(`docker run -u 1000:1000 -w /app -h box --entrypoint /bin/sh img -c "echo ciao"`);
    expect(r.services[0].fields).toMatchObject({ user: '1000:1000', working_dir: '/app', hostname: 'box', entrypoint: '/bin/sh', command: { flow: ['-c', 'echo ciao'] } });
    const y = generateCompose(r);
    expect(y).toContain('    user: "1000:1000"\n');
    expect(y).toContain('    command: ["-c", "echo ciao"]\n');
  });
  it('un solo token di comando resta una stringa; entrypoint in JSON diventa lista', () => {
    expect(parse('docker run img sleep').services[0].fields['command']).toBe('sleep');
    expect(parse(`docker run --entrypoint '["a","b"]' img`).services[0].fields['entrypoint']).toEqual({ flow: ['a', 'b'] });
  });
  it('-it, -d e opzioni brevi raggruppate', () => {
    const r = parse('docker run -itd -p80:80 --restart=always img');
    expect(r.services[0].fields).toMatchObject({ stdin_open: true, tty: true, ports: ['80:80'], restart: 'always' });
    expect(generateCompose(r)).toContain('    restart: always\n');
    const g = parse('docker run -dp 80:80 -itp 443:443 img');
    expect(g.services[0].fields['ports']).toEqual(['80:80', '443:443']);
  });
  it('restart "no" viene virgolettato', () => {
    expect(yaml('docker run --restart no img')).toContain('    restart: "no"\n');
  });
  it('variabili con e senza valore, env-file, label', () => {
    const r = parse('docker run -e A=1 --env B -e "C=due parole" --env-file .env -l a=b --label "x=y z" img');
    expect(r.services[0].fields).toMatchObject({ environment: ['A=1', 'B', 'C=due parole'], env_file: ['.env'], labels: ['a=b', 'x=y z'] });
  });
  it('healthcheck', () => {
    const r = parse(`docker run --health-cmd 'curl -f http://localhost/ || exit 1' --health-interval 30s --health-timeout 5s --health-retries 3 --health-start-period 10s img`);
    expect(r.services[0].fields['healthcheck']).toEqual({
      test: { flow: ['CMD-SHELL', 'curl -f http://localhost/ || exit 1'] },
      interval: '30s',
      timeout: '5s',
      retries: 3,
      start_period: '10s',
    });
    expect(yaml('docker run --no-healthcheck img')).toContain('healthcheck:\n      disable: true');
  });
  it('log, host, dns, pull', () => {
    const r = parse('docker run --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 --add-host host.docker.internal:host-gateway --dns 1.1.1.1 --dns 8.8.8.8 --pull always img');
    expect(r.services[0].fields).toMatchObject({
      logging: { driver: 'json-file', options: { 'max-size': '10m', 'max-file': '3' } },
      extra_hosts: ['host.docker.internal:host-gateway'],
      dns: ['1.1.1.1', '8.8.8.8'],
      pull_policy: 'always',
    });
    expect(generateCompose(r)).toContain('        max-file: "3"\n');
  });
  it('ulimit, sysctl, device, tmpfs, privileged, pid, ipc', () => {
    const r = parse('docker run --ulimit nofile=1024:2048 --ulimit core=-1 --sysctl net.core.somaxconn=1024 --device /dev/ttyUSB0:/dev/ttyUSB0 --tmpfs /run --privileged --pid host --ipc host img');
    expect(r.services[0].fields).toMatchObject({
      ulimits: { nofile: { soft: 1024, hard: 2048 }, core: -1 },
      sysctls: ['net.core.somaxconn=1024'],
      devices: ['/dev/ttyUSB0:/dev/ttyUSB0'],
      tmpfs: ['/run'],
      privileged: true,
      pid: 'host',
      ipc: 'host',
    });
  });
  it('gpu', () => {
    const y = yaml('docker run --gpus all img');
    expect(y).toContain('deploy:\n      resources:\n        reservations:\n          devices:\n            - driver: nvidia\n              count: all\n              capabilities: [gpu]\n');
  });
  it('--read-only=false non attiva nulla', () => {
    expect(parse('docker run --read-only=false img').services[0].fields['read_only']).toBeUndefined();
  });
});

describe('più comandi e nomi', () => {
  it('più servizi nello stesso file, con i nomi dal --name o dall\'immagine', () => {
    const r = parse(`docker run -d --name db -v data:/var/lib/mysql mariadb:11
docker run -d -p 80:80 ghcr.io/acme/web:1.2
docker run -d redis`);
    expect(r.services.map((s) => s.name)).toEqual(['db', 'web', 'redis']);
    expect(r.volumes).toEqual(['data']);
  });
  it('nomi uguali: suffisso numerico', () => {
    const r = parse('docker run nginx\ndocker run nginx:alpine\ndocker run nginx:1');
    expect(r.services.map((s) => s.name)).toEqual(['nginx', 'nginx-2', 'nginx-3']);
  });
  it('nome del servizio dall\'immagine', () => {
    expect(serviceNameFromImage('ghcr.io/org/App:1.2@sha256:abc')).toBe('app');
    expect(serviceNameFromImage('localhost:5000/team/api')).toBe('api');
    expect(serviceNameFromImage('postgres')).toBe('postgres');
  });
  it('comandi diversi da docker run vengono saltati con avviso', () => {
    const r = parse('docker pull nginx\ndocker network create x\ndocker run nginx');
    expect(r.services).toHaveLength(1);
    expect(codes(r).filter((c) => c === 'skipped')).toHaveLength(2);
  });
  it('sudo, docker container run e podman', () => {
    expect(parse('sudo docker run nginx').services).toHaveLength(1);
    expect(parse('docker container run nginx').services).toHaveLength(1);
    expect(parse('podman run nginx').services).toHaveLength(1);
  });
});

describe('avvisi ed errori', () => {
  it('--rm, -d, -P e opzioni non mappate', () => {
    const r = parse('docker run --rm -d -P --foo-bar --annotation a=b img');
    expect(codes(r)).toEqual(expect.arrayContaining(['rm', 'detach', 'publishAll', 'unmapped']));
    expect(r.warnings.filter((w) => w.code === 'unmapped').map((w) => w.param)).toEqual(['--foo-bar', '--annotation']);
  });
  it('opzioni note booleane o con valore (tabella docker CLI 27), anche con gli alias corti', () => {
    const r = parse('docker run --init --read-only --cpu-rt-period 1000 --io-maxiops 100 --uidmap 0:1000:1 --net host -c 512 -h box nginx:1 sleep 5');
    expect(r.services[0].fields['image']).toBe('nginx:1');
    expect(r.services[0].fields['command']).toEqual({ flow: ['sleep', '5'] });
    expect(codes(r)).not.toContain('ambiguousOption');
  });
  it('opzione sconosciuta con valore che non sembra un\'immagine: letto come valore', () => {
    const r = parse('docker run --foo a=b nginx');
    expect(r.services[0].fields['image']).toBe('nginx');
  });
  it('opzione sconosciuta seguita da un token che sembra un\'immagine: ambiguo, si avvisa', () => {
    const r = parse('docker run --foo bar nginx');
    expect(r.services[0].fields['image']).toBe('bar');
    expect(r.warnings.find((w) => w.code === 'ambiguousOption')?.param).toBe('--foo bar');
  });
  it('opzione sconosciuta con = o seguita solo dall\'immagine: nessun avviso di ambiguità', () => {
    expect(codes(parse('docker run --foo=bar nginx'))).not.toContain('ambiguousOption');
    expect(codes(parse('docker run --foo nginx'))).not.toContain('ambiguousOption');
  });
  it('valori non validi', () => {
    expect(codes(parse('docker run --cpus abc --ulimit nofile=x img'))).toEqual(['badValue', 'badValue']);
  });
  it('simbolo $ avvisa dell\'interpolazione', () => {
    expect(codes(parse('docker run -e A=$HOME img'))).toContain('dollar');
  });
  it('pipe: il resto si ignora con avviso', () => {
    expect(codes(parse('docker run nginx | cat'))).toContain('stoppedAt');
  });
  it('errori', () => {
    expect(parseDockerRun('')).toEqual({ ok: false, error: 'empty' });
    expect(parseDockerRun('ls -la')).toEqual({ ok: false, error: 'notDocker' });
    expect(parseDockerRun('docker run -d')).toEqual({ ok: false, error: 'noImage' });
    expect(parseDockerRun(`docker run -e "A=1 img`)).toEqual({ ok: false, error: 'unterminatedQuote' });
  });
});
