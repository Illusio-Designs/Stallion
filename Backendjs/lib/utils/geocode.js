// Address -> coordinates (geocoding) for the party geofence.
//
// The geofence compares the salesman's device GPS against the party's location.
// That location is derived from the party's ADDRESS via geocoding (no manual GPS
// capture). We use OpenStreetMap Nominatim by default (free, no API key); set
// GEOCODER_URL / GEOCODER_KEY to point at another provider if needed.
//
// Geocoding is best-effort: callers must treat a null result as "unknown
// location" (the geofence then can't enforce and won't block) — never fail the
// surrounding request because geocoding failed.

const GEOCODER_URL = process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search';
const GEOCODER_KEY = process.env.GEOCODER_KEY || '';
// Nominatim asks for an identifying User-Agent with a contact address.
const GEOCODER_UA = process.env.GEOCODER_UA || 'StallionEyewear/1.0 (illusiodesigns@gmail.com)';

/**
 * Geocode a free-text address to { latitude, longitude }, or null if it can't
 * be resolved. Extra locality parts (pincode, "India") improve the hit rate.
 * @param {string} address
 * @param {{ pincode?: string, country?: string }} [opts]
 * @returns {Promise<{latitude:number, longitude:number}|null>}
 */
async function geocodeAddress(address, opts = {}) {
  const parts = [address, opts.pincode, opts.country || 'India'].filter(Boolean);
  const q = parts.join(', ').trim();
  if (!q) return null;

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
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : (data.results && data.results[0]);
    if (!hit) return null;
    const lat = Number(hit.lat ?? hit.latitude ?? hit.geometry?.location?.lat);
    const lon = Number(hit.lon ?? hit.lng ?? hit.longitude ?? hit.geometry?.location?.lng);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { latitude: lat, longitude: lon };
  } catch (_) {
    return null; // network/timeout/parse — treat as unknown
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ensure a Party instance has coordinates, geocoding its address on demand and
 * persisting them if missing. This is how EXISTING parties auto-collect their
 * location the first time they're used in a geofence check — no manual step.
 * Best-effort: returns the (possibly unchanged) party; never throws.
 * @param {object} party - a Sequelize Party instance (has .save())
 * @returns {Promise<object>} the party
 */
async function ensurePartyCoords(party) {
  if (!party) return party;
  if (party.latitude != null && party.longitude != null) return party;
  if (!party.address) return party;
  const coords = await geocodeAddress(party.address, { pincode: party.pincode });
  if (coords) {
    party.latitude = coords.latitude;
    party.longitude = coords.longitude;
    try { await party.save(); } catch (_) { /* ignore persistence errors */ }
  }
  return party;
}

module.exports = { geocodeAddress, ensurePartyCoords };
