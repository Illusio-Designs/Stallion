/**
 * API Service
 * Centralized API service for all backend endpoints
 */

import { sendOTP } from './msg91Service';
import { logout } from './authService';
import { showError } from './notificationService';

/**
 * Get Base URL from environment variable
 * Falls back to default if not set
 * Always uses live API URL directly
 */
const getBaseURL = () => {
  // Always use the live API URL directly (no proxy)
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    let url = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
    if (!url.includes('/api')) {
      url = `${url}/api`;
    }
    return url;
  }
  // Default to live API URL
  return 'https://stallion.nishree.com/api';
};

// Get BASE_URL - will be evaluated at module load time
// For dynamic access, use getBaseURL() function
const BASE_URL = getBaseURL();

// Flag to prevent infinite redirect loops
let isRedirecting = false;
// Flag to prevent multiple logout notifications (shared across modules via window)
if (typeof window !== 'undefined') {
  window.__hasShownLogoutNotification = window.__hasShownLogoutNotification || false;
}

/**
 * Get authentication token from localStorage
 */
const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

/**
 * Get headers for API requests
 */
const getHeaders = (includeAuth = true) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
};

/**
 * Handle API response
 */
const handleResponse = async (response) => {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    let errorData = {};
    let errorMessage = 'An error occurred';
    
    try {
      if (isJson) {
        errorData = await response.json();
      } else {
        // Try to get text response
        const textResponse = await response.text();
        try {
          // Try to parse as JSON even if content-type doesn't say so
          errorData = JSON.parse(textResponse);
        } catch {
          // If not JSON, use the text as error message
          errorMessage = textResponse || response.statusText || `HTTP ${response.status} Error`;
        }
      }
      
      // Extract error message from various possible structures
      errorMessage = errorData.error || 
                    errorData.message || 
                    errorData.msg ||
                    errorData.detail ||
                    errorData.Error ||
                    errorData.Message ||
                    (errorData.data && (errorData.data.error || errorData.data.message || errorData.data.msg)) ||
                    errorMessage;
      
      // If we still have the default message, try to get more info
      if (errorMessage === 'An error occurred' && errorData) {
        // Log the full error data for debugging
        console.error('[API Error] Full error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          url: response.url
        });
        
        // Try to construct a more informative message
        if (response.status === 404) {
          errorMessage = 'Resource not found';
        } else if (response.status === 500) {
          errorMessage = 'Internal server error. Please try again later.';
        } else if (response.status === 400) {
          errorMessage = 'Bad request. Please check your input.';
        } else if (response.status === 403) {
          errorMessage = 'Access forbidden';
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
      }
    } catch (parseError) {
      // If we can't parse the error response, use status text
      console.error('[API Error] Failed to parse error response:', parseError);
      errorMessage = response.statusText || `HTTP ${response.status} Error`;
    }
    
    // Check for token expiration (401 Unauthorized or "Token expired" message)
    const isTokenExpired = response.status === 401 || 
                          errorMessage.toLowerCase().includes('token expired') ||
                          errorMessage.toLowerCase().includes('unauthorized') ||
                          errorMessage.toLowerCase().includes('invalid token');
    
    if (isTokenExpired && typeof window !== 'undefined' && !isRedirecting && !window.__hasShownLogoutNotification) {
      isRedirecting = true;
      window.__hasShownLogoutNotification = true;
      
      // Show notification immediately
      showError('Your session has expired. Please login again.');
      
      // Clear authentication immediately
      logout();
      
      // Redirect to login page after a short delay to ensure notification is visible
      // Check if we're not already on the login page to avoid infinite loops
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login')) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 500); // Small delay to ensure notification is visible
      } else {
        // Reset flag if already on login page
        setTimeout(() => {
          isRedirecting = false;
          window.__hasShownLogoutNotification = false;
        }, 1000);
      }
    }
    
    // Check for backend initialization error - mark it specially so components can handle it
    const isInitError = errorMessage.toLowerCase().includes("cannot access 'party' before initialization") ||
                       errorMessage.toLowerCase().includes("cannot access 'distributor' before initialization") ||
                       (errorMessage.toLowerCase().includes("cannot access") && errorMessage.toLowerCase().includes("before initialization"));
    
    if (isInitError) {
      // Create a special error object that components can detect
      const initError = new Error(errorMessage);
      initError.isInitializationError = true;
      initError.statusCode = response.status;
      throw initError;
    }
    
    // Create error with more context
    const error = new Error(errorMessage);
    error.statusCode = response.status;
    error.statusText = response.statusText;
    error.errorData = errorData;
    throw error;
  }

  // Handle successful responses
  // For DELETE requests, the response might be empty, null, or the string "null"
  // Read the response as text first (we can only read the body once)
  const text = await response.text();
  
  // If response is empty, return success
  if (!text || text.trim() === '') {
    return { message: 'Deleted successfully' };
  }
  
  // If response is the string "null", return success
  const trimmedText = text.trim();
  if (trimmedText === 'null' || trimmedText.toLowerCase() === 'null') {
    return { message: 'Deleted successfully' };
  }
  
  // Try to parse as JSON if content-type suggests JSON
  if (isJson) {
    try {
      return JSON.parse(text);
    } catch (jsonParseError) {
      // If JSON parsing fails, log warning but return success for DELETE operations
      console.warn('[API] Failed to parse JSON response, but operation may have succeeded:', jsonParseError);
      console.warn('[API] Response text:', text);
      return { message: 'Deleted successfully' };
    }
  }
  
  // For non-JSON responses, return the text
  return text;
};

/**
 * Make API request
 */
const apiRequest = async (endpoint, options = {}) => {
  const { method = 'GET', body = null, includeAuth = true } = options;

  // Check if token exists before making authenticated requests
  // If token is missing and we need auth, log out immediately
  if (includeAuth && typeof window !== 'undefined') {
    const token = getAuthToken();
    if (!token && !isRedirecting && !window.__hasShownLogoutNotification) {
      isRedirecting = true;
      window.__hasShownLogoutNotification = true;
      showError('Your session has expired. Please login again.');
      logout();
      
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login')) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      }
      
      setTimeout(() => {
        isRedirecting = false;
        window.__hasShownLogoutNotification = false;
      }, 1000);
      
      // Throw error to prevent the API call
      const error = new Error('Token not found. Please login again.');
      error.statusCode = 401;
      throw error;
    }
  }

  // Get base URL dynamically to ensure it's always correct
  const baseUrl = getBaseURL();
  
  // Ensure endpoint starts with /
  let normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // For GET requests with body, we need to handle it differently
  // Browsers don't allow GET requests with body, so we convert to POST or query params
  let fullUrl = `${baseUrl}${normalizedEndpoint}`;
  let actualMethod = method;
  let requestBody = body;
  
  if (method === 'GET' && body) {
    // Check if this is the products endpoint that requires body
    const isProductsEndpoint = normalizedEndpoint.includes('/products');
    
    // Check if body contains nested objects (like price: { min, max })
    const hasNestedObjects = Object.values(body).some(value => 
      typeof value === 'object' && value !== null && !Array.isArray(value)
    );
    
    // Products endpoint with filters needs POST (browsers can't send body with GET)
    // Only convert to POST if there are actual filters (not just empty object)
    const hasFilters = Object.keys(body).length > 0;
    if (isProductsEndpoint && (hasFilters || hasNestedObjects)) {
      // Change to POST method for products endpoint with filters
      actualMethod = 'POST';
      requestBody = body;
    } else if (hasNestedObjects) {
      // For other endpoints with nested objects, also use POST
      actualMethod = 'POST';
      requestBody = body;
    } else {
      // Convert simple body to query parameters for GET
      const queryParams = new URLSearchParams();
      Object.keys(body).forEach(key => {
        if (body[key] !== null && body[key] !== undefined) {
          if (Array.isArray(body[key])) {
            // Handle arrays in query params
            body[key].forEach(item => queryParams.append(key, item));
          } else {
            queryParams.append(key, body[key]);
          }
        }
      });
      const queryString = queryParams.toString();
      if (queryString) {
        fullUrl += fullUrl.includes('?') ? `&${queryString}` : `?${queryString}`;
      }
      requestBody = null; // No body needed, converted to query params
    }
  }
  
  // Ensure no double slashes (but preserve trailing slash for /products/ endpoint)
  // Postman collection shows /products/?page=1&limit=21 with trailing slash
  if (!normalizedEndpoint.includes('/products/')) {
    fullUrl = fullUrl.replace(/([^:]\/)\/+/g, '$1');
  } else {
    // For products endpoint, only remove double slashes in the middle, keep trailing
    fullUrl = fullUrl.replace(/([^:]\/)\/+(?=\/)/g, '$1');
  }
  
  console.log(`[API Request] ${actualMethod} ${fullUrl}`); // Debug log
  console.log(`[API Base URL] ${baseUrl}`); // Debug log

  const config = {
    method: actualMethod,
    headers: getHeaders(includeAuth),
    credentials: 'include', // Include cookies for CORS
  };

  // Add body for POST/PUT/PATCH requests
  // DELETE requests should not have a body (or should have undefined body)
  if (actualMethod !== 'GET' && actualMethod !== 'DELETE') {
    if (requestBody === null) {
      // For POST/PUT/PATCH, if body is explicitly null, don't send body
      // Don't add body to config
      console.log(`[API Request Body]`, null); // Debug log
    } else if (requestBody) {
      // Clean the body - remove any undefined values and ensure proper JSON
      const cleanBody = JSON.parse(JSON.stringify(requestBody)); // This removes undefined and ensures valid JSON
      config.body = JSON.stringify(cleanBody);
      config.headers['Content-Type'] = 'application/json';
      console.log(`[API Request Body]`, cleanBody); // Debug log
    }
    // If requestBody is undefined, don't add body
  } else if (actualMethod === 'DELETE') {
    // DELETE requests should not have a body
    // Don't add body to config at all
    console.log(`[API Request] DELETE request - no body sent`);
  }

  try {
    const response = await fetch(fullUrl, config);
    return await handleResponse(response);
  } catch (error) {
    console.error(`API Error [${method} ${fullUrl}]:`, error);
    throw error;
  }
};

