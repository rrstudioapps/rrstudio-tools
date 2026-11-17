// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools
import { describe, expect, it } from 'vitest';
import { CurlRequest, parseCurl, tokenize, unescapeCmd } from './curl';
import { TARGETS, generate, goStr, jsonBody, phpStr, pyStr } from './curl-generate';

function req(cmd: string): CurlRequest {
  const r = parseCurl(cmd);
  if (!r.ok) throw new Error(r.error);
  return r.request;
}
const codes = (r: CurlRequest) => r.warnings.map((w) => w.code);

describe('tokenize', () => {
  it('virgolette singole e doppie', () => {
    expect(tokenize(`curl 'a b' "c d" e\\ f`).tokens).toEqual(['curl', 'a b', 'c d', 'e f']);
  });
  it('escape nelle doppie virgolette: solo \\" \\\\ \\$ e backtick', () => {
    expect(tokenize(String.raw`"a\"b\\c\$d\n"`).tokens).toEqual(['a"b\\c$d\\n']);
  });
  it('continuazione di riga con backslash', () => {
    expect(tokenize('curl \\\n  -X POST \\\r\n  url').tokens).toEqual(['curl', '-X', 'POST', 'url']);
  });
  it("stringhe $'...' con escape ANSI-C", () => {
    expect(tokenize(String.raw`$'a\nb\t\'c\' \u00e9 \x41 \101'`).tokens).toEqual(["a\nb\t'c' é A A"]);
  });
  it('sequenze \\x consecutive formano UTF-8', () => {
    expect(tokenize(String.raw`$'\xc3\xa9'`).tokens).toEqual(['é']);
  });
  it('token vuoto tra virgolette', () => {
    expect(tokenize(`a '' b`).tokens).toEqual(['a', '', 'b']);
  });
  it('apice non chiuso', () => {
    expect(tokenize(`curl 'abc`).unterminated).toBe(true);
    expect(tokenize(`curl "abc`).unterminated).toBe(true);
  });
  it('si ferma a pipe, ; e reindirizzamenti', () => {
    const t = tokenize('curl url | jq .');
    expect(t.tokens).toEqual(['curl', 'url']);
    expect(t.stoppedAt).toBe('|');
    expect(tokenize('curl url > out.txt').stoppedAt).toBe('>');
    expect(tokenize('curl url && echo').stoppedAt).toBe('&&');
  });
  it('operatori dentro le virgolette non fermano nulla', () => {
    expect(tokenize(`curl 'a|b;c&d'`).tokens).toEqual(['curl', 'a|b;c&d']);
  });
});

describe('unescapeCmd (Windows)', () => {
  it('toglie i ^ e le continuazioni', () => {
    expect(unescapeCmd('curl ^"https://x.com^" ^\n  -H ^"a: b^"')).toBe('curl "https://x.com" -H "a: b"');
  });
  it('non tocca un comando senza ^ di escape', () => {
    expect(unescapeCmd('curl "a^b"')).toBe('curl "a^b"');
  });
});

