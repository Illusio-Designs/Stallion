import { apiRequest, fetchAllPages, fetchPage, getBaseURL, getAuthToken, handleResponse } from './client';

// ==================== DISTRIBUTOR ENDPOINTS ====================

/**
 * Get distributors by country
 * @param {string} countryId - Country ID (UUID)
 * @returns {Promise<Array>} Array of distributor objects
 */
export const getDistributors = async (countryId) => {
  // Validate countryId
  if (!countryId) {
    console.warn('[getDistributors] No country ID provided');
    return [];
  }
  
  try {
    // Validate and clean countryId
    const cleanCountryId = String(countryId).trim();
    if (!cleanCountryId || cleanCountryId === 'undefined' || cleanCountryId === 'null') {
      console.error('[getDistributors] Invalid country ID:', countryId);
      return [];
    }
    
    console.log('[getDistributors] ====== API CALL ======');
    console.log('[getDistributors] Requested country_id:', cleanCountryId);
    console.log('[getDistributors] Request body:', JSON.stringify({ country_id: cleanCountryId }));
    
    // Use POST to /distributors/get with country_id in body (following pattern from getStates/getCities)
    const response = await fetchAllPages('/distributors/get', {
      method: 'POST',
      body: { country_id: cleanCountryId },
      includeAuth: true,
    });
    
    console.log('[getDistributors] API response received:', response?.length || 0, 'distributors');
    if (response && response.length > 0) {
      console.log('[getDistributors] Response country_ids:', response.map(d => ({
        id: d.distributor_id || d.id,
        name: d.distributor_name,
        country_id: d.country_id
      })));
    }
    
    // Ensure we always return an array
    let distributorsArray = [];
    if (Array.isArray(response)) {
      distributorsArray = response;
    } else if (response && Array.isArray(response.data)) {
      distributorsArray = response.data;
    }
    
    // CRITICAL: Backend may return wrong data, so we MUST filter strictly by country_id
    if (distributorsArray.length > 0) {
      console.log('[getDistributors] ====== FILTERING RESPONSE ======');
      console.log('[getDistributors] Requested country_id:', cleanCountryId);
      console.log('[getDistributors] Total distributors received:', distributorsArray.length);
      
      // Filter to ONLY include distributors matching the requested country
      const beforeFilter = distributorsArray.length;
      distributorsArray = distributorsArray.filter(d => {
        if (!d) return false;
        const distributorCountryId = String(d.country_id || d.countryId || '').trim();
        const matches = distributorCountryId === cleanCountryId;
        
        if (!matches) {
          console.warn('[getDistributors] ❌ REJECTING - country mismatch:', {
            distributor_id: d.distributor_id || d.id,
            distributor_name: d.distributor_name,
            distributor_country_id: distributorCountryId,
            requested_country_id: cleanCountryId
          });
        }
        return matches;
      });
      
      const filteredOut = beforeFilter - distributorsArray.length;
      if (filteredOut > 0) {
        console.warn('[getDistributors] ⚠️ FILTERED OUT', filteredOut, 'distributors with wrong country_id');
        console.warn('[getDistributors] Backend returned wrong data - this is a backend issue!');
      }
      
      console.log('[getDistributors] ✅ Final count after filtering:', distributorsArray.length, 'matching distributors');
      
      // Log sample distributor to verify
      if (distributorsArray.length > 0) {
        console.log('[getDistributors] Sample valid distributor:', {
          id: distributorsArray[0].distributor_id || distributorsArray[0].id,
          name: distributorsArray[0].distributor_name,
          country_id: distributorsArray[0].country_id,
          requested_country_id: cleanCountryId,
          matches: String(distributorsArray[0].country_id) === cleanCountryId
        });
      } else {
        console.log('[getDistributors] ℹ️ No distributors found for country:', cleanCountryId);
      }
      console.log('[getDistributors] ====== END FILTERING ======');
    }
    
    return distributorsArray;
  } catch (error) {
    // Handle "Distributors not found" as a valid case (empty distributors)
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    // Check multiple variations of "not found" messages
    if (errorMessage.includes('distributors not found') ||
        errorMessage.includes('no distributors found') ||
        errorMessage.includes('distributor not found') ||
        errorText.includes('distributors not found') ||
        errorText.includes('no distributors found') ||
        errorText.includes('distributor not found') ||
        error.statusCode === 404) {
      // Return empty array for "not found" cases - this is a valid state
      console.log('[getDistributors] No distributors found for country, returning empty array');
      return [];
    }
    // Backend DB issue - missing distributor_zones table, treat as empty result
    if (errorMessage.includes('distributor_zones') || errorMessage.includes("doesn't exist") ||
        errorText.includes('distributor_zones') || errorText.includes("doesn't exist")) {
      console.warn('[getDistributors] Backend DB error (missing table), returning empty array:', error.message);
      return [];
    }
    // Re-throw other errors
    throw error;
  }
};

/**
 * Create distributor
 * @param {Object} distributorData - Distributor data
 * @param {string} distributorData.distributor_name - Distributor name
 * @param {string} distributorData.trade_name - Trade name
 * @param {string} distributorData.contact_person - Contact person name
 * @param {string} distributorData.email - Email address
 * @param {string} distributorData.phone - Phone number
 * @param {string} distributorData.address - Address
 * @param {string} distributorData.country_id - Country ID (UUID)
 * @param {string} distributorData.state_id - State ID (UUID)
 * @param {string} distributorData.city_id - City ID (UUID)
 * @param {string} distributorData.zone_id - Zone ID (UUID)
 * @param {string} distributorData.pincode - Pincode
 * @param {string} distributorData.gstin - GSTIN (optional)
 * @param {string} distributorData.pan - PAN (optional)
 * @param {string} distributorData.territory - Territory
 * @param {number} distributorData.commission_rate - Commission rate
 * @returns {Promise<Object>} Created distributor object
 */
