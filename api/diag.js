// TEMPORARY diagnostic (branch "diag" only, never merged): exercises the real Blob conditional-write calls under preview/ scratch keys.
import { readFileSync } from 'node:fs';
import { PREFIX, readJson, writeJson } from '../lib/store.js';

const err = (e) => ({ name: e && e.name, message: String(e && e.message).slice(0, 300), ctor: e && e.constructor && e.constructor.name });

export default {
  fetch: async () => {
    const out = { prefix: PREFIX, steps: [] };
    const step = async (label, fn) => { try { out.steps.push({ label, ok: await fn() }); } catch (e) { out.steps.push({ label, error: err(e) }); } };
    try { out.sdk = JSON.parse(readFileSync(new URL('../node_modules/@vercel/blob/package.json', import.meta.url), 'utf8')).version; } catch (e) { out.sdk = 'unknown: ' + e.message; }
    const sdk = await import('@vercel/blob');
    const key = PREFIX + 'diag/test.json';
    const big = (n) => JSON.stringify({ n, pad: 'x'.repeat(60000) });

    await step('raw create-only put', async () => { const r = await sdk.put(key, big(1), { access: 'private', contentType: 'application/json', allowOverwrite: false, addRandomSuffix: false }); return { etag: r.etag, keys: Object.keys(r) }; });
    await step('raw create-only put again (expect exists error)', async () => { const r = await sdk.put(key, big(2), { access: 'private', contentType: 'application/json', allowOverwrite: false, addRandomSuffix: false }); return { etag: r.etag }; });
    let g;
    await step('raw get', async () => { g = await sdk.get(key, { access: 'private', useCache: false }); return { status: g.statusCode, etag: g.blob.etag, blobKeys: Object.keys(g.blob) }; });
    await step('raw put ifMatch=get.etag', async () => { const r = await sdk.put(key, big(3), { access: 'private', contentType: 'application/json', allowOverwrite: true, ifMatch: g.blob.etag, addRandomSuffix: false }); return { etag: r.etag }; });
    await step('raw put ifMatch=stale (expect precondition error)', async () => { const r = await sdk.put(key, big(4), { access: 'private', contentType: 'application/json', allowOverwrite: true, ifMatch: g.blob.etag, addRandomSuffix: false }); return { etag: r.etag }; });
    let h;
    await step('raw head', async () => { h = await sdk.head(key); return { etag: h.etag, keys: Object.keys(h) }; });
    await step('raw put ifMatch=head.etag', async () => { const r = await sdk.put(key, big(5), { access: 'private', contentType: 'application/json', allowOverwrite: true, ifMatch: h.etag, addRandomSuffix: false }); return { etag: r.etag }; });
    await step('raw put ifMatch + cacheControlMaxAge', async () => { const g2 = await sdk.get(key, { access: 'private', useCache: false }); const r = await sdk.put(key, big(6), { access: 'private', contentType: 'application/json', allowOverwrite: true, ifMatch: g2.blob.etag, addRandomSuffix: false, cacheControlMaxAge: 60 }); return { etag: r.etag }; });

    // the app's own wrappers, as the save path uses them
    const name = 'diag/app.json';
    await step('app readJson (missing)', async () => { const r = await readJson(name); return r === null ? 'null' : 'exists'; });
    await step('app writeJson create-only', async () => (await writeJson(name, { n: 1 }, { etag: null })).etag);
    let e1;
    await step('app readJson', async () => { const r = await readJson(name); e1 = r.etag; return e1; });
    await step('app writeJson with etag', async () => (await writeJson(name, { n: 2 }, { etag: e1 })).etag);
    await step('app writeJson with stale etag (expect Conflict)', async () => (await writeJson(name, { n: 3 }, { etag: e1 })).etag);
    return new Response(JSON.stringify(out, null, 1), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  },
};
