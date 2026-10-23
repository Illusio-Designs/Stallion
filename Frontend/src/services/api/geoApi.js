import { apiRequest, fetchAllPages, TTL_LOOKUP } from './client';
import { getCached, invalidateCache } from '../cacheService';

// ==================== COUNTRY ENDPOINTS ====================

/**
 * Get all countries
 * @returns {Promise<Array>} Array of country objects
 */
export const getCountries = async ({ includeInactive = false } = {}) => {
  // include_inactive is honoured by the backend for admin/office roles only.
  const suffix = includeInactive ? '?include_inactive=true' : '';
  return getCached(includeInactive ? 'countries:inactive' : 'countries', () => apiRequest(`/countries${suffix}`, {
    method: 'GET',
    includeAuth: true,
  }), TTL_LOOKUP);
};

/**
 * Countries for forms and filters: India only (the business operates in India).
 * The Manage page keeps using getCountries so admins can still see every country.
 */
export const getIndianCountries = async (opts = {}) => {
  const res = await getCountries(opts);
  const list = Array.isArray(res) ? res : (res?.data || []);
  const india = list.filter((c) => {
    const name = String(c?.name || '').trim().toLowerCase();
    const code = String(c?.code || '').trim().toUpperCase();
    return name === 'india' || code === 'IN';
  });
  return Array.isArray(res) ? india : { ...res, data: india };
};

/**
 * Create country
 * @param {Object} countryData - Country data
 * @param {string} countryData.name - Country name
 * @param {string} countryData.code - Country code (e.g., "IN", "US")
 * @param {string} countryData.phone_code - Phone code (e.g., "+91", "+1")
 * @param {string} countryData.currency - Currency code (e.g., "INR", "USD")
 * @returns {Promise<Object>} Created country object
 */
export const createCountry = async (countryData) => {
  const { name, code, phone_code, currency } = countryData;
  const result = await apiRequest('/countries', {
    method: 'POST',
    body: { name, code, phone_code, currency },
    includeAuth: true,
  });
  invalidateCache('countries');
  return result;
};

/**
 * Update country
 * @param {string} countryId - Country ID (UUID)
 * @param {Object} countryData - Country data to update
 * @param {string} countryData.name - Country name
 * @param {string} countryData.code - Country code
 * @param {string} countryData.phone_code - Phone code
 * @param {string} countryData.currency - Currency code
 * @returns {Promise<Object>} Response with message
 */
export const updateCountry = async (countryId, countryData) => {
  const { name, code, phone_code, currency, is_active } = countryData;
  const result = await apiRequest(`/countries/${countryId}`, {
    method: 'PUT',
    body: { name, code, phone_code, currency, ...(is_active === undefined ? {} : { is_active }) },
    includeAuth: true,
  });
  invalidateCache('countries');
  return result;
};

/**
 * Delete country
 * @param {string} countryId - Country ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteCountry = async (countryId) => {
  const result = await apiRequest(`/countries/${countryId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
  invalidateCache('countries');
  return result;
};

// ==================== STATE ENDPOINTS ====================

/**
 * Get states by country
 * @param {string} countryId - Country ID (UUID)
 * @returns {Promise<Array>} Array of state objects
 */
export const getStates = async (countryId, { includeInactive = false } = {}) => {
  try {
    // Use POST to /states/get with country_id in body
    const response = await apiRequest(`/states/get${includeInactive ? '?include_inactive=true' : ''}`, {
      method: 'POST',
      body: { country_id: countryId },
      includeAuth: true,
    });
    
    // Ensure we always return an array
    if (Array.isArray(response)) {
      return response;
    }
    // Handle case where response might be wrapped in data property
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    // Return empty array if response is unexpected
    return [];
  } catch (error) {
    // Handle "States not found" as a valid case (empty states)
    if (error.message?.toLowerCase().includes('states not found') ||
        error.message?.toLowerCase().includes('no states found')) {
      return [];
    }
    // Re-throw other errors
    throw error;
  }
};

