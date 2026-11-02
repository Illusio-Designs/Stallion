import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsidePanel from '../components/ui/AsidePanel';
import { useConfirm } from '../components/ui/ConfirmProvider';
import DropdownSelector from '../components/ui/DropdownSelector';
import Pagination from '../components/ui/Pagination';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Call02Icon, Delete02Icon, Download01Icon, Location01Icon, MoreHorizontalIcon, PencilEdit02Icon, RefreshIcon, Search01Icon, Upload01Icon } from '@hugeicons/core-free-icons';
import {
  bulkUploadParties,
  deleteParty,
  getIndianCountries,
  getPartiesTablePage,
  getPartyFilterOptions,
  takeEditParty,
  getPartyDetails,
} from '../services/apiService';
import { getUser, getUserRole, getUserRoles } from '../services/authService';
import { showError, showSuccess, showWarning } from '../services/notificationService';
import { downloadCsv } from '../utils/exportCsv';
import '../styles/redesign-n-party.css';
import '../styles/redesign-n-headings.css';
import '../styles/redesign-p-party.css';
import '../styles/redesign-p-forms.css';
import PartyFormPanel from '../components/party/PartyFormPanel';

const splitNames = (v) => String(v || '').split(',').map((n) => n.trim()).filter((n) => n && n !== '—');

