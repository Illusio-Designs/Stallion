import { apiRequest } from './client';

// ==================== NOTIFICATIONS ====================

/**
 * GET /notifications?unread=true|false
 * @param {{unread?: boolean}} [opts]
 * @returns {Promise<{data: Array, unread_count: number}>}
 */
export const getNotifications = async ({ unread = false } = {}) => {
  const result = await apiRequest(`/notifications${unread ? '?unread=true' : ''}`, {
    method: 'GET',
    includeAuth: true,
    silent: true,
  });
  const data = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : []);
  const count = Number(result?.unread_count);
  return {
    data,
    unread_count: Number.isFinite(count) ? count : data.filter((n) => !n.read_at).length,
  };
};

/**
 * POST /notifications/read  { ids?: [...], all?: true }
 */
export const markNotificationsRead = async ({ ids, all } = {}) => {
  const body = all ? { all: true } : { ids: Array.isArray(ids) ? ids : [] };
  return apiRequest('/notifications/read', {
    method: 'POST',
    body,
    includeAuth: true,
  });
};
