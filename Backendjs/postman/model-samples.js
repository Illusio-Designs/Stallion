/**
 * Builds example JSON objects from Sequelize model definitions.
 * Used by generate-collection.js for Postman example responses.
 */

const path = require('path');

const SAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';
const SAMPLE_UUID_2 = '660e8400-e29b-41d4-a716-446655440001';
const SAMPLE_DATE = '2026-06-13T10:30:00.000Z';
const SAMPLE_DATE_ONLY = '2026-06-13';

const MODEL_FILES = {
  Party: 'Party.js',
  Product: 'Product.js',
  User: 'User.js',
  Role: 'Role.js',
  Distributor: 'distributor.js',
  Salesman: 'Salesman.js',
  Cities: 'Cities.js',
  State: 'State.js',
  Country: 'Country.js',
  Zone: 'Zone.js',
  Gender: 'Gender.js',
  ColorCode: 'ColorCode.js',
  FrameColor: 'FrameColor.js',
  FrameType: 'FrameType.js',
  LensMaterial: 'LensMaterial.js',
  LensColor: 'LensColor.js',
  Shape: 'Shape.js',
  FrameMaterial: 'FrameMaterial.js',
  Brand: 'Brand.js',
  Collection: 'Collection.js',
  Tray: 'Tray.js',
  SalesmanTray: 'SalesmanTray.js',
  TrayProducts: 'TrayProducts.js',
  Event: 'event.js',
  Order: 'Order.js',
  SalesmanExpense: 'SalesmanExpense.js',
  SalesmanTargets: 'SalesmanTargets.js',
  SalesmanCheckIns: 'SalesmanCheckIns.js',
};

const FIELD_SAMPLES = {
  party_name: 'ABC Opticals',
  trade_name: 'ABC Trade',
  contact_person: 'Raj Sharma',
  distributor_name: 'North Distributor',
  model_no: 'IF-001',
  gender_name: 'Unisex',
  color_code: 'BLK',
  frame_color: 'Gold',
  frame_type: 'Full Rim',
  lens_material: 'CR39',
  lens_color: 'Clear',
  frame_material: 'Acetate',
  shape_name: 'Round',
  brand_name: 'Intense Focus',
  collection_name: 'Premium',
  tray_name: 'Tray A',
  event_name: 'Trade Show 2026',
  event_location: 'Mumbai',
  order_number: 'ORD-2026-0001',
  order_type: 'retail',
  order_status: 'pending',
  employee_code: 'SR001',
  zone_code: 'NZ-01',
  name: 'North Zone',
  full_name: 'John Doe',
  role_name: 'admin',
  description: 'Administrator role',
  territory: 'Western Region',
  prefered_courier: 'BlueDart',
  expense_type: 'travel',
  expense_description: 'Client visit travel',
  target_description: 'Monthly retail target',
  target_remarks: 'Q2 focus accounts',
  check_in_remarks: 'Visit completed',
  order_notes: 'Urgent delivery',
  courier_name: 'BlueDart',
  courier_tracking_number: 'BD123456789',
  tray_status: 'available',
  status: 'pending',
  target_status: 'active',
  event_status: 'scheduled',
  size_mm: '52-18-140',
  zone_preference: 'North,Mumbai',
  code: 'MH',
  phone_code: '+91',
  currency: 'INR',
  remarks: 'Approved by manager',
};

const modelCache = new Map();

function loadModel(modelName) {
  if (modelCache.has(modelName)) return modelCache.get(modelName);
  const file = MODEL_FILES[modelName];
  if (!file) throw new Error(`Unknown model: ${modelName}`);
  const model = require(path.join(__dirname, '../lib/models', file));
  modelCache.set(modelName, model);
  return model;
}

function getTypeKey(attribute) {
  return attribute.type?.key || attribute.type?.constructor?.name || 'UNKNOWN';
}

