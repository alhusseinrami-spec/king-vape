// Runs the real api/ handlers against a temporary data folder. Start: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHmac } from 'node:crypto';
import { start } from './server.mjs';

const CODE = 'TEST-CODE-1234-ABCD';
let srv;
test.before(async () => {
  const dir = await fs.mkdtemp('/tmp/kv-api-');
  srv = await start({ dir, setupCode: CODE });
});
test.after(async () => { await srv.close(); });

class Client {
  constructor() { this.cookie = ''; }
  async call(method, path, body, headers = {}) {
    const h = { 'x-kv': '1', ...headers };
    if (this.cookie) h.cookie = this.cookie;
    let payload;
    if (body instanceof Uint8Array) payload = body;
    else if (body !== undefined) { payload = JSON.stringify(body); h['content-type'] = 'application/json'; }
    const r = await fetch(srv.url + path, { method, headers: h, body: payload });
    const sc = r.headers.getSetCookie();
    if (sc.length) {
      const c = sc[0].split(';')[0];
      this.cookie = c.endsWith('=') ? '' : c;
      this.lastSetCookie = sc[0];
    }
    const type = r.headers.get('content-type') || '';
    const data = type.includes('json') ? await r.json() : new Uint8Array(await r.arrayBuffer());
    return { status: r.status, data, headers: r.headers };
  }
  get(p) { return this.call('GET', p); }
  post(p, b) { return this.call('POST', p, b); }
}

async function tvOf(u) { const d = JSON.parse(await fs.readFile(process.env.KV_LOCAL_DIR + '/live/admins.json', 'utf8')); return d.admins.find((a) => a.u === u).tv; }

const owner = new Client();
const anon = new Client();
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20, 1, 2, 3, 4]);

async function product(id, over = {}) {
  const cat = (await anon.get('/api/catalog')).data;
  const p = structuredClone(cat.products.find((x) => x.id === id));
  return { p: { ...p, ...over }, base: p.u || 0 };
}

test('public catalogue works before anything is set up (built-in list)', async () => {
  const r = await anon.get('/api/catalog');
  assert.equal(r.status, 200);
  assert.equal(r.data.rev, 1);
  assert.equal(r.data.products.length, 44);
  assert.match(r.headers.get('cache-control'), /must-revalidate/);
  assert.match(r.headers.get('vercel-cdn-cache-control'), /max-age=10/);
});

test('every built-in product passes the same checks the server applies to edits', async () => {
  const { sanitizeProduct } = await import('../lib/catalog.js');
  const { default: seed } = await import('../lib/seed.json', { with: { type: 'json' } });
  for (const p of seed.products) assert.doesNotThrow(() => sanitizeProduct(p), p.id);
  assert.equal(seed.products.length, 44);
});

test('security headers are sent with every response', async () => {
  const r = await fetch(srv.url + '/');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  const a = await fetch(srv.url + '/admin');
  assert.equal(a.status, 200);   // the /admin rewrite serves the app
});

test('before setup: status says setup is needed and admin calls are refused', async () => {
  const st = await anon.get('/api/auth');
  assert.deepEqual(st.data, { setup: true, me: null });
  assert.equal((await anon.get('/api/admin?a=catalog')).status, 401);
  assert.equal((await anon.post('/api/admin', { a: 'save', changes: [] })).status, 401);
  assert.equal((await anon.post('/api/admin?a=photo', PNG)).status, 401);
});