export const createDistributor = async (distributorData) => {
  const {
    distributor_name,
    trade_name,
    contact_person,
    email,
    phone,
    address,
    country_id,
    state_id,
    city_id,
    zones,
    state_ids,
    pincode,
    gstin,
    pan,
    territory,
    commission_rate,
  } = distributorData;
  
  // Validate required fields - ensure they exist and are not empty
  const trimmedDistributorName = distributor_name ? String(distributor_name).trim() : '';
  const trimmedTradeName = trade_name ? String(trade_name).trim() : '';
  const trimmedContactPerson = contact_person ? String(contact_person).trim() : '';
  const trimmedEmail = email ? String(email).trim() : '';
  const trimmedPhone = phone ? String(phone).trim() : '';
  const trimmedCountryId = country_id ? String(country_id).trim() : '';
  
  if (!trimmedDistributorName) {
    throw new Error('Distributor name is required');
  }
  if (!trimmedTradeName) {
    throw new Error('Trade name is required');
  }
  if (!trimmedContactPerson) {
    throw new Error('Contact person is required');
  }
  if (!trimmedEmail) {
    throw new Error('Email is required');
  }
  if (!trimmedPhone) {
    throw new Error('Phone is required');
  }
  if (!trimmedCountryId) {
    throw new Error('Country is required');
  }
  
  // Final safety check - ensure distributor_name is never null or undefined
  if (!trimmedDistributorName || trimmedDistributorName === '') {
    console.error('[Create Distributor] Validation failed: distributor_name is empty', {
      distributor_name,
      trimmedDistributorName,
      distributorData
    });
    throw new Error('Distributor name is required and cannot be empty');
  }
  
  // Build request body with explicit checks
  const requestBody = {
    distributor_name: trimmedDistributorName,
    trade_name: trimmedTradeName,
    contact_person: trimmedContactPerson,
    email: trimmedEmail,
    phone: trimmedPhone,
    address: address ? String(address).trim() : '',
    country_id: trimmedCountryId,
    state_id: state_id && String(state_id).trim() !== '' ? String(state_id).trim() : null,
    city_id: city_id && String(city_id).trim() !== '' ? String(city_id).trim() : null,
    zones: Array.isArray(zones) ? zones : [],
    state_ids: Array.isArray(state_ids) ? state_ids : [],
    pincode: pincode ? String(pincode).trim() : '',
    gstin: gstin ? String(gstin) : '',
    pan: pan ? String(pan) : '',
    territory: territory ? String(territory).trim() : '',
    commission_rate: commission_rate || 0,
  };
  
  // Final validation of request body
  if (!requestBody.distributor_name || requestBody.distributor_name === '') {
    console.error('[Create Distributor] Request body validation failed:', requestBody);
    throw new Error('Distributor name is required in request body');
  }
  
  console.log('[Create Distributor] Sending request with distributor_name:', requestBody.distributor_name);
  
  return apiRequest('/distributors', {
    method: 'POST',
    body: requestBody,
    includeAuth: true,
  });
};

/**
 * Update distributor
 * @param {string} distributorId - Distributor ID (UUID)
 * @param {Object} distributorData - Distributor data to update
 * @param {string} distributorData.distributor_name - Distributor name
 * @param {string} distributorData.trade_name - Trade name
 * @param {string} distributorData.contact_person - Contact person name
 * @param {string} distributorData.email - Email address
 * @param {string} distributorData.phone - Phone number
 * @param {string} distributorData.address - Address
 * @param {string} distributorData.country_id - Country ID (UUID)
 * @param {string} distributorData.state_id - State ID (UUID)
 * @param {string} distributorData.city_id - City ID (UUID)
 * @param {string} distributorData.zone_id - Zone ID (UUID)
 * @param {string} distributorData.pincode - Pincode
 * @param {string} distributorData.gstin - GSTIN (optional)
 * @param {string} distributorData.pan - PAN (optional)
 * @param {string} distributorData.territory - Territory
 * @param {number} distributorData.commission_rate - Commission rate
 * @param {boolean} distributorData.is_active - Whether distributor is active
 * @returns {Promise<Object>} Response with message
 */
export const updateDistributor = async (distributorId, distributorData) => {
  // Validate distributorId
  if (!distributorId) {
    throw new Error('Distributor ID is required');
  }
  
  // Trim and validate the ID
  const trimmedId = String(distributorId).trim();
  if (trimmedId === '' || trimmedId === 'undefined' || trimmedId === 'null') {
    console.error('[Update Distributor] Invalid distributor ID:', distributorId);
    throw new Error('Invalid distributor ID');
  }
  
  const {
    distributor_name,
    trade_name,
    contact_person,
    email,
    phone,
    address,
    country_id,
    state_id,
    city_id,
    zones,
    state_ids,
    pincode,
    gstin,
    pan,
    territory,
    commission_rate,
    is_active,
  } = distributorData;
  
  // Validate required fields - ensure they exist and are not empty
  const trimmedDistributorName = distributor_name ? String(distributor_name).trim() : '';
  const trimmedTradeName = trade_name ? String(trade_name).trim() : '';
  const trimmedContactPerson = contact_person ? String(contact_person).trim() : '';
  const trimmedEmail = email ? String(email).trim() : '';
  const trimmedPhone = phone ? String(phone).trim() : '';
  const trimmedCountryId = country_id ? String(country_id).trim() : '';
  
  if (!trimmedDistributorName) {
    throw new Error('Distributor name is required');
  }
  if (!trimmedTradeName) {
    throw new Error('Trade name is required');
  }
  if (!trimmedContactPerson) {
    throw new Error('Contact person is required');
  }
  if (!trimmedEmail) {
    throw new Error('Email is required');
  }
  if (!trimmedPhone) {
    throw new Error('Phone is required');
  }
  if (!trimmedCountryId) {
    throw new Error('Country is required');
  }
  
  // Final safety check - ensure distributor_name is never null or undefined
  if (!trimmedDistributorName || trimmedDistributorName === '') {
    console.error('[Update Distributor] Validation failed: distributor_name is empty', {
      distributor_name,
      trimmedDistributorName,
      distributorData
    });
    throw new Error('Distributor name is required and cannot be empty');
  }
  
  // Build request body with explicit checks
  // Ensure empty strings are converted to empty strings (not null) for required string fields
  // and null for optional UUID fields
  const requestBody = {
    distributor_name: trimmedDistributorName,
    trade_name: trimmedTradeName,
    contact_person: trimmedContactPerson,
    email: trimmedEmail,
    phone: trimmedPhone,
    address: address ? String(address).trim() : '',
    country_id: trimmedCountryId,
    // Optional FK columns — null (not '') when empty to satisfy the FK constraint.
    state_id: (state_id && String(state_id).trim() !== '') ? String(state_id).trim() : null,
    city_id: (city_id && String(city_id).trim() !== '') ? String(city_id).trim() : null,
    zones: Array.isArray(zones) ? zones : [],
    state_ids: Array.isArray(state_ids) ? state_ids : [],
    pincode: pincode ? String(pincode).trim() : '',
    gstin: gstin ? String(gstin).trim() : '',
    pan: pan ? String(pan).trim() : '',
    territory: territory ? String(territory).trim() : '',
    commission_rate: commission_rate || 0,
    is_active: is_active !== undefined ? is_active : true,
  };
  
  // Remove empty string UUID fields (convert to empty string as per payload requirement)
  // The backend expects empty strings, not null for these fields
  
  // Final validation of request body
  if (!requestBody.distributor_name || requestBody.distributor_name === '') {
    console.error('[Update Distributor] Request body validation failed:', requestBody);
    throw new Error('Distributor name is required in request body');
  }
  
  console.log('[Update Distributor] Sending request with distributor_name:', requestBody.distributor_name);
  console.log('[Update Distributor] Distributor ID:', trimmedId);
  
  return apiRequest(`/distributors/${trimmedId}`, {
    method: 'PUT',
    body: requestBody,
    includeAuth: true,
  });
};

