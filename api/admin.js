// Everything an admin can do. Every request needs a valid sign-in; adding and removing admins is for the owner only.
//   GET  ?a=catalog                      the newest product list, for editing
//   GET  ?a=team                         (owner) the admin list
//   POST ?a=photo   (image body)         store a product photo, returns its address
//   POST {a:'save', changes:[...]}       save product changes
//   POST {a:'addAdmin' | 'resetPw' | 'removeAdmin', ...}   (owner)
//   POST {a:'changePw', current, password}                 change my own password
import { handle, json, fail, guard, jsonBody, readBody } from '../lib/http.js';
import {
  hashPassword, verifyPassword, checkPassword, checkUsername, normUser, cleanName,
  requireAdmin, requireOwner, changeAdmins, sessionCookie, view, newTv, throttleKeys, lockedFor, noteFailure, noteSuccess,
} from '../lib/auth.js';
import { loadCatalog, publicCatalog, saveChanges } from '../lib/catalog.js';
import { savePhoto, MAX_PHOTO } from '../lib/photo.js';

const team = (admins) => admins.map(view);

async function addAdmin(request, b) {
  const { admin: me } = await requireOwner(request);
  const username = normUser(b.username);
  checkUsername(username);
  checkPassword(b.password, username);
  const pw = await hashPassword(b.password);
  const { next } = await changeAdmins((doc) => {
    if (doc.admins.length >= 25) fail(400, 'too_many_admins');
    if (doc.admins.some((a) => a.u === username)) fail(409, 'name_taken');
    doc.admins.push({ u: username, name: cleanName(b.name, username), role: 'admin', pw, tv: newTv(), created: Date.now(), by: me.u });
  });
  return json({ team: team(next.admins) });
}

async function resetPw(request, b) {
  await requireOwner(request);
  const username = normUser(b.username);
  checkPassword(b.password, username);
  const pw = await hashPassword(b.password);
  const { next } = await changeAdmins((doc) => {
    const a = doc.admins.find((x) => x.u === username);
    if (!a) fail(404, 'no_such_admin');
    if (a.role === 'owner') fail(403, 'owner_only');   // the owner changes their own password in "My account"
    a.pw = pw;
    a.tv = newTv();   // signs that admin out everywhere
  });
  return json({ team: team(next.admins) });
}

async function removeAdmin(request, b) {
  const { admin: me } = await requireOwner(request);
  const username = normUser(b.username);
  if (username === me.u) fail(400, 'cannot_remove_self');
  const { next } = await changeAdmins((doc) => {
    const i = doc.admins.findIndex((x) => x.u === username);
    if (i < 0) fail(404, 'no_such_admin');
    if (doc.admins[i].role === 'owner') fail(403, 'owner_only');
    doc.admins.splice(i, 1);
  });
  return json({ team: team(next.admins) });
}

async function changePw(request, b) {
  const { admin: me } = await requireAdmin(request);
  const keys = throttleKeys(request, me.u);
  const wait = await lockedFor(keys);
  if (wait) fail(429, 'locked', { retry: wait });
  if (typeof b.current !== 'string' || !(await verifyPassword(b.current, me.pw))) {
    await noteFailure(keys);
    fail(401, 'bad_login');
  }
  checkPassword(b.password, me.u);
  const pw = await hashPassword(b.password);
  const { next } = await changeAdmins((doc) => {
    const a = doc.admins.find((x) => x.u === me.u);
    if (!a) fail(401, 'signed_out');
    a.pw = pw;
    a.tv = newTv();   // every other device is signed out; this one gets a fresh cookie below
  });
  await noteSuccess(keys);
  const updated = next.admins.find((x) => x.u === me.u);
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, updated) });
}

export default {
  fetch: handle(async (request) => {
    const url = new URL(request.url);
    const a = url.searchParams.get('a');

    if (request.method === 'GET') {
      if (a === 'catalog') {
        await requireAdmin(request);
        const { cat } = await loadCatalog();
        return json(publicCatalog(cat));
      }
      if (a === 'team') {
        const { doc } = await requireOwner(request);
        return json({ team: team(doc.data.admins) });
      }
      return fail(400, 'bad_action');
    }

    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    guard(request);

    if (a === 'photo') {
      await requireAdmin(request);
      const buf = await readBody(request, MAX_PHOTO);
      return json(await savePhoto(buf));
    }

    const b = await jsonBody(request, 1200000);
    if (b.a === 'save') {
      const { admin } = await requireAdmin(request);
      const r = await saveChanges(b.changes, admin.u);
      return r.conflicts ? json({ error: 'conflict', ids: r.conflicts, catalog: r.catalog }, 409) : json({ catalog: r.catalog });
    }
    if (b.a === 'addAdmin') return addAdmin(request, b);
    if (b.a === 'resetPw') return resetPw(request, b);
    if (b.a === 'removeAdmin') return removeAdmin(request, b);
    if (b.a === 'changePw') return changePw(request, b);
    return fail(400, 'bad_action');
  }),
};
