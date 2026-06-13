#!/usr/bin/env node
/**
 * Generates Stallion Optical API Postman Collection v2.1
 * Run: node Backendjs/postman/generate-collection.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildModelSample, buildModelList } = require('./model-samples');

const uuid = () => crypto.randomUUID();

const ROUTES = [
  {
    folder: 'auth',
    mount: 'auth',
    routes: [
      { method: 'POST', path: 'verify-otp', auth: false, body: { phoneNumber: '9876543210', otp: '123456' }, desc: 'Verify OTP sent to phone number.', response: { message: 'OTP verified successfully', token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' } },
      { method: 'POST', path: 'send-otp', auth: false, body: { phoneNumber: '9876543210' }, desc: 'Send OTP to registered phone number.', response: { message: 'OTP sent successfully' } },
      { method: 'POST', path: 'logout', auth: false, body: {}, desc: 'Logout current session.', response: { message: 'Logged out successfully' } },
      { method: 'POST', path: 'refresh-token', auth: false, body: { refreshToken: '{{refreshToken}}' }, desc: 'Refresh JWT access token.', response: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' } },
      { method: 'POST', path: 'check-user', auth: false, body: { phoneNumber: '9876543210' }, desc: 'Check if user exists by phone number.', response: { exists: true, user_id: '550e8400-e29b-41d4-a716-446655440000' } },
      { method: 'GET', path: 'check-token', auth: true, desc: 'Validate current JWT token.', response: { valid: true, userId: '550e8400-e29b-41d4-a716-446655440000', role: 'admin' } },
      { method: 'POST', path: 'login', auth: false, body: { phoneNumber: '9876543210' }, desc: 'Login with phone number. Returns JWT token and role.', response: { message: 'Login successful', token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', role: 'admin' } },
      { method: 'POST', path: 'register', auth: false, body: { phoneNumber: '9876543210', full_name: 'John Doe', email: 'john@example.com', role_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Register a new user.', response: { message: 'User registered successfully', user_id: '550e8400-e29b-41d4-a716-446655440000' } },
    ],
  },
  {
    folder: 'roles',
    mount: 'roles',
    routes: [
      { method: 'GET', path: '', auth: false, desc: 'Get all roles.', model: 'Role', list: true },
    ],
  },
  {
    folder: 'users',
    mount: 'users',
    routes: [
      { method: 'GET', path: '', auth: false, desc: 'Get all users.', model: 'User', list: true },
      { method: 'GET', path: 'me', auth: true, desc: 'Get authenticated user profile.', model: 'User' },
      { method: 'POST', path: '', auth: true, body: { name: 'Jane Doe', phone: '9876543211', email: 'jane@example.com', role_id: '550e8400-e29b-41d4-a716-446655440000', is_active: true }, desc: 'Create a new user.', model: 'User' },
      { method: 'PUT', path: '', auth: true, body: { name: 'Jane Smith', phone: '9876543211', is_active: true }, desc: 'Update authenticated user.', model: 'User' },
      { method: 'DELETE', path: '', auth: true, desc: 'Delete authenticated user.', response: { message: 'User deleted successfully' } },
      { method: 'GET', path: 'role', auth: true, desc: 'Get roles assigned to authenticated user.', response: [{ role_id: '550e8400-e29b-41d4-a716-446655440000', role_name: 'admin', role_description: 'Administrator role', assigned_at: '2026-06-13T10:30:00.000Z' }] },
      { method: 'POST', path: 'upload-profile', auth: true, formData: true, desc: 'Upload profile image (multipart/form-data, field: profile_image).', response: { message: 'Profile image uploaded successfully', image_url: '/uploads/profile/example.jpg' } },
    ],
  },
  {
    folder: 'parties',
    mount: 'parties',
    routes: [
      { method: 'GET', path: '', auth: true, desc: 'Get party linked to authenticated user.', model: 'Party' },
      { method: 'GET', path: 'my', auth: true, desc: 'Get parties for current user role (party/salesman/distributor).', model: 'Party', list: true },
      { method: 'GET', path: 'salesman/:salesman_id', auth: true, params: [{ key: 'salesman_id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Salesman ID' }], desc: 'Get parties assigned to a salesman.', model: 'Party', list: true },
      { method: 'GET', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Party ID' }], desc: 'Get party by ID.', model: 'Party' },
      { method: 'POST', path: 'get', auth: true, body: {}, desc: 'Get all active parties.', model: 'Party', list: true },
      { method: 'POST', path: '', auth: true, body: { party_name: 'New Opticals', distributor_id: '550e8400-e29b-41d4-a716-446655440000', salesman_id: '660e8400-e29b-41d4-a716-446655440001', zone_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Create a new party.', model: 'Party' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Party ID' }], body: { party_name: 'Updated Opticals' }, desc: 'Update party by ID.', model: 'Party' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Party ID' }], desc: 'Soft-delete party by ID.', response: { message: 'Party deleted successfully' } },
      { method: 'POST', path: 'byZoneId', auth: true, body: { zone_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Get parties filtered by zone ID.', model: 'Party', list: true },
      { method: 'POST', path: 'bulk-upload', auth: true, formData: true, desc: 'Bulk upload parties via Excel/CSV (multipart/form-data, field: file).', response: { success: true, message: 'Bulk upload completed', data: { successCount: 10, errorCount: 0 } } },
    ],
  },
  {
    folder: 'distributors',
    mount: 'distributors',
    routes: [
      { method: 'GET', path: '', auth: true, desc: 'Get distributor for authenticated user.', model: 'Distributor' },
      { method: 'GET', path: 'parties', auth: true, desc: 'Get parties under authenticated distributor.', model: 'Party', list: true },
      { method: 'GET', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Distributor ID' }], desc: 'Get distributor by ID.', model: 'Distributor' },
      { method: 'POST', path: '', auth: true, body: { distributor_name: 'South Distributor', user_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Create a distributor.', model: 'Distributor' },
      { method: 'POST', path: 'get', auth: true, body: {}, desc: 'Get all distributors.', model: 'Distributor', list: true },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Distributor ID' }], body: { distributor_name: 'Updated Distributor' }, desc: 'Update distributor.', model: 'Distributor' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Distributor ID' }], desc: 'Delete distributor.', response: { message: 'Distributor deleted successfully' } },
    ],
  },
  {
    folder: 'salesmen',
    mount: 'salesmen',
    routes: [
      { method: 'GET', path: '', auth: true, desc: 'Get salesman for authenticated user.', model: 'Salesman' },
      { method: 'GET', path: 'parties', auth: true, desc: 'Get parties assigned to authenticated salesman.', model: 'Party', list: true },
      { method: 'GET', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Salesman ID' }], desc: 'Get salesman by ID.', model: 'Salesman' },
      { method: 'POST', path: 'get', auth: true, body: {}, desc: 'Get all salesmen.', model: 'Salesman', list: true },
      { method: 'POST', path: '', auth: true, body: { user_id: '550e8400-e29b-41d4-a716-446655440000', employee_code: 'SR002', full_name: 'New Salesman', phone: '9876543212', email: 'sales@example.com', zones: ['550e8400-e29b-41d4-a716-446655440000'] }, desc: 'Create a salesman.', model: 'Salesman' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Salesman ID' }], body: { full_name: 'Updated Salesman', is_active: true }, desc: 'Update salesman.', model: 'Salesman' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Salesman ID' }], desc: 'Delete salesman.', response: { message: 'Salesman deleted successfully' } },
    ],
  },
  {
    folder: 'cities',
    mount: 'cities',
    routes: [
      { method: 'GET', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'City ID' }], desc: 'Get city by ID.', model: 'Cities' },
      { method: 'POST', path: 'get', auth: true, body: { state_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Get cities by state ID (body filter).', model: 'Cities', list: true },
      { method: 'POST', path: '', auth: true, body: { name: 'Pune', state_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Create a city.', model: 'Cities' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'City ID' }], body: { name: 'Mumbai City', state_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Update city.', model: 'Cities' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'City ID' }], desc: 'Delete city.', response: { message: 'City deleted successfully' } },
    ],
  },
  {
    folder: 'states',
    mount: 'states',
    routes: [
      { method: 'GET', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'State ID' }], desc: 'Get state by ID.', model: 'State' },
      { method: 'POST', path: 'get', auth: true, body: { country_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Get states by country ID.', model: 'State', list: true },
      { method: 'POST', path: '', auth: true, body: { name: 'Gujarat', code: 'GJ', country_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Create a state.', model: 'State' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'State ID' }], body: { name: 'Maharashtra', code: 'MH', country_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Update state.', model: 'State' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'State ID' }], desc: 'Delete state.', response: { message: 'State deleted successfully' } },
    ],
  },
  {
    folder: 'countries',
    mount: 'countries',
    routes: [
      { method: 'GET', path: '', auth: true, desc: 'Get all countries.', model: 'Country', list: true },
      { method: 'GET', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Country ID' }], desc: 'Get country by ID.', model: 'Country' },
      { method: 'POST', path: '', auth: true, body: { name: 'India', code: 'IN', phone_code: '+91', currency: 'INR' }, desc: 'Create a country.', model: 'Country' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Country ID' }], body: { name: 'India', code: 'IN', phone_code: '+91', currency: 'INR' }, desc: 'Update country.', model: 'Country' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Country ID' }], desc: 'Delete country.', response: { message: 'Country deleted successfully' } },
    ],
  },
  {
    folder: 'zones',
    mount: 'zones',
    routes: [
      { method: 'GET', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Zone ID' }], desc: 'Get zone by ID.', model: 'Zone' },
      { method: 'POST', path: 'get', auth: true, body: { city_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Get all zones.', model: 'Zone', list: true },
      { method: 'POST', path: 'my', auth: true, body: {}, desc: 'Get zones for authenticated user.', model: 'Zone', list: true },
      { method: 'POST', path: '', auth: true, body: { name: 'South Zone', description: 'Southern territory', city_id: '550e8400-e29b-41d4-a716-446655440000', state_id: '660e8400-e29b-41d4-a716-446655440001', country_id: '550e8400-e29b-41d4-a716-446655440000', zone_code: 'SZ-01' }, desc: 'Create a zone.', model: 'Zone' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Zone ID' }], body: { name: 'Updated Zone', description: 'Updated territory' }, desc: 'Update zone.', model: 'Zone' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Zone ID' }], desc: 'Delete zone.', response: { message: 'Zone deleted successfully' } },
    ],
  },
  {
    folder: 'products',
    mount: 'products',
    routes: [
      { method: 'POST', path: '', auth: true, query: [{ key: 'page', value: '1', desc: 'Page number (required)' }, { key: 'limit', value: '10', desc: 'Items per page (required)' }, { key: 'search', value: '', desc: 'Search term (optional)' }], body: { collection_id: '550e8400-e29b-41d4-a716-446655440000', brand_id: '660e8400-e29b-41d4-a716-446655440001', gender_id: 1 }, desc: 'List products with pagination (query) and filters (body). Returns full Product records in data.', model: 'Product', responseShape: 'paginated' },
      { method: 'POST', path: 'featured', auth: false, body: { collection_id: 'all' }, desc: 'Get featured products (max 6). Use collection_id or "all".', model: 'Product', list: true },
      { method: 'GET', path: 'images/all', auth: true, desc: 'Get all uploaded product images.', response: [{ file_name: 'product_1.jpg', url: '/uploads/products/product_1.jpg' }] },
      { method: 'POST', path: 'create', auth: true, body: { model_no: 'IF-002', mrp: 3000, whp: 2000, brand_id: '550e8400-e29b-41d4-a716-446655440000', collection_id: '660e8400-e29b-41d4-a716-446655440001', gender_id: 1, color_code_id: 1, shape_id: 1, lens_color_id: 1, frame_color_id: 1, frame_type_id: 1, lens_material_id: 1, frame_material_id: 1, size_mm: '52-18-140', warehouse_qty: 10, status: 'active' }, desc: 'Create a product.', model: 'Product' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Product ID' }], body: { model_no: 'IF-001', mrp: 2800 }, desc: 'Update product.', model: 'Product' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Product ID' }], desc: 'Delete product.', response: { message: 'Product deleted successfully' } },
      { method: 'DELETE', path: 'images/:file_name', auth: true, params: [{ key: 'file_name', value: 'product_1.jpg', desc: 'Image file name' }], desc: 'Delete a product image.', response: { message: 'Image deleted successfully' } },
      { method: 'POST', path: 'image-upload', auth: true, formData: true, desc: 'Upload product image (multipart/form-data).', response: { message: 'Image uploaded', file_name: 'product_1.jpg' } },
      { method: 'POST', path: 'bulk-upload', auth: true, formData: true, desc: 'Bulk upload products via Excel/CSV.', response: { success: true, message: 'Bulk upload completed. 5 products created, 0 errors.', data: { successCount: 5, errorCount: 0, total: 5 } } },
      { method: 'POST', path: 'product-models', auth: true, body: { search: 'IF' }, desc: 'Search product model numbers.', response: [{ model_no: 'IF-001' }, { model_no: 'IF-002' }] },
    ],
  },
  {
    folder: 'genders',
    mount: 'genders',
    routes: crudRoutes('gender', 'Gender', 'gender_name'),
  },
  {
    folder: 'color_codes',
    mount: 'color_codes',
    routes: [
      { method: 'GET', path: '', auth: true, desc: 'Get all color codes.', model: 'ColorCode', list: true },
      { method: 'POST', path: '', auth: true, body: { color_code: 'BLU' }, desc: 'Create color code.', model: 'ColorCode' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '1', desc: 'Color code ID' }], body: { color_code: 'BLK' }, desc: 'Update color code.', model: 'ColorCode' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '1', desc: 'Color code ID' }], desc: 'Delete color code.', response: { message: 'Color code deleted successfully' } },
    ],
  },
  {
    folder: 'frame_colors',
    mount: 'frame_colors',
    routes: crudRoutes('frame color', 'FrameColor', 'frame_color'),
  },
  {
    folder: 'frame_types',
    mount: 'frame_types',
    routes: crudRoutes('frame type', 'FrameType', 'frame_type'),
  },
  {
    folder: 'lens_materials',
    mount: 'lens_materials',
    routes: crudRoutes('lens material', 'LensMaterial', 'lens_material'),
  },
  {
    folder: 'lens_colors',
    mount: 'lens_colors',
    routes: crudRoutes('lens color', 'LensColor', 'lens_color'),
  },
  {
    folder: 'shapes',
    mount: 'shapes',
    routes: [
      { method: 'GET', path: '', auth: true, desc: 'Get all shapes.', model: 'Shape', list: true },
      { method: 'POST', path: '', auth: true, body: { shape_name: 'Square' }, desc: 'Create shape.', model: 'Shape' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '1', desc: 'Shape ID' }], body: { shape_name: 'Round' }, desc: 'Update shape.', model: 'Shape' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '1', desc: 'Shape ID' }], desc: 'Delete shape.', response: { message: 'Shape deleted successfully' } },
    ],
  },
  {
    folder: 'frame_materials',
    mount: 'frame_materials',
    routes: crudRoutes('frame material', 'FrameMaterial', 'frame_material'),
  },
  {
    folder: 'brands',
    mount: 'brands',
    routes: [
      { method: 'GET', path: '', auth: true, desc: 'Get all brands.', model: 'Brand', list: true },
      { method: 'POST', path: '', auth: true, body: { brand_name: 'New Brand' }, desc: 'Create brand.', model: 'Brand' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Brand ID' }], body: { brand_name: 'Intense Focus' }, desc: 'Update brand.', model: 'Brand' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Brand ID' }], desc: 'Delete brand.', response: { message: 'Brand deleted successfully' } },
    ],
  },
  {
    folder: 'collections',
    mount: 'collections',
    routes: [
      { method: 'GET', path: '', auth: false, desc: 'Get all collections (public).', model: 'Collection', list: true },
      { method: 'POST', path: '', auth: true, body: { collection_name: 'Classic', brand_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Create collection.', model: 'Collection' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Collection ID' }], body: { collection_name: 'Premium Plus', brand_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Update collection.', model: 'Collection' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Collection ID' }], desc: 'Delete collection.', response: { message: 'Collection deleted successfully' } },
    ],
  },
  {
    folder: 'trays',
    mount: 'trays',
    routes: [
      { method: 'GET', path: '', auth: true, desc: 'Get all trays.', model: 'Tray', list: true },
      { method: 'POST', path: '', auth: true, body: { tray_name: 'Tray B', tray_status: 'available' }, desc: 'Create tray.', model: 'Tray' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Tray ID' }], body: { tray_name: 'Tray A Updated', tray_status: 'available' }, desc: 'Update tray.', model: 'Tray' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Tray ID' }], desc: 'Delete tray.', response: { message: 'Tray deleted successfully' } },
    ],
  },
  {
    folder: 'salesman_trays',
    mount: 'salesman_trays',
    routes: [
      { method: 'POST', path: '', auth: true, body: { salesman_id: '550e8400-e29b-41d4-a716-446655440000' }, desc: 'Get trays assigned to a salesman.', model: 'SalesmanTray', list: true },
      { method: 'POST', path: 'assign', auth: true, body: { salesman_id: '550e8400-e29b-41d4-a716-446655440000', tray_id: '660e8400-e29b-41d4-a716-446655440001' }, desc: 'Assign tray to salesman.', responseShape: 'messageWithData', model: 'SalesmanTray', message: 'Salesman tray assigned successfully' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Assignment ID' }], desc: 'Unassign tray from salesman.', response: { message: 'Salesman tray unassigned successfully' } },
    ],
  },
  {
    folder: 'tray_products',
    mount: 'tray_products',
    routes: [
      { method: 'GET', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Tray ID' }], desc: 'Get products in a tray.', model: 'TrayProducts', list: true },
      { method: 'POST', path: '', auth: true, body: { tray_id: '550e8400-e29b-41d4-a716-446655440000', product_id: '660e8400-e29b-41d4-a716-446655440001', status: 'alloted' }, desc: 'Add product to tray.', model: 'TrayProducts' },
      { method: 'PUT', path: '', auth: true, body: { tray_id: '550e8400-e29b-41d4-a716-446655440000', product_id: '660e8400-e29b-41d4-a716-446655440001', status: 'sold' }, desc: 'Update product status in tray.', model: 'TrayProducts' },
      { method: 'DELETE', path: '', auth: true, body: { tray_id: '550e8400-e29b-41d4-a716-446655440000', product_id: '660e8400-e29b-41d4-a716-446655440001' }, desc: 'Remove product from tray.', response: { message: 'Product removed from tray' } },
    ],
  },
  {
    folder: 'events',
    mount: 'events',
    routes: [
      { method: 'GET', path: '', auth: true, desc: 'Get all events.', model: 'Event', list: true },
      { method: 'POST', path: '', auth: true, body: { event_name: 'Expo 2026', start_date: '2026-07-01', end_date: '2026-07-05', event_location: 'Mumbai' }, desc: 'Create event.', model: 'Event' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Event ID' }], body: { event_name: 'Trade Show 2026 Updated' }, desc: 'Update event.', model: 'Event' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Event ID' }], desc: 'Delete event.', response: { message: 'Event deleted successfully' } },
    ],
  },
  {
    folder: 'orders',
    mount: 'orders',
    routes: [
      { method: 'GET', path: 'my', auth: true, desc: 'Get orders for authenticated user.', model: 'Order', list: true },
      { method: 'GET', path: '', auth: true, desc: 'Get all orders (admin).', model: 'Order', list: true },
      { method: 'POST', path: '', auth: true, body: { party_id: '550e8400-e29b-41d4-a716-446655440000', order_type: 'retail', order_items: [{ product_id: '660e8400-e29b-41d4-a716-446655440001', quantity: 2 }] }, desc: 'Create order.', model: 'Order' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Order ID' }], body: { order_status: 'confirmed' }, desc: 'Update order status.', model: 'Order' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Order ID' }], desc: 'Delete order.', response: { message: 'Order deleted successfully' } },
    ],
  },
  {
    folder: 'salesman_expenses',
    mount: 'salesman_expenses',
    routes: [
      { method: 'GET', path: '', auth: true, desc: 'Get expenses for authenticated salesman.', model: 'SalesmanExpense', list: true },
      { method: 'GET', path: 'admin/all', auth: true, desc: 'Get all salesman expenses (admin).', model: 'SalesmanExpense', list: true },
      { method: 'GET', path: 'admin/:salesman_id', auth: true, params: [{ key: 'salesman_id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Salesman ID' }], desc: 'Get expenses for a salesman (admin).', model: 'SalesmanExpense', list: true },
      { method: 'POST', path: '', auth: true, body: { expense_amount: 750, expense_description: 'Fuel', expense_date: '2026-06-13', expense_type: 'fuel' }, desc: 'Create expense.', model: 'SalesmanExpense' },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Expense ID' }], body: { expense_amount: 600, expense_description: 'Travel updated' }, desc: 'Update expense.', model: 'SalesmanExpense' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Expense ID' }], desc: 'Delete expense.', response: { message: 'Expense deleted successfully' } },
      { method: 'POST', path: 'upload-images', auth: true, formData: true, desc: 'Upload expense bill images (multipart/form-data).', response: { message: 'Images uploaded', urls: ['/uploads/bills/bill_1.jpg'] } },
    ],
  },
  {
    folder: 'salesman_targets',
    mount: 'salesman_targets',
    routes: [
      { method: 'POST', path: '', auth: true, body: { salesman_id: '550e8400-e29b-41d4-a716-446655440000', target_amount: 100000, start_date: '2026-06-01', end_date: '2026-06-30', order_type: 'retail' }, desc: 'Create salesman target.', model: 'SalesmanTargets' },
      { method: 'GET', path: '', auth: true, desc: 'Get all salesman targets.', model: 'SalesmanTargets', list: true },
      { method: 'GET', path: ':salesman_id', auth: true, params: [{ key: 'salesman_id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Salesman ID' }], desc: 'Get targets by salesman ID.', model: 'SalesmanTargets', list: true },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Target ID' }], body: { target_amount: 120000, completed_amount: 50000 }, desc: 'Update target.', model: 'SalesmanTargets' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Target ID' }], desc: 'Delete target.', response: { message: 'Target deleted successfully' } },
    ],
  },
  {
    folder: 'salesman_checkins',
    mount: 'salesman_checkins',
    routes: [
      { method: 'POST', path: '', auth: true, body: { salesman_id: '550e8400-e29b-41d4-a716-446655440000', party_id: '660e8400-e29b-41d4-a716-446655440001', latitude: 19.076, longitude: 72.8777, check_in_remarks: 'Visit completed' }, desc: 'Create check-in.', model: 'SalesmanCheckIns' },
      { method: 'GET', path: '', auth: true, desc: 'Get all check-ins.', model: 'SalesmanCheckIns', list: true },
      { method: 'GET', path: ':salesman_id', auth: true, params: [{ key: 'salesman_id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Salesman ID' }], desc: 'Get check-ins by salesman.', model: 'SalesmanCheckIns', list: true },
      { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Check-in ID' }], body: { check_in_remarks: 'Updated visit' }, desc: 'Update check-in.', model: 'SalesmanCheckIns' },
      { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: '550e8400-e29b-41d4-a716-446655440000', desc: 'Check-in ID' }], desc: 'Delete check-in.', response: { message: 'Check-in deleted successfully' } },
    ],
  },
  {
    folder: 'docs',
    mount: '',
    routes: [
      { method: 'GET', path: 'docs', auth: false, desc: 'API documentation index listing all endpoint groups.', response: { message: 'Stallion Optical E-commerce API Documentation', version: '1.0.0', endpoints: { auth: '/api/auth', products: '/api/products' } } },
    ],
  },
];

function crudRoutes(label, modelName, bodyField) {
  return [
    { method: 'GET', path: '', auth: true, desc: `Get all ${label}s.`, model: modelName, list: true },
    { method: 'GET', path: ':id', auth: true, params: [{ key: 'id', value: modelName === 'Gender' || modelName === 'ColorCode' || modelName === 'Shape' ? '1' : '550e8400-e29b-41d4-a716-446655440000', desc: `${label} ID` }], desc: `Get ${label} by ID.`, model: modelName },
    { method: 'POST', path: '', auth: true, body: { [bodyField]: buildModelSample(modelName)[bodyField] }, desc: `Create ${label}.`, model: modelName },
    { method: 'PUT', path: ':id', auth: true, params: [{ key: 'id', value: modelName === 'Gender' || modelName === 'ColorCode' || modelName === 'Shape' ? '1' : '550e8400-e29b-41d4-a716-446655440000', desc: `${label} ID` }], body: { [bodyField]: buildModelSample(modelName)[bodyField] }, desc: `Update ${label}.`, model: modelName },
    { method: 'DELETE', path: ':id', auth: true, params: [{ key: 'id', value: modelName === 'Gender' || modelName === 'ColorCode' || modelName === 'Shape' ? '1' : '550e8400-e29b-41d4-a716-446655440000', desc: `${label} ID` }], desc: `Delete ${label}.`, response: { message: `${label.charAt(0).toUpperCase() + label.slice(1)} deleted successfully` } },
  ];
}

function resolveResponse(route) {
  if (route.response !== undefined) return route.response;

  if (route.responseShape === 'paginated' && route.model) {
    return {
      data: buildModelList(route.model, 1),
      pagination: { page: 1, limit: 10, total: 100, totalPages: 10 },
    };
  }

  if (route.responseShape === 'messageWithData' && route.model) {
    return {
      message: route.message || 'Operation successful',
      data: buildModelSample(route.model),
    };
  }

  if (route.model) {
    return route.list ? buildModelList(route.model, route.listCount || 1) : buildModelSample(route.model);
  }

  return {};
}

function buildUrl(mount, routePath, params = [], query = []) {
  const segments = [];
  if (mount) segments.push(mount);
  if (routePath) {
    routePath.split('/').filter(Boolean).forEach((seg) => segments.push(seg));
  }

  const pathVars = (params || []).map((p) => ({
    key: p.key,
    value: p.value,
    description: p.desc || p.key,
  }));

  let raw = '{{baseUrl}}';
  if (segments.length) raw += '/' + segments.join('/');

  const queryStr = (query || [])
    .filter((q) => q.key)
    .map((q) => `${q.key}=${q.value ?? ''}`)
    .join('&');
  if (queryStr) raw += '?' + queryStr;

  const url = {
    raw,
    host: ['{{baseUrl}}'],
    path: segments.length ? segments : [''],
  };
  if (pathVars.length) url.variable = pathVars;
  if (query && query.length) {
    url.query = query.map((q) => ({
      key: q.key,
      value: q.value ?? '',
      description: q.desc || q.key,
      disabled: q.disabled || false,
    }));
  }
  return url;
}

function buildRequestName(method, routePath) {
  const action = routePath || 'list';
  const readable = action
    .replace(/:([a-z_]+)/gi, ' by $1')
    .replace(/\//g, ' ')
    .trim();
  return `${method} ${readable || 'root'}`.replace(/\s+/g, ' ');
}

function buildDescription(route) {
  const response = resolveResponse(route);
  const parts = [route.desc || ''];
  if (route.model) parts.push(`**Model:** \`${route.model}\` (all table columns from Sequelize model).`);
  if (route.auth) parts.push('**Auth:** Bearer token required (`Authorization: Bearer {{accessToken}}`).');
  else parts.push('**Auth:** None (public endpoint).');
  if (route.params?.length) {
    parts.push('\n**Path Parameters:**');
    route.params.forEach((p) => parts.push(`- \`:${p.key}\` — ${p.desc || p.key} (example: \`${p.value}\`)`));
  }
  if (route.query?.length) {
    parts.push('\n**Query Parameters:**');
    route.query.forEach((q) => parts.push(`- \`${q.key}\` — ${q.desc || q.key}`));
  }
  if (route.body && !route.formData) {
    parts.push('\n**Request Body:**');
    parts.push('```json\n' + JSON.stringify(route.body, null, 2) + '\n```');
  }
  if (route.formData) parts.push('\n**Body:** `multipart/form-data` (file upload).');
  parts.push('\n**Example Response:**');
  parts.push('```json\n' + JSON.stringify(response, null, 2) + '\n```');
  return parts.join('\n');
}

function buildBody(route) {
  if (route.formData) {
    return {
      mode: 'formdata',
      formdata: [{ key: 'file', type: 'file', src: [], description: 'Upload file' }],
    };
  }
  if (['POST', 'PUT', 'PATCH'].includes(route.method) && route.body !== undefined) {
    return {
      mode: 'raw',
      raw: JSON.stringify(route.body, null, 2),
      options: { raw: { language: 'json' } },
    };
  }
  return undefined;
}

function buildHeaders(route) {
  const headers = [{ key: 'Content-Type', value: 'application/json', type: 'text' }];
  if (route.formData) headers[0] = { key: 'Content-Type', value: 'multipart/form-data', type: 'text', disabled: true };
  if (route.auth) headers.push({ key: 'Authorization', value: 'Bearer {{accessToken}}', type: 'text' });
  return headers;
}

function buildItem(route, mount) {
  const response = resolveResponse(route);
  const responseBody = JSON.stringify(response, null, 2);
  const statusCode = route.method === 'POST' && !Array.isArray(response) && response.message?.includes('created') ? 201 : 200;

  return {
    name: buildRequestName(route.method, route.path),
    request: {
      method: route.method,
      header: buildHeaders(route),
      body: buildBody(route),
      url: buildUrl(mount, route.path, route.params, route.query),
      description: buildDescription(route),
    },
    response: [
      {
        name: 'Example Success',
        originalRequest: {
          method: route.method,
          header: buildHeaders(route),
          url: buildUrl(mount, route.path, route.params, route.query),
        },
        status: 'OK',
        code: statusCode,
        _postman_previewlanguage: 'json',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: responseBody,
      },
    ],
  };
}

function generateCollection() {
  const ROUTE_FILES = {
    users: 'user', parties: 'party', distributors: 'distributor', salesmen: 'salesman',
    cities: 'city', states: 'state', countries: 'country', zones: 'zone', products: 'product',
    genders: 'gender', frame_colors: 'frame_color', frame_types: 'frame_type',
    lens_materials: 'lens_material', frame_materials: 'frame_material', brands: 'brand',
    collections: 'collection', trays: 'tray', salesman_trays: 'salesman_tray', events: 'event',
    orders: 'order', salesman_expenses: 'salesman_expense', docs: 'routeManager',
  };

  const items = ROUTES.map(({ folder, mount, routes }) => ({
    name: folder,
    description: `Routes from \`Backendjs/lib/routes/${ROUTE_FILES[folder] || folder}.js\` mounted at \`/api/${mount || ''}\``,
    item: routes.map((r) => buildItem(r, mount)),
  }));

  return {
    info: {
      _postman_id: uuid(),
      name: 'Stallion Optical API',
      description: 'Stallion Optical E-commerce API — generated from Backendjs route files and Sequelize models.\n\n**Variables:**\n- `baseUrl` — API root (default: `http://localhost:3000/api`)\n- `accessToken` — JWT from login/verify-otp\n- `refreshToken` — refresh token for token renewal\n\nEntity responses include all columns from `Backendjs/lib/models`.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
    },
    variable: [
      { key: 'baseUrl', value: 'http://localhost:3000/api', type: 'string' },
      { key: 'accessToken', value: '', type: 'string' },
      { key: 'refreshToken', value: '', type: 'string' },
    ],
    item: items,
  };
}

const collection = generateCollection();
const outPath = path.join(__dirname, 'Stallion-Optical-API.postman_collection.json');
fs.writeFileSync(outPath, JSON.stringify(collection, null, 2));
console.log(`✅ Postman collection written to ${outPath}`);
console.log(`   Folders: ${ROUTES.length}, Requests: ${ROUTES.reduce((n, g) => n + g.routes.length, 0)}`);
