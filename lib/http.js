// Small helpers shared by every API function: JSON replies, errors, cookies, request guards.

export class HttpError extends Error {
  constructor(status, code, extra) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra || {};
  }
}

export function fail(status, code, extra) {
  throw new HttpError(status, code, extra);
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

// Wraps a handler so that a thrown HttpError becomes a clean JSON reply and anything else becomes a plain 500
// (the details go to the runtime log, never to the visitor).
export function handle(fn) {
  return async (request) => {
    try {
      return await fn(request);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, ...e.extra }, e.status);
      console.error('[kv] unhandled error:', e && e.stack ? e.stack : e);
      return json({ error: 'server_error' }, 500);
    }
  };
}

export async function readBody(request, limit) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > limit) fail(413, 'too_large');
  const buf = new Uint8Array(await request.arrayBuffer());
  if (buf.length > limit) fail(413, 'too_large');
  return buf;
}

export async function jsonBody(request, limit = 262144) {
  const buf = await readBody(request, limit);
  let v;
  try {
    v = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    fail(400, 'bad_json');
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(400, 'bad_json');
  return v;
}

export function parseCookies(request) {
  const out = {};
  for (const part of (request.headers.get('cookie') || '').split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0) {
      try {
        out[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
      } catch {
        /* ignore a malformed cookie */
      }
    }
  }
  return out;
}

export function isSecure(request) {
  return new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
}

export function cookieHeader(request, name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}` + (isSecure(request) ? '; Secure' : '');
}

// Every request that changes something must come from this site's own page (custom header + matching Origin).
// The session cookie is also SameSite=Strict, so a page on another site can neither send the cookie nor this header.
export function guard(request) {
  let ok = request.headers.get('x-kv') === '1';
  const origin = request.headers.get('origin');
  if (ok && origin) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;
    try {
      ok = new URL(origin).host === host;
    } catch {
      ok = false;
    }
  }
  if (!ok) fail(403, 'csrf');
}

export function clientIp(request) {
  const xf = request.headers.get('x-forwarded-for');
  return (xf ? xf.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown').slice(0, 64);
}
