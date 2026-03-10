/**
 * Expense Service
 * API service for salesman expense endpoints
 */

import { getToken } from './authService';
import { showError } from './notificationService';

const getBaseURL = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    let url = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
    if (!url.includes('/api')) {
      url = `${url}/api`;
    }
    return url;
  }
  return 'https://stallion.nishree.com/api';
};

const getHeaders = (includeAuth = true) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (includeAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
};

const handleResponse = async (response) => {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    
    try {
      if (isJson) {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorData.msg || errorMessage;
      } else {
        const textResponse = await response.text();
        errorMessage = textResponse || response.statusText || `HTTP ${response.status} Error`;
      }
    } catch (parseError) {
      errorMessage = response.statusText || `HTTP ${response.status} Error`;
    }
    
    const error = new Error(errorMessage);
    error.statusCode = response.status;
    throw error;
  }

  const text = await response.text();
  if (!text || text.trim() === '' || text.trim() === 'null') {
    return { message: 'Success' };
  }
  
  if (isJson) {
    try {
      return JSON.parse(text);
    } catch (jsonParseError) {
      return { message: 'Success' };
    }
  }
  
  return text;
};

/**
 * Get salesman expenses
 * @returns {Promise<Array>} Array of expense objects
 */
export const getSalesmanExpenses = async () => {
  const baseUrl = getBaseURL();
  const fullUrl = `${baseUrl}/salesman_expenses/`;
  
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: getHeaders(true),
    credentials: 'include',
  });
  
  // Handle 404 as empty array (no expenses found)
  if (response.status === 404) {
    return [];
  }
  
  return await handleResponse(response);
};

/**
 * Create salesman expense
 * @param {Object} expenseData - Expense data
 * @param {string} expenseData.expense_date - Expense date (ISO format)
 * @param {number} expenseData.expense_amount - Expense amount
 * @param {string} expenseData.expense_description - Expense description
 * @param {string} expenseData.expense_type - Expense type (travel, hotel, fuel, etc.)
 * @param {Array} expenseData.images - Array of image URLs
 * @param {string} expenseData.remarks - Remarks (optional)
 * @returns {Promise<Object>} Created expense object
 */
export const createSalesmanExpense = async (expenseData) => {
  const baseUrl = getBaseURL();
  const fullUrl = `${baseUrl}/salesman_expenses/`;  // Keep trailing slash as in Postman
  
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: getHeaders(true),
    credentials: 'include',
    body: JSON.stringify(expenseData),
  });
  
  return await handleResponse(response);
};

/**
 * Upload expense images
 * @param {File[]} files - Array of image files
 * @returns {Promise<Object>} Response with uploaded image paths
 */
export const uploadExpenseImages = async (files) => {
  const baseUrl = getBaseURL();
  const fullUrl = `${baseUrl}/salesman_expenses/upload-images`;
  
  const formData = new FormData();
  files.forEach(file => {
    formData.append('bill_file', file);
  });
  
  const token = getToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });
  
  return await handleResponse(response);
};

/**
 * Update salesman expense
 * @param {string} expenseId - Expense ID
 * @param {Object} updateData - Data to update
 * @param {string} updateData.status - Status (pending, approved, rejected)
 * @param {string} updateData.remarks - Remarks (optional)
 * @returns {Promise<Object>} Updated expense object
 */
export const updateSalesmanExpense = async (expenseId, updateData) => {
  const baseUrl = getBaseURL();
  const fullUrl = `${baseUrl}/salesman_expenses/${expenseId}`;
  
  const response = await fetch(fullUrl, {
    method: 'PUT',
    headers: getHeaders(true),
    credentials: 'include',
    body: JSON.stringify(updateData),
  });
  
  return await handleResponse(response);
};

/**
 * Delete salesman expense
 * @param {string} expenseId - Expense ID
 * @returns {Promise<Object>} Response with message
 */
export const deleteSalesmanExpense = async (expenseId) => {
  const baseUrl = getBaseURL();
  const fullUrl = `${baseUrl}/salesman_expenses/${expenseId}`;
  
  const response = await fetch(fullUrl, {
    method: 'DELETE',
    headers: getHeaders(true),
    credentials: 'include',
  });
  
  return await handleResponse(response);
};

/**
 * Get all expenses for admin view
 * @returns {Promise<Array>} Array of all expense objects from all salesmen
 */
export const getAllAdminExpenses = async () => {
  const baseUrl = getBaseURL();
  const fullUrl = `${baseUrl}/salesman_expenses/admin/all`;
  
  console.log('Making admin API call to:', fullUrl);
  
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: getHeaders(true),
    credentials: 'include',
  });
  
  console.log('Admin API response status:', response.status);
  
  // Handle 404 as empty array (no expenses found)
  if (response.status === 404) {
    return [];
  }
  
  const result = await handleResponse(response);
  console.log('Parsed admin API result:', result);
  return result;
};
