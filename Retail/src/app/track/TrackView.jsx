'use client';
import { useEffect, useRef, useState } from 'react';
import '../../styles/cart.css';
import '../../styles/track.css';
import Glasses from '../../components/Glasses';
import { post } from '../../lib/api';
import { rs } from '../../lib/format';
import { cleanPhone, phoneOk, errorText, readLastOrder, whenText, dayText } from '../../lib/shopflow';

const STEPS = [['pending', 'Placed'], ['confirmed', 'Confirmed'], ['packed', 'Packed'], ['dispatched', 'Dispatched'], ['out_for_delivery', 'Out for delivery'], ['delivered', 'Delivered']];
const LABEL = { pending: 'Placed', confirmed: 'Confirmed', packed: 'Packed', dispatched: 'Dispatched', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned' };
const label = (s) => LABEL[s] || (s ? String(s).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '');
const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

function Result({ r }) {
  const idx = STEPS.findIndex(([k]) => k === r.status);
  const side = r.status === 'cancelled' || r.status === 'returned';
  const sh = r.shipment || {};
  const url = safeUrl(sh.tracking_url);
  const timeline = [...(r.timeline || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
  const a = r.address || {};
  const addr = typeof a === 'string' ? a : [a.city, a.state, a.pincode].filter(Boolean).join(', ');
  return (
    <section className="box" aria-label={`Order ${r.order_number}`}>
      <div className="row">
        <b className="trk__no">{r.order_number}</b>
        <span className={`pill ${r.status === 'delivered' ? '' : side ? 'pill--bad' : 'pill--n'}`}>{label(r.status)}</span>
      </div>

      {side ? (
        <p className="trk__bad">{r.status === 'cancelled' ? 'This order was cancelled.' : 'This order was returned.'} If you did not expect this, contact us.</p>
      ) : (
        <ol className="steps" aria-label="Order progress">
          {STEPS.map(([k, t], i) => (
            <li key={k} className={i < idx ? 'is-done' : i === idx ? 'is-now' : ''} aria-current={i === idx ? 'step' : undefined}>
              <i aria-hidden="true">{i <= idx ? '✓' : i + 1}</i>{t}
            </li>
          ))}
        </ol>
      )}

      {(sh.courier || sh.awb || url) && (
        <div className="row trk__ship">
          <span className="mute">
            {sh.courier ? <>Courier: <b>{sh.courier}</b></> : 'Courier assigned'}
            {sh.awb ? <> &middot; AWB <b>{sh.awb}</b></> : null}
          </span>
          {url && <a className="btn btn--sm" href={url} target="_blank" rel="noopener noreferrer">Open courier link</a>}
        </div>
      )}
      {r.expected_delivery && !side && r.status !== 'delivered' && <p className="mute">Expected delivery: <b>{dayText(r.expected_delivery)}</b></p>}

      {timeline.length > 0 && (
        <div className="trk__tl">
          <h3 className="box__h2">Updates</h3>
          <ul>
            {timeline.map((t, i) => (
              <li key={`${t.at}-${i}`}>
                <span className="mute trk__when">{whenText(t.at)}</span>
                <span><b>{label(t.status)}</b>{t.note ? ` · ${t.note}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(r.items || []).length > 0 && (
        <div className="trk__items">
          <h3 className="box__h2">Items</h3>
          {r.items.map((it, i) => (
            <div className="li li--sm" key={i}>
              <div className="photo">{it.image ? <img src={it.image} alt="" loading="lazy" /> : <Glasses />}</div>
              <div><b className="li__name">{it.title || it.model_no || 'Frame'}</b><div className="li__sub">Qty {it.quantity}</div></div>
              {it.price != null && <b className="li__price">{rs(Number(it.price) * Number(it.quantity || 1))}</b>}
            </div>
          ))}
        </div>
      )}

      <div className="sum">
        <div className="sum__r sum__r--t"><span>Total{r.payment_type === 'cod' ? ' (pay on delivery)' : ''}</span><span>{rs(r.total)}</span></div>
      </div>
      <p className="mute trk__meta">Placed {r.created_at ? whenText(r.created_at) : ''}{addr ? ` · Delivering to ${addr}` : ''}</p>
    </section>
  );
}

export default function TrackView() {
  const [num, setNum] = useState('');
  const [phone, setPhone] = useState('');
  const [errs, setErrs] = useState({});
  const [state, setState] = useState({ status: 'idle', data: null, error: '' });
  const busy = useRef(false);

  useEffect(() => {
    let n = '';
    try { n = new URLSearchParams(window.location.search).get('order') || ''; } catch (_e) { /* no window */ }
    if (n) {
      setNum(n);
      const last = readLastOrder(n);
      if (last && last.customer && last.customer.phone) setPhone(last.customer.phone);
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (busy.current) return;
    const er = {};
    if (!num.trim()) er.num = 'Enter the order number from your confirmation.';
    if (!phoneOk(phone)) er.phone = 'Enter the 10 digit mobile number you used for the order.';
    setErrs(er);
    if (Object.keys(er).length) { setTimeout(() => { const el = document.querySelector('[aria-invalid="true"]'); if (el) el.focus(); }, 0); return; }
    busy.current = true;
    setState({ status: 'loading', data: null, error: '' });
    try {
      const res = await post('/orders/track', { order_number: num.trim(), phone: cleanPhone(phone) });
      setState({ status: 'ok', data: res.data, error: '' });
    } catch (err) {
      setState({ status: 'error', data: null, error: err.status === 404 ? 'We could not find an order with that number and phone. Check both and try again.' : errorText(err, 'We could not look up your order.') });
    } finally { busy.current = false; }
  };

  return (
    <div className="wrap pg">
      <div className="trk">
        <h1 className="pg__h">Track your order</h1>
        <p className="mute">Enter the order number from your confirmation and the phone number you used.</p>
        <form className="box" onSubmit={submit} noValidate>
          <div className="trk__g">
            <div className="field">
              <label htmlFor="t-num"><span>Order number</span></label>
              <input id="t-num" className="input" value={num} onChange={(e) => setNum(e.target.value)} autoCapitalize="characters" autoComplete="off" aria-invalid={errs.num ? 'true' : undefined} aria-describedby={errs.num ? 't-num-e' : undefined} />
              {errs.num && <span id="t-num-e" className="err" role="alert">{errs.num}</span>}
            </div>
            <div className="field">
              <label htmlFor="t-phone"><span>Phone</span></label>
              <input id="t-phone" className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" aria-invalid={errs.phone ? 'true' : undefined} aria-describedby={errs.phone ? 't-phone-e' : undefined} />
              {errs.phone && <span id="t-phone-e" className="err" role="alert">{errs.phone}</span>}
            </div>
          </div>
          <button type="submit" className="btn btn--pri trk__go" disabled={state.status === 'loading'}>{state.status === 'loading' ? 'Looking up...' : 'Track'}</button>
          {state.status === 'error' && <p className="err" role="alert">{state.error}</p>}
        </form>
        {state.status === 'ok' && state.data && <Result r={state.data} />}
      </div>
    </div>
  );
}
