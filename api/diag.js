// TEMPORARY diagnostic (branch "diag" only, never merged): checks the fixed read-modify-write cycle with a large, compressible file, then cleans up.
import { PREFIX, readJson, writeJson } from '../lib/store.js';

const err = (e) => ({ name: e && e.name, message: String(e && e.message).slice(0, 300) });

export default {
  fetch: async () => {
    const out = { prefix: PREFIX, steps: [] };
    const step = async (label, fn) => { try { out.steps.push({ label, ok: await fn() }); } catch (e) { out.steps.push({ label, error: err(e) }); } };
    const sdk = await import('@vercel/blob');
    const name = 'diag/big.json';
    const big = (n) => ({ n, pad: 'x'.repeat(60000) });
    await step('create-only write (big)', async () => (await writeJson(name, big(0), { etag: null })).etag);
    for (let i = 1; i <= 4; i++) {
      await step('cycle ' + i + ': readJson then writeJson with its etag', async () => {
        const r = await readJson(name);
        const w = await writeJson(name, big(i), { etag: r.etag });
        return { readEtag: r.etag, wroteEtag: w.etag, hadN: r.data.n };
      });
    }
    await step('stale etag is still refused', async () => { const r = await readJson(name); await writeJson(name, big(98), { etag: r.etag }); await writeJson(name, big(99), { etag: r.etag }); return 'NOT refused'; });
    for (const key of ['diag/big.json', 'diag/app.json', 'diag/test.json']) await step('cleanup ' + key, async () => { await sdk.del(PREFIX + key); return 'deleted'; });
    return new Response(JSON.stringify(out, null, 1), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  },
};
