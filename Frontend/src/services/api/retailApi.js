import { apiRequest } from './client';

// ==================== RETAIL (B2C STORE) ENDPOINTS ====================
// Contract: Backendjs/lib/retail/API_CONTRACT.md. Success answers are { success, data, pagination? }.
// Lists with filters build the query string by hand: apiRequest turns a GET body containing "/products"
// into a POST, so no GET here passes a body.

const ADMIN = '/retail/admin';

/** Query string from an object; empty, null and undefined values are left out. */
const qs = (params = {}) => {
  const parts = [];
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || String(v).trim() === '') return;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
};

const get = (path, params) => apiRequest(`${path}${qs(params)}`, { method: 'GET', includeAuth: true });
const send = (method, path, body) => apiRequest(path, { method, body, includeAuth: true });

/** The data of an answer: { data } -> data, a bare value stays as it is. */
export const retailData = (res) => (res && typeof res === 'object' && !Array.isArray(res) && 'data' in res ? res.data : res);
/** A list answer: rows and pagination. */
export const retailList = (res) => ({
  rows: Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []),
  pagination: (res && res.pagination) || null,
});

// ---- Access ----
/** GET /api/retail/access -> { wholesale, retail } for the signed-in person. */
export const getRetailAccess = () => apiRequest('/retail/access', { method: 'GET', includeAuth: true, silent: true });

// ---- Settings (store, banner, usps, shipping, tracking, store_enabled) ----
export const getRetailSettings = () => get(`${ADMIN}/settings`);
/** Partial update: { key: value, ... }. Secrets are write-only and come back masked. */
export const updateRetailSettings = (values) => send('PUT', `${ADMIN}/settings`, values);

// ---- Frames on the store ----
/** Copies / refreshes frames from the Stallion catalogue. -> { created, updated, skipped } */
export const syncRetailProducts = () => send('POST', `${ADMIN}/sync`, {});
export const getRetailProducts = ({ search, shown, page = 1, limit = 20 } = {}) => get(`${ADMIN}/products`, { search, shown, page, limit });
export const updateRetailProduct = (id, body) => send('PUT', `${ADMIN}/products/${encodeURIComponent(id)}`, body);
export const bulkRetailProducts = (ids, showOnStore) => send('POST', `${ADMIN}/products/bulk`, { ids, show_on_store: !!showOnStore });

// ---- Blog ----
export const getRetailPosts = ({ status, search, page = 1, limit = 20 } = {}) => get(`${ADMIN}/posts`, { status, search, page, limit });
export const createRetailPost = (body) => send('POST', `${ADMIN}/posts`, body);
/** Also used for the status (draft | published | archived). Nothing is deleted. */
export const updateRetailPost = (id, body) => send('PUT', `${ADMIN}/posts/${encodeURIComponent(id)}`, body);

// ---- FAQs and content pages (about, privacy, terms, returns, shipping) ----
export const getRetailFaqs = () => get(`${ADMIN}/faqs`);
export const createRetailFaq = (body) => send('POST', `${ADMIN}/faqs`, body);
export const updateRetailFaq = (id, body) => send('PUT', `${ADMIN}/faqs/${encodeURIComponent(id)}`, body);
export const getRetailContent = (key) => get(`${ADMIN}/content/${encodeURIComponent(key)}`);
export const updateRetailContent = (key, body) => send('PUT', `${ADMIN}/content/${encodeURIComponent(key)}`, body);

// ---- SEO rows per path ----
export const getRetailPages = () => get(`${ADMIN}/pages`);
/** One row: { path, title, description, og_image, canonical, noindex } (created when the path is new). */
export const updateRetailPage = (row) => send('PUT', `${ADMIN}/pages`, row);

// ---- Online orders ----
export const getRetailOrders = ({ status, q, from, to, page = 1, limit = 20 } = {}) => get(`${ADMIN}/orders`, { status, q, from, to, page, limit });
export const getRetailOrder = (id) => get(`${ADMIN}/orders/${encodeURIComponent(id)}`);
export const updateRetailOrderStatus = (id, { status, note }) => send('PUT', `${ADMIN}/orders/${encodeURIComponent(id)}/status`, { status, note: note || undefined });
export const updateRetailOrderShipping = (id, { courier, awb, tracking_url }) => send('PUT', `${ADMIN}/orders/${encodeURIComponent(id)}/shipping`, { courier, awb, tracking_url });
export const getRetailOrderSummary = () => get(`${ADMIN}/orders/summary`);

// ---- Analytics and contact messages ----
export const getRetailAnalytics = (days = 30) => get(`${ADMIN}/analytics/summary`, { days });
export const getRetailMessages = ({ page = 1, limit = 20 } = {}) => get(`${ADMIN}/messages`, { page, limit });
export const markRetailMessageHandled = (id) => send('PUT', `${ADMIN}/messages/${encodeURIComponent(id)}`, { handled: true });