test('requests that change things must come from the site itself', async () => {
  const noHeader = await fetch(srv.url + '/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'login', username: 'x', password: 'y' }) });
  assert.equal(noHeader.status, 403);
  const evil = await fetch(srv.url + '/api/auth', { method: 'POST', headers: { 'content-type': 'application/json', 'x-kv': '1', origin: 'https://evil.example' }, body: JSON.stringify({ a: 'login', username: 'x', password: 'y' }) });
  assert.equal(evil.status, 403);
  const same = await fetch(srv.url + '/api/auth', { method: 'POST', headers: { 'content-type': 'application/json', 'x-kv': '1', origin: srv.url }, body: JSON.stringify({ a: 'login', username: 'x', password: 'y' }) });
  assert.equal(same.status, 401);   // passes the guard, then fails as a normal wrong login
});

test('setup: needs the right code, a valid name and a decent password', async () => {
  const c = new Client();
  assert.equal((await c.post('/api/auth', { a: 'setup', code: 'WRONG', username: 'rami', password: 'long-enough-1' })).data.error, 'bad_code');
  assert.equal((await c.post('/api/auth', { a: 'setup', code: CODE, username: 'r', password: 'long-enough-1' })).data.error, 'bad_username');
  assert.equal((await c.post('/api/auth', { a: 'setup', code: CODE, username: 'rami', password: 'short' })).data.error, 'weak_password');
  assert.equal((await c.post('/api/auth', { a: 'setup', code: CODE, username: 'rami', password: 'password' })).data.error, 'weak_password');
  assert.equal((await c.post('/api/auth', { a: 'setup', code: CODE, username: 'rami', password: 'aaaaaaaaaa' })).data.error, 'weak_password');
  assert.equal((await c.get('/api/auth')).data.setup, true);   // nothing was created by the failed attempts
});

test('setup: the right code creates the owner and signs them in; it works only once', async () => {
  const r = await owner.post('/api/auth', { a: 'setup', code: ' ' + CODE.toLowerCase() + ' ', username: 'Rami', name: 'Rami', password: 'owner-pass-1' });
  assert.equal(r.status, 200);
  assert.deepEqual({ u: r.data.me.u, role: r.data.me.role, name: r.data.me.name }, { u: 'rami', role: 'owner', name: 'Rami' });
  assert.match(owner.lastSetCookie, /HttpOnly/);
  assert.match(owner.lastSetCookie, /SameSite=Strict/);
  assert.ok(!JSON.stringify(r.data).includes('scrypt'), 'no password hash in replies');
  const again = await new Client().post('/api/auth', { a: 'setup', code: CODE, username: 'other', password: 'other-pass-1' });
  assert.equal(again.status, 409);
  const st = await owner.get('/api/auth');
  assert.equal(st.data.setup, false);
  assert.equal(st.data.me.u, 'rami');
  assert.equal((await anon.get('/api/auth')).data.me, null);
});

test('sign-in: wrong password and unknown name look the same; sign-out ends the session', async () => {
  const c = new Client();
  const a = await c.post('/api/auth', { a: 'login', username: 'rami', password: 'nope-nope-1' });
  const b = await c.post('/api/auth', { a: 'login', username: 'nobody', password: 'nope-nope-1' });
  assert.equal(a.status, 401); assert.equal(b.status, 401);
  assert.deepEqual(a.data, b.data);
  const ok = await c.post('/api/auth', { a: 'login', username: 'RAMI', password: 'owner-pass-1' });
  assert.equal(ok.status, 200);
  assert.equal((await c.get('/api/admin?a=catalog')).status, 200);
  const old = c.cookie;
  await c.post('/api/auth', { a: 'logout' });
  assert.equal(c.cookie, '');
  assert.equal((await c.get('/api/admin?a=catalog')).status, 401);
  // a copied cookie is not revoked by signing out elsewhere (stateless), but a tampered one is rejected
  const bad = new Client(); bad.cookie = old.slice(0, -3) + 'abc';
  assert.equal((await bad.get('/api/admin?a=catalog')).status, 401);
  const garbage = new Client(); garbage.cookie = 'kv_session=garbage';
  assert.equal((await garbage.get('/api/admin?a=catalog')).status, 401);
});

test('an expired session is refused', async () => {
  const body = Buffer.from(JSON.stringify({ u: 'rami', v: await tvOf('rami'), exp: Math.floor(Date.now() / 1000) - 10 })).toString('base64url');
  const key = createHmac('sha256', 'test-secret-for-local-runs').update('kv-session|live/').digest();
  const sig = createHmac('sha256', key).update(body).digest('base64url');
  const c = new Client(); c.cookie = 'kv_session=' + encodeURIComponent(body + '.' + sig);
  assert.equal((await c.get('/api/admin?a=catalog')).status, 401);
  const fresh = Buffer.from(JSON.stringify({ u: 'rami', v: await tvOf('rami'), exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
  const sig2 = createHmac('sha256', key).update(fresh).digest('base64url');
  c.cookie = 'kv_session=' + encodeURIComponent(fresh + '.' + sig2);
  assert.equal((await c.get('/api/admin?a=catalog')).status, 200, 'the same recipe with a future expiry is accepted (proves the test builds valid cookies)');
});

test('too many wrong passwords lock that name for a while, even for the right password', async () => {
  const c = new Client();
  for (let i = 0; i < 6; i++) assert.equal((await c.post('/api/auth', { a: 'login', username: 'locktest', password: 'wrong-pass-' + i })).status, 401);
  const r = await c.post('/api/auth', { a: 'login', username: 'locktest', password: 'wrong-pass-7' });
  assert.equal(r.status, 429);
  assert.ok(r.data.retry > 0 && r.data.retry <= 600);
  // the owner is not affected by somebody else's lock
  assert.equal((await new Client().post('/api/auth', { a: 'login', username: 'rami', password: 'owner-pass-1' })).status, 200);
});

test('saving: changes appear in the public list, with a new revision', async () => {
  const { p, base } = await product('freemax-rexa-pro');
  p.price = 39.5; p.options = ['Mint', 'Mango', 'Grape']; p.off = ['Mango', 'Not there']; p.note = '  New note ';
  p.isNew = true; p._hay = 'x';   // extra things the screen may carry must not be stored
  const r = await owner.post('/api/admin', { a: 'save', changes: [{ id: p.id, base, product: p }] });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.catalog.rev, 2);
  const pub = (await anon.get('/api/catalog')).data;
  const got = pub.products.find((x) => x.id === 'freemax-rexa-pro');
  assert.equal(got.price, 39.5);
  assert.deepEqual(got.options, ['Mint', 'Mango', 'Grape']);
  assert.deepEqual(got.off, ['Mango']);
  assert.equal(got.note, 'New note');
  assert.equal(got.u, 2);
  assert.ok(!('isNew' in got) && !('_hay' in got));
  assert.equal(pub.products.length, 44);
});

test('saving: marking a product sold out and back', async () => {
  let { p, base } = await product('airmez-20000');
  p.avail = false;
  assert.equal((await owner.post('/api/admin', { a: 'save', changes: [{ id: p.id, base, product: p }] })).status, 200);
  assert.equal((await anon.get('/api/catalog')).data.products.find((x) => x.id === 'airmez-20000').avail, false);
  ({ p, base } = await product('airmez-20000'));
  delete p.avail;
  assert.equal((await owner.post('/api/admin', { a: 'save', changes: [{ id: p.id, base, product: p }] })).status, 200);
  assert.ok(!('avail' in (await anon.get('/api/catalog')).data.products.find((x) => x.id === 'airmez-20000')));
});

test('saving: two admins editing the same product — the late one gets a conflict, nothing is lost', async () => {
  const a = await product('airmez-fox-120000');
  const b = await product('airmez-fox-120000');
  a.p.price = 10;
  assert.equal((await owner.post('/api/admin', { a: 'save', changes: [{ id: a.p.id, base: a.base, product: a.p }] })).status, 200);
  b.p.price = 99;
  const other = await product('airfuze-smart-40000');
  other.p.price = 7;
  const r = await owner.post('/api/admin', { a: 'save', changes: [{ id: b.p.id, base: b.base, product: b.p }, { id: other.p.id, base: other.base, product: other.p }] });
  assert.equal(r.status, 409);
  assert.deepEqual(r.data.ids, ['airmez-fox-120000']);
  const pub = (await anon.get('/api/catalog')).data;
  assert.equal(pub.products.find((x) => x.id === 'airmez-fox-120000').price, 10, 'the first save is kept');
  assert.notEqual(pub.products.find((x) => x.id === 'airfuze-smart-40000').price, 7, 'a conflicted save changes nothing');
  assert.equal(r.data.catalog.rev, pub.rev, 'the reply carries the newest list so the screen can catch up');
  // retrying only the product that did not conflict works
  assert.equal((await owner.post('/api/admin', { a: 'save', changes: [{ id: other.p.id, base: other.base, product: other.p }] })).status, 200);
});

test('saving: add a product, then delete it; unrelated products are untouched', async () => {
  const np = { id: 'p-abc123', name: 'Test Pod', nameAr: 'تجربة', cat: 'juices', sub: 'Freebase', img: '', glow: [10, 20, 30], price: null, specs: ['60 ml'], kind: 'flavor', options: ['A', 'B'] };
  const r = await owner.post('/api/admin', { a: 'save', changes: [{ id: np.id, base: null, product: np }] });
  assert.equal(r.status, 200);
  const found = r.data.catalog.products.find((x) => x.id === np.id);
  assert.equal(found.img, ''); assert.equal(found.nameAr, 'تجربة');
  assert.equal(r.data.catalog.products.length, 45);
  const dup = await owner.post('/api/admin', { a: 'save', changes: [{ id: np.id, base: null, product: np }] });
  assert.equal(dup.status, 409, 'a second "new" product with the same id is a conflict');
  const del = await owner.post('/api/admin', { a: 'save', changes: [{ id: np.id, base: found.u, product: null }] });
  assert.equal(del.status, 200);
  assert.equal(del.data.catalog.products.length, 44);
});

test('saving: bad data is rejected and nothing is stored', async () => {
  const base = (await product('airmez-20000'));
  const cases = [
    [{ cat: 'weapons' }, 'cat'], [{ sub: 'Nope', cat: 'puffs' }, 'sub'], [{ name: '   ' }, 'name'], [{ name: 'x'.repeat(121) }, 'name'],
    [{ img: 'https://evil.example/x.png' }, 'img'], [{ img: 'javascript:alert(1)' }, 'img'], [{ img: 'images/../../x.webp' }, 'img'],
    [{ glow: [300, 0, 0] }, 'glow'], [{ glow: [1, 2] }, 'glow'], [{ price: -1 }, 'price'], [{ price: '5' }, 'price'], [{ kind: 'weird' }, 'kind'],
    [{ options: 'Mint' }, 'options'], [{ options: Array(201).fill('a').map((x, i) => x + i) }, 'options'], [{ specs: [5] }, 'specs'], [{ note: 'n'.repeat(601) }, 'note'], [{ id: 'Bad Id!' }, 'id'],
  ];
  for (const [over, field] of cases) {
    const p = { ...base.p, ...over };
    const r = await owner.post('/api/admin', { a: 'save', changes: [{ id: over.id || base.p.id, base: base.base, product: p }] });
    assert.equal(r.status, 400, JSON.stringify(over));
    if (over.id === undefined) { assert.equal(r.data.error, 'bad_product'); assert.equal(r.data.field, field); }
  }
  assert.equal((await owner.post('/api/admin', { a: 'save', changes: [] })).status, 400);
  assert.equal((await owner.post('/api/admin', { a: 'save', changes: 'x' })).status, 400);
  assert.equal((await anon.get('/api/catalog')).data.products.find((x) => x.id === 'airmez-20000').name, base.p.name);
});

test('photos: real images are stored and served; everything else is refused', async () => {
  const r = await owner.post('/api/admin?a=photo', PNG);
  assert.equal(r.status, 200);
  assert.match(r.data.url, /^\/api\/photo\?i=[a-f0-9]{32}$/);
  const got = await anon.get(r.data.url);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get('content-type'), 'image/png');
  assert.match(got.headers.get('cache-control'), /immutable/);
  assert.deepEqual([...got.data], [...PNG]);
  const w = await owner.post('/api/admin?a=photo', WEBP);
  assert.equal((await anon.get(w.data.url)).headers.get('content-type'), 'image/webp');
  assert.equal((await owner.post('/api/admin?a=photo', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).status, 415);
  assert.equal((await owner.post('/api/admin?a=photo', new TextEncoder().encode('<html>'))).status, 415);
  assert.equal((await owner.post('/api/admin?a=photo', new Uint8Array(0))).status, 400);
  const big = new Uint8Array(2600000); big.set(PNG);
  assert.equal((await owner.post('/api/admin?a=photo', big)).status, 413);
  assert.equal((await anon.get('/api/photo?i=../../etc/passwd')).status, 404);
  assert.equal((await anon.get('/api/photo?i=' + 'a'.repeat(32))).status, 404);
  // a stored photo can be used by a product
  const { p, base } = await product('airmez-20000', { img: r.data.url });
  assert.equal((await owner.post('/api/admin', { a: 'save', changes: [{ id: p.id, base, product: p }] })).status, 200);
});

test('team: only the owner sees and changes the admin list', async () => {
  const t = await owner.get('/api/admin?a=team');
  assert.equal(t.status, 200);
  assert.deepEqual(t.data.team.map((x) => x.u), ['rami']);
  assert.ok(!JSON.stringify(t.data).includes('scrypt'));
  assert.equal((await anon.get('/api/admin?a=team')).status, 401);

  const bad = await owner.post('/api/admin', { a: 'addAdmin', username: 'a b', password: 'staff-pass-1' });
  assert.equal(bad.data.error, 'bad_username');
  assert.equal((await owner.post('/api/admin', { a: 'addAdmin', username: 'sara', password: '1234' })).data.error, 'weak_password');
  const add = await owner.post('/api/admin', { a: 'addAdmin', username: 'Sara', name: 'Sara (shop)', password: 'staff-pass-1' });
  assert.equal(add.status, 200);
  assert.deepEqual(add.data.team.map((x) => [x.u, x.role, x.name]), [['rami', 'owner', 'Rami'], ['sara', 'admin', 'Sara (shop)']]);
  assert.equal((await owner.post('/api/admin', { a: 'addAdmin', username: 'SARA', password: 'staff-pass-2' })).status, 409);
});

test('team: an admin can edit products but cannot manage admins', async () => {
  const sara = new Client();
  assert.equal((await sara.post('/api/auth', { a: 'login', username: 'sara', password: 'staff-pass-1' })).data.me.role, 'admin');
  assert.equal((await sara.get('/api/admin?a=catalog')).status, 200);
  const { p, base } = await product('airmez-20000');
  p.price = 12;
  assert.equal((await sara.post('/api/admin', { a: 'save', changes: [{ id: p.id, base, product: p }] })).status, 200);
  assert.equal((await sara.get('/api/admin?a=team')).status, 403);
  assert.equal((await sara.post('/api/admin', { a: 'addAdmin', username: 'evil', password: 'evil-pass-123' })).status, 403);
  assert.equal((await sara.post('/api/admin', { a: 'removeAdmin', username: 'rami' })).status, 403);
  assert.equal((await sara.post('/api/admin', { a: 'resetPw', username: 'rami', password: 'evil-pass-123' })).status, 403);
});

test('team: resetting a password signs that admin out everywhere; the new password works', async () => {
  const sara = new Client();
  await sara.post('/api/auth', { a: 'login', username: 'sara', password: 'staff-pass-1' });
  assert.equal((await sara.get('/api/admin?a=catalog')).status, 200);
  assert.equal((await owner.post('/api/admin', { a: 'resetPw', username: 'sara', password: 'weak' })).status, 400);
  assert.equal((await owner.post('/api/admin', { a: 'resetPw', username: 'sara', password: 'staff-pass-2' })).status, 200);
  assert.equal((await sara.get('/api/admin?a=catalog')).status, 401, 'old session is dead');
  assert.equal((await new Client().post('/api/auth', { a: 'login', username: 'sara', password: 'staff-pass-1' })).status, 401);
  assert.equal((await sara.post('/api/auth', { a: 'login', username: 'sara', password: 'staff-pass-2' })).status, 200);
  assert.equal((await owner.post('/api/admin', { a: 'resetPw', username: 'rami', password: 'owner-pass-9' })).status, 403, 'the owner changes their own password in My account');
  assert.equal((await owner.post('/api/admin', { a: 'resetPw', username: 'ghost', password: 'staff-pass-3' })).status, 404);
});

test('my account: change my own password (needs the current one); other devices are signed out', async () => {
  const sara = new Client(), phone = new Client();
  await sara.post('/api/auth', { a: 'login', username: 'sara', password: 'staff-pass-2' });
  await phone.post('/api/auth', { a: 'login', username: 'sara', password: 'staff-pass-2' });
  assert.equal((await sara.post('/api/admin', { a: 'changePw', current: 'wrong-wrong-1', password: 'staff-pass-3' })).status, 401);
  assert.equal((await sara.post('/api/admin', { a: 'changePw', current: 'staff-pass-2', password: 'tiny' })).status, 400);
  assert.equal((await sara.post('/api/admin', { a: 'changePw', current: 'staff-pass-2', password: 'staff-pass-3' })).status, 200);
  assert.equal((await sara.get('/api/admin?a=catalog')).status, 200, 'this device stays signed in');
  assert.equal((await phone.get('/api/admin?a=catalog')).status, 401, 'the other device is signed out');
  assert.equal((await new Client().post('/api/auth', { a: 'login', username: 'sara', password: 'staff-pass-2' })).status, 401);
  assert.equal((await new Client().post('/api/auth', { a: 'login', username: 'sara', password: 'staff-pass-3' })).status, 200);
});

test('team: removing an admin ends their access immediately; the owner cannot be removed', async () => {
  const sara = new Client();
  await sara.post('/api/auth', { a: 'login', username: 'sara', password: 'staff-pass-3' });
  assert.equal((await owner.post('/api/admin', { a: 'removeAdmin', username: 'rami' })).data.error, 'cannot_remove_self');
  assert.equal((await owner.post('/api/admin', { a: 'removeAdmin', username: 'ghost' })).status, 404);
  const r = await owner.post('/api/admin', { a: 'removeAdmin', username: 'sara' });
  assert.deepEqual(r.data.team.map((x) => x.u), ['rami']);
  assert.equal((await sara.get('/api/admin?a=catalog')).status, 401);
  assert.equal((await new Client().post('/api/auth', { a: 'login', username: 'sara', password: 'staff-pass-3' })).status, 401);
  // a removed name can be used again, and the new person does not inherit the old session
  await owner.post('/api/admin', { a: 'addAdmin', username: 'sara', password: 'staff-pass-4' });
  assert.equal((await sara.get('/api/admin?a=catalog')).status, 401, 'the removed person\'s old cookie does not work for the new account');
});

test('two saves at the same moment on different products both land', async () => {
  const a = await product('airmez-20000');
  const b = await product('airfuze-smart-40000');
  a.p.price = 21; b.p.price = 22;
  const [ra, rb] = await Promise.all([
    owner.post('/api/admin', { a: 'save', changes: [{ id: a.p.id, base: a.base, product: a.p }] }),
    owner.post('/api/admin', { a: 'save', changes: [{ id: b.p.id, base: b.base, product: b.p }] }),
  ]);
  assert.equal(ra.status, 200); assert.equal(rb.status, 200);
  const pub = (await anon.get('/api/catalog')).data;
  assert.equal(pub.products.find((x) => x.id === 'airmez-20000').price, 21);
  assert.equal(pub.products.find((x) => x.id === 'airfuze-smart-40000').price, 22);
});

test('the catalogue keeps working if storage breaks (built-in list is served)', async () => {
  const dir = process.env.KV_LOCAL_DIR;
  await fs.rename(dir + '/live/catalog.json', dir + '/live/catalog.json.bak');
  await fs.writeFile(dir + '/live/catalog.json', '{ not json');
  const r = await anon.get('/api/catalog');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-kv-source'), 'built-in');
  assert.equal(r.data.products.length, 44);
  await fs.rename(dir + '/live/catalog.json.bak', dir + '/live/catalog.json');
});
