// Geo helpers for the visit-order / check-in geofence.
//
// Salesmen must be physically at the party's location to place a visit order or
// check in. We compare the device GPS (sent from the app) against the party's
// stored coordinates and require the distance to be within GEOFENCE_RADIUS_M.

// Radius of the geofence in metres. 250m by default: coordinates come from
// GEOCODING the party's address, which is rarely accurate to 50m (especially
// for Indian addresses), so a tighter fence would wrongly reject real visits.
// Overridable via env (GEOFENCE_RADIUS_M) without a redeploy.
const GEOFENCE_RADIUS_M = Number(process.env.GEOFENCE_RADIUS_M) || 250;

const toRad = (deg) => (Number(deg) * Math.PI) / 180;

/**
 * Great-circle distance between two lat/lng points, in metres (Haversine).
 * Returns null if any coordinate is missing/invalid.
 */
function distanceMeters(lat1, lon1, lat2, lon2) {
  const a1 = Number(lat1), o1 = Number(lon1), a2 = Number(lat2), o2 = Number(lon2);
  if ([a1, o1, a2, o2].some((v) => Number.isNaN(v))) return null;
  const R = 6371000; // Earth radius in metres
  const dLat = toRad(a2 - a1);
  const dLon = toRad(o2 - o1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Enforce the geofence between a device position and a party.
 * @returns {{ ok: boolean, distance: number|null, reason?: string }}
 *   ok:true when the party has no coordinates yet (can't enforce — don't block),
 *   or when within radius. ok:false with a reason when out of range.
 */
// When true, an order/check-in is BLOCKED if the party's location can't be
// determined (fail-closed). Default false (fail-open) so a geocoder outage
// can't block every visit at once. Turn on once geocoding is confirmed working.
const GEOFENCE_REQUIRE_COORDS = String(process.env.GEOFENCE_REQUIRE_COORDS || '').toLowerCase() === 'true';

function checkGeofence({ deviceLat, deviceLng, party, action = 'perform this action' }) {
  const pLat = party && (party.latitude ?? party.lat);
  const pLng = party && (party.longitude ?? party.lng);
  // No party coordinates on record — either allow (default) or, in strict mode,
  // block because we can't verify the salesman is actually on-site.
  if (pLat == null || pLng == null || pLat === '' || pLng === '') {
    if (GEOFENCE_REQUIRE_COORDS) {
      return { ok: false, distance: null, reason: `Could not verify the party's location from its address, so this visit can't be confirmed. Please correct the party address.` };
    }
    return { ok: true, distance: null };
  }
  const distance = distanceMeters(deviceLat, deviceLng, pLat, pLng);
  if (distance == null) {
    return { ok: false, distance: null, reason: 'A valid current location is required.' };
  }
  if (distance > GEOFENCE_RADIUS_M) {
    return {
      ok: false,
      distance,
      reason: `You must be within ${GEOFENCE_RADIUS_M}m of the party to ${action}. You are about ${Math.round(distance)}m away.`,
    };
  }
  return { ok: true, distance };
}

module.exports = { GEOFENCE_RADIUS_M, distanceMeters, checkGeofence };