describe('parseCurl: casi base', () => {
  it('GET semplice, url senza schema', () => {
    const r = req('curl example.com/path');
    expect(r.url).toBe('http://example.com/path');
    expect(r.method).toBe('GET');
    expect(codes(r)).toContain('urlScheme');
  });
  it('url con schema: nessun avviso', () => {
    expect(req('curl https://example.com').warnings).toEqual([]);
  });
  it('errori', () => {
    expect(parseCurl('')).toEqual({ ok: false, error: 'empty' });
    expect(parseCurl('wget http://x')).toEqual({ ok: false, error: 'notCurl' });
    expect(parseCurl('curl -X POST')).toEqual({ ok: false, error: 'noUrl' });
    expect(parseCurl("curl 'x")).toEqual({ ok: false, error: 'unterminatedQuote' });
  });
  it('prompt iniziale e curl.exe', () => {
    expect(req('$ curl https://a.it').url).toBe('https://a.it');
    expect(req('curl.exe https://a.it').url).toBe('https://a.it');
  });
  it('--url e opzioni dopo l\'indirizzo', () => {
    expect(req('curl -X DELETE --url https://a.it/x').method).toBe('DELETE');
    expect(req('curl https://a.it -X PUT').method).toBe('PUT');
  });
  it('-XPOST attaccato e opzioni raggruppate', () => {
    const r = req("curl -sSLXPOST 'https://a.it' -H'A: b'");
    expect(r.method).toBe('POST');
    expect(r.follow).toBe(true);
    expect(r.headers).toEqual([{ name: 'A', value: 'b' }]);
    expect(codes(r)).toEqual([]);
  });
  it('-I implica HEAD, -X lo sovrascrive', () => {
    expect(req('curl -I https://a.it').method).toBe('HEAD');
    expect(req('curl -I -X GET https://a.it').method).toBe('GET');
  });
  it('-L, -k, --compressed', () => {
    const r = req('curl -L -k --compressed https://a.it');
    expect([r.follow, r.insecure, r.compressed]).toEqual([true, true, true]);
    expect(req('curl --insecure https://a.it').insecure).toBe(true);
  });
  it('argomenti in più e "--" separatore', () => {
    const r = req('curl https://a.it https://b.it');
    expect(r.url).toBe('https://a.it');
    expect(r.warnings).toContainEqual({ code: 'extraArgs', param: 'https://b.it' });
    expect(req('curl -- -strano').url).toBe('http://-strano');
  });
  it('coda di shell segnalata', () => {
    expect(req('curl https://a.it | jq .').warnings).toContainEqual({ code: 'shellTail', param: '|' });
  });
});

describe('parseCurl: intestazioni', () => {
  it('-H, -A, -e, -b', () => {
    const r = req(`curl https://a.it -H 'Accept: text/html' -A 'Mozilla/5.0' -e https://ref.it -b 'a=1; b=2'`);
    expect(r.headers).toEqual([
      { name: 'Accept', value: 'text/html' },
      { name: 'User-Agent', value: 'Mozilla/5.0' },
      { name: 'Referer', value: 'https://ref.it' },
      { name: 'Cookie', value: 'a=1; b=2' },
    ]);
  });
  it('"Nome:" toglie, "Nome;" invia vuota', () => {
    const r = req(`curl https://a.it -H 'X-A: 1' -H 'X-A:' -H 'X-B;'`);
    expect(r.headers).toEqual([{ name: 'X-B', value: '' }]);
  });
  it('valore con due punti e intestazione non valida', () => {
    const r = req(`curl https://a.it -H 'Date: 12:30:00' -H 'senza'`);
    expect(r.headers).toEqual([{ name: 'Date', value: '12:30:00' }]);
    expect(codes(r)).toContain('badHeader');
  });
  it('-b con un nome di file non è un cookie', () => {
    const r = req('curl https://a.it -b jar.txt');
    expect(r.headers).toEqual([]);
    expect(codes(r)).toContain('cookieFile');
  });
  it('--oauth2-bearer', () => {
    expect(req('curl https://a.it --oauth2-bearer tok').headers).toEqual([{ name: 'Authorization', value: 'Bearer tok' }]);
  });
});

