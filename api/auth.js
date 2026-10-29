// Sign in, sign out, and the one-time creation of the owner account.
//   GET            -> { setup: true|false, me: {...}|null }
//   POST {a:'login', username, password}
//   POST {a:'setup', code, username, name, password}   (only works while no admin exists yet)
//   POST {a:'logout'}
import { handle, json, fail, guard, jsonBody, clientIp } from '../lib/http.js';
import { readJson, writeJson, Conflict } from '../lib/store.js';
import {
  hashPassword, verifyPassword, dummyHash, checkPassword, checkUsername, normUser, cleanName,
  sessionCookie, clearCookie, whoami, view, newTv, throttleKeys, lockedFor, noteFailure, noteSuccess,
} from '../lib/auth.js';

const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function login(request, b) {
  const username = normUser(b.username);
  const password = typeof b.password === 'string' ? b.password : '';
  if (!username || !password || password.length > 200) fail(400, 'missing');
  const keys = throttleKeys(request, username);
  const wait = await lockedFor(keys);
  if (wait) fail(429, 'locked', { retry: wait });

  const doc = await readJson('admins.json');
  const admin = doc && doc.data.admins.find((a) => a.u === username);
  const ok = await verifyPassword(password, admin ? admin.pw : await dummyHash());
  if (!admin || !ok) {
    await noteFailure(keys);
    fail(401, 'bad_login');
  }
  await noteSuccess(keys);
  return json({ me: view(admin) }, 200, { 'Set-Cookie': sessionCookie(request, admin) });
}

async function setup(request, b) {
  const keys = ['setup', 'ip:' + clientIp(request)];
  const wait = await lockedFor(keys);
  if (wait) fail(429, 'locked', { retry: wait });
  const existing = await readJson('admins.json');
  if (existing && existing.data.admins.length) fail(409, 'already_setup');

  const want = norm(process.env.SETUP_CODE);
  if (!want) fail(503, 'setup_disabled');
  const got = norm(b.code);
  if (!got || got !== want) {
    await noteFailure(keys);
    fail(403, 'bad_code');
  }
  const username = normUser(b.username);
  checkUsername(username);
  checkPassword(b.password, username);
  const admin = {
    u: username,
    name: cleanName(b.name, username),
    role: 'owner',
    pw: await hashPassword(b.password),
    tv: newTv(),
    created: Date.now(),
    by: null,
  };
  try {
    await writeJson('admins.json', { v: 1, admins: [admin] }, { etag: existing ? existing.etag : null });
  } catch (e) {
    if (e instanceof Conflict) fail(409, 'already_setup');
    throw e;
  }
  await noteSuccess(keys);
  return json({ me: view(admin) }, 200, { 'Set-Cookie': sessionCookie(request, admin) });
}

export default {
  fetch: handle(async (request) => {
    if (request.method === 'GET') {
      const doc = await readJson('admins.json');
      const w = await whoami(request, doc);
      return json({ setup: !(doc && doc.data.admins.length), me: w ? view(w.admin) : null });
    }
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    guard(request);
    const b = await jsonBody(request, 8192);
    if (b.a === 'login') return login(request, b);
    if (b.a === 'setup') return setup(request, b);
    if (b.a === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(request) });
    return fail(400, 'bad_action');
  }),
};
