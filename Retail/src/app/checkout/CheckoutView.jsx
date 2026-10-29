'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/cart.css';
import '../../styles/checkout.css';
import Glasses from '../../components/Glasses';
import { CartLine } from '../cart/CartView';
import { post, getClient } from '../../lib/api';
import { useCart, setQuantity, removeFromCart, clearCart } from '../../lib/cart';
import { rs } from '../../lib/format';
import { sessionId } from '../../lib/session';
import { STATES, cleanPhone, phoneOk, pincodeOk, emailOk, errorText, issuesFrom, readUtm, trackEvent, saveLastOrder, newKey, dayText } from '../../lib/shopflow';

const EMPTY = { name: '', phone: '', email: '', line1: '', line2: '', city: '', state: '', pincode: '', notes: '' };

function validate(v) {
  const e = {};
  if (v.name.trim().length < 2) e.name = 'Enter your full name.';
  if (!phoneOk(v.phone)) e.phone = 'Enter a 10 digit mobile number, for example 98765 43210.';
  if (v.email.trim() && !emailOk(v.email)) e.email = 'Enter a valid email address, or leave it empty.';
  if (v.line1.trim().length < 3) e.line1 = 'Enter your house number and street.';
  if (v.city.trim().length < 2) e.city = 'Enter your city or town.';
  if (!v.state) e.state = 'Choose your state.';
  if (!pincodeOk(v.pincode)) e.pincode = 'Enter a 6 digit pincode.';
  return e;
}

function Field({ id, label, error, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}><span>{label}</span></label>
      {children}
      {error ? <span id={`${id}-e`} className="err" role="alert">{error}</span> : hint ? <span id={`${id}-h`} className="co__hint">{hint}</span> : null}
    </div>
  );
}

