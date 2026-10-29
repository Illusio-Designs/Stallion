'use client';
import React, { useState } from 'react';
import {
  getRetailOrderSummary, getRetailAnalytics, getRetailOrders, getRetailMessages, markRetailMessageHandled, retailData, retailList,
} from '../services/api/retailApi';
import { showSuccess, showError } from '../services/notificationService';
import StatusBadge from '../components/ui/StatusBadge';
import FunnelBars from '../components/retail/FunnelBars';
import { PageHead, Kpi, KpiRow, Card, StateBox, useRetailLoad, errorText } from '../components/retail/RetailBits';
import { rupees, count, istDateTime, normalizeOrderSummary, normalizeOrder, sentence } from '../utils/retailFormat';
import { statusBadgeKey } from '../utils/retailOrderStatus';
import '../styles/redesign-p-retail.css';
import '../styles/dark-retail.css';

// Retail dashboard: today at a glance. Wholesale numbers never appear here.
export default function RetailDashboard({ onPageChange }) {
  const { data, loading, error, reload } = useRetailLoad(async () => {
    const [sum, ana, ord, msg] = await Promise.allSettled([
      getRetailOrderSummary(),
      getRetailAnalytics(30),
      getRetailOrders({ page: 1, limit: 5 }),
      getRetailMessages({ page: 1, limit: 5 }),
    ]);
    // If nothing at all came back, say why instead of showing a page of dashes.
    if ([sum, ana, ord].every((r) => r.status === 'rejected')) throw sum.reason;
    return {
      summary: sum.status === 'fulfilled' ? normalizeOrderSummary(retailData(sum.value)) : null,
      analytics: ana.status === 'fulfilled' ? retailData(ana.value) : null,
      orders: ord.status === 'fulfilled' ? retailList(ord.value).rows.map(normalizeOrder) : null,
      messages: msg.status === 'fulfilled' ? retailList(msg.value).rows : null,
    };
  }, []);

  const [handling, setHandling] = useState('');
  const handled = async (m) => {
    setHandling(m.id);
    try {
      await markRetailMessageHandled(m.id);
      showSuccess('Marked as handled');
      reload();
    } catch (e) {
      showError(errorText(e), null, 'Could not update the message');
    } finally {
      setHandling('');
    }
  };

  const summary = data?.summary;
  const analytics = data?.analytics;
  const pending = summary ? summary.counts?.pending : null;
  const openMessages = (data?.messages || []).filter((m) => !m.handled);

  return (
    <div className="dash-page w-full rt-page">
      <div className="dash-container flex flex-col gap-4">
        <PageHead title="Retail dashboard" subtitle="How the online store is doing. Times are India time.">
          <button type="button" className="ui-btn ui-btn--secondary" onClick={reload} disabled={loading}>Refresh</button>
        </PageHead>

        {error && !loading && !data ? (
          <StateBox kind="error" title="Could not load the dashboard" desc={error} action={<button type="button" className="ui-btn ui-btn--secondary" onClick={reload}>Try again</button>} />
        ) : (
          <>
            <KpiRow>
              <Kpi label="Orders today" value={count(summary?.ordersToday)} loading={loading && !data} />
              <Kpi label="Pending orders" value={count(pending)} sub={pending ? 'Waiting to be confirmed' : null} loading={loading && !data} />
              <Kpi label="Revenue today" value={rupees(summary?.revenueToday)} sub={summary?.revenue30 != null ? `${rupees(summary.revenue30)} in 30 days` : null} loading={loading && !data} />
              <Kpi label="Visits, 30 days" value={count(analytics?.visits)} sub={analytics ? `${count(analytics.orders)} orders` : null} loading={loading && !data} />
            </KpiRow>

            <div className="rt-two">
              <Card title="Where visitors drop off" hint="Last 30 days" actions={<button type="button" className="rt-link" onClick={() => onPageChange?.('retail-analytics')}>Open analytics</button>}>
                {loading && !data ? <span className="ui-skeleton rt-block-skel" aria-hidden="true" /> : <FunnelBars funnel={analytics?.funnel} />}
              </Card>

              <Card title="Latest online orders" actions={<button type="button" className="rt-link" onClick={() => onPageChange?.('retail-orders')}>All orders</button>}>
                {loading && !data ? <span className="ui-skeleton rt-block-skel" aria-hidden="true" /> : !data?.orders || data.orders.length === 0 ? (
                  <p className="rt-none">{data?.orders ? 'No online orders yet. Orders placed on the store show up here.' : 'Orders could not be loaded.'}</p>
                ) : (
                  <ul className="rt-list">
                    {data.orders.map((o) => (
                      <li key={o.id || o.order_number}>
                        <button type="button" className="rt-list__row" onClick={() => onPageChange?.('retail-orders')}>
                          <span className="rt-list__main"><b>{o.order_number}</b><small>{[o.customer_name, istDateTime(o.created_at)].filter(Boolean).join(' · ')}</small></span>
                          <span className="rt-list__side"><b>{rupees(o.total)}</b><StatusBadge status={statusBadgeKey(o.status)}>{sentence(o.status)}</StatusBadge></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card title="Customer messages" hint="From the contact form on the store">
              {loading && !data ? <span className="ui-skeleton rt-block-skel" aria-hidden="true" /> : openMessages.length === 0 ? (
                <p className="rt-none">{data?.messages ? 'No new messages.' : 'Messages could not be loaded.'}</p>
              ) : (
                <ul className="rt-list">
                  {openMessages.map((m) => (
                    <li key={m.id} className="rt-msg">
                      <div className="rt-list__main">
                        <b>{m.name || 'Customer'}</b>
                        <small>{[m.contact, istDateTime(m.created_at)].filter(Boolean).join(' · ')}</small>
                        <p>{m.message}</p>
                      </div>
                      <button type="button" className="ui-btn ui-btn--secondary rt-msg__btn" disabled={handling === m.id} onClick={() => handled(m)}>
                        {handling === m.id ? 'Saving...' : 'Mark as handled'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
