import React, { useMemo, useState, useEffect, useRef } from 'react';
import TableWithControls from '../components/ui/TableWithControls';
import AsidePanel from '../components/ui/AsidePanel';
import RowActions from '../components/ui/RowActions';
import DropdownSelector from '../components/ui/DropdownSelector';
import {
  getIndianCountries,
  createCountry,
  updateCountry,
  getStates,
  createState,
  updateState,
  getCities,
  createCity,
  updateCity,
  getZones,
  getAllZones,
  createZone,
  updateZone,
  getBrands, createBrand,
  createCollection,
  createShape,
  createFrameColor,
  createFrameMaterial,
  createFrameType,
  createGender,
  createLensColor,
  createLensMaterial,
  createColorCode,
} from '../services/apiService';
import StatusBadge from '../components/ui/StatusBadge';
import { apiRequest } from '../services/api/client';
import { invalidateCache } from '../services/cacheService';
import { useConfirm } from '../components/ui/ConfirmProvider';
import '../styles/pages/dashboard-orders.css';
import '../styles/redesign-n-manage.css';
import '../styles/redesign-n-headings.css';

// Master-data attribute tabs. Lists are read with every item (active and inactive) so they can be
// switched back on; pickers and shop filters ask the API for ?active=true. Nothing is ever deleted.
const attr = (idKey, field, label, path, cache, create, extra = {}) => ({ idKey, field, label, path, cache, create, ...extra });
const ATTRIBUTE_TABS = {
  Brand: attr('brand_id', 'brand_name', 'Brand Name', '/brands', 'brands', createBrand),
  Collection: attr('collection_id', 'collection_name', 'Collection Name', '/collections', 'collections', createCollection, { hasBrand: true }),
  Shape: attr('shape_id', 'shape_name', 'Shape Name', '/shapes', 'shapes', createShape),
  'Frame Colour': attr('frame_color_id', 'frame_color', 'Frame Colour', '/frame_colors', 'frame_colors', createFrameColor),
  'Frame Material': attr('frame_material_id', 'frame_material', 'Frame Material', '/frame_materials', 'frame_materials', createFrameMaterial),
  'Frame Type': attr('frame_type_id', 'frame_type', 'Frame Type', '/frame_types', 'frame_types', createFrameType),
  Gender: attr('gender_id', 'gender_name', 'Gender Name', '/genders', 'genders', createGender),
  'Lens Colour': attr('lens_color_id', 'lens_color', 'Lens Colour', '/lens_colors', 'lens_colors', createLensColor),
  'Lens Material': attr('lens_material_id', 'lens_material', 'Lens Material', '/lens_materials', 'lens_materials', createLensMaterial),
  'Colour Code': attr('color_code_id', 'color_code', 'Colour Code', '/color_codes', 'color_codes', createColorCode),
};
const listAttr = async (cfg) => {
  try {
    const res = await apiRequest(cfg.path, { method: 'GET', includeAuth: true });
    if (Array.isArray(res)) return res;
    return Array.isArray(res?.data) ? res.data : [];
  } catch (e) {
    if (e?.statusCode === 404 || /not found/i.test(e?.message || '')) return [];
    throw e;
  }
};
const updateAttr = async (cfg, id, payload) => {
  const r = await apiRequest(`${cfg.path}/${id}`, { method: 'PUT', body: payload, includeAuth: true });
  invalidateCache(cfg.cache);
  return r;
};
// Manage lists every item (active and inactive) so inactive ones can be switched back on.
const INC = { includeInactive: true };
const GEO_TABS = ['Country', 'State', 'City', 'Zone'];
const attrRowId = (cfg, item) => item[cfg.idKey] ?? item.id;

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
  const [attrRows, setAttrRows] = useState([]);
  const [brandList, setBrandList] = useState([]);

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
    attr_value: '',
    brand_id: '',
    is_active: true,
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
      getStates(stateCountryFilter, INC)
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
        getStates(india.id, INC)
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
      getCities(cityStateFilter, INC)
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
          const countriesData = await getIndianCountries(INC).catch((error) => {
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
          const countriesForStates = await getIndianCountries(INC).catch(() => []);
          setCountries(countriesForStates || []);
          // Don't fetch states here - wait for country filter selection
          setStates([]);
          break;
        
        case 'City':
          // Only fetch countries, states will be fetched for default country (India)
          const countriesForCities = await getIndianCountries(INC).catch(() => []);
          setCountries(countriesForCities || []);
          // Don't fetch states here - wait for default country selection
          setStates([]);
          // Don't fetch cities here - wait for state filter selection
          setCities([]);
          break;
        
        case 'Zone':
          // Fetch all zones directly, and cities for the filter dropdown
          const [allZonesData, countriesForZones] = await Promise.all([
            getAllZones(undefined, INC).catch(() => []),
            getIndianCountries(INC).catch(() => []),
          ]);
          setAllZones(allZonesData || []);
          setZones(allZonesData || []);
          setCountries(countriesForZones || []);
          // Fetch cities for filter dropdown (all cities from India)
          const indiaForZone = (countriesForZones || []).find(c =>
            c.name?.toLowerCase() === 'india' || c.code?.toLowerCase() === 'in'
          );
          if (indiaForZone) {
            const statesForZone = await getStates(indiaForZone.id, INC).catch(() => []);
            const allCitiesPromises = (statesForZone || []).map(s =>
              getCities(s.id, INC).catch(() => [])
            );
            const citiesArrays = await Promise.all(allCitiesPromises);
            setCities(citiesArrays.flat());
          }
          break;

        default: {
          const cfg = ATTRIBUTE_TABS[tab];
          if (cfg) {
            const [list, brands] = await Promise.all([
              listAttr(cfg),
              cfg.hasBrand ? getBrands().catch(() => []) : Promise.resolve([]),
            ]);
            setAttrRows(list || []);
            if (cfg.hasBrand) setBrandList(brands || []);
          }
          break;
        }
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
      const statesData = await getStates(countryId, INC);
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
      const citiesData = await getCities(stateId, INC);
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
      const zonesData = await getZones(cityId, INC);
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
        isActive: country.is_active !== false,
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
        isActive: state.is_active !== false,
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
        isActive: city.is_active !== false,
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
        isActive: zone.is_active !== false,
        details: `${zone.zone_code || 'N/A'} | ${city?.name || 'N/A'}`,
        data: zone,
      });
    });

    const cfg = ATTRIBUTE_TABS[activeTab];
    if (cfg) {
      attrRows.forEach(item => {
        const brand = cfg.hasBrand ? brandList.find(b => b.brand_id === item.brand_id) : null;
        allRows.push({
          id: attrRowId(cfg, item),
          type: activeTab,
          name: item[cfg.field] ?? '',
          isActive: item.is_active !== false,
          details: cfg.hasBrand ? (item.brand?.brand_name || item.brand_name || brand?.brand_name || 'N/A') : '',
          data: item,
        });
      });
    }

    return allRows;
  }, [countries, states, cities, allZones, attrRows, brandList, activeTab]);

  const columns = useMemo(() => {
    // Different columns for different tabs
    if (activeTab === 'Country') {
      return [
        { key: 'name', label: 'NAME' },
        { key: 'code', label: 'CODE' },
        { key: 'phone_code', label: 'PHONE CODE' },
        { key: 'currency', label: 'CURRENCY' },
        { key: 'isActive', label: 'STATUS', render: (_v, row) => (
          <StatusBadge status={row.isActive ? 'completed' : 'cancelled'}>{row.isActive ? 'Active' : 'Inactive'}</StatusBadge>
        ) },
        { key: 'action', label: 'ACTION', render: (_v, row) => (
          <RowActions 
            onEdit={() => handleEdit(row)} 

          />
        ) },
      ];
    }
    if (ATTRIBUTE_TABS[activeTab]) {
      return [
        { key: 'name', label: 'NAME' },
        ...(ATTRIBUTE_TABS[activeTab].hasBrand ? [{ key: 'details', label: 'BRAND' }] : []),
        { key: 'isActive', label: 'STATUS', render: (_v, row) => (
          <StatusBadge status={row.isActive ? 'completed' : 'cancelled'}>{row.isActive ? 'Active' : 'Inactive'}</StatusBadge>
        ) },
        { key: 'action', label: 'ACTION', render: (_v, row) => (
          <RowActions onEdit={() => handleEdit(row)}/>
        ) },
      ];
    }
    // Default columns for other tabs
    return [
      { key: 'type', label: 'TYPE' },
      { key: 'name', label: 'NAME' },
      { key: 'details', label: 'DETAILS' },
      { key: 'isActive', label: 'STATUS', render: (_v, row) => (
        <StatusBadge status={row.isActive ? 'completed' : 'cancelled'}>{row.isActive ? 'Active' : 'Inactive'}</StatusBadge>
      ) },
      { key: 'action', label: 'ACTION', render: (_v, row) => (
        <RowActions 
          onEdit={() => handleEdit(row)} 

        />
      ) },
    ];
  }, [activeTab]);

  const tabs = useMemo(() => ([...GEO_TABS, ...Object.keys(ATTRIBUTE_TABS)]), []);

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
      attr_value: '',
      brand_id: '',
      is_active: true,
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
      attr_value: ATTRIBUTE_TABS[type] ? (data[ATTRIBUTE_TABS[type].field] ?? '') : '',
      brand_id: data.brand_id || '',
      is_active: data.is_active !== false,
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Switching a country, state or city off also hides everything under it.
    const UNDER = { Country: 'states, cities and zones', State: 'cities and zones', City: 'zones' };
    if (editRow && UNDER[formData.type] && formData.is_active === false && editRow.isActive !== false) {
      const ok = await confirm({
        title: `Switch off this ${formData.type.toLowerCase()}?`,
        message: `All ${UNDER[formData.type]} under it will also be hidden from forms, filters and the shop. Nothing is deleted, and switching it back on shows them again. Saved parties and orders keep their place.`,
        confirmLabel: 'Switch off',
      });
      if (!ok) return;
    }

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
            ...(editRow ? { is_active: formData.is_active !== false } : {}),
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
            ...(editRow ? { is_active: formData.is_active !== false } : {}),
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
            ...(editRow ? { is_active: formData.is_active !== false } : {}),
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
            ...(editRow ? { is_active: formData.is_active !== false } : {}),
          };
          if (editRow) {
            await updateZone(editRow.id, dataToSend);
          } else {
            await createZone(dataToSend);
          }
          break;
        default: {
          const cfg = ATTRIBUTE_TABS[type];
          if (cfg) {
            const payload = { [cfg.field]: formData.attr_value };
            if (cfg.hasBrand) payload.brand_id = formData.brand_id;
            if (editRow) {
              await updateAttr(cfg, editRow.id, { ...payload, is_active: formData.is_active !== false });
            } else {
              await cfg.create(payload);
              invalidateCache(cfg.cache);
            }
          }
        }
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

      default: {
        const cfg = ATTRIBUTE_TABS[type];
        if (!cfg) return null;
        return (
          <>
            {cfg.hasBrand && (
              <div className="form-group form-group--full">
                <label className="ui-label">Brand *</label>
                <DropdownSelector
                  options={brandList.filter(b => b.is_active !== false || b.brand_id === formData.brand_id).map(b => ({ value: b.brand_id, label: b.brand_name }))}
                  value={formData.brand_id}
                  onChange={(value) => handleInputChange('brand_id', value)}
                  placeholder="Select brand"
                />
              </div>
            )}
            <div className="form-group form-group--full">
              <label className="ui-label">{cfg.label} *</label>
              <input
                className="ui-input"
                placeholder={`Enter ${cfg.label.toLowerCase()}`}
                value={formData.attr_value}
                onChange={(e) => handleInputChange('attr_value', e.target.value)}
                required
              />
            </div>
            {editRow && (
              <div className="form-group form-group--full">
                <label className="ui-label">Status</label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.is_active !== false}
                  onClick={() => handleInputChange('is_active', formData.is_active === false)}
                  className="mng-switch"
                >
                  <span className={`mng-switch__track ${formData.is_active !== false ? 'is-on' : ''}`}>
                    <span className="mng-switch__dot" />
                  </span>
                  <span className="mng-switch__label">{formData.is_active !== false ? 'Active' : 'Inactive'}</span>
                </button>
                <p className="mng-note">Inactive items are hidden from product forms and shop filters. Nothing is ever deleted.</p>
              </div>
            )}
          </>
        );
      }
    }
  };

  return (
    <div className="dash-page">
      <div className="dash-container">
        <div className="pg-head"><div><h1>Manage</h1><p>The lists behind every dropdown: locations, brands, shapes, frames, lenses and more.</p></div></div>
        <div className="dash-row">
          <div className="order-tabs-container manage-tabs col-span-full flex w-full gap-2 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 shadow-sm [scrollbar-color:var(--color-grey-300)_transparent] [scrollbar-width:thin]">
            {tabs.map(tab => (
              <button
                key={tab}
                className={`order-tab inline-flex min-h-10 flex-shrink-0 cursor-pointer items-center whitespace-nowrap rounded-md px-4 py-2 text-[length:var(--text-base)] font-semibold leading-[var(--leading-snug)] transition-[background,color,box-shadow] duration-[var(--transition-fast)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.98] ${
                  activeTab === tab
                    ? 'active bg-primary text-text-on-primary hover:bg-primary'
                    : 'text-text-muted hover:bg-primary-soft hover:text-primary'
                }`}
                onClick={(e) => { setActiveTab(tab); e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }}
                aria-pressed={activeTab === tab}
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
              titleAs="h2"
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
          {GEO_TABS.includes(formData.type) && (
            <div className="form-group form-group--full">
              <label className="ui-label">Status</label>
              <button
                type="button"
                role="switch"
                aria-checked={formData.is_active !== false}
                onClick={() => handleInputChange('is_active', formData.is_active === false)}
                className="mng-switch"
              >
                <span className={`mng-switch__track ${formData.is_active !== false ? 'is-on' : ''}`}>
                  <span className="mng-switch__dot" />
                </span>
                <span className="mng-switch__label">{formData.is_active !== false ? 'Active' : 'Inactive'}</span>
              </button>
              <p className="mng-note">
                {{ Country: 'Switching a country off also hides its states, cities and zones. ', State: 'Switching a state off also hides its cities and zones. ', City: 'Switching a city off also hides its zones. ' }[formData.type] || ''}
                Inactive items are hidden from forms. Nothing is ever deleted.
              </p>
            </div>
          )}
        </form>
      </AsidePanel>
    </div>
  );
};

export default DashboardManage;
