// Local stand-in for Vercel, used by the tests: serves public/, runs the real api/ handlers and applies vercel.json.
// Data goes to a temporary folder instead of Blob (KV_LOCAL_DIR).
import http from 'node:http';
import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css' };

export async function start({ port = 0, dir, setupCode = 'TEST-CODE-1234-ABCD', quiet = true } = {}) {
  process.env.KV_LOCAL_DIR = dir;
  process.env.SESSION_SECRET = 'test-secret-for-local-runs';
  process.env.SETUP_CODE = setupCode;
  process.env.KV_PREFIX = 'live/';
  const handlers = {};
  for (const name of ['catalog', 'photo', 'auth', 'admin']) handlers[name] = (await import(pathToFileURL(path.join(root, 'api', name + '.js')).href + '?t=' + Date.now())).default.fetch;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://' + req.headers.host);
      let p = decodeURIComponent(url.pathname);
      const extra = {};
      for (const rule of cfg.headers || []) for (const h of rule.headers) extra[h.key] = h.value;   // single catch-all rule in this project
      if (p.startsWith('/api/')) {
        const fn = handlers[p.slice(5)];
        if (!fn) { res.writeHead(404, extra).end('not found'); return; }
        const init = { method: req.method, headers: req.headers };
        if (req.method !== 'GET' && req.method !== 'HEAD') { init.body = Readable.toWeb(req); init.duplex = 'half'; }
        const r = await fn(new Request(url.href, init));
        const headers = { ...extra };
        if (r.status === 413) headers.connection = 'close';   // the body was refused unread, so do not reuse this connection
        r.headers.forEach((v, k) => { headers[k] = v; });
        const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
        if (sc.length) headers['set-cookie'] = sc;
        res.writeHead(r.status, headers);
        res.end(Buffer.from(await r.arrayBuffer()));
        return;
      }
      for (const rw of cfg.rewrites || []) if (rw.source === p) p = rw.destination;
      if (p === '/') p = '/index.html';
      const file = path.join(root, 'public', p);
      if (!file.startsWith(path.join(root, 'public'))) { res.writeHead(403).end(); return; }
      const buf = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', ...extra });
      res.end(buf);
    } catch (e) {
      if (e.code === 'ENOENT') { res.writeHead(404).end('not found'); return; }
      if (!quiet) console.error(e);
      res.writeHead(500).end('error');
    }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { server, url: 'http://127.0.0.1:' + server.address().port, close: () => new Promise((r) => server.close(r)) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = await fs.mkdtemp('/tmp/kv-local-');
  const s = await start({ port: Number(process.env.PORT || 4173), dir, quiet: false });
  console.log('listening', s.url, 'data in', dir);
}
