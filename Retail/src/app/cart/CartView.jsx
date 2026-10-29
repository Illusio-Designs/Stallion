'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import '../../styles/cart.css';
import Glasses from '../../components/Glasses';
import { useCart, setQuantity, removeFromCart, MAX_PER_LINE } from '../../lib/cart';
import { rs } from '../../lib/format';

export function CartLine({ item }) {
  const stock = Number(item.stock) || 99;
  const cap = Math.min(stock, MAX_PER_LINE);
  const atMax = item.quantity >= cap;
  return (
    <div className="li">
      <Link href={item.slug ? `/shop/${item.slug}` : '/shop'} className="photo" aria-label={item.title}>
        {item.image ? <img src={item.image} alt="" loading="lazy" /> : <Glasses />}
      </Link>
      <div>
        <Link href={item.slug ? `/shop/${item.slug}` : '/shop'} className="li__name">{item.title}</Link>
        <div className="li__sub">{rs(item.price)} each</div>
        <div className="li__ctl">
          <div className="qty" role="group" aria-label={`Quantity for ${item.title}`}>
            <button type="button" aria-label="Decrease quantity" disabled={item.quantity <= 1} onClick={() => setQuantity(item.product_id, item.quantity - 1)}>&minus;</button>
            <output aria-live="polite">{item.quantity}</output>
            <button type="button" aria-label="Increase quantity" disabled={atMax} onClick={() => setQuantity(item.product_id, item.quantity + 1)}>+</button>
          </div>
          <button type="button" className="lnk" onClick={() => removeFromCart(item.product_id)} aria-label={`Remove ${item.title} from cart`}>Remove</button>
        </div>
        {atMax && stock < 99 ? <div className="stock-note">{stock <= MAX_PER_LINE ? `Only ${stock} available` : `Up to ${MAX_PER_LINE} per order`}</div> : null}
      </div>
      <b className="li__price">{rs(item.quantity * Number(item.price || 0))}</b>
    </div>
  );
}

export default function CartView() {
  const { items, count, subtotal } = useCart();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) {
    return <div className="wrap pg"><h1 className="pg__h">Your cart</h1><div className="skel" aria-hidden="true" /></div>;
  }
  if (items.length === 0) {
    return (
      <div className="wrap pg">
        <h1 className="pg__h">Your cart</h1>
        <div className="box empty">
          <Glasses />
          <h2 className="box__h">Your cart is empty</h2>
          <p>Pick a frame you like and it will wait for you here.</p>
          <Link href="/shop" className="btn btn--pri">Browse frames</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="wrap pg">
      <h1 className="pg__h">Your cart ({count})</h1>
      <div className="pg__lay">
        <div className="box" aria-label="Items in your cart">
          {items.map((it) => <CartLine key={it.product_id} item={it} />)}
        </div>
        <aside className="box sum pg__side" aria-label="Order summary">
          <h2 className="box__h">Order summary</h2>
          <div className="sum__r"><span>Items ({count})</span><span>{rs(subtotal)}</span></div>
          <div className="sum__r"><span>Shipping</span><span className="mute">At checkout</span></div>
          <div className="sum__r sum__r--t"><span>Total</span><span>{rs(subtotal)}</span></div>
          <Link href="/checkout" className="btn btn--pri">Go to checkout</Link>
          <Link href="/shop" className="btn">Keep shopping</Link>
          <p className="sum__note">Pay on delivery. Shipping is shown at checkout.</p>
        </aside>
      </div>
    </div>
  );
}
