'use client';
import { useEffect, useState, useCallback } from 'react';

// The cart lives in the browser (localStorage). Items: { product_id, slug, title, image, price, quantity, stock }.
// Prices here are only for display; the server re-prices everything at checkout.
const KEY = 'stl-retail-cart';
const EVT = 'stl-cart-change';

export function readCart() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_e) { return []; }
}
function write(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (_e) { /* storage blocked */ }
  window.dispatchEvent(new Event(EVT));
}

export function addToCart(item, quantity = 1) {
  const items = readCart();
  const i = items.findIndex((x) => x.product_id === item.product_id);
  const max = item.stock != null ? Number(item.stock) : 99;
  if (i >= 0) items[i].quantity = Math.min(max, items[i].quantity + quantity);
  else items.push({ ...item, quantity: Math.min(max, quantity) });
  write(items);
}
export function setQuantity(product_id, quantity) {
  const items = readCart().map((x) => (x.product_id === product_id ? { ...x, quantity: Math.max(1, Math.min(Number(x.stock) || 99, quantity)) } : x));
  write(items);
}
export function removeFromCart(product_id) { write(readCart().filter((x) => x.product_id !== product_id)); }
export function clearCart() { write([]); }

export function useCart() {
  const [items, setItems] = useState([]);
  const refresh = useCallback(() => setItems(readCart()), []);
  useEffect(() => {
    refresh();
    window.addEventListener(EVT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(EVT, refresh); window.removeEventListener('storage', refresh); };
  }, [refresh]);
  const count = items.reduce((n, x) => n + x.quantity, 0);
  const subtotal = items.reduce((n, x) => n + x.quantity * Number(x.price || 0), 0);
  return { items, count, subtotal };
}
