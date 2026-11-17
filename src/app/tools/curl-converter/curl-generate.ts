// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { CurlHeader, CurlRequest, CurlWarning, FormField, basicHeaderValue } from './curl';

/** Linguaggi di destinazione. */
export type CurlTarget = 'fetch' | 'axios' | 'node' | 'python' | 'php' | 'go';
export const TARGETS: readonly CurlTarget[] = ['fetch', 'axios', 'node', 'python', 'php', 'go'];

export interface Generated {
  code: string;
  /** Cose che il linguaggio scelto non può fare (o fa in modo diverso). */
  warnings: CurlWarning[];
}

// ---------- utilità ----------

function headerValue(h: CurlHeader[], name: string): string | undefined {
  return h.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value;
}

/** Nomi di intestazioni ripetuti (case insensitive): un oggetto o un dizionario ne tiene una sola. */
export function duplicateHeaders(h: CurlHeader[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const x of h) {
    const k = x.name.toLowerCase();
    if (seen.has(k)) dup.add(x.name);
    seen.add(k);
  }
  return [...dup];
}

/** Intestazioni che i browser non lasciano impostare a `fetch` (le ignorano): elenco della specifica Fetch. */
const FORBIDDEN = new Set([
  'accept-charset', 'accept-encoding', 'access-control-request-headers', 'access-control-request-method', 'connection', 'content-length', 'cookie',
  'cookie2', 'date', 'dnt', 'expect', 'host', 'keep-alive', 'origin', 'referer', 'set-cookie', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'via',
]);
export function forbiddenBrowserHeaders(h: CurlHeader[]): string[] {
  const out: string[] = [];
  for (const x of h) {
    const k = x.name.toLowerCase();
    if ((FORBIDDEN.has(k) || k.startsWith('sec-') || k.startsWith('proxy-')) && !out.includes(x.name)) out.push(x.name);
  }
  return out;
}

/** Toglie gli spazi fuori dalle stringhe di un JSON. */
function minifyJson(s: string): string {
  let out = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      out += c;
      if (c === '\\') out += s[++i] ?? '';
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
      out += c;
    } else if (!/\s/.test(c)) out += c;
  }
  return out;
}