// ==================== AUTH ENDPOINTS ====================

/**
 * Check if user exists
 * @param {string} phoneNumber - Phone number in E.164 format (e.g., +917600032917)
 * @param {Object} options - Optional configuration
 * @param {boolean} options.autoSendOTP - Automatically send OTP via MSG91 if checkUser returns 200 (default: true)
 * @returns {Promise<Object>} Response with message
 */
export const checkUser = async (phoneNumber, options = {}) => {
  const { autoSendOTP = true } = options;
  
  try {
    console.log('[checkUser] Checking user with phone:', phoneNumber);
    const response = await apiRequest('/auth/check-user', {
      method: 'POST',
      body: { phoneNumber },
      includeAuth: false,
    });
    
    console.log('[checkUser] Response received:', response);

    // If checkUser returns 200 and autoSendOTP is enabled, send OTP via MSG91
    if (autoSendOTP && response) {
      try {
        await sendOTP(phoneNumber);
        return {
          ...response,
          otpSent: true,
          message: response.message || 'OTP sent successfully',
        };
      } catch (otpError) {
        console.error('[checkUser] Error sending OTP via MSG91:', otpError);
        // Return checkUser response even if OTP sending fails
        return {
          ...response,
          otpSent: false,
          otpError: otpError.message || 'Failed to send OTP',
        };
      }
    }

    return response;
  } catch (error) {
    console.error('[checkUser] Error checking user:', {
      phoneNumber,
      error: error.message,
      statusCode: error.statusCode,
      errorData: error.errorData
    });
    throw error;
  }
};

/**
 * Login user
 * @param {string} phoneNumber - Phone number in E.164 format (e.g., +917600032917)
 * @returns {Promise<Object>} Response with token, role, and message
 */
export const login = async (phoneNumber) => {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { phoneNumber },
    includeAuth: false,
  });
};

/**
 * Register new user
 * @param {Object} userData - User registration data
 * @param {string} userData.phoneNumber - Phone number in E.164 format
 * @param {string} userData.fullName - User's full name
 * @param {string} userData.roleId - Role ID (UUID)
 * @returns {Promise<Object>} Response with user data
 */
export const register = async (userData) => {
  const { phoneNumber, fullName, roleId } = userData;
  return apiRequest('/auth/register', {
    method: 'POST',
    body: { phoneNumber, fullName, roleId },
    includeAuth: false,
  });
};

// ==================== ROLE ENDPOINTS ====================

/**
 * Get all roles
 * @returns {Promise<Array>} Array of role objects
 */
export const getRoles = async () => {
  return apiRequest('/roles', {
    method: 'GET',
    includeAuth: true,
  });
};

// ==================== USER ENDPOINTS ====================

/**
 * Get all users
 * @returns {Promise<Array>} Array of user objects
 */
export const getUsers = async () => {
  return apiRequest('/users', {
    method: 'GET',
    includeAuth: true,
  });
};

/**
 * Update user
 * @param {string} userId - User ID (UUID)
 * @param {Object} userData - User data to update
 * @param {string} userData.name - User's full name
 * @param {string} userData.email - User's email address
 * @param {string} userData.profile_image - Profile image (legacy field, can be empty)
 * @param {string} userData.image_url - Profile image URL or data URL
 * @param {File} userData.profileImageFile - Profile image file (optional, for file upload)
 * @param {boolean} userData.is_active - Whether user is active
 * @param {string} userData.role_id - Role ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const updateUser = async (userId, userData) => {
  const { name, email, profile_image, image_url, is_active, role_id, phoneNumber, phone, profileImageFile } = userData;
  // Use phoneNumber if provided, otherwise use phone (for backward compatibility)
  const phoneValue = phoneNumber || phone || '';
  
  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new Error('Name is required');
  }
  
  // If there's a file and profile_image is not set, use FormData
  // Otherwise, use JSON with profile_image as base64
  if (profileImageFile && !profile_image) {
    const baseUrl = getBaseURL();
    const fullUrl = `${baseUrl}/users/${userId}`;
    
    const formData = new FormData();
    // Ensure all required fields are sent with proper values
    const nameValue = name ? String(name).trim() : '';
    const emailValue = email ? String(email).trim() : '';
    const phoneValueStr = phoneValue ? String(phoneValue) : '';
    const roleIdValue = role_id ? String(role_id) : '';
    const isActiveValue = is_active !== undefined ? (is_active === true || is_active === 'true') : true;
    
    formData.append('name', nameValue);
    formData.append('phoneNumber', phoneValueStr);
    formData.append('phone', phoneValueStr);
    formData.append('email', emailValue);
    formData.append('profile_image', profileImageFile); // Send file directly
    formData.append('is_active', String(isActiveValue));
    formData.append('role_id', roleIdValue);
    // Also append image_url if provided (for existing URLs)
    if (image_url && !image_url.startsWith('data:')) {
      formData.append('image_url', String(image_url));
    } else {
      formData.append('image_url', '');
    }
    
    // Log FormData contents for debugging
    console.log('FormData contents:');
    console.log('name:', nameValue);
    console.log('email:', emailValue);
    console.log('phone:', phoneValueStr);
    console.log('role_id:', roleIdValue);
    console.log('is_active:', isActiveValue);
    console.log('profile_image:', `[File: ${profileImageFile.name}, size: ${profileImageFile.size}, type: ${profileImageFile.type}]`);
    console.log('image_url:', image_url || '');
    
    const token = getAuthToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Don't set Content-Type for FormData, browser will set it with boundary
    
    const response = await fetch(fullUrl, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: formData,
    });
    
    return await handleResponse(response);
  }
  
  // Otherwise, use regular JSON request
  return apiRequest(`/users/${userId}`, {
    method: 'PUT',
    body: {
      name,
      phoneNumber: phoneValue,
      phone: phoneValue, // Also send as 'phone' in case backend expects that
      email: email || '',
      profile_image: profile_image || '',
      is_active,
      image_url: image_url || '',
      role_id,
    },
    includeAuth: true,
  });
};

/**
 * Delete user
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteUser = async (userId) => {
  return apiRequest(`/users/${userId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

/**
 * Upload profile image
 * @param {string} userId - User ID (UUID)
 * @param {File} profileImage - Profile image file
 * @returns {Promise<Object>} Response with image data
 */