function sampleValue(fieldName, attribute, index = 0) {
  if (Object.prototype.hasOwnProperty.call(FIELD_SAMPLES, fieldName)) {
    return FIELD_SAMPLES[fieldName];
  }

  const typeKey = getTypeKey(attribute);
  const isUuidRef =
    fieldName === 'id' ||
    fieldName.endsWith('_id') ||
    fieldName.endsWith('_by') ||
    fieldName === 'reporting_manager';

  if (isUuidRef && typeKey === 'UUID') {
    return index === 0 ? SAMPLE_UUID : SAMPLE_UUID_2;
  }
  if ((fieldName === 'id' || fieldName.endsWith('_id')) && (typeKey === 'INTEGER' || typeKey === 'BIGINT')) {
    return index + 1;
  }

  if (typeKey === 'BOOLEAN') return true;

  if (typeKey === 'DATE' || typeKey === 'DATEONLY') {
    return fieldName.includes('date') && !fieldName.includes('_at') ? SAMPLE_DATE_ONLY : SAMPLE_DATE;
  }

  if (typeKey === 'DECIMAL' || typeKey === 'FLOAT' || typeKey === 'DOUBLE') {
    if (fieldName.includes('commission')) return '5.00';
    if (fieldName.includes('amount') || fieldName.includes('total') || fieldName.includes('mrp') || fieldName.includes('whp')) {
      return '2500.00';
    }
    if (fieldName.includes('latitude')) return '19.07600000';
    if (fieldName.includes('longitude')) return '72.87770000';
    return '100.00';
  }

  if (typeKey === 'INTEGER' || typeKey === 'BIGINT') {
    if (fieldName.includes('qty') || fieldName.includes('kilometers') || fieldName.includes('days')) return 10;
    if (fieldName.includes('amount')) return 500;
    return 1;
  }

  if (typeKey === 'JSON' || typeKey === 'JSONB') {
    if (fieldName === 'order_items') {
      return [{ product_id: SAMPLE_UUID, model_no: 'IF-001', quantity: 2, mrp: '2500.00' }];
    }
    if (fieldName === 'image_urls' || fieldName === 'images') {
      return ['/uploads/example.jpg'];
    }
    if (fieldName === 'old_values' || fieldName === 'new_values') return null;
    return {};
  }

  if (typeKey === 'ENUM') {
    const values = attribute.type?.values;
    return values?.[0] || 'example';
  }

  if (fieldName.includes('email')) return 'contact@example.com';
  if (fieldName.includes('phone')) return '9876543210';
  if (fieldName.includes('address')) return '123 Main Street, Mumbai';
  if (fieldName.includes('pincode')) return '400001';
  if (fieldName.includes('gstin')) return '27AAAAA0000A1Z5';
  if (fieldName.includes('pan')) return 'ABCDE1234F';
  if (fieldName.includes('url') || fieldName.includes('image')) return '/uploads/example.jpg';
  if (fieldName.includes('password') || fieldName.includes('token')) return 'example-token';
  if (fieldName.includes('action')) return 'create';
  if (fieldName.includes('table_name')) return 'example_table';
  if (fieldName.includes('ip_address')) return '127.0.0.1';

  if (typeKey === 'TEXT' || typeKey === 'STRING' || typeKey === 'CHAR') return 'example';

  return null;
}

function buildModelSample(modelName) {
  const model = loadModel(modelName);
  const sample = {};

  for (const [fieldName, attribute] of Object.entries(model.rawAttributes)) {
    sample[fieldName] = sampleValue(fieldName, attribute);
  }

  return sample;
}

function buildModelList(modelName, count = 1) {
  return Array.from({ length: count }, (_, index) => {
    const sample = {};
    const model = loadModel(modelName);
    for (const [fieldName, attribute] of Object.entries(model.rawAttributes)) {
      sample[fieldName] = sampleValue(fieldName, attribute, index);
    }
    return sample;
  });
}

module.exports = {
  buildModelSample,
  buildModelList,
  MODEL_FILES,
};