/** Il corpo come oggetto, solo se è JSON e si può riscrivere senza perdere nulla (numeri grandi, ordine, ecc.). */
export function jsonBody(req: CurlRequest): unknown | undefined {
  if (req.body?.kind !== 'raw') return undefined;
  const ct = headerValue(req.headers, 'Content-Type') ?? '';
  if (!/json/i.test(ct)) return undefined;
  const text = req.body.data.trim();
  if (text === '' || !/^[{[]/.test(text)) return undefined;
  try {
    const v = JSON.parse(text);
    return JSON.stringify(v) === minifyJson(text) ? v : undefined;
  } catch {
    return undefined;
  }
}

const IDENT = /^[A-Za-z_$][\w$]*$/;
const js = (s: string) => JSON.stringify(s);
const jsKey = (s: string) => (IDENT.test(s) ? s : js(s));

/** Valore JSON → sorgente JavaScript indentato. */
function jsValue(v: unknown, indent: string): string {
  return JSON.stringify(v, null, 2).replace(/\n/g, '\n' + indent).replace(/"([A-Za-z_$][\w$]*)":/g, (m, k: string) => (IDENT.test(k) ? `${k}:` : m));
}

function lowerMethod(m: string): string {
  return m.toLowerCase();
}

// ---------- JavaScript: fetch (browser e Node) e axios ----------

function jsHeaders(req: CurlRequest, node: boolean): string {
  const lines = [...req.headers.map((h) => [h.name, js(h.value)] as [string, string])];
  const all: [string, string][] = req.basicAuth
    ? [['Authorization', node ? `"Basic " + Buffer.from(${js(req.basicAuth.user + ':' + req.basicAuth.password)}).toString("base64")` : `"Basic " + btoa(${js(req.basicAuth.user + ':' + req.basicAuth.password)})`], ...lines]
    : lines;
  return all.map(([k, v]) => `    ${js(k)}: ${v},`).join('\n');
}

function jsFormLines(fields: FormField[], node: boolean, imports: Set<string>): string {
  const lines = ['const form = new FormData();'];
  for (const f of fields) {
    if (f.file) {
      if (node) {
        imports.add('import { openAsBlob } from "node:fs";');
        lines.push(`form.append(${js(f.name)}, await openAsBlob(${js(f.value)}));`);
      } else lines.push(`form.append(${js(f.name)}, fileInput.files[0]); // ${f.value}`);
    } else lines.push(`form.append(${js(f.name)}, ${js(f.value)});`);
  }
  return lines.join('\n');
}

function genFetch(req: CurlRequest, node: boolean): Generated {
  const warnings: CurlWarning[] = [];
  const imports = new Set<string>();
  const pre: string[] = [];
  const opts: string[] = [];
  if (req.method !== 'GET') opts.push(`  method: ${js(req.method)},`);
  const hdr = jsHeaders(req, node);
  if (hdr) opts.push(`  headers: {\n${hdr}\n  },`);
  const jb = jsonBody(req);
  if (req.body?.kind === 'form') {
    pre.push(jsFormLines(req.body.fields, node, imports));
    opts.push('  body: form,');
    if (!node && req.body.fields.some((f) => f.file)) warnings.push({ code: 'formFileBrowser' });
  } else if (req.body) {
    opts.push(`  body: ${jb !== undefined ? 'JSON.stringify(' + jsValue(jb, '  ') + ')' : js(req.body.data)},`);
  }
  const dup = duplicateHeaders(req.headers);
  if (dup.length) warnings.push({ code: 'duplicateHeaders', param: dup.join(', ') });
  if (req.insecure) warnings.push({ code: node ? 'insecureNodeFetch' : 'insecureFetch' });
  if (!node) {
    const f = forbiddenBrowserHeaders(req.headers);
    if (f.length) warnings.push({ code: 'forbiddenHeaders', param: f.join(', ') });
  }
  if ((req.method === 'GET' || req.method === 'HEAD') && req.body) warnings.push({ code: 'getBody' });
  const head: string[] = [...imports];
  const call = opts.length ? `await fetch(${js(req.url)}, {\n${opts.join('\n')}\n})` : `await fetch(${js(req.url)})`;
  const code = [...(head.length ? [head.join('\n'), ''] : []), ...(pre.length ? [pre.join('\n'), ''] : []), `const response = ${call};`, 'const data = await response.text();', 'console.log(response.status, data);'].join('\n');
  return { code, warnings };
}

function genAxios(req: CurlRequest): Generated {
  const warnings: CurlWarning[] = [];
  const imports = new Set<string>(['import axios from "axios";']);
  const pre: string[] = [];
  const opts: string[] = [`  method: ${js(lowerMethod(req.method))},`, `  url: ${js(req.url)},`];
  const lines = req.headers.map((h) => `    ${js(h.name)}: ${js(h.value)},`).join('\n');
  if (lines) opts.push(`  headers: {\n${lines}\n  },`);
  if (req.basicAuth) opts.push(`  auth: { username: ${js(req.basicAuth.user)}, password: ${js(req.basicAuth.password)} },`);
  const jb = jsonBody(req);
  if (req.body?.kind === 'form') {
    pre.push(jsFormLines(req.body.fields, false, imports));
    opts.push('  data: form,');
    if (req.body.fields.some((f) => f.file)) warnings.push({ code: 'formFileBrowser' });
  } else if (req.body) opts.push(`  data: ${jb !== undefined ? jsValue(jb, '  ') : js(req.body.data)},`);
  if (req.insecure) {
    imports.add('import https from "node:https";');
    opts.push('  httpsAgent: new https.Agent({ rejectUnauthorized: false }),');
    warnings.push({ code: 'insecureAxios' });
  }
  const dup = duplicateHeaders(req.headers);
  if (dup.length) warnings.push({ code: 'duplicateHeaders', param: dup.join(', ') });
  if ((req.method === 'GET' || req.method === 'HEAD') && req.body) warnings.push({ code: 'getBodyAxios' });
  const code = [[...imports].sort().join('\n'), '', ...(pre.length ? [pre.join('\n'), ''] : []), `const response = await axios({\n${opts.join('\n')}\n});`, 'console.log(response.status, response.data);'].join('\n');
  return { code, warnings };
}

// ---------- Python requests ----------

export function pyStr(s: string): string {
  let out = "'";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === '\\') out += '\\\\';
    else if (ch === "'") out += "\\'";
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (c < 0x20 || c === 0x7f) out += '\\x' + c.toString(16).padStart(2, '0');
    else out += ch;
  }
  return out + "'";
}

/** Valore JSON → letterale Python (true → True, null → None). */
function pyValue(v: unknown, indent: string): string {
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return pyStr(v);
  const inner = indent + '    ';
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return '[\n' + v.map((x) => inner + pyValue(x, inner) + ',').join('\n') + '\n' + indent + ']';
  }
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  return '{\n' + entries.map(([k, x]) => `${inner}${pyStr(k)}: ${pyValue(x, inner)},`).join('\n') + '\n' + indent + '}';
}