/**
 * Delete distributor
 * @param {string} distributorId - Distributor ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteDistributor = async (distributorId) => {
  // Validate distributorId
  if (!distributorId) {
    throw new Error('Distributor ID is required');
  }
  
  // Trim and validate the ID
  const trimmedId = String(distributorId).trim();
  if (trimmedId === '' || trimmedId === 'undefined' || trimmedId === 'null') {
    console.error('[Delete Distributor] Invalid distributor ID:', distributorId);
    throw new Error('Invalid distributor ID');
  }
  
  console.log('[Delete Distributor] Deleting distributor with ID:', trimmedId);
  
  return apiRequest(`/distributors/${trimmedId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== PARTY ENDPOINTS ====================

/**
 * Get all parties (optionally filtered by country)
 * @param {string} [countryId] - Optional country ID (UUID) to filter parties by country
 * @returns {Promise<Array>} Array of party objects
 */
// ==================== ROLE-SCOPED PARTY ENDPOINTS ====================
// These derive everything from the JWT (no body needed), so they're callable
// from the browser. Used to show end-user roles only their own parties.

const scopedList = async (endpoint) => {
  try {
    const response = await fetchAllPages(endpoint, { method: 'GET', includeAuth: true });
    return Array.isArray(response) ? response : (response?.data || []);
  } catch (error) {
    const msg = `${error.message || ''} ${error.errorData?.error || error.errorData?.message || ''}`.toLowerCase();
    if (error.statusCode === 404 || msg.includes('not found')) return [];
    throw error;
  }
};

// GET /parties/my — parties assigned to the authenticated salesman. (There is no
// /salesmen/parties route; the backend scopes /parties/my by role from the JWT,
// returning the salesman's assigned-state parties.)
export const getSalesmanParties = async () => scopedList('/parties/my');
// GET /distributors/parties — parties under the authenticated distributor.
export const getDistributorParties = async () => scopedList('/distributors/parties');
// GET /parties/my — parties for the current user's role.
export const getMyParties = async () => scopedList('/parties/my');

/**
 * Role-aware party fetch. End-user roles get their own token-scoped parties;
 * admin / *_manager roles get the full list (POST /parties/get).
 * @param {string} role - current user role (getUserRole())
 * @param {string} [countryId] - only used for the admin list
 */
export const getPartiesForRole = async (role, countryId) => {
  switch ((role || '').toLowerCase()) {
    case 'salesman': return getSalesmanParties();
    case 'distributor': return getDistributorParties();
    case 'party': return getMyParties();
    default: return getParties(countryId);
  }
};

// ---- Server-paginated (20/page) variants for list TABLES (Products-style) ----
/** One page of parties (admin list) -> { data, pagination }. */
export const getPartiesPage = (countryId, page = 1, limit = 20, search = '') =>
  fetchPage('/parties/get', { page, limit, search }, {
    method: 'POST',
    body: countryId ? { country_id: String(countryId).trim() } : {},
    includeAuth: true,
  });
/** One page of distributors -> { data, pagination }. */
export const getDistributorsPage = (countryId, page = 1, limit = 20, search = '') =>
  fetchPage('/distributors/get', { page, limit, search }, {
    method: 'POST',
    body: countryId ? { country_id: String(countryId).trim() } : {},
    includeAuth: true,
  });

export const getParties = async (countryId) => {
  // If no countryId provided, use POST /parties/get with empty body to get all parties
  if (!countryId) {
    try {
      console.log('[getParties] Fetching all parties (no country filter)');
      const response = await fetchAllPages('/parties/get', {
        method: 'POST',
        body: {}, // Empty body to get all parties
        includeAuth: true,
      });
      
      // Ensure we always return an array
      if (Array.isArray(response)) {
        console.log('[getParties] Received', response.length, 'parties (all)');
        return response;
      } else if (response && Array.isArray(response.data)) {
        console.log('[getParties] Received', response.data.length, 'parties (all)');
        return response.data;
      }
      
      console.log('[getParties] No parties found or unexpected response format');
      return [];
    } catch (error) {
      // Handle "Parties not found" as a valid case (empty parties)
      const errorMessage = (error.message || '').toLowerCase();
      const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
      
      // Check multiple variations of "not found" messages
      if (errorMessage.includes('parties not found') ||
          errorMessage.includes('no parties found') ||
          errorMessage.includes('party not found') ||
          errorText.includes('parties not found') ||
          errorText.includes('no parties found') ||
          errorText.includes('party not found') ||
          error.statusCode === 404) {
        // Return empty array for "not found" cases - this is a valid state
        console.log('[getParties] No parties found, returning empty array');
        return [];
      }
      // Re-throw other errors
      console.error('[getParties] Error fetching all parties:', error);
      throw error;
    }
  }
  
  // Validate countryId
  try {
    // Validate and clean countryId
    const cleanCountryId = String(countryId).trim();
    if (!cleanCountryId || cleanCountryId === 'undefined' || cleanCountryId === 'null') {
      console.error('[getParties] Invalid country ID:', countryId);
      return [];
    }
    
    console.log('[getParties] ====== API CALL ======');
    console.log('[getParties] Requested country_id:', cleanCountryId);
    console.log('[getParties] Request body:', JSON.stringify({ country_id: cleanCountryId }));
    
    // Use POST to /parties/get with country_id in body (following pattern from getDistributors/getSalesmen)
    const response = await fetchAllPages('/parties/get', {
      method: 'POST',
      body: { country_id: cleanCountryId },
      includeAuth: true,
    });
    
    console.log('[getParties] API response received:', response?.length || 0, 'parties');
    if (response && response.length > 0) {
      console.log('[getParties] Response country_ids:', response.map(p => ({
        id: p.id || p.party_id,
        name: p.party_name,
        country_id: p.country_id
      })));
    }
    
    // Ensure we always return an array
    let partiesArray = [];
    if (Array.isArray(response)) {
      partiesArray = response;
    } else if (response && Array.isArray(response.data)) {
      partiesArray = response.data;
    }
    
    // CRITICAL: Backend may return wrong data, so we MUST filter strictly by country_id
    if (partiesArray.length > 0) {
      console.log('[getParties] ====== FILTERING RESPONSE ======');
      console.log('[getParties] Requested country_id:', cleanCountryId);
      console.log('[getParties] Total parties received:', partiesArray.length);
      
      // Filter to ONLY include parties matching the requested country
      const beforeFilter = partiesArray.length;
      partiesArray = partiesArray.filter(p => {
        if (!p) return false;
        const partyCountryId = String(p.country_id || p.countryId || '').trim();
        const matches = partyCountryId === cleanCountryId;
        
        if (!matches) {
          console.warn('[getParties] ❌ REJECTING - country mismatch:', {
            party_id: p.id || p.party_id,
            party_name: p.party_name,
            party_country_id: partyCountryId,
            requested_country_id: cleanCountryId
          });
        }
        return matches;
      });
      
      const filteredOut = beforeFilter - partiesArray.length;
      if (filteredOut > 0) {
        console.warn('[getParties] ⚠️ FILTERED OUT', filteredOut, 'parties with wrong country_id');
        console.warn('[getParties] Backend returned wrong data - this is a backend issue!');
      }
      
      console.log('[getParties] ✅ Final count after filtering:', partiesArray.length, 'matching parties');
      
      // Log sample party to verify
      if (partiesArray.length > 0) {
        console.log('[getParties] Sample valid party:', {
          id: partiesArray[0].id || partiesArray[0].party_id,
          name: partiesArray[0].party_name,
          country_id: partiesArray[0].country_id,
          requested_country_id: cleanCountryId,
          matches: String(partiesArray[0].country_id) === cleanCountryId
        });
      } else {
        console.log('[getParties] ℹ️ No parties found for country:', cleanCountryId);
      }
      console.log('[getParties] ====== END FILTERING ======');
    }
    
    return partiesArray;
  } catch (error) {
    // Handle "Parties not found" as a valid case (empty parties)
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    // Check multiple variations of "not found" messages
    if (errorMessage.includes('parties not found') ||
        errorMessage.includes('no parties found') ||
        errorMessage.includes('party not found') ||
        errorText.includes('parties not found') ||
        errorText.includes('no parties found') ||
        errorText.includes('party not found') ||
        error.statusCode === 404) {
      // Return empty array for "not found" cases - this is a valid state
      console.log('[getParties] No parties found for country, returning empty array');
      return [];
    }
    // Re-throw other errors
    throw error;
  }
};

