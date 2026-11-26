// Google Places (New): address suggestions while typing, and the full address with its
// parts (pincode, city, state, country) once one is picked. The key stays on the server.
// Set GOOGLE_MAPS_API_KEY (Places API (New) enabled). Without it the party form simply
// works as plain typing. GOOGLE_PLACES_REGION limits suggestions to a country (default
// "in"); set it to "" to allow every country.
const BASE = 'https://places.googleapis.com/v1';
const REGION = process.env.GOOGLE_PLACES_REGION === undefined ? 'in' : process.env.GOOGLE_PLACES_REGION;

const apiKey = () => process.env.GOOGLE_MAPS_API_KEY || '';
const isConfigured = () => !!apiKey();

async function call(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data && data.error && data.error.message) || `Google returned HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// -> [{ place_id, text, main, secondary }]
async function suggest(input, sessionToken) {
  const body = { input: String(input).slice(0, 200), languageCode: 'en' };
  if (sessionToken) body.sessionToken = String(sessionToken).slice(0, 64);
  if (REGION) body.includedRegionCodes = [REGION];
  const data = await call(`${BASE}/places:autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey() },
    body: JSON.stringify(body),
  });
  return (data.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .slice(0, 6)
    .map((p) => ({
      place_id: p.placeId,
      text: p.text && p.text.text,
      main: p.structuredFormat && p.structuredFormat.mainText && p.structuredFormat.mainText.text,
      secondary: p.structuredFormat && p.structuredFormat.secondaryText && p.structuredFormat.secondaryText.text,
    }));
}

const pick = (components, types) => {
  for (const t of types) {
    const c = components.find((x) => (x.types || []).includes(t));
    if (c) return c;
  }
  return null;
};

// The street part of the address only (house, building, road, area): the full Google address
// with the city, state, pincode and country parts taken off, because those have their own fields.
function streetLine(formatted, comps, { city, state, country, pincode }) {
  const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const drop = [city, state, country].map(norm).filter(Boolean);
  const pin = String(pincode || '');
  const parts = String(formatted || '').split(',').map((x) => x.trim()).filter(Boolean)
    .filter((part) => {
      const n = norm(part);
      if (!n) return false;
      if (pin && n.replace(/\s/g, '').includes(pin)) return false; // "Maharashtra 400703"
      return !drop.some((d) => n === d || n === `${d} ${pin}` || n.replace(/\d/g, '').trim() === d);
    });
  if (parts.length) return parts.join(', ');
  // Nothing left: build it from the address components (building, road, area).
  const order = ['subpremise', 'premise', 'street_number', 'route', 'neighborhood', 'sublocality_level_3', 'sublocality_level_2', 'sublocality_level_1', 'sublocality'];
  const seen = new Set();
  return order
    .map((t) => (comps.find((x) => (x.types || []).includes(t)) || {}).longText)
    .filter((v) => v && !seen.has(norm(v)) && seen.add(norm(v)))
    .join(', ');
}

// -> { address, address_line, pincode, city, state, country, country_code, state_code, latitude, longitude }
async function details(placeId, sessionToken) {
  const qs = new URLSearchParams({ languageCode: 'en' });
  if (sessionToken) qs.set('sessionToken', String(sessionToken).slice(0, 64));
  const data = await call(`${BASE}/places/${encodeURIComponent(placeId)}?${qs}`, {
    headers: { 'X-Goog-Api-Key': apiKey(), 'X-Goog-FieldMask': 'id,formattedAddress,addressComponents,location' },
  });
  const comps = data.addressComponents || [];
  const country = pick(comps, ['country']);
  const state = pick(comps, ['administrative_area_level_1']);
  const city = pick(comps, ['locality', 'postal_town', 'administrative_area_level_3', 'administrative_area_level_2', 'sublocality_level_1']);
  const pin = pick(comps, ['postal_code']);
  const parts = {
    city: city ? city.longText : '',
    state: state ? state.longText : '',
    country: country ? country.longText : '',
    pincode: pin ? String(pin.longText).replace(/\D/g, '') : '',
  };
  return {
    address: data.formattedAddress || '',
    address_line: streetLine(data.formattedAddress, comps, parts),
    pincode: parts.pincode,
    city: parts.city,
    state: parts.state,
    state_code: state ? state.shortText : '',
    country: country ? country.longText : '',
    country_code: country ? country.shortText : '',
    latitude: data.location ? data.location.latitude : null,
    longitude: data.location ? data.location.longitude : null,
  };
}

module.exports = { isConfigured, suggest, details };
