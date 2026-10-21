/**
 * Expense Service
 * API calls for salesman expenses. Uses the shared API client like every other
 * service, so errors, login expiry and request headers behave the same way.
 */

import { apiRequest, fetchAllPages, getBaseURL, getHeaders, handleResponse } from './api/client';

const BASE = '/salesman_expenses';

// "Nothing found" comes back as 404; for a list that just means empty.
const emptyOn404 = (err) => {
  if (err && err.statusCode === 404) return [];
  throw err;
};

/**
 * Get salesman expenses
 * @returns {Promise<Array>} Array of expense objects
 */
export const getSalesmanExpenses = async () => {
  try {
    return await apiRequest(`${BASE}/`, { method: 'GET', includeAuth: true, silent: true });
  } catch (err) {
    return emptyOn404(err);
  }
};

/**
 * Create salesman expense
 * @param {Object} expenseData - date, amount, description, type (food, travel, city_tour,
 *   toll, hotel, other), travel_mode (travel), toll_message (toll), kilometers, images
 * @returns {Promise<Object>} Created expense object
 */
export const createSalesmanExpense = async (expenseData) =>
  apiRequest(`${BASE}/`, { method: 'POST', body: expenseData, includeAuth: true });

/**
 * Upload expense bill images
 * @param {File[]} files - Array of image files
 * @returns {Promise<Object>} Response with uploaded image paths
 */
export const uploadExpenseImages = async (files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('bill_file', file));
  // The shared client sends JSON only, so files use its headers and response handling directly.
  const response = await fetch(`${getBaseURL()}${BASE}/upload-images`, {
    method: 'POST',
    headers: getHeaders(true),
    credentials: 'omit',
    body: formData,
  });
  return handleResponse(response);
};

/**
 * Update salesman expense (status and remarks are for admin; an approved expense is locked)
 * @returns {Promise<Object>} Updated expense object
 */
export const updateSalesmanExpense = async (expenseId, updateData) =>
  apiRequest(`${BASE}/${expenseId}`, { method: 'PUT', body: updateData, includeAuth: true });

/**
 * Delete salesman expense
 * @returns {Promise<Object>} Response with message
 */
export const deleteSalesmanExpense = async (expenseId) =>
  apiRequest(`${BASE}/${expenseId}`, { method: 'DELETE', includeAuth: true });

/**
 * Get all expenses for the admin view (all salesmen)
 * @returns {Promise<Array>} Array of expense objects
 */
export const getAllAdminExpenses = async () => {
  try {
    return await fetchAllPages(`${BASE}/admin/all`, { method: 'GET', includeAuth: true, silent: true });
  } catch (err) {
    return emptyOn404(err);
  }
};
