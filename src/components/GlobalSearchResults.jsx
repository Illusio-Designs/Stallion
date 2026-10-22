import React, { useEffect, useRef, useState } from 'react';
import { getOrdersPageForRole, getPartiesPage, getProductsPage } from '../services/apiService';
import { fetchPage } from '../services/api/client';
import { getUserRole, getUserRoles } from '../services/authService';
import { hasAnyRolePageAccess } from '../utils/rolePermissions';

// Results from parties, orders and products for what is typed in the header search box.
// Only the lists the signed-in role can open are asked for, and the server does the matching.
const FIELD_ROLES = new Set(['salesman', 'distributor', 'party']);

const GlobalSearchResults = ({ query, onPick }) => {
  const [state, setState] = useState({ loading: false, parties: [], orders: [], products: [], done: false });
  const [open, setOpen] = useState(true);
  const boxRef = useRef(null);
  const term = String(query || '').trim();

  useEffect(() => { setOpen(true); }, [term]);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => {
    if (term.length < 2) { setState({ loading: false, parties: [], orders: [], products: [], done: false }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(async () => {
      const role = getUserRole();
      const roles = getUserRoles();
      const can = (page) => hasAnyRolePageAccess(roles, page);
      const rows = (r) => (r && Array.isArray(r.data) ? r.data : (Array.isArray(r) ? r : []));
      const jobs = [
        can('party') && role !== 'party'
          ? (FIELD_ROLES.has(role)
            ? fetchPage('/parties/my', { page: 1, limit: 4, search: term }, { method: 'GET', includeAuth: true, silent: true })
            : getPartiesPage(null, 1, 4, term))
          : Promise.resolve([]),
        can('orders') ? getOrdersPageForRole(role, 1, 4, term) : Promise.resolve([]),
        can('dashboard-products') ? getProductsPage(1, 4, term) : Promise.resolve([]),
      ];
      const [p, o, pr] = await Promise.allSettled(jobs);
      if (cancelled) return;
      setState({
        loading: false,
        done: true,
        parties: p.status === 'fulfilled' ? rows(p.value).slice(0, 4) : [],
        orders: o.status === 'fulfilled' ? rows(o.value).slice(0, 4) : [],
        products: pr.status === 'fulfilled' ? rows(pr.value).slice(0, 4) : [],
      });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [term]);

  if (term.length < 2 || !open) return null;
  const { loading, parties, orders, products, done } = state;
  const nothing = done && !loading && !parties.length && !orders.length && !products.length;

  const Group = ({ title, items, page, label, sub }) => (!items.length ? null : (
    <div className="gs-group">
      <div className="gs-title">{title}</div>
      {items.map((it, i) => (
        <button key={(it.party_id || it.order_id || it.product_id || i) + title} type="button" className="gs-item" onClick={() => { setOpen(false); onPick(page, term); }}>
          <span className="gs-label">{label(it)}</span>
          <span className="gs-sub">{sub(it)}</span>
        </button>
      ))}
    </div>
  ));

  return (
    <div className="gs-pop" ref={boxRef} role="region" aria-label="Search results">
      {loading && <div className="gs-note">Searching…</div>}
      <Group title="Parties" items={parties} page="party" label={(x) => x.party_name || x.name || 'Party'} sub={(x) => x.phone || ''} />
      <Group title="Orders" items={orders} page="orders" label={(x) => x.order_number || 'Order'} sub={(x) => [x.party_name, x.order_status].filter(Boolean).join(' · ')} />
      <Group title="Products" items={products} page="dashboard-products" label={(x) => x.model_no || 'Product'} sub={(x) => (x.whp ? `₹${x.whp}` : '')} />
      {nothing && <div className="gs-note">Nothing found for “{term}”.</div>}
    </div>
  );
};

export default GlobalSearchResults;