const DashboardClients = () => {
  const confirm = useConfirm();
  // Memoize user and role to prevent infinite loops
  const userRole = useMemo(() => getUserRole(), []);
  const user = useMemo(() => getUser(), []);
  const isSalesman = useMemo(() => userRole === 'salesman', [userRole]);
  const isDistributor = useMemo(() => userRole === 'distributor', [userRole]);
  const isAdmin = useMemo(() => userRole === 'admin', [userRole]);
  // What the server really allows, so a button is only shown to someone who can
  // use it (otherwise it just ends in "Access denied"):
  //  - delete + bulk upload: admin, party manager, sales manager
  //  - edit: those managers, or a salesman for their own parties
  const roleList = useMemo(() => getUserRoles(), []);
  const isPartyManager = useMemo(
    () => roleList.some((r) => ['admin', 'party_manager', 'sales_manager'].includes(r)),
    [roleList]
  );
  const canEditParty = isPartyManager || isSalesman;
  // Where to go after saving, when Edit party was opened from the cart or Home for a party with no location.
  const editReturnRef = useRef(null);
  const [activeTab, setActiveTab] = useState('All');
  const [openAdd, setOpenAdd] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openBulkUpload, setOpenBulkUpload] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [parties, setParties] = useState([]);
  const [countries, setCountries] = useState([]);
  const [selectedCountryFilter, setSelectedCountryFilter] = useState(null); // For filter dropdown

  const hasSetDefaultCountry = useRef(false);
  const [countriesReady, setCountriesReady] = useState(false);
  const [defaultCountryResolved, setDefaultCountryResolved] = useState(false);

  // Countries load on mount because the listing's default-country filter
  // (India) depends on them. The load-once guard makes the onOpen fallback on
  // the form's Country dropdowns a no-op once they're already loaded.
  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    if (countries.length > 0) return;
    try {
      const countriesData = await getIndianCountries();
      setCountries(countriesData || []);
    } catch (error) {
      console.error('Failed to load countries:', error);
    } finally {
      setCountriesReady(true);
    }
  };

  // The list tools. The server does the tab, search, filters, sort and paging: one page of rows per request.
  const [partySearch, setPartySearch] = useState('');
  const [partyQuery, setPartyQuery] = useState(''); // debounced copy of partySearch
  const [stateFilter, setStateFilter] = useState(''); // state id
  const [salesmanFilter, setSalesmanFilter] = useState(''); // salesman id
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [serverCounts, setServerCounts] = useState(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ states: [], salesmen: [] });
  const [moreFor, setMoreFor] = useState(null); // { row, top, left }
  const reqIdRef = useRef(0); // only the newest request may write its result
  const queryRef = useRef({});
  queryRef.current = { page, pageSize, partyQuery, activeTab, stateFilter, salesmanFilter, sortBy, sortDir, country: selectedCountryFilter };

  const TAB_STATUS = { All: '', Active: 'active', 'No location': 'no_location', Inactive: 'inactive' };
  const decorateParty = (party) => {
    const partyId = party.id || party.party_id || party._id;
    const hasPoint = party.latitude != null && party.longitude != null && Number.isFinite(Number(party.latitude)) && Number.isFinite(Number(party.longitude));
    return {
      ...party,
      id: partyId,
      state_id: party.state_id || null,
      city_id: party.city_id || null,
      zone_id: party.zone_id || null,
      isActive: party.is_active !== false,
      stateLabel: (typeof party.state === 'string' ? party.state : party.state?.name) || party.state_name || '',
      cityLabel: (typeof party.city === 'string' ? party.city : party.city?.name) || party.city_name || '—',
      salesmanLabel: party.salesman?.full_name || party.salesman?.salesman_name || party.salesman_name || '—',
      locationState: party.location_source === 'verified' ? 'ok' : (hasPoint ? 'warn' : 'idle'),
      locationLabel: party.location_source === 'verified' ? 'Exact spot saved' : (hasPoint ? 'From address' : 'Not set'),
      creditLabel: `${Number(party.credit_days) || 0} days`,
    };
  };
  const listParams = (q, pg, limit) => ({
    page: pg,
    limit,
    search: q.partyQuery,
    status: TAB_STATUS[q.activeTab] || '',
    state_id: q.stateFilter,
    salesman_id: q.salesmanFilter,
    country_id: q.country || '',
    sort: q.sortBy || '',
    dir: q.sortDir,
  });

  // Loads the CURRENT page (page, tab, search, filters and sort are read from queryRef). Called by the effect
  // below on every change, and after a create, edit or delete to refresh what is on screen.
  const fetchPartiesForCountry = useCallback(async () => {
    const q = queryRef.current;
    const reqId = ++reqIdRef.current;
    setPageLoading(true);
    setError(null);
    try {
      const res = await getPartiesTablePage(userRole, listParams(q, q.page, q.pageSize));
      if (reqId !== reqIdRef.current) return;
      const data = (res.data || []).filter(Boolean);
      const totalRows = Number(res.pagination?.total ?? data.length) || 0;
      setParties(data.map(decorateParty));
      setTotal(totalRows);
      if (res.counts) setServerCounts(res.counts);
      // The last row of the last page was removed: step back to the new last page.
      if (data.length === 0 && q.page > 1 && totalRows > 0) setPage(Math.max(1, Math.ceil(totalRows / q.pageSize)));
    } catch (error) {
      if (reqId !== reqIdRef.current) return;
      console.error('[fetchParties] Error:', error);
      const errorMessage = error.message?.toLowerCase() || '';
      const isNotFound = errorMessage.includes('parties not found') ||
        errorMessage.includes('no parties found') ||
        errorMessage.includes('party not found') ||
        error.statusCode === 404;

      if (!isNotFound &&
        !errorMessage.includes('token expired') &&
        !errorMessage.includes('unauthorized')) {
        setError(`Failed to load parties: ${error.message}`);
        showError(`Failed to load parties: ${error.message}`);
      }
      setParties([]);
      setTotal(0);
    } finally {
      if (reqId === reqIdRef.current) setPageLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  // Default the country filter once countries have loaded: India if present,
  // otherwise the first country, so the list is not empty on first load.
  useEffect(() => {
    if (!countriesReady || defaultCountryResolved) return;
    if (countries.length > 0 && !selectedCountryFilter && !hasSetDefaultCountry.current) {
      const india = countries.find(c =>
        c.name?.toLowerCase() === 'india' ||
        c.code?.toLowerCase() === 'in'
      );
      const defaultCountry = india || countries[0];
      console.log('[Filter] Setting default country:', defaultCountry.id);
      setSelectedCountryFilter(defaultCountry.id);
    }
    hasSetDefaultCountry.current = true;
    setDefaultCountryResolved(true);
  }, [countries, countriesReady, defaultCountryResolved, selectedCountryFilter]);

  // Fetch the page whenever the page, tab, search, filters, sort or country change (empty country = all countries)
  useEffect(() => {
    if (!defaultCountryResolved) return;
    fetchPartiesForCountry();
  }, [selectedCountryFilter, defaultCountryResolved, page, pageSize, partyQuery, activeTab, stateFilter, salesmanFilter, sortBy, sortDir, fetchPartiesForCountry]);

  // Options of the State and Salesman dropdowns come from the server, not from the rows on this page.
  useEffect(() => {
    if (!defaultCountryResolved) return undefined;
    let live = true;
    getPartyFilterOptions(selectedCountryFilter)
      .then((o) => { if (live) setFilterOptions(o); })
      .catch(() => { if (live) setFilterOptions({ states: [], salesmen: [] }); });
    return () => { live = false; };
  }, [selectedCountryFilter, defaultCountryResolved]);

  const rows = parties; // already decorated, one page
  useEffect(() => {
    const t = setTimeout(() => { setPartyQuery((prev) => { if (prev !== partySearch) setPage(1); return partySearch; }); }, 300);
    return () => clearTimeout(t);
  }, [partySearch]);
  // The search box in the top bar (global search) also searches this list.
  useEffect(() => {
    const handler = (e) => setPartySearch((e.detail?.query || '').trim());
    window.addEventListener('globalSearchChanged', handler);
    return () => window.removeEventListener('globalSearchChanged', handler);
  }, []);

  const tabCounts = {
    All: serverCounts?.all ?? 0,
    Active: serverCounts?.active ?? 0,
    'No location': serverCounts?.no_location ?? 0,
    Inactive: serverCounts?.inactive ?? 0,
  };
  const stateOptions = filterOptions.states.map((x) => ({ value: x.id, label: x.name }));
  const salesmanOptions = filterOptions.salesmen.map((x) => ({ value: x.id, label: x.name }));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows;
  const hasFilters = !!(partyQuery || stateFilter || salesmanFilter || activeTab !== 'All');
  const toggleSort = (key) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('asc'); }
    setPage(1);
  };
  const openMore = (e, row) => {
    const r = e.currentTarget.getBoundingClientRect();
    const w = 200;
    setMoreFor({ row, top: Math.min(r.bottom + 4, window.innerHeight - 140), left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) });
  };
  useEffect(() => {
    if (!moreFor) return undefined;
    const close = () => setMoreFor(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [moreFor]);
  const handleExportParties = async () => {
    // The table only holds one page, so the export asks the server for every row that matches the current view.
    let all = [];
    try {
      const q = queryRef.current;
      for (let pg = 1; pg <= 200; pg += 1) {
        const res = await getPartiesTablePage(userRole, listParams(q, pg, 100));
        all = all.concat((res.data || []).filter(Boolean).map(decorateParty));
        if (pg >= (res.pagination?.totalPages || 1)) break;
      }
    } catch (err) {
      showError(err?.message || 'Could not export the parties.');
      return;
    }
    downloadCsv('parties', [
      { label: 'Party name', value: r => r.party_name },
      { label: 'City', value: r => r.cityLabel },
      { label: 'Salesman', value: r => r.salesmanLabel },
      { label: 'Location status', value: r => r.locationLabel },
      { label: 'Credit days', value: r => Number(r.credit_days) || 0 },
      { label: 'Phone', value: r => r.phone },
      { label: 'GST', value: r => r.gstin },
    ], all);
  };

  const handleAdd = () => {
    setEditRow(null);
    setOpenAdd(true);
  };

  // Download a ready-to-fill CSV template whose headers match the party bulk
  // parser. Only party_name is required; the rest are optional.
  const handleDownloadPartySample = () => {
    const headers = [
      'party_name', 'trade_name', 'contact_person', 'email', 'phone',
      'address', 'billing_address', 'billing_same_as_shipping',
      'country', 'state', 'city', 'zone', 'pincode', 'gstin', 'pan',
      'active', 'credit_days', 'prefered_courier', 'distributor', 'salesman',
    ];
    const example = [
      'Acme Opticals', 'Acme', 'Ramesh Shah', 'acme@example.com', '9876543210',
      '12 MG Road, Andheri', '', 'yes',
      'India', 'Maharashtra', 'Mumbai', 'West', '400058', '27ABCDE1234F1Z5', 'ABCDE1234F',
      'yes', '30', 'DTDC', '', '',
    ];
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(','), example.map(esc).join(',')].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stallion-parties-sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) { showError('Please select a file first.'); return; }
    try {
      setBulkUploading(true);
      const result = await bulkUploadParties(bulkFile);
      const created = result?.data?.created ?? result?.created ?? 0;
      const updated = result?.data?.updated ?? result?.updated ?? 0;
      const skipped = result?.data?.errors?.length ?? 0;
      if (skipped > 0 && result?.message) showWarning(result.message);
      else showSuccess(`Bulk upload complete. Created: ${created}, Updated: ${updated}.`);
      setOpenBulkUpload(false);
      setBulkFile(null);
      fetchPartiesForCountry();
    } catch (err) {
      showError(`Bulk upload failed: ${err.message}`);
    } finally {
      setBulkUploading(false);
    }
  };

  // Open the shared party form for this row (it loads the lists and fills the fields itself).
  const handleEdit = async (row) => {
    if (!row) {
      setError('Invalid party data. Please refresh and try again.');
      return;
    }
    const partyId = row.id || row.party_id || row._id;
    if (!partyId) {
      console.error('Party row missing ID:', row);
      setError('Party ID is missing. Please refresh and try again.');
      return;
    }
    setOpenAdd(false);
    setEditRow({ ...row, id: partyId });
  };

  // Coming from the cart or Home for a party that has no location: open that party's Edit form.
  // After saving, the app goes back to where the salesman came from.
  const editOpenDone = useRef(false);
  useEffect(() => {
    if (editOpenDone.current) return;
    const want = takeEditParty();
    editOpenDone.current = true;
    if (!want) return;
    // The party is fetched by itself, so the form opens at once without waiting for the whole list.
    (async () => {
      try {
        const raw = await getPartyDetails(want.party_id);
        editReturnRef.current = { to: want.returnTo || null, orderType: want.orderType || null, party_id: want.party_id };
        await handleEdit({ ...raw, id: raw.party_id || raw.id });
        showWarning('Check this party and pick its address from the suggestions, then press Update.');
      } catch (e) {
        showError(`Could not open this party: ${e.message || 'unknown error'}`);
      }
    })();
  }, []);

  // Delete a party that was added by mistake (a duplicate). The server refuses when the party has orders
  // or visits and says so; the login user is never touched, because another party can share it.
  const handleDelete = async (row) => {
    const partyId = row.id || row.party_id || row._id;
    if (!partyId || typeof partyId !== 'string' || partyId.trim() === '') {
      showError('Party ID is missing. Please refresh and try again.');
      return;
    }
    if (!(await confirm(`Delete ${row.party_name || 'this party'}? Use this only for a party added by mistake, such as a duplicate. A party with orders or visits cannot be deleted; make it inactive instead.`))) {
      return;
    }
    try {
      setLoading(true);
      await deleteParty(partyId.trim());
      showSuccess('Party deleted');
      fetchPartiesForCountry();
      setError(null);
    } catch (err) {
      const msg = err?.errorData?.error || err?.message || 'Could not delete the party.';
      if (!/token expired|unauthorized/i.test(msg)) showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const closePartyForm = () => {
    editReturnRef.current = null; // closed without saving: stay on the Parties page
    setOpenAdd(false);
    setEditRow(null);
  };

  const isPartyFormOpen = openAdd || !!editRow;

  // The shared party form saved a party. The table shows one server page, so bring that page up to date
  // (a new or edited party can change which rows, tab counts and filters apply).
  const handlePartySaved = async (saved, meta = {}) => {
    if (meta.mode === 'edit' && !meta.refetch) {
      // Opened from the cart or from the check-in on Home: after a successful save go back to
      // where the salesman was (the cart with the same order type and party, or the check-in
      // with the same party chosen). Opened from the Parties page: stay here.
      const back = editReturnRef.current;
      if (back && back.to) {
        editReturnRef.current = null;
        try {
          if (back.to === '/cart') {
            sessionStorage.setItem('stallion.cartReturn', JSON.stringify({ party_id: back.party_id, orderType: back.orderType || 'visit_order', at: Date.now() }));
          } else {
            sessionStorage.setItem('stallion.homeReturn', JSON.stringify({ party_id: back.party_id, at: Date.now() }));
          }
        } catch { /* storage unavailable: the party is chosen again by hand */ }
        window.location.href = back.to;
        return;
      }
    }
    await fetchPartiesForCountry();
  };

  const handleLocationRemoved = () => { fetchPartiesForCountry(); };


  const partyMapHref = (row) => (
    Number.isFinite(Number(row.latitude)) && row.latitude !== null && row.latitude !== ''
      && Number.isFinite(Number(row.longitude)) && row.longitude !== null && row.longitude !== ''
      ? `https://www.google.com/maps/search/?api=1&query=${Number(row.latitude)},${Number(row.longitude)}`
      : null
  );
  const partyTel = (row) => {
    const d = String(row.phone || '').replace(/[^\d+]/g, '');
    return d ? `tel:${d.startsWith('+') ? d : `+${d}`}` : null;
  };
  const hasMore = (row) => !!(partyMapHref(row) || partyTel(row));

  const pills = (v) => {
    const names = splitNames(v);
    return names.length === 0 ? <span className="pp-dash">—</span> : (
      <span className="sm-pills">{names.map((n) => <span key={n} className="sm-pill">{n}</span>)}</span>
    );
  };
  const whoCell = (row) => (
    <span className="party-who">
      <span className="party-who__pic" aria-hidden="true">{String(row.party_name || '?').trim().charAt(0).toUpperCase()}</span>
      <span className="pp-who__text">
        <span className="party-who__name">{row.party_name}</span>
        <span className="pp-who__sub">{[row.cityLabel !== '—' ? row.cityLabel : '', row.stateLabel].filter(Boolean).join(', ')}</span>
      </span>
      {!row.isActive && <span className="party-who__off">Inactive</span>}
    </span>
  );
  const rowButtons = (row) => (
    <span className="pp-acts">
      {canEditParty && (
        <button type="button" className="pp-icon" aria-label={`Edit ${row.party_name || 'party'}`} onClick={() => handleEdit(row)}>
          <HugeiconsIcon icon={PencilEdit02Icon} size={18} strokeWidth={1.8} />
        </button>
      )}
      {hasMore(row) && (
        <button type="button" className="pp-icon" aria-label={`More for ${row.party_name || 'party'}`} aria-haspopup="menu" onClick={(e) => openMore(e, row)}>
          <HugeiconsIcon icon={MoreHorizontalIcon} size={18} strokeWidth={1.8} />
        </button>
      )}
    </span>
  );
  const sortTh = (key, label, cls) => (
    <th className={cls} aria-sort={sortBy === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="pp-th" onClick={() => toggleSort(key)}>
        {label}<span aria-hidden="true">{sortBy === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
      </button>
    </th>
  );
  const refresh = () => { setError(null); fetchPartiesForCountry(); };
  const firstLoad = pageLoading && rows.length === 0;
  const listVisible = firstLoad || (!error && total > 0) || (pageLoading && !error);

  return (
    <div className="dash-page">
      <div className="dash-container pp">
        <div className="pg-head pp-head">
          <div><h1>Parties</h1><p>A shop&apos;s location comes from the address you pick. The first visit saves the exact spot.</p></div>
          <div className="pp-actions">
            <button type="button" className="gbtn" onClick={refresh} disabled={loading || pageLoading}>
              <HugeiconsIcon icon={RefreshIcon} size={17} strokeWidth={1.8} /><span>Refresh</span>
            </button>
            {isPartyManager && (
              <button type="button" className="gbtn" onClick={() => setOpenBulkUpload(true)}>
                <HugeiconsIcon icon={Upload01Icon} size={17} strokeWidth={1.8} /><span>Bulk upload</span>
              </button>
            )}
            <button type="button" className="gbtn dark" onClick={handleAdd}>
              <HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={1.8} /><span>Add party</span>
            </button>
          </div>
        </div>

        <div className="order-tabs-container pp-tabs" role="tablist" aria-label="Party status">
          {['All', 'Active', 'No location', 'Inactive'].map(tab => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={`order-tab flex-shrink-0 ${activeTab === tab ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab); setPage(1); }}
            >
              {tab}
              <b className="order-tab__count">{tabCounts[tab]}</b>
            </button>
          ))}
        </div>

        <div className="pp-tools">
          <label className="pp-search">
            <HugeiconsIcon icon={Search01Icon} size={18} strokeWidth={1.8} />
            <input
              type="search"
              value={partySearch}
              onChange={(e) => { setPartySearch(e.target.value); setPage(1); }}
              placeholder="Search name, city, phone or salesman"
              aria-label="Search parties"
            />
          </label>
          <div className="pp-filters">
            <DropdownSelector
              options={[{ value: '', label: 'All countries' }, ...countries.map(country => ({ value: country.id, label: country.name }))]}
              value={selectedCountryFilter || ''}
              onChange={(newCountryId) => {
                // Single source of truth; the effect above refetches (empty = All Countries)
                setParties([]);
                setStateFilter('');
                setSalesmanFilter('');
                setPage(1);
                setSelectedCountryFilter(newCountryId || null);
              }}
              onOpen={fetchCountries}
              placeholder="All countries"
              className="pp-dd"
            />
            <DropdownSelector
              options={[{ value: '', label: 'All states' }, ...stateOptions]}
              value={stateFilter}
              onChange={(v) => { setStateFilter(v || ''); setPage(1); }}
              placeholder="State"
              className="pp-dd"
            />
            <DropdownSelector
              options={[{ value: '', label: 'All salesmen' }, ...salesmanOptions]}
              value={salesmanFilter}
              onChange={(v) => { setSalesmanFilter(v || ''); setPage(1); }}
              placeholder="Salesman"
              className="pp-dd"
            />
            <button type="button" className="gbtn pp-export" onClick={handleExportParties} disabled={loading || pageLoading || total === 0}>
              <HugeiconsIcon icon={Download01Icon} size={17} strokeWidth={1.8} /><span>Export CSV</span>
            </button>
          </div>
        </div>

        {!pageLoading && error ? (
          <div className="dash-row">
            <div className="dash-card full">
              <div className="ui-state ui-state--error">
                <div className="ui-state__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <line x1="12" y1="8" x2="12" y2="13" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <p className="ui-state__title">Couldn&apos;t load parties</p>
                <p className="ui-state__desc">{error}</p>
                <button className="ui-btn ui-btn--secondary" onClick={refresh}>Try again</button>
              </div>
            </div>
          </div>
        ) : !pageLoading && total === 0 ? (
          <div className="dash-row">
            <div className="dash-card full">
              <div className="ui-state ui-state--empty">
                <div className="ui-state__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </div>
                <p className="ui-state__title">{hasFilters ? 'No matching parties' : 'No parties yet'}</p>
                <p className="ui-state__desc">
                  {hasFilters
                    ? 'Nothing matches the search or filters. Clear them to see all parties.'
                    : selectedCountryFilter
                    ? `No parties found for ${countries.find(c => String(c.id) === String(selectedCountryFilter))?.name || 'the selected country'}. Pick another country above, or add a new party.`
                    : 'No parties found. Pick a country above, or add a new party to get started.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button className="ui-btn ui-btn--primary" onClick={handleAdd}>Add party</button>
                  {isPartyManager && (
                    <button className="ui-btn ui-btn--secondary" onClick={() => setOpenBulkUpload(true)}>Bulk upload</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {listVisible && (
          <div className="dash-card full party-n-table pp-list">
            {/* Phone: one card per party */}
            <ul className="pp-cards" aria-busy={pageLoading} style={pageLoading && !firstLoad ? { opacity: 0.55 } : undefined}>
              {firstLoad
                ? Array.from({ length: 5 }, (_, i) => <li key={i} className="pp-card pp-card--sk" aria-hidden="true" />)
                : pageRows.map((row, i) => (
                  <li key={row.id || i} className="pp-card">
                    <div className="pp-card__top">
                      {whoCell(row)}
                      {rowButtons(row)}
                    </div>
                    <div className="pp-card__mid">{pills(row.salesmanLabel)}</div>
                    <div className="pp-card__foot">
                      <span className={`loc-pill loc-pill--${row.locationState}`}>{row.locationLabel}</span>
                      <span className="party-credit">Credit {row.creditLabel}</span>
                    </div>
                  </li>
                ))}
            </ul>

            {/* Tablet and desktop: table */}
            <div className="pp-table" aria-busy={pageLoading} style={pageLoading && !firstLoad ? { opacity: 0.55 } : undefined}>
              <table>
                <thead>
                  <tr>
                    {sortTh('party_name', 'Party', 'pp-c-party')}
                    {sortTh('cityLabel', 'City', 'pp-c-city')}
                    {sortTh('salesmanLabel', 'Salesman', 'pp-c-sm')}
                    {sortTh('locationLabel', 'Location', 'pp-c-loc')}
                    {sortTh('credit_days', 'Credit days', 'pp-c-credit')}
                    <th className="pp-c-act"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {firstLoad
                    ? Array.from({ length: 6 }, (_, i) => (
                      <tr key={i} aria-hidden="true"><td colSpan={6}><span className="pp-sk" /></td></tr>
                    ))
                    : pageRows.map((row, i) => (
                      <tr key={row.id || i}>
                        <td className="pp-c-party">{whoCell(row)}</td>
                        <td className="pp-c-city">{row.cityLabel}</td>
                        <td className="pp-c-sm">{pills(row.salesmanLabel)}</td>
                        <td className="pp-c-loc"><span className={`loc-pill loc-pill--${row.locationState}`}>{row.locationLabel}</span></td>
                        <td className="pp-c-credit"><span className="party-credit">{row.creditLabel}</span></td>
                        <td className="pp-c-act">{rowButtons(row)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="pp-foot">
              <span className="pp-count">Showing {pageRows.length} of {total} parties</span>
              <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} />
              <DropdownSelector
                options={[20, 40, 60].map(n => ({ value: n, label: `${n} per page` }))}
                value={pageSize}
                onChange={(v) => { setPageSize(Number(v)); setPage(1); }}
                searchable={false}
                className="pp-dd pp-dd--size"
              />
            </div>
          </div>
        )}
      </div>

      {moreFor && typeof document !== 'undefined' && createPortal(
        <>
          <div className="pp-more__shade" onClick={() => setMoreFor(null)} aria-hidden="true" />
          <div className="pp-more" role="menu" style={{ top: moreFor.top, left: moreFor.left }}>
            {partyTel(moreFor.row) && (
              <a role="menuitem" className="pp-more__item" href={partyTel(moreFor.row)} onClick={() => setMoreFor(null)}>
                <HugeiconsIcon icon={Call02Icon} size={18} strokeWidth={1.8} />Call
              </a>
            )}
            {partyMapHref(moreFor.row) && (
              <a role="menuitem" className="pp-more__item" href={partyMapHref(moreFor.row)} target="_blank" rel="noopener noreferrer" onClick={() => setMoreFor(null)}>
                <HugeiconsIcon icon={Location01Icon} size={18} strokeWidth={1.8} />View on map
              </a>
            )}
            {isPartyManager && (
              <button type="button" role="menuitem" className="pp-more__item pp-more__item--danger" onClick={() => { const r = moreFor.row; setMoreFor(null); handleDelete(r); }}>
                <HugeiconsIcon icon={Delete02Icon} size={18} strokeWidth={1.8} />Delete party
              </button>
            )}
          </div>
        </>,
        document.body,
      )}

      <PartyFormPanel
        open={isPartyFormOpen}
        onClose={closePartyForm}
        party={editRow}
        onSaved={handlePartySaved}
        onLocationRemoved={handleLocationRemoved}
      />

      {/* Bulk Upload Modal */}
      <AsidePanel
        open={openBulkUpload}
        onClose={() => { setOpenBulkUpload(false); setBulkFile(null); }}
        title="Bulk Upload Parties"
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={() => { setOpenBulkUpload(false); setBulkFile(null); }} disabled={bulkUploading}>
              Cancel
            </button>
            <button className="ui-btn ui-btn--primary" onClick={handleBulkUpload} disabled={bulkUploading || !bulkFile}>
              {bulkUploading ? 'Uploading...' : 'Upload'}
            </button>
          </>
        )}
      >
        <div className="ui-form">
          {/* Step 1 — grab the template */}
          <div className="form-group form-group--full">
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-muted p-4">
              <div>
                <p className="m-0 text-[length:var(--text-base)] font-semibold text-text">New here? Start with the sample</p>
                <p className="m-0 mt-1 text-[length:var(--text-sm)] text-text-muted">
                  Download the template, fill one row per party (only Party Name is required), then upload it below.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadPartySample}
                className="ui-btn ui-btn--secondary inline-flex shrink-0 items-center gap-2 whitespace-nowrap"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
                </svg>
                Download Sample
              </button>
            </div>
          </div>

          {/* Step 2 — choose the file (dropzone-style) */}
          <div className="form-group form-group--full">
            <label className="ui-label">Upload file (.xlsx, .xls or .csv) *</label>
            <label
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${bulkUploading ? 'pointer-events-none opacity-60' : 'hover:border-primary hover:bg-primary-soft'} ${bulkFile ? 'border-primary bg-primary-soft' : 'border-border-strong bg-surface'}`}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                disabled={bulkUploading}
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
              />
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-text-muted">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" />
              </svg>
              {bulkFile ? (
                <span className="text-[length:var(--text-base)] font-semibold text-text break-all">{bulkFile.name}</span>
              ) : (
                <>
                  <span className="text-[length:var(--text-base)] font-semibold text-text">Tap to choose a file</span>
                  <span className="text-[length:var(--text-sm)] text-text-muted">Excel (.xlsx / .xls) or CSV</span>
                </>
              )}
            </label>
            {bulkFile && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="m-0 text-[length:var(--text-sm)] text-text-muted break-all">
                  {bulkFile.name} · {(bulkFile.size / 1024).toFixed(1)} KB
                </p>
                <button
                  type="button"
                  onClick={() => setBulkFile(null)}
                  disabled={bulkUploading}
                  className="shrink-0 text-[length:var(--text-sm)] font-semibold text-error hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      </AsidePanel>
    </div>
  );
};

export default DashboardClients;