/**
 * Get party by ID
 * @param {string} partyId - Party ID (UUID)
 * @returns {Promise<Object>} Party object
 */
export const getPartyById = async (partyId) => {
  if (!partyId || typeof partyId !== 'string' || partyId.trim() === '') {
    throw new Error('Invalid party ID provided');
  }
  
  const cleanPartyId = partyId.trim();
  
  try {
    // Use POST to /parties/get with party_id in body (matching pattern from getParties)
    console.log('[getPartyById] Fetching party with ID:', cleanPartyId);
    const response = await fetchAllPages('/parties/get', {
      method: 'POST',
      body: { party_id: cleanPartyId },
      includeAuth: true,
    });
    
    // Handle array response (backend might return array even for single party)
    if (Array.isArray(response)) {
      const party = response.find(p => 
        String(p.id || p.party_id) === cleanPartyId
      );
      if (party) {
        console.log('[getPartyById] Party found');
        return party;
      }
      throw new Error(`Party with ID ${cleanPartyId} not found`);
    }
    
    // Handle object response
    if (response && (String(response.id || response.party_id) === cleanPartyId)) {
      console.log('[getPartyById] Party found');
      return response;
    }
    
    throw new Error(`Party with ID ${cleanPartyId} not found`);
  } catch (error) {
    // If POST to /parties/get fails, try GET to /parties/{id} as fallback
    if (error.statusCode === 404 || error.message?.includes('404') || error.message?.includes('not found')) {
      console.log('[getPartyById] POST request failed, trying GET pattern as fallback');
      try {
        return await apiRequest(`/parties/${cleanPartyId}`, {
          method: 'GET',
          includeAuth: true,
        });
      } catch (fallbackError) {
        console.error('[getPartyById] Both POST and GET patterns failed');
        throw new Error(`Party with ID ${cleanPartyId} not found. ${fallbackError.message || ''}`);
      }
    }
    throw error;
  }
};

/**
 * Create party
 * @param {Object} partyData - Party data
 * @param {string} partyData.party_name - Party name
 * @param {string} partyData.trade_name - Trade name
 * @param {string} partyData.contact_person - Contact person name
 * @param {string} partyData.email - Email address
 * @param {string} partyData.phone - Phone number
 * @param {string} partyData.address - Address
 * @param {string} partyData.country_id - Country ID (UUID)
 * @param {string} partyData.state_id - State ID (UUID)
 * @param {string} partyData.city_id - City ID (UUID)
 * @param {string} partyData.zone_id - Zone ID (UUID)
 * @param {string} partyData.pincode - Pincode
 * @param {string} partyData.gstin - GSTIN (optional)
 * @param {string} partyData.pan - PAN (optional)
 * @returns {Promise<Object>} Created party object
 */
export const createParty = async (partyData) => {
  // Helper function to validate UUID format
  const isValidUUID = (str) => {
    if (!str || str.trim() === '') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(String(str).trim());
  };
  
  const {
    party_name,
    trade_name,
    contact_person,
    email,
    phone,
    address,
    billing_address,
    billing_same_as_shipping,
    country_id,
    state_id,
    city_id,
    zone_id,
    pincode,
    gstin,
    pan,
    credit_days,
    prefered_courier,
    user_id,
  } = partyData;
  
  // Helper functions to get validated UUIDs
  const getStateId = () => {
    const value = state_id?.trim() || '';
    if (value === '') return null;
    return isValidUUID(value) ? String(value).trim() : null;
  };

const getCityId = () => {
    const value = city_id?.trim() || '';
    if (value === '') return null;
    return isValidUUID(value) ? String(value).trim() : null;
  };

  const getZoneId = () => {
    const value = zone_id?.trim() || '';
    if (value === '') return null;
    return isValidUUID(value) ? String(value).trim() : null;
  };
  
  // Build request body matching exact payload structure
  // All string fields as strings, UUIDs as strings when provided or null when empty
  // credit_days should be a number
  const requestBody = {
    party_name: String(party_name || ''),
    trade_name: String(trade_name || ''),
    contact_person: String(contact_person || ''),
    email: String(email || ''),
    phone: String(phone || ''),
    address: String(address || ''),
    // Billing address only matters when it differs from shipping (address).
    billing_same_as_shipping: billing_same_as_shipping !== false,
    billing_address: billing_same_as_shipping === false ? String(billing_address || '') : null,
    country_id: (country_id && isValidUUID(country_id)) ? String(country_id).trim() : null,
    state_id: getStateId(),
    city_id: getCityId(),
    zone_id: getZoneId(),
    pincode: String(pincode || ''),
    gstin: String(gstin || ''),
    pan: String(pan || ''),
    credit_days: credit_days !== undefined && credit_days !== null && credit_days !== '' 
      ? Number(credit_days) 
      : undefined,
    prefered_courier: prefered_courier ? String(prefered_courier) : undefined,
    user_id: (user_id && isValidUUID(user_id)) ? String(user_id).trim() : undefined,
  };
  
  // Validate that all required fields are present (no undefined)
  const requiredFields = ['party_name', 'trade_name', 'contact_person', 'email', 'phone', 'address', 'country_id', 'pincode', 'gstin', 'pan'];
  for (const field of requiredFields) {
    if (requestBody[field] === undefined) {
      console.error(`[Create Party] Missing required field: ${field}`);
      requestBody[field] = field.includes('_id') ? null : '';
    }
  }
  
  // Ensure optional UUID fields are explicitly null if not valid
  if (requestBody.state_id === undefined) requestBody.state_id = null;
  if (requestBody.city_id === undefined) requestBody.city_id = null;
  if (requestBody.zone_id === undefined) requestBody.zone_id = null;
  
  console.log('[Create Party] Request Body:', JSON.stringify(requestBody, null, 2));
  console.log('[Create Party] Request Body Keys:', Object.keys(requestBody));
  console.log('[Create Party] Has undefined values:', Object.values(requestBody).some(v => v === undefined));
  
  return apiRequest('/parties', {
    method: 'POST',
    body: requestBody,
    includeAuth: true,
  });
};

