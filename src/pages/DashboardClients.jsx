import { searchRows } from '../utils/search';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import AsidePanel from '../components/ui/AsidePanel';
import { useConfirm } from '../components/ui/ConfirmProvider';
import DropdownSelector from '../components/ui/DropdownSelector';
import Pagination from '../components/ui/Pagination';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Call02Icon, Download01Icon, Location01Icon, MoreHorizontalIcon, PencilEdit02Icon, RefreshIcon, Search01Icon, Upload01Icon } from '@hugeicons/core-free-icons';
import {
  bulkUploadParties,
  createParty,
  deleteParty,
  getCities,
  getIndianCountries,
  getPartiesForRole,
  getStates,
  getZones,
  removePartyLocation,
  updateParty,
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
import { FormProgress } from '../components/forms/FormBits';
import AddressAutocomplete from '../components/ui/AddressAutocomplete';

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
  // Admin-only party-location capture (geofence anchor).
  const [savingLoc, setSavingLoc] = useState(false);
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
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);

  const hasSetDefaultCountry = useRef(false);
  const [countriesReady, setCountriesReady] = useState(false);
  const [defaultCountryResolved, setDefaultCountryResolved] = useState(false);

  const [formData, setFormData] = useState({
    party_name: '',
    trade_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    billing_address: '',
    billing_same_as_shipping: true,
    country_id: '',
    state_id: '',
    city_id: '',
    zone_id: '',
    pincode: '',
    gstin: '',
    pan: '',
    credit_days: '',
    prefered_courier: '',
    is_active: true,
    latitude: null,
    longitude: null,
    location_source: null,
    location_accuracy_m: null,
  });

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

  const fetchStates = async (countryId) => {
    if (!countryId) {
      setStates([]);
      return;
    }
    try {
      const statesData = await getStates(countryId);
      setStates(statesData || []);
    } catch (error) {
      console.error('Failed to load states:', error);
      setStates([]);
    }
  };

  const fetchCities = async (stateId) => {
    if (!stateId) {
      setCities([]);
      return;
    }
    try {
      const citiesData = await getCities(stateId);
      setCities(citiesData || []);
    } catch (error) {
      console.error('Failed to load cities:', error);
      setCities([]);
    }
  };

  const fetchZones = async (cityId) => {
    if (!cityId) {
      setZones([]);
      return;
    }
    try {
      const zonesData = await getZones(cityId);
      setZones(zonesData || []);
    } catch (error) {
      console.error('Failed to load zones:', error);
      setZones([]);
    }
  };

  // Use refs to track previous values and detect user-initiated changes
  const prevCountryIdRef = useRef('');
  const prevStateIdRef = useRef('');
  const prevCityIdRef = useRef('');
  const isInitializingEditRef = useRef(false);

  // Fetch states when country changes
  useEffect(() => {
    if (formData.country_id) {
      fetchStates(formData.country_id);
      // Only reset dependent fields if country actually changed by user (not during edit initialization)
      if (!isInitializingEditRef.current && prevCountryIdRef.current !== '' && prevCountryIdRef.current !== formData.country_id) {
        // User changed the country, reset dependent fields
        setFormData(prev => ({ ...prev, state_id: '', city_id: '', zone_id: '' }));
        setCities([]);
        setZones([]);
      }
      prevCountryIdRef.current = formData.country_id;
    } else {
      setStates([]);
      if (!isInitializingEditRef.current) {
        setCities([]);
        setZones([]);
      }
      prevCountryIdRef.current = '';
    }
  }, [formData.country_id]);

  // Fetch cities when state changes
  useEffect(() => {
    if (formData.state_id) {
      fetchCities(formData.state_id);
      // Only reset if state actually changed by user
      if (!isInitializingEditRef.current && prevStateIdRef.current !== '' && prevStateIdRef.current !== formData.state_id) {
        // User changed the state, reset dependent fields
        setFormData(prev => ({ ...prev, city_id: '', zone_id: '' }));
        setZones([]);
      }
      prevStateIdRef.current = formData.state_id;
    } else {
      if (!isInitializingEditRef.current) {
        setCities([]);
        setZones([]);
      }
      prevStateIdRef.current = '';
    }
  }, [formData.state_id]);

  // Fetch zones when city changes
  useEffect(() => {
    if (formData.city_id) {
      fetchZones(formData.city_id);
      // Only reset if city actually changed by user
      if (!isInitializingEditRef.current && prevCityIdRef.current !== '' && prevCityIdRef.current !== formData.city_id) {
        // User changed the city, reset zone
        setFormData(prev => ({ ...prev, zone_id: '' }));
      }
      prevCityIdRef.current = formData.city_id;
    } else {
      if (!isInitializingEditRef.current) {
        setZones([]);
      }
      prevCityIdRef.current = '';
    }
  }, [formData.city_id]);

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

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Helper function to validate UUID format (accessible in render)
  const isValidUUID = (str) => {
    if (!str || str.trim() === '') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str.trim());
  };

  const resetForm = () => {
    setFormData({
      party_name: '',
      trade_name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      billing_address: '',
      billing_same_as_shipping: true,
      country_id: '',
      state_id: '',
      city_id: '',
      zone_id: '',
      pincode: '',
      gstin: '',
      pan: '',
      credit_days: '',
      prefered_courier: '',
      is_active: true,
      latitude: null,
      longitude: null,
      location_source: null,
      location_accuracy_m: null,
    });
  };

  const handleAdd = () => {
    resetForm();
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

  // A Google address was picked: fill the address, pincode, country, state and city. Anything
  // the lists did not have was added by the server, so the dropdowns are reloaded first.
  const handleAddressPick = async (d) => {
    if (d.blocked && d.blocked.what === 'state_not_allotted') {
      showWarning(`${d.blocked.name || 'This state'} is not one of the states you work in, so a party cannot be added there. Ask an admin to add it to your working states.`);
      return;
    }
    if (d.blocked) {
      const names = d.names || {};
      showWarning(`${names[d.blocked.what] || d.blocked.name} is switched off in Manage. The address is filled in; ask an admin to switch it on, then pick the ${d.blocked.what} yourself.`);
      setFormData(prev => ({ ...prev, address: d.address || d.address_line || d.suggestion_main, pincode: d.pincode || prev.pincode, address_lat: d.latitude ?? null, address_lng: d.longitude ?? null }));
      return;
    }
    isInitializingEditRef.current = true;
    try {
      if (d.country_id) {
        try { setCountries((await getIndianCountries()) || []); } catch { /* the old list stays */ }
        await fetchStates(d.country_id);
        if (d.state_id) await fetchCities(d.state_id);
        if (d.city_id) await fetchZones(d.city_id);
        prevCountryIdRef.current = d.country_id;
        prevStateIdRef.current = d.state_id || '';
        prevCityIdRef.current = d.city_id || '';
      }
      setFormData(prev => ({
        ...prev,
        address: d.address || d.address_line || d.suggestion_main,
        pincode: d.pincode || prev.pincode,
        // The shop's point comes from the picked address; it is saved with the party.
        address_lat: d.latitude ?? null,
        address_lng: d.longitude ?? null,
        ...(d.country_id ? { country_id: d.country_id, state_id: d.state_id || '', city_id: d.city_id || '', zone_id: '' } : {}),
      }));
      if (d.added && d.added.length) showSuccess(`Added to your lists: ${d.added.join(', ')}.`);
    } finally {
      setTimeout(() => { isInitializingEditRef.current = false; }, 300);
    }
  };

  const handleRemoveLocation = async () => {
    const partyId = editRow?.id || editRow?.party_id;
    if (!partyId) return;
    if (!(await confirm('Remove this party\'s saved location? Visit orders and check-ins stay blocked until its address is picked again in Edit party.'))) {
      return;
    }
    try {
      setSavingLoc(true);
      await removePartyLocation(partyId);
      const cleared = { latitude: null, longitude: null, location_source: null, location_accuracy_m: null };
      setParties(prev => prev.map(p => ((p.id || p.party_id) === partyId ? { ...p, ...cleared } : p)));
      setEditRow(prev => (prev ? { ...prev, ...cleared } : prev));
      setFormData(prev => ({ ...prev, ...cleared }));
      showSuccess('Location removed. Pick the address again in Edit party to set it.');
    } catch (err) {
      showError(err?.message || 'Could not remove the location. Please try again.');
    } finally {
      setSavingLoc(false);
    }
  };

  const handleEdit = async (row) => {
    // Ensure we have the full row object with ID
    if (!row) {
      setError('Invalid party data. Please refresh and try again.');
      return;
    }

    // Check for ID in various possible field names
    const partyId = row.id || row.party_id || row._id;
    if (!partyId) {
      console.error('Party row missing ID:', row);
      setError('Party ID is missing. Please refresh and try again.');
      return;
    }

    // Set flag to prevent useEffect from resetting fields during initialization
    isInitializingEditRef.current = true;
    setOpenAdd(false);

    try {
      // Load the cascade lists FIRST so the selected values show their labels.
      // Countries included so the Country field isn't blank in edit mode.
      await fetchCountries();
      if (row.country_id) {
        await fetchStates(row.country_id);
        if (row.state_id) {
          await fetchCities(row.state_id);
          if (row.city_id) {
            await fetchZones(row.city_id);
          }
        }
      }

      // Set previous values to current values to prevent reset
      prevCountryIdRef.current = row.country_id || '';
      prevStateIdRef.current = row.state_id || '';
      prevCityIdRef.current = row.city_id || '';

      // Now set formData after all data is loaded
      setFormData({
        party_name: row.party_name || '',
        trade_name: row.trade_name || '',
        contact_person: row.contact_person || '',
        email: row.email || '',
        phone: row.phone || '',
        address: row.address || '',
        billing_address: row.billing_address || '',
        billing_same_as_shipping: row.billing_same_as_shipping !== false,
        country_id: row.country_id || '',
        state_id: row.state_id || '',
        city_id: row.city_id || '',
        zone_id: row.zone_id || '',
        pincode: row.pincode || '',
        gstin: row.gstin || '',
        pan: row.pan || '',
        credit_days: row.credit_days || '',
        prefered_courier: row.prefered_courier || row.preferred_courier || '',
        is_active: row.is_active !== false,
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        location_source: row.location_source || null,
        location_accuracy_m: row.location_accuracy_m ?? null,
      });

      // Store the complete row object with ensured ID
      setEditRow({ ...row, id: partyId });
    } finally {
      // Reset flag after a short delay to allow formData to be set
      setTimeout(() => {
        isInitializingEditRef.current = false;
      }, 200);
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (row) => {
    if (!(await confirm(`Are you sure you want to delete this party? This will also delete the associated user account.`))) {
      return;
    }

    // Check for ID in various possible field names
    const partyId = row.id || row.party_id || row._id;
    if (!partyId || typeof partyId !== 'string' || partyId.trim() === '') {
      showError('Party ID is missing. Please refresh and try again.');
      return;
    }

    // Get phone number from party to find associated user
    const partyPhone = row.phone || row.phoneNumber || '';

    try {
      setLoading(true);
      setError(null);

      // Delete party first
      console.log('[Delete Party] Deleting party with ID:', partyId.trim());
      await deleteParty(partyId.trim());
      console.log('[Delete Party] Party deleted successfully');

      // Optimistically remove from table immediately
      setParties(prevParties => prevParties.filter(party => {
        const id = party.id || party.party_id || party._id;
        return id !== partyId.trim();
      }));

      // Now find and delete the associated login account by phone number. Listing
      // users is admin-only, so other managers skip this step.
      if (partyPhone && isAdmin) {
        try {
          const { getUsers, deleteUser } = await import('../services/apiService');
          console.log('[Delete Party] Finding user account with phone:', partyPhone);

          // Get all users
          const usersResponse = await getUsers();
          let usersArray = [];
          if (Array.isArray(usersResponse)) {
            usersArray = usersResponse;
          } else if (usersResponse && Array.isArray(usersResponse.data)) {
            usersArray = usersResponse.data;
          } else if (usersResponse && Array.isArray(usersResponse.users)) {
            usersArray = usersResponse.users;
          }

          console.log('[Delete Party] Total users found:', usersArray.length);

          // Normalize phone numbers for comparison (remove +, spaces, dashes)
          const normalizePhone = (phone) => {
            if (!phone) return '';
            return String(phone).trim().replace(/^\+/, '').replace(/[\s-]/g, '');
          };

          const normalizedPartyPhone = normalizePhone(partyPhone);

          // Find user by phone number
          const foundUser = usersArray.find(u => {
            const userPhone = (u.phone || u.phoneNumber || '').trim();
            const normalizedUserPhone = normalizePhone(userPhone);

            return userPhone === partyPhone ||
              normalizedUserPhone === normalizedPartyPhone ||
              userPhone === `+${partyPhone}` ||
              `+${userPhone}` === partyPhone;
          });

          if (foundUser) {
            const userId = foundUser.user_id || foundUser.id;
            console.log('[Delete Party] Found associated user account:', {
              userId,
              userPhone: foundUser.phone || foundUser.phoneNumber,
              userName: foundUser.full_name || foundUser.name
            });

            try {
              await deleteUser(userId);
              console.log('[Delete Party] User account deleted successfully');
              showSuccess('Party and associated user account deleted successfully!');
            } catch (deleteError) {
              console.error('[Delete Party] Error calling deleteUser:', deleteError);
              throw deleteError;
            }
          } else {
            console.warn('[Delete Party] No user account found with phone:', partyPhone);
            console.warn('[Delete Party] Available user phones:', usersArray.map(u => ({
              id: u.user_id || u.id,
              phone: u.phone || u.phoneNumber,
              name: u.full_name || u.name
            })));
            showSuccess('Party deleted successfully!');
          }
        } catch (userDeleteError) {
          console.error('[Delete Party] Error deleting user account:', userDeleteError);
          console.error('[Delete Party] Error details:', {
            message: userDeleteError.message,
            errorData: userDeleteError.errorData,
            statusCode: userDeleteError.statusCode
          });
          showSuccess('Party deleted. Its login account could not be removed, please ask an admin to remove it.');
        }
      } else {
        console.warn('[Delete Party] No phone number found in party record');
        showSuccess('Party deleted successfully!');
      }

      setError(null);
    } catch (error) {
      if (!error.message?.toLowerCase().includes('token expired') &&
        !error.message?.toLowerCase().includes('unauthorized')) {
        const errorMsg = error.message || 'Failed to delete party';
        setError(errorMsg);
        showError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Helper function to validate UUID format
    const isValidUUID = (str) => {
      if (!str || str.trim() === '') return false;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str.trim());
    };

    // Required fields — block the save with a clear toast if any is empty, so a
    // half-filled party can't slip through. Text inputs first, then the
    // dropdowns (which need a valid selected id).
    const requiredText = [
      ['party_name', 'Party Name'],
      ['trade_name', 'Trade Name'],
      ['contact_person', 'Contact Person'],
      ['phone', 'Phone'],
      ['address', 'Address'],
      ['pincode', 'Pincode'],
    ];
    for (const [key, label] of requiredText) {
      if (!formData[key] || String(formData[key]).trim() === '') {
        showError(`${label} is required.`);
        setLoading(false);
        return;
      }
    }
    // Email is optional; only validate the format when one is entered.
    if (String(formData.email || '').trim() !== '' &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(formData.email).trim())) {
      showError('Please enter a valid email address.');
      setLoading(false);
      return;
    }
    // Required dropdowns (must have a valid selected id).
    if (!formData.country_id || !isValidUUID(formData.country_id)) {
      showError('Please select a country.');
      setLoading(false);
      return;
    }
    if (!formData.state_id || !isValidUUID(formData.state_id)) {
      showError('Please select a state.');
      setLoading(false);
      return;
    }
    if (!formData.city_id || !isValidUUID(formData.city_id)) {
      showError('Please select a city.');
      setLoading(false);
      return;
    }
    // Preferred courier is required when creating a party.
    if (!editRow && (!formData.prefered_courier || formData.prefered_courier.trim() === '')) {
      showError('Preferred Courier is required.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Debug: Log formData before processing
      console.log('[DashboardClients] Form Data before processing:', {
        state_id: formData.state_id,
        city_id: formData.city_id,
        zone_id: formData.zone_id,
        state_id_type: typeof formData.state_id,
        state_id_valid: formData.state_id ? isValidUUID(formData.state_id) : false,
      });

      // Build payload matching exact structure: all strings as strings, UUIDs as strings or null
      // For optional UUID fields: if provided and valid format, send as string; otherwise null
      const getStateId = () => {
        const value = formData.state_id?.trim() || '';
        if (value === '') return null;
        const uuidValue = isValidUUID(value) ? String(value) : null;
        console.log('[getStateId] Input:', value, 'Output:', uuidValue);
        return uuidValue;
      };

      const getCityId = () => {
        const value = formData.city_id?.trim() || '';
        if (value === '') return null;
        const uuidValue = isValidUUID(value) ? String(value) : null;
        console.log('[getCityId] Input:', value, 'Output:', uuidValue);
        return uuidValue;
      };

      const getZoneId = () => {
        const value = formData.zone_id?.trim() || '';
        if (value === '') return null;
        const uuidValue = isValidUUID(value) ? String(value) : null;
        console.log('[getZoneId] Input:', value, 'Output:', uuidValue);
        return uuidValue;
      };

      const stateIdValue = getStateId();
      const cityIdValue = getCityId();
      const zoneIdValue = getZoneId();

      const dataToSend = {
        party_name: String(formData.party_name || ''),
        trade_name: String(formData.trade_name || ''),
        contact_person: String(formData.contact_person || ''),
        email: String(formData.email || ''),
        phone: String(formData.phone || ''),
        address: String(formData.address || ''),
        country_id: (formData.country_id && isValidUUID(formData.country_id)) ? String(formData.country_id).trim() : null,
        state_id: stateIdValue,
        city_id: cityIdValue,
        zone_id: zoneIdValue,
        pincode: String(formData.pincode || ''),
        gstin: String(formData.gstin || ''),
        pan: String(formData.pan || ''),
        credit_days: formData.credit_days ? Number(formData.credit_days) : null,
        prefered_courier: formData.prefered_courier && formData.prefered_courier.trim() !== '' ? String(formData.prefered_courier).trim() : null,
        billing_same_as_shipping: formData.billing_same_as_shipping !== false,
        billing_address: formData.billing_same_as_shipping === false ? String(formData.billing_address || '') : null,
      };
      // Only admin may change active status — sending is_active from other roles
      // makes the backend return 403 and the whole edit fails.
      if (isAdmin) {
        dataToSend.is_active = formData.is_active !== false;
      }

      console.log('[Update] Form data state/city/zone:', {
        state_id: formData.state_id,
        city_id: formData.city_id,
        zone_id: formData.zone_id,
      });
      console.log('[Update] Sending state/city/zone:', {
        state_id: stateIdValue,
        city_id: cityIdValue,
        zone_id: zoneIdValue,
      });

      // Final validation: ensure no undefined values and all fields are present
      const allFields = ['party_name', 'trade_name', 'contact_person', 'email', 'phone', 'address', 'billing_address', 'billing_same_as_shipping', 'country_id', 'state_id', 'city_id', 'zone_id', 'pincode', 'gstin', 'pan', 'credit_days', 'prefered_courier'];
      if (isAdmin) allFields.push('is_active');
      allFields.forEach(key => {
        if (dataToSend[key] === undefined) {
          console.warn(`[DashboardClients] Undefined value detected for ${key}, setting to default`);
          dataToSend[key] = key.includes('_id') ? null : '';
        }
      });

      // Ensure country_id is never null (it's required)
      if (!dataToSend.country_id) {
        setError('Country is required. Please select a country.');
        setLoading(false);
        return;
      }

      console.log('[DashboardClients] Data to send:', JSON.stringify(dataToSend, null, 2));
      console.log('[DashboardClients] Data keys:', Object.keys(dataToSend));
      console.log('[DashboardClients] Has undefined:', Object.values(dataToSend).some(v => v === undefined));
      console.log('[DashboardClients] All fields present:', allFields.every(f => dataToSend.hasOwnProperty(f)));

      // The point of the picked Google address (the shop's location until the first visit saves the exact spot).
      if (formData.address_lat !== null && formData.address_lat !== undefined && formData.address_lng !== null && formData.address_lng !== undefined
        && Number.isFinite(Number(formData.address_lat)) && Number.isFinite(Number(formData.address_lng))) {
        dataToSend.address_lat = Number(formData.address_lat);
        dataToSend.address_lng = Number(formData.address_lng);
      }

      if (editRow) {
        // Validate that editRow has an ID (check multiple possible field names)
        const partyId = editRow.id || editRow.party_id || editRow._id;
        if (!partyId || typeof partyId !== 'string' || partyId.trim() === '') {
          console.error('EditRow missing or invalid ID:', editRow);
          setError('Party ID is missing or invalid. Please refresh and try again.');
          setLoading(false);
          return;
        }

        try {
          const updatedParty = await updateParty(partyId.trim(), dataToSend);

          setParties(prev => prev.map(p => {
            const id = p.id || p.party_id || p._id;
            if (id === partyId.trim()) {
              return {
                ...p,
                ...updatedParty,
                party_name: dataToSend.party_name,
                trade_name: dataToSend.trade_name,
                contact_person: dataToSend.contact_person,
                email: dataToSend.email,
                phone: dataToSend.phone,
                address: dataToSend.address,
                country_id: dataToSend.country_id,
                state_id: dataToSend.state_id || updatedParty?.state_id || null,
                city_id: dataToSend.city_id || updatedParty?.city_id || null,
                zone_id: dataToSend.zone_id || updatedParty?.zone_id || null,
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

          setOpenAdd(false);
          setEditRow(null);
          resetForm();
          showSuccess(updatedParty?.location_reset
            ? 'Party updated. The address changed, so the saved shop spot was cleared. The new address sets the location; the next visit saves the exact spot.'
            : 'Party updated successfully!');
          setError(null);

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
        } catch (apiError) {
          const errorMsg = String(apiError.message || apiError.error || 'Failed to update party');
          const isInitError = apiError.isInitializationError ||
            errorMsg.toLowerCase().includes("cannot access 'party' before initialization") ||
            (errorMsg.toLowerCase().includes('cannot access') && errorMsg.toLowerCase().includes('before initialization'));

          if (isInitError) {
            // Backend timing quirk — refresh to verify whether the update landed.
            console.warn('[Update] Backend initialization error detected, refreshing data...');
            try {
              await fetchPartiesForCountry(selectedCountryFilter);
              setOpenAdd(false);
              setEditRow(null);
              resetForm();
              showSuccess('Party updated successfully!');
              setError(null);
            } catch (fetchError) {
              console.error('[Update] Failed to refresh data:', fetchError);
              showError(errorMsg);
              setError(errorMsg);
            }
          } else {
            showError(errorMsg);
            setError(errorMsg);
          }
        }
      } else {
        // Create new party. The backend creates the party's login user itself
        // (findOrCreateRoleUser by phone, and it ignores any user_id we send), so
        // we must NOT pre-register here — that old step called admin-only
        // endpoints (/roles, /auth/register) and returned "Access denied -
        // insufficient permissions" for salesmen / field roles creating a party.
        try {
          const newParty = await createParty(dataToSend);
          // The location comes from the picked address; say so when none could be found.
          const noLocation = newParty?.location_status === 'none';
          if (noLocation) {
            showWarning('Party created, but no location was found for this address. Pick the address from the suggestions so the shop gets a location.');
          } else {
            showSuccess('Party created successfully!');
          }

          // Optimistically add to table if it matches the current filter
          if (newParty && (!selectedCountryFilter || !newParty.country_id || String(newParty.country_id) === String(selectedCountryFilter))) {
            setParties(prev => [...prev, {
              ...newParty,
              id: newParty.id || newParty.party_id,
              isActive: newParty.is_active !== false,
            }]);
          } else {
            // If country doesn't match filter, just refresh
            await fetchPartiesForCountry(selectedCountryFilter);
          }

          setError(null);
          setOpenAdd(false);
          setEditRow(null);
          resetForm();
          // Reopen the new party so the address can be picked from the suggestions right now.
          if (noLocation && (newParty?.party_id || newParty?.id)) {
            await handleEdit({ ...newParty, id: newParty.party_id || newParty.id });
          }
        } catch (error) {
          // Handle foreign key constraint errors by retrying with null values
          // Check both error.message and error.error (in case error is wrapped)
          const errorMsg = (error.message || error.error || JSON.stringify(error) || '').toLowerCase();
          const fullErrorText = JSON.stringify(error).toLowerCase();
          console.log('[Create Error] Full error object:', error);
          console.log('[Create Error] Error message:', errorMsg);
          console.log('[Create Error] Full error text:', fullErrorText);

          if (errorMsg.includes('foreign key constraint') || fullErrorText.includes('foreign key constraint')) {
            let retryData = { ...dataToSend };
            let fixedFields = [];

            // Check for each foreign key field (case-insensitive) - check both errorMsg and fullErrorText
            const checkText = errorMsg + ' ' + fullErrorText;

            // More specific pattern matching for foreign key field names
            // Match: FOREIGN KEY (`state_id`), `state_id`, state_id, or references states (`id`)
            const stateIdPattern = /(?:foreign\s+key\s*\([^)]*`?state_id`?|`state_id`|state_id|references\s+states\s*\(`id`\))/i;
            const cityIdPattern = /(?:foreign\s+key\s*\([^)]*`?city_id`?|`city_id`|city_id|references\s+cities\s*\(`id`\))/i;
            const zoneIdPattern = /(?:foreign\s+key\s*\([^)]*`?zone_id`?|`zone_id`|zone_id|references\s+zones\s*\(`id`\))/i;

            if (stateIdPattern.test(checkText) || checkText.includes('state_id') || checkText.includes('states')) {
              retryData.state_id = null;
              fixedFields.push('State ID');
              setFormData(prev => ({ ...prev, state_id: '' }));
              console.log('[Create] Detected state_id foreign key error');
            }
            if (cityIdPattern.test(checkText) || checkText.includes('city_id') || checkText.includes('cities')) {
              retryData.city_id = null;
              fixedFields.push('City ID');
              setFormData(prev => ({ ...prev, city_id: '' }));
              console.log('[Create] Detected city_id foreign key error');
            }
            if (zoneIdPattern.test(checkText) || checkText.includes('zone_id') || checkText.includes('zones')) {
              retryData.zone_id = null;
              fixedFields.push('Zone ID');
              setFormData(prev => ({ ...prev, zone_id: '' }));
              console.log('[Create] Detected zone_id foreign key error');
            }

            // Retry with null values for invalid foreign keys
            if (fixedFields.length > 0) {
              console.log(`[Create] Retrying with null values for: ${fixedFields.join(', ')}`);
              console.log('[Create] Retry data:', JSON.stringify(retryData, null, 2));
              try {
                await createParty(retryData);
                showSuccess(`Party created successfully! (${fixedFields.join(', ')} set to null due to invalid references)`);
                await fetchPartiesForCountry(selectedCountryFilter);
                setError(null);
                setOpenAdd(false);
                setEditRow(null);
                resetForm();
                return;
              } catch (retryError) {
                // If retry also fails, check for other foreign key errors
                const retryErrorMsg = (retryError.message || retryError.error || JSON.stringify(retryError) || '').toLowerCase();
                const retryFullText = JSON.stringify(retryError).toLowerCase();
                if (retryErrorMsg.includes('foreign key constraint') || retryFullText.includes('foreign key constraint')) {
                  // Recursively handle remaining foreign key errors
                  console.log('[Create] Retry failed, setting all location IDs to null...');
                  // Set all optional foreign keys to null as a last resort
                  retryData.state_id = null;
                  retryData.city_id = null;
                  retryData.zone_id = null;
                  await createParty(retryData);
                  showSuccess('Party created successfully! (All location IDs set to null due to invalid references)');
                  await fetchPartiesForCountry(selectedCountryFilter);
                  setError(null);
                  setOpenAdd(false);
                  setEditRow(null);
                  resetForm();
                  return;
                }
                throw retryError; // Re-throw if retry error is not a foreign key error
              }
            } else {
              // If no fields were fixed but we have a foreign key error, set all to null
              console.log('[Create] Foreign key error detected but no specific field found, setting all location IDs to null');
              retryData.state_id = null;
              retryData.city_id = null;
              retryData.zone_id = null;
              try {
                await createParty(retryData);
                showSuccess('Party created successfully! (All location IDs set to null due to invalid references)');
                await fetchPartiesForCountry(selectedCountryFilter);
                setError(null);
                setOpenAdd(false);
                setEditRow(null);
                resetForm();
                return;
              } catch (retryError) {
                throw retryError;
              }
            }
          }
          throw error; // Re-throw if not a foreign key error or if retry failed
        }
      }
    } catch (error) {
      if (!error.message?.toLowerCase().includes('token expired') &&
        !error.message?.toLowerCase().includes('unauthorized')) {
        // Suppress backend initialization errors - already handled above
        const errorMsg = (error.message || '').toLowerCase();
        if (errorMsg.includes("cannot access") && errorMsg.includes("before initialization")) {
          // Already handled, just refresh data
          await fetchPartiesForCountry(selectedCountryFilter);
          showError('Table data may not be updated. Please refresh the page to verify.');
          setError(null);
          setOpenAdd(false);
          setEditRow(null);
          resetForm();
          return;
        }

        // Handle other errors
        let displayError = error.message || 'Failed to save party';

        // Provide user-friendly error messages for foreign key constraints
        if (displayError.includes('foreign key constraint')) {
          if (displayError.includes('state_id')) {
            displayError = 'Invalid State ID. The state does not exist in the database.';
          } else if (displayError.includes('city_id')) {
            displayError = 'Invalid City ID. The city does not exist in the database.';
          } else if (displayError.includes('zone_id')) {
            displayError = 'Invalid Zone ID. The zone does not exist in the database.';
          } else if (displayError.includes('country_id')) {
            displayError = 'Invalid Country ID. Please select a valid country.';
          } else {
            displayError = 'Invalid reference ID. One or more of the location IDs (state, city, or zone) does not exist in the database.';
          }
        }

        setError(displayError);
        showError(displayError);
      }
    } finally {
      setLoading(false);
    }
  };

  const closePartyForm = () => {
    editReturnRef.current = null; // closed without saving: stay on the Parties page
    setOpenAdd(false);
    setEditRow(null);
    resetForm();
  };

  const isPartyFormOpen = openAdd || !!editRow;

  const partyField = (label, req, node, hint) => (
    <div className="pf-field">
      <label className="ui-label">{label}{req ? ' *' : ''}</label>
      {node}
      {hint}
    </div>
  );
  const creditLocked = !!editRow && !isPartyManager;

  const renderPartyFormFields = () => (
    <div className="pf rf-form">
      <FormProgress
        label="Name, address, terms"
        done={['party_name', 'trade_name', 'contact_person', 'phone', 'address', 'country_id', 'state_id', 'city_id', 'pincode'].filter((k) => String(formData[k] ?? '').trim() !== '').length}
        total={9}
      />
      <section className="pf-sec" aria-labelledby="pf-h-party">
        <h3 id="pf-h-party" className="pf-sec__h">Party</h3>
        <p className="pf-sec__d">Who the shop is and how to reach it.</p>
        <div className="pf-grid">
          {partyField('Party name', true, (
            <input className="ui-input" placeholder="Party name" value={formData.party_name}
              onChange={(e) => handleInputChange('party_name', e.target.value)} required />
          ))}
          {partyField('Trade name', true, (
            <input className="ui-input" placeholder="Trade name" value={formData.trade_name}
              onChange={(e) => handleInputChange('trade_name', e.target.value)} required />
          ))}
          {partyField('Contact person', true, (
            <input className="ui-input" placeholder="Contact person" value={formData.contact_person}
              onChange={(e) => handleInputChange('contact_person', e.target.value)} required />
          ))}
          {partyField('Phone', true, (
            <PhoneInput
              defaultCountry="in"
              value={formData.phone ? (String(formData.phone).startsWith('+') ? String(formData.phone) : '+' + formData.phone) : ''}
              onChange={(phone) => handleInputChange('phone', phone.replace(/^\+/, ''))}
              className="phone-intl"
              inputProps={{ required: true, placeholder: 'Enter your phone number' }}
            />
          ))}
          {partyField('Email', false, (
            <input className="ui-input" type="email" placeholder="Optional" value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)} />
          ))}
        </div>
      </section>

      <section className="pf-sec" aria-labelledby="pf-h-ship">
        <h3 id="pf-h-ship" className="pf-sec__h">Shipping address</h3>
        <p className="pf-sec__d">Search once and the rest fills in.</p>
        <div className="pf-grid">
          <div className="pf-field pf-field--full">
            <label className="ui-label">Address *</label>
            <AddressAutocomplete
              value={formData.address}
              onChange={(text) => setFormData(prev => ({ ...prev, address: text, address_lat: null, address_lng: null }))}
              onPick={handleAddressPick}
              showStatus={isAdmin || userRole === 'party_manager' || userRole === 'sales_manager'}
            />
          </div>
          {partyField('Country', true, (
            <DropdownSelector
              options={[{ value: '', label: 'Select Country' }, ...countries.map((country) => ({ value: country.id, label: country.name }))]}
              value={formData.country_id || ''}
              onChange={(value) => handleInputChange('country_id', value || '')}
              onOpen={fetchCountries}
              placeholder="Select Country"
              className="ui-dropdown-custom--full-width"
            />
          ))}
          {partyField('State', true, (
            <DropdownSelector
              options={[{ value: '', label: 'Select State' }, ...states.map((state) => ({ value: state.id, label: state.name }))]}
              value={formData.state_id || ''}
              onChange={(value) => handleInputChange('state_id', value || '')}
              placeholder="Select State"
              disabled={!formData.country_id}
              className="ui-dropdown-custom--full-width"
            />
          ), !formData.country_id && <small className="pf-hint">Please select a country first</small>)}
          {partyField('City', true, (
            <DropdownSelector
              options={[{ value: '', label: 'Select City' }, ...cities.map((city) => ({ value: city.id, label: city.name }))]}
              value={formData.city_id || ''}
              onChange={(value) => handleInputChange('city_id', value || '')}
              placeholder="Select City"
              disabled={!formData.state_id}
              className="ui-dropdown-custom--full-width"
            />
          ), !formData.state_id && <small className="pf-hint">Please select a state first</small>)}
          {partyField('Pincode', true, (
            <input className="ui-input" inputMode="numeric" placeholder="Pincode" value={formData.pincode}
              onChange={(e) => handleInputChange('pincode', e.target.value)} />
          ))}
          {partyField('Zone', false, (
            <DropdownSelector
              options={[{ value: '', label: 'Select Zone' }, ...zones.map((zone) => ({ value: zone.id, label: zone.name }))]}
              value={formData.zone_id || ''}
              onChange={(value) => handleInputChange('zone_id', value || '')}
              placeholder="Select Zone"
              disabled={!formData.city_id}
              className="ui-dropdown-custom--full-width"
            />
          ), !formData.city_id && <small className="pf-hint">Please select a city first</small>)}
          <div className="pf-field pf-field--full">
            <button
              type="button"
              role="switch"
              aria-checked={formData.billing_same_as_shipping !== false}
              className={`pf-switch ${formData.billing_same_as_shipping !== false ? 'is-on' : ''}`}
              onClick={() => handleInputChange('billing_same_as_shipping', formData.billing_same_as_shipping === false)}
            >
              <span className="pf-switch__track" aria-hidden="true"><span className="pf-switch__dot" /></span>
              <span className="pf-switch__text">
                <b>Billing address is the same</b>
                <small>Turn off to enter a different billing address</small>
              </span>
            </button>
          </div>
          {formData.billing_same_as_shipping === false && (
            <div className="pf-field pf-field--full">
              <label className="ui-label">Billing address</label>
              <textarea
                className="ui-input"
                rows={2}
                style={{ minHeight: 64, resize: 'vertical', lineHeight: 1.4 }}
                placeholder="Billing address"
                value={formData.billing_address}
                onChange={(e) => handleInputChange('billing_address', e.target.value)}
              />
            </div>
          )}
      {(isAdmin || isSalesman || isDistributor || userRole === 'party_manager' || userRole === 'sales_manager') && (() => {
        const locLat = editRow?.latitude ?? formData.latitude;
        const locLng = editRow?.longitude ?? formData.longitude;
        const locSource = editRow?.location_source || formData.location_source;
        const hasLocationSet = locLat !== null && locLat !== undefined && locLat !== '' && locLng !== null && locLng !== undefined && locLng !== ''
          && Number.isFinite(Number(locLat)) && Number.isFinite(Number(locLng));
        const isVerified = locSource === 'verified';
        const pickedNow = Number.isFinite(Number(formData.address_lat)) && formData.address_lat !== null && formData.address_lat !== '';
        const canRemoveLocation = !!editRow && hasLocationSet
          && (isAdmin || userRole === 'party_manager' || userRole === 'sales_manager');
        return (
          <div className="pf-field pf-field--full party-loc">
            <label className="ui-label">Shop location</label>
            <div className="party-loc__chip">
              <span className={`loc-pill loc-pill--${isVerified || pickedNow ? 'ok' : hasLocationSet ? 'warn' : 'idle'}`}>
                {isVerified ? 'Exact spot saved' : pickedNow ? 'From the picked address' : hasLocationSet ? 'From the address' : 'Not set'}
              </span>
            </div>
            <p className="mt-0 mb-2 text-[length:var(--text-xs)] text-text-muted">
              {isVerified
                ? 'The exact shop spot was saved on a visit. Visit orders and check-ins must be within 50 m of it.'
                : pickedNow
                  ? 'The location comes from the picked address and is saved with the party. The first visit order or check-in saves the exact spot.'
                  : hasLocationSet
                    ? 'The location comes from the address. Until the first visit saves the exact spot, a visit can be within 150 m.'
                    : 'Pick the address from the suggestions above. That sets the shop location.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {canRemoveLocation && (
                <button type="button" className="ui-btn ui-btn--secondary" onClick={handleRemoveLocation} disabled={savingLoc}>
                  {savingLoc ? 'Removing…' : 'Remove location'}
                </button>
              )}
              {hasLocationSet && (
                <a
                  className="ui-btn ui-btn--secondary inline-flex items-center gap-1"
                  href={`https://www.google.com/maps/search/?api=1&query=${Number(locLat)},${Number(locLng)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on map
                </a>
              )}
            </div>
            {hasLocationSet && (
              <p className="mt-2 mb-0 text-[length:var(--text-xs)] text-text-subtle">
                {Number(locLat).toFixed(5)}, {Number(locLng).toFixed(5)}
              </p>
            )}
          </div>
        );
      })()}
        </div>
      </section>

      <section className="pf-sec" aria-labelledby="pf-h-terms">
        <h3 id="pf-h-terms" className="pf-sec__h">Terms</h3>
        <div className="pf-grid">
          {partyField('Preferred courier', !editRow, (
            <input className="ui-input" placeholder="Choose a courier" value={formData.prefered_courier}
              onChange={(e) => handleInputChange('prefered_courier', e.target.value)} />
          ))}
          {partyField('Credit days', false, (
            <input disabled={creditLocked} className="ui-input" type="number" inputMode="numeric" min="0"
              placeholder={creditLocked ? 'Set by your manager' : 'Credit days'}
              value={formData.credit_days} onChange={(e) => handleInputChange('credit_days', e.target.value)} />
          ), creditLocked && <small className="pf-hint">Only managers can change this.</small>)}
          {partyField('GSTIN', false, (
            <input disabled={creditLocked} className="ui-input" placeholder="GSTIN" value={formData.gstin}
              onChange={(e) => handleInputChange('gstin', e.target.value)} />
          ))}
          {partyField('PAN', false, (
            <input disabled={creditLocked} className="ui-input" placeholder="PAN" value={formData.pan}
              onChange={(e) => handleInputChange('pan', e.target.value)} />
          ))}
          {!isPartyManager && (
            <div className="pf-field pf-field--full">
              <p className="ord-view__lock party-form__lock"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3" /></svg><span>Login status, credit days, GSTIN and PAN can be changed by admin, party and sales managers only.</span></p>
            </div>
          )}
          {editRow && isAdmin && (
            <div className="pf-field pf-field--full">
              <button
                type="button"
                role="switch"
                aria-checked={formData.is_active !== false}
                className={`pf-switch ${formData.is_active !== false ? 'is-on' : ''}`}
                onClick={() => handleInputChange('is_active', formData.is_active === false)}
              >
                <span className="pf-switch__track" aria-hidden="true"><span className="pf-switch__dot" /></span>
                <span className="pf-switch__text">
                  <b>Active</b>
                  <small>Switch off to make the party inactive. Nothing is deleted.</small>
                </span>
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );

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

      {moreFor && (
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
          </div>
        </>
      )}

      <AsidePanel
        open={isPartyFormOpen}
        onClose={closePartyForm}
        title={editRow ? 'Edit party' : 'Add party'}
        footer={(
          <>
            <button
              type="button"
              className="ui-btn ui-btn--secondary"
              onClick={closePartyForm}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ui-btn ui-btn--primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (editRow ? 'Updating...' : 'Saving...') : (editRow ? 'Update party' : 'Save party')}
            </button>
          </>
        )}
      >
        <form className="ui-form" onSubmit={handleSubmit}>
          {renderPartyFormFields()}
        </form>
      </AsidePanel>

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

