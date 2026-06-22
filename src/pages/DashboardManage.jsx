import React, { useMemo, useState, useEffect, useRef } from 'react';
import TableWithControls from '../components/ui/TableWithControls';
import AsidePanel from '../components/ui/AsidePanel';
import RowActions from '../components/ui/RowActions';
import DropdownSelector from '../components/ui/DropdownSelector';
import { useConfirm } from '../components/ui/ConfirmProvider';
import {
  getCountries,
  createCountry,
  updateCountry,
  deleteCountry,
  getStates,
  createState,
  updateState,
  deleteState,
  getCities,
  createCity,
  updateCity,
  deleteCity,
  getZones,
  getAllZones,
  createZone,
  updateZone,
  deleteZone,
} from '../services/apiService';
import '../styles/pages/dashboard-orders.css';

const DashboardManage = () => {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('Country');
  const [openAdd, setOpenAdd] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data states
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  const [allZones, setAllZones] = useState([]); // all zones unfiltered

  // Form states
  const [formData, setFormData] = useState({
    type: 'Country',
    // Country fields
    name: '',
    code: '',
    phone_code: '',
    currency: '',
    // State fields
    country_id: '',
    // City fields
    state_id: '',
    // Zone fields
    city_id: '',
    description: '',
    zone_code: '',
  });

  // Options for dropdowns
  const [countryOptions, setCountryOptions] = useState([]);
  const [stateOptions, setStateOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  
  // Filter states for tabs
  const [stateCountryFilter, setStateCountryFilter] = useState('');
  const [cityStateFilter, setCityStateFilter] = useState('');
  const [zoneCityFilter, setZoneCityFilter] = useState('');
  
  // Ref to prevent multiple simultaneous API calls
  const fetchingRef = useRef(false);
  const lastFetchedTabRef = useRef('');
  const fetchingStatesRef = useRef(false);
  const fetchingCitiesRef = useRef(false);

  // Fetch data based on active tab
  useEffect(() => {
    // Reset last fetched tab when tab changes
    if (lastFetchedTabRef.current !== activeTab) {
      lastFetchedTabRef.current = '';
    }
    
    // Prevent multiple simultaneous calls
    if (fetchingRef.current) {
      return;
    }
    
    fetchingRef.current = true;
    lastFetchedTabRef.current = activeTab;
    
    fetchDataForTab(activeTab).finally(() => {
      fetchingRef.current = false;
    });
  }, [activeTab]);
  
  // Set default filter values after data loads (only once per tab switch)
  const defaultFilterSetRef = useRef({ State: false, City: false, Zone: false });
  
  useEffect(() => {
    // Reset default filter flags when tab changes
    if (activeTab !== 'State') defaultFilterSetRef.current.State = false;
    if (activeTab !== 'City') defaultFilterSetRef.current.City = false;
  }, [activeTab]);
  
  useEffect(() => {
    if (countries.length > 0 && activeTab === 'State' && !stateCountryFilter && !defaultFilterSetRef.current.State) {
      // Find India by name or code
      const india = countries.find(c => 
        c.name?.toLowerCase() === 'india' || 
        c.code?.toLowerCase() === 'in'
      );
      if (india) {
        setStateCountryFilter(india.id);
        defaultFilterSetRef.current.State = true;
      }
    }
  }, [countries, activeTab, stateCountryFilter]);
  
  // Fetch states when country filter changes in State tab
  useEffect(() => {
    if (activeTab === 'State' && stateCountryFilter) {
      // Prevent multiple simultaneous calls
      if (fetchingStatesRef.current) {
        return;
      }
      
      fetchingStatesRef.current = true;
      getStates(stateCountryFilter)
        .then((statesData) => {
          setStates(statesData || []);
        })
        .catch((error) => {
          // Silently handle "States not found" - it's a valid case
          if (error.message?.toLowerCase().includes('states not found') ||
              error.message?.toLowerCase().includes('no states found')) {
            setStates([]);
          } else if (!error.message?.toLowerCase().includes('token expired') && 
                     !error.message?.toLowerCase().includes('unauthorized')) {
            console.error('Error fetching states:', error);
            setStates([]);
          }
        })
        .finally(() => {
          fetchingStatesRef.current = false;
        });
    } else if (activeTab === 'State' && !stateCountryFilter) {
      // Clear states when filter is cleared
      setStates([]);
    }
  }, [stateCountryFilter, activeTab]);
  
  // Fetch states for India when City tab loads
  useEffect(() => {
    if (countries.length > 0 && activeTab === 'City' && states.length === 0) {
      // Find India by name or code
      const india = countries.find(c => 
        c.name?.toLowerCase() === 'india' || 
        c.code?.toLowerCase() === 'in'
      );
      if (india) {
        // Prevent multiple simultaneous calls
        if (fetchingStatesRef.current) {
          return;
        }
        
        fetchingStatesRef.current = true;
        getStates(india.id)
          .then((statesData) => {
            setStates(statesData || []);
          })
          .catch((error) => {
            // Silently handle "States not found" - it's a valid case
            if (error.message?.toLowerCase().includes('states not found') ||
                error.message?.toLowerCase().includes('no states found')) {
              setStates([]);
            } else if (!error.message?.toLowerCase().includes('token expired') && 
                       !error.message?.toLowerCase().includes('unauthorized')) {
              console.error('Error fetching states for City tab:', error);
              setStates([]);
            }
          })
          .finally(() => {
            fetchingStatesRef.current = false;
          });
      }
    }
  }, [countries, activeTab, states.length]);
  
  useEffect(() => {
    if (states.length > 0 && activeTab === 'City' && !cityStateFilter && !defaultFilterSetRef.current.City) {
      // Find Maharashtra by name or code
      const maharashtra = states.find(s => 
        s.name?.toLowerCase() === 'maharashtra' || 
        s.code?.toLowerCase() === 'mh'
      );
      if (maharashtra) {
        setCityStateFilter(maharashtra.id);
        defaultFilterSetRef.current.City = true;
      }
    }
  }, [states, activeTab, cityStateFilter]);
  
  // Fetch cities when state filter changes in City tab
  useEffect(() => {
    if (activeTab === 'City' && cityStateFilter) {
      // Prevent multiple simultaneous calls
      if (fetchingCitiesRef.current) {
        return; 
      }
      
      fetchingCitiesRef.current = true; 
      getCities(cityStateFilter)
        .then((citiesData) => {
          setCities(citiesData || []);
        })
        .catch((error) => {
          // Silently handle "Cities not found" - it's a valid case
          if (error.message?.toLowerCase().includes('cities not found') ||
              error.message?.toLowerCase().includes('no cities found')) {
            setCities([]);
          } else if (!error.message?.toLowerCase().includes('token expired') && 
                     !error.message?.toLowerCase().includes('unauthorized')) {
            console.error('Error fetching cities:', error);
            setCities([]);
          }
        })
        .finally(() => {
          fetchingCitiesRef.current = false;
        });
    } else if (activeTab === 'City' && !cityStateFilter) {
      // Clear cities when filter is cleared
      setCities([]);
    }
  }, [cityStateFilter, activeTab]);
  
  // Reset zone city filter when leaving Zone tab
  const [zoneCitiesLoading] = useState(false);

  // Update dropdown options when data changes
  useEffect(() => {
    setCountryOptions(countries.map(c => ({ value: c.id, label: c.name })));
  }, [countries]);

  // Update stateOptions from states array (for filters) - only when not in form
  useEffect(() => {
    if (!openAdd && !editRow) {
      setStateOptions(states.map(s => ({ value: s.id, label: s.name })));
    }
  }, [states, openAdd, editRow]);

  // Update cityOptions from cities array (for filters) - only when not in form
  // For Zone tab, update cityOptions with all cities from all states
  // For City tab, cityOptions should match cities array (which is filtered by state)
  useEffect(() => {
    if (!openAdd && !editRow) {
      // Always update cityOptions with current cities array
      // For Zone tab, this will be all cities from all states
      // For City tab, this will be cities from the selected state
      setCityOptions(cities.map(c => ({ value: c.id, label: c.name })));
    }
  }, [cities, openAdd, editRow, activeTab]);

  useEffect(() => {
    // Only fetch states for form dropdowns when form is open
    if ((openAdd || editRow) && formData.country_id) {
      fetchStates(formData.country_id);
    }
  }, [formData.country_id, openAdd, editRow]);

  useEffect(() => {
    // Only fetch cities for form dropdowns when form is open
    if ((openAdd || editRow) && formData.state_id) {
      fetchCities(formData.state_id);
    }
  }, [formData.state_id, openAdd, editRow]);

  useEffect(() => {
    if (formData.city_id) {
      fetchZones(formData.city_id);
    } else {
      setZones([]);
    }
  }, [formData.city_id]);

  const fetchDataForTab = async (tab) => {
    setLoading(true);
    setError(null);
    try {
      switch (tab) {
        case 'Country':
          const countriesData = await getCountries().catch((error) => {
            if (!error.message?.toLowerCase().includes('token expired') && 
                !error.message?.toLowerCase().includes('unauthorized')) {
              console.error('Error fetching countries:', error);
              if (error.message?.toLowerCase().includes("doesn't exist") || 
                  error.message?.toLowerCase().includes('table')) {
                setError('Database tables not found. Please contact the administrator to set up the database tables.');
              } else {
                setError(`Failed to load countries: ${error.message}`);
              }
            }
            return [];
          });
          setCountries(countriesData || []);
          break;
        
        case 'State':
          // Only fetch countries, states will be fetched when country filter is selected
          const countriesForStates = await getCountries().catch(() => []);
          setCountries(countriesForStates || []);
          // Don't fetch states here - wait for country filter selection
          setStates([]);
          break;
        
        case 'City':
          // Only fetch countries, states will be fetched for default country (India)
          const countriesForCities = await getCountries().catch(() => []);
          setCountries(countriesForCities || []);
          // Don't fetch states here - wait for default country selection
          setStates([]);
          // Don't fetch cities here - wait for state filter selection
          setCities([]);
          break;
        
        case 'Zone':
          // Fetch all zones directly, and cities for the filter dropdown
          const [allZonesData, countriesForZones] = await Promise.all([
            getAllZones().catch(() => []),
            getCountries().catch(() => []),
          ]);
          setAllZones(allZonesData || []);
          setZones(allZonesData || []);
          setCountries(countriesForZones || []);
          // Fetch cities for filter dropdown (all cities from India)
          const indiaForZone = (countriesForZones || []).find(c =>
            c.name?.toLowerCase() === 'india' || c.code?.toLowerCase() === 'in'
          );
          if (indiaForZone) {
            const statesForZone = await getStates(indiaForZone.id).catch(() => []);
            const allCitiesPromises = (statesForZone || []).map(s =>
              getCities(s.id).catch(() => [])
            );
            const citiesArrays = await Promise.all(allCitiesPromises);
            setCities(citiesArrays.flat());
          }
          break;

        default:
          break;
      }
    } catch (error) {
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        console.error('Error fetching data:', error);
        if (error.message?.toLowerCase().includes("doesn't exist") || 
            error.message?.toLowerCase().includes('table')) {
          setError('Database tables not found. Please contact the administrator to set up the database tables.');
        } else {
          setError(`Failed to load data: ${error.message}`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStates = async (countryId, updateMainArray = false) => {
    try {
      const statesData = await getStates(countryId);
      // Only update main states array if we're on State tab or explicitly requested
      if (updateMainArray || activeTab === 'State') {
        setStates(statesData || []);
      }
      // Always update stateOptions for form dropdowns
      setStateOptions((statesData || []).map(s => ({ value: s.id, label: s.name })));
    } catch (error) {
      // Don't log token expiration errors as they're handled by apiService
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        console.error('Error fetching states:', error);
      }
      if (updateMainArray || activeTab === 'State') {
        setStates([]);
      }
      setStateOptions([]);
    }
  };

  const fetchCities = async (stateId, updateMainArray = false) => {
    try {
      const citiesData = await getCities(stateId);
      // Only update main cities array if we're on City tab or explicitly requested
      if (updateMainArray || activeTab === 'City') {
        setCities(citiesData || []);
      }
      // Always update cityOptions for form dropdowns
      setCityOptions((citiesData || []).map(c => ({ value: c.id, label: c.name })));
    } catch (error) {
      // Don't log token expiration errors as they're handled by apiService
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        console.error('Error fetching cities:', error);
      }
      if (updateMainArray || activeTab === 'City') {
        setCities([]);
      }
      setCityOptions([]);
    }
  };

  const fetchZones = async (cityId) => {
    try {
      const zonesData = await getZones(cityId);
      setZones(zonesData || []);
    } catch (error) {
      // Don't log token expiration errors as they're handled by apiService
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        console.error('Error fetching zones:', error);
      }
      setZones([]);
    }
  };

  // Combine all data into rows
  const rows = useMemo(() => {
    const allRows = [];
    
    countries.forEach(country => {
      allRows.push({
        id: country.id,
        type: 'Country',
        name: country.name,
        code: country.code,
        phone_code: country.phone_code,
        currency: country.currency,
        details: `${country.code} | ${country.phone_code} | ${country.currency}`,
        data: country,
      });
    });
    
    states.forEach(state => {
      const country = countries.find(c => c.id === state.country_id);
      allRows.push({
        id: state.id,
        type: 'State',
        name: state.name,
        details: `${state.code} | ${country?.name || 'N/A'}`,
        data: state,
      });
    });
    
    cities.forEach(city => {
      const state = states.find(s => s.id === city.state_id);
      allRows.push({
        id: city.id,
        type: 'City',
        name: city.name,
        details: state?.name || 'N/A',
        data: city,
      });
    });
    
    allZones.forEach(zone => {
      const city = cities.find(c => c.id === zone.city_id);
      allRows.push({
        id: zone.id,
        type: 'Zone',
        name: zone.name,
        details: `${zone.zone_code || 'N/A'} | ${city?.name || 'N/A'}`,
        data: zone,
      });
    });

    return allRows;
  }, [countries, states, cities, allZones]);

  const columns = useMemo(() => {
    // Different columns for different tabs
    if (activeTab === 'Country') {
      return [
        { key: 'name', label: 'NAME' },
        { key: 'code', label: 'CODE' },
        { key: 'phone_code', label: 'PHONE CODE' },
        { key: 'currency', label: 'CURRENCY' },
        { key: 'action', label: 'ACTION', render: (_v, row) => (
          <RowActions 
            onEdit={() => handleEdit(row)} 
            onDelete={() => handleDelete(row)} 
          />
        ) },
      ];
    }
    // Default columns for other tabs
    return [
      { key: 'type', label: 'TYPE' },
      { key: 'name', label: 'NAME' },
      { key: 'details', label: 'DETAILS' },
      { key: 'action', label: 'ACTION', render: (_v, row) => (
        <RowActions 
          onEdit={() => handleEdit(row)} 
          onDelete={() => handleDelete(row)} 
        />
      ) },
    ];
  }, [activeTab]);

  const tabs = useMemo(() => ([
    'Country',
    'State',
    'City',
    'Zone',
  ]), []);

  const filteredRowsByTab = useMemo(() => {
    let filtered = rows.filter(row => row.type === activeTab);
    
    // Apply country filter for State tab
    if (activeTab === 'State' && stateCountryFilter) {
      filtered = filtered.filter(row => row.data?.country_id === stateCountryFilter);
    }
    
    // Apply state filter for City tab
    if (activeTab === 'City' && cityStateFilter) {
      filtered = filtered.filter(row => row.data?.state_id === cityStateFilter);
    }
    
    // Apply city filter for Zone tab (optional — shows all if no filter)
    if (activeTab === 'Zone' && zoneCityFilter) {
      filtered = filtered.filter(row => row.data?.city_id === zoneCityFilter);
    }
    
    return filtered;
  }, [rows, activeTab, stateCountryFilter, cityStateFilter, zoneCityFilter]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      // Reset dependent fields when parent changes
      ...(field === 'country_id' && { state_id: '', city_id: '' }),
      ...(field === 'state_id' && { city_id: '' }),
    }));
  };

  const resetForm = () => {
    setFormData({
      type: 'Country',
      name: '',
      code: '',
      phone_code: '',
      currency: '',
      country_id: '',
      state_id: '',
      city_id: '',
      description: '',
      zone_code: '',
    });
  };

  const handleAdd = () => {
    resetForm();
    setFormData(prev => ({ ...prev, type: activeTab }));
    setOpenAdd(true);
  };

  const handleEdit = async (row) => {
    const { type, data } = row;
    const editData = {
      type,
      name: data.name || '',
      code: data.code || '',
      phone_code: data.phone_code || '',
      currency: data.currency || '',
      country_id: data.country_id || '',
      state_id: data.state_id || '',
      city_id: data.city_id || '',
      description: data.description || '',
      zone_code: data.zone_code || '',
    };

    setFormData(editData);
    setEditRow(row);
    
    // Load dependent data for dropdowns
    if (editData.country_id) {
      await fetchStates(editData.country_id);
      if (editData.state_id) {
        await fetchCities(editData.state_id);
        if (editData.city_id) {
          await fetchZones(editData.city_id);
        }
      }
    }
  };

  const handleDelete = async (row) => {
    if (!(await confirm(`Are you sure you want to delete this ${row.type}?`))) {
      return;
    }

    try {
      setLoading(true);
      switch (row.type) {
        case 'Country':
          await deleteCountry(row.id);
          break;
        case 'State':
          await deleteState(row.id);
          break;
        case 'City':
          await deleteCity(row.id);
          break;
        case 'Zone':
          await deleteZone(row.id);
          break;
      }
      await fetchDataForTab(activeTab);
      setError(null); // Clear any previous errors
    } catch (error) {
      // Don't show alert for token expiration as user will be redirected
      if (error.message?.toLowerCase().includes('token expired') || 
          error.message?.toLowerCase().includes('unauthorized')) {
        // Token expiration is handled by apiService, just return
        return;
      }
      console.error('Error deleting:', error);
      
      // Check for foreign key constraint errors
      if (error.message?.toLowerCase().includes('foreign key constraint') ||
          error.message?.toLowerCase().includes('cannot delete or update a parent row')) {
        setError('Cannot delete this item because other records depend on it. Please delete the dependent records first.');
      } else if (error.message?.toLowerCase().includes("doesn't exist") ||
          error.message?.toLowerCase().includes('table')) {
        setError('Database tables not found. Please contact the administrator to set up the database tables.');
      } else {
        setError(`Failed to delete item: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const { type } = formData;
      let dataToSend = {};
      
      switch (type) {
        case 'Country':
          dataToSend = {
            name: formData.name,
            code: formData.code,
            phone_code: formData.phone_code,
            currency: formData.currency,
          };
          if (editRow) {
            await updateCountry(editRow.id, dataToSend);
          } else {
            await createCountry(dataToSend);
          }
          break;
        case 'State':
          dataToSend = {
            name: formData.name,
            code: formData.code,
            country_id: formData.country_id,
          };
          if (editRow) {
            await updateState(editRow.id, dataToSend);
          } else {
            await createState(dataToSend);
          }
          break;
        case 'City':
          dataToSend = {
            name: formData.name,
            state_id: formData.state_id,
          };
          if (editRow) {
            await updateCity(editRow.id, dataToSend);
          } else {
            await createCity(dataToSend);
          }
          break;
        case 'Zone':
          dataToSend = {
            name: formData.name,
            description: formData.description || '',
            city_id: formData.city_id,
            state_id: formData.state_id,
            country_id: formData.country_id,
            zone_code: formData.zone_code || '',
          };
          if (editRow) {
            await updateZone(editRow.id, dataToSend);
          } else {
            await createZone(dataToSend);
          }
          break;
      }
      
      await fetchDataForTab(activeTab);
      setError(null); // Clear any previous errors
      setOpenAdd(false);
      setEditRow(null);
      resetForm();
    } catch (error) {
      // Don't show alert for token expiration as user will be redirected
      if (error.message?.toLowerCase().includes('token expired') || 
          error.message?.toLowerCase().includes('unauthorized')) {
        // Token expiration is handled by apiService, just return
        return;
      }
      console.error('Error saving:', error);
      // Check for database errors
      if (error.message?.toLowerCase().includes("doesn't exist") || 
          error.message?.toLowerCase().includes('table')) {
        setError('Database tables not found. Please contact the administrator to set up the database tables.');
      } else {
        setError(`Failed to save item: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderFormFields = () => {
    const { type } = formData;
    
    switch (type) {
      case 'Country':
        return (
          <>
            <div className="form-group form-group--full">
              <label className="ui-label">Country Name *</label>
              <input
                className="ui-input"
                placeholder="Enter country name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="ui-label">Country Code *</label>
              <input
                className="ui-input"
                placeholder="e.g., IN, US"
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="ui-label">Phone Code *</label>
              <input
                className="ui-input"
                placeholder="e.g., +91, +1"
                value={formData.phone_code}
                onChange={(e) => handleInputChange('phone_code', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="ui-label">Currency *</label>
              <input
                className="ui-input"
                placeholder="e.g., INR, USD"
                value={formData.currency}
                onChange={(e) => handleInputChange('currency', e.target.value)}
                required
              />
            </div>
          </>
        );
      
      case 'State':
        return (
          <>
            <div className="form-group form-group--full">
              <label className="ui-label">Country *</label>
              <DropdownSelector
                options={countryOptions}
                value={formData.country_id}
                onChange={(value) => handleInputChange('country_id', value)}
                placeholder="Select country"
              />
            </div>
            <div className="form-group form-group--full">
              <label className="ui-label">State Name *</label>
              <input
                className="ui-input"
                placeholder="Enter state name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>
            <div className="form-group form-group--full">
              <label className="ui-label">State Code *</label>
              <input
                className="ui-input"
                placeholder="e.g., GJ, MH"
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                required
              />
            </div>
          </>
        );
      
      case 'City':
        return (
          <>
            <div className="form-group form-group--full">
              <label className="ui-label">Country *</label>
              <DropdownSelector
                options={countryOptions}
                value={formData.country_id}
                onChange={(value) => handleInputChange('country_id', value)}
                placeholder="Select country"
              />
            </div>
            <div className="form-group form-group--full">
              <label className="ui-label">State *</label>
              <DropdownSelector
                options={stateOptions}
                value={formData.state_id}
                onChange={(value) => handleInputChange('state_id', value)}
                placeholder="Select state"
                disabled={!formData.country_id}
              />
            </div>
            <div className="form-group form-group--full">
              <label className="ui-label">City Name *</label>
              <input
                className="ui-input"
                placeholder="Enter city name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>
          </>
        );
      
      case 'Zone':
        return (
          <>
            <div className="form-group form-group--full">
              <label className="ui-label">Country *</label>
              <DropdownSelector
                options={countryOptions}
                value={formData.country_id}
                onChange={(value) => handleInputChange('country_id', value)}
                placeholder="Select country"
              />
            </div>
            <div className="form-group form-group--full">
              <label className="ui-label">State *</label>
              <DropdownSelector
                options={stateOptions}
                value={formData.state_id}
                onChange={(value) => handleInputChange('state_id', value)}
                placeholder="Select state"
                disabled={!formData.country_id}
              />
            </div>
            <div className="form-group form-group--full">
              <label className="ui-label">City *</label>
              <DropdownSelector
                options={cityOptions}
                value={formData.city_id}
                onChange={(value) => handleInputChange('city_id', value)}
                placeholder="Select city"
                disabled={!formData.state_id}
              />
            </div>
            <div className="form-group form-group--full">
              <label className="ui-label">Zone Name *</label>
              <input
                className="ui-input"
                placeholder="Enter zone name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>
            <div className="form-group form-group--full">
              <label className="ui-label">Zone Code</label>
              <input
                className="ui-input"
                placeholder="Enter zone code"
                value={formData.zone_code}
                onChange={(e) => handleInputChange('zone_code', e.target.value)}
              />
            </div>
            <div className="form-group form-group--full">
              <label className="ui-label">Description</label>
              <input
                className="ui-input"
                placeholder="Enter description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="dash-page">
      <div className="dash-container">
        <div className="dash-row">
          <div className="order-tabs-container col-span-full flex w-full gap-2 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 shadow-sm [scrollbar-color:var(--color-grey-300)_transparent] [scrollbar-width:thin]">
            {tabs.map(tab => (
              <button
                key={tab}
                className={`order-tab inline-flex min-h-10 flex-shrink-0 cursor-pointer items-center whitespace-nowrap rounded-md px-4 py-2 text-[length:var(--text-base)] font-semibold leading-[var(--leading-snug)] transition-[background,color,box-shadow] duration-[var(--transition-fast)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.98] ${
                  activeTab === tab
                    ? 'active bg-primary text-text-on-primary hover:bg-primary'
                    : 'text-text-muted hover:bg-primary-soft hover:text-primary'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        {error ? (
          <div className="dash-row">
            <div className="dash-card full">
              <div className="ui-state ui-state--error">
                <div className="ui-state__icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <line x1="12" y1="8" x2="12" y2="13" />
                    <line x1="12" y1="16.5" x2="12" y2="16.5" />
                  </svg>
                </div>
                <p className="ui-state__title">Couldn't load {activeTab}</p>
                <p className="ui-state__desc">{error}</p>
                <button
                  className="ui-btn ui-btn--secondary"
                  onClick={() => {
                    setError(null);
                    fetchDataForTab(activeTab);
                  }}
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        ) : !loading && filteredRowsByTab.length === 0 && !['State', 'City', 'Zone'].includes(activeTab) ? (
          <div className="dash-row">
            <div className="dash-card full">
              <div className="ui-state ui-state--empty">
                <div className="ui-state__icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="20" x2="9" y2="9" />
                  </svg>
                </div>
                <p className="ui-state__title">No {activeTab} yet</p>
                <p className="ui-state__desc">
                  You haven't added any {activeTab.toLowerCase()} entries yet. Create one to get started.
                </p>
                <button className="ui-btn ui-btn--primary" onClick={handleAdd}>
                  Add {activeTab}
                </button>
              </div>
            </div>
          </div>
        ) : (
        <div className="dash-row">
          <div className="dash-card full">
            <TableWithControls
              title="Manage"
              columns={columns}
              rows={filteredRowsByTab}
              onAddNew={handleAdd}
              addNewText="Add Item"
              onImport={() => {
                setError(null);
                fetchDataForTab(activeTab);
              }}
              importText="Refresh Data"
              showFilter={['State', 'City', 'Zone'].includes(activeTab)}
              filterContent={
                activeTab === 'State' ? (
                  <div className="flex flex-col gap-3">
                    <label className="font-medium text-[14px] mb-1">
                      Filter by Country:
                    </label>
                    <DropdownSelector
                      options={countryOptions}
                      value={stateCountryFilter}
                      onChange={(value) => setStateCountryFilter(value)}
                      placeholder="Select country"
                    />
                    {stateCountryFilter && (
                      <button
                        onClick={() => setStateCountryFilter('')}
                        className="px-4 py-2 bg-[#f5f5f5] border border-[#E0E0E0] rounded-lg cursor-pointer text-[14px] font-medium mt-2"
                      >
                        Clear Filter
                      </button>
                    )}
                  </div>
                ) : activeTab === 'City' ? (
                  <div className="flex flex-col gap-3">
                    <label className="font-medium text-[14px] mb-1">
                      Filter by State:
                    </label>
                    <DropdownSelector
                      options={stateOptions}
                      value={cityStateFilter}
                      onChange={(value) => setCityStateFilter(value)}
                      placeholder="Select state"
                    />
                    {cityStateFilter && (
                      <button
                        onClick={() => setCityStateFilter('')}
                        className="px-4 py-2 bg-[#f5f5f5] border border-[#E0E0E0] rounded-lg cursor-pointer text-[14px] font-medium mt-2"
                      >
                        Clear Filter
                      </button>
                    )}
                  </div>
                ) : activeTab === 'Zone' ? (
                  <div className="flex flex-col gap-3">
                    <label className="font-medium text-[14px] mb-1">
                      Filter by City:
                    </label>
                    {zoneCitiesLoading ? (
                      <div className="p-[10px] text-center text-[#666] text-[14px]">
                        Loading cities...
                      </div>
                    ) : (
                      <DropdownSelector
                        options={cityOptions}
                        value={zoneCityFilter}
                        onChange={(value) => setZoneCityFilter(value)}
                        placeholder="Select city"
                        disabled={zoneCitiesLoading || cityOptions.length === 0}
                      />
                    )}
                    {zoneCityFilter && (
                      <button
                        onClick={() => setZoneCityFilter('')}
                        className="px-4 py-2 bg-[#f5f5f5] border border-[#E0E0E0] rounded-lg cursor-pointer text-[14px] font-medium mt-2"
                      >
                        Clear Filter
                      </button>
                    )}
                  </div>
                ) : null
              }
              loading={loading}
            />
          </div>
        </div>
        )}
      </div>
      <AsidePanel
        open={openAdd}
        onClose={() => {
          setOpenAdd(false);
          resetForm();
        }}
        title={`Add ${activeTab}`}
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
          {renderFormFields()}
        </form>
      </AsidePanel>
      <AsidePanel
        open={!!editRow}
        onClose={() => {
          setEditRow(null);
          resetForm();
        }}
        title={`Edit ${editRow?.type || ''}`}
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
          {renderFormFields()}
        </form>
      </AsidePanel>
    </div>
  );
};

export default DashboardManage;
