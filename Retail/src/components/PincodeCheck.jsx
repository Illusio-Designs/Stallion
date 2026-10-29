'use client';
import { useEffect, useState } from 'react';
import { post } from '../lib/api';

const KEY = 'stl-retail-pincode';
const day = (iso) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

// Delivery check for a pincode (POST /shipping/check). Remembers the last pincode on this device.
export default function PincodeCheck({ subtotal = 0 }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { try { const p = localStorage.getItem(KEY); if (p) setPin(p); } catch (_e) { /* blocked */ } }, []);

  const check = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) { setErr('Enter a 6 digit pincode.'); setRes(null); return; }
    setBusy(true); setErr(''); setRes(null);
    try {
      const r = await post('/shipping/check', { pincode: pin, subtotal });
      setRes(r.data || null);
      try { localStorage.setItem(KEY, pin); } catch (_e) { /* blocked */ }
    } catch (ex) {
      setErr(ex.message || 'We could not check that pincode. Please try again.');
    } finally { setBusy(false); }
  };

  const std = res && res.options ? (res.options.find((o) => o.id === 'standard') || res.options[0]) : null;
  const date = res && res.estimate_date ? day(res.estimate_date) : null;

  return (
    <form className="box pd-pin" onSubmit={check} noValidate>
      <b>Delivery</b>
      <div className="pd-pin__row">
        <label className="sr" htmlFor="pd-pin">Pincode</label>
        <input id="pd-pin" className="input" inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="Enter pincode" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-invalid={err ? 'true' : undefined} />
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Checking' : 'Check'}</button>
      </div>
      <div aria-live="polite">
        {err ? <p className="err">{err}</p> : null}
        {res && res.serviceable === false ? <p className="err">Sorry, we do not deliver to {pin} yet.</p> : null}
        {res && res.serviceable ? (
          <p className="pd-pin__ok">
            {date ? `Delivered by ${date}` : `Delivery in ${res.estimate_days_min} to ${res.estimate_days_max} days`}
            {std && std.free ? ' · Free shipping' : std && std.charge ? ` · Shipping ₹${std.charge}` : ''}
            {res.cod_available ? ' · Cash on delivery available' : ''}
          </p>
        ) : null}
      </div>
    </form>
  );
}
