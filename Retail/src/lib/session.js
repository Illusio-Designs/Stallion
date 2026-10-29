'use client';
// One anonymous id per browser tab session for visit and funnel tracking.
export function sessionId() {
  try {
    let id = sessionStorage.getItem('stl-sid');
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); sessionStorage.setItem('stl-sid', id); }
    return id;
  } catch (_e) { return null; }
}