/**
 * Create state
 * @param {Object} stateData - State data
 * @param {string} stateData.name - State name
 * @param {string} stateData.code - State code (e.g., "GJ", "MH")
 * @param {string} stateData.country_id - Country ID (UUID)
 * @returns {Promise<Object>} Created state object
 */
export const createState = async (stateData) => {
  const { name, code, country_id } = stateData;
  return apiRequest('/states', {
    method: 'POST',
    body: { name, code, country_id },
    includeAuth: true,
  });
};

/**
 * Update state
 * @param {string} stateId - State ID (UUID)
 * @param {Object} stateData - State data to update
 * @param {string} stateData.name - State name
 * @param {string} stateData.code - State code
 * @param {string} stateData.country_id - Country ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const updateState = async (stateId, stateData) => {
  const { name, code, country_id, is_active } = stateData;
  return apiRequest(`/states/${stateId}`, {
    method: 'PUT',
    body: { name, code, country_id, ...(is_active === undefined ? {} : { is_active }) },
    includeAuth: true,
  });
};

/**
 * Delete state
 * @param {string} stateId - State ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteState = async (stateId) => {
  return apiRequest(`/states/${stateId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== CITY ENDPOINTS ====================

/**
 * Get cities by state
 * @param {string} stateId - State ID (UUID)
 * @returns {Promise<Array>} Array of city objects
 */
export const getCities = async (stateId, { includeInactive = false } = {}) => {
  try {
    const response = await fetchAllPages(`/cities/get${includeInactive ? '?include_inactive=true' : ''}`, {
      method: 'POST',
      body: { state_id: stateId },
      includeAuth: true,
      silent: true, // "Cities not found" is a valid empty case — don't log it
    });
    
    // Ensure we always return an array
    if (Array.isArray(response)) {
      return response;
    }
    // Handle case where response might be wrapped in data property
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    // Return empty array if response is unexpected
    return [];
  } catch (error) {
    // Handle "Cities not found" as a valid case (empty cities)
    if (error.message?.toLowerCase().includes('cities not found') ||
        error.message?.toLowerCase().includes('no cities found')) {
      return [];
    }
    // Re-throw other errors
    throw error;
  }
};

/**
 * Create city
 * @param {Object} cityData - City data
 * @param {string} cityData.name - City name
 * @param {string} cityData.state_id - State ID (UUID)
 * @returns {Promise<Object>} Created city object
 */
export const createCity = async (cityData) => {
  const { name, state_id } = cityData;
  return apiRequest('/cities', {
    method: 'POST',
    body: { name, state_id },
    includeAuth: true,
  });
};

/**
 * Update city
 * @param {string} cityId - City ID (UUID)
 * @param {Object} cityData - City data to update
 * @param {string} cityData.name - City name
 * @param {string} cityData.state_id - State ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const updateCity = async (cityId, cityData) => {
  const { name, state_id, is_active } = cityData;
  return apiRequest(`/cities/${cityId}`, {
    method: 'PUT',
    body: { name, state_id, ...(is_active === undefined ? {} : { is_active }) },
    includeAuth: true,
  });
};

/**
 * Delete city
 * @param {string} cityId - City ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteCity = async (cityId) => {
  return apiRequest(`/cities/${cityId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== ZONE ENDPOINTS ====================

/**
 * Get zones by city
 * @param {string} cityId - City ID (UUID)
 * @returns {Promise<Array>} Array of zone objects
 */
export const getZones = async (cityId, { includeInactive = false } = {}) => {
  try {
    const response = await apiRequest(`/zones/get${includeInactive ? '?include_inactive=true' : ''}`, {
      method: 'POST',
      body: { city_id: cityId },
      includeAuth: true,
    });
    
    if (Array.isArray(response)) return response;
    if (response && Array.isArray(response.data)) return response.data;
    return [];
  } catch (error) {
    if (error.message?.toLowerCase().includes('zones not found') ||
        error.message?.toLowerCase().includes('no zones found')) {
      return [];
    }
    throw error;
  }
};

