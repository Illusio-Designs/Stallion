'use client';
// Helpers shared by the cart, checkout, confirmation and track pages.
import { post } from './api';
import { sessionId } from './session';

export const STATES = ['Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

// Readable text for any failed request: no network, rate limit, server trouble or a message from the API.
export function errorText(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (err.status == null) return 'We could not reach the store. Check your internet connection and try again.';
  if (err.status === 429) return 'Too many tries in a short time. Please wait a minute and try again.';
  if (err.status >= 500) return 'The store is having trouble right now. Please try again in a moment.';
  return err.message || fallback;
}

// Stock issues can come back as body.issues or body.data.issues.
export function issuesFrom(err) {
  const b = err && err.body;
  const list = (b && (b.issues || (b.data && b.data.issues))) || [];
  return Array.isArray(list) ? list : [];
}

export const cleanPhone = (v) => {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
};
export const phoneOk = (v) => /^[6-9]\d{9}$/.test(cleanPhone(v));
export const pincodeOk = (v) => /^[1-9]\d{5}$/.test(String(v || '').trim());
export const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

// Campaign params saved earlier in sessionStorage (key stl-utm); falls back to the address bar.
export function readUtm() {
  const out = {};
  const take = (get) => { ['source', 'medium', 'campaign', 'term', 'content'].forEach((k) => { const v = get(k); if (v && !out[k]) out[k] = String(v).slice(0, 120); }); };
  try {
    const saved = JSON.parse(sessionStorage.getItem('stl-utm') || 'null');
    if (saved && typeof saved === 'object') take((k) => saved[k] || saved[`utm_${k}`]);
  } catch (_e) { /* blocked or bad json */ }
  try { const q = new URLSearchParams(window.location.search); take((k) => q.get(`utm_${k}`)); } catch (_e) { /* no window */ }
  return Object.keys(out).length ? out : undefined;
}

// Funnel event. Never throws, never blocks the page.
export function trackEvent(type, extra = {}) {
  try { post('/track/event', { session_id: sessionId(), type, ...extra }).catch(() => {}); } catch (_e) { /* ignore */ }
}

const LAST = 'stl-last-order';
export function saveLastOrder(o) { try { sessionStorage.setItem(LAST, JSON.stringify(o)); } catch (_e) { /* blocked */ } }
export function readLastOrder(number) {
  try {
    const o = JSON.parse(sessionStorage.getItem(LAST) || 'null');
    if (o && (!number || String(o.order_number) === String(number))) return o;
  } catch (_e) { /* blocked */ }
  return null;
}

export const newKey = () => {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (_e) { /* old browser */ }
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
};

export const whenText = (d) => {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return String(d || '');
  return t.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};
export const dayText = (d) => {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return String(d || '');
  return t.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};
