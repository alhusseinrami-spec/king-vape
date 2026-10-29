// Public: a photo uploaded through the admin screen (the original 44 photos are plain files in /images).
import { handle, json } from '../lib/http.js';
import { readBinary } from '../lib/store.js';

export default {
  fetch: handle(async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method' }, 405);
    const id = new URL(request.url).searchParams.get('i') || '';
    if (!/^[a-f0-9]{32}$/.test(id)) return json({ error: 'not_found' }, 404);
    const r = await readBinary('img/' + id);
    if (!r) return json({ error: 'not_found' }, 404);
    return new Response(r.buf, {
      headers: {
        'Content-Type': r.contentType,
        // The name is made from the photo's content, so a given address never changes: safe to keep for a year.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
      },
    });
  }),
};