export const uploadProfileImage = async (userId, profileImage) => {
  const baseUrl = getBaseURL();
  const fullUrl = `${baseUrl}/users/${userId}/upload-profile`;
  
  const formData = new FormData();
  formData.append('profile_image', profileImage);
  
  const token = getAuthToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // For FormData, don't set Content-Type header (browser will set it with boundary)
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });
  
  return await handleResponse(response);
};

// ==================== COUNTRY ENDPOINTS ====================

/**
 * Get all countries
 * @returns {Promise<Array>} Array of country objects
 */
export const getCountries = async () => {
  return apiRequest('/countries', {
    method: 'GET',
    includeAuth: true,
  });
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
  return apiRequest('/countries/', {
    method: 'POST',
    body: { name, code, phone_code, currency },
    includeAuth: true,
  });
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
  return apiRequest(`/countries/${countryId}`, {
    method: 'PUT',
    body: { name, code, phone_code, currency },
    includeAuth: true,
  });
};

/**
 * Delete country
 * @param {string} countryId - Country ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteCountry = async (countryId) => {
  return apiRequest(`/countries/${countryId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
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
  return apiRequest('/states/', {
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
  return apiRequest('/cities/', {
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
export const getAllZones = async (countryId) => {
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
  return apiRequest('/zones/', {
    method: 'POST',
    body: { name, description, city_id, state_id, country_id, zone_code },
    includeAuth: true,
  });
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
  return apiRequest(`/zones/${zoneId}`, {
    method: 'PUT',
    body: { name, description, city_id, state_id, country_id, zone_code },
    includeAuth: true,
  });
};

/**
 * Delete zone
 * @param {string} zoneId - Zone ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteZone = async (zoneId) => {
  return apiRequest(`/zones/${zoneId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

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
    const response = await apiRequest('/distributors/get', {
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
  
  return apiRequest('/distributors/', {
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
    state_id: (state_id && String(state_id).trim() !== '') ? String(state_id).trim() : '',
    city_id: (city_id && String(city_id).trim() !== '') ? String(city_id).trim() : '',
    zones: Array.isArray(zones) ? zones : [],
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
export const getParties = async (countryId) => {
  // If no countryId provided, use POST /parties/get with empty body to get all parties
  if (!countryId) {
    try {
      console.log('[getParties] Fetching all parties (no country filter)');
      const response = await apiRequest('/parties/get', {
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
    const response = await apiRequest('/parties/get', {
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
    const response = await apiRequest('/parties/get', {
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
    country_id,
    state_id,
    city_id,
    zone_id,
    pincode,
    gstin,
    pan,
    credit_days,
    prefered_courier,
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
  
  return apiRequest('/parties/', {
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
    country_id,
    state_id,
    city_id,
    zone_id,
    pincode,
    gstin,
    pan,
    credit_days,
    prefered_courier,
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
  const allFields = ['party_name', 'trade_name', 'contact_person', 'email', 'phone', 'address', 'country_id', 'state_id', 'city_id', 'zone_id', 'pincode', 'gstin', 'pan', 'credit_days', 'prefered_courier'];
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
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers,
    credentials: 'include',
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
      // Return empty array for "not found" cases - this is a valid state
      console.log('[getSalesmen] No salesmen found for country, returning empty array');
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
    zone_id: zone_preference && String(zone_preference).trim() !== '' ? String(zone_preference).trim() : null,
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
  
  return apiRequest('/salesmen/', {
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
  
  const requestBody = {
    user_id: trimmedUserId,
    employee_code: trimmedEmployeeCode,
    alternate_phone: alternate_phone ? String(alternate_phone).trim() : '',
    full_name: trimmedFullName,
    email: trimmedEmail,
    phone: trimmedPhone,
    address: address ? String(address).trim() : '',
    country_id: trimmedCountryId,
    state_id: state_id && String(state_id).trim() !== '' ? String(state_id).trim() : '',
    city_id: city_id && String(city_id).trim() !== '' ? String(city_id).trim() : '',
    zone_preference: zone_preference ? String(zone_preference).trim() : '',
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

// ==================== COLOR CODES ENDPOINTS ====================

/**
 * Get all color codes
 * @returns {Promise<Array>} Array of color code objects
 */