describe('parseCurl: corpo', () => {
  it('-d → POST con Content-Type form', () => {
    const r = req(`curl https://a.it -d 'a=1' -d 'b=2'`);
    expect(r.method).toBe('POST');
    expect(r.body).toEqual({ kind: 'raw', data: 'a=1&b=2' });
    expect(r.headers).toEqual([{ name: 'Content-Type', value: 'application/x-www-form-urlencoded' }]);
  });
  it('Content-Type esplicito non viene duplicato', () => {
    const r = req(`curl https://a.it -H 'content-type: application/json' --data-raw '{"a":1}'`);
    expect(r.headers).toHaveLength(1);
  });
  it('--data-raw non interpreta @', () => {
    const r = req(`curl https://a.it --data-raw '@x'`);
    expect(r.body).toEqual({ kind: 'raw', data: '@x' });
    expect(codes(r)).not.toContain('dataFile');
  });
  it('-d @file è segnalato', () => {
    expect(codes(req('curl https://a.it -d @dati.json'))).toContain('dataFile');
    expect(codes(req('curl https://a.it --data-binary @dati.bin'))).toContain('dataFile');
  });
  it('--data-urlencode nelle varie forme', () => {
    const r = req(`curl https://a.it --data-urlencode 'q=a b&c' --data-urlencode 'x y' --data-urlencode '=é'`);
    expect(r.body).toEqual({ kind: 'raw', data: 'q=a%20b%26c&x%20y&%C3%A9' });
  });
  it('--json imposta le intestazioni e il metodo', () => {
    const r = req(`curl https://a.it --json '{"a":1}'`);
    expect(r.method).toBe('POST');
    expect(r.body).toEqual({ kind: 'raw', data: '{"a":1}' });
    expect(r.headers).toEqual([
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Accept', value: 'application/json' },
    ]);
  });
  it('-F: testo, file e tipo', () => {
    const r = req(`curl https://a.it -F 'a=1' -F 'f=@foto.png;type=image/png' -F 't="x;y"' --form-string 'z=@non-file'`);
    expect(r.method).toBe('POST');
    expect(r.body).toEqual({
      kind: 'form',
      fields: [
        { name: 'a', value: '1', file: false, type: undefined },
        { name: 'f', value: 'foto.png', file: true, type: 'image/png' },
        { name: 't', value: 'x;y', file: false, type: undefined },
        { name: 'z', value: '@non-file', file: false },
      ],
    });
    expect(r.headers).toEqual([]);
  });
  it('-G sposta i dati nell\'indirizzo', () => {
    const r = req(`curl -G https://a.it/s --data-urlencode 'q=a b' -d 'p=1'`);
    expect(r.method).toBe('GET');
    expect(r.body).toBeNull();
    expect(r.url).toBe('https://a.it/s?q=a%20b&p=1');
    expect(req(`curl -G 'https://a.it/s?x=1' -d y=2`).url).toBe('https://a.it/s?x=1&y=2');
    expect(req(`curl -G https://a.it -d y=2`).headers).toEqual([]);
  });
  it('-X GET con dati senza -G mantiene il corpo', () => {
    const r = req(`curl -X GET https://a.it -d a=1`);
    expect(r.method).toBe('GET');
    expect(r.body).not.toBeNull();
  });
});

describe('parseCurl: autenticazione e opzioni ignorate', () => {
  it('-u utente:password e solo utente', () => {
    expect(req('curl -u mario:p:ss https://a.it').basicAuth).toEqual({ user: 'mario', password: 'p:ss' });
    expect(req('curl --user mario https://a.it').basicAuth).toEqual({ user: 'mario', password: '' });
  });
  it('opzioni sconosciute e ignorate segnalate', () => {
    const r = req('curl --foo-bar -s -v --max-time 5 -o out.txt --digest https://a.it');
    expect(r.url).toBe('https://a.it');
    expect(r.warnings).toContainEqual({ code: 'unknownOption', param: '--foo-bar' });
    expect(r.warnings).toContainEqual({ code: 'ignored', param: '--max-time' });
    expect(r.warnings).toContainEqual({ code: 'ignored', param: '-o' });
    expect(r.warnings).toContainEqual({ code: 'authType', param: '--digest' });
    expect(codes(r)).not.toContain('ignored-s');
    expect(r.warnings.filter((w) => w.param === '-s' || w.param === '-v')).toEqual([]);
  });
  it('opzione breve sconosciuta', () => {
    expect(req('curl -Z https://a.it').warnings).toContainEqual({ code: 'unknownOption', param: '-Z' });
  });
});

