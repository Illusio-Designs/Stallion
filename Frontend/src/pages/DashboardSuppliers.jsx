import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import TableWithControls from '../components/ui/TableWithControls';
import Modal from '../components/ui/Modal';
import RowActions from '../components/ui/RowActions';
import DropdownSelector from '../components/ui/DropdownSelector';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import {
  getSalesmen,
  createSalesman,
  updateSalesman,
  deleteSalesman,
  getCountries,
  getStates,
  getCities,
  getAllZones,
  register,
  getRoles,
} from '../services/apiService';
import { showSuccess, showError } from '../services/notificationService';
import { getUser } from '../services/authService';

// Multi-select zones dropdown (same design as distributor page)
const ZonesMultiDropdown = ({ zones = [], selectedZones = [], onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const filtered = searchQuery
    ? zones.filter(z => (z.zone_name || z.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : zones;

  const allIds = zones.map(z => z.zone_id || z.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedZones.includes(id));

  const displayValue = selectedZones.length === 0
    ? 'Select Zones'
    : selectedZones.length === allIds.length
      ? 'All Zones'
      : `${selectedZones.length} zone${selectedZones.length > 1 ? 's' : ''} selected`;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const toggleZone = (zoneId) => {
    const updated = selectedZones.includes(zoneId)
      ? selectedZones.filter(id => id !== zoneId)
      : [...selectedZones, zoneId];
    onChange(updated);
  };

  const toggleAll = (e) => {
    e.stopPropagation();
    onChange(allSelected ? [] : [...allIds]);
  };

  return (
    <div
      ref={dropdownRef}
      className={`ui-dropdown-custom ui-dropdown-custom--full-width ${isOpen ? 'ui-dropdown-custom--open' : ''} ${disabled ? 'ui-dropdown-custom--disabled' : ''}`}
    >
      <div className="ui-dropdown-custom__trigger" onClick={() => !disabled && setIsOpen(o => !o)}>
        <span className={`ui-dropdown-custom__value ${selectedZones.length === 0 ? 'ui-dropdown-custom__value--placeholder' : ''}`}>
          {displayValue}
        </span>
        <svg className="ui-dropdown-custom__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      {isOpen && !disabled && (
        <div className="ui-dropdown-custom__menu">
          <div className="ui-dropdown-custom__search">
            <input
              ref={searchInputRef}
              type="text"
              className="ui-dropdown-custom__search-input"
              placeholder="Search zones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div
            className="ui-dropdown-custom__option"
            style={{ borderBottom: '1px solid #e0e0e0', fontWeight: 600 }}
            onClick={toggleAll}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} onClick={(e) => e.stopPropagation()} style={{ accentColor: '#181265', cursor: 'pointer' }} />
              {allSelected ? 'Uncheck All' : 'Check All'}
            </span>
          </div>
          <div className="ui-dropdown-custom__options">
            {filtered.length === 0 ? (
              <div className="ui-dropdown-custom__no-results">
                {zones.length === 0 ? 'No zones available' : 'No results found'}
              </div>
            ) : filtered.map(zone => {
              const zoneId = zone.zone_id || zone.id;
              const zoneName = zone.zone_name || zone.name || '';
              const isChecked = selectedZones.includes(zoneId);
              return (
                <div
                  key={zoneId}
                  className={`ui-dropdown-custom__option ${isChecked ? 'ui-dropdown-custom__option--selected' : ''}`}
                  onClick={() => toggleZone(zoneId)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggleZone(zoneId)} onClick={(e) => e.stopPropagation()} style={{ accentColor: '#181265', cursor: 'pointer' }} />
                    {zoneName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const DashboardSuppliers = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [openAdd, setOpenAdd] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [salesmen, setSalesmen] = useState([]);
  const [countries, setCountries] = useState([]);
  const [selectedCountryFilter, setSelectedCountryFilter] = useState(null); // For filter dropdown
  const [hasSearched, setHasSearched] = useState(false); // Track if we've searched for salesmen
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  
  const [formData, setFormData] = useState({
    employee_code: '',
    alternate_phone: '',
    full_name: '',
    reporting_manager: '',
    email: '',
    phone: '',
    address: '',
    country_id: '',
    state_id: '',
    city_id: '',
    zones: [],
    joining_date: '',
  });

  const isInitializingEditRef = useRef(false);
  const prevCountryIdRef = useRef('');
  const hasSetDefaultCountry = useRef(false);

  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    try {
      const countriesData = await getCountries();
      setCountries(countriesData || []);
    } catch (error) {
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        setError(`Failed to load countries: ${error.message}`);
      }
    }
  };

  const fetchSalesmenForCountry = useCallback(async (countryId) => {
    if (!countryId) {
      console.log('[fetchSalesmenForCountry] No country ID provided, clearing salesmen');
      setSalesmen([]);
      setHasSearched(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    setHasSearched(false);
    try {
      // Validate countryId before making API call
      const cleanCountryId = String(countryId).trim();
      if (!cleanCountryId || cleanCountryId === 'undefined' || cleanCountryId === 'null') {
        console.error('[fetchSalesmenForCountry] Invalid country ID:', countryId);
        setSalesmen([]);
        setLoading(false);
        return;
      }
      
      console.log('[fetchSalesmenForCountry] Fetching salesmen for country:', cleanCountryId);
      const salesmenData = await getSalesmen(cleanCountryId);
      
      console.log('[fetchSalesmenForCountry] Received', salesmenData?.length || 0, 'salesmen from API');
      
      // CRITICAL: Backend returns wrong data, so we MUST filter strictly
      // Filter out ALL salesmen that don't match the requested country
      const validSalesmen = (salesmenData || []).filter(d => {
        if (!d) {
          console.warn('[fetchSalesmenForCountry] Skipping null/undefined salesman');
          return false;
        }
        
        const salesmanCountryId = String(d.country_id || d.countryId || '').trim();
        const matches = salesmanCountryId === cleanCountryId;
        
        if (!matches) {
          console.warn('[fetchSalesmenForCountry] ❌ REJECTING salesman - country mismatch:', {
            salesman_id: d.id || d.salesman_id,
            salesman_name: d.full_name,
            salesman_country_id: salesmanCountryId,
            requested_country_id: cleanCountryId,
            match: false
          });
        } else {
          console.log('[fetchSalesmenForCountry] ✅ ACCEPTING salesman - country matches:', {
            salesman_id: d.id || d.salesman_id,
            salesman_name: d.full_name,
            country_id: salesmanCountryId
          });
        }
        return matches;
      });
      
      const filteredOut = salesmenData.length - validSalesmen.length;
      if (filteredOut > 0) {
        console.warn('[fetchSalesmenForCountry] ⚠️ Backend returned', filteredOut, 'salesmen with WRONG country_id!');
        console.warn('[fetchSalesmenForCountry] This is a backend issue - it should filter by country_id');
      }
      
      if (validSalesmen.length > 0) {
        console.log('[fetchSalesmenForCountry] ✅ Found', validSalesmen.length, 'valid salesmen for country:', cleanCountryId);
      } else {
        console.log('[fetchSalesmenForCountry] ℹ️ No salesmen found for country:', cleanCountryId);
        if (salesmenData.length > 0) {
          console.warn('[fetchSalesmenForCountry] ⚠️ Backend returned', salesmenData.length, 'salesmen but none matched the requested country');
        }
      }
      
      // Force update by creating a new array reference
      const newSalesmen = Array.isArray(validSalesmen) ? [...validSalesmen] : [];
      console.log('[fetchSalesmenForCountry] Setting', newSalesmen.length, 'salesmen for country:', cleanCountryId);
      setSalesmen(newSalesmen);
      setHasSearched(true); // Mark that we've completed a search - even if empty
    } catch (error) {
      console.error('[fetchSalesmenForCountry] Error:', error);
      const errorMessage = error.message?.toLowerCase() || '';
      const isNotFound = errorMessage.includes('salesmen not found') || 
                        errorMessage.includes('no salesmen found') ||
                        errorMessage.includes('salesman not found') ||
                        error.statusCode === 404;
      
      if (!isNotFound && 
          !errorMessage.includes('token expired') && 
          !errorMessage.includes('unauthorized')) {
        setError(`Failed to load salesmen: ${error.message}`);
        showError(`Failed to load salesmen: ${error.message}`);
      }
      setSalesmen([]);
      setHasSearched(true); // Mark that we've completed a search - even if empty
    } finally {
      setLoading(false);
    }
  }, []);

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

  const fetchZones = async () => {
    try {
      const zonesData = await getAllZones();
      setZones(zonesData || []);
    } catch (error) {
      console.error('Failed to load zones:', error);
      setZones([]);
    }
  };

  // Set India as default country filter (only once when countries are loaded)
  useEffect(() => {
    if (countries.length > 0 && !selectedCountryFilter && !hasSetDefaultCountry.current) {
      const india = countries.find(c => 
        c.name?.toLowerCase() === 'india' || 
        c.code?.toLowerCase() === 'in'
      );
      if (india) {
        console.log('[Filter] Setting default country to India:', india.id);
        setSelectedCountryFilter(india.id);
        hasSetDefaultCountry.current = true;
      }
    }
  }, [countries, selectedCountryFilter]);

  // Fetch salesmen when country filter changes
  useEffect(() => {
    if (selectedCountryFilter) {
      console.log('[Filter] Country changed, fetching salesmen for:', selectedCountryFilter);
      fetchSalesmenForCountry(selectedCountryFilter);
      fetchZones();
    } else {
      // If no country selected (All Countries), clear salesmen
      console.log('[Filter] No country selected (All Countries), clearing salesmen');
      setSalesmen([]);
      setLoading(false);
    }
  }, [selectedCountryFilter, fetchSalesmenForCountry]);

  // Fetch states when country changes in form
  useEffect(() => {
    if (formData.country_id) {
      fetchStates(formData.country_id);
      if (!isInitializingEditRef.current && prevCountryIdRef.current !== '' && prevCountryIdRef.current !== formData.country_id) {
        setFormData(prev => ({ ...prev, state_id: '', city_id: '' }));
        setCities([]);
      }
      prevCountryIdRef.current = formData.country_id;
    } else {
      setStates([]);
      if (!isInitializingEditRef.current) {
        setCities([]);
      }
      prevCountryIdRef.current = '';
    }
  }, [formData.country_id]);

  // Fetch cities when state changes
  useEffect(() => {
    if (formData.state_id) {
      fetchCities(formData.state_id);
      if (!isInitializingEditRef.current) {
        setFormData(prev => ({ ...prev, city_id: '' }));
      }
    } else {
      setCities([]);
    }
  }, [formData.state_id]);

  const columns = useMemo(() => ([
    { key: 'employee_code', label: 'EMPLOYEE CODE' },
    { key: 'full_name', label: 'NAME' },
    { key: 'phone', label: 'PHONE' },
    { key: 'email', label: 'EMAIL' },
    { key: 'action', label: 'ACTION', render: (_v, row) => (
      <RowActions 
        onEdit={() => handleEdit(row)} 
        onDelete={() => handleDelete(row)} 
      />
    ) },
  ]), []);

  const rows = useMemo(() => {
    // CRITICAL: Backend returns wrong data, so we MUST filter strictly by country_id
    let filteredSalesmen = [];
    
    if (selectedCountryFilter) {
      const cleanFilterId = String(selectedCountryFilter).trim();
      // Only show salesmen that EXACTLY match the selected country
      filteredSalesmen = salesmen.filter(salesman => {
        if (!salesman) return false;
        const salesmanCountryId = String(salesman.country_id || salesman.countryId || '').trim();
        const matches = salesmanCountryId === cleanFilterId;
        
        if (!matches && salesman.full_name) {
          console.warn('[rows] ❌ Filtering out salesman with wrong country:', {
            name: salesman.full_name,
            salesman_country_id: salesmanCountryId,
            selected_country_id: cleanFilterId
          });
        }
        return matches;
      });
      console.log('[rows] ✅ Displaying', filteredSalesmen.length, 'salesmen for country:', cleanFilterId, 'out of', salesmen.length, 'total');
    } else {
      // If no country selected (All Countries), show nothing
      filteredSalesmen = [];
      console.log('[rows] No country selected, showing no salesmen');
    }
    
    return filteredSalesmen.map(salesman => ({
      ...salesman,
      isActive: salesman.is_active !== false,
    }));
  }, [salesmen, selectedCountryFilter]);

  const filteredRowsByTab = useMemo(() => {
    if (activeTab === 'All') return rows;
    if (activeTab === 'Activate') return rows.filter(r => r.isActive);
    if (activeTab === 'Deactivate') return rows.filter(r => !r.isActive);
    return rows;
  }, [rows, activeTab]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      employee_code: '',
      alternate_phone: '',
      full_name: '',
      reporting_manager: '',
      email: '',
      phone: '',
      address: '',
      country_id: '',
      state_id: '',
      city_id: '',
      zones: [],
      joining_date: '',
    });
    setStates([]);
    setCities([]);
    prevCountryIdRef.current = '';
  };

  const handleAdd = () => {
    resetForm();
    setOpenAdd(true);
  };

  const handleEdit = async (row) => {
    // Validate that row has an ID - check multiple possible ID field names
    if (!row) {
      showError('Invalid salesman data: row is null or undefined');
      return;
    }
    
    const salesmanId = row.id || row.salesman_id || row.salesmanId;
    if (!salesmanId) {
      console.error('Edit failed: Missing salesman ID', row);
      showError('Invalid salesman data: missing ID. Please refresh the page and try again.');
      return;
    }
    
    isInitializingEditRef.current = true;
    setFormData({
      employee_code: row.employee_code || '',
      alternate_phone: row.alternate_phone || '',
      full_name: row.full_name || '',
      reporting_manager: row.reporting_manager || '',
      email: row.email || '',
      phone: row.phone || '',
      address: row.address || '',
      country_id: row.country_id || '',
      state_id: row.state_id || '',
      city_id: row.city_id || '',
      zones: Array.isArray(row.zones) ? row.zones.map(z => z.zone_id || z.id || z) : [],
      joining_date: row.joining_date ? row.joining_date.split('T')[0] : '',
    });
    setEditRow(row);
    
    // Load dependent data for editing
    if (row.country_id) {
      await fetchStates(row.country_id);
      if (row.state_id) {
        await fetchCities(row.state_id);
      }
    }
    
    // Reset the flag after a short delay to allow useEffect to process
    setTimeout(() => {
      isInitializingEditRef.current = false;
    }, 100);
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Are you sure you want to delete this salesman? This will also delete the associated user account.`)) {
      return;
    }

    // Validate that row has an ID - check multiple possible ID field names
    const salesmanId = row.id || row.salesman_id || row.salesmanId;
    if (!salesmanId) {
      console.error('Delete failed: Missing salesman ID', row);
      showError('Invalid salesman data: missing ID. Please refresh the page and try again.');
      return;
    }

    // Get phone number from salesman to find associated user
    const salesmanPhone = row.phone || row.phoneNumber || '';
    
    // Also check if user_id is directly available in the row
    const userId = row.user_id || row.userId;

    // Optimistically remove from table immediately
    const salesmanName = row.full_name || 'Salesman';
    setSalesmen(prev => prev.filter(s => {
      const id = s.id || s.salesman_id || s.salesmanId;
      return id !== salesmanId;
    }));

    try {
      setLoading(true);
      setError(null);
      console.log('[Delete Salesman] Deleting salesman with ID:', salesmanId);
      
      // Delete salesman first
      await deleteSalesman(salesmanId);
      console.log('[Delete Salesman] Salesman deleted successfully');
      
      // Now find and delete associated user account
      let userToDelete = null;
      
      // First, try to use user_id if available
      if (userId) {
        try {
          const { deleteUser } = await import('../services/apiService');
          console.log('[Delete Salesman] Deleting user account with ID:', userId);
          await deleteUser(userId);
          console.log('[Delete Salesman] User account deleted successfully');
          showSuccess('Salesman and associated user account deleted successfully');
          setError(null);
          return;
        } catch (userDeleteError) {
          console.warn('[Delete Salesman] Failed to delete user by user_id, trying by phone:', userDeleteError);
        }
      }
      
      // If user_id not available or deletion failed, try finding by phone number
      if (salesmanPhone) {
        try {
          const { getUsers, deleteUser } = await import('../services/apiService');
          console.log('[Delete Salesman] Finding user account with phone:', salesmanPhone);
          
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
          
          console.log('[Delete Salesman] Total users found:', usersArray.length);
          
          // Normalize phone numbers for comparison (remove +, spaces, dashes)
          const normalizePhone = (phone) => {
            if (!phone) return '';
            return String(phone).trim().replace(/^\+/, '').replace(/[\s-]/g, '');
          };
          
          const normalizedSalesmanPhone = normalizePhone(salesmanPhone);
          
          // Find user by phone number
          const foundUser = usersArray.find(u => {
            const userPhone = (u.phone || u.phoneNumber || '').trim();
            const normalizedUserPhone = normalizePhone(userPhone);
            
            return userPhone === salesmanPhone || 
                   normalizedUserPhone === normalizedSalesmanPhone ||
                   userPhone === `+${salesmanPhone}` ||
                   `+${userPhone}` === salesmanPhone;
          });
          
          if (foundUser) {
            const foundUserId = foundUser.user_id || foundUser.id;
            console.log('[Delete Salesman] Found associated user account:', {
              userId: foundUserId,
              userPhone: foundUser.phone || foundUser.phoneNumber,
              userName: foundUser.full_name || foundUser.name
            });
            
            try {
              await deleteUser(foundUserId);
              console.log('[Delete Salesman] User account deleted successfully');
              showSuccess('Salesman and associated user account deleted successfully');
            } catch (deleteError) {
              console.error('[Delete Salesman] Error calling deleteUser:', deleteError);
              throw deleteError;
            }
          } else {
            console.warn('[Delete Salesman] No user account found with phone:', salesmanPhone);
            console.warn('[Delete Salesman] Available user phones:', usersArray.map(u => ({
              id: u.user_id || u.id,
              phone: u.phone || u.phoneNumber,
              name: u.full_name || u.name
            })));
            showSuccess('Salesman deleted successfully. (No associated user account found - check console for details)');
          }
        } catch (userDeleteError) {
          console.error('[Delete Salesman] Error deleting user account:', userDeleteError);
          console.error('[Delete Salesman] Error details:', {
            message: userDeleteError.message,
            errorData: userDeleteError.errorData,
            statusCode: userDeleteError.statusCode
          });
          showSuccess('Salesman deleted successfully. (User account deletion failed - check console for details)');
        }
      } else {
        console.warn('[Delete Salesman] No phone number or user_id found in salesman record');
        console.warn('[Delete Salesman] Salesman row data:', row);
        showSuccess('Salesman deleted successfully');
      }
      
      setError(null);
    } catch (error) {
      console.error('[Delete Salesman] Delete salesman error:', error);
      
      // Revert optimistic update on error
      if (selectedCountryFilter) {
        await fetchSalesmenForCountry(selectedCountryFilter);
      } else {
        // If no filter, we can't easily restore, so just show error
        setError(`Failed to delete: ${error.message}`);
      }
      
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        showError(`Failed to delete salesman: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.employee_code || formData.employee_code.trim() === '') {
      setError('Please enter employee code');
      return;
    }
    if (!formData.full_name || formData.full_name.trim() === '') {
      setError('Please enter full name');
      return;
    }
    if (!formData.email || formData.email.trim() === '') {
      setError('Please enter email');
      return;
    }
    if (!formData.phone || formData.phone.trim() === '') {
      setError('Please enter phone number');
      return;
    }
    if (!formData.country_id) {
      setError('Please select a country');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Get current logged-in user ID - required for salesman creation/update
      const currentUser = getUser();
      const currentUserId = currentUser?.id || currentUser?.user_id || currentUser?.user_id || null;
      
      if (!currentUserId) {
        setError('User session not found. Please log in again.');
        showError('User session not found. Please log in again.');
        setLoading(false);
        return;
      }
      
      // Handle reporting_manager - must be null (not empty string) if not provided, to satisfy foreign key constraint
      const trimmedReportingManager = formData.reporting_manager ? String(formData.reporting_manager).trim() : '';
      
      const dataToSend = {
        user_id: editRow?.user_id || currentUserId,
        employee_code: formData.employee_code.trim(),
        alternate_phone: formData.alternate_phone ? formData.alternate_phone.trim() : '',
        full_name: formData.full_name.trim(),
        reporting_manager: trimmedReportingManager !== '' ? trimmedReportingManager : null,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address ? formData.address.trim() : '',
        country_id: formData.country_id,
        state_id: formData.state_id || '',
        city_id: formData.city_id || '',
        zones: Array.isArray(formData.zones) ? formData.zones : [],
        zone_preference: Array.isArray(formData.zones) && formData.zones.length > 0
          ? formData.zones.map(zid => {
              const z = zones.find(z => (z.zone_id || z.id) === zid);
              return z ? (z.zone_name || z.name || '') : '';
            }).filter(Boolean).join(', ')
          : '',
        joining_date: formData.joining_date ? new Date(formData.joining_date).toISOString() : new Date().toISOString(),
      };

      if (editRow) {
        // Validate that editRow has an ID - check multiple possible ID field names
        const salesmanId = editRow.id || editRow.salesman_id || editRow.salesmanId;
        if (!salesmanId) {
          console.error('Update failed: Missing salesman ID', editRow);
          showError('Invalid salesman data: missing ID. Please refresh the page and try again.');
          setLoading(false);
          return;
        }
        
        // Optimistically update the salesman in the table immediately
        const updatedSalesman = {
          ...editRow,
          ...dataToSend,
          is_active: editRow.is_active !== undefined ? editRow.is_active : true,
          id: salesmanId,
        };
        
        setSalesmen(prev => prev.map(s => {
          const id = s.id || s.salesman_id || s.salesmanId;
          return id === salesmanId ? updatedSalesman : s;
        }));
        
        console.log('Updating salesman with ID:', salesmanId, 'Data:', dataToSend);
        
        try {
          await updateSalesman(salesmanId, { 
            ...dataToSend, 
            is_active: editRow.is_active !== undefined ? editRow.is_active : true 
          });
          
          // Show success notification
          showSuccess('Salesman updated successfully');
          setError(null);
          setOpenAdd(false);
          setEditRow(null);
          resetForm();
        } catch (error) {
          console.error('Update salesman error:', error);
          
          // Revert optimistic update on error by refetching
          if (selectedCountryFilter) {
            await fetchSalesmenForCountry(selectedCountryFilter);
          }
          
          if (!error.message?.toLowerCase().includes('token expired') && 
              !error.message?.toLowerCase().includes('unauthorized')) {
            showError(`Failed to update salesman: ${error.message}`);
          }
          setLoading(false);
          return;
        }
      } else {
        // Create new salesman - first create user account
        try {
          // Format phone number to E.164 format
          let phoneNumber = formData.phone.trim();
          if (!phoneNumber.startsWith('+')) {
            phoneNumber = phoneNumber.replace(/^0+/, '');
            if (!phoneNumber.startsWith('91')) {
              phoneNumber = `91${phoneNumber}`;
            }
            phoneNumber = `+${phoneNumber}`;
          }

          // Get roles to find salesman role ID
          const rolesResponse = await getRoles();
          let rolesArray = [];
          if (Array.isArray(rolesResponse)) {
            rolesArray = rolesResponse;
          } else if (rolesResponse && Array.isArray(rolesResponse.data)) {
            rolesArray = rolesResponse.data;
          } else if (rolesResponse && Array.isArray(rolesResponse.roles)) {
            rolesArray = rolesResponse.roles;
          }

          // Find salesman role ID
          const salesmanRole = rolesArray.find(r => {
            const roleName = (r.role_name || r.name || r.roleName || r.title || r.role || '').toLowerCase().trim();
            return roleName === 'salesman' || roleName === 'salesmen';
          });

          if (!salesmanRole) {
            throw new Error('Salesman role not found. Please contact administrator.');
          }

          const salesmanRoleId = salesmanRole.role_id || salesmanRole.id || salesmanRole.roleId;

          // Create user account first
          const userData = {
            phoneNumber,
            fullName: formData.full_name.trim(),
            roleId: salesmanRoleId,
          };

          const registeredUser = await register(userData);
          const newUserId = registeredUser.user_id || registeredUser.id || registeredUser.user?.user_id || registeredUser.user?.id;

          if (!newUserId) {
            throw new Error('Failed to create user account. User ID not returned.');
          }

          // Now create salesman with the new user_id
          const salesmanData = {
            ...dataToSend,
            user_id: newUserId,
          };

          const newSalesman = await createSalesman(salesmanData);
          
          // Optimistically add to table if it matches the current filter
          if (selectedCountryFilter && newSalesman && newSalesman.country_id === selectedCountryFilter) {
            setSalesmen(prev => [...prev, {
              ...newSalesman,
              id: newSalesman.id || newSalesman.salesman_id,
              isActive: newSalesman.is_active !== false,
            }]);
          } else if (selectedCountryFilter) {
            // If country doesn't match filter, just refresh
            await fetchSalesmenForCountry(selectedCountryFilter);
          }
          
          // Show success notification
          showSuccess('Salesman created successfully');
          setError(null);
          setOpenAdd(false);
          setEditRow(null);
          resetForm();
        } catch (createError) {
          console.error('Create salesman error:', createError);
          
          // Revert by refreshing if needed
          if (selectedCountryFilter) {
            await fetchSalesmenForCountry(selectedCountryFilter);
          }
          
          if (!createError.message?.toLowerCase().includes('token expired') && 
              !createError.message?.toLowerCase().includes('unauthorized')) {
            showError(`Failed to create salesman: ${createError.message}`);
            setError(`Failed to save: ${createError.message}`);
          }
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      // This catch block only handles create errors (update errors are handled above)
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        showError(`Failed to create salesman: ${error.message}`);
        setError(`Failed to save: ${error.message}`);
      }
      setLoading(false);
    }
  };

  return (
    <div className="dash-page">
      <div className="dash-container">
        <div className="dash-row">
          <div className="order-tabs-container">
            {['All', 'Activate', 'Deactivate'].map(tab => (
              <button
                key={tab}
                className={`order-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <div className="dash-row">
            <div className="dash-card full">
              <div style={{ 
                padding: '16px', 
                backgroundColor: '#fee', 
                border: '1px solid #fcc', 
                borderRadius: '8px',
                color: '#c33',
                marginBottom: '16px'
              }}>
                <strong>Error:</strong> {error}
                <button 
                  onClick={() => setError(null)}
                  style={{
                    float: 'right',
                    background: 'none',
                    border: 'none',
                    color: '#c33',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: 'bold'
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="dash-row">
          <div className="dash-card full">
            <TableWithControls
              title="Salesmen"
              columns={columns}
              rows={filteredRowsByTab}
              onAddNew={handleAdd}
              addNewText="Add New Salesman"
              onImport={() => {
                setError(null);
                if (selectedCountryFilter) {
                  fetchSalesmenForCountry(selectedCountryFilter);
                }
              }}
              importText="Refresh Data"
              showFilter={true}
              filterContent={
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
                    Filter by Country
                  </label>
                  <DropdownSelector
                    options={[
                      { value: '', label: 'All Countries' },
                      ...countries.map(country => ({
                        value: country.id,
                        label: country.name
                      }))
                    ]}
                    value={selectedCountryFilter || ''}
                    onChange={(value) => {
                      const newCountryId = value || null;
                      console.log('[Filter] Country selection changed from', selectedCountryFilter, 'to', newCountryId);
                      // Clear salesmen immediately when changing countries
                      setSalesmen([]);
                      setHasSearched(false);
                      // Update state - useEffect will handle fetching or clearing
                      setSelectedCountryFilter(newCountryId);
                      // If "All Countries" is selected (empty), ensure salesmen are cleared
                      if (!newCountryId) {
                        console.log('[Filter] All Countries selected - clearing salesmen');
                        setSalesmen([]);
                        setHasSearched(false);
                        setLoading(false);
                      }
                    }}
                    placeholder="All Countries"
                    className="ui-dropdown-custom--full-width"
                  />
                </div>
              }
              loading={loading}
            />
          </div>
        </div>
      </div>
      <Modal
        open={openAdd}
        onClose={() => {
          setOpenAdd(false);
          resetForm();
        }}
        title="Add New Salesman"
        footer={(
          <>
            <button 
              className="ui-btn ui-btn--secondary" 
              onClick={() => {
                setOpenAdd(false);
                resetForm();
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              className="ui-btn ui-btn--primary" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </>
        )}
      >
        <form className="ui-form" onSubmit={handleSubmit}>
          <div className="form-group form-group--full">
            <label className="ui-label">Employee Code *</label>
            <input 
              className="ui-input" 
              placeholder="Employee code"
              value={formData.employee_code}
              onChange={(e) => handleInputChange('employee_code', e.target.value)}
              required
            />
          </div>
          <div className="form-group form-group--full">
            <label className="ui-label">Full Name *</label>
            <input 
              className="ui-input" 
              placeholder="Full name"
              value={formData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Email *</label>
            <input 
              className="ui-input" 
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Phone *</label>
            <PhoneInput
              country={'in'}
              value={formData.phone}
              onChange={(value) => handleInputChange('phone', value)}
              inputProps={{
                required: true,
                placeholder: 'Enter your phone number',
              }}
              containerClass="phone-input-container"
              inputClass="phone-input-field"
              buttonClass="phone-input-button"
              dropdownClass="phone-input-dropdown"
              disableDropdown={false}
              disableCountryGuess={false}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Country *</label>
            <DropdownSelector
              options={[
                { value: '', label: 'Select Country' },
                ...countries.map(country => ({
                  value: country.id,
                  label: country.name
                }))
              ]}
              value={formData.country_id || ''}
              onChange={(value) => handleInputChange('country_id', value || '')}
              placeholder="Select Country"
              className="ui-dropdown-custom--full-width"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">State</label>
            <DropdownSelector
              options={[
                { value: '', label: 'Select State' },
                ...states.map(state => ({
                  value: state.id,
                  label: state.name
                }))
              ]}
              value={formData.state_id || ''}
              onChange={(value) => handleInputChange('state_id', value || '')}
              placeholder="Select State"
              disabled={!formData.country_id}
              className="ui-dropdown-custom--full-width"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">City</label>
            <DropdownSelector
              options={[
                { value: '', label: 'Select City' },
                ...cities.map(city => ({
                  value: city.id,
                  label: city.name
                }))
              ]}
              value={formData.city_id || ''}
              onChange={(value) => handleInputChange('city_id', value || '')}
              placeholder="Select City"
              disabled={!formData.state_id}
              className="ui-dropdown-custom--full-width"
            />
          </div>
          <div className="form-group form-group--full">
            <label className="ui-label">Zones</label>
            <ZonesMultiDropdown
              zones={zones}
              selectedZones={formData.zones}
              onChange={(selected) => handleInputChange('zones', selected)}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Alternate Phone</label>
            <PhoneInput
              country={'in'}
              value={formData.alternate_phone}
              onChange={(value) => handleInputChange('alternate_phone', value)}
              inputProps={{
                placeholder: 'Enter alternate phone number',
              }}
              containerClass="phone-input-container"
              inputClass="phone-input-field"
              buttonClass="phone-input-button"
              dropdownClass="phone-input-dropdown"
              disableDropdown={false}
              disableCountryGuess={false}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Reporting Manager</label>
            <input 
              className="ui-input" 
              placeholder="Reporting manager"
              value={formData.reporting_manager}
              onChange={(e) => handleInputChange('reporting_manager', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Joining Date</label>
            <input 
              className="ui-input" 
              type="date"
              value={formData.joining_date}
              onChange={(e) => handleInputChange('joining_date', e.target.value)}
            />
          </div>
          <div className="form-group form-group--full">
            <label className="ui-label">Address</label>
            <input 
              className="ui-input" 
              placeholder="Address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
            />
          </div>
        </form>
      </Modal>
      <Modal
        open={!!editRow}
        onClose={() => {
          setEditRow(null);
          resetForm();
        }}
        title="Edit Salesman"
        footer={(
          <>
            <button 
              className="ui-btn ui-btn--secondary" 
              onClick={() => {
                setEditRow(null);
                resetForm();
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              className="ui-btn ui-btn--primary" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update'}
            </button>
          </>
        )}
      >
        <form className="ui-form" onSubmit={handleSubmit}>
          <div className="form-group form-group--full">
            <label className="ui-label">Employee Code *</label>
            <input 
              className="ui-input" 
              placeholder="Employee code"
              value={formData.employee_code}
              onChange={(e) => handleInputChange('employee_code', e.target.value)}
              required
            />
          </div>
          <div className="form-group form-group--full">
            <label className="ui-label">Full Name *</label>
            <input 
              className="ui-input" 
              placeholder="Full name"
              value={formData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Email *</label>
            <input 
              className="ui-input" 
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Phone *</label>
            <PhoneInput
              country={'in'}
              value={formData.phone}
              onChange={(value) => handleInputChange('phone', value)}
              inputProps={{
                required: true,
                placeholder: 'Enter your phone number',
              }}
              containerClass="phone-input-container"
              inputClass="phone-input-field"
              buttonClass="phone-input-button"
              dropdownClass="phone-input-dropdown"
              disableDropdown={false}
              disableCountryGuess={false}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Country *</label>
            <DropdownSelector
              options={[
                { value: '', label: 'Select Country' },
                ...countries.map(country => ({
                  value: country.id,
                  label: country.name
                }))
              ]}
              value={formData.country_id || ''}
              onChange={(value) => handleInputChange('country_id', value || '')}
              placeholder="Select Country"
              className="ui-dropdown-custom--full-width"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">State</label>
            <DropdownSelector
              options={[
                { value: '', label: 'Select State' },
                ...states.map(state => ({
                  value: state.id,
                  label: state.name
                }))
              ]}
              value={formData.state_id || ''}
              onChange={(value) => handleInputChange('state_id', value || '')}
              placeholder="Select State"
              disabled={!formData.country_id}
              className="ui-dropdown-custom--full-width"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">City</label>
            <DropdownSelector
              options={[
                { value: '', label: 'Select City' },
                ...cities.map(city => ({
                  value: city.id,
                  label: city.name
                }))
              ]}
              value={formData.city_id || ''}
              onChange={(value) => handleInputChange('city_id', value || '')}
              placeholder="Select City"
              disabled={!formData.state_id}
              className="ui-dropdown-custom--full-width"
            />
          </div>
          <div className="form-group form-group--full">
            <label className="ui-label">Zones</label>
            <ZonesMultiDropdown
              zones={zones}
              selectedZones={formData.zones}
              onChange={(selected) => handleInputChange('zones', selected)}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Alternate Phone</label>
            <PhoneInput
              country={'in'}
              value={formData.alternate_phone}
              onChange={(value) => handleInputChange('alternate_phone', value)}
              inputProps={{
                placeholder: 'Enter alternate phone number',
              }}
              containerClass="phone-input-container"
              inputClass="phone-input-field"
              buttonClass="phone-input-button"
              dropdownClass="phone-input-dropdown"
              disableDropdown={false}
              disableCountryGuess={false}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Reporting Manager</label>
            <input 
              className="ui-input" 
              placeholder="Reporting manager"
              value={formData.reporting_manager}
              onChange={(e) => handleInputChange('reporting_manager', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Joining Date</label>
            <input 
              className="ui-input" 
              type="date"
              value={formData.joining_date}
              onChange={(e) => handleInputChange('joining_date', e.target.value)}
            />
          </div>
          <div className="form-group form-group--full">
            <label className="ui-label">Address</label>
            <input 
              className="ui-input" 
              placeholder="Address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DashboardSuppliers;
