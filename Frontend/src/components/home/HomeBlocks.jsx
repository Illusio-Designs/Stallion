'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Skeleton from '../ui/Skeleton';
import StatusBadge from '../ui/StatusBadge';
import { FiMapPin, FiShoppingCart, FiUsers, FiPackage, FiCreditCard, FiNavigation2, FiUser, FiChevronRight } from '../icons/hugeicons';
import { captureCurrentPosition, distanceMeters, GEOFENCE_RADIUS_M } from '../../utils/geolocation';
import { createSalesmanCheckin } from '../../services/api/salesmanApi';
import { getMySalesman } from '../../services/api/dashboardApi';
import { queueCheckin, isNetworkError } from '../../services/offlineQueue';
import { showError, showSuccess, showInfo } from '../../services/notificationService';
import '../../styles/redesign-n-home.css';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const shortRupee = (n) => {
  const v = Number(n || 0);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
  return `₹${Math.round(v)}`;
};
const initialsOf = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Small error line with a retry button, shared by the cards that load on their own.
export function CardError({ text, onRetry }) {
  return (
    <div className="rdn-state" role="alert">
      <p>{text}</p>
      {onRetry && <button type="button" className="rda-btn rda-btn--ghost rda-btn--sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

// ---------- Admin: Sales & Revenue, the last 12 weeks as a mini bar chart ----------
export function SalesRevenueCard({ weekly, loading, error, onRetry }) {
  const bars = useMemo(() => {
    const list = Array.isArray(weekly) ? weekly : [];
    const max = Math.max(1, ...list.map((w) => Number(w.total) || 0));
    return list.map((w, i) => {
      const d = new Date(`${w.week_start}T00:00:00`);
      return {
        key: w.week_start,
        pct: Math.max(((Number(w.total) || 0) / max) * 100, Number(w.total) > 0 ? 4 : 0),
        total: Number(w.total) || 0,
        label: `${d.getDate()} ${MONTHS[d.getMonth()] || ''}`,
        showLabel: i % 3 === 0 || i === list.length - 1,
        current: i === list.length - 1,
      };
    });
  }, [weekly]);
  const sum = bars.reduce((n, b) => n + b.total, 0);
  const thisWeek = bars.length ? bars[bars.length - 1].total : 0;
  return (
    <section className="rda-card" aria-label="Sales and revenue">
      <div className="rda-card__head">
        <div><h2>Sales &amp; Revenue</h2><p>Order value per week, last 12 weeks. Cancelled orders are included.</p></div>
        {!loading && !error && <div className="rdn-figure"><b>{shortRupee(sum)}</b><span>{money(thisWeek)} this week</span></div>}
      </div>
      {loading ? (
        <div className="rdn-bars rdn-bars--skel" aria-busy="true">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} width="100%" height={30 + ((i * 37) % 90)} radius={6} />)}</div>
      ) : error ? (
        <CardError text="Could not load the sales figures." onRetry={onRetry} />
      ) : sum === 0 ? (
        <p className="rda-empty">No orders in the last 12 weeks.</p>
      ) : (
        <div className="rdn-bars" role="img" aria-label={`Bar chart of weekly order value. Total ${money(sum)} in 12 weeks.`}>
          {bars.map((b) => (
            <div key={b.key} className="rdn-bar" title={`Week of ${b.label}: ${money(b.total)}`}>
              <div className="rdn-bar__track"><i className={b.current ? 'on' : ''} style={{ height: `${b.pct}%` }} /></div>
              <span className="rdn-bar__lab">{b.showLabel ? b.label : ' '}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- Admin: Quick actions ----------
export function QuickActionsCard({ roles }) {
  const router = useRouter();
  const has = (...names) => roles.some((r) => names.includes(r));
  const actions = [
    { icon: FiShoppingCart, label: 'New order', path: '/products', show: true },
    { icon: FiUsers, label: 'Add party', path: '/dashboard/party', show: has('admin', 'party_manager', 'sales_manager') },
    { icon: FiPackage, label: 'Add product', path: '/dashboard/products', show: has('admin', 'product_manager') },
    { icon: FiCreditCard, label: 'Approve expenses', path: '/dashboard/expenses', show: has('admin', 'expense_manager', 'sales_manager') },
  ].filter((a) => a.show);
  return (
    <section className="rda-card" aria-label="Quick actions">
      <div className="rda-card__head"><div><h2>Quick actions</h2><p>Jump straight to the job</p></div></div>
      <div className="rdn-actions">
        {actions.map((a) => (
          <button key={a.label} type="button" className="rdn-action" onClick={() => router.push(a.path)}>
            <span className="rdn-action__ic" aria-hidden="true"><a.icon size={18} /></span>
            <span>{a.label}</span>
            <FiChevronRight size={16} aria-hidden="true" className="rdn-action__go" />
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------- Admin: Order overview (status counts + latest orders) ----------
export function OrderOverviewCard({ orders, loading, loadError, partyOf, onAll }) {
  const status = (o) => String(o.order_status || 'pending').toLowerCase();
  const counts = useMemo(() => {
    const c = {};
    orders.forEach((o) => { c[status(o)] = (c[status(o)] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [orders]);
  const latest = useMemo(() => [...orders]
    .sort((a, b) => new Date(b.created_at || b.order_date || 0) - new Date(a.created_at || a.order_date || 0))
    .slice(0, 5), [orders]);
  const amount = (o) => Number(o.order_total) || Number(o.total_value) || Number(o.total_amount) || 0;
  const label = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
  return (
    <section className="rda-card" aria-label="Order overview">
      <div className="rda-card__head">
        <div><h2>Order overview</h2><p>Latest orders, newest first</p></div>
        <button type="button" className="rdn-linkbtn" onClick={onAll}>All orders</button>
      </div>
      {counts.length > 0 && (
        <div className="rdn-counts">
          {counts.map(([s, n]) => <span key={s}><b>{n}</b> {label(s)}</span>)}
        </div>
      )}
      {loading ? (
        <div className="rdn-list" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} width="100%" height={40} radius={8} />)}</div>
      ) : latest.length === 0 ? (
        <p className="rda-empty">{loadError ? 'Could not load orders.' : 'No orders yet.'}</p>
      ) : (
        <ul className="rdn-list">
          {latest.map((o) => (
            <li key={o.order_id || o.id || o.order_number} className="rdn-row">
              <div className="rdn-row__main">
                <b>{o.order_number || `#${String(o.order_id || o.id || '').slice(-6)}`}</b>
                <span>{partyOf(o)}</span>
              </div>
              <StatusBadge status={status(o).replace(/\s+/g, '-')}>{label(status(o))}</StatusBadge>
              <span className="rdn-row__amt">{money(amount(o))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- Admin: Salesmen in the field ----------
export function FieldCard({ summary, loading, error, onRetry }) {
  const timeOf = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); };
  const list = summary?.in_field || [];
  return (
    <section className="rda-card" aria-label="Salesmen in the field">
      <div className="rda-card__head">
        <div><h2>Salesmen in the field</h2><p>Who has checked in today, and where</p></div>
        {summary && <div className="rdn-figure"><b>{summary.visits_today}</b><span>visit{summary.visits_today === 1 ? '' : 's'} today</span></div>}
      </div>
      {loading ? (
        <div className="rdn-list" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={40} radius={8} />)}</div>
      ) : error ? (
        <CardError text="Could not load who is in the field." onRetry={onRetry} />
      ) : list.length === 0 ? (
        <p className="rda-empty">Nobody has checked in yet today.</p>
      ) : (
        <>
          <p className="rdn-sub"><b>{summary.salesmen_in_field}</b> of {summary.salesmen_total} salesmen checked in</p>
          <ul className="rdn-list">
            {list.slice(0, 6).map((s, i) => (
              <li key={`${s.name}-${i}`} className="rdn-row">
                <span className="rda-pic" aria-hidden="true">{initialsOf(s.name)}</span>
                <div className="rdn-row__main">
                  <b>{s.name}</b>
                  <span>{[s.party_name, s.city].filter(Boolean).join(', ') || 'Location not named'}</span>
                </div>
                <span className="rdn-row__time">{timeOf(s.checked_in_at)}</span>
              </li>
            ))}
          </ul>
          {list.length > 6 && <p className="rdn-sub">and {list.length - 6} more</p>}
        </>
      )}
    </section>
  );
}

// ---------- Salesman: "I'm at the shop" ----------
export function ShopCheckInCard({ parties, salesmanId, loading }) {
  const router = useRouter();
  const [partyId, setPartyId] = useState('');
  const [dist, setDist] = useState(null); // { meters } | { error }
  const [measuring, setMeasuring] = useState(false);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => (parties || []).filter((p) => p.is_active !== false), [parties]);
  const idOf = (p) => String(p.party_id || p.id);
  const party = list.find((p) => idOf(p) === partyId) || null;
  const hasLocation = !!party && party.location_source === 'verified' && party.latitude != null && party.longitude != null;
  const cityOf = (p) => p.city?.name || p.city_name || (typeof p.city === 'string' ? p.city : '');

  const measure = useCallback(async (p) => {
    setDist(null);
    setMeasuring(true);
    try {
      const pos = await captureCurrentPosition();
      const meters = distanceMeters(pos.latitude, pos.longitude, Number(p.latitude), Number(p.longitude));
      const result = { meters, pos };
      setDist(result);
      return result;
    } catch (e) {
      const result = { error: e?.message || 'Could not get your location.' };
      setDist(result);
      return result;
    } finally {
      setMeasuring(false);
    }
  }, []);

  useEffect(() => {
    setDist(null);
    if (party && hasLocation) measure(party);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  const distText = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
  const within = dist && dist.meters != null && dist.meters <= GEOFENCE_RADIUS_M;

  const checkIn = async () => {
    if (!party || !hasLocation || busy) return;
    setBusy(true);
    try {
      const result = await measure(party);
      if (result.error) { showError(result.error); return; }
      if (result.meters > GEOFENCE_RADIUS_M) {
        showError(`You are ${distText(result.meters)} from the shop. Get within ${GEOFENCE_RADIUS_M} m to check in.`);
        return;
      }
      const now = new Date();
      const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      // Same payload as the visit report form. The server needs an out time and a next visit
      // date, so a short placeholder is used here; the salesman completes them in the visit report.
      const payload = {
        salesman_id: salesmanId,
        check_in_date: day,
        party_id: idOf(party),
        contact_person: (party.contact_person || party.party_name || party.name || 'Shop').trim(),
        type: 'visit',
        in_time: now.toISOString(),
        out_time: new Date(now.getTime() + 60 * 1000).toISOString(),
        next_visit_date: day,
        latitude: String(result.pos.latitude),
        longitude: String(result.pos.longitude),
        check_in_remarks: 'Checked in from Home. Update the visit report after the visit.',
      };
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
        await createSalesmanCheckin(payload);
        showSuccess('Checked in. You can start the order now.');
      } catch (sendErr) {
        if (!isNetworkError(sendErr)) throw sendErr;
        queueCheckin(payload);
        showInfo('', null, 'Saved on this phone', 'There is no signal right now. This check-in will be sent when you are online.');
      }
      router.push('/products');
    } catch (err) {
      showError(err?.message || 'Could not check in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rdn-shop" aria-label="I'm at the shop">
      <div className="rdn-shop__top">
        <span className="rdn-shop__ic" aria-hidden="true"><FiNavigation2 size={18} /></span>
        <div>
          <h2>I&apos;m at the shop</h2>
          <p>Pick the party, check in, then place the order.</p>
        </div>
      </div>
      {loading ? (
        <Skeleton width="100%" height={44} radius={10} />
      ) : list.length === 0 ? (
        <p className="rdn-shop__note">You have no parties yet. Add one on the Parties page.</p>
      ) : (
        <>
          <label className="rdn-shop__field">
            <span>Party</span>
            <select value={partyId} onChange={(e) => setPartyId(e.target.value)} disabled={busy}>
              <option value="">Choose a party</option>
              {list.map((p) => <option key={idOf(p)} value={idOf(p)}>{p.party_name || p.name}{cityOf(p) ? `, ${cityOf(p)}` : ''}</option>)}
            </select>
          </label>
          {party && !hasLocation && (
            <p className="rdn-shop__note rdn-shop__note--warn" role="alert">
              <FiMapPin size={16} aria-hidden="true" />
              <span>This party&apos;s shop location is not saved yet, so you cannot check in. Open Parties and tap &ldquo;I&apos;m at shop&rdquo; while you are there.{' '}
                <button type="button" className="rdn-linkbtn" onClick={() => router.push('/dashboard/party')}>Open Parties</button></span>
            </p>
          )}
          {party && hasLocation && (
            <p className={`rdn-shop__dist${dist && !dist.error ? (within ? ' ok' : ' far') : ''}`} aria-live="polite">
              <FiMapPin size={16} aria-hidden="true" />
              {measuring ? 'Checking your distance...'
                : dist?.error ? dist.error
                : dist ? `${distText(dist.meters)} from the shop. ${within ? `Within ${GEOFENCE_RADIUS_M} m, you can check in.` : `You need to be within ${GEOFENCE_RADIUS_M} m.`}`
                : 'Shop location saved.'}
              {!measuring && <button type="button" className="rdn-linkbtn" onClick={() => measure(party)}>Check again</button>}
            </p>
          )}
          <button type="button" className="rdn-shop__go" onClick={checkIn} disabled={!party || !hasLocation || busy || !salesmanId}>
            {busy ? 'Checking in...' : 'Check in and start order'}
          </button>
        </>
      )}
    </section>
  );
}

// ---------- Party / distributor: My salesman ----------
export function MySalesmanCard({ plural = false }) {
  const [state, setState] = useState({ loading: true, error: false, salesmen: [] });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: false }));
    try {
      const res = await getMySalesman();
      setState({ loading: false, error: false, salesmen: Array.isArray(res?.salesmen) ? res.salesmen : [] });
    } catch {
      setState({ loading: false, error: true, salesmen: [] });
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const title = plural ? 'My salesmen' : 'My salesman';
  return (
    <section className="rda-card" aria-label={title}>
      <div className="rda-card__head"><div><h2>{title}</h2><p>{plural ? 'Looking after your parties' : 'Your contact for orders and visits'}</p></div></div>
      {state.loading ? (
        <div className="rdn-list" aria-busy="true"><Skeleton width="100%" height={44} radius={8} /></div>
      ) : state.error ? (
        <CardError text="Could not load your salesman." onRetry={load} />
      ) : state.salesmen.length === 0 ? (
        <p className="rda-empty">No salesman is assigned to you yet. Please contact the office.</p>
      ) : (
        <ul className="rdn-list">
          {state.salesmen.map((s, i) => (
            <li key={`${s.name}-${i}`} className="rdn-row">
              <span className="rda-pic" aria-hidden="true">{s.name ? initialsOf(s.name) : <FiUser size={16} />}</span>
              <div className="rdn-row__main">
                <b>{s.name}</b>
                <span>{s.phone ? <a href={`tel:${s.phone}`}>{s.phone}</a> : 'No phone saved'}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
