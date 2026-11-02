import { createPortal } from 'react-dom';
import { searchRows } from '../utils/search';
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
  getPartiesForRole,
  takeEditParty,
  getPartyDetails,
} from '../services/apiService';
import { getUser, getUserRole, getUserRoles } from '../services/authService';
import { showError, showSuccess, showWarning } from '../services/notificationService';
import { captureCurrentPosition } from '../utils/geolocation';
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

  const fetchPartiesForCountry = useCallback(async (countryId) => {
    // No country = "All Countries": the API supports it with a single
    // unfiltered request (getParties with no country_id).
    const allCountries = !countryId;

    setLoading(true);
    setError(null);
    try {
      // Validate countryId before making API call
      const cleanCountryId = allCountries ? '' : String(countryId).trim();
      if (!allCountries && (!cleanCountryId || cleanCountryId === 'undefined' || cleanCountryId === 'null')) {
        console.error('[fetchPartiesForCountry] Invalid country ID:', countryId);
        setParties([]);
        setLoading(false);
        return;
      }

      console.log('[fetchPartiesForCountry] Fetching parties for country:', cleanCountryId);
      // Role-aware: salesman/distributor/party get their own scoped parties;
      // admin & *_manager roles get the full country-filtered list.
      const partiesData = await getPartiesForRole(userRole, allCountries ? null : cleanCountryId);

      console.log('[fetchPartiesForCountry] Received', partiesData?.length || 0, 'parties from API');

      // CRITICAL: Backend returns wrong data, so we MUST filter strictly
      // Filter out ALL parties that don't match the requested country
      const validParties = (partiesData || []).filter(p => {
        if (!p) {
          console.warn('[fetchPartiesForCountry] Skipping null/undefined party');
          return false;
        }

        const partyCountryId = String(p.country_id || p.countryId || '').trim();
        // Parties without a country_id (e.g. newly added) stay visible under any selection.
        const matches = allCountries || !partyCountryId || partyCountryId === cleanCountryId;

        if (!matches) {
          console.warn('[fetchPartiesForCountry] ❌ REJECTING party - country mismatch:', {
            party_id: p.id || p.party_id,
            party_name: p.party_name,
            party_country_id: partyCountryId,
            requested_country_id: cleanCountryId,
            match: false
          });
        } else {
          console.log('[fetchPartiesForCountry] ✅ ACCEPTING party - country matches:', {
            party_id: p.id || p.party_id,
            party_name: p.party_name,
            country_id: partyCountryId
          });
        }
        return matches;
      });

      const filteredOut = partiesData.length - validParties.length;
      if (filteredOut > 0) {
        console.warn('[fetchPartiesForCountry] ⚠️ Backend returned', filteredOut, 'parties with WRONG country_id!');
        console.warn('[fetchPartiesForCountry] This is a backend issue - it should filter by country_id');
      }

      if (validParties.length > 0) {
        console.log('[fetchPartiesForCountry] ✅ Found', validParties.length, 'valid parties for country:', cleanCountryId);
      } else {
        console.log('[fetchPartiesForCountry] ℹ️ No parties found for country:', cleanCountryId);
        if (partiesData.length > 0) {
          console.warn('[fetchPartiesForCountry] ⚠️ Backend returned', partiesData.length, 'parties but none matched the requested country');
        }
      }

      // Which parties a user sees is decided by the server from the working state (salesman)
      // or the assigned distributor, so parties without a zone are still shown.
      const filteredParties = validParties;

      // Ensure all parties have consistent ID field and preserve all fields including state/city/zone
      const normalizedParties = filteredParties.map(party => {
        const partyId = party.id || party.party_id || party._id;
        return {
          ...party,
          id: partyId,
          // Ensure state/city/zone are preserved (they might be null)
          state_id: party.state_id || null,
          city_id: party.city_id || null,
          zone_id: party.zone_id || null,
        };
      });

      // Force update by creating a new array reference
      const newParties = Array.isArray(normalizedParties) ? [...normalizedParties] : [];
      console.log('[fetchPartiesForCountry] Setting', newParties.length, 'parties for country:', cleanCountryId);
      setParties(newParties);
    } catch (error) {
      console.error('[fetchPartiesForCountry] Error:', error);
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
    } finally {
      setLoading(false);
    }
  }, [isSalesman, isDistributor]);

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

  // Fetch parties when country filter changes (empty = All Countries)
  useEffect(() => {
    if (!defaultCountryResolved) return;
    fetchPartiesForCountry(selectedCountryFilter);
  }, [selectedCountryFilter, defaultCountryResolved, fetchPartiesForCountry]);

  const rows = useMemo(() => {
    // CRITICAL: Backend returns wrong data, so we MUST filter strictly by country_id
    let filteredParties = [];

    if (selectedCountryFilter) {
      const cleanFilterId = String(selectedCountryFilter).trim();
      // Show parties matching the selected country, plus parties with no country_id
      filteredParties = parties.filter(party => {
        if (!party) return false;
        const partyCountryId = String(party.country_id || party.countryId || '').trim();
        const matches = !partyCountryId || partyCountryId === cleanFilterId;

        if (!matches && party.party_name) {
          console.warn('[rows] ❌ Filtering out party with wrong country:', {
            name: party.party_name,
            party_country_id: partyCountryId,
            selected_country_id: cleanFilterId
          });
        }
        return matches;
      });
      console.log('[rows] ✅ Displaying', filteredParties.length, 'parties for country:', cleanFilterId, 'out of', parties.length, 'total');
    } else {
      // All Countries: show everything that was loaded
      filteredParties = parties.filter(Boolean);
    }



    return filteredParties.map(party => {
      // Ensure ID is preserved - check multiple possible field names
      const partyId = party.id || party.party_id || party._id;
      return {
        ...party,
        id: partyId, // Ensure ID is preserved with consistent field name
        isActive: party.is_active !== false,
        stateLabel: (typeof party.state === 'string' ? party.state : party.state?.name) || party.state_name || '',
        cityLabel: (typeof party.city === 'string' ? party.city : party.city?.name) || party.city_name || '—',
        salesmanLabel: party.salesman?.full_name || party.salesman?.salesman_name || party.salesman_name || '—',
        locationState: party.location_source === 'verified' ? 'ok'
          : (Number.isFinite(Number(party.latitude)) && party.latitude !== null && Number.isFinite(Number(party.longitude)) && party.longitude !== null ? 'warn' : 'idle'),
        locationLabel: party.location_source === 'verified' ? 'Exact spot saved'
          : (Number.isFinite(Number(party.latitude)) && party.latitude !== null && Number.isFinite(Number(party.longitude)) && party.longitude !== null ? 'From address' : 'Not set'),
        creditLabel: `${Number(party.credit_days) || 0} days`,
      };
    });
  }, [parties, selectedCountryFilter, isSalesman, isDistributor]);

  // List tools (display only): tabs, search, filters, sort and paging over the loaded rows.
  const [partySearch, setPartySearch] = useState('');
  const [partyQuery, setPartyQuery] = useState(''); // debounced copy of partySearch
  const [stateFilter, setStateFilter] = useState('');
  const [salesmanFilter, setSalesmanFilter] = useState('');
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [moreFor, setMoreFor] = useState(null); // { row, top, left }
  useEffect(() => {
    const t = setTimeout(() => setPartyQuery(partySearch), 250);
    return () => clearTimeout(t);
  }, [partySearch]);
  // The search box in the top bar (global search) also searches this list.
  useEffect(() => {
    const handler = (e) => setPartySearch((e.detail?.query || '').trim());
    window.addEventListener('globalSearchChanged', handler);
    return () => window.removeEventListener('globalSearchChanged', handler);
  }, []);

  const rowsByTab = useMemo(() => {
    if (activeTab === 'Active') return rows.filter(r => r.isActive);
    if (activeTab === 'No location') return rows.filter(r => r.locationState === 'idle');
    if (activeTab === 'Inactive') return rows.filter(r => !r.isActive);
    return rows;
  }, [rows, activeTab]);
  const tabCounts = useMemo(() => ({
    All: rows.length,
    Active: rows.filter(r => r.isActive).length,
    'No location': rows.filter(r => r.locationState === 'idle').length,
    Inactive: rows.filter(r => !r.isActive).length,
  }), [rows]);
  const stateOptions = useMemo(() => [...new Set(rows.map(r => r.stateLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [rows]);
  const salesmanOptions = useMemo(() => [...new Set(rows.flatMap(r => splitNames(r.salesmanLabel)))].sort((a, b) => a.localeCompare(b)), [rows]);

  // The list endpoints return every page of the user's parties, so search runs over the loaded rows.
  const searchedRows = useMemo(() => searchRows(
    rowsByTab,
    partyQuery,
    (r) => [r.party_name, r.trade_name, r.contact_person, r.phone, r.cityLabel, r.state_name, r.salesmanLabel, r.gstin, r.pincode],
  ), [rowsByTab, partyQuery]);
  const filteredRowsByTab = useMemo(() => {
    let out = searchedRows;
    if (stateFilter) out = out.filter(r => r.stateLabel === stateFilter);
    if (salesmanFilter) out = out.filter(r => splitNames(r.salesmanLabel).includes(salesmanFilter));
    if (sortBy) {
      const val = (r) => (sortBy === 'credit_days' ? Number(r.credit_days) || 0 : String(r[sortBy] ?? '').toLowerCase());
      out = [...out].sort((x, y) => {
        const a = val(x); const b = val(y);
        const c = typeof a === 'number' ? a - b : String(a).localeCompare(String(b));
        return sortDir === 'asc' ? c : -c;
      });
    }
    return out;
  }, [searchedRows, stateFilter, salesmanFilter, sortBy, sortDir]);
  const pageCount = Math.max(1, Math.ceil(filteredRowsByTab.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => filteredRowsByTab.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredRowsByTab, safePage, pageSize],
  );
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
  const handleExportParties = () => {
    downloadCsv('parties', [
      { label: 'Party name', value: r => r.party_name },
      { label: 'City', value: r => r.cityLabel },
      { label: 'Salesman', value: r => r.salesmanLabel },
      { label: 'Location status', value: r => r.locationLabel },
      { label: 'Credit days', value: r => Number(r.credit_days) || 0 },
      { label: 'Phone', value: r => r.phone },
      { label: 'GST', value: r => r.gstin },
    ], filteredRowsByTab);
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
      fetchPartiesForCountry(selectedCountryFilter);
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
      setParties(prev => prev.filter(party => (party.id || party.party_id || party._id) !== partyId.trim()));
      showSuccess('Party deleted');
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

  // The shared party form saved a party: bring the list up to date.
  const handlePartySaved = async (saved, meta = {}) => {
    if (meta.refetch) {
      await fetchPartiesForCountry(selectedCountryFilter);
      return;
    }
    if (meta.mode === 'edit') {
      const partyId = meta.partyId;
      const dataToSend = meta.payload;
      setParties(prev => prev.map(p => {
        const id = p.id || p.party_id || p._id;
        if (id === partyId) {
          return {
            ...p,
            ...saved,
            party_name: dataToSend.party_name,
            trade_name: dataToSend.trade_name,
            contact_person: dataToSend.contact_person,
            email: dataToSend.email,
            phone: dataToSend.phone,
            address: dataToSend.address,
            country_id: dataToSend.country_id,
            state_id: dataToSend.state_id || saved?.state_id || null,
            city_id: dataToSend.city_id || saved?.city_id || null,
            zone_id: dataToSend.zone_id || saved?.zone_id || null,
            pincode: dataToSend.pincode,
            gstin: dataToSend.gstin,
            pan: dataToSend.pan,
            credit_days: dataToSend.credit_days,
            prefered_courier: dataToSend.prefered_courier,
            ...(isAdmin ? { is_active: dataToSend.is_active } : {}),
            id: id
          };
        }
        return p;
      }));
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
      await fetchPartiesForCountry(selectedCountryFilter);
      return;
    }
    // A new party: add it to the table if it matches the current filter, otherwise reload.
    const newParty = saved;
    if (newParty && (!selectedCountryFilter || !newParty.country_id || String(newParty.country_id) === String(selectedCountryFilter))) {
      setParties(prev => [...prev, {
        ...newParty,
        id: newParty.id || newParty.party_id,
        isActive: newParty.is_active !== false,
      }]);
    } else {
      await fetchPartiesForCountry(selectedCountryFilter);
    }
  };

  const handleLocationRemoved = (partyId, cleared) => {
    setParties(prev => prev.map(p => ((p.id || p.party_id) === partyId ? { ...p, ...cleared } : p)));
  };


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
  const refresh = () => { setError(null); fetchPartiesForCountry(selectedCountryFilter); };
  const listVisible = loading || (!error && filteredRowsByTab.length > 0);

  return (
    <div className="dash-page">
      <div className="dash-container pp">
        <div className="pg-head pp-head">
          <div><h1>Parties</h1><p>A shop&apos;s location comes from the address you pick. The first visit saves the exact spot.</p></div>
          <div className="pp-actions">
            <button type="button" className="gbtn" onClick={refresh} disabled={loading}>
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
              options={[{ value: '', label: 'All states' }, ...stateOptions.map(n => ({ value: n, label: n }))]}
              value={stateFilter}
              onChange={(v) => { setStateFilter(v || ''); setPage(1); }}
              placeholder="State"
              className="pp-dd"
            />
            <DropdownSelector
              options={[{ value: '', label: 'All salesmen' }, ...salesmanOptions.map(n => ({ value: n, label: n }))]}
              value={salesmanFilter}
              onChange={(v) => { setSalesmanFilter(v || ''); setPage(1); }}
              placeholder="Salesman"
              className="pp-dd"
            />
            <button type="button" className="gbtn pp-export" onClick={handleExportParties} disabled={loading || filteredRowsByTab.length === 0}>
              <HugeiconsIcon icon={Download01Icon} size={17} strokeWidth={1.8} /><span>Export CSV</span>
            </button>
          </div>
        </div>

        {!loading && error ? (
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
        ) : !loading && filteredRowsByTab.length === 0 ? (
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
                <p className="ui-state__title">{rows.length > 0 ? 'No matching parties' : 'No parties yet'}</p>
                <p className="ui-state__desc">
                  {rows.length > 0
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
            <ul className="pp-cards" aria-busy={loading}>
              {loading
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
            <div className="pp-table">
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
                  {loading
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
              <span className="pp-count">Showing {pageRows.length} of {filteredRowsByTab.length} parties</span>
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

