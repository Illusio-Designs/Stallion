'use client';
import { useEffect } from 'react';

// Registers /sw.js (offline page only) in production. Skipped in development so a stale
// worker never gets in the way of hot reload.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => { navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {}); };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return null;
}