/**
 * Get all zones by fetching across all cities for a given country
 * Since there's no "get all zones" endpoint, we fetch zones for each city
 * @param {string} countryId - Country ID (optional, defaults to India)
 * @returns {Promise<Array>} Array of all zone objects (deduplicated)
 */
const fetchAllZonesUncached = async (includeInactive = false) => {
  try {
    // POST /zones/get with no city_id returns ALL active zones in a SINGLE call
    // (the backend filters only by is_active when city_id is omitted). This
    // replaces the old states -> cities -> zones walk, which fired 100+ requests
    // (one /cities/get per state + one /zones/get per city) on every form open.
    const resp = await apiRequest(`/zones/get${includeInactive ? '?include_inactive=true' : ''}`, {
      method: 'POST',
      body: {},
      includeAuth: true,
      silent: true,
    });
    const zonesArr = Array.isArray(resp) ? resp : (resp?.data || []);

    // Deduplicate by zone id (defensive).
    const seen = new Set();
    return zonesArr.filter(z => {
      const id = z.zone_id || z.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  } catch (error) {
    console.warn('[getAllZones] Failed to fetch zones:', error.message);
    return [];
  }
};

/**
 * Get all zones (cached). One call to POST /zones/get — the backend returns all
 * active zones. The countryId arg is accepted for backward compatibility but no
 * longer scopes the request (the backend has no country filter on zones).
 *
 * @param {string} [countryId] - ignored; kept for call-site compatibility
 * @returns {Promise<Array>}
 */
export const getAllZones = async (countryId, { includeInactive = false } = {}) => {
  return getCached(includeInactive ? 'allZones:inactive' : 'allZones:all', () => fetchAllZonesUncached(includeInactive), TTL_LOOKUP);
};

/**
 * Create zone
 * @param {Object} zoneData - Zone data
 * @param {string} zoneData.name - Zone name
 * @param {string} zoneData.description - Zone description
 * @param {string} zoneData.city_id - City ID (UUID)
 * @param {string} zoneData.state_id - State ID (UUID)
 * @param {string} zoneData.country_id - Country ID (UUID)
 * @param {string} zoneData.zone_code - Zone code
 * @returns {Promise<Object>} Created zone object
 */
export const createZone = async (zoneData) => {
  const { name, description, city_id, state_id, country_id, zone_code } = zoneData;
  const result = await apiRequest('/zones', {
    method: 'POST',
    body: { name, description, city_id, state_id, country_id, zone_code },
    includeAuth: true,
  });
  invalidateCache('allZones:');
  return result;
};

/**
 * Update zone
 * @param {string} zoneId - Zone ID (UUID)
 * @param {Object} zoneData - Zone data to update
 * @param {string} zoneData.name - Zone name
 * @param {string} zoneData.description - Zone description
 * @param {string} zoneData.city_id - City ID (UUID)
 * @param {string} zoneData.state_id - State ID (UUID)
 * @param {string} zoneData.country_id - Country ID (UUID)
 * @param {string} zoneData.zone_code - Zone code
 * @returns {Promise<Object>} Response with message
 */
export const updateZone = async (zoneId, zoneData) => {
  const { name, description, city_id, state_id, country_id, zone_code, is_active } = zoneData;
  const result = await apiRequest(`/zones/${zoneId}`, {
    method: 'PUT',
    body: { name, description, city_id, state_id, country_id, zone_code, ...(is_active === undefined ? {} : { is_active }) },
    includeAuth: true,
  });
  invalidateCache('allZones:');
  return result;
};

/**
 * Delete zone
 * @param {string} zoneId - Zone ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteZone = async (zoneId) => {
  const result = await apiRequest(`/zones/${zoneId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
  invalidateCache('allZones:');
  return result;
};

