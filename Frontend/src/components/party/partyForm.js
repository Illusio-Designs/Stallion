// Pure helpers for the one shared party form (PartyFormPanel). No React and no API
// calls, so they can be unit tested.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidUUID = (str) => {
  if (!str || String(str).trim() === '') return false;
  return UUID_RE.test(String(str).trim());
};

export const emptyPartyForm = () => ({
  party_name: '',
  trade_name: '',
  contact_person: '',
  email: '',
  phone: '',
  address: '',
  billing_address: '',
  billing_same_as_shipping: true,
  country_id: '',
  state_id: '',
  city_id: '',
  zone_id: '',
  pincode: '',
  gstin: '',
  pan: '',
  credit_days: '',
  prefered_courier: '',
  is_active: true,
  latitude: null,
  longitude: null,
  location_source: null,
  location_accuracy_m: null,
});

// Form values for an existing party row (what Edit party shows).
export const formFromParty = (row) => ({
  party_name: row.party_name || '',
  trade_name: row.trade_name || '',
  contact_person: row.contact_person || '',
  email: row.email || '',
  phone: row.phone || '',
  address: row.address || '',
  billing_address: row.billing_address || '',
  billing_same_as_shipping: row.billing_same_as_shipping !== false,
  country_id: row.country_id || '',
  state_id: row.state_id || '',
  city_id: row.city_id || '',
  zone_id: row.zone_id || '',
  pincode: row.pincode || '',
  gstin: row.gstin || '',
  pan: row.pan || '',
  credit_days: row.credit_days || '',
  prefered_courier: row.prefered_courier || row.preferred_courier || '',
  is_active: row.is_active !== false,
  latitude: row.latitude ?? null,
  longitude: row.longitude ?? null,
  location_source: row.location_source || null,
  location_accuracy_m: row.location_accuracy_m ?? null,
});

export const partyIdOf = (row) => {
  const id = row && (row.id || row.party_id || row._id);
  return id ? String(id) : '';
};

const REQUIRED_TEXT = [
  ['party_name', 'Party Name'],
  ['trade_name', 'Trade Name'],
  ['contact_person', 'Contact Person'],
  ['phone', 'Phone'],
  ['address', 'Address'],
  ['pincode', 'Pincode'],
];

// Returns the first problem as a readable sentence, or null when the form can be saved.
export const validatePartyForm = (form, { isEditing }) => {
  for (const [key, label] of REQUIRED_TEXT) {
    if (!form[key] || String(form[key]).trim() === '') return `${label} is required.`;
  }
  if (String(form.email || '').trim() !== '' && !EMAIL_RE.test(String(form.email).trim())) {
    return 'Please enter a valid email address.';
  }
  if (!form.country_id || !isValidUUID(form.country_id)) return 'Please select a country.';
  if (!form.state_id || !isValidUUID(form.state_id)) return 'Please select a state.';
  if (!form.city_id || !isValidUUID(form.city_id)) return 'Please select a city.';
  if (!isEditing && (!form.prefered_courier || form.prefered_courier.trim() === '')) {
    return 'Preferred Courier is required.';
  }
  return null;
};

const optionalUuid = (v) => {
  const value = (v || '').trim();
  if (value === '') return null;
  return isValidUUID(value) ? String(value) : null;
};

// The request body for create / update. Only an admin may send is_active.
export const buildPartyPayload = (form, { isAdmin }) => {
  const payload = {
    party_name: String(form.party_name || ''),
    trade_name: String(form.trade_name || ''),
    contact_person: String(form.contact_person || ''),
    email: String(form.email || ''),
    phone: String(form.phone || ''),
    address: String(form.address || ''),
    country_id: (form.country_id && isValidUUID(form.country_id)) ? String(form.country_id).trim() : null,
    state_id: optionalUuid(form.state_id),
    city_id: optionalUuid(form.city_id),
    zone_id: optionalUuid(form.zone_id),
    pincode: String(form.pincode || ''),
    gstin: String(form.gstin || ''),
    pan: String(form.pan || ''),
    credit_days: form.credit_days ? Number(form.credit_days) : null,
    prefered_courier: form.prefered_courier && form.prefered_courier.trim() !== '' ? String(form.prefered_courier).trim() : null,
    billing_same_as_shipping: form.billing_same_as_shipping !== false,
    billing_address: form.billing_same_as_shipping === false ? String(form.billing_address || '') : null,
  };
  if (isAdmin) payload.is_active = form.is_active !== false;
  // The point of a picked Google address (the shop's location until a visit saves the exact spot).
  const { address_lat: lat, address_lng: lng } = form;
  if (lat !== null && lat !== undefined && lng !== null && lng !== undefined
    && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    payload.address_lat = Number(lat);
    payload.address_lng = Number(lng);
  }
  return payload;
};

const errText = (err) => (err?.message || err?.error || '');
const safeJson = (v) => { try { return JSON.stringify(v) || ''; } catch { return ''; } };

// The server sometimes answers "Cannot access 'Party' before initialization" even though the
// change was saved; the caller then reloads to check instead of showing a failure.
export const isInitializationError = (err) => {
  if (err?.isInitializationError) return true;
  const m = String(errText(err)).toLowerCase();
  return m.includes('cannot access') && m.includes('before initialization');
};

export const isAuthExpiredError = (err) => {
  const m = String(err?.message || '').toLowerCase();
  return m.includes('token expired') || m.includes('unauthorized');
};

export const isForeignKeyError = (err) => {
  const m = String(errText(err) || safeJson(err)).toLowerCase();
  return m.includes('foreign key constraint') || safeJson(err).toLowerCase().includes('foreign key constraint');
};

// Which optional location ids the server rejected (state, city, zone), read from the error text.
export const foreignKeyFields = (err) => {
  const text = `${String(errText(err) || safeJson(err))} ${safeJson(err)}`.toLowerCase();
  const out = [];
  if (text.includes('state_id') || text.includes('states')) out.push('state_id');
  if (text.includes('city_id') || text.includes('cities')) out.push('city_id');
  if (text.includes('zone_id') || text.includes('zones')) out.push('zone_id');
  return out;
};

// A readable sentence for a failed save.
export const friendlySaveError = (err) => {
  let msg = err?.response?.data?.message || err?.message || 'Failed to save party';
  if (msg.includes('foreign key constraint')) {
    if (msg.includes('state_id')) msg = 'Invalid State ID. The state does not exist in the database.';
    else if (msg.includes('city_id')) msg = 'Invalid City ID. The city does not exist in the database.';
    else if (msg.includes('zone_id')) msg = 'Invalid Zone ID. The zone does not exist in the database.';
    else if (msg.includes('country_id')) msg = 'Invalid Country ID. Please select a valid country.';
    else msg = 'Invalid reference ID. One or more of the location IDs (state, city, or zone) does not exist in the database.';
  }
  return msg;
};

// Fields counted by the progress bar at the top of the form.
export const PROGRESS_KEYS = ['party_name', 'trade_name', 'contact_person', 'phone', 'address', 'country_id', 'state_id', 'city_id', 'pincode'];
export const progressDone = (form) => PROGRESS_KEYS.filter((k) => String(form[k] ?? '').trim() !== '').length;
