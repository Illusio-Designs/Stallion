import { apiRequest, TTL_LOOKUP } from './client';
import { getCached, invalidateCache } from '../cacheService';

// ==================== COUNTRY ENDPOINTS ====================

/**
 * Get all countries
 * @returns {Promise<Array>} Array of country objects
 */
export const getCountries = async () => {
  return getCached('countries', () => apiRequest('/countries', {
    method: 'GET',
    includeAuth: true,
  }), TTL_LOOKUP);
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
  const { name, code, phone_code, currency } = countryData;
  const result = await apiRequest(`/countries/${countryId}`, {
    method: 'PUT',
    body: { name, code, phone_code, currency },
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
export const getStates = async (countryId) => {
  try {
    // Use POST to /states/get with country_id in body
    const response = await apiRequest('/states/get', {
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
  const { name, code, country_id } = stateData;
  return apiRequest(`/states/${stateId}`, {
    method: 'PUT',
    body: { name, code, country_id },
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
export const getCities = async (stateId) => {
  try {
    const response = await apiRequest('/cities/get', {
      method: 'POST',
      body: { state_id: stateId },
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
  const { name, state_id } = cityData;
  return apiRequest(`/cities/${cityId}`, {
    method: 'PUT',
    body: { name, state_id },
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
export const getZones = async (cityId) => {
  try {
    const response = await apiRequest('/zones/get', {
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
const fetchAllZonesUncached = async (countryId) => {
  try {
    let targetCountryId = countryId;

    // If no countryId provided, find India
    if (!targetCountryId) {
      const countries = await apiRequest('/countries', { method: 'GET', includeAuth: true });
      const countriesArr = Array.isArray(countries) ? countries : (countries?.data || []);
      const india = countriesArr.find(c =>
        c.name?.toLowerCase() === 'india' || c.code?.toLowerCase() === 'in'
      );
      if (!india) return [];
      targetCountryId = india.id;
    }

    // Step 1: get all states for the country
    const statesResp = await apiRequest('/states/get', {
      method: 'POST',
      body: { country_id: targetCountryId },
      includeAuth: true,
      silent: true,
    });
    const statesArr = Array.isArray(statesResp) ? statesResp : (statesResp?.data || []);
    if (statesArr.length === 0) return [];

    // Step 2: get all cities for each state (parallel)
    const cityResults = await Promise.all(
      statesArr.map(state =>
        apiRequest('/cities/get', {
          method: 'POST',
          body: { state_id: state.id },
          includeAuth: true,
          silent: true,
        }).catch(() => [])
      )
    );
    const allCities = cityResults.flatMap(r => Array.isArray(r) ? r : (r?.data || []));
    if (allCities.length === 0) return [];

    // Step 3: get zones for each city (parallel, in batches)
    const batchSize = 10;
    let allZones = [];
    for (let i = 0; i < allCities.length; i += batchSize) {
      const batch = allCities.slice(i, i + batchSize);
      const zoneResults = await Promise.all(
        batch.map(city =>
          apiRequest('/zones/get', {
            method: 'POST',
            body: { city_id: city.id },
            includeAuth: true,
            silent: true,
          }).catch(() => [])
        )
      );
      const batchZones = zoneResults.flatMap(r => Array.isArray(r) ? r : (r?.data || []));
      allZones = [...allZones, ...batchZones];
    }

    // Deduplicate by zone id
    const seen = new Set();
    return allZones.filter(z => {
      const id = z.zone_id || z.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  } catch (error) {
    console.warn('[getAllZones] Failed to fetch all zones:', error.message);
    return [];
  }
};

/**
 * Get all zones for a country (cached).
 *
 * There is no "get all zones" endpoint, so this walks states -> cities -> zones,
 * which is expensive. The result is cached so that cascade runs at most once per
 * session/country instead of on every page mount. Invalidated on zone mutations.
 *
 * @param {string} [countryId] - Country ID (defaults to India)
 * @returns {Promise<Array>}
 */
export const getAllZones = async (countryId) => {
  return getCached(`allZones:${countryId || 'default'}`, () => fetchAllZonesUncached(countryId), TTL_LOOKUP);
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
  const { name, description, city_id, state_id, country_id, zone_code } = zoneData;
  const result = await apiRequest(`/zones/${zoneId}`, {
    method: 'PUT',
    body: { name, description, city_id, state_id, country_id, zone_code },
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

