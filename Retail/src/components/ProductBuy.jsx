'use client';
import { useEffect, useRef, useState } from 'react';
import AddToCartButton from './AddToCartButton';
import { rs } from '../lib/format';
import { MAX_PER_LINE } from '../lib/cart';

// Quantity stepper (capped at stock) and the Add to cart button. On phones a sticky bar appears once the main button scrolls out of view.
export default function ProductBuy({ product }) {
  const stock = Number(product.stock) || 0;
  const cap = Math.min(stock, MAX_PER_LINE);
  const [qty, setQty] = useState(1);
  const [stuck, setStuck] = useState(false);
  const anchor = useRef(null);

  useEffect(() => {
    const el = anchor.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (stock <= 0) {
    return <div className="pd-buy"><button type="button" className="btn" disabled>Out of stock</button></div>;
  }
  const dec = () => setQty((q) => Math.max(1, q - 1));
  const inc = () => setQty((q) => Math.min(cap, q + 1));
  const total = rs(Number(product.mrp) * qty);

  return (
    <>
      <div className="pd-buy" ref={anchor}>
        <div className="pd-qty" role="group" aria-label="Quantity">
          <button type="button" onClick={dec} disabled={qty <= 1} aria-label="Decrease quantity">&minus;</button>
          <output aria-live="polite">{qty}</output>
          <button type="button" onClick={inc} disabled={qty >= cap} aria-label="Increase quantity">+</button>
        </div>
        <AddToCartButton product={product} quantity={qty} label={`Add to cart · ${total}`} className="pd-buy__add" />
      </div>
      {qty >= cap && cap > 1 ? <p className="pd-note mute">{cap < stock ? `You can order up to ${cap} of one frame. For more, contact us.` : 'That is all we have in stock.'}</p> : null}
      <div className={`pd-sticky${stuck ? ' is-on' : ''}`} inert={!stuck}>
        <div className="pd-sticky__in">
          <div className="pd-sticky__p"><b>{rs(product.mrp)}</b><span className="mute">MRP</span></div>
          <AddToCartButton product={product} quantity={qty} label="Add to cart" className="pd-sticky__btn" />
        </div>
      </div>
    </>
  );
}
