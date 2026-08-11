import { apiRequest } from './client';

// The exact phrase the backend requires to arm the wipe. Kept here so the UI
// and the request stay in lock-step.
export const WIPE_CONFIRM_PHRASE = 'WIPE ALL DATA';

/**
 * DESTRUCTIVE: wipe all test/transactional data + related upload files in one
 * go. Admin-only on the backend, and requires the exact confirmation phrase.
 * @returns {Promise<Object>} { success, message, rowsDeleted, filesDeleted }
 */
export const wipeAllData = async () => {
  return apiRequest('/admin/wipe-data', {
    method: 'POST',
    body: { confirm: WIPE_CONFIRM_PHRASE },
    includeAuth: true,
  });
};

/**
 * DESTRUCTIVE: delete ALL parties (and their linked login accounts + party
 * upload files) only, leaving everything else intact. Admin-only + confirm phrase.
 * @returns {Promise<Object>} { success, message, rowsDeleted, filesDeleted }
 */
export const deleteAllParties = async () => {
  return apiRequest('/admin/delete-all-parties', {
    method: 'POST',
    body: { confirm: WIPE_CONFIRM_PHRASE },
    includeAuth: true,
  });
};
