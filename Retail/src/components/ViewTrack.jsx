'use client';
import { useEffect } from 'react';
import { post } from '../lib/api';
import { sessionId } from '../lib/session';

// Sends one view_item event per product view. Never blocks or breaks the page.
export default function ViewTrack({ productId, value }) {
  useEffect(() => {
    if (!productId) return;
    try {
      const k = `stl-view-${productId}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, '1');
    } catch (_e) { /* blocked: still send once for this mount */ }
    post('/track/event', { session_id: sessionId(), type: 'view_item', product_id: productId, value }).catch(() => {});
  }, [productId, value]);
  return null;
}
