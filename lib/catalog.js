// The product catalogue: reading it, checking what an admin sends, and saving changes safely.
import seed from './seed.json' with { type: 'json' };
import { CATS } from './cats.js';
import { readJson, writeJson, Conflict } from './store.js';
import { fail } from './http.js';

const MAX_PRODUCTS = 400;
const MAX_BYTES = 1500000;
const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const IMG = /^(images\/[A-Za-z0-9._-]{1,80}\.webp|\/api\/photo\?i=[a-f0-9]{32})$/;
const KINDS = ['flavor', 'color', 'combo'];

export const seedCatalog = () => ({ v: 2, rev: 1, products: structuredClone(seed.products) });

// Returns { cat, etag }. Until the first save there is no stored copy, so the built-in list is used (etag null).
export async function loadCatalog() {
  const doc = await readJson('catalog.json');
  return doc ? { cat: doc.data, etag: doc.etag } : { cat: seedCatalog(), etag: null };
}

export const publicCatalog = (cat) => ({ rev: cat.rev, products: cat.products });

function bad(id, field) {
  fail(400, 'bad_product', { id: typeof id === 'string' ? id.slice(0, 40) : null, field });
}

// Checks one product sent by the admin screen and returns a clean copy. Anything unexpected is rejected, not repaired.
export function sanitizeProduct(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) bad(null, 'product');
  const id = p.id;
  if (typeof id !== 'string' || !ID.test(id)) bad(id, 'id');
  const text = (k, max, required) => {
    const v = p[k] == null ? '' : p[k];
    if (typeof v !== 'string') bad(id, k);
    const s = v.replace(/\u0000/g, '').trim();
    if (s.length > max || (required && !s)) bad(id, k);
    return s;
  };
  const list = (k, maxItems, maxLen) => {
    const v = p[k] == null ? [] : p[k];
    if (!Array.isArray(v) || v.length > maxItems) bad(id, k);
    const seen = new Set();
    const out = [];
    for (const x of v) {
      if (typeof x !== 'string') bad(id, k);
      const s = x.replace(/\u0000/g, '').trim();
      if (s.length > maxLen) bad(id, k);
      if (s && !seen.has(s)) { seen.add(s); out.push(s); }
    }
    return out;
  };

  const out = { id, name: text('name', 120, true) };
  if (typeof p.cat !== 'string' || !Object.hasOwn(CATS, p.cat)) bad(id, 'cat');
  out.cat = p.cat;
  if (CATS[p.cat].length) {
    if (!CATS[p.cat].includes(p.sub)) bad(id, 'sub');
    out.sub = p.sub;
  } else out.sub = null;

  const img = p.img == null ? '' : p.img;
  if (typeof img !== 'string' || (img !== '' && !IMG.test(img))) bad(id, 'img');
  out.img = img;

  if (!Array.isArray(p.glow) || p.glow.length !== 3 || !p.glow.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) bad(id, 'glow');
  out.glow = p.glow.slice();

  if (p.price == null) out.price = null;
  else if (typeof p.price === 'number' && Number.isFinite(p.price) && p.price >= 0 && p.price <= 100000) out.price = Math.round(p.price * 100) / 100;
  else bad(id, 'price');

  out.specs = list('specs', 12, 60);
  if (!KINDS.includes(p.kind || 'flavor')) bad(id, 'kind');
  out.kind = p.kind || 'flavor';
  out.options = list('options', 200, 200);
  const off = list('off', 200, 200).filter((o) => out.options.includes(o));
  if (off.length) out.off = off;
  if (p.avail === false) out.avail = false;
  for (const [k, max] of [['nameAr', 120], ['note', 600], ['noteAr', 600]]) {
    const s = text(k, max, false);
    if (s) out[k] = s;
  }
  return out;
}

// changes: [{ id, base, product }]   product === null deletes.
// base is the version (`u`) of the product the admin started from: null for a brand-new product.
// A product somebody else changed in the meantime is left alone and reported back as a conflict.
export async function saveChanges(changes, username) {
  if (!Array.isArray(changes) || !changes.length || changes.length > 200) fail(400, 'bad_changes');
  const parsed = new Map();
  for (const ch of changes) {
    if (!ch || typeof ch !== 'object' || typeof ch.id !== 'string' || !ID.test(ch.id) || parsed.has(ch.id)) fail(400, 'bad_changes');
    if (ch.base != null && !Number.isInteger(ch.base)) fail(400, 'bad_changes');
    const product = ch.product === null ? null : sanitizeProduct(ch.product);
    if (product && product.id !== ch.id) fail(400, 'bad_changes');
    parsed.set(ch.id, { base: ch.base == null ? null : ch.base, product });
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const { cat, etag } = await loadCatalog();
    const list = cat.products.slice();
    const index = new Map(list.map((p, i) => [p.id, i]));
    const rev = cat.rev + 1;
    const conflicts = [];
    for (const [id, ch] of parsed) {
      const i = index.get(id);
      const cur = i === undefined ? null : list[i];
      if (ch.product === null) {
        if (!cur) continue;
        if ((cur.u || 0) > (ch.base || 0)) conflicts.push(id);
        else list[i] = null;
      } else if (cur) {
        if (ch.base === null || (cur.u || 0) > ch.base) conflicts.push(id);
        else list[i] = { ...ch.product, u: rev };
      } else if (ch.base !== null) conflicts.push(id);
      else list.push({ ...ch.product, u: rev });
    }
    if (conflicts.length) return { conflicts, catalog: publicCatalog(cat) };

    const products = list.filter(Boolean);
    if (products.length > MAX_PRODUCTS) fail(400, 'too_many');
    const next = { v: 2, rev, products, by: username, at: Date.now() };
    if (JSON.stringify(next).length > MAX_BYTES) fail(413, 'too_large');
    try {
      await writeJson('catalog.json', next, { etag });
      return { catalog: publicCatalog(next) };
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;   // someone saved at the same moment: look again and re-apply
    }
  }
  console.error('[kv] catalogue save gave up after repeated write conflicts');
  fail(503, 'busy');
}
