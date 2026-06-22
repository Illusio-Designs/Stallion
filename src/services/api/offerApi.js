import { apiRequest } from './client';
import { invalidateCache } from '../cacheService';

// ==================== OFFERS ENDPOINTS ====================
// Standalone, admin-managed discounts (see docs/offers-and-discounts-design.md).
// Admin manages offers; salesman/distributor/party select one in the cart.

/** Admin: full offer list (management). */
export const getOffers = async () => {
  return apiRequest('/offers', { method: 'GET', includeAuth: true });
};

/** Admin: create an offer. config shape depends on offer_type (flat|product|bogo). */
export const createOffer = async (offer) => {
  const result = await apiRequest('/offers', {
    method: 'POST',
    body: offer,
    includeAuth: true,
  });
  invalidateCache('offers');
  return result;
};

/** Admin: update an offer. */
export const updateOffer = async (offerId, offer) => {
  const result = await apiRequest(`/offers/${offerId}`, {
    method: 'PUT',
    body: offer,
    includeAuth: true,
  });
  invalidateCache('offers');
  return result;
};

/** Admin: delete an offer. */
export const deleteOffer = async (offerId) => {
  const result = await apiRequest(`/offers/${offerId}`, {
    method: 'DELETE',
    includeAuth: true,
  });
  invalidateCache('offers');
  return result;
};

/**
 * Offers available for the current cart, each with the discount computed for it.
 * @param {Array<{product_id:string, quantity:number}>} orderItems
 * @returns {Promise<Array<{offer_id, title, offer_type, discount_amount}>>}
 */
export const getAvailableOffers = async (orderItems) => {
  return apiRequest('/offers/available', {
    method: 'POST',
    body: { order_items: orderItems },
    includeAuth: true,
  });
};

/**
 * Price preview for a cart with an optional selected offer (no order created).
 * @returns {Promise<{subtotal, discount_total, order_total, applied_offer, lines}>}
 */
export const quoteOrder = async (orderItems, offerId = null) => {
  return apiRequest('/orders/quote', {
    method: 'POST',
    body: { order_items: orderItems, offer_id: offerId || undefined },
    includeAuth: true,
  });
};