function genPython(req: CurlRequest): Generated {
  const warnings: CurlWarning[] = [];
  const pre: string[] = [];
  const args: string[] = [];
  const jb = jsonBody(req);
  // con json= la libreria imposta già Content-Type: application/json
  const headers = req.headers.filter((h) => !(jb !== undefined && h.name.toLowerCase() === 'content-type' && /^application\/json\s*$/i.test(h.value)));
  if (headers.length) {
    pre.push('headers = {\n' + headers.map((h) => `    ${pyStr(h.name)}: ${pyStr(h.value)},`).join('\n') + '\n}');
    args.push('headers=headers');
  }
  if (req.body?.kind === 'form') {
    pre.push(
      'files = [\n' +
        req.body.fields.map((f) => (f.file ? `    (${pyStr(f.name)}, (${pyStr(f.value.split(/[\\/]/).pop() ?? f.value)}, open(${pyStr(f.value)}, 'rb')${f.type ? ', ' + pyStr(f.type) : ''})),` : `    (${pyStr(f.name)}, (None, ${pyStr(f.value)}${f.type ? ', ' + pyStr(f.type) : ''})),`)).join('\n') +
        '\n]',
    );
    args.push('files=files');
  } else if (req.body) {
    if (jb !== undefined) pre.push(`json_data = ${pyValue(jb, '')}`);
    else pre.push(`data = ${pyStr(req.body.data)}`);
    args.push(jb !== undefined ? 'json=json_data' : 'data=data');
  }
  if (req.basicAuth) args.push(`auth=(${pyStr(req.basicAuth.user)}, ${pyStr(req.basicAuth.password)})`);
  if (req.insecure) args.push('verify=False');
  const dup = duplicateHeaders(req.headers);
  if (dup.length) warnings.push({ code: 'duplicateHeaders', param: dup.join(', ') });
  const m = req.method.toLowerCase();
  const direct = ['get', 'post', 'put', 'delete', 'head', 'patch', 'options'].includes(m);
  const first = direct ? [pyStr(req.url)] : [pyStr(req.method), pyStr(req.url)];
  const call = `requests.${direct ? m : 'request'}(` + (args.length ? `\n    ${[...first, ...args].join(',\n    ')},\n)` : `${first.join(', ')})`);
  const code = ['import requests', '', ...pre.flatMap((p) => [p, '']), `response = ${call}`, 'print(response.status_code, response.text)'].join('\n');
  return { code, warnings };
}

// ---------- PHP (curl) ----------

