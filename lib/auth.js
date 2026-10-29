// Passwords, sign-in sessions, the admin list and sign-in throttling.
import { scrypt as scryptCb, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
import { fail, parseCookies, cookieHeader, clientIp } from './http.js';
import { readJson, writeJson, Conflict, PREFIX } from './store.js';

const scrypt = promisify(scryptCb);
const N = 16384, R = 8, P = 1, KEYLEN = 64, MAXMEM = 64 * 1024 * 1024;
export const COOKIE = 'kv_session';
export const SESSION_SECONDS = 30 * 24 * 3600;

/* ---------- passwords */
export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(pw, stored) {
  const parts = String(stored).split('$');
  if (parts[0] !== 'scrypt' || parts.length !== 6) return false;
  const want = Buffer.from(parts[5], 'base64');
  const key = await scrypt(pw.normalize('NFKC'), Buffer.from(parts[4], 'base64'), want.length, { N: +parts[1], r: +parts[2], p: +parts[3], maxmem: MAXMEM });
  return key.length === want.length && timingSafeEqual(key, want);
}

// Unknown user names still cost one hash, so the reply time does not reveal which names exist.
let dummy = null;
export const dummyHash = () => dummy || (dummy = hashPassword('not-a-real-password'));

const COMMON = ['12345678', '123456789', '1234567890', 'password', 'password1', 'qwertyui', 'qwerty123', '11111111', '00000000', 'iloveyou', 'kingvape', 'kingvape1', 'kingvape123', 'abc12345', '87654321'];
export function checkPassword(pw, username) {
  if (typeof pw !== 'string') fail(400, 'weak_password', { why: 'short' });
  if (pw.length < 8) fail(400, 'weak_password', { why: 'short' });
  if (pw.length > 200) fail(400, 'weak_password', { why: 'long' });
  const low = pw.toLowerCase();
  if (COMMON.includes(low) || /^(.)\1+$/.test(pw) || (username && low === username)) fail(400, 'weak_password', { why: 'common' });
}

export function normUser(s) {
  return String(s || '').trim().toLowerCase();
}
export function checkUsername(u) {
  if (!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(u)) fail(400, 'bad_username');
}
export function cleanName(s, fallback) {
  const n = String(s || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return n || fallback;
}

/* ---------- sessions (a signed cookie; it dies when the admin is removed or the password changes) */
function key() {
  const secret = process.env.SESSION_SECRET || process.env.BLOB_READ_WRITE_TOKEN;
  if (!secret) fail(503, 'not_configured');
  return createHmac('sha256', secret).update('kv-session|' + PREFIX).digest();
}
const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function sessionCookie(request, admin) {
  const body = b64u(JSON.stringify({ u: admin.u, v: admin.tv, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }));
  const sig = b64u(createHmac('sha256', key()).update(body).digest());
  return cookieHeader(request, COOKIE, body + '.' + sig, SESSION_SECONDS);
}
export function clearCookie(request) {
  return cookieHeader(request, COOKIE, '', 0);
}

function readSession(request) {
  const tok = parseCookies(request)[COOKIE];
  if (!tok) return null;
  const [body, sig] = tok.split('.');
  if (!body || !sig) return null;
  const want = createHmac('sha256', key()).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return c && typeof c.u === 'string' && c.exp > Date.now() / 1000 ? c : null;
  } catch {
    return null;
  }
}

/* ---------- the admin list */
// A random version stamp per admin. A new one is issued on every password change, and a re-created name starts with a fresh one,
// so old sign-in cookies can never match again.
export const newTv = () => randomBytes(9).toString('base64url');

export const view = (a) => ({ u: a.u, name: a.name, role: a.role, created: a.created, by: a.by || null });

// Who is signed in right now? Returns { admin, doc } or null.
export async function whoami(request, doc) {
  const c = readSession(request);
  if (!c) return null;
  doc = doc === undefined ? await readJson('admins.json') : doc;
  const admin = doc && doc.data.admins.find((a) => a.u === c.u);
  return admin && admin.tv === c.v ? { admin, doc } : null;
}

export async function requireAdmin(request) {
  const w = await whoami(request);
  if (!w) fail(401, 'signed_out');
  return w;
}
export async function requireOwner(request) {
  const w = await requireAdmin(request);
  if (w.admin.role !== 'owner') fail(403, 'owner_only');
  return w;
}

// Read-change-write the admin list, retrying if two changes happen at the same moment.
export async function changeAdmins(fn) {
  for (let i = 0; i < 5; i++) {
    const doc = await readJson('admins.json');
    if (!doc) fail(409, 'not_set_up');
    const next = structuredClone(doc.data);
    const result = await fn(next);
    try {
      await writeJson('admins.json', next, { etag: doc.etag });
      return { next, result };
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
    }
  }
  fail(503, 'busy');
}

/* ---------- throttling: too many wrong passwords or setup codes locks that name / address for ten minutes */
const LIMIT = { u: 6, ip: 25, setup: 6 };
const LOCK_SECONDS = 600;
const kindOf = (k) => (k === 'setup' ? 'setup' : k.startsWith('ip:') ? 'ip' : 'u');

export const throttleKeys = (request, username) => (username ? ['u:' + username.slice(0, 40)] : []).concat('ip:' + clientIp(request));

export async function lockedFor(keys) {
  const doc = await readJson('lock.json');
  const now = Date.now() / 1000;
  let wait = 0;
  for (const k of keys) {
    const e = doc && doc.data[k];
    if (e && e.until > now) wait = Math.max(wait, Math.ceil(e.until - now));
  }
  return wait;
}

async function updateLocks(fn) {
  try {
    const doc = await readJson('lock.json');
    const data = doc ? doc.data : {};
    const now = Date.now() / 1000;
    for (const k of Object.keys(data)) if (data[k].t < now - 86400) delete data[k];
    fn(data, now);
    const keys = Object.keys(data);
    if (keys.length > 400) keys.sort((a, b) => data[a].t - data[b].t).slice(0, keys.length - 400).forEach((k) => delete data[k]);
    await writeJson('lock.json', data);
  } catch (e) {
    console.error('[kv] could not update lock list:', e && e.message);   // never block a sign-in because bookkeeping failed
  }
}
export function noteFailure(keys) {
  return updateLocks((data, now) => {
    for (const k of keys) {
      const e = data[k] || { n: 0, until: 0, t: now };
      e.n += 1; e.t = now;
      if (e.n >= LIMIT[kindOf(k)]) { e.until = now + LOCK_SECONDS; e.n = 0; }
      data[k] = e;
    }
  });
}
export async function noteSuccess(keys) {
  const doc = await readJson('lock.json');
  if (!doc || !keys.some((k) => doc.data[k])) return;
  return updateLocks((data) => keys.forEach((k) => { if (kindOf(k) !== 'ip') delete data[k]; }));
}
