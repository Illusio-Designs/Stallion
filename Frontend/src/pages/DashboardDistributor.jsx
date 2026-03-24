import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import TableWithControls from '../components/ui/TableWithControls';
import Modal from '../components/ui/Modal';
import RowActions from '../components/ui/RowActions';
import DropdownSelector from '../components/ui/DropdownSelector';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import {
  getDistributors,
  createDistributor,
  updateDistributor,
  deleteDistributor,
  getCountries,
  getStates,
  getCities,
  getAllZones,
  register,
  getRoles,
} from '../services/apiService';
import { showSuccess, showError } from '../services/notificationService';

// Multi-select zones dropdown matching the existing DropdownSelector design
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
          {/* Search */}
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
          {/* Check All */}
          <div
            className="ui-dropdown-custom__option"
            style={{ borderBottom: '1px solid #e0e0e0', fontWeight: 600 }}
            onClick={toggleAll}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                onClick={(e) => e.stopPropagation()}
                style={{ accentColor: '#181265', cursor: 'pointer' }}
              />
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
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleZone(zoneId)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ accentColor: '#181265', cursor: 'pointer' }}
                    />
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

const DashboardDistributor = () => {

  const [openAdd, setOpenAdd] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [distributors, setDistributors] = useState([]);
  const [countries, setCountries] = useState([]);
  const [selectedCountryFilter, setSelectedCountryFilter] = useState(null); // For filter dropdown
  const [hasSearched, setHasSearched] = useState(false); // Track if we've searched for distributors
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  
  const [formData, setFormData] = useState({
    distributor_name: '',
    trade_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    country_id: '',
    state_id: '',
    city_id: '',
    zones: [],
    pincode: '',
    gstin: '',
    pan: '',
    territory: '',
    commission_rate: '',
  });

  const isInitializingEditRef = useRef(false);
  const prevCountryIdRef = useRef('');

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

  const fetchDistributorsForCountry = useCallback(async (countryId) => {
    if (!countryId) {
      console.log('[fetchDistributorsForCountry] No country ID provided, clearing distributors');
      setDistributors([]);
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
        console.error('[fetchDistributorsForCountry] Invalid country ID:', countryId);
        setDistributors([]);
        setHasSearched(true);
        return;
      }
      
      console.log('[fetchDistributorsForCountry] ====== FETCHING ======');
      console.log('[fetchDistributorsForCountry] Requested country ID:', cleanCountryId);
      console.log('[fetchDistributorsForCountry] Current selectedCountryFilter:', selectedCountryFilter);
      
      const distributorsData = await getDistributors(cleanCountryId);
      
      console.log('[fetchDistributorsForCountry] Received', distributorsData?.length || 0, 'distributors from API');
      
      // CRITICAL: Backend returns wrong data, so we MUST filter strictly
      // Filter out ALL distributors that don't match the requested country
      const validDistributors = (distributorsData || []).filter(d => {
        if (!d) {
          console.warn('[fetchDistributorsForCountry] Skipping null/undefined distributor');
          return false;
        }
        
        const distributorCountryId = String(d.country_id || d.countryId || '').trim();
        const matches = distributorCountryId === cleanCountryId;
        
        if (!matches) {
          console.warn('[fetchDistributorsForCountry] ❌ REJECTING distributor - country mismatch:', {
            distributor_id: d.distributor_id || d.id,
            distributor_name: d.distributor_name,
            distributor_country_id: distributorCountryId,
            requested_country_id: cleanCountryId,
            match: false
          });
        } else {
          console.log('[fetchDistributorsForCountry] ✅ ACCEPTING distributor - country matches:', {
            distributor_id: d.distributor_id || d.id,
            distributor_name: d.distributor_name,
            country_id: distributorCountryId
          });
        }
        return matches;
      });
      
      const filteredOut = distributorsData.length - validDistributors.length;
      if (filteredOut > 0) {
        console.warn('[fetchDistributorsForCountry] ⚠️ Backend returned', filteredOut, 'distributors with WRONG country_id!');
        console.warn('[fetchDistributorsForCountry] This is a backend issue - it should filter by country_id');
      }
      
      if (validDistributors.length > 0) {
        console.log('[fetchDistributorsForCountry] ✅ Found', validDistributors.length, 'valid distributors for country:', cleanCountryId);
      } else {
        console.log('[fetchDistributorsForCountry] ℹ️ No distributors found for country:', cleanCountryId);
        console.log('[fetchDistributorsForCountry] Backend returned', distributorsData.length, 'distributors but none matched the requested country');
      }
      
      // Force update by creating a new array reference
      const newDistributors = Array.isArray(validDistributors) ? [...validDistributors] : [];
      console.log('[fetchDistributorsForCountry] Setting', newDistributors.length, 'distributors for country:', cleanCountryId);
      console.log('[fetchDistributorsForCountry] ====== END FETCH ======');
      setDistributors(newDistributors);
      setHasSearched(true); // Mark that we've completed a search - even if empty
    } catch (error) {
      console.error('[fetchDistributorsForCountry] Error:', error);
      // "Distributors not found" is handled by getDistributors and returns empty array
      // Only show error for actual failures, not "not found" cases
      const errorMessage = error.message?.toLowerCase() || '';
      const isNotFound = errorMessage.includes('distributors not found') || 
                        errorMessage.includes('no distributors found') ||
                        errorMessage.includes('distributor not found') ||
                        error.statusCode === 404;
      const isDbError = errorMessage.includes('distributor_zones') || 
                        errorMessage.includes("doesn't exist") ||
                        errorMessage.includes('table') ||
                        error.statusCode === 500;
      
      if (!isNotFound && !isDbError &&
          !errorMessage.includes('token expired') && 
          !errorMessage.includes('unauthorized')) {
        setError(`Failed to load distributors: ${error.message}`);
        showError(`Failed to load distributors: ${error.message}`);
      }
      // Always set empty array on error
      setDistributors([]);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Set India as default country filter (only once when countries are loaded)
  const hasSetDefaultCountry = useRef(false);
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

  // Fetch distributors and zones when country filter changes
  useEffect(() => {
    if (selectedCountryFilter) {
      console.log('[Filter] Country changed, fetching distributors for:', selectedCountryFilter);
      fetchDistributorsForCountry(selectedCountryFilter);
      fetchAllZones(selectedCountryFilter);
    } else {
      // If no country selected (All Countries), clear distributors
      console.log('[Filter] No country selected (All Countries), clearing distributors');
      setDistributors([]);
      setLoading(false);
      setHasSearched(false);
    }
  }, [selectedCountryFilter, fetchDistributorsForCountry]);

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

  const fetchAllZones = async (countryId) => {
    try {
      const zonesData = await getAllZones(countryId);
      setZones(zonesData || []);
    } catch (error) {
      console.error('Failed to load zones:', error);
      setZones([]);
    }
  };

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
    { key: 'distributor_name', label: 'DISTRIBUTOR NAME' },
    { key: 'trade_name', label: 'TRADE NAME' },
    { key: 'contact_person', label: 'CONTACT PERSON' },
    { key: 'phone', label: 'PHONE' },
    { key: 'action', label: 'ACTION', render: (_v, row) => (
      <RowActions 
        onEdit={() => handleEdit(row)} 
        onDelete={() => handleDelete(row)} 
      />
    ) },
  ]), []);

  const rows = useMemo(() => {
    // CRITICAL: Backend returns wrong data, so we MUST filter strictly by country_id
    let filteredDistributors = [];
    
    if (selectedCountryFilter) {
      const cleanFilterId = String(selectedCountryFilter).trim();
      // Only show distributors that EXACTLY match the selected country
      filteredDistributors = distributors.filter(distributor => {
        if (!distributor) return false;
        const distributorCountryId = String(distributor.country_id || distributor.countryId || '').trim();
        const matches = distributorCountryId === cleanFilterId;
        
        if (!matches && distributor.distributor_name) {
          console.warn('[rows] ❌ Filtering out distributor with wrong country:', {
            name: distributor.distributor_name,
            distributor_country_id: distributorCountryId,
            selected_country_id: cleanFilterId
          });
        }
        return matches;
      });
      console.log('[rows] ✅ Displaying', filteredDistributors.length, 'distributors for country:', cleanFilterId, 'out of', distributors.length, 'total');
    } else {
      // If no country selected (All Countries), show nothing
      filteredDistributors = [];
      console.log('[rows] No country selected, showing no distributors');
    }
    
    return filteredDistributors.map(distributor => ({
      ...distributor,
      isActive: distributor.is_active !== false,
    }));
  }, [distributors, selectedCountryFilter]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      distributor_name: '',
      trade_name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      country_id: '',
      state_id: '',
      city_id: '',
      zones: [],
      pincode: '',
      gstin: '',
      pan: '',
      territory: '',
      commission_rate: '',
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
      setError('Invalid distributor data: row is null or undefined');
      return;
    }
    
    const distributorId = row.id || row.distributor_id || row.distributorId;
    if (!distributorId) {
      console.error('Edit failed: Missing distributor ID', row);
      setError('Invalid distributor data: missing ID. Please refresh the page and try again.');
      return;
    }
    
    isInitializingEditRef.current = true;
    setFormData({
      distributor_name: row.distributor_name || '',
      trade_name: row.trade_name || '',
      contact_person: row.contact_person || '',
      email: row.email || '',
      phone: row.phone || '',
      address: row.address || '',
      country_id: row.country_id || '',
      state_id: row.state_id || '',
      city_id: row.city_id || '',
      zones: Array.isArray(row.zones) ? row.zones : [],
      pincode: row.pincode || '',
      gstin: row.gstin || '',
      pan: row.pan || '',
      territory: row.territory || '',
      commission_rate: row.commission_rate || '',
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
    if (!window.confirm(`Are you sure you want to delete this distributor? This will also delete the associated user account.`)) {
      return;
    }

    // Validate that row has an ID - check multiple possible ID field names
    const distributorId = row.id || row.distributor_id || row.distributorId;
    if (!distributorId) {
      console.error('Delete failed: Missing distributor ID', row);
      showError('Invalid distributor data: missing ID. Please refresh the page and try again.');
      return;
    }

    // Get phone number from distributor to find associated user
    const distributorPhone = row.phone || row.phoneNumber || '';
    
    // Optimistically remove from table immediately
    const distributorName = row.distributor_name || 'Distributor';
    setDistributors(prev => prev.filter(d => {
      const id = d.id || d.distributor_id || d.distributorId;
      return id !== distributorId;
    }));

    try {
      setLoading(true);
      setError(null);
      console.log('[Delete Distributor] Deleting distributor with ID:', distributorId);
      
      // Delete distributor first
      await deleteDistributor(distributorId);
      console.log('[Delete Distributor] Distributor deleted successfully');
      
      // Now find and delete associated user account by phone number
      if (distributorPhone) {
        try {
          const { getUsers, deleteUser } = await import('../services/apiService');
          console.log('[Delete Distributor] Finding user account with phone:', distributorPhone);
          
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
          
          console.log('[Delete Distributor] Total users found:', usersArray.length);
          console.log('[Delete Distributor] Searching for user with phone:', distributorPhone);
          
          // Normalize phone numbers for comparison (remove +, spaces, dashes)
          const normalizePhone = (phone) => {
            if (!phone) return '';
            return String(phone).trim().replace(/^\+/, '').replace(/[\s-]/g, '');
          };
          
          const normalizedDistributorPhone = normalizePhone(distributorPhone);
          console.log('[Delete Distributor] Normalized distributor phone:', normalizedDistributorPhone);
          
          // Find user by phone number (try multiple matching strategies)
          const foundUser = usersArray.find(u => {
            const userPhone = (u.phone || u.phoneNumber || '').trim();
            const normalizedUserPhone = normalizePhone(userPhone);
            
            // Log for debugging
            if (normalizedUserPhone === normalizedDistributorPhone) {
              console.log('[Delete Distributor] Match found! User phone:', userPhone, 'Normalized:', normalizedUserPhone);
            }
            
            // Try exact match
            if (userPhone === distributorPhone) return true;
            // Try normalized match (without +)
            if (normalizedUserPhone === normalizedDistributorPhone) return true;
            // Try with + prefix variations
            if (userPhone === `+${distributorPhone}` || `+${userPhone}` === distributorPhone) return true;
            // Try normalized with + prefix
            if (`+${normalizedUserPhone}` === `+${normalizedDistributorPhone}`) return true;
            
            return false;
          });
          
          if (foundUser) {
            const userId = foundUser.user_id || foundUser.id;
            console.log('[Delete Distributor] Found associated user account:', {
              userId,
              userPhone: foundUser.phone || foundUser.phoneNumber,
              userName: foundUser.full_name || foundUser.name
            });
            
            try {
              await deleteUser(userId);
              console.log('[Delete Distributor] User account deleted successfully');
              showSuccess('Distributor and associated user account deleted successfully');
            } catch (deleteError) {
              console.error('[Delete Distributor] Error calling deleteUser:', deleteError);
              throw deleteError;
            }
          } else {
            console.warn('[Delete Distributor] No user account found with phone:', distributorPhone);
            console.warn('[Delete Distributor] Available user phones:', usersArray.map(u => ({
              id: u.user_id || u.id,
              phone: u.phone || u.phoneNumber,
              name: u.full_name || u.name
            })));
            showSuccess('Distributor deleted successfully. (No associated user account found - check console for details)');
          }
        } catch (userDeleteError) {
          console.error('[Delete Distributor] Error deleting user account:', userDeleteError);
          console.error('[Delete Distributor] Error details:', {
            message: userDeleteError.message,
            errorData: userDeleteError.errorData,
            statusCode: userDeleteError.statusCode
          });
          // Don't fail the whole operation if user deletion fails
          showSuccess('Distributor deleted successfully. (User account deletion failed - check console for details)');
        }
      } else {
        console.warn('[Delete Distributor] No phone number found in distributor record');
        console.warn('[Delete Distributor] Distributor row data:', row);
        showSuccess('Distributor deleted successfully');
      }
      
      setError(null);
    } catch (error) {
      console.error('[Delete Distributor] Delete distributor error:', error);
      
      // Revert optimistic update on error
      if (selectedCountryFilter) {
        await fetchDistributorsForCountry(selectedCountryFilter);
      } else {
        // If no filter, we can't easily restore, so just show error
        setError(`Failed to delete: ${error.message}`);
      }
      
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        showError(`Failed to delete distributor: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.distributor_name || formData.distributor_name.trim() === '') {
      setError('Please enter distributor name');
      return;
    }
    if (!formData.trade_name || formData.trade_name.trim() === '') {
      setError('Please enter trade name');
      return;
    }
    if (!formData.contact_person || formData.contact_person.trim() === '') {
      setError('Please enter contact person');
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
      // Format phone number consistently (will be used for both user account and distributor)
      let phoneNumber = formData.phone.trim();
      if (!phoneNumber.startsWith('+')) {
        phoneNumber = phoneNumber.replace(/^0+/, '');
        if (!phoneNumber.startsWith('91')) {
          phoneNumber = `91${phoneNumber}`;
        }
        phoneNumber = `+${phoneNumber}`;
      }

      const dataToSend = {
        distributor_name: formData.distributor_name.trim(),
        trade_name: formData.trade_name.trim(),
        contact_person: formData.contact_person.trim(),
        email: formData.email.trim(),
        phone: phoneNumber, // Use formatted phone number
        address: formData.address ? formData.address.trim() : '',
        country_id: formData.country_id,
        state_id: formData.state_id || '',
        city_id: formData.city_id || '',
        zones: Array.isArray(formData.zones) ? formData.zones : [],
        pincode: formData.pincode ? formData.pincode.trim() : '',
        gstin: formData.gstin ? formData.gstin.trim() : '',
        pan: formData.pan ? formData.pan.trim() : '',
        territory: formData.territory ? formData.territory.trim() : '',
        commission_rate: parseFloat(formData.commission_rate) || 0,
      };

      if (editRow) {
        // Validate that editRow has an ID - check multiple possible ID field names
        const distributorId = editRow.id || editRow.distributor_id || editRow.distributorId;
        if (!distributorId) {
          console.error('Update failed: Missing distributor ID', editRow);
          showError('Invalid distributor data: missing ID. Please refresh the page and try again.');
          setLoading(false);
          return;
        }
        
        // Optimistically update the distributor in the table immediately
        const updatedDistributor = {
          ...editRow,
          ...dataToSend,
          is_active: editRow.is_active !== undefined ? editRow.is_active : true,
          id: distributorId,
        };
        
        setDistributors(prev => prev.map(d => {
          const id = d.id || d.distributor_id || d.distributorId;
          return id === distributorId ? updatedDistributor : d;
        }));
        
        console.log('Updating distributor with ID:', distributorId, 'Data:', dataToSend);
        
        try {
          await updateDistributor(distributorId, { 
          ...dataToSend, 
          is_active: editRow.is_active !== undefined ? editRow.is_active : true 
        });
          
          // Show success notification
          showSuccess('Distributor updated successfully');
          setError(null);
          setOpenAdd(false);
          setEditRow(null);
          resetForm();
        } catch (error) {
          console.error('Update distributor error:', error);
          
          // Revert optimistic update on error by refetching
          if (selectedCountryFilter) {
            await fetchDistributorsForCountry(selectedCountryFilter);
          }
          
          // Check for backend initialization error
          const isInitError = error.isInitializationError || 
                             (error.message && error.message.toLowerCase().includes("cannot access 'distributor' before initialization"));
          
          if (isInitError) {
            showError('Backend initialization error. Please refresh the page and try again. If the problem persists, contact the administrator.');
          } else if (!error.message?.toLowerCase().includes('token expired') && 
              !error.message?.toLowerCase().includes('unauthorized')) {
            showError(`Failed to update distributor: ${error.message}`);
          }
          setLoading(false);
          return;
        }
      } else {
        // Create new distributor - first create user account
        try {
          // Phone number is already formatted in dataToSend.phone
          const phoneNumber = dataToSend.phone;

          // Get roles to find distributor role ID
          const rolesResponse = await getRoles();
          let rolesArray = [];
          if (Array.isArray(rolesResponse)) {
            rolesArray = rolesResponse;
          } else if (rolesResponse && Array.isArray(rolesResponse.data)) {
            rolesArray = rolesResponse.data;
          } else if (rolesResponse && Array.isArray(rolesResponse.roles)) {
            rolesArray = rolesResponse.roles;
          }

          // Find distributor role ID
          const distributorRole = rolesArray.find(r => {
            const roleName = (r.role_name || r.name || r.roleName || r.title || r.role || '').toLowerCase().trim();
            return roleName === 'distributor';
          });

          if (!distributorRole) {
            throw new Error('Distributor role not found. Please contact administrator.');
          }

          const distributorRoleId = distributorRole.role_id || distributorRole.id || distributorRole.roleId;

          // Create user account first
          const userData = {
            phoneNumber,
            fullName: formData.contact_person.trim() || formData.distributor_name.trim(),
            roleId: distributorRoleId,
          };

          console.log('[Create Distributor] Creating user account with:', {
            phoneNumber,
            fullName: userData.fullName,
            roleId: distributorRoleId,
            roleName: distributorRole.role_name || distributorRole.name
          });

          let registeredUser;
          let newUserId;
          
          try {
            registeredUser = await register(userData);
            console.log('[Create Distributor] User registration response (full):', JSON.stringify(registeredUser, null, 2));
            
            // Try multiple possible response structures
            newUserId = registeredUser.user_id || 
                        registeredUser.id || 
                        registeredUser.user?.user_id || 
                        registeredUser.user?.id ||
                        registeredUser.data?.user_id ||
                        registeredUser.data?.id ||
                        registeredUser.user_id ||
                        (registeredUser.user && (registeredUser.user.user_id || registeredUser.user.id));

            console.log('[Create Distributor] Extracted user_id:', newUserId, 'from response structure');

            if (!newUserId) {
              console.error('[Create Distributor] User registration failed - no user_id returned');
              console.error('[Create Distributor] Full registration response:', registeredUser);
              
              // Check if user already exists (might be trying to create duplicate)
              const responseMessage = (registeredUser.message || registeredUser.error || registeredUser.msg || '').toLowerCase();
              if (responseMessage.includes('already exists') || responseMessage.includes('duplicate')) {
                throw new Error('User with this phone number already exists. Please use a different phone number or contact administrator.');
              }
              
              // If registration succeeded but no user_id, the backend might return user differently
              // Try to get user by phone number
              console.log('[Create Distributor] Attempting to find user by phone number...');
              try {
                const { getUsers } = await import('../services/apiService');
                const usersResponse = await getUsers();
                let usersArray = [];
                if (Array.isArray(usersResponse)) {
                  usersArray = usersResponse;
                } else if (usersResponse && Array.isArray(usersResponse.data)) {
                  usersArray = usersResponse.data;
                } else if (usersResponse && Array.isArray(usersResponse.users)) {
                  usersArray = usersResponse.users;
                }
                
                const foundUser = usersArray.find(u => {
                  const userPhone = (u.phone || u.phoneNumber || '').trim();
                  const normalizedUserPhone = userPhone.replace(/^\+/, '');
                  const normalizedInputPhone = phoneNumber.replace(/^\+/, '');
                  return userPhone === phoneNumber || normalizedUserPhone === normalizedInputPhone;
                });
                
                if (foundUser) {
                  newUserId = foundUser.user_id || foundUser.id;
                  console.log('[Create Distributor] Found user by phone number with ID:', newUserId);
                } else {
                  throw new Error('User account creation may have failed. User ID not returned and user not found by phone number.');
                }
              } catch (findError) {
                console.error('[Create Distributor] Error finding user by phone:', findError);
                throw new Error('Failed to create user account. User ID not returned. Please check if user was created successfully.');
              }
            }

            console.log('[Create Distributor] User account created/found successfully with ID:', newUserId);
          } catch (registerError) {
            console.error('[Create Distributor] User registration error:', registerError);
            // Check if it's a "user already exists" error
            const errorMsg = (registerError.message || '').toLowerCase();
            if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
              // User already exists - try to find the existing user
              console.log('[Create Distributor] User already exists, attempting to find existing user...');
              try {
                const { getUsers } = await import('../services/apiService');
                const usersResponse = await getUsers();
                let usersArray = [];
                if (Array.isArray(usersResponse)) {
                  usersArray = usersResponse;
                } else if (usersResponse && Array.isArray(usersResponse.data)) {
                  usersArray = usersResponse.data;
                } else if (usersResponse && Array.isArray(usersResponse.users)) {
                  usersArray = usersResponse.users;
                }
                
                const existingUser = usersArray.find(u => {
                  const userPhone = (u.phone || u.phoneNumber || '').trim();
                  return userPhone === phoneNumber || userPhone.replace(/^\+/, '') === phoneNumber.replace(/^\+/, '');
                });
                
                if (existingUser) {
                  newUserId = existingUser.user_id || existingUser.id;
                  console.log('[Create Distributor] Found existing user with ID:', newUserId);
                  showSuccess('User account already exists. Using existing account.');
                } else {
                  throw new Error('User account creation failed and existing user not found. Please contact administrator.');
                }
              } catch (findError) {
                console.error('[Create Distributor] Error finding existing user:', findError);
                throw new Error('Failed to create or find user account. Please contact administrator.');
              }
            } else {
              throw registerError;
            }
          }

          // Verify user can be found immediately after creation
          // This helps catch issues early
          console.log('[Create Distributor] Verifying user account can be found...');
          let userVerified = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const { checkUser } = await import('../services/apiService');
              await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); // Wait 500ms, 1s, 1.5s
              const checkResponse = await checkUser(phoneNumber, { autoSendOTP: false });
              console.log(`[Create Distributor] User verification attempt ${attempt + 1}:`, checkResponse);
              if (checkResponse && !checkResponse.error) {
                userVerified = true;
                break;
              }
            } catch (checkError) {
              console.warn(`[Create Distributor] User verification attempt ${attempt + 1} failed:`, checkError);
              if (attempt === 2) {
                // Last attempt failed - log detailed error
                console.error('[Create Distributor] User verification failed after 3 attempts. User may not be accessible yet.');
                console.error('[Create Distributor] Phone number used:', phoneNumber);
                console.error('[Create Distributor] User ID created:', newUserId);
              }
            }
          }
          
          if (!userVerified) {
            console.error('[Create Distributor] WARNING: User account created but cannot be verified. This may cause login issues.');
          }

          // Create distributor (backend should link user_id based on phone/email)
          // The backend should automatically link the user account created above
          // Phone number is already in dataToSend with correct format
          console.log('[Create Distributor] Creating distributor with phone:', phoneNumber);
          const newDistributor = await createDistributor(dataToSend);
          console.log('[Create Distributor] Distributor created successfully:', newDistributor);
          
          const distributorId = newDistributor.distributor_id || newDistributor.id;
          
          // IMPORTANT: Backend needs to link user_id to distributor
          // The backend should automatically link by matching phone number
          // If backend doesn't support user_id in createDistributor, it must link by phone
          console.log('[Create Distributor] Distributor created. Backend should link user_id:', newUserId, 'to distributor_id:', distributorId, 'by phone:', phoneNumber);
          
          // Try to update distributor with user_id if backend supports it in update
          // This is a fallback in case backend doesn't auto-link by phone number
          if (newUserId && distributorId) {
            try {
              const { updateDistributor } = await import('../services/apiService');
              // Some backends might accept user_id in update but not create
              // Try updating distributor with user_id (if backend supports it)
              // Note: This might fail if backend doesn't accept user_id in updateDistributor
              const updateData = {
                ...dataToSend,
                is_active: true
              };
              // Only add user_id if backend might support it (some backends do)
              // updateData.user_id = newUserId; // Uncomment if backend supports this
              
              await updateDistributor(distributorId, updateData);
              console.log('[Create Distributor] Distributor updated (user_id linking handled by backend via phone match)');
            } catch (updateError) {
              console.warn('[Create Distributor] Could not update distributor (may not be needed):', updateError);
              // Backend should link automatically by phone number
            }
          }
          
          // Also try updating user account to ensure phone number matches exactly
          if (newUserId) {
            try {
              const { updateUser } = await import('../services/apiService');
              await updateUser(newUserId, {
                name: userData.fullName,
                email: formData.email.trim(),
                phoneNumber: phoneNumber, // Ensure phone number is exactly as stored
                role_id: distributorRoleId,
              });
              console.log('[Create Distributor] User account updated to ensure phone number matches');
            } catch (updateError) {
              console.warn('[Create Distributor] Could not update user account (may not be needed):', updateError);
            }
          }
          
          // Wait a moment and verify user can be found
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          try {
            const { checkUser } = await import('../services/apiService');
            const checkResponse = await checkUser(phoneNumber, { autoSendOTP: false });
            console.log('[Create Distributor] User verification after creation:', checkResponse);
            if (checkResponse && !checkResponse.error) {
              showSuccess(`Distributor created successfully! User account verified. Phone: ${phoneNumber}. The distributor can now login.`);
            } else {
              showSuccess(`Distributor created successfully! User account created with phone: ${phoneNumber}. Please wait a moment before logging in.`);
            }
          } catch (verifyError) {
            console.warn('[Create Distributor] User verification failed:', verifyError);
            showSuccess(`Distributor created successfully! User account created with phone: ${phoneNumber}. If login fails, please contact administrator.`);
          }
          
          // Optimistically add to table if it matches the current filter
          if (selectedCountryFilter && newDistributor && newDistributor.country_id === selectedCountryFilter) {
            setDistributors(prev => [...prev, {
              ...newDistributor,
              id: newDistributor.id || newDistributor.distributor_id,
              isActive: newDistributor.is_active !== false,
            }]);
          } else if (selectedCountryFilter) {
            // If country doesn't match filter, just refresh
            await fetchDistributorsForCountry(selectedCountryFilter);
          }
          
          // Success notification is shown above after distributor creation
      setError(null);
      setOpenAdd(false);
      setEditRow(null);
      resetForm();
        } catch (createError) {
          console.error('Create distributor error:', createError);
          
          // Revert by refreshing if needed
          if (selectedCountryFilter) {
            await fetchDistributorsForCountry(selectedCountryFilter);
          }
          
          if (!createError.message?.toLowerCase().includes('token expired') && 
              !createError.message?.toLowerCase().includes('unauthorized')) {
            showError(`Failed to create distributor: ${createError.message}`);
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
        showError(`Failed to create distributor: ${error.message}`);
        setError(`Failed to save: ${error.message}`);
      }
      setLoading(false);
    }
  };

  return (
    <div className="dash-page">
      <div className="dash-container">
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
              title="Distributors"
              columns={columns}
              rows={rows}
              onAddNew={handleAdd}
              addNewText="Add New Distributor"
              onImport={() => {
                setError(null);
                if (selectedCountryFilter) {
                  fetchDistributorsForCountry(selectedCountryFilter);
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
                      const oldCountryId = selectedCountryFilter;
                      console.log('[Filter] Country selection changed from', oldCountryId, 'to', newCountryId);
                      
                      // Clear distributors immediately when changing countries
                      setDistributors([]);
                      
                      // Update state - useEffect will handle fetching or clearing
                      setSelectedCountryFilter(newCountryId);
                      
                      // If "All Countries" is selected (empty), ensure distributors are cleared
                      if (!newCountryId) {
                        console.log('[Filter] All Countries selected - clearing distributors');
                        setDistributors([]);
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
        title="Add New Distributor"
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
            <label className="ui-label">Distributor Name *</label>
            <input 
              className="ui-input" 
              placeholder="Distributor name"
              value={formData.distributor_name}
              onChange={(e) => handleInputChange('distributor_name', e.target.value)}
              required
            />
          </div>
          <div className="form-group form-group--full">
            <label className="ui-label">Trade Name *</label>
            <input 
              className="ui-input" 
              placeholder="Trade name"
              value={formData.trade_name}
              onChange={(e) => handleInputChange('trade_name', e.target.value)}
              required
            />
          </div>
          <div className="form-group form-group--full">
            <label className="ui-label">Contact Person *</label>
            <input 
              className="ui-input" 
              placeholder="Contact person"
              value={formData.contact_person}
              onChange={(e) => handleInputChange('contact_person', e.target.value)}
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
            <input 
              className="ui-input" 
              placeholder="Phone"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Country *</label>
            <DropdownSelector
              options={[
                { value: '', label: 'Select Country' },
                ...countries.map(c => ({ value: c.id, label: c.name }))
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
                ...states.map(s => ({ value: s.id, label: s.name }))
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
                ...cities.map(c => ({ value: c.id, label: c.name }))
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
              selectedZones={Array.isArray(formData.zones) ? formData.zones : []}
              onChange={(updated) => handleInputChange('zones', updated)}
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
          <div className="form-group">
            <label className="ui-label">Pincode</label>
            <input 
              className="ui-input" 
              placeholder="Pincode"
              value={formData.pincode}
              onChange={(e) => handleInputChange('pincode', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">GSTIN</label>
            <input 
              className="ui-input" 
              placeholder="GSTIN"
              value={formData.gstin}
              onChange={(e) => handleInputChange('gstin', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">PAN</label>
            <input 
              className="ui-input" 
              placeholder="PAN"
              value={formData.pan}
              onChange={(e) => handleInputChange('pan', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Territory</label>
            <input 
              className="ui-input" 
              placeholder="Territory"
              value={formData.territory}
              onChange={(e) => handleInputChange('territory', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Commission Rate</label>
            <input 
              className="ui-input" 
              type="number"
              step="0.01"
              placeholder="Commission rate"
              value={formData.commission_rate}
              onChange={(e) => handleInputChange('commission_rate', e.target.value)}
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
        title="Edit Distributor"
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
            <label className="ui-label">Distributor Name *</label>
            <input 
              className="ui-input" 
              placeholder="Distributor name"
              value={formData.distributor_name}
              onChange={(e) => handleInputChange('distributor_name', e.target.value)}
              required
            />
          </div>
          <div className="form-group form-group--full">
            <label className="ui-label">Trade Name *</label>
            <input 
              className="ui-input" 
              placeholder="Trade name"
              value={formData.trade_name}
              onChange={(e) => handleInputChange('trade_name', e.target.value)}
              required
            />
          </div>
          <div className="form-group form-group--full">
            <label className="ui-label">Contact Person *</label>
            <input 
              className="ui-input" 
              placeholder="Contact person"
              value={formData.contact_person}
              onChange={(e) => handleInputChange('contact_person', e.target.value)}
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
              selectedZones={Array.isArray(formData.zones) ? formData.zones : []}
              onChange={(updated) => handleInputChange('zones', updated)}
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
          <div className="form-group">
            <label className="ui-label">Pincode</label>
            <input 
              className="ui-input" 
              placeholder="Pincode"
              value={formData.pincode}
              onChange={(e) => handleInputChange('pincode', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">GSTIN</label>
            <input 
              className="ui-input" 
              placeholder="GSTIN"
              value={formData.gstin}
              onChange={(e) => handleInputChange('gstin', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">PAN</label>
            <input 
              className="ui-input" 
              placeholder="PAN"
              value={formData.pan}
              onChange={(e) => handleInputChange('pan', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Territory</label>
            <input 
              className="ui-input" 
              placeholder="Territory"
              value={formData.territory}
              onChange={(e) => handleInputChange('territory', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Commission Rate</label>
            <input 
              className="ui-input" 
              type="number"
              step="0.01"
              placeholder="Commission rate"
              value={formData.commission_rate}
              onChange={(e) => handleInputChange('commission_rate', e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DashboardDistributor;