describe('parseCurl: comandi copiati dai browser', () => {
  it('Chrome (bash)', () => {
    const cmd = `curl 'https://api.example.com/v1/items?limit=10' \\
  -H 'accept: application/json, text/plain, */*' \\
  -H 'accept-language: it-IT,it;q=0.9' \\
  -H 'authorization: Bearer abc.def.ghi' \\
  -H 'content-type: application/json' \\
  -H 'origin: https://app.example.com' \\
  -H 'referer: https://app.example.com/' \\
  -H 'sec-fetch-mode: cors' \\
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' \\
  --data-raw $'{"name":"Caff\\u00e8","qty":2,"note":"it\\'s"}' \\
  --compressed`;
    const r = req(cmd);
    expect(r.url).toBe('https://api.example.com/v1/items?limit=10');
    expect(r.method).toBe('POST');
    expect(r.compressed).toBe(true);
    expect(r.headers).toHaveLength(8);
    expect(r.body).toEqual({ kind: 'raw', data: `{"name":"Caffè","qty":2,"note":"it's"}` });
    expect(r.warnings).toEqual([]);
  });
  it('Chrome (cmd di Windows)', () => {
    const cmd = [
      'curl ^"https://api.example.com/login^" ^',
      '  -H ^"accept: application/json^" ^',
      '  -H ^"content-type: application/json^" ^',
      '  --data-raw ^"^{^\\^"user^\\^":^\\^"mario^\\^",^\\^"pwd^\\^":^\\^"100^%^\\^"^}^"',
    ].join('\r\n');
    const r = req(cmd);
    expect(r.url).toBe('https://api.example.com/login');
    expect(r.headers.map((h) => h.name)).toEqual(['accept', 'content-type']);
    expect(r.body).toEqual({ kind: 'raw', data: '{"user":"mario","pwd":"100%"}' });
    expect(r.method).toBe('POST');
  });
  it('Firefox (POSIX)', () => {
    const cmd = `curl 'https://example.org/api' --compressed -X POST -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0' -H 'Accept: */*' -H 'Content-Type: application/x-www-form-urlencoded' -H 'Cookie: sid=abc; theme=dark' --data-raw 'a=1&b=%C3%A8'`;
    const r = req(cmd);
    expect(r.method).toBe('POST');
    expect(r.headers.find((h) => h.name === 'Cookie')?.value).toBe('sid=abc; theme=dark');
    expect(r.body).toEqual({ kind: 'raw', data: 'a=1&b=%C3%A8' });
    expect(r.warnings).toEqual([]);
  });
  it('Firefox con multipart', () => {
    const cmd = `curl 'https://example.org/up' -X POST -H 'Content-Type: multipart/form-data; boundary=----X' --data-raw $'------X\\r\\nContent-Disposition: form-data; name="a"\\r\\n\\r\\n1\\r\\n------X--\\r\\n'`;
    const r = req(cmd);
    expect(r.body).toEqual({ kind: 'raw', data: '------X\r\nContent-Disposition: form-data; name="a"\r\n\r\n1\r\n------X--\r\n' });
  });
});

describe('jsonBody', () => {
  const j = (body: string) => req(`curl https://a.it -H 'Content-Type: application/json' -d '${body}'`);
  it('JSON compatto o formattato diventa oggetto', () => {
    expect(jsonBody(j('{"a":[1,2],"b":null}'))).toEqual({ a: [1, 2], b: null });
    expect(jsonBody(j('{\n  "a": "x y",\n  "b": true\n}'))).toEqual({ a: 'x y', b: true });
  });
  it('non converte se si perderebbe qualcosa', () => {
    expect(jsonBody(j('{"n":12345678901234567890}'))).toBeUndefined();
    expect(jsonBody(j('{"a":1,"a":2}'))).toBeUndefined();
    expect(jsonBody(j('{non json}'))).toBeUndefined();
    expect(jsonBody(req(`curl https://a.it -d '{"a":1}'`))).toBeUndefined();
  });
});

describe('escape dei linguaggi', () => {
  it('Python', () => {
    expect(pyStr(`a'b\\c\nd\u0001é`)).toBe(String.raw`'a\'b\\c\nd\x01é'`);
  });
  it('PHP', () => {
    expect(phpStr(`it's $x \\`)).toBe(String.raw`'it\'s $x \\'`);
    expect(phpStr('a\r\n"$b"')).toBe(String.raw`"a\r\n\"\$b\""`);
  });
  it('senza -L nessuna impostazione sui redirect, in nessun linguaggio', () => {
    for (const lang of ['fetch', 'node', 'axios', 'python', 'php', 'go'] as const) {
      const code = generate(req('curl -k https://a.it -d x=1'), lang as never).code;
      expect(code, lang).not.toMatch(/redirect|CheckRedirect|FOLLOWLOCATION|ErrUseLastResponse/i);
    }
  });
  it('Go', () => {
    expect(goStr('a"b\n\u00e8')).toBe('"a\\"b\\nè"');
  });
});

