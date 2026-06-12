import { apiRequest, TTL_LOOKUP } from './client';
import { getCached, invalidateCache } from '../cacheService';

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
export const getBrands = async () => getCached('brands', async () => {
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
}, TTL_LOOKUP);

/**
 * Create brand
 * @param {Object} brandData - Brand data
 * @param {string} brandData.brand_name - Brand name (e.g., "Ray-Ban", "Oakley")
 * @returns {Promise<Object>} Created brand object
 */
export const createBrand = async (brandData) => {
  const { brand_name } = brandData;
  const result = await apiRequest('/brands', {
    method: 'POST',
    body: { brand_name },
    includeAuth: true,
  });
  invalidateCache('brands');
  return result;
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
  const result = await apiRequest(`/brands/${brandId}`, {
    method: 'PUT',
    body: { brand_name },
    includeAuth: true,
  });
  invalidateCache('brands');
  return result;
};

/**
 * Delete brand
 * @param {string|number} brandId - Brand ID
 * @returns {Promise<Object>} Response with message
 */
export const deleteBrand = async (brandId) => {
  const result = await apiRequest(`/brands/${brandId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
  invalidateCache('brands');
  return result;
};

// ==================== COLLECTIONS ENDPOINTS ====================

/**
 * Get all collections
 * @returns {Promise<Array>} Array of collection objects
 */
export const getCollections = async () => getCached('collections', async () => {
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
}, TTL_LOOKUP);

/**
 * Create collection
 * @param {Object} collectionData - Collection data
 * @param {string} collectionData.collection_name - Collection name (e.g., "Summer Collection")
 * @param {string} collectionData.brand_id - Brand ID (UUID)
 * @returns {Promise<Object>} Created collection object
 */
export const createCollection = async (collectionData) => {
  const { collection_name, brand_id } = collectionData;
  const result = await apiRequest('/collections', {
    method: 'POST',
    body: { collection_name, brand_id },
    includeAuth: true,
  });
  invalidateCache('collections');
  return result;
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
  const result = await apiRequest(`/collections/${collectionId}`, {
    method: 'PUT',
    body: { collection_name, brand_id },
    includeAuth: true,
  });
  invalidateCache('collections');
  return result;
};

/**
 * Delete collection
 * @param {string|number} collectionId - Collection ID
 * @returns {Promise<Object>} Response with message
 */
export const deleteCollection = async (collectionId) => {
  const result = await apiRequest(`/collections/${collectionId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
  invalidateCache('collections');
  return result;
};

