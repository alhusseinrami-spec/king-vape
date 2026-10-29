// Where the shop's data lives.
//   - In production: one private Vercel Blob store (BLOB_READ_WRITE_TOKEN is added to the project automatically).
//   - In local tests: a plain folder (KV_LOCAL_DIR), so the real handlers can run without any network.
// Everything is stored under a prefix, so preview deployments (KV_PREFIX=preview/) never touch the live shop data.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const PREFIX = (process.env.KV_PREFIX || 'live/').replace(/^\/+/, '').replace(/([^/])$/, '$1/');
const LOCAL = process.env.KV_LOCAL_DIR || '';

export class Conflict extends Error {
  constructor() {
    super('conflict');
    this.name = 'Conflict';
  }
}

let sdk = null;
const blob = async () => sdk || (sdk = await import('@vercel/blob'));
const sha = (s) => createHash('sha1').update(s).digest('hex');

// Local mode only: serialise writes to the same file, so tests behave like the atomic conditional writes Blob offers.
const chains = new Map();
function locked(key, fn) {
  const prev = chains.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  chains.set(key, next.catch(() => {}));
  return next;
}

async function localRead(full) {
  try {
    return await fs.readFile(path.join(LOCAL, full));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

async function localWrite(full, buf) {
  const file = path.join(LOCAL, full);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buf);
}

// Returns { data, etag } or null when the file does not exist yet. Always reads the newest copy.
export async function readJson(name) {
  const full = PREFIX + name;
  if (LOCAL) {
    const buf = await localRead(full);
    if (!buf) return null;
    const raw = buf.toString('utf8');
    return { data: JSON.parse(raw), etag: sha(raw) };
  }
  const { get } = await blob();
  const r = await get(full, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  const raw = await new Response(r.stream).text();
  return { data: JSON.parse(raw), etag: r.blob.etag };
}

// opts.etag:  a string  -> replace only if the file is still that exact version (otherwise throws Conflict)
//             null      -> create only if the file does not exist yet (otherwise throws Conflict)
//             undefined -> just write
export async function writeJson(name, data, opts = {}) {
  const full = PREFIX + name;
  const raw = JSON.stringify(data);
  if (LOCAL) {
    return locked(full, async () => {
      const cur = await localRead(full);
      if (opts.etag === null && cur) throw new Conflict();
      if (typeof opts.etag === 'string' && (!cur || sha(cur.toString('utf8')) !== opts.etag)) throw new Conflict();
      await localWrite(full, raw);
      return { etag: sha(raw) };
    });
  }
  const { put, BlobPreconditionFailedError } = await blob();
  try {
    const r = await put(full, raw, {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: opts.etag !== null,
      ifMatch: typeof opts.etag === 'string' ? opts.etag : undefined,
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
    });
    return { etag: r.etag };
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError) throw new Conflict();
    if (opts.etag === null && (await readJson(name))) throw new Conflict();   // "create only" lost the race
    throw e;
  }
}

export async function writeBinary(name, buf, contentType) {
  const full = PREFIX + name;
  if (LOCAL) {
    await localWrite(full, buf);
    await localWrite(full + '.type', contentType);
    return;
  }
  const { put } = await blob();
  await put(full, Buffer.from(buf), { access: 'private', contentType, allowOverwrite: true, addRandomSuffix: false, cacheControlMaxAge: 31536000 });
}

// Returns { buf, contentType } or null.
export async function readBinary(name) {
  const full = PREFIX + name;
  if (LOCAL) {
    const buf = await localRead(full);
    if (!buf) return null;
    const type = await localRead(full + '.type');
    return { buf: new Uint8Array(buf), contentType: type ? type.toString('utf8') : 'application/octet-stream' };
  }
  const { get } = await blob();
  const r = await get(full, { access: 'private' });
  if (!r || r.statusCode !== 200) return null;
  return { buf: new Uint8Array(await new Response(r.stream).arrayBuffer()), contentType: r.blob.contentType };
}
