'use client';
import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Skeleton from '../ui/Skeleton';
import StatusBadge from '../ui/StatusBadge';
import { MyTrayTasksCard } from './HomeBlocks';
import { rememberEditParty } from '../../services/api/partnersApi';
import { searchRows } from '../../utils/search';
import { orderStatusBadgeKey } from '../../utils/orderStatus';
import '../../styles/redesign-n-shome.css';

const RING_C = 2 * Math.PI * 34;

// The salesman's home: today's numbers, tray tasks (only when there are some), the latest
// orders, and a search box to find one of his parties and open its edit form.
export default function SalesmanHome({
  heading, subline, loading, hasTarget, targetTotal, targetDone, targetPct, monthLabel,
  sales, orderCount, openCount, orders, partyOf, orderRef, amountOf, money, statusLabel, parties,
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const idOf = (p) => p.party_id || p.id;
  const cityOf = (p) => p.city_name || (typeof p.city === 'string' ? p.city : p.city?.name) || '';
  const hasLocation = (p) => p.latitude != null && p.longitude != null && p.latitude !== '' && p.longitude !== '';
  const found = useMemo(
    () => (q.trim() ? searchRows(parties, q, (p) => [p.party_name || p.name, cityOf(p), p.phone]).slice(0, 5) : []),
    [parties, q],
  );
  const edit = (p) => {
    rememberEditParty(idOf(p), '/dashboard');
    router.push('/dashboard/party');
  };

  return (
    <div className="sh">
      <div className="rda-head"><div><h1>{heading}</h1><p>{subline}</p></div></div>

      <div className={`sh-strip${hasTarget ? ' sh-strip--target' : ''}`}>
        {hasTarget && (
          <section className="target-ring" aria-label="Target progress">
            <svg className="target-ring__svg" width="88" height="88" viewBox="0 0 84 84" role="img" aria-label={`${targetPct} percent of target reached`}>
              <circle cx="42" cy="42" r="34" fill="none" stroke="#3b3b3b" strokeWidth="9" />
              <circle cx="42" cy="42" r="34" fill="none" stroke="#ffffff" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={`${Math.min(1, targetDone / (targetTotal || 1)) * RING_C} ${RING_C}`} transform="rotate(-90 42 42)" />
              <text x="42" y="47" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="700" style={{ fontFamily: 'var(--font-display)' }}>{targetPct}%</text>
            </svg>
            <div className="target-ring__text">
              <span className="target-ring__label">Target{monthLabel ? `, ${monthLabel}` : ''}</span>
              <span className="target-ring__big">{money(targetDone)}</span>
              <span className="target-ring__sub">of {money(targetTotal)}. Cancelled orders count.</span>
            </div>
          </section>
        )}
        <div className="sh-kpis">
          {[['This month', loading ? null : money(sales)], ['Orders', loading ? null : orderCount], ['Open', loading ? null : openCount]].map(([label, value]) => (
            <div className="sh-kpi" key={label}>
              <small>{label}</small>
              <b>{value == null ? <Skeleton width={60} height={22} /> : value}</b>
            </div>
          ))}
        </div>
      </div>

      <MyTrayTasksCard hideWhenEmpty />

      <div className="sh-cols">
        <section className="rda-card" aria-label="Recent orders">
          <div className="rda-card__head">
            <div><h2>Recent orders</h2></div>
            <button type="button" className="rda-link sh-linkbtn" onClick={() => router.push('/dashboard/orders')}>All orders</button>
          </div>
          {loading ? (
            <div className="sh-skel">{[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={44} radius={10} />)}</div>
          ) : orders.length === 0 ? (
            <p className="rda-empty">No orders yet.</p>
          ) : orders.slice(0, 4).map((o) => (
            <div className="sh-ord" key={o.order_id || o.id || o.order_number}>
              <div>
                <b>{partyOf(o)}</b>
                <span>{orderRef(o)} · {money(amountOf(o))}</span>
              </div>
              <StatusBadge status={orderStatusBadgeKey(o.order_status)}>{statusLabel(o.order_status)}</StatusBadge>
            </div>
          ))}
        </section>

        <section className="rda-card" aria-label="Find a party">
          <div className="rda-card__head"><div><h2>Find a party</h2></div></div>
          <input
            className="ui-input sh-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search party name or city"
            aria-label="Search your parties"
            autoComplete="off"
          />
          {q.trim() && (found.length === 0 ? (
            <p className="rda-empty">No party matches. Try fewer letters.</p>
          ) : found.map((p) => (
            <div className="sh-ord" key={idOf(p)}>
              <div>
                <b>{p.party_name || p.name}</b>
                <span>{cityOf(p) || '-'}{!hasLocation(p) && <> · <em className="sh-warn">No location yet</em></>}</span>
              </div>
              <button type="button" className="sh-iconbtn" onClick={() => edit(p)} aria-label={`Edit ${p.party_name || p.name}`} title="Edit party">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              </button>
            </div>
          )))}
        </section>
      </div>
    </div>
  );
}