/**
 * Update party
 * @param {string} partyId - Party ID (UUID)
 * @param {Object} partyData - Party data to update
 * @param {string} partyData.party_name - Party name
 * @param {string} partyData.trade_name - Trade name
 * @param {string} partyData.contact_person - Contact person name
 * @param {string} partyData.email - Email address
 * @param {string} partyData.phone - Phone number
 * @param {string} partyData.address - Address
 * @param {string} partyData.country_id - Country ID (UUID)
 * @param {string} partyData.state_id - State ID (UUID)
 * @param {string} partyData.city_id - City ID (UUID)
 * @param {string} partyData.zone_id - Zone ID (UUID)
 * @param {string} partyData.pincode - Pincode
 * @param {string} partyData.gstin - GSTIN (optional)
 * @param {string} partyData.pan - PAN (optional)
 * @param {number} partyData.credit_days - Credit Days (optional)
 * @param {string} partyData.prefered_courier - Preferred Courier (optional)
 * @returns {Promise<Object>} Response with message
 */
export const updateParty = async (partyId, partyData) => {
  // Validate partyId
  if (!partyId || typeof partyId !== 'string' || partyId.trim() === '') {
    throw new Error('Invalid party ID provided');
  }
  
  // Helper function to validate UUID format
  const isValidUUID = (str) => {
    if (!str || str.trim() === '') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(String(str).trim());
  };
  
  const {
    party_name,
    trade_name,
    contact_person,
    email,
    phone,
    address,
    billing_address,
    billing_same_as_shipping,
    country_id,
    state_id,
    city_id,
    zone_id,
    pincode,
    gstin,
    pan,
    credit_days,
    prefered_courier,
    is_active,
  } = partyData;
  
  // Helper functions to get validated UUIDs
  const getStateId = () => {
    const value = state_id?.trim() || '';
    if (value === '') return null;
    return isValidUUID(value) ? String(value).trim() : null;
  };

  const getCityId = () => {
    const value = city_id?.trim() || '';
    if (value === '') return null;
    return isValidUUID(value) ? String(value).trim() : null;
  };

  const getZoneId = () => {
    const value = zone_id?.trim() || '';
    if (value === '') return null;
    return isValidUUID(value) ? String(value).trim() : null;
  };
  
  // Build request body - ensure clean format matching your examples exactly
  // credit_days should be a number, prefered_courier should be a string or null
  const requestBody = {
    party_name: String(party_name || ''),
    trade_name: String(trade_name || ''),
    contact_person: String(contact_person || ''),
    email: String(email || ''),
    phone: String(phone || ''),
    address: String(address || ''),
    // Billing: only send a billing_address when it differs from shipping.
    billing_same_as_shipping: billing_same_as_shipping !== false,
    billing_address: billing_same_as_shipping === false ? String(billing_address || '') : null,
    // Active/deactivate — only when explicitly provided.
    ...(is_active !== undefined ? { is_active: !!is_active } : {}),
    country_id: (country_id && isValidUUID(country_id)) ? String(country_id).trim() : null,
    state_id: getStateId(),
    city_id: getCityId(),
    zone_id: getZoneId(),
    pincode: String(pincode || ''),
    gstin: String(gstin || ''),
    pan: String(pan || ''),
    credit_days: credit_days !== undefined && credit_days !== null && credit_days !== '' 
      ? Number(credit_days) 
      : undefined,
    prefered_courier: prefered_courier ? String(prefered_courier) : undefined,
  };
  
  // Validate that all required fields are present (no undefined)
  const requiredFields = ['party_name', 'trade_name', 'contact_person', 'email', 'phone', 'address', 'country_id', 'pincode', 'gstin', 'pan'];
  for (const field of requiredFields) {
    if (requestBody[field] === undefined) {
      console.error(`[Update Party] Missing required field: ${field}`);
      requestBody[field] = field.includes('_id') ? null : '';
    }
  }
  
  // Ensure optional UUID fields are explicitly null if not valid
  if (requestBody.state_id === undefined) requestBody.state_id = null;
  if (requestBody.city_id === undefined) requestBody.city_id = null;
  if (requestBody.zone_id === undefined) requestBody.zone_id = null;
  
  // Final validation: ensure absolutely no undefined values for required fields
  // Optional fields (credit_days, prefered_courier) can be undefined and will be omitted from JSON
  const finalRequestBody = {};
  const allFields = ['party_name', 'trade_name', 'contact_person', 'email', 'phone', 'address', 'billing_address', 'billing_same_as_shipping', 'country_id', 'state_id', 'city_id', 'zone_id', 'pincode', 'gstin', 'pan', 'credit_days', 'prefered_courier', 'is_active'];
  allFields.forEach(field => {
    const value = requestBody[field];
    // Only include the field if it has a value (undefined will be omitted during JSON.stringify)
    if (value !== undefined) {
      finalRequestBody[field] = value;
    }
  });
  
  // Log the request body for debugging
  console.log('[Update Party] Request Body:', JSON.stringify(finalRequestBody, null, 2));
  console.log('[Update Party] Party ID:', partyId);
  console.log('[Update Party] Request Body Keys:', Object.keys(finalRequestBody));
  console.log('[Update Party] Has undefined values:', Object.values(finalRequestBody).some(v => v === undefined));
  console.log('[Update Party] All fields present:', allFields.every(f => finalRequestBody.hasOwnProperty(f)));
  
  return apiRequest(`/parties/${partyId}`, {
    method: 'PUT',
    body: finalRequestBody,
    includeAuth: true,
  });
};

