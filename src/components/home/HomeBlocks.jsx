'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Skeleton from '../ui/Skeleton';
import StatusBadge from '../ui/StatusBadge';
import { FiMapPin, FiShoppingCart, FiUsers, FiPackage, FiCreditCard, FiNavigation2, FiUser, FiChevronRight } from '../icons/hugeicons';
import { captureCurrentPosition, distanceMeters, GEOFENCE_RADIUS_M } from '../../utils/geolocation';
import { createSalesmanCheckin } from '../../services/api/salesmanApi';
import { verifyPartyLocation } from '../../services/api/partnersApi';
import { getMySalesman } from '../../services/api/dashboardApi';
import { getTrayTasks, markTrayTaskInTransit } from '../../services/api/inventoryApi';
import { queueCheckin, isNetworkError } from '../../services/offlineQueue';
import { showError, showSuccess, showInfo } from '../../services/notificationService';
import { orderStatusTitle, orderStatusBadgeKey } from '../../utils/orderStatus';
import '../../styles/redesign-n-home.css';
import '../../styles/redesign-n-tasks.css';

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
  const label = orderStatusTitle;
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
              <StatusBadge status={orderStatusBadgeKey(status(o))}>{label(status(o))}</StatusBadge>
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
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState({}); // partyId -> spot saved by the shop test
  const [failed, setFailed] = useState({}); // partyId -> why the last shop test failed

  const idOf = (p) => String(p.party_id || p.id);
  const list = useMemo(
    () => (parties || []).filter((p) => p.is_active !== false).map((p) => (saved[idOf(p)] ? { ...p, ...saved[idOf(p)] } : p)),
    [parties, saved],
  );
  const isReady = (p) => p.location_source === 'verified' && p.latitude != null && p.longitude != null;
  const readyList = list.filter(isReady);
  const toVisit = list.filter((p) => !isReady(p));
  const party = list.find((p) => idOf(p) === partyId) || null;
  const hasLocation = !!party && isReady(party);
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

  // Shop test: read the GPS at the shop and save the spot. When it works the party is
  // good to go; when it fails the party stays on the "To visit" list with the reason.
  const testShop = async () => {
    if (!party || testing) return;
    const id = idOf(party);
    setTesting(true);
    try {
      const pos = await captureCurrentPosition();
      const res = await verifyPartyLocation(id, pos);
      setSaved((m) => ({ ...m, [id]: { latitude: Number(res?.latitude), longitude: Number(res?.longitude), location_source: 'verified', location_accuracy_m: Number(res?.accuracy) } }));
      setFailed((m) => { const n = { ...m }; delete n[id]; return n; });
      showSuccess('Shop test passed. This party is good to go.');
      measure({ ...party, latitude: Number(res?.latitude), longitude: Number(res?.longitude) });
    } catch (e) {
      const why = e?.message || 'The shop test did not work. Try again at the shop.';
      setFailed((m) => ({ ...m, [id]: why }));
      showError(why);
    } finally {
      setTesting(false);
    }
  };

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
      // Start-only check-in: the salesman completes out time and next visit date in the visit report.
      const payload = {
        start_only: true,
        salesman_id: salesmanId,
        check_in_date: day,
        party_id: idOf(party),
        contact_person: (party.contact_person || party.party_name || party.name || 'Shop').trim(),
        type: 'visit',
        in_time: now.toISOString(),
        latitude: String(result.pos.latitude),
        longitude: String(result.pos.longitude),
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
      try {
        sessionStorage.setItem('stallion.checkinParty', JSON.stringify({
          party_id: idOf(party),
          party_name: party.party_name || party.name || '',
          at: Date.now(),
        }));
      } catch { /* storage unavailable: the cart simply asks for the party */ }
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
              {readyList.length > 0 && (
                <optgroup label="Good to go">
                  {readyList.map((p) => <option key={idOf(p)} value={idOf(p)}>{p.party_name || p.name}{cityOf(p) ? `, ${cityOf(p)}` : ''}</option>)}
                </optgroup>
              )}
              {toVisit.length > 0 && (
                <optgroup label="To visit (test the shop first)">
                  {toVisit.map((p) => <option key={idOf(p)} value={idOf(p)}>{p.party_name || p.name}{cityOf(p) ? `, ${cityOf(p)}` : ''}</option>)}
                </optgroup>
              )}
            </select>
          </label>
          {party && !hasLocation && (
            <div className="rdn-shop__test">
              <p className="rdn-shop__note rdn-shop__note--warn" role="status" aria-live="polite">
                <FiMapPin size={16} aria-hidden="true" />
                <span>
                  {failed[idOf(party)]
                    ? `Shop test did not pass: ${failed[idOf(party)]} This party stays on your visit list.`
                    : 'This party has no shop spot yet. Stand at the shop and run the shop test. If it works, you are good to go.'}
                </span>
              </p>
              <button type="button" className="rdn-shop__test-btn" onClick={testShop} disabled={testing || busy}>
                {testing ? 'Testing...' : failed[idOf(party)] ? 'Test again at the shop' : 'Test shop location'}
              </button>
            </div>
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
          {toVisit.length > 0 && (
            <details className="rdn-shop__visit">
              <summary>To visit ({toVisit.length}): no shop spot yet</summary>
              <ul>
                {toVisit.map((p) => (
                  <li key={idOf(p)}>
                    <button type="button" className="rdn-linkbtn" onClick={() => setPartyId(idOf(p))}>
                      {p.party_name || p.name}{cityOf(p) ? `, ${cityOf(p)}` : ''}
                    </button>
                    {failed[idOf(p)] && <small>{failed[idOf(p)]}</small>}
                  </li>
                ))}
              </ul>
            </details>
          )}
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

// ---------- Salesman: frames to send back from a sample tray ----------
const TASK_COURIERS = ['Delhivery', 'Blue Dart', 'DTDC', 'India Post', 'Other'];

function TrayTaskForm({ task, onDone }) {
  const [courier, setCourier] = useState(TASK_COURIERS[0]);
  const [other, setOther] = useState('');
  const [tracking, setTracking] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const id = String(task.task_id);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const name = courier === 'Other' ? other.trim() : courier;
    const number = tracking.trim();
    const errs = {};
    if (!name) errs.courier = 'Enter the courier name.';
    if (!number) errs.tracking = 'Enter the tracking number.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await markTrayTaskInTransit(task.task_id, { courier_name: name, tracking_number: number });
      showSuccess('Marked in transit');
      onDone();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Could not save the courier details.';
      showError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="rdt-form" noValidate onSubmit={submit}>
      <div className="rdt-banner rdt-banner--act">
        New task: send {task.qty} pieces of {task.model_no || 'the model'} from {task.tray_name || 'your tray'} back to the office by courier, then enter the courier details here.
      </div>
      <div className="rdt-fields">
        <label className="rdt-field" htmlFor={`rdt-c-${id}`}>
          <span>Courier</span>
          <select id={`rdt-c-${id}`} value={courier} disabled={busy} onChange={(e) => { setCourier(e.target.value); setErrors((x) => ({ ...x, courier: undefined })); }}>
            {TASK_COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {courier === 'Other' && (
          <label className="rdt-field" htmlFor={`rdt-o-${id}`}>
            <span>Courier name</span>
            <input id={`rdt-o-${id}`} type="text" value={other} maxLength={255} disabled={busy} aria-invalid={!!errors.courier} onChange={(e) => { setOther(e.target.value); setErrors((x) => ({ ...x, courier: undefined })); }} />
            {errors.courier && <small className="rdt-err" role="alert">{errors.courier}</small>}
          </label>
        )}
        <label className="rdt-field" htmlFor={`rdt-t-${id}`}>
          <span>Tracking number</span>
          <input id={`rdt-t-${id}`} type="text" placeholder="Enter the number" value={tracking} maxLength={255} disabled={busy} aria-invalid={!!errors.tracking} onChange={(e) => { setTracking(e.target.value); setErrors((x) => ({ ...x, tracking: undefined })); }} />
          {errors.tracking && <small className="rdt-err" role="alert">{errors.tracking}</small>}
        </label>
      </div>
      <button type="submit" className="rda-btn rda-btn--sm rdt-submit" disabled={busy}>{busy ? 'Saving…' : 'Mark in transit'}</button>
    </form>
  );
}

export function MyTrayTasksCard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const list = await getTrayTasks('all');
      setTasks(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e?.message || 'Could not load your tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // A new task can arrive while the dashboard stays open: refresh when the tab is shown again.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const open = tasks.filter((t) => t.status === 'booked');
  const transit = tasks.filter((t) => t.status === 'in_transit');
  const received = tasks
    .filter((t) => t.status === 'received')
    .sort((a, b) => new Date(b.received_at || 0) - new Date(a.received_at || 0))
    .slice(0, 3);
  const count = open.length + transit.length;
  const head = (t) => `${t.tray_name || 'Tray'}: ${t.qty} pieces${t.order_number ? `, order ${String(t.order_number).startsWith('#') ? '' : '#'}${t.order_number}` : ''}`;

  return (
    <section className="rda-card rdt" aria-label="My tray tasks">
      <div className="rda-card__head">
        <div><h2>My tray tasks{count > 0 && <span className="rdt-count" aria-label={`${count} open`}>{count}</span>}</h2><p>Frames booked from your sample trays that go back to the office</p></div>
      </div>
      {loading ? (
        <div className="rdt-list" aria-busy="true"><Skeleton width="100%" height={64} radius={10} /><Skeleton width="100%" height={64} radius={10} /></div>
      ) : error ? (
        <CardError text={error} onRetry={() => load()} />
      ) : tasks.length === 0 ? (
        <p className="rdt-none">No tasks right now</p>
      ) : (
        <div className="rdt-list">
          {open.length === 0 && transit.length === 0 && <p className="rdt-none">No tasks right now</p>}
          {open.map((t) => (
            <div className="rdt-task" key={t.task_id}>
              <div className="rdt-task__head"><b>{head(t)}</b><span className="rdt-pill">To send</span></div>
              {t.party_name && <div className="rdt-task__meta">{t.party_name}</div>}
              <TrayTaskForm task={t} onDone={() => load(true)} />
            </div>
          ))}
          {transit.map((t) => (
            <div className="rdt-task" key={t.task_id}>
              <div className="rdt-task__head"><b>{head(t)}</b><span className="rdt-pill rdt-pill--transit">In transit</span></div>
              <div className="rdt-banner rdt-banner--wait">
                In transit with {t.courier_name || 'the courier'}, tracking {t.tracking_number || 'not given'}. The office will mark it received.
              </div>
            </div>
          ))}
          {received.length > 0 && (
            <div className="rdt-done">
              <h3>Received</h3>
              {received.map((t) => (
                <div className="rdt-task rdt-task--done" key={t.task_id}>
                  <div className="rdt-task__head"><b>{head(t)}</b><span className="rdt-pill rdt-pill--done">Received</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
