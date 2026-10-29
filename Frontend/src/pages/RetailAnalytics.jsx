'use client';
import React, { useState } from 'react';
import FunnelBars from '../components/retail/FunnelBars';
import { PageHead, Card, Chips, KpiRow, Kpi, StateBox, useRetailLoad } from '../components/retail/RetailBits';
import { getRetailAnalytics, getRetailSettings, retailData } from '../services/api/retailApi';
import { count } from '../utils/retailFormat';
import '../styles/redesign-p-retail.css';
import '../styles/dark-retail.css';

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

const sourceName = (s) => {
  const t = String(s || '').trim();
  if (!t || t.toLowerCase() === 'direct') return 'Direct';
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Tracking and analytics: visits, the funnel, where visitors come from. IDs are set in Store settings.
export default function RetailAnalytics({ onPageChange }) {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useRetailLoad(() => getRetailAnalytics(days).then(retailData), [days]);
  const ids = useRetailLoad(async () => {
    try { return (retailData(await getRetailSettings()) || {}).tracking || {}; } catch { return null; }
  }, []);

  const d = data || {};
  const sources = Array.isArray(d.sources) ? d.sources : [];
  const posts = Array.isArray(d.top_posts) ? d.top_posts : [];
  const products = Array.isArray(d.top_products) ? d.top_products : [];
  const first = loading && !data;
  const tracking = ids.data;

  return (
    <div className="dash-page w-full rt-page">
      <div className="dash-container flex flex-col gap-4">
        <PageHead title="Tracking and analytics" subtitle={`Last ${days} days, counted in India time.`}>
          <button type="button" className="ui-btn ui-btn--secondary" onClick={reload} disabled={loading}>Refresh</button>
        </PageHead>
        <Chips options={RANGES} value={days} onChange={setDays} label="Period" />

        {error && !loading && !data ? (
          <StateBox kind="error" title="Could not load the numbers" desc={error} action={<button type="button" className="ui-btn ui-btn--secondary" onClick={reload}>Try again</button>} />
        ) : (
          <>
            <KpiRow>
              <Kpi label="Visits" value={count(d.visits)} loading={first} />
              <Kpi label="Added to cart" value={count(d.add_to_cart)} loading={first} />
              <Kpi label="Started checkout" value={count(d.begin_checkout)} loading={first} />
              <Kpi label="Orders" value={count(d.orders)} loading={first} />
            </KpiRow>

            <div className="rt-two">
              <Card title="Where visitors drop off" hint="Share of visitors reaching each step">
                {first ? <span className="ui-skeleton rt-block-skel" aria-hidden="true" /> : <FunnelBars funnel={d.funnel} />}
              </Card>

              <Card title="Top sources" hint="Where visits and orders come from">
                {sources.length === 0 ? <p className="rt-none">{first ? 'Loading...' : 'No visits recorded yet for this period.'}</p> : (
                  <div className="rt-tablewrap">
                    <table className="rt-tbl">
                      <thead><tr><th>Source</th><th className="r">Visits</th><th className="r">Orders</th></tr></thead>
                      <tbody>
                        {sources.map((s) => (
                          <tr key={s.source || 'direct'}><td data-label="Source"><b>{sourceName(s.source)}</b></td><td data-label="Visits" className="r">{count(s.visits)}</td><td data-label="Orders" className="r">{count(s.orders)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <div className="rt-two">
              <Card title="Top blog posts" hint="Posts that bring visitors">
                {posts.length === 0 ? <p className="rt-none">{first ? 'Loading...' : 'No post visits yet.'}</p> : (
                  <ul className="rt-list">{posts.map((p) => (
                    <li key={p.slug}><div className="rt-list__row rt-list__row--static"><span className="rt-list__main"><b>{p.title || p.slug}</b><small>/blog/{p.slug}</small></span><span className="rt-list__side"><b>{count(p.visits)}</b><small>visits</small></span></div></li>
                  ))}</ul>
                )}
              </Card>
              <Card title="Top frames" hint="Most viewed and ordered">
                {products.length === 0 ? <p className="rt-none">{first ? 'Loading...' : 'No frame views yet.'}</p> : (
                  <ul className="rt-list">{products.map((p) => (
                    <li key={p.id}><div className="rt-list__row rt-list__row--static"><span className="rt-list__main"><b>{p.title}</b><small>{count(p.orders)} orders</small></span><span className="rt-list__side"><b>{count(p.views)}</b><small>views</small></span></div></li>
                  ))}</ul>
                )}
              </Card>
            </div>
          </>
        )}

        <Card
          title="Tags and tracking IDs"
          hint="Google Analytics and the Meta pixel are set in Store settings."
          actions={onPageChange ? <button type="button" className="ui-btn ui-btn--secondary" onClick={() => onPageChange('retail-settings')}>Open Store settings</button> : null}
        >
          <dl className="rt-facts">
            <div><dt>Google Analytics</dt><dd>{tracking?.ga_id || 'Not set'}</dd></div>
            <div><dt>Meta pixel</dt><dd>{tracking?.meta_pixel_id || 'Not set'}</dd></div>
            <div><dt>Cookie notice</dt><dd>{tracking ? (tracking.cookie_notice ? 'On' : 'Off') : '—'}</dd></div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
