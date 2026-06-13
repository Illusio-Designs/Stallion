import { apiRequest, getBaseURL, getAuthToken, handleResponse, TTL_LOOKUP } from './client';
import { getCached } from '../cacheService';
import { sendOTP } from '../msg91Service';

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
  return getCached('roles', () => apiRequest('/roles', {
    method: 'GET',
    includeAuth: true,
  }), TTL_LOOKUP);
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
      credentials: 'omit',
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
    credentials: 'omit',
    body: formData,
  });
  
  return await handleResponse(response);
};

