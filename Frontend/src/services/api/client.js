
/**
 * API Service
 * Centralized API service for all backend endpoints
 */

import { logout } from '../authService';
import { showError } from '../notificationService';

// Cache TTLs (ms). Lookup data rarely changes; transactional data is shorter.
const TTL_LOOKUP = 10 * 60 * 1000; // 10 min - countries, roles, brands, attributes
const TTL_PRODUCTS = 3 * 60 * 1000; // 3 min - product catalog
const TTL_TRANSACTIONAL = 60 * 1000; // 1 min - orders, events

// Verbose request logging is opt-in. Set NEXT_PUBLIC_API_DEBUG=true to enable.
const API_DEBUG = process.env.NEXT_PUBLIC_API_DEBUG === 'true';

/**
 * Get Base URL from environment variable
 * Falls back to default if not set
 * Always uses live API URL directly
 */
const getBaseURL = () => {
  // The browser always calls THIS app's own origin at /api; Next forwards it to
  // the real API server-side (see rewrites in next.config, target =
  // NEXT_PUBLIC_API_URL). Same-origin from the browser's view, so there is NO
  // CORS and NO OPTIONS preflight at all. The only server requirement is that the
  // API accepts the app server's IP (Imunify360 whitelist) — no per-browser CORS.
  return '/api';
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
  // Always advertise JSON in Accept: the openresty layer in front of the API
  // returns 415 for any request whose Accept is */* (fetch's default), so this
  // header is REQUIRED on every request. Content-Type is NOT set here — apiRequest
  // adds it only when a JSON body is sent (a Content-Type on a bodyless GET/DELETE
  // also triggers the 415).
  const headers = { Accept: 'application/json' };

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
        }, 100); // Small delay to ensure notification is visible
      } else {
        // Reset flag if already on login page
        setTimeout(() => {
          isRedirecting = false;
          window.__hasShownLogoutNotification = false;
        }, 500);
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
  // `silent` suppresses the error console.log for expected failures (e.g. the
  // states->cities->zones walk where many "not found" 404s are normal).
  const { method = 'GET', body = null, includeAuth = true, silent = false } = options;

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
        }, 100);
      }
      
      setTimeout(() => {
        isRedirecting = false;
        window.__hasShownLogoutNotification = false;
      }, 500);
      
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
  
  if (API_DEBUG) {
    console.log(`[API Request] ${actualMethod} ${fullUrl}`);
    console.log(`[API Base URL] ${baseUrl}`);
  }

  const config = {
    method: actualMethod,
    headers: getHeaders(includeAuth),
    credentials: 'omit', // Bearer-token auth (no cookies) — sending credentials forbids a wildcard CORS origin and gets the request blocked by the browser
  };

  // Add body for POST/PUT/PATCH requests
  // DELETE requests should not have a body (or should have undefined body)
  if (actualMethod !== 'GET' && actualMethod !== 'DELETE') {
    if (requestBody === null) {
      // For POST/PUT/PATCH, if body is explicitly null, don't send body
      // Don't add body to config
      if (API_DEBUG) console.log(`[API Request Body]`, null);
    } else if (requestBody) {
      // Clean the body - remove any undefined values and ensure proper JSON
      const cleanBody = JSON.parse(JSON.stringify(requestBody)); // This removes undefined and ensures valid JSON
      config.body = JSON.stringify(cleanBody);
      config.headers['Content-Type'] = 'application/json';
      if (API_DEBUG) console.log(`[API Request Body]`, cleanBody);
    }
    // If requestBody is undefined, don't add body
  } else if (actualMethod === 'DELETE') {
    // DELETE requests should not have a body
    // Don't add body to config at all
    if (API_DEBUG) console.log(`[API Request] DELETE request - no body sent`);
  }

  try {
    const response = await fetch(fullUrl, config);
    return await handleResponse(response);
  } catch (error) {
    if (!silent) console.error(`API Error [${method} ${fullUrl}]:`, error);
    throw error;
  }
};


// ---- List pagination compatibility ----
// Several backend list endpoints now REQUIRE page & limit (they 400 without
// them) and respond { data, pagination }. Dashboards/dropdowns/client-side
// tables need the FULL list, so these getters make a SINGLE request with a large
// limit and return the unwrapped array (no per-page looping). Tables that want
// true 20/page server pagination pass their own page/limit and read .pagination.
const PAGE_SIZE = 20;        // strict server page size for true server-paginated tables
const LIST_LIMIT = 1000;     // single-call "load all" size for client-side lists/dropdowns

/** Normalize an array | { data, pagination } response to its array. */
const unwrapList = (res) =>
  Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);

/** Append page/limit query params (the backend now requires them). */
const withListPaging = (endpoint, { page = 1, limit = LIST_LIMIT } = {}) => {
  const sep = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${sep}page=${page}&limit=${limit}`;
};

/**
 * Single request that loads a full list (page 1, large limit) and returns the
 * unwrapped array — one network call, no looping. Used by dropdowns/dashboards
 * that need the whole list.
 * @param {string} endpoint
 * @param {Object} [opts] - apiRequest options (method/body/includeAuth/silent)
 */
const fetchAllPages = async (endpoint, opts = {}) => {
  const res = await apiRequest(withListPaging(endpoint), opts);
  return unwrapList(res);
};

/**
 * Fetch ONE server page (default 20) and return { data, pagination } — the
 * Products-style server-pagination contract for list TABLES.
 * @param {string} endpoint
 * @param {{page?:number, limit?:number, search?:string}} [paging]
 * @param {Object} [opts] - apiRequest options (method/body/includeAuth/silent)
 */
const fetchPage = async (endpoint, { page = 1, limit = PAGE_SIZE, search = '' } = {}, opts = {}) => {
  let ep = withListPaging(endpoint, { page, limit });
  const term = String(search || '').trim();
  if (term) ep += `&search=${encodeURIComponent(term)}`;
  const res = await apiRequest(ep, opts);
  return { data: unwrapList(res), pagination: (res && res.pagination) || null };
};

export {
  getBaseURL,
  getAuthToken,
  getHeaders,
  handleResponse,
  apiRequest,
  API_DEBUG,
  TTL_LOOKUP,
  TTL_PRODUCTS,
  TTL_TRANSACTIONAL,
  PAGE_SIZE,
  LIST_LIMIT,
  unwrapList,
  withListPaging,
  fetchAllPages,
  fetchPage,
};
