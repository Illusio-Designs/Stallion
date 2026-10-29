// Small API client for the retail public API. Server components call get() with a revalidate time;
// client components call post() for forms and checkout.
const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '') + '/retail/public';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3400').replace(/\/+$/, '');

async function parse(res) {
  let body = null;
  try { body = await res.json(); } catch (_e) { /* empty body */ }
  if (!res.ok || (body && body.success === false)) {
    const err = new Error((body && body.message) || 'Something went wrong. Please try again.');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// GET for server components. Returns the full body ({ data, pagination }) or null when the API is not reachable.
export async function get(path, { revalidate = 60, fallback = null } = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
    return await parse(res);
  } catch (_e) {
    return fallback;
  }
}

export async function post(path, payload) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  return parse(res);
}

// Client-side GET (search suggestions, shipping check...).
export async function getClient(path) {
  const res = await fetch(`${BASE}${path}`);
  return parse(res);
}