/**
 * Delete party
 * @param {string} partyId - Party ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteParty = async (partyId) => {
  // Validate partyId
  if (!partyId || typeof partyId !== 'string' || partyId.trim() === '') {
    throw new Error('Invalid party ID provided');
  }
  return apiRequest(`/parties/${partyId.trim()}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

/**
 * Bulk upload parties from Excel/CSV file
 * @param {File} file - Excel or CSV file
 * @returns {Promise<Object>} Response with created/updated counts
 */
export const bulkUploadParties = async (file) => {
  const baseUrl = getBaseURL();
  const fullUrl = `${baseUrl}/parties/bulk-upload`;
  const formData = new FormData();
  formData.append('file', file);
  const token = getAuthToken();
  const headers = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers,
    credentials: 'omit',
    body: formData,
  });
  return await handleResponse(response);
};

/**
 * Get parties by zone ID
 * Zone ID is extracted from authorization token (no body parameters needed)
 * @returns {Promise<Array>} Array of party objects
 */
export const getPartiesByZoneId = async () => {
  try {
    const response = await apiRequest('/parties/byZoneId', {
      method: 'POST',
      body: null, // No body needed - only authorization token in headers
      includeAuth: true,
    });
    
    // Ensure we always return an array
    if (Array.isArray(response)) {
      return response;
    } else if (response && Array.isArray(response.data)) {
      return response.data;
    }
    
    return [];
  } catch (error) {
    // Handle "Parties not found" as a valid case (empty parties)
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    // Check multiple variations of "not found" messages
    if (errorMessage.includes('parties not found') ||
        errorMessage.includes('no parties found') ||
        errorMessage.includes('party not found') ||
        errorText.includes('parties not found') ||
        errorText.includes('no parties found') ||
        errorText.includes('party not found') ||
        error.statusCode === 404) {
      // Return empty array for "not found" cases - this is a valid state
      return [];
    }
    // Re-throw other errors
    throw error;
  }
};

// ==================== SALESMEN ENDPOINTS ====================

/**
 * Get current logged-in salesman's profile (includes zones)
 * @returns {Promise<Object>} Salesman object with zones array
 */
export const getSalesmanProfile = async () => {
  // Role-based: GET /salesmen returns the salesman record for the authenticated
  // user (per the token), not a list — used by the salesman-role dashboard.
  return apiRequest('/salesmen', {
    method: 'GET',
    includeAuth: true,
  });
};

/**
 * Get salesmen by country
 * @param {string} countryId - Country ID (UUID)
 * @returns {Promise<Array>} Array of salesman objects
 */
export const getSalesmen = async (countryId) => {
  // Validate countryId
  if (!countryId) {
    console.warn('[getSalesmen] No country ID provided');
    return [];
  }
  
  try {
    // Validate and clean countryId
    const cleanCountryId = String(countryId).trim();
    if (!cleanCountryId || cleanCountryId === 'undefined' || cleanCountryId === 'null') {
      console.error('[getSalesmen] Invalid country ID:', countryId);
      return [];
    }
    
    console.log('[getSalesmen] ====== API CALL ======');
    console.log('[getSalesmen] Requested country_id:', cleanCountryId);
    console.log('[getSalesmen] Request body:', JSON.stringify({ country_id: cleanCountryId }));
    
    // Use POST to /salesmen/get with country_id in body (following pattern from getStates/getCities/getDistributors)
    const response = await apiRequest('/salesmen/get', {
      method: 'POST',
      body: { country_id: cleanCountryId },
      includeAuth: true,
    });
    
    console.log('[getSalesmen] API response received:', response?.length || 0, 'salesmen');
    if (response && response.length > 0) {
      console.log('[getSalesmen] Response country_ids:', response.map(s => ({
        id: s.id || s.salesman_id,
        name: s.full_name,
        country_id: s.country_id
      })));
    }
    
    // Ensure we always return an array
    let salesmenArray = [];
    if (Array.isArray(response)) {
      salesmenArray = response;
    } else if (response && Array.isArray(response.data)) {
      salesmenArray = response.data;
    }
    
    // CRITICAL: Backend may return wrong data, so we MUST filter strictly by country_id
    if (salesmenArray.length > 0) {
      console.log('[getSalesmen] ====== FILTERING RESPONSE ======');
      console.log('[getSalesmen] Requested country_id:', cleanCountryId);
      console.log('[getSalesmen] Total salesmen received:', salesmenArray.length);
      
      // Filter to ONLY include salesmen matching the requested country
      const beforeFilter = salesmenArray.length;
      salesmenArray = salesmenArray.filter(s => {
        if (!s) return false;
        const salesmanCountryId = String(s.country_id || s.countryId || '').trim();
        const matches = salesmanCountryId === cleanCountryId;
        
        if (!matches) {
          console.warn('[getSalesmen] ❌ REJECTING - country mismatch:', {
            salesman_id: s.id || s.salesman_id,
            salesman_name: s.full_name,
            salesman_country_id: salesmanCountryId,
            requested_country_id: cleanCountryId
          });
        }
        return matches;
      });
      
      const filteredOut = beforeFilter - salesmenArray.length;
      if (filteredOut > 0) {
        console.warn('[getSalesmen] ⚠️ FILTERED OUT', filteredOut, 'salesmen with wrong country_id');
        console.warn('[getSalesmen] Backend returned wrong data - this is a backend issue!');
      }
      
      console.log('[getSalesmen] ✅ Final count after filtering:', salesmenArray.length, 'matching salesmen');
      
      // Log sample salesman to verify
      if (salesmenArray.length > 0) {
        console.log('[getSalesmen] Sample valid salesman:', {
          id: salesmenArray[0].id || salesmenArray[0].salesman_id,
          name: salesmenArray[0].full_name,
          country_id: salesmenArray[0].country_id,
          requested_country_id: cleanCountryId,
          matches: String(salesmenArray[0].country_id) === cleanCountryId
        });
      } else {
        // Backend returned 200 with data, but after filtering by country_id, no matching salesmen found
        // This means the country has no salesmen - treat as "not found"
        console.log('[getSalesmen] ====== NO SALESMEN FOUND ======');
        console.log('[getSalesmen] ⚠️ IMPORTANT: Backend returned HTTP 200, but this country has NO salesmen');
        console.log('[getSalesmen] Requested country_id:', cleanCountryId);
        console.log('[getSalesmen] Backend returned', beforeFilter, 'salesmen, but NONE match the requested country');
        console.log('[getSalesmen] This is treated as "Salesmen not found" on the frontend');
        console.log('[getSalesmen] UI will show "404 - No salesman found" message');
        console.log('[getSalesmen] NOTE: Backend should return 404 or empty array, but returns 200 with wrong data');
      }
      console.log('[getSalesmen] ====== END FILTERING ======');
    } else {
      // Backend returned empty array - no salesmen for this country
      console.log('[getSalesmen] ℹ️ Backend returned empty array - no salesmen for country:', cleanCountryId);
      console.log('[getSalesmen] This should be treated as "Salesmen not found"');
    }
    
    // If no salesmen found after filtering, return empty array
    // The component will show "404 - No salesman found" message
    // Note: Backend returns 200 even when no salesmen exist, so we handle "not found" on frontend
    return salesmenArray;
  } catch (error) {
    // Handle "Salesmen not found" as a valid case (empty salesmen)
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    // Check multiple variations of "not found" messages
    if (errorMessage.includes('salesmen not found') ||
        errorMessage.includes('no salesmen found') ||
        errorMessage.includes('salesman not found') ||
        errorText.includes('salesmen not found') ||
        errorText.includes('no salesmen found') ||
        errorText.includes('salesman not found') ||
        error.statusCode === 404) {
      console.log('[getSalesmen] No salesmen found for country, returning empty array');
      return [];
    }
    // Handle missing salesman_zones table - backend DB issue, return empty array gracefully
    if (errorMessage.includes('salesman_zones') || errorMessage.includes("doesn't exist") ||
        errorText.includes('salesman_zones') || errorText.includes("doesn't exist")) {
      console.warn('[getSalesmen] Backend DB error (missing salesman_zones table), returning empty array:', error.message);
      return [];
    }
    // Re-throw other errors
    throw error;
  }
};

