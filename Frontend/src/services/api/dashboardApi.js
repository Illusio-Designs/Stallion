import { apiRequest } from './client';

// ==================== HOME SCREEN ENDPOINTS ====================

/**
 * Admin / office managers: one call with the numbers for the home screen
 * (salesmen in the field, visits today, pending expenses, unused trays, 12 weekly sales totals).
 * @returns {Promise<{salesmen_total:number, salesmen_in_field:number, in_field:Array,
 *   visits_today:number, pending_expenses:number, unused_trays:number, weekly_sales:Array}>}
 */
export const getDashboardSummary = async () => {
  return apiRequest('/dashboard/summary', { method: 'GET', includeAuth: true, silent: true });
};

/**
 * Party / distributor: name and phone of the salesman (parties) or salesmen (distributor) looking after them.
 * @returns {Promise<{salesmen: Array<{name:string, phone:string|null}>}>}
 */
export const getMySalesman = async () => {
  return apiRequest('/dashboard/my-salesman', { method: 'GET', includeAuth: true, silent: true });
};
