import { apiRequest, API_DEBUG, TTL_TRANSACTIONAL } from './client';
import { getCached, invalidateCache } from '../cacheService';

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
  return getCached('events', () => apiRequest('/events/', {
    method: 'GET',
    includeAuth: true,
  }), TTL_TRANSACTIONAL);
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
  const result = await apiRequest('/events/', {
    method: 'POST',
    body: { event_name, start_date, end_date, event_location },
    includeAuth: true,
  });
  invalidateCache('events');
  return result;
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
  const result = await apiRequest(`/events/${eventId}`, {
    method: 'PUT',
    body: { event_name, start_date, end_date, event_location },
    includeAuth: true,
  });
  invalidateCache('events');
  return result;
};

/**
 * Delete an event
 * @param {string} eventId - Event ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteEvent = async (eventId) => {
  const result = await apiRequest(`/events/${eventId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
  invalidateCache('events');
  return result;
};

// ==================== ORDER ENDPOINTS ====================

/**
 * Get all orders
 * @returns {Promise<Array>} Array of order objects
 */
export const getOrders = async () => getCached('orders', async () => {
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
      if (API_DEBUG) console.log('[getOrders] No orders found, returning empty array');
      return [];
    }
    // Re-throw other errors
    throw error;
  }
}, TTL_TRANSACTIONAL);

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

  if (API_DEBUG) {
    console.log('[createOrder] Request body:', JSON.stringify(body, null, 2));
    console.log('[createOrder] 🚀 Making API request to /orders/...');
  }

  const result = await apiRequest('/orders/', {
    method: 'POST',
    body,
    includeAuth: true,
  });
  invalidateCache('orders'); // New order - drop cached order list
  return result;
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

  const result = await apiRequest(`/orders/${orderId}`, {
    method: 'PUT',
    body,
    includeAuth: true,
  });
  invalidateCache('orders'); // Status changed - drop cached order list
  return result;
};

/**
 * Delete an order
 * @param {string} orderId - Order ID (UUID)
 * @returns {Promise<Object>} Response with message
 */
export const deleteOrder = async (orderId) => {
  const result = await apiRequest(`/orders/${orderId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
  invalidateCache('orders'); // Order removed - drop cached order list
  return result;
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