/**
 * Create salesman
 * @param {Object} salesmanData - Salesman data
 * @param {string} salesmanData.user_id - User ID (UUID)
 * @param {string} salesmanData.employee_code - Employee code
 * @param {string} salesmanData.alternate_phone - Alternate phone (optional)
 * @param {string} salesmanData.full_name - Full name
 * @param {string} salesmanData.reporting_manager - Reporting manager ID (UUID)
 * @param {string} salesmanData.email - Email address
 * @param {string} salesmanData.phone - Phone number
 * @param {string} salesmanData.address - Address
 * @param {string} salesmanData.country_id - Country ID (UUID)
 * @param {string} salesmanData.state_id - State ID (UUID)
 * @param {string} salesmanData.city_id - City ID (UUID)
 * @param {string} salesmanData.zone_preference - Zone preference
 * @param {string} salesmanData.joining_date - Joining date (ISO string)
 * @returns {Promise<Object>} Created salesman object
 */
export const createSalesman = async (salesmanData) => {
  const {
    user_id,
    employee_code,
    alternate_phone,
    full_name,
    reporting_manager,
    email,
    phone,
    address,
    country_id,
    state_id,
    city_id,
    zone_preference,
    joining_date,
  } = salesmanData;
  
  // Validate required fields - ensure they exist and are not empty
  const trimmedEmployeeCode = employee_code ? String(employee_code).trim() : '';
  const trimmedFullName = full_name ? String(full_name).trim() : '';
  const trimmedEmail = email ? String(email).trim() : '';
  const trimmedPhone = phone ? String(phone).trim() : '';
  const trimmedCountryId = country_id ? String(country_id).trim() : '';
  
  if (!trimmedEmployeeCode) {
    throw new Error('Employee code is required');
  }
  if (!trimmedFullName) {
    throw new Error('Full name is required');
  }
  if (!trimmedEmail) {
    throw new Error('Email is required');
  }
  if (!trimmedPhone) {
    throw new Error('Phone is required');
  }
  if (!trimmedCountryId) {
    throw new Error('Country is required');
  }
  
  // Validate user_id - it's required (NOT NULL in database)
  const trimmedUserId = user_id ? String(user_id).trim() : '';
  if (!trimmedUserId || trimmedUserId === '') {
    throw new Error('User ID is required');
  }
  
  // Build request body matching the exact payload structure provided
  // reporting_manager must be null (not empty string) if not provided, to satisfy foreign key constraint
  let reportingManagerValue = null;
  if (reporting_manager !== null && reporting_manager !== undefined && reporting_manager !== '') {
    const trimmed = String(reporting_manager).trim();
    if (trimmed !== '') {
      reportingManagerValue = trimmed;
    }
  }
  
  const zonesArray = Array.isArray(salesmanData.zones) ? salesmanData.zones : [];
  const stateIdsArray = Array.isArray(salesmanData.state_ids) ? salesmanData.state_ids : [];

  const requestBody = {
    user_id: trimmedUserId,
    employee_code: trimmedEmployeeCode,
    alternate_phone: alternate_phone ? String(alternate_phone).trim() : '',
    full_name: trimmedFullName,
    email: trimmedEmail,
    phone: trimmedPhone,
    address: address ? String(address).trim() : '',
    country_id: trimmedCountryId,
    state_id: state_id && String(state_id).trim() !== '' ? String(state_id).trim() : null,
    city_id: city_id && String(city_id).trim() !== '' ? String(city_id).trim() : null,
    zones: zonesArray,
    state_ids: stateIdsArray,
    zone_preference: salesmanData.zone_preference || '',
    joining_date: joining_date || new Date().toISOString(),
  };
  
  // Set reporting_manager - must be either a valid UUID string or null (never empty string)
  // The database foreign key constraint requires either a valid user_id or NULL
  if (reportingManagerValue !== null && reportingManagerValue !== '' && reportingManagerValue !== undefined) {
    // Validate it looks like a UUID (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(reportingManagerValue)) {
      requestBody.reporting_manager = reportingManagerValue;
    } else {
      console.warn('[Create Salesman] Invalid UUID format for reporting_manager, setting to null:', reportingManagerValue);
      requestBody.reporting_manager = null;
    }
  } else {
    // Explicitly set to null - backend should handle this for foreign key constraint
    requestBody.reporting_manager = null;
  }
  
  // Final validation of request body
  if (!requestBody.employee_code || requestBody.employee_code === '') {
    console.error('[Create Salesman] Request body validation failed:', requestBody);
    throw new Error('Employee code is required in request body');
  }
  if (!requestBody.full_name || requestBody.full_name === '') {
    console.error('[Create Salesman] Request body validation failed:', requestBody);
    throw new Error('Full name is required in request body');
  }
  if (!requestBody.user_id || requestBody.user_id === '') {
    console.error('[Create Salesman] Request body validation failed: user_id is required', requestBody);
    throw new Error('User ID is required in request body');
  }
  
  console.log('[Create Salesman] Creating salesman with employee_code:', requestBody.employee_code);
  console.log('[Create Salesman] Request body:', JSON.stringify(requestBody, null, 2));
  console.log('[Create Salesman] reporting_manager value:', requestBody.reporting_manager, 'type:', typeof requestBody.reporting_manager);
  
  return apiRequest('/salesmen', {
    method: 'POST',
    body: requestBody,
    includeAuth: true,
  });
};

