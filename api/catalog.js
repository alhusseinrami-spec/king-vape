// Public: the current product list. Customers' pages load this, so a stock change shows up within a few seconds.
import { handle, json } from '../lib/http.js';
import { loadCatalog, publicCatalog, seedCatalog } from '../lib/catalog.js';

// Browsers must always ask again (so an admin who saves and reloads sees the new list at once); only Vercel's own cache
// may keep a copy for a few seconds, through the header that is meant for it and is not passed on to the browser.
const FRESH = { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Vercel-CDN-Cache-Control': 'max-age=10, stale-while-revalidate=50' };
const FALLBACK = { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Vercel-CDN-Cache-Control': 'max-age=5', 'X-KV-Source': 'built-in' };

export default {
  fetch: handle(async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method' }, 405);
    try {
      const { cat } = await loadCatalog();
      return json(publicCatalog(cat), 200, FRESH);
    } catch (e) {
      // If storage is unreachable the shop keeps working with the built-in list.
      console.error('[kv] catalogue unavailable, serving the built-in list:', e && e.message);
      return json(publicCatalog(seedCatalog()), 200, FALLBACK);
    }
  }),
};
