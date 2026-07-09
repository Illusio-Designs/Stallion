// Address -> coordinates (geocoding) for the party geofence.
//
// The geofence compares the salesman's device GPS against the party's location,
// derived from the party's ADDRESS via geocoding (OpenStreetMap Nominatim by
// default; set GEOCODER_URL / GEOCODER_KEY to switch providers).
//
// Geocoding is best-effort: callers treat a null result as "unknown location".
// The functions log the failure reason so server logs reveal whether the
// address didn't resolve or the server can't reach the geocoder at all.

const GEOCODER_URL = process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search';
const GEOCODER_KEY = process.env.GEOCODER_KEY || '';
const GEOCODER_UA = process.env.GEOCODER_UA || 'StallionEyewear/1.0 (illusiodesigns@gmail.com)';

// Run a single geocoder query. Returns a detailed result so callers (and the
// diagnostic endpoint) can tell WHY it failed.
// -> { ok, status?, coords?, error? }
async function geocodeQuery(q) {
  if (!q || !String(q).trim()) return { ok: false, error: 'empty query' };
  const url = new URL(GEOCODER_URL);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  if (GEOCODER_KEY) url.searchParams.set('key', GEOCODER_KEY);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': GEOCODER_UA, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, status: res.status, error: `geocoder returned HTTP ${res.status}` };
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : (data && data.results && data.results[0]);
    if (!hit) return { ok: false, status: res.status, error: 'no match for this address' };
    const lat = Number(hit.lat ?? hit.latitude ?? (hit.geometry && hit.geometry.location && hit.geometry.location.lat));
    const lon = Number(hit.lon ?? hit.lng ?? (hit.geometry && hit.geometry.location && hit.geometry.location.lng));
    if (Number.isNaN(lat) || Number.isNaN(lon)) return { ok: false, error: 'match had no coordinates' };
    return { ok: true, coords: { latitude: lat, longitude: lon } };
  } catch (e) {
    const reason = e && e.name === 'AbortError' ? 'timeout (server could not reach the geocoder in 8s)'
      : (e && e.message) || 'network error';
    return { ok: false, error: `request failed: ${reason}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Geocode an address to { latitude, longitude } or null. Tries progressively
 * coarser queries and returns the first hit. The PINCODE is prioritised right
 * after the full address because an Indian pincode pins a locality far better
 * than "city, state" (which falls back to the state centroid — e.g. a Vapi
 * address geocoding to the middle of Gujarat).
 */
async function geocodeAddress(address, opts = {}) {
  const country = opts.country || 'India';
  const pin = opts.pincode && String(opts.pincode).trim();
  const attempts = [
    [address, opts.city, opts.state, pin, country],   // full, most specific
    [pin, opts.city, opts.state, country],            // pincode + locality
    [pin, country],                                   // pincode alone -> the postal area
    [opts.city, opts.state, country],                 // city + state
    [opts.state, country],                            // state centroid (last resort)
  ];
  for (const parts of attempts) {
    const q = parts.filter(Boolean).join(', ').trim();
    if (!q) continue;
    const r = await geocodeQuery(q);
    if (r.ok) {
      console.log('[geocode] resolved via:', q, '->', r.coords.latitude, r.coords.longitude);
      return r.coords;
    }
  }
  console.warn('[geocode] FAILED for address:', address, 'pin:', pin);
  return null;
}

/**
 * Detailed geocode for the diagnostic endpoint — returns the query, result and
 * the exact failure reason so we can see if the server can reach the geocoder.
 */
async function geocodeDiagnostic(address, opts = {}) {
  const full = [address, opts.city, opts.state, opts.pincode, opts.country || 'India'].filter(Boolean).join(', ');
  const r = await geocodeQuery(full);
  return { geocoderUrl: GEOCODER_URL, query: full, ...r };
}

/**
 * Ensure a Party instance has coordinates, geocoding its address (enriched with
 * city/state) on demand and persisting them if missing. Best-effort.
 */
async function ensurePartyCoords(party) {
  if (!party) return party;
  if (party.latitude != null && party.longitude != null) return party;
  if (!party.address) return party;
  let city, state;
  try {
    const Cities = require('../models/Cities');
    const State = require('../models/State');
    if (party.city_id) { const c = await Cities.findByPk(party.city_id); city = c && c.name; }
    if (party.state_id) { const s = await State.findByPk(party.state_id); state = s && s.name; }
  } catch (_) { /* models unavailable — geocode with the address alone */ }
  const coords = await geocodeAddress(party.address, { city, state, pincode: party.pincode });
  if (coords) {
    party.latitude = coords.latitude;
    party.longitude = coords.longitude;
    try { await party.save(); } catch (_) { /* ignore persistence errors */ }
  }
  return party;
}

module.exports = { geocodeAddress, geocodeDiagnostic, ensurePartyCoords };