/**
 * Update salesman
 * @param {string} salesmanId - Salesman ID (UUID)
 * @param {Object} salesmanData - Salesman data to update
 * @param {string} salesmanData.user_id - User ID (UUID)
 * @param {string} salesmanData.employee_code - Employee code
 * @param {string} salesmanData.alternate_phone - Alternate phone (optional)
 * @param {string} salesmanData.full_name - Full name
 * @param {string} salesmanData.reporting_manager - Reporting manager ID (UUID)
 * @param {string} salesmanData.email - Email address
 * @param {string} salesmanData.phone - Phone number
 * @param {string} salesmanData.address - Address
 * @param {string} salesmanData.country_id - Country ID (UUID)
 * @param {string} salesmanData.state_id - State ID (UUID)
 * @param {string} salesmanData.city_id - City ID (UUID)
 * @param {string} salesmanData.zone_preference - Zone preference
 * @param {string} salesmanData.joining_date - Joining date (ISO string)
 * @returns {Promise<Object>} Response with message
 */
export const updateSalesman = async (salesmanId, salesmanData) => {
  // Validate salesmanId
  if (!salesmanId) {
    throw new Error('Salesman ID is required');
  }
  
  const cleanSalesmanId = String(salesmanId).trim();
  if (!cleanSalesmanId || cleanSalesmanId === 'undefined' || cleanSalesmanId === 'null') {
    console.error('[Update Salesman] Invalid salesman ID:', salesmanId);
    throw new Error('Invalid salesman ID');
  }
  
  const {
    user_id,
    employee_code,
    alternate_phone,
    full_name,
    reporting_manager,
    email,
    phone,
    address,
    country_id,
    state_id,
    city_id,
    zone_preference,
    joining_date,
  } = salesmanData;
  
  // Validate required fields - ensure they exist and are not empty
  const trimmedEmployeeCode = employee_code ? String(employee_code).trim() : '';
  const trimmedFullName = full_name ? String(full_name).trim() : '';
  const trimmedEmail = email ? String(email).trim() : '';
  const trimmedPhone = phone ? String(phone).trim() : '';
  const trimmedCountryId = country_id ? String(country_id).trim() : '';
  
  if (!trimmedEmployeeCode) {
    throw new Error('Employee code is required');
  }
  if (!trimmedFullName) {
    throw new Error('Full name is required');
  }
  if (!trimmedEmail) {
    throw new Error('Email is required');
  }
  if (!trimmedPhone) {
    throw new Error('Phone is required');
  }
  if (!trimmedCountryId) {
    throw new Error('Country is required');
  }
  
  // Validate user_id - it's required (NOT NULL in database)
  const trimmedUserId = user_id ? String(user_id).trim() : '';
  if (!trimmedUserId || trimmedUserId === '') {
    throw new Error('User ID is required');
  }
  
  // Build request body matching the exact payload structure provided
  // reporting_manager must be null (not empty string) if not provided, to satisfy foreign key constraint
  let reportingManagerValue = null;
  if (reporting_manager !== null && reporting_manager !== undefined && reporting_manager !== '') {
    const trimmed = String(reporting_manager).trim();
    if (trimmed !== '') {
      reportingManagerValue = trimmed;
    }
  }
  
  const zonesArray = Array.isArray(salesmanData.zones) ? salesmanData.zones : [];
  const stateIdsArray = Array.isArray(salesmanData.state_ids) ? salesmanData.state_ids : [];

  const requestBody = {
    user_id: trimmedUserId,
    employee_code: trimmedEmployeeCode,
    alternate_phone: alternate_phone ? String(alternate_phone).trim() : '',
    full_name: trimmedFullName,
    email: trimmedEmail,
    phone: trimmedPhone,
    address: address ? String(address).trim() : '',
    country_id: trimmedCountryId,
    // Optional FK columns — null (not '') when empty, else the salesmen ->
    // states/cities foreign keys reject the empty string with a 500.
    state_id: state_id && String(state_id).trim() !== '' ? String(state_id).trim() : null,
    city_id: city_id && String(city_id).trim() !== '' ? String(city_id).trim() : null,
    zones: zonesArray,
    state_ids: stateIdsArray,
    zone_preference: salesmanData.zone_preference || '',
    joining_date: joining_date || new Date().toISOString(),
  };
  
  // Set reporting_manager - must be either a valid UUID string or null (never empty string)
  // The database foreign key constraint requires either a valid user_id or NULL
  if (reportingManagerValue !== null && reportingManagerValue !== '' && reportingManagerValue !== undefined) {
    // Validate it looks like a UUID (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(reportingManagerValue)) {
      requestBody.reporting_manager = reportingManagerValue;
    } else {
      console.warn('[Create Salesman] Invalid UUID format for reporting_manager, setting to null:', reportingManagerValue);
      requestBody.reporting_manager = null;
    }
  } else {
    // Explicitly set to null - backend should handle this for foreign key constraint
    requestBody.reporting_manager = null;
  }
  
  // Final validation of request body
  if (!requestBody.employee_code || requestBody.employee_code === '') {
    console.error('[Update Salesman] Request body validation failed:', requestBody);
    throw new Error('Employee code is required in request body');
  }
  if (!requestBody.full_name || requestBody.full_name === '') {
    console.error('[Update Salesman] Request body validation failed:', requestBody);
    throw new Error('Full name is required in request body');
  }
  if (!requestBody.user_id || requestBody.user_id === '') {
    console.error('[Update Salesman] Request body validation failed: user_id is required', requestBody);
    throw new Error('User ID is required in request body');
  }
  
  console.log('[Update Salesman] Updating salesman with ID:', cleanSalesmanId);
  console.log('[Update Salesman] Request body:', JSON.stringify(requestBody, null, 2));
  console.log('[Update Salesman] reporting_manager value:', requestBody.reporting_manager, 'type:', typeof requestBody.reporting_manager);
  
  return apiRequest(`/salesmen/${cleanSalesmanId}`, {
    method: 'PUT',
    body: requestBody,
    includeAuth: true,
  });
};

/**
 * Delete salesman
 * @param {string} salesmanId - Salesman ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteSalesman = async (salesmanId) => {
  // Validate salesmanId
  if (!salesmanId) {
    throw new Error('Salesman ID is required');
  }
  
  const cleanSalesmanId = String(salesmanId).trim();
  if (!cleanSalesmanId || cleanSalesmanId === 'undefined' || cleanSalesmanId === 'null') {
    console.error('[Delete Salesman] Invalid salesman ID:', salesmanId);
    throw new Error('Invalid salesman ID');
  }
  
  console.log('[Delete Salesman] Deleting salesman with ID:', cleanSalesmanId);
  
  return apiRequest(`/salesmen/${cleanSalesmanId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

