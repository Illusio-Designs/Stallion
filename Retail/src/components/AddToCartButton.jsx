'use client';
import { useState } from 'react';
import { addToCart } from '../lib/cart';
import { sessionId } from '../lib/session';
import { post } from '../lib/api';

// Adds one piece (or `quantity`) to the cart and tells the tracker. `product` is a Card.
export default function AddToCartButton({ product, quantity = 1, label = 'Add to cart', className = '' }) {
  const [done, setDone] = useState(false);
  const click = () => {
    addToCart({ product_id: product.id, slug: product.slug, title: product.title || product.model_no, image: product.image || null, price: product.mrp, stock: product.stock }, quantity);
    setDone(true);
    setTimeout(() => setDone(false), 1600);
    post('/track/event', { session_id: sessionId(), type: 'add_to_cart', product_id: product.id, value: product.mrp }).catch(() => {});
  };
  return (
    <button type="button" className={`btn btn--pri ${className}`} onClick={click} disabled={product.stock <= 0}>
      {done ? 'Added' : label}
    </button>
  );
}
