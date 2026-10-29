'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import '../../../styles/cart.css';
import '../../../styles/checkout.css';
import Glasses from '../../../components/Glasses';
import { rs } from '../../../lib/format';
import { readLastOrder, dayText } from '../../../lib/shopflow';

export default function OrderView({ number }) {
  const [ready, setReady] = useState(false);
  const [o, setO] = useState(null);
  useEffect(() => { setO(readLastOrder(number)); setReady(true); }, [number]);

  const first = o && o.customer && o.customer.name ? o.customer.name.split(' ')[0] : '';
  const a = o && o.address;
  const d = o && o.delivery;
  return (
    <div className="wrap pg">
      <div className="ok">
        <div className="box ok__top">
          <span className="ok__tick" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <h1 className="pg__h">{first ? `Thank you, ${first}` : 'Thank you for your order'}</h1>
          <p className="mute">Your order is placed. Keep this number to track it.</p>
          <div className="eyebrow">Order number</div>
          <div className="ok__no">{number}</div>
          {o && o.total != null && <p>Total to pay on delivery: <b>{rs(o.total)}</b></p>}
        </div>

        {ready && o && (
          <div className="box" aria-label="Order summary">
            <h2 className="box__h">Summary</h2>
            {(o.items || []).map((it, i) => (
              <div className="li li--sm" key={i}>
                <div className="photo">{it.image ? <img src={it.image} alt="" loading="lazy" /> : <Glasses />}</div>
                <div><b className="li__name">{it.title}</b><div className="li__sub">Qty {it.quantity}</div></div>
                <b className="li__price">{rs(it.quantity * Number(it.price || 0))}</b>
              </div>
            ))}
            <div className="sum">
              {o.subtotal != null && <div className="sum__r"><span>Items</span><span>{rs(o.subtotal)}</span></div>}
              {o.shipping_fee != null && <div className="sum__r"><span>Shipping</span><span>{Number(o.shipping_fee) ? rs(o.shipping_fee) : 'Free'}</span></div>}
              {Number(o.cod_fee) > 0 && <div className="sum__r"><span>Cash on delivery fee</span><span>{rs(o.cod_fee)}</span></div>}
              <div className="sum__r sum__r--t"><span>Total</span><span>{rs(o.total)}</span></div>
            </div>
            {a && <p className="ok__addr">Delivering to {[a.line1, a.line2, a.city, a.state].filter(Boolean).join(', ')} - {a.pincode}</p>}
            {d && <p className="ok__addr">{d.name}{d.date ? `, expected by ${dayText(d.date)}` : d.days_min ? `, ${d.days_min} to ${d.days_max} days` : ''}. Payment: cash on delivery.</p>}
          </div>
        )}

        <div className="box">
          <h2 className="box__h">What happens next</h2>
          <ol className="ok__steps">
            <li><div><b>We confirm your order</b><span>Updates go to {o && o.customer ? o.customer.phone : 'the phone number you gave us'}.</span></div></li>
            <li><div><b>We pack and ship it</b><span>You get the courier name and tracking number on the Track page.</span></div></li>
            <li><div><b>Pay when it arrives</b><span>Keep the amount ready for the delivery person.</span></div></li>
          </ol>
        </div>

        <div className="ok__act">
          <Link href={`/track?order=${encodeURIComponent(number)}`} className="btn btn--pri">Track this order</Link>
          <Link href="/shop" className="btn">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
