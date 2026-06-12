/**
 * API Service — barrel.
 * Implementation split into domain modules under ./api/.
 * Existing imports `from '../services/apiService'` keep working unchanged.
 */
export * from './api/client';
export * from './api/authApi';
export * from './api/geoApi';
export * from './api/partnersApi';
export * from './api/attributesApi';
export * from './api/productApi';
export * from './api/inventoryApi';
export * from './api/salesmanApi';