export const getColorCodes = async () => {
  try {
    const response = await apiRequest('/color_codes', {
      method: 'GET',
      includeAuth: true,
    });
    
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    if (errorMessage.includes('color codes not found') ||
        errorMessage.includes('not found') ||
        errorText.includes('color codes not found') ||
        errorText.includes('not found') ||
        error.statusCode === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Create color code
 * @param {Object} colorCodeData - Color code data
 * @param {string} colorCodeData.color_code - Color code (e.g., "#FFFFFF")
 * @returns {Promise<Object>} Created color code object
 */
export const createColorCode = async (colorCodeData) => {
  const { color_code } = colorCodeData;
  return apiRequest('/color_codes', {
    method: 'POST',
    body: { color_code },
    includeAuth: true,
  });
};

/**
 * Update color code
 * @param {string|number} colorCodeId - Color code ID
 * @param {Object} colorCodeData - Color code data to update
 * @param {string} colorCodeData.color_code - Color code (e.g., "#FFFFFF")
 * @returns {Promise<Object>} Response with message
 */
export const updateColorCode = async (colorCodeId, colorCodeData) => {
  const { color_code } = colorCodeData;
  return apiRequest(`/color_codes/${colorCodeId}`, {
    method: 'PUT',
    body: { color_code },
    includeAuth: true,
  });
};

/**
 * Delete color code
 * @param {string|number} colorCodeId - Color code ID
 * @returns {Promise<Object>} Response with message
 */
export const deleteColorCode = async (colorCodeId) => {
  return apiRequest(`/color_codes/${colorCodeId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== FRAME COLORS ENDPOINTS ====================

/**
 * Get all frame colors
 * @returns {Promise<Array>} Array of frame color objects
 */
export const getFrameColors = async () => {
  try {
    const response = await apiRequest('/frame_colors', {
      method: 'GET',
      includeAuth: true,
    });
    
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    if (errorMessage.includes('frame colors not found') ||
        errorMessage.includes('not found') ||
        errorText.includes('frame colors not found') ||
        errorText.includes('not found') ||
        error.statusCode === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Create frame color
 * @param {Object} frameColorData - Frame color data
 * @param {string} frameColorData.frame_color - Frame color (e.g., "#FF")
 * @returns {Promise<Object>} Created frame color object
 */
export const createFrameColor = async (frameColorData) => {
  const { frame_color } = frameColorData;
  return apiRequest('/frame_colors', {
    method: 'POST',
    body: { frame_color },
    includeAuth: true,
  });
};

/**
 * Update frame color
 * @param {string|number} frameColorId - Frame color ID
 * @param {Object} frameColorData - Frame color data to update
 * @param {string} frameColorData.frame_color - Frame color (e.g., "#FF")
 * @returns {Promise<Object>} Response with message
 */
export const updateFrameColor = async (frameColorId, frameColorData) => {
  const { frame_color } = frameColorData;
  return apiRequest(`/frame_colors/${frameColorId}`, {
    method: 'PUT',
    body: { frame_color },
    includeAuth: true,
  });
};

/**
 * Delete frame color
 * @param {string|number} frameColorId - Frame color ID
 * @returns {Promise<Object>} Response with message
 */
export const deleteFrameColor = async (frameColorId) => {
  return apiRequest(`/frame_colors/${frameColorId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== FRAME MATERIALS ENDPOINTS ====================

/**
 * Get all frame materials
 * @returns {Promise<Array>} Array of frame material objects
 */
export const getFrameMaterials = async () => {
  try {
    const response = await apiRequest('/frame_materials', {
      method: 'GET',
      includeAuth: true,
    });
    
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    if (errorMessage.includes('frame materials not found') ||
        errorMessage.includes('not found') ||
        errorText.includes('frame materials not found') ||
        errorText.includes('not found') ||
        error.statusCode === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Create frame material
 * @param {Object} frameMaterialData - Frame material data
 * @param {string} frameMaterialData.frame_material - Frame material (e.g., "Glass", "Wooden")
 * @returns {Promise<Object>} Created frame material object
 */
export const createFrameMaterial = async (frameMaterialData) => {
  const { frame_material } = frameMaterialData;
    return apiRequest('/frame_materials', {
    method: 'POST',
    body: { frame_material },
    includeAuth: true,
  });
};

/**
 * Update frame material
 * @param {string|number} frameMaterialId - Frame material ID
 * @param {Object} frameMaterialData - Frame material data to update
 * @param {string} frameMaterialData.frame_material - Frame material (e.g., "Glass", "Wooden")
 * @returns {Promise<Object>} Response with message
 */
export const updateFrameMaterial = async (frameMaterialId, frameMaterialData) => {
  const { frame_material } = frameMaterialData;
  return apiRequest(`/frame_materials/${frameMaterialId}`, {
    method: 'PUT',
    body: { frame_material },
    includeAuth: true,
  });
};

/**
 * Delete frame material
 * @param {string|number} frameMaterialId - Frame material ID
 * @returns {Promise<Object>} Response with message
 */
export const deleteFrameMaterial = async (frameMaterialId) => {
  return apiRequest(`/frame_materials/${frameMaterialId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== FRAME TYPES ENDPOINTS ====================

/**
 * Get all frame types
 * @returns {Promise<Array>} Array of frame type objects
 */
export const getFrameTypes = async () => {
  try {
    const response = await apiRequest('/frame_types', {
      method: 'GET',
      includeAuth: true,
    });
    
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    if (errorMessage.includes('frame types not found') ||
        errorMessage.includes('not found') ||
        errorText.includes('frame types not found') ||
        errorText.includes('not found') ||
        error.statusCode === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Create frame type
 * @param {Object} frameTypeData - Frame type data
 * @param {string} frameTypeData.frame_type - Frame type (e.g., "Wooden")
 * @returns {Promise<Object>} Created frame type object
 */
export const createFrameType = async (frameTypeData) => {
  const { frame_type } = frameTypeData;
    return apiRequest('/frame_types', {
    method: 'POST',
    body: { frame_type },
    includeAuth: true,
  });
};

/**
 * Update frame type
 * @param {string|number} frameTypeId - Frame type ID
 * @param {Object} frameTypeData - Frame type data to update
 * @param {string} frameTypeData.frame_type - Frame type (e.g., "Wooden")
 * @returns {Promise<Object>} Response with message
 */
export const updateFrameType = async (frameTypeId, frameTypeData) => {
  const { frame_type } = frameTypeData;
  return apiRequest(`/frame_types/${frameTypeId}`, {
    method: 'PUT',
    body: { frame_type },
    includeAuth: true,
  });
};

/**
 * Delete frame type
 * @param {string|number} frameTypeId - Frame type ID
 * @returns {Promise<Object>} Response with message
 */
export const deleteFrameType = async (frameTypeId) => {
  return apiRequest(`/frame_types/${frameTypeId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== GENDERS ENDPOINTS ====================

/**
 * Get all genders
 * @returns {Promise<Array>} Array of gender objects
 */
export const getGenders = async () => {
  try {
    const response = await apiRequest('/genders', {
      method: 'GET',
      includeAuth: true,
    });
    
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    if (errorMessage.includes('genders not found') ||
        errorMessage.includes('not found') ||
        errorText.includes('genders not found') ||
        errorText.includes('not found') ||
        error.statusCode === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Create gender
 * @param {Object} genderData - Gender data
 * @param {string} genderData.gender_name - Gender name (e.g., "Male", "Female")
 * @returns {Promise<Object>} Created gender object
 */
export const createGender = async (genderData) => {
  const { gender_name } = genderData;
  return apiRequest('/genders', {
    method: 'POST',
    body: { gender_name },
    includeAuth: true,
  });
};

/**
 * Update gender
 * @param {string|number} genderId - Gender ID
 * @param {Object} genderData - Gender data to update
 * @param {string} genderData.gender_name - Gender name (e.g., "Male", "Female")
 * @returns {Promise<Object>} Response with message
 */
export const updateGender = async (genderId, genderData) => {
  const { gender_name } = genderData;
  return apiRequest(`/genders/${genderId}`, {
    method: 'PUT',
    body: { gender_name },
    includeAuth: true,
  });
};

/**
 * Delete gender
 * @param {string|number} genderId - Gender ID
 * @returns {Promise<Object>} Response with message
 */
export const deleteGender = async (genderId) => {
  return apiRequest(`/genders/${genderId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== LENS COLORS ENDPOINTS ====================

/**
 * Get all lens colors
 * @returns {Promise<Array>} Array of lens color objects
 */
export const getLensColors = async () => {
  try {
    const response = await apiRequest('/lens_colors', {
      method: 'GET',
      includeAuth: true,
    });
    
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    if (errorMessage.includes('lens colors not found') ||
        errorMessage.includes('not found') ||
        errorText.includes('lens colors not found') ||
        errorText.includes('not found') ||
        error.statusCode === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Create lens color
 * @param {Object} lensColorData - Lens color data
 * @param {string} lensColorData.lens_color - Lens color (e.g., "#FFFFFF")
 * @returns {Promise<Object>} Created lens color object
 */
export const createLensColor = async (lensColorData) => {
  const { lens_color } = lensColorData;
  return apiRequest('/lens_colors', {
    method: 'POST',
    body: { lens_color },
    includeAuth: true,
  });
};

/**
 * Update lens color
 * @param {string|number} lensColorId - Lens color ID
 * @param {Object} lensColorData - Lens color data to update
 * @param {string} lensColorData.lens_color - Lens color (e.g., "#FFFFFF")
 * @returns {Promise<Object>} Response with message
 */
export const updateLensColor = async (lensColorId, lensColorData) => {
  const { lens_color } = lensColorData;
  return apiRequest(`/lens_colors/${lensColorId}`, {
    method: 'PUT',
    body: { lens_color },
    includeAuth: true,
  });
};

/**
 * Delete lens color
 * @param {string|number} lensColorId - Lens color ID
 * @returns {Promise<Object>} Response with message
 */
export const deleteLensColor = async (lensColorId) => {
  return apiRequest(`/lens_colors/${lensColorId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== LENS MATERIALS ENDPOINTS ====================

/**
 * Get all lens materials
 * @returns {Promise<Array>} Array of lens material objects
 */
export const getLensMaterials = async () => {
  try {
    const response = await apiRequest('/lens_materials', {
      method: 'GET',
      includeAuth: true,
    });
    
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    if (errorMessage.includes('lens materials not found') ||
        errorMessage.includes('not found') ||
        errorText.includes('lens materials not found') ||
        errorText.includes('not found') ||
        error.statusCode === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Create lens material
 * @param {Object} lensMaterialData - Lens material data
 * @param {string} lensMaterialData.lens_material - Lens material (e.g., "Glass", "Plastic")
 * @returns {Promise<Object>} Created lens material object
 */
export const createLensMaterial = async (lensMaterialData) => {
  const { lens_material } = lensMaterialData;
  return apiRequest('/lens_materials', {
    method: 'POST',
    body: { lens_material },
    includeAuth: true,
  });
};

/**
 * Update lens material
 * @param {string|number} lensMaterialId - Lens material ID
 * @param {Object} lensMaterialData - Lens material data to update
 * @param {string} lensMaterialData.lens_material - Lens material (e.g., "Glass", "Plastic")
 * @returns {Promise<Object>} Response with message
 */
export const updateLensMaterial = async (lensMaterialId, lensMaterialData) => {
  const { lens_material } = lensMaterialData;
  return apiRequest(`/lens_materials/${lensMaterialId}`, {
    method: 'PUT',
    body: { lens_material },
    includeAuth: true,
  });
};

/**
 * Delete lens material
 * @param {string|number} lensMaterialId - Lens material ID
 * @returns {Promise<Object>} Response with message
 */
export const deleteLensMaterial = async (lensMaterialId) => {
  return apiRequest(`/lens_materials/${lensMaterialId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== SHAPES ENDPOINTS ====================

/**
 * Get all shapes
 * @returns {Promise<Array>} Array of shape objects
 */
export const getShapes = async () => {
  try {
    const response = await apiRequest('/shapes', {
      method: 'GET',
      includeAuth: true,
    });
    
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    if (errorMessage.includes('shapes not found') ||
        errorMessage.includes('not found') ||
        errorText.includes('shapes not found') ||
        errorText.includes('not found') ||
        error.statusCode === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Create shape
 * @param {Object} shapeData - Shape data
 * @param {string} shapeData.shape_name - Shape name (e.g., "Circle", "Square")
 * @returns {Promise<Object>} Created shape object
 */
export const createShape = async (shapeData) => {
  const { shape_name } = shapeData;
  return apiRequest('/shapes', {
    method: 'POST',
    body: { shape_name },
    includeAuth: true,
  });
};

/**
 * Update shape
 * @param {string|number} shapeId - Shape ID
 * @param {Object} shapeData - Shape data to update
 * @param {string} shapeData.shape_name - Shape name (e.g., "Circle", "Square")
 * @returns {Promise<Object>} Response with message
 */
export const updateShape = async (shapeId, shapeData) => {
  const { shape_name } = shapeData;
  return apiRequest(`/shapes/${shapeId}`, {
    method: 'PUT',
    body: { shape_name },
    includeAuth: true,
  });
};

/**
 * Delete shape
 * @param {string|number} shapeId - Shape ID
 * @returns {Promise<Object>} Response with message
 */
export const deleteShape = async (shapeId) => {
  return apiRequest(`/shapes/${shapeId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== BRANDS ENDPOINTS ====================

/**
 * Get all brands
 * @returns {Promise<Array>} Array of brand objects
 */
export const getBrands = async () => {
  try {
    const response = await apiRequest('/brands', {
      method: 'GET',
      includeAuth: true,
    });
    
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    if (errorMessage.includes('brands not found') ||
        errorMessage.includes('not found') ||
        errorText.includes('brands not found') ||
        errorText.includes('not found') ||
        error.statusCode === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Create brand
 * @param {Object} brandData - Brand data
 * @param {string} brandData.brand_name - Brand name (e.g., "Ray-Ban", "Oakley")
 * @returns {Promise<Object>} Created brand object
 */
export const createBrand = async (brandData) => {
  const { brand_name } = brandData;
  return apiRequest('/brands', {
    method: 'POST',
    body: { brand_name },
    includeAuth: true,
  });
};

/**
 * Update brand
 * @param {string|number} brandId - Brand ID
 * @param {Object} brandData - Brand data to update
 * @param {string} brandData.brand_name - Brand name (e.g., "Ray-Ban", "Oakley")
 * @returns {Promise<Object>} Response with message
 */
export const updateBrand = async (brandId, brandData) => {
  const { brand_name } = brandData;
  return apiRequest(`/brands/${brandId}`, {
    method: 'PUT',
    body: { brand_name },
    includeAuth: true,
  });
};

/**
 * Delete brand
 * @param {string|number} brandId - Brand ID
 * @returns {Promise<Object>} Response with message
 */
export const deleteBrand = async (brandId) => {
  return apiRequest(`/brands/${brandId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== COLLECTIONS ENDPOINTS ====================

/**
 * Get all collections
 * @returns {Promise<Array>} Array of collection objects
 */
export const getCollections = async () => {
  try {
    const response = await apiRequest('/collections', {
      method: 'GET',
      includeAuth: false, // Changed to false so it can be used on public pages like Home
    });
    
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    if (errorMessage.includes('collections not found') ||
        errorMessage.includes('not found') ||
        errorText.includes('collections not found') ||
        errorText.includes('not found') ||
        error.statusCode === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Create collection
 * @param {Object} collectionData - Collection data
 * @param {string} collectionData.collection_name - Collection name (e.g., "Summer Collection")
 * @param {string} collectionData.brand_id - Brand ID (UUID)
 * @returns {Promise<Object>} Created collection object
 */
export const createCollection = async (collectionData) => {
  const { collection_name, brand_id } = collectionData;
  return apiRequest('/collections', {
    method: 'POST',
    body: { collection_name, brand_id },
    includeAuth: true,
  });
};

/**
 * Update collection
 * @param {string|number} collectionId - Collection ID
 * @param {Object} collectionData - Collection data to update
 * @param {string} collectionData.collection_name - Collection name (e.g., "Summer Collection")
 * @param {string} collectionData.brand_id - Brand ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const updateCollection = async (collectionId, collectionData) => {
  const { collection_name, brand_id } = collectionData;
  return apiRequest(`/collections/${collectionId}`, {
    method: 'PUT',
    body: { collection_name, brand_id },
    includeAuth: true,
  });
};

/**
 * Delete collection
 * @param {string|number} collectionId - Collection ID
 * @returns {Promise<Object>} Response with message
 */
export const deleteCollection = async (collectionId) => {
  return apiRequest(`/collections/${collectionId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== PRODUCTS ENDPOINTS ====================

/**
 * Get all products
 * @param {number} [page=1] - Page number (default: 1)
 * @param {number} [limit=21] - Items per page (default: 21)
 * @param {Object} [filters={}] - Filter options
 * @param {number|Array<number>} [filters.gender_id] - Gender ID(s)
 * @param {number|Array<number>} [filters.color_code_id] - Color code ID(s)
 * @param {number|Array<number>} [filters.shape_id] - Shape ID(s)
 * @param {number|Array<number>} [filters.lens_color_id] - Lens color ID(s)
 * @param {number|Array<number>} [filters.frame_color_id] - Frame color ID(s)
 * @param {number|Array<number>} [filters.frame_type_id] - Frame type ID(s)
 * @param {number|Array<number>} [filters.lens_material_id] - Lens material ID(s)
 * @param {number|Array<number>} [filters.frame_material_id] - Frame material ID(s)
 * @param {string|Array<string>} [filters.brand_id] - Brand ID(s)
 * @param {Object} [filters.price] - Price range filter
 * @param {number} [filters.price.min] - Minimum price
 * @param {number} [filters.price.max] - Maximum price
 * @returns {Promise<Array>} Array of product objects
 */
export const getProducts = async (page = 1, limit = 21, filters = {}) => {
  try {
    // Build query string for page and limit (matching Postman: /products/?page=1&limit=21)
    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());
    
    const endpoint = `/products/?${queryParams.toString()}`; // Note: trailing slash as in Postman
    
    // If filters is explicitly null, send all filter fields as null (matching Postman collection)
    // Postman uses GET with body, but browsers can't send body with GET, so apiRequest will convert to POST
    if (filters === null) {
      const filterBody = {
        gender_id: null,
        color_code_id: null,
        shape_id: null,
        lens_color_id: null,
        frame_color_id: null,
        frame_type_id: null,
        lens_material_id: null,
        frame_material_id: null,
        status: null, // Include null status to get all products including drafts
        price: null
      };
      
      // Use GET method (matching Postman), apiRequest will convert to POST since body exists
      const response = await apiRequest(endpoint, {
        method: 'GET',
        body: filterBody,
        includeAuth: true,
      });
      
      if (Array.isArray(response)) {
        return response;
      }
      if (response && Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    }
    
    // Build filter body exactly as shown in Postman collection, but only when filters exist
    const filterBody = {};
    
    // gender_id
    if (filters.gender_id !== undefined && filters.gender_id !== null) {
      filterBody.gender_id = filters.gender_id;
    }
    
    // color_code_id
    if (filters.color_code_id !== undefined && filters.color_code_id !== null) {
      filterBody.color_code_id = filters.color_code_id;
    }
    
    // shape_id
    if (filters.shape_id !== undefined && filters.shape_id !== null) {
      filterBody.shape_id = filters.shape_id;
    }
    
    // lens_color_id
    if (filters.lens_color_id !== undefined && filters.lens_color_id !== null) {
      filterBody.lens_color_id = filters.lens_color_id;
    }
    
    // frame_color_id
    if (filters.frame_color_id !== undefined && filters.frame_color_id !== null) {
      filterBody.frame_color_id = filters.frame_color_id;
    }
    
    // frame_type_id
    if (filters.frame_type_id !== undefined && filters.frame_type_id !== null) {
      filterBody.frame_type_id = filters.frame_type_id;
    }
    
    // lens_material_id
    if (filters.lens_material_id !== undefined && filters.lens_material_id !== null) {
      filterBody.lens_material_id = filters.lens_material_id;
    }
    
    // frame_material_id
    if (filters.frame_material_id !== undefined && filters.frame_material_id !== null) {
      filterBody.frame_material_id = filters.frame_material_id;
    }
    
    // brand_id (optional, but include if provided)
    if (filters.brand_id !== undefined && filters.brand_id !== null) {
      filterBody.brand_id = filters.brand_id;
    }
    
    // status (optional, include if provided to filter by status, or null to get all including drafts)
    if (filters.status !== undefined) {
      filterBody.status = filters.status;
    }
    
    // Always include price filter (backend requires it)
    // If price is not provided, use full range (0-10000) to show all products
    if (filters.price !== undefined && filters.price !== null) {
      filterBody.price = filters.price;
    } else {
      // Default to full range when no price filter is specified
      filterBody.price = { min: 0, max: 10000 };
    }
    
    // Always use POST with body since backend requires price field
    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: filterBody,
      includeAuth: true,
    });
    
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    if (errorMessage.includes('products not found') ||
        errorMessage.includes('not found') ||
        errorText.includes('products not found') ||
        errorText.includes('not found') ||
        error.statusCode === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Create product
 * @param {Object} productData - Product data
 * @param {string} productData.model_no - Model number
 * @param {number} productData.gender_id - Gender ID
 * @param {number} productData.color_code_id - Color code ID
 * @param {number} productData.shape_id - Shape ID
 * @param {number} productData.lens_color_id - Lens color ID
 * @param {number} productData.frame_color_id - Frame color ID
 * @param {number} productData.frame_type_id - Frame type ID
 * @param {number} productData.lens_material_id - Lens material ID
 * @param {number} productData.frame_material_id - Frame material ID
 * @param {number} productData.mrp - Maximum retail price
 * @param {number} productData.whp - Wholesale price
 * @param {string} productData.size_mm - Size in mm
 * @param {string} productData.brand_id - Brand ID (UUID)
 * @param {string} productData.collection_id - Collection ID (UUID)
 * @param {number} productData.warehouse_qty - Warehouse quantity
 * @param {string} productData.status - Product status (e.g., "draft")
 * @returns {Promise<Object>} Created product object
 */
export const createProduct = async (productData) => {
  const {
    model_no,
    gender_id,
    color_code_id,
    shape_id,
    lens_color_id,
    frame_color_id,
    frame_type_id,
    lens_material_id,
    frame_material_id,
    mrp,
    whp,
    size_mm,
    brand_id,
    collection_id,
    warehouse_qty,
    status,
  } = productData;
  
  return apiRequest('/products/create', {
    method: 'POST',
    body: {
      model_no,
      gender_id,
      color_code_id,
      shape_id,
      lens_color_id,
      frame_color_id,
      frame_type_id,
      lens_material_id,
      frame_material_id,
      mrp,
      whp,
      size_mm,
      brand_id,
      collection_id,
      warehouse_qty,
      status,
    },
    includeAuth: true,
  });
};

/**
 * Update product
 * @param {string} productId - Product ID (UUID)
 * @param {Object} productData - Product data to update
 * @param {string} productData.model_no - Model number
 * @param {number} productData.gender_id - Gender ID
 * @param {number} productData.color_code_id - Color code ID
 * @param {number} productData.shape_id - Shape ID
 * @param {number} productData.lens_color_id - Lens color ID
 * @param {number} productData.frame_color_id - Frame color ID
 * @param {number} productData.frame_type_id - Frame type ID
 * @param {number} productData.lens_material_id - Lens material ID
 * @param {number} productData.frame_material_id - Frame material ID
 * @param {number} productData.mrp - Maximum retail price
 * @param {number} productData.whp - Wholesale price
 * @param {string} productData.size_mm - Size in mm
 * @param {string} productData.brand_id - Brand ID (UUID)
 * @param {string} productData.collection_id - Collection ID (UUID)
 * @param {number} productData.warehouse_qty - Warehouse quantity
 * @param {number} [productData.tray_qty] - Tray quantity
 * @param {number} [productData.total_qty] - Total quantity
 * @param {string} productData.status - Product status (e.g., "draft")
 * @returns {Promise<Object>} Response with message
 */
export const updateProduct = async (productId, productData) => {
  const {
    model_no,
    gender_id,
    color_code_id,
    shape_id,
    lens_color_id,
    frame_color_id,
    frame_type_id,
    lens_material_id,
    frame_material_id,
    mrp,
    whp,
    size_mm,
    brand_id,
    collection_id,
    warehouse_qty,
    tray_qty,
    total_qty,
    status,
    image_urls, // Array of image paths
  } = productData;
  
  const body = {
    model_no,
    gender_id,
    color_code_id,
    shape_id,
    lens_color_id,
    frame_color_id,
    frame_type_id,
    lens_material_id,
    frame_material_id,
    mrp,
    whp,
    size_mm,
    brand_id,
    collection_id,
    warehouse_qty,
    tray_qty,
    total_qty,
    status,
  };
  
  // Include image_urls if provided (array of image paths)
  if (image_urls !== undefined) {
    body.image_urls = image_urls;
  }
  
  return apiRequest(`/products/${productId}`, {
    method: 'PUT',
    body,
    includeAuth: true,
  });
};

/**
 * Get product models by model number
 * @param {string} modelNo - Model number (e.g., "PROD003")
 * @returns {Promise<Array>} Array of product model objects
 */
export const getProductModels = async (modelNo) => {
  try {
    const response = await apiRequest('/products/product-models', {
      method: 'POST',
      body: {
        model_no: modelNo,
      },
      includeAuth: true,
    });
    
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    if (errorMessage.includes('not found') ||
        errorText.includes('not found') ||
        error.statusCode === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Delete product
 * @param {string} productId - Product ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteProduct = async (productId) => {
  return apiRequest(`/products/${productId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

/**
 * Upload product image(s) - supports single or multiple images
 * Optionally attach to a specific product by ID
 * @param {File|File[]} productImages - Product image file(s) - can be a single File or array of Files
 * @param {string|number} [productId] - Product identifier to attach the image(s) to
 * @returns {Promise<Object>} Response with image data
 */
export const uploadProductImage = async (productImages, productId) => {
  const baseUrl = getBaseURL();
  const fullUrl = `${baseUrl}/products/image-upload`;
  
  const token = getAuthToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Create FormData
  const formData = new FormData();
  // Attach product reference when provided so backend can link the file
  if (productId) {
    formData.append('product_id', productId);
  }
  
  // Handle both single file and multiple files
  if (Array.isArray(productImages)) {
    // Multiple files - append each one
    productImages.forEach((file) => {
      formData.append('product_image', file);
    });
  } else {
    // Single file
    formData.append('product_image', productImages);
  }
  
  // Make the request
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });
  
  // Use handleResponse which will throw appropriate errors for status codes
  return await handleResponse(response);
};

/**
 * Bulk upload products from Excel file
 * @param {File} file - Excel file (.xlsx) containing product data
 * @returns {Promise<Object>} Response with upload results
 */
export const bulkUploadProducts = async (file) => {
  const baseUrl = getBaseURL();
  const fullUrl = `${baseUrl}/products/bulk-upload`;
  
  const formData = new FormData();
  formData.append('file', file);
  
  const token = getAuthToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // For FormData, don't set Content-Type header (browser will set it with boundary)
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });
  
  return await handleResponse(response);
};

/**
 * Get all uploaded images/files
 * @returns {Promise<Array>} Array of uploaded file objects
 */
export const getAllUploads = async () => {
  try {
    // Try multiple possible endpoints
    const endpoints = [
      '/products/images/all'
    ];
    
    let lastError = null;
    
    for (const endpoint of endpoints) {
      try {
        const response = await apiRequest(endpoint, {
          method: 'GET',
          includeAuth: true,
        });
        
        // Handle different response formats
        let images = [];
        if (Array.isArray(response)) {
          images = response;
        } else if (response && Array.isArray(response.data)) {
          images = response.data;
        } else if (response && Array.isArray(response.images)) {
          images = response.images;
        } else if (response && response.files && Array.isArray(response.files)) {
          images = response.files;
        } else if (response && response.uploads && Array.isArray(response.uploads)) {
          images = response.uploads;
        } else {
          // If we got a response but it's not in expected format, return empty array
          return [];
        }
        
        // Fix image URLs to use the correct base URL
        const fixedImages = images.map(image => {
          const fixedImage = { ...image };
          
          // Fix the main image URL
          if (fixedImage.url && fixedImage.url.startsWith('/uploads/products/')) {
            fixedImage.url = `https://api.stallioneyewear.in${fixedImage.url}`;
          }
          
          // Fix image_url if it exists
          if (fixedImage.image_url && fixedImage.image_url.startsWith('/uploads/products/')) {
            fixedImage.image_url = `https://api.stallioneyewear.in${fixedImage.image_url}`;
          }
          
          // Fix path if it exists and is relative
          if (fixedImage.path && fixedImage.path.startsWith('/uploads/products/')) {
            fixedImage.path = `https://api.stallioneyewear.in${fixedImage.path}`;
          }
          
          return fixedImage;
        });
        
        return fixedImages;
      } catch (error) {
        lastError = error;
        // If it's a 404, try next endpoint
        if (error.statusCode === 404 || 
            error.message?.toLowerCase().includes('not found')) {
          continue;
        }
        // For other errors, throw immediately
        throw error;
      }
    }
    
    // If all endpoints failed with 404, return empty array (no uploads endpoint exists)
    console.warn('Uploads endpoint not found. Tried:', endpoints);
    return [];
  } catch (error) {
    // If it's a 404 or "not found" error, return empty array
    const errorMessage = (error.message || '').toLowerCase();
    if (error.statusCode === 404 || 
        errorMessage.includes('not found')) {
      return [];
    }
    throw error;
  }
};

/**
 * Delete a product image file from the server
 * @param {string} fileName - The filename (e.g. "image-1234567890.jpg")
 * @returns {Promise<Object>} Response with message
 */
export const deleteProductImage = async (fileName) => {
  return apiRequest(`/products/images/${encodeURIComponent(fileName)}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== TRAYS ENDPOINTS ====================

/**
 * Get all trays
 * @returns {Promise<Array>} Array of tray objects
 */
export const getTrays = async () => {
  try {
    const response = await apiRequest('/trays/', {
      method: 'GET',
      includeAuth: true,
    });

    if (Array.isArray(response)) return response;
    if (response && Array.isArray(response.data)) return response.data;
    return [];
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();

    if (
      errorMessage.includes('trays not found') ||
      errorText.includes('trays not found') ||
      error.statusCode === 404
    ) {
      return [];
    }
    throw error;
  }
};

/**
 * Create tray
 * @param {Object} trayData - Tray data
 * @param {string} trayData.tray_name - Tray name
 * @param {string} trayData.tray_status - Tray status (e.g., "draft")
 * @returns {Promise<Object>} Created tray object
 */
export const createTray = async (trayData) => {
  const { tray_name, tray_status } = trayData;
  return apiRequest('/trays/', {
    method: 'POST',
    body: { tray_name, tray_status },
    includeAuth: true,
  });
};

/**
 * Update tray
 * @param {string} trayId - Tray ID (UUID)
 * @param {Object} trayData - Tray data to update
 * @param {string} trayData.tray_name - Tray name
 * @param {string} trayData.tray_status - Tray status
 * @returns {Promise<Object>} Response with message
 */
export const updateTray = async (trayId, trayData) => {
  const { tray_name, tray_status } = trayData;
  return apiRequest(`/trays/${trayId}`, {
    method: 'PUT',
    body: { tray_name, tray_status },
    includeAuth: true,
  });
};

/**
 * Delete tray
 * @param {string} trayId - Tray ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteTray = async (trayId) => {
  return apiRequest(`/trays/${trayId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== TRAY TRANSACTIONS ====================

/**
 * Get trays assigned to a salesman
 * @param {string} salesmanId - Salesman ID (UUID)
 * @returns {Promise<Array>} Assigned tray records
 */
export const getAssignedTrays = async (salesmanId) => {
  return apiRequest('/salesman_trays/', {
    method: 'POST',
    body: { salesman_id: salesmanId },
    includeAuth: true,
  });
};

/**
 * Assign tray to salesman
 * @param {Object} assignmentData - Assignment data
 * @param {string} assignmentData.salesman_id - Salesman ID (UUID)
 * @param {string} assignmentData.tray_id - Tray ID (UUID)
 * @returns {Promise<Object>} Assignment record
 */
export const assignSalesmanTray = async (assignmentData) => {
  const { salesman_id, tray_id } = assignmentData;
  return apiRequest('/salesman_trays/assign', {
    method: 'POST',
    body: { salesman_id, tray_id },
    includeAuth: true,
  });
};

/**
 * Unassign tray from salesman
 * @param {string} assignmentId - Salesman tray assignment ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const unassignSalesmanTray = async (assignmentId) => {
  return apiRequest(`/salesman_trays/${assignmentId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

/**
 * Get products in a tray
 * @param {string} trayId - Tray ID (UUID)
 * @returns {Promise<Array>} Tray product records
 */
export const getProductsInTray = async (trayId) => {
  return apiRequest(`/tray_products/${trayId}`, {
    method: 'GET',
    includeAuth: true,
  });
};

/**
 * Add product to tray
 * @param {Object} trayProductData - Tray product data
 * @param {string} trayProductData.tray_id - Tray ID (UUID)
 * @param {string} trayProductData.product_id - Product ID (UUID)
 * @param {number} [trayProductData.qty] - Quantity (optional, defaults to 1)
 * @param {string} trayProductData.status - Status (e.g., "alloted")
 * @returns {Promise<Object>} Created tray product record
 */
export const addProductToTray = async (trayProductData) => {
  const { tray_id, product_id, qty, status } = trayProductData;
  const body = { tray_id, product_id, status };
  if (qty !== undefined) {
    body.qty = qty;
  }
  return apiRequest('/tray_products/', {
    method: 'POST',
    body,
    includeAuth: true,
  });
};

/**
 * Update product in tray
 * @param {Object} trayProductData - Updated tray product data
 * @param {string} trayProductData.tray_id - Tray ID (UUID)
 * @param {string} trayProductData.product_id - Product ID (UUID)
 * @param {number} [trayProductData.qty] - Quantity (optional)
 * @param {string} trayProductData.status - Status
 * @returns {Promise<Object>} Response with message
 */
export const updateProductInTray = async (trayProductData) => {
  const { tray_id, product_id, qty, status } = trayProductData;
  const body = { tray_id, product_id, status };
  if (qty !== undefined) {
    body.qty = qty;
  }
  return apiRequest('/tray_products', {
    method: 'PUT',
    body,
    includeAuth: true,
  });
};

/**
 * Delete product from tray
 * @param {Object} trayProductData - Tray product data
 * @param {string} trayProductData.tray_id - Tray ID (UUID)
 * @param {string} trayProductData.product_id - Product ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteProductFromTray = async (trayProductData) => {
  const { tray_id, product_id } = trayProductData;
  return apiRequest('/tray_products/', {
    method: 'DELETE',
    body: { tray_id, product_id },
    includeAuth: true,
  });
};

// ==================== EVENT ENDPOINTS ====================

/**
 * Get all events
 * @returns {Promise<Array>} Array of event objects
 */
export const getEvents = async () => {
  return apiRequest('/events/', {
    method: 'GET',
    includeAuth: true,
  });
};

/**
 * Create a new event
 * @param {Object} eventData - Event data
 * @param {string} eventData.event_name - Event name
 * @param {string} eventData.start_date - Event start date (ISO string)
 * @param {string} eventData.end_date - Event end date (ISO string)
 * @param {string} eventData.event_location - Event location
 * @returns {Promise<Object>} Created event object
 */
export const createEvent = async (eventData) => {
  const { event_name, start_date, end_date, event_location } = eventData;
  return apiRequest('/events/', {
    method: 'POST',
    body: { event_name, start_date, end_date, event_location },
    includeAuth: true,
  });
};

/**
 * Update an event
 * @param {string} eventId - Event ID (UUID)
 * @param {Object} eventData - Updated event data
 * @param {string} eventData.event_name - Event name
 * @param {string} eventData.start_date - Event start date (ISO string)
 * @param {string} eventData.end_date - Event end date (ISO string)
 * @param {string} eventData.event_location - Event location
 * @returns {Promise<Object>} Response with message
 */
export const updateEvent = async (eventId, eventData) => {
  const { event_name, start_date, end_date, event_location } = eventData;
  return apiRequest(`/events/${eventId}`, {
    method: 'PUT',
    body: { event_name, start_date, end_date, event_location },
    includeAuth: true,
  });
};

/**
 * Delete an event
 * @param {string} eventId - Event ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteEvent = async (eventId) => {
  return apiRequest(`/events/${eventId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

// ==================== ORDER ENDPOINTS ====================

/**
 * Get all orders
 * @returns {Promise<Array>} Array of order objects
 */
export const getOrders = async () => {
  try {
    return await apiRequest('/orders/', {
      method: 'GET',
      includeAuth: true,
    });
  } catch (error) {
    // Handle "Orders not found" as a valid case (empty orders)
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();
    
    // Check multiple variations of "not found" messages
    if (errorMessage.includes('orders not found') ||
        errorMessage.includes('no orders found') ||
        errorMessage.includes('order not found') ||
        errorText.includes('orders not found') ||
        errorText.includes('no orders found') ||
        errorText.includes('order not found') ||
        error.statusCode === 404) {
      // Return empty array for "not found" cases - this is a valid state
      console.log('[getOrders] No orders found, returning empty array');
      return [];
    }
    // Re-throw other errors
    throw error;
  }
};

/**
 * Create a new order
 * @param {Object} orderData - Order data
 * @param {string} orderData.order_date - Order date (ISO string)
 * @param {string} orderData.order_type - Order type (e.g., "event_order", "party_order", "distributor_order", "visit_order", "whatsapp_order")
 * @param {string} [orderData.party_id] - Party ID (UUID) - required for event_order, party_order, visit_order, whatsapp_order
 * @param {string} [orderData.distributor_id] - Distributor ID (UUID) - required for event_order, party_order, distributor_order, visit_order, whatsapp_order
 * @param {string} [orderData.zone_id] - Zone ID (UUID) - required for event_order, party_order, visit_order, whatsapp_order
 * @param {string} [orderData.salesman_id] - Salesman ID (UUID) - required for event_order, visit_order, whatsapp_order
 * @param {string} [orderData.event_id] - Event ID (UUID) - required for event_order
 * @param {string} [orderData.user_id] - User ID (UUID) - logged-in person's ID
 * @param {Array<Object>} orderData.order_items - Array of order items
 * @param {string} orderData.order_items[].product_id - Product ID (UUID)
 * @param {number} orderData.order_items[].quantity - Quantity
 * @param {number} orderData.order_items[].price - Price per unit
 * @param {string} [orderData.order_notes] - Order notes
 * @param {number} [orderData.latitude] - Latitude - required for visit_order
 * @param {number} [orderData.longitude] - Longitude - required for visit_order
 * @returns {Promise<Object>} Created order object
 */
export const createOrder = async (orderData) => {
  const {
    order_date,
    order_type,
    party_id,
    distributor_id,
    zone_id,
    salesman_id,
    event_id,
    user_id,
    order_items,
    order_notes,
    latitude,
    longitude,
  } = orderData;

  const body = {
    order_date,
    order_type,
    order_items,
  };

  if (party_id) body.party_id = party_id;
  if (distributor_id) body.distributor_id = distributor_id;
  if (zone_id) body.zone_id = zone_id;
  
  // Include salesman_id (required for visit_order, whatsapp_order, event_order)
  if (order_type === 'visit_order' || order_type === 'whatsapp_order' || order_type === 'event_order') {
    if (salesman_id !== undefined && salesman_id !== null && salesman_id !== '') {
      body.salesman_id = salesman_id;
      console.log('[createOrder] ✅ Salesman ID included for', order_type, ':', salesman_id);
    } else {
      console.warn('[createOrder] ⚠️', order_type, 'but salesman_id is missing - API will run, backend will validate');
      // Don't throw error - let API call proceed, backend will return proper error message
      // This allows us to see the actual API response
    }
  } else if (salesman_id !== undefined && salesman_id !== null && salesman_id !== '') {
    // Include salesman_id for other order types if provided (optional)
    body.salesman_id = salesman_id;
    console.log('[createOrder] Salesman ID included (optional):', salesman_id);
  }
  
  // Include event_id for event_order type (required)
  if (order_type === 'event_order') {
    if (event_id !== undefined && event_id !== null && event_id !== '') {
      body.event_id = event_id;
      console.log('[createOrder] ✅ Event ID included for event_order:', event_id);
    } else {
      console.warn('[createOrder] ⚠️ Event order but event_id is missing - API will run, backend will validate');
      // Don't throw error - let API call proceed, backend will return proper error message
    }
  } else if (event_id) {
    // Include event_id for other order types if provided (optional)
    body.event_id = event_id;
    console.log('[createOrder] Event ID included (optional):', event_id);
  }
  
  if (user_id) body.user_id = user_id;
  if (order_notes) body.order_notes = order_notes;
  
  // Include latitude and longitude for visit orders
  if (latitude !== undefined && latitude !== null) {
    body.latitude = Number(latitude);
  }
  if (longitude !== undefined && longitude !== null) {
    body.longitude = Number(longitude);
  }

  console.log('[createOrder] Request body:', JSON.stringify(body, null, 2));
  console.log('[createOrder] 🚀 Making API request to /orders/...');

  return apiRequest('/orders/', {
    method: 'POST',
    body,
    includeAuth: true,
  });
};

/**
 * Update order status
 * @param {string} orderId - Order ID (UUID)
 * @param {Object} orderStatusData - Order status update data
 * @param {string} orderStatusData.order_status - Order status (e.g., "processed", "cancelled", "dispatched", "partially_dispatched", "hold_by_tray", "completed")
 * @param {string} [orderStatusData.courier_name] - Courier name - required if order_status is "dispatched" or "partially_dispatched"
 * @param {string} [orderStatusData.courier_tracking_number] - Courier tracking number - required if order_status is "dispatched" or "partially_dispatched"
 * @param {number} [orderStatusData.partial_dispatch_qty] - Partial dispatch quantity - required if order_status is "partially_dispatched"
 * @returns {Promise<Object>} Updated order object
 */
export const updateOrderStatus = async (orderId, orderStatusData) => {
  const { order_status, courier_name, courier_tracking_number, partial_dispatch_qty } = orderStatusData;

  const body = { order_status };

  if (courier_name) body.courier_name = courier_name;
  if (courier_tracking_number) body.courier_tracking_number = courier_tracking_number;
  if (partial_dispatch_qty !== undefined) body.partial_dispatch_qty = partial_dispatch_qty;

  return apiRequest(`/orders/${orderId}`, {
    method: 'PUT',
    body,
    includeAuth: true,
  });
};

/**
 * Delete an order
 * @param {string} orderId - Order ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteOrder = async (orderId) => {
  return apiRequest(`/orders/${orderId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
};

/**
 * Get featured products
 * @param {string} [collectionId="all"] - Collection ID (UUID) or "all" to get all featured products
 * @returns {Promise<Array>} Array of featured product objects
 */
export const getFeaturedProducts = async (collectionId = "all") => {
  return apiRequest('/products/featured', {
    method: 'POST',
    body: {
      collection_id: collectionId,
    },
    includeAuth: false,
  });
};