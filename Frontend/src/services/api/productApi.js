import { getCached, invalidateCache } from '../cacheService';
import { TTL_PRODUCTS, apiRequest, getAuthToken, getBaseURL, handleResponse } from './client';

// ==================== PRODUCTS ENDPOINTS ====================

/**
 * Normalize a products API response into { data, pagination }.
 * Supports legacy plain-array responses and paginated { data, pagination } payloads.
 */
export const parseProductsResponse = (response) => {
  if (Array.isArray(response)) {
    return { data: response, pagination: null };
  }
  if (response && Array.isArray(response.data)) {
    return {
      data: response.data,
      pagination: response.pagination ?? null,
    };
  }
  return { data: [], pagination: null };
};

/**
 * Get all products
 * @param {number} [page=1] - Page number (default: 1)
 * @param {number} [limit=20] - Items per page (default: 20)
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
const fetchProductsUncached = async (page = 1, limit = 20, filters = {}) => {
  try {
    // Build query string for page and limit (matching Postman: /products/?page=1&limit=20)
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

      const response = await apiRequest(endpoint, {
        method: 'POST',
        body: filterBody,
        includeAuth: true,
      });

      return parseProductsResponse(response);
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

    return parseProductsResponse(response);
  } catch (error) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorText = (error.errorData?.error || error.errorData?.message || '').toLowerCase();

    if (errorMessage.includes('products not found') ||
      errorMessage.includes('not found') ||
      errorText.includes('products not found') ||
      errorText.includes('not found') ||
      error.statusCode === 404) {
      return { data: [], pagination: null };
    }
    throw error;
  }
};

/**
 * Get products (cached).
 *
 * The dashboard/catalog pages request a large page (the whole catalog) so they
 * can filter/search client-side. Without caching this heavy call ran on every
 * page mount and every full reload. Results are cached per page/limit/filters
 * for a few minutes (in-memory + sessionStorage), so navigating between tabs or
 * reloading reuses the data instead of re-fetching. The cache is invalidated
 * automatically whenever a product is created, updated, or deleted.
 *
 * @param {number} [page=1] - Page number
 * @param {number} [limit=20] - Items per page
 * @param {Object|null} [filters={}] - Filter object (null = all products)
 * @returns {Promise<{ data: Array, pagination: Object|null }>}
 */
export const getProducts = async (page = 1, limit = 20, filters = {}) => {
  const key = `products:${page}:${limit}:${JSON.stringify(filters ?? null)}`;
  return getCached(key, () => fetchProductsUncached(page, limit, filters), TTL_PRODUCTS);
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

  const result = await apiRequest('/products/create', {
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
  invalidateCache('products:'); // Catalog changed - drop cached product lists
  return result;
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

  const result = await apiRequest(`/products/${productId}`, {
    method: 'PUT',
    body,
    includeAuth: true,
  });
  invalidateCache('products:'); // Catalog changed - drop cached product lists
  return result;
};

/**
 * Get product models by model number
 * @param {string} modelNo - Model number (e.g., "PROD003")
 * @returns {Promise<Array>} Array of product model objects
 */
export const getProductById = async (productId) => {
  // The backend has no GET /products/:id route. Resolve a product by querying the
  // real list endpoint (POST /products) and matching product_id client-side.
  // This is a legacy fallback — the primary product flow is model_no based.
  if (!productId) return null;
  const resp = await apiRequest('/products?page=1&limit=1000', {
    method: 'POST',
    body: {},
    includeAuth: true,
  });
  const list = Array.isArray(resp) ? resp : (resp?.data || []);
  return list.find((p) => String(p.product_id ?? p.id) === String(productId)) || null;
};

export const getProductModels = async (modelNo) => {
  try {
    const response = await apiRequest('/products/product-models', {
      method: 'POST',
      // Backend expects `model_no` (exact match); sending `search` left it
      // undefined -> 400 "Model number is required".
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
  const result = await apiRequest(`/products/${productId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
  invalidateCache('products:'); // Catalog changed - drop cached product lists
  return result;
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
  const headers = { Accept: 'application/json' };
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
      formData.append('file', file);
    });
  } else {
    // Single file
    formData.append('file', productImages);
  }

  // Make the request
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers,
    credentials: 'omit',
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
  const headers = { Accept: 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // For FormData, don't set Content-Type header (browser will set it with boundary)
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers,
    credentials: 'omit',
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