describe('generatori', () => {
  const post = req(`curl 'https://api.example.com/items' -X POST -H 'Content-Type: application/json' -H 'Authorization: Bearer tok' -d '{"name":"Caffè","tags":["a","b"],"ok":true,"n":null}' -L`);

  it('fetch', () => {
    const g = generate(post, 'fetch');
    expect(g.code).toContain('await fetch("https://api.example.com/items", {');
    expect(g.code).toContain('method: "POST",');
    expect(g.code).toContain('"Authorization": "Bearer tok",');
    expect(g.code).toContain('body: JSON.stringify({');
    expect(g.code).toContain('name: "Caffè",');
    expect(g.code).not.toContain('redirect');
    expect(g.warnings).toEqual([]);
  });
  it('fetch semplice: GET senza opzioni, nessuna impostazione di redirect', () => {
    expect(generate(req('curl https://a.it -L'), 'fetch').code).toBe('const response = await fetch("https://a.it");\nconst data = await response.text();\nconsole.log(response.status, data);');
    expect(generate(req('curl https://a.it'), 'fetch').code).not.toContain('redirect');
  });
  it('fetch: -k e Cookie/Referer nel browser sono segnalati', () => {
    const r = req(`curl -k https://a.it -H 'Cookie: a=1' -e https://r.it -H 'Sec-Fetch-Mode: cors' -L`);
    const w = generate(r, 'fetch').warnings;
    expect(w).toContainEqual({ code: 'insecureFetch' });
    expect(w).toContainEqual({ code: 'forbiddenHeaders', param: 'Cookie, Referer, Sec-Fetch-Mode' });
    const n = generate(r, 'node').warnings;
    expect(n).toContainEqual({ code: 'insecureNodeFetch' });
    expect(n.map((x) => x.code)).not.toContain('forbiddenHeaders');
  });
  it('fetch: GET con corpo è segnalato, intestazioni duplicate pure', () => {
    const w = generate(req(`curl -X GET https://a.it -d a=1 -H 'X: 1' -H 'x: 2'`), 'fetch').warnings.map((x) => x.code);
    expect(w).toContain('getBody');
    expect(w).toContain('duplicateHeaders');
  });
  it('fetch: autenticazione di base, browser e Node', () => {
    const r = req('curl -u mario:segreto https://a.it -L');
    expect(generate(r, 'fetch').code).toContain('"Authorization": "Basic " + btoa("mario:segreto"),');
    expect(generate(r, 'node').code).toContain('Buffer.from("mario:segreto").toString("base64")');
  });
  it('fetch multipart con file: FormData', () => {
    const r = req(`curl https://a.it -F a=1 -F f=@foto.png -L`);
    const b = generate(r, 'fetch');
    expect(b.code).toContain('const form = new FormData();');
    expect(b.code).toContain('form.append("a", "1");');
    expect(b.code).toContain('fileInput.files[0]');
    expect(b.warnings).toContainEqual({ code: 'formFileBrowser' });
    const n = generate(r, 'node');
    expect(n.code).toContain('import { openAsBlob } from "node:fs";');
    expect(n.code).toContain('await openAsBlob("foto.png")');
  });
  it('axios', () => {
    const g = generate(post, 'axios');
    expect(g.code).toContain('import axios from "axios";');
    expect(g.code).toContain('method: "post",');
    expect(g.code).toContain('data: {');
    expect(g.code).not.toContain('maxRedirects');
    const k = generate(req('curl -k -u a:b https://a.it'), 'axios');
    expect(k.code).toContain('import https from "node:https";');
    expect(k.code).toContain('rejectUnauthorized: false');
    expect(k.code).toContain('auth: { username: "a", password: "b" },');
  });
  it('Python', () => {
    const g = generate(post, 'python');
    expect(g.code).toContain('import requests');
    expect(g.code).toContain("'Authorization': 'Bearer tok',");
    expect(g.code).not.toContain("'Content-Type'");
    expect(g.code).toContain('json_data = {');
    expect(g.code).toContain("'name': 'Caffè',");
    expect(g.code).toContain("'ok': True,");
    expect(g.code).toContain("'n': None,");
    expect(g.code).toContain("requests.post(");
    expect(g.code).toContain('json=json_data');
    expect(g.code).not.toContain('allow_redirects');
  });
  it('Python: form-urlencoded, auth, -k, no -L, metodo insolito, file', () => {
    const g = generate(req(`curl -X PURGE -k -u u:p https://a.it -d 'a=1&b=2'`), 'python');
    expect(g.code).toContain("data = 'a=1&b=2'");
    expect(g.code).toContain("requests.request(\n    'PURGE',\n    'https://a.it',\n    headers=headers,");
    expect(g.code).toContain("auth=('u', 'p')");
    expect(g.code).toContain('verify=False');
    const f = generate(req(`curl https://a.it -F a=1 -F 'f=@dir/x.png;type=image/png' -L`), 'python').code;
    expect(f).toContain("('a', (None, '1')),");
    expect(f).toContain("('f', ('x.png', open('dir/x.png', 'rb'), 'image/png')),");
  });
  it('PHP', () => {
    const g = generate(req(`curl -X PUT -u a:b --compressed -k -L https://a.it -H 'X-T: 1' -d 'x=1'`), 'php');
    expect(g.code).toContain("CURLOPT_URL => 'https://a.it',");
    expect(g.code).toContain("CURLOPT_CUSTOMREQUEST => 'PUT',");
    expect(g.code).toContain("CURLOPT_POSTFIELDS => 'x=1',");
    expect(g.code).toContain("'X-T: 1',");
    expect(g.code).toContain("CURLOPT_USERPWD => 'a:b',");
    expect(g.code).toContain('CURLOPT_FOLLOWLOCATION => true,');
    expect(g.code).toContain("CURLOPT_ENCODING => '',");
    expect(g.code).toContain('CURLOPT_SSL_VERIFYPEER => false,');
    expect(generate(post, 'php').code).toContain('CURLOPT_POST => true,');
    expect(generate(req('curl -I https://a.it'), 'php').code).toContain('CURLOPT_NOBODY => true,');
    expect(generate(req('curl -F f=@a.txt https://a.it'), 'php').code).toContain("'f' => new CURLFile('a.txt'),");
  });
  it('Go', () => {
    const g = generate(req(`curl -k -u a:b -H 'Host: x.it' -H 'X-A: 1' https://a.it -d 'q=1'`), 'go');
    expect(g.code).toContain('package main');
    expect(g.code).toContain('\t"crypto/tls"\n\t"fmt"\n\t"io"\n\t"net/http"\n\t"strings"');
    expect(g.code).toContain('http.NewRequest("POST", "https://a.it", strings.NewReader("q=1"))');
    expect(g.code).toContain('req.Host = "x.it"');
    expect(g.code).toContain('req.Header.Add("X-A", "1")');
    expect(g.code).toContain('req.SetBasicAuth("a", "b")');
    expect(g.code).toContain('InsecureSkipVerify: true');
    const m = generate(req('curl -L -F a=1 -F f=@x.txt https://a.it'), 'go').code;
    expect(m).toContain('multipart.NewWriter(&buf)');
    expect(m).toContain('w.WriteField("a", "1")');
    expect(m).toContain('os.Open("x.txt")');
    expect(m).toContain('req.Header.Set("Content-Type", w.FormDataContentType())');
    expect(m).toContain('client := &http.Client{}');
  });
  it('tutti i linguaggi producono codice per tutti i comandi di prova', () => {
    const cmds = [post, req('curl https://a.it'), req(`curl -F a=1 -u a:b -k https://a.it`), req(`curl -I https://a.it`)];
    for (const c of cmds) for (const t of TARGETS) expect(generate(c, t).code.length).toBeGreaterThan(20);
  });
  it('caratteri speciali nei valori non rompono le stringhe', () => {
    const r = req(`curl https://a.it -H $'X: a"b\\\\c' -d $'l1\\nl2 \\'q\\''`);
    expect(generate(r, 'fetch').code).toContain('"X": "a\\"b\\\\c"');
    expect(generate(r, 'python').code).toContain("data = 'l1\\nl2 \\'q\\''");
    expect(generate(r, 'php').code).toContain('CURLOPT_POSTFIELDS => "l1\\nl2 \'q\'"');
  });
});
