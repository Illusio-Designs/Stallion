import { apiRequest, fetchAllPages } from './client';

// ==================== SALESMAN CHECK-IN ENDPOINTS ====================

/**
 * Get all salesman check-ins
 * @returns {Promise<Array>} Array of check-in objects
 */
export const getAllSalesmanCheckins = async () => {
  // GET /salesman_checkins now requires page & limit (400 otherwise). Fetch the
  // full set for the analytics report (page=1&limit=1000) and unwrap { data }.
  return fetchAllPages('/salesman_checkins', {
    method: 'GET',
    includeAuth: true,
    silent: true, // empty -> 404 "not found"; callers treat as empty list
  });
};

/**
 * Get a single salesman by id (returns the salesman with zones/states).
 * @param {string} salesmanId
 * @returns {Promise<Object>}
 */
export const getSalesmanById = async (salesmanId) => {
  return apiRequest(`/salesmen/${salesmanId}`, {
    method: 'GET',
    includeAuth: true,
  });
};

/**
 * Get salesman check-ins by salesman ID
 * @param {string} salesmanId - Salesman ID (UUID)
 * @returns {Promise<Array>} Array of check-in objects
 */
export const getSalesmanCheckins = async (salesmanId) => {
  return apiRequest(`/salesman_checkins/${salesmanId}`, {
    method: 'GET',
    includeAuth: true,
    silent: true, // empty -> 404 "not found"; callers treat as empty list
  });
};

/**
 * Create salesman check-in
 * @param {Object} checkinData - Check-in data
 * @param {string} checkinData.salesman_id - Salesman ID (UUID)
 * @param {string} checkinData.check_in_date - Check-in date (YYYY-MM-DD)
 * @param {string} checkinData.party_id - Party ID (UUID)
 * @param {string} checkinData.latitude - Latitude
 * @param {string} checkinData.longitude - Longitude
 * @param {string} checkinData.check_in_remarks - Check-in remarks
 * @returns {Promise<Object>} Created check-in object
 */
export const createSalesmanCheckin = async (checkinData) => {
  return apiRequest('/salesman_checkins', {
    method: 'POST',
    body: checkinData,
    includeAuth: true,
  });
};

/**
 * Update salesman check-in
 * @param {string} checkinId - Check-in ID (UUID)
 * @param {Object} checkinData - Check-in data to update
 * @returns {Promise<Object>} Updated check-in object
 */
export const updateSalesmanCheckin = async (checkinId, checkinData) => {
  return apiRequest(`/salesman_checkins/${checkinId}`, {
    method: 'PUT',
    body: checkinData,
    includeAuth: true,
  });
};

/**
 * Delete salesman check-in
 * @param {string} checkinId - Check-in ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteSalesmanCheckin = async (checkinId) => {
  return apiRequest(`/salesman_checkins/${checkinId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== SALESMAN TARGET ENDPOINTS ====================

/**
 * Get all salesman targets
 * @returns {Promise<Array>} Array of target objects
 */
export const getAllSalesmanTargets = async () => {
  // GET /salesman_targets now requires page & limit (400 otherwise). Fetch the
  // full set for the analytics report (page=1&limit=1000) and unwrap { data }.
  return fetchAllPages('/salesman_targets', {
    method: 'GET',
    includeAuth: true,
    silent: true, // empty -> 404 "not found"; callers treat as empty list
  });
};

/**
 * Get salesman targets by salesman ID
 * @param {string} salesmanId - Salesman ID (UUID)
 * @returns {Promise<Array>} Array of target objects
 */
export const getSalesmanTargets = async (salesmanId) => {
  return apiRequest(`/salesman_targets/${salesmanId}`, {
    method: 'GET',
    includeAuth: true,
    silent: true, // empty -> 404 "not found"; callers treat as empty list
  });
};

/**
 * Create salesman target
 * @param {Object} targetData - Target data
 * @param {string} targetData.salesman_id - Salesman ID (UUID)
 * @param {number} targetData.target_amount - Target amount
 * @param {string} targetData.target_date - Target date (YYYY-MM-DD)
 * @param {string} targetData.order_type - Order type (optional: "party_order" or null for overall)
 * @param {string} targetData.target_description - Target description
 * @param {string} targetData.target_remarks - Target remarks
 * @returns {Promise<Object>} Created target object
 */
export const createSalesmanTarget = async (targetData) => {
  return apiRequest('/salesman_targets', {
    method: 'POST',
    body: targetData,
    includeAuth: true,
  });
};

/**
 * Update salesman target
 * @param {string} targetId - Target ID (UUID)
 * @param {Object} targetData - Target data to update
 * @returns {Promise<Object>} Updated target object
 */
export const updateSalesmanTarget = async (targetId, targetData) => {
  return apiRequest(`/salesman_targets/${targetId}`, {
    method: 'PUT',
    body: targetData,
    includeAuth: true,
  });
};

/**
 * Delete salesman target
 * @param {string} targetId - Target ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteSalesmanTarget = async (targetId) => {
  return apiRequest(`/salesman_targets/${targetId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

/**
 * Get parties for the logged-in salesman (by zone)
 * Uses getPartiesByZoneId which already handles this via auth token
 */