export function phpStr(s: string): string {
  if (/[\x00-\x1f\x7f]/.test(s)) {
    return '"' + s.replace(/[\\"$]/g, (c) => '\\' + c).replace(/[\x00-\x1f\x7f]/g, (c) => (c === '\n' ? '\\n' : c === '\r' ? '\\r' : c === '\t' ? '\\t' : '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'))) + '"';
  }
  return "'" + s.replace(/[\\']/g, (c) => '\\' + c) + "'";
}

function genPhp(req: CurlRequest): Generated {
  const warnings: CurlWarning[] = [];
  const o: string[] = [`    CURLOPT_URL => ${phpStr(req.url)},`, '    CURLOPT_RETURNTRANSFER => true,'];
  const m = req.method.toUpperCase();
  if (m === 'HEAD') o.push('    CURLOPT_NOBODY => true,');
  else if (m === 'POST') o.push('    CURLOPT_POST => true,');
  else if (m !== 'GET') o.push(`    CURLOPT_CUSTOMREQUEST => ${phpStr(req.method)},`);
  if (req.body?.kind === 'form') {
    o.push(
      '    CURLOPT_POSTFIELDS => [\n' +
        req.body.fields.map((f) => (f.file ? `        ${phpStr(f.name)} => new CURLFile(${phpStr(f.value)}${f.type ? ', ' + phpStr(f.type) : ''}),` : `        ${phpStr(f.name)} => ${phpStr(f.value)},`)).join('\n') +
        '\n    ],',
    );
  } else if (req.body) o.push(`    CURLOPT_POSTFIELDS => ${phpStr(req.body.data)},`);
  if (req.headers.length) o.push('    CURLOPT_HTTPHEADER => [\n' + req.headers.map((h) => `        ${phpStr(h.name + ': ' + h.value)},`).join('\n') + '\n    ],');
  if (req.basicAuth) o.push(`    CURLOPT_USERPWD => ${phpStr(req.basicAuth.user + ':' + req.basicAuth.password)},`);
  if (req.follow) o.push('    CURLOPT_FOLLOWLOCATION => true,');
  if (req.compressed) o.push("    CURLOPT_ENCODING => '',");
  if (req.insecure) o.push('    CURLOPT_SSL_VERIFYPEER => false,', '    CURLOPT_SSL_VERIFYHOST => 0,');
  const code = [
    '<?php',
    '$ch = curl_init();',
    'curl_setopt_array($ch, [',
    ...o,
    ']);',
    '',
    '$response = curl_exec($ch);',
    'if ($response === false) {',
    '    echo curl_error($ch);',
    '} else {',
    '    echo curl_getinfo($ch, CURLINFO_HTTP_CODE), "\\n", $response;',
    '}',
    'curl_close($ch);',
  ].join('\n');
  return { code, warnings };
}

// ---------- Go (net/http) ----------

/** Stringa Go tra virgolette (stesse regole di escape di JSON per i caratteri usati). */
export function goStr(s: string): string {
  return JSON.stringify(s).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function genGo(req: CurlRequest): Generated {
  const warnings: CurlWarning[] = [];
  const imports = new Set<string>(['fmt', 'io', 'net/http']);
  const body: string[] = [];
  let bodyArg = 'nil';
  const form = req.body?.kind === 'form' ? req.body.fields : null;
  if (form) {
    imports.add('bytes').add('mime/multipart');
    body.push('var buf bytes.Buffer', 'w := multipart.NewWriter(&buf)');
    let n = 0;
    for (const f of form) {
      if (f.file) {
        imports.add('os');
        n++;
        body.push(`file${n}, err := os.Open(${goStr(f.value)})`, 'if err != nil {', '\tpanic(err)', '}', `defer file${n}.Close()`, `part${n}, _ := w.CreateFormFile(${goStr(f.name)}, ${goStr(f.value.split(/[\\/]/).pop() ?? f.value)})`, `io.Copy(part${n}, file${n})`);
      } else body.push(`w.WriteField(${goStr(f.name)}, ${goStr(f.value)})`);
    }
    body.push('w.Close()', '');
    bodyArg = '&buf';
  } else if (req.body) {
    imports.add('strings');
    bodyArg = `strings.NewReader(${goStr(req.body.kind === 'raw' ? req.body.data : '')})`;
  }
  const clientFields: string[] = [];
  if (req.insecure) {
    imports.add('crypto/tls');
    clientFields.push('Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},');
  }
  const client = clientFields.length ? `client := &http.Client{\n\t\t${clientFields.join('\n\t\t')}\n\t}` : 'client := &http.Client{}';
  const lines: string[] = [];
  lines.push(...body.map((l) => (l === '' ? '' : l)));
  lines.push(`req, err := http.NewRequest(${goStr(req.method)}, ${goStr(req.url)}, ${bodyArg})`, 'if err != nil {', '\tpanic(err)', '}');
  for (const h of req.headers) {
    if (h.name.toLowerCase() === 'host') lines.push(`req.Host = ${goStr(h.value)}`);
    else lines.push(`req.Header.Add(${goStr(h.name)}, ${goStr(h.value)})`);
  }
  if (form) lines.push('req.Header.Set("Content-Type", w.FormDataContentType())');
  if (req.basicAuth) lines.push(`req.SetBasicAuth(${goStr(req.basicAuth.user)}, ${goStr(req.basicAuth.password)})`);
  lines.push('resp, err := client.Do(req)', 'if err != nil {', '\tpanic(err)', '}', 'defer resp.Body.Close()', 'data, err := io.ReadAll(resp.Body)', 'if err != nil {', '\tpanic(err)', '}', 'fmt.Println(resp.StatusCode, string(data))');
  const std = [...imports].sort();
  const code = ['package main', '', 'import (', ...std.map((i) => `\t${goStr(i)}`), ')', '', 'func main() {', `\t${client}`, ...lines.map((l) => (l === '' ? '' : '\t' + l)), '}'].join('\n');
  return { code, warnings };
}

/** Genera il codice per il linguaggio scelto, con gli avvisi su quello che non si traduce. */
export function generate(req: CurlRequest, target: CurlTarget): Generated {
  switch (target) {
    case 'fetch':
      return genFetch(req, false);
    case 'node':
      return genFetch(req, true);
    case 'axios':
      return genAxios(req);
    case 'python':
      return genPython(req);
    case 'php':
      return genPhp(req);
    case 'go':
      return genGo(req);
  }
}

/** Base64 delle credenziali di `-u`: esposto per i test e per chi vuole l'intestazione già pronta. */
export { basicHeaderValue };