export default function CheckoutView() {
  const router = useRouter();
  const { items, count, subtotal } = useCart();
  const [ready, setReady] = useState(false);
  const [v, setV] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [ship, setShip] = useState({ status: 'idle', data: null, error: '' });
  const [optId, setOptId] = useState('standard');
  const [quote, setQuote] = useState({ status: 'idle', data: null, error: '' });
  const [issues, setIssues] = useState([]);
  const [nonce, setNonce] = useState(0);
  const [stateList, setStateList] = useState(STATES);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [formError, setFormError] = useState('');
  const inflight = useRef(false);
  const key = useRef(null);
  const began = useRef(false);
  const shipSeq = useRef(0);
  const quoteSeq = useRef(0);

  useEffect(() => { setReady(true); key.current = newKey(); }, []);

  // The store's own list of states (same names as the shipping zones and the order check); the built-in list is the fallback.
  useEffect(() => {
    getClient('/states').then((res) => {
      const names = (Array.isArray(res.data) ? res.data : []).map((x) => (typeof x === 'string' ? x : x && x.name)).filter(Boolean);
      if (names.length) setStateList(names);
    }).catch(() => { /* keep the built-in list */ });
  }, []);

  const itemsKey = useMemo(() => items.map((x) => `${x.product_id}:${x.quantity}`).join(','), [items]);
  const pinValid = pincodeOk(v.pincode);
  const pin = pinValid ? v.pincode.trim() : '';
  const subtotalKey = Math.round(subtotal);
  const stateName = v.state || '';

  // begin_checkout, once, when the page opens with something in the cart.
  useEffect(() => {
    if (ready && items.length && !began.current) {
      began.current = true;
      trackEvent('begin_checkout', { value: subtotal });
    }
  }, [ready, items.length, subtotal]);

  // Delivery options for the pincode.
  const checkShipping = useCallback(async () => {
    if (!pinValid || !subtotalKey) { setShip({ status: 'idle', data: null, error: '' }); return; }
    const seq = ++shipSeq.current;
    setShip((s) => ({ ...s, status: 'loading', error: '' }));
    try {
      const res = await post('/shipping/check', { pincode: pin, subtotal: subtotalKey, ...(stateName ? { state: stateName } : {}) });
      if (seq !== shipSeq.current) return;
      const d = res.data || {};
      setShip({ status: 'ok', data: d, error: '' });
      const opts = d.options || [];
      setOptId((cur) => (opts.some((o) => o.id === cur) ? cur : (opts[0] && opts[0].id) || 'standard'));
    } catch (err) {
      if (seq !== shipSeq.current) return;
      setShip({ status: 'error', data: null, error: errorText(err, 'We could not check delivery for this pincode.') });
    }
  }, [pinValid, pin, subtotalKey, stateName]);
  useEffect(() => { const t = setTimeout(checkShipping, 250); return () => clearTimeout(t); }, [checkShipping]);

  // Live totals. Re-runs whenever the cart, pincode or delivery option changes.
  useEffect(() => {
    if (!ready || !items.length) return undefined;
    const seq = ++quoteSeq.current;
    const t = setTimeout(async () => {
      setQuote((q) => ({ ...q, status: 'loading', error: '' }));
      try {
        const res = await post('/checkout/quote', {
          items: items.map((x) => ({ product_id: x.product_id, quantity: x.quantity })),
          pincode: pin || undefined, state: stateName || undefined, shipping_option: optId, payment_type: 'cod',
        });
        if (seq !== quoteSeq.current) return;
        const d = res.data || {};
        setQuote({ status: 'ok', data: d, error: '' });
        setIssues(d.issues || []);
      } catch (err) {
        if (seq !== quoteSeq.current) return;
        const found = issuesFrom(err);
        if (found.length) { setIssues(found); setQuote((q) => ({ ...q, status: 'issues', error: '' })); return; }
        // Before a pincode is typed the server may refuse to price; that is not worth an error.
        setQuote((q) => ({ ...q, status: pin ? 'error' : 'idle', error: errorText(err, 'We could not update your totals.') }));
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, itemsKey, pin, stateName, optId, nonce]);

  const errors = validate(v);
  if (ship.status === 'ok' && ship.data && ship.data.serviceable === false && pinValid) errors.pincode = 'We do not deliver to this pincode yet. Try another one.';
  const show = (f) => (touched[f] || submitted) && errors[f];
  const set = (f) => (e) => { setV((s) => ({ ...s, [f]: e.target.value })); setFormError(''); };
  const blur = (f) => () => setTouched((t) => ({ ...t, [f]: true }));
  const aria = (f) => ({ 'aria-invalid': show(f) ? 'true' : undefined, 'aria-describedby': show(f) ? `${f}-e` : undefined, onBlur: blur(f) });

  const quoteOk = quote.status === 'ok' && quote.data;
  const qd = quote.data || {};
  const options = (ship.data && ship.data.options) || [];
  const chosen = options.find((o) => o.id === optId);
  const codBlocked = ship.status === 'ok' && ship.data && ship.data.cod_available === false;
  const totalsBusy = quote.status === 'loading';
  const shownSubtotal = quoteOk ? qd.subtotal : subtotal;
  const shipFee = quoteOk ? Number(qd.shipping_fee || 0) : chosen ? (chosen.free ? 0 : Number(chosen.charge || 0)) : null;
  const total = quoteOk ? qd.total : subtotal;

  // Cart items with the live stock limits from the last quote.
  const lines = items.map((it) => {
    const q = (qd.items || []).find((x) => x.product_id === it.product_id);
    const avail = q && q.available_stock != null ? Number(q.available_stock) : null;
    return avail != null ? { ...it, stock: Math.max(1, Math.min(Number(it.stock) || 99, avail)) } : it;
  });
  const issueOf = (id) => issues.find((i) => i.product_id === id);
  const fix = (issue) => {
    const q = (qd.items || []).find((x) => x.product_id === issue.product_id);
    const avail = q && q.available_stock != null ? Number(q.available_stock) : 0;
    if (issue.code === 'limited_stock' && avail > 0) setQuantity(issue.product_id, avail); else removeFromCart(issue.product_id);
    setIssues((list) => list.filter((i) => i !== issue));
  };

  const place = async (e) => {
    e.preventDefault();
    if (inflight.current) return;
    setFormError('');
    setSubmitted(true);
    if (Object.keys(errors).length) {
      setTimeout(() => { const el = document.querySelector('[aria-invalid="true"]'); if (el) el.focus(); }, 0);
      setFormError('Please fix the highlighted fields.');
      return;
    }
    if (!consent) { setFormError('Please tick the box to confirm you agree to the terms.'); return; }
    if (issues.length) { setFormError('Some items in your cart are no longer available as chosen. Fix them above to continue.'); return; }
    if (!quoteOk) { setFormError(quote.status === 'loading' ? 'Your totals are still updating. Try again in a moment.' : 'We could not update your totals yet. Use "Try again" below the summary.'); return; }
    if (codBlocked) { setFormError('Cash on delivery is not available for this pincode yet.'); return; }

    inflight.current = true;
    setBusy(true);
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), 8000);
    let done = false;
    try {
      const payload = {
        customer: { name: v.name.trim(), phone: cleanPhone(v.phone), ...(v.email.trim() ? { email: v.email.trim() } : {}) },
        address: { line1: v.line1.trim(), ...(v.line2.trim() ? { line2: v.line2.trim() } : {}), city: v.city.trim(), state: v.state, pincode: v.pincode.trim() },
        items: items.map((x) => ({ product_id: x.product_id, quantity: x.quantity })),
        shipping_option: optId,
        payment_type: 'cod',
        notes: v.notes.trim() || undefined,
        session_id: sessionId() || undefined,
        utm: readUtm(),
        client_key: key.current,
      };
      const res = await post('/checkout/orders', payload);
      const d = res.data || {};
      done = true;
      saveLastOrder({
        order_number: d.order_number, total: d.total != null ? d.total : total, status: d.status || 'pending', payment_type: 'cod',
        placed_at: new Date().toISOString(), customer: { name: payload.customer.name, phone: payload.customer.phone },
        address: payload.address, delivery: chosen ? { name: chosen.name, days_min: chosen.days_min, days_max: chosen.days_max, date: ship.data && ship.data.estimate_date } : null,
        items: (qd.items || items).map((x) => ({ title: x.title, image: x.image || null, quantity: x.quantity, price: x.price })),
        shipping_fee: qd.shipping_fee, cod_fee: qd.cod_fee, subtotal: qd.subtotal,
      });
      trackEvent('purchase', { value: d.total != null ? d.total : total });
      clearCart();
      router.push(`/order/${encodeURIComponent(d.order_number)}`);
    } catch (err) {
      const found = issuesFrom(err);
      if (err.status === 422 || found.length) {
        setIssues(found);
        setNonce((n) => n + 1);
        key.current = newKey();
        setFormError('Stock changed while you were checking out. Nothing was ordered. Fix the items below and place your order again.');
      } else {
        setFormError(`${errorText(err, 'We could not place your order.')} ${err.status == null || err.status >= 500 ? 'If you see this twice, check Track order before trying again so you do not order twice.' : ''}`.trim());
      }
    } finally {
      clearTimeout(slowTimer);
      if (!done) { inflight.current = false; setBusy(false); setSlow(false); }
    }
  };

  if (!ready) return <div className="wrap pg"><h1 className="pg__h">Checkout</h1><div className="skel" aria-hidden="true" /></div>;
  if (!items.length && !busy) {
    return (
      <div className="wrap pg">
        <h1 className="pg__h">Checkout</h1>
        <div className="box empty">
          <Glasses />
          <h2 className="box__h">Your cart is empty</h2>
          <p>Add a frame to your cart to check out.</p>
          <Link href="/shop" className="btn btn--pri">Browse frames</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="wrap pg" onSubmit={place} noValidate>
      <h1 className="pg__h">Checkout</h1>
      <div className="pg__lay">
        <div className="pg__main">
          <section className="box" aria-labelledby="co-items">
            <div className="row"><h2 className="box__h" id="co-items">Your items ({count})</h2><Link href="/cart" className="lnk">Edit cart</Link></div>
            {issues.length > 0 && (
              <div className="alert alert--bad" role="alert">
                <b>{issues.length === 1 ? 'One item needs your attention' : `${issues.length} items need your attention`}</b>
                <ul>
                  {issues.map((i) => {
                    const it = items.find((x) => x.product_id === i.product_id);
                    const q = (qd.items || []).find((x) => x.product_id === i.product_id);
                    const avail = q && q.available_stock != null ? Number(q.available_stock) : 0;
                    return (
                      <li key={`${i.product_id}-${i.code}`}>
                        <span>{it ? <b>{it.title}: </b> : null}{i.message || (i.code === 'out_of_stock' ? 'This frame is out of stock.' : i.code === 'limited_stock' ? 'Fewer pieces are available than you chose.' : 'This frame is no longer sold.')}</span>
                        <button type="button" className="btn btn--sm" onClick={() => fix(i)}>{i.code === 'limited_stock' && avail > 0 ? `Reduce to ${avail}` : 'Remove from cart'}</button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {lines.map((it) => (
              <div key={it.product_id} className={`co__li${issueOf(it.product_id) ? ' co__bad' : ''}`}><CartLine item={it} /></div>
            ))}
          </section>

          <section className="box" aria-labelledby="co-contact">
            <h2 className="box__h" id="co-contact">Contact details</h2>
            <div className="co__g2">
              <Field id="name" label="Full name" error={show('name')}>
                <input id="name" className="input" value={v.name} onChange={set('name')} autoComplete="name" {...aria('name')} />
              </Field>
              <Field id="phone" label="Mobile number" error={show('phone')} hint="We send order updates to this number.">
                <input id="phone" className="input" type="tel" inputMode="tel" value={v.phone} onChange={set('phone')} autoComplete="tel" {...aria('phone')} />
              </Field>
            </div>
            <Field id="email" label="Email (optional)" error={show('email')}>
              <input id="email" className="input" type="email" inputMode="email" value={v.email} onChange={set('email')} autoComplete="email" {...aria('email')} />
            </Field>
          </section>

          <section className="box" aria-labelledby="co-addr">
            <h2 className="box__h" id="co-addr">Delivery address</h2>
            <Field id="line1" label="House number and street" error={show('line1')}>
              <input id="line1" className="input" value={v.line1} onChange={set('line1')} autoComplete="address-line1" {...aria('line1')} />
            </Field>
            <Field id="line2" label="Area, landmark (optional)">
              <input id="line2" className="input" value={v.line2} onChange={set('line2')} autoComplete="address-line2" />
            </Field>
            <div className="co__g2">
              <Field id="pincode" label="Pincode" error={show('pincode')}>
                <input id="pincode" className="input" inputMode="numeric" maxLength={6} value={v.pincode} onChange={(e) => { setV((s) => ({ ...s, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })); setFormError(''); }} autoComplete="postal-code" {...aria('pincode')} />
              </Field>
              <Field id="city" label="City or town" error={show('city')}>
                <input id="city" className="input" value={v.city} onChange={set('city')} autoComplete="address-level2" {...aria('city')} />
              </Field>
            </div>
            <Field id="state" label="State" error={show('state')}>
              <select id="state" className="input" value={v.state} onChange={set('state')} autoComplete="address-level1" {...aria('state')}>
                <option value="">Choose a state</option>
                {stateList.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field id="notes" label="Delivery notes (optional)">
              <input id="notes" className="input" value={v.notes} onChange={set('notes')} maxLength={200} />
            </Field>
          </section>

          <section className="box" aria-labelledby="co-ship">
            <h2 className="box__h" id="co-ship">Delivery</h2>
            {!pinValid && <p className="mute">Enter your pincode to see delivery options.</p>}
            {pinValid && ship.status === 'loading' && !options.length && <p className="mute" role="status">Checking delivery for {pin}...</p>}
            {ship.status === 'error' && (
              <div className="alert alert--warn" role="alert"><span>{ship.error}</span><button type="button" className="btn btn--sm" onClick={checkShipping}>Try again</button></div>
            )}
            {ship.status === 'ok' && ship.data && ship.data.serviceable === false && <p className="err" role="alert">We do not deliver to {pin} yet.</p>}
            {pinValid && options.length > 0 && ship.data && ship.data.serviceable !== false && (
              <div className="co__opts" role="radiogroup" aria-labelledby="co-ship">
                {options.map((o) => (
                  <label key={o.id} className={`opt${optId === o.id ? ' opt--on' : ''}`}>
                    <input type="radio" name="ship" value={o.id} checked={optId === o.id} onChange={() => setOptId(o.id)} />
                    <span className="opt__t"><b>{o.name}</b><span className="mute">{o.days_min === o.days_max ? `${o.days_min} days` : `${o.days_min} to ${o.days_max} days`}</span></span>
                    <b className="opt__p">{o.free || !Number(o.charge) ? 'Free' : rs(o.charge)}</b>
                  </label>
                ))}
              </div>
            )}
            {ship.data && ship.data.estimate_date && chosen && <p className="mute">Estimated delivery by {dayText(ship.data.estimate_date)}.</p>}
          </section>

          <section className="box" aria-labelledby="co-pay">
            <h2 className="box__h" id="co-pay">Payment</h2>
            <div className="co__opts" role="radiogroup" aria-labelledby="co-pay">
              <label className="opt opt--on">
                <input type="radio" name="pay" value="cod" checked readOnly />
                <span className="opt__t"><b>Cash on delivery</b><span className="mute">Pay when your frames arrive.{Number(qd.cod_fee) > 0 ? ` A fee of ${rs(qd.cod_fee)} applies.` : ''}</span></span>
              </label>
              <label className="opt opt--off"><input type="radio" name="pay" disabled /><span className="opt__t"><b>UPI</b></span><span className="pill pill--n">Soon</span></label>
              <label className="opt opt--off"><input type="radio" name="pay" disabled /><span className="opt__t"><b>Card</b></span><span className="pill pill--n">Soon</span></label>
            </div>
            {codBlocked && <p className="err" role="alert">Cash on delivery is not available for this pincode yet.</p>}
          </section>
        </div>

        <aside className={`box sum pg__side${totalsBusy ? ' is-busy' : ''}`} aria-label="Order summary" aria-busy={totalsBusy}>
          <h2 className="box__h">Order summary</h2>
          <div className="sum__r"><span>Items ({count})</span><span>{rs(shownSubtotal)}</span></div>
          <div className="sum__r"><span>Shipping</span><span>{shipFee == null ? <span className="mute">Enter pincode</span> : shipFee === 0 ? 'Free' : rs(shipFee)}</span></div>
          {quoteOk && Number(qd.cod_fee) > 0 && <div className="sum__r"><span>Cash on delivery fee</span><span>{rs(qd.cod_fee)}</span></div>}
          <div className="sum__r sum__r--t"><span>Total</span><span>{rs(total)}</span></div>
          {quote.status === 'error' && (
            <div className="alert alert--warn" role="alert"><span>{quote.error}</span><button type="button" className="btn btn--sm" onClick={() => setNonce((n) => n + 1)}>Try again</button></div>
          )}
          <label className="co__consent">
            <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setFormError(''); }} />
            <span>I agree to the <Link href="/policies/terms" target="_blank">terms</Link> and the <Link href="/policies/returns" target="_blank">returns policy</Link>.</span>
          </label>
          {formError && <p className="err" role="alert">{formError}</p>}
          <button type="submit" className="btn btn--pri" disabled={busy || issues.length > 0}>{busy ? 'Placing your order...' : `Place order · ${rs(total)}`}</button>
          {slow && <p className="sum__note" role="status">This is taking longer than usual. Please keep this page open, we are still placing your order.</p>}
          <p className="sum__note">You will get an order number to track your delivery.</p>
        </aside>
      </div>
    </form>
  );
}
