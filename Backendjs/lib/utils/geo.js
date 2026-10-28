// Geo helpers for the visit-order / check-in geofence.
//
// Salesmen must be physically at the party's location to place a visit order or
// check in. We compare the device GPS (sent from the app) against the party's
// stored coordinates and require the distance to be within GEOFENCE_RADIUS_M.

// Radius of the geofence in metres. 100m by default: phone GPS inside a shop drifts
// 20-60m and the saved point can be off by up to 50m, so a tighter fence would
// wrongly reject real visits.
// Overridable via env (GEOFENCE_RADIUS_M) without a redeploy.
const GEOFENCE_RADIUS_M = Number(process.env.GEOFENCE_RADIUS_M) || 50;
// Until a shop has a precise spot (learned from the first visit), its point comes from the
// address and can be off by up to ~100m, so a wider radius is used for that first visit.
const ROUGH_RADIUS_M = Number(process.env.GEOFENCE_ROUGH_RADIUS_M) || 150;
// A visit is refused when the phone itself reports a worse GPS accuracy than this.
const MAX_VISIT_ACCURACY_M = Number(process.env.VISIT_MAX_ACCURACY_M) || 50;
// A weak signal gets up to this much extra distance on top of the radius.
const ACCURACY_ALLOWANCE_CAP_M = Number(process.env.VISIT_ACCURACY_ALLOWANCE_M) || 25;

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

// A party's coordinates ALWAYS come from its ADDRESS (geocoded) — never from a
// salesman's device. On a visit order / check-in we only VERIFY that the
// salesman's device GPS is plausibly near that address. This is deliberately
// coarse (25 km default): address geocoding in India is only accurate to a few
// km, so we reject gross mismatches (e.g. placing a Navi Mumbai party's order
// from Rajkot) while never rejecting legitimate on-site visits. The precise
// distance is still shown in the report's location match meter. Override via
// ADDRESS_PROXIMITY_RADIUS_M.
const ADDRESS_PROXIMITY_RADIUS_M = Number(process.env.ADDRESS_PROXIMITY_RADIUS_M) || 25000;

/**
 * Verify a salesman's device GPS is near the party's geocoded address.
 * @returns {{ ok: boolean, distance: number|null, reason?: string }}
 *   ok:true when there is no address reference to compare against (can't verify),
 *   or when within the proximity radius. ok:false with a reason on a gross mismatch.
 */
function checkAddressProximity({ deviceLat, deviceLng, refLat, refLng }) {
  if (refLat == null || refLng == null || refLat === '' || refLng === '') {
    // No geocoded reference (address couldn't be located) — can't verify, allow.
    return { ok: true, distance: null };
  }
  const distance = distanceMeters(deviceLat, deviceLng, refLat, refLng);
  if (distance == null) return { ok: true, distance: null };
  if (distance > ADDRESS_PROXIMITY_RADIUS_M) {
    const km = Math.round(distance / 1000);
    return {
      ok: false,
      distance,
      reason: `Your current location is about ${km} km from this party's registered address. Please make sure you selected the correct party (or update the party's address if it has moved) before placing a visit order or checking in.`,
    };
  }
  return { ok: true, distance };
}

// ---- On-site capture ("I'm at the shop") validation ----------------------
// A party's trusted location is set ONLY by an on-site capture. Before we store
// it we require:
//   1) a good GPS fix — reported accuracy no worse than CAPTURE_MAX_ACCURACY_M,
//   2) the phone to be near the party's geocoded ADDRESS (within
//      CAPTURE_MAX_ADDRESS_DISTANCE_M) so a wrong shop / wrong city can't be
//      captured (the original Rajkot->Navi Mumbai class of error).
const CAPTURE_MAX_ACCURACY_M = Number(process.env.CAPTURE_MAX_ACCURACY_M) || 50;
const CAPTURE_MAX_ADDRESS_DISTANCE_M = Number(process.env.CAPTURE_MAX_ADDRESS_DISTANCE_M) || 2000;
// A pincode centroid is the middle of a postal area (several km across), so when
// that is all we could resolve we allow a wider distance than for a street match.
const CAPTURE_MAX_PINCODE_DISTANCE_M = Number(process.env.CAPTURE_MAX_PINCODE_DISTANCE_M) || 8000;

/**
 * Validate an on-site location capture.
 *
 * The phone must be near the party's geocoded address. How near depends on how
 * precisely the address resolved (refPrecision): 'address' uses the tight limit,
 * 'pincode' the wider one. A city/state centroid, or no result at all, cannot
 * prove the person is at the shop, so the capture is accepted but flagged
 * accepted as it is (noReference: true) when the GPS fix itself is good.
 * @returns {{ ok: boolean, distance: number|null, reason?: string, noReference?: boolean }}
 */
function validateOnsiteCapture({ deviceLat, deviceLng, accuracy, refLat, refLng, refPrecision, allowFarFromAddress = false }) {
  const lat = Number(deviceLat), lng = Number(deviceLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, distance: null, reason: 'A valid current location is required. Please enable GPS and try again.' };
  }
  const acc = Number(accuracy);
  if (!Number.isFinite(acc) || acc <= 0) {
    return { ok: false, distance: null, reason: 'Your device did not report GPS accuracy. Move outside/near a window and try again.' };
  }
  if (acc > CAPTURE_MAX_ACCURACY_M) {
    return {
      ok: false,
      distance: null,
      reason: `GPS signal is too weak (accurate to only ${Math.round(acc)}m). Move to open sky and try again — it must be within ${CAPTURE_MAX_ACCURACY_M}m.`,
    };
  }
  const hasRef = refLat != null && refLng != null && refLat !== '' && refLng !== '';
  // 'precise' is the default for callers that don't say how the address resolved.
  const precision = refPrecision || 'address';
  if (!hasRef || precision === 'city' || precision === 'state') {
    // The map cannot place this address, so the phone cannot be compared with it.
    // A good GPS fix is enough: the capture is accepted as it is.
    return { ok: true, distance: null, noReference: true };
  }
  const limit = precision === 'pincode' ? CAPTURE_MAX_PINCODE_DISTANCE_M : CAPTURE_MAX_ADDRESS_DISTANCE_M;
  const distance = distanceMeters(lat, lng, refLat, refLng);
  if (distance != null && distance > limit) {
    // The written address may simply be wrong or incomplete. With a good GPS fix the
    // salesman can confirm he is at the right shop and save the spot anyway.
    if (allowFarFromAddress) return { ok: true, distance, farFromAddress: true };
    const km = (distance / 1000).toFixed(distance >= 10000 ? 0 : 1);
    return {
      ok: false,
      distance,
      farFromAddress: true,
      reason: `You are about ${km} km from this party's written address. If you are at the right shop and the address is wrong, open Edit party: the address is updated from your location and the spot is kept. Otherwise check that you picked the correct party.`,
    };
  }
  return { ok: true, distance };
}

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

/**
 * Visit order / check-in distance rule: the straight-line distance (Haversine) between
 * the party's saved latitude/longitude and the phone's latitude/longitude.
 *  - party has a precise ("verified") spot: within GEOFENCE_RADIUS_M (50m) plus an
 *    allowance for a weak signal (the phone's reported accuracy, at most 25m extra);
 *  - party only has a point from its address: within ROUGH_RADIUS_M (150m). When that
 *    passes with a good GPS fix, `learn: true` tells the caller to save the phone's
 *    position as the shop's precise spot, so later visits use the 50m rule;
 *  - party has no point at all: refused with code 'no_location' (edit the party).
 * @returns {{ ok: boolean, distance: number|null, mode?: 'precise'|'rough', learn?: boolean, code?: string, reason?: string }}
 */
function checkVisitLocation({ deviceLat, deviceLng, accuracy, party, action = 'perform this action' }) {
  const lat = Number(deviceLat), lng = Number(deviceLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, distance: null, code: 'no_gps', reason: 'A valid current location is required. Please turn on location and try again.' };
  }
  const acc = Number(accuracy);
  const hasAcc = Number.isFinite(acc) && acc > 0;
  if (hasAcc && acc > MAX_VISIT_ACCURACY_M) {
    return { ok: false, distance: null, code: 'weak_gps', reason: `GPS signal is too weak (accurate to only ${Math.round(acc)}m). Move to open sky and try again; it must be within ${MAX_VISIT_ACCURACY_M}m.` };
  }
  const pLat = party && (party.latitude ?? party.lat);
  const pLng = party && (party.longitude ?? party.lng);
  if (pLat == null || pLng == null || pLat === '' || pLng === '') {
    return { ok: false, distance: null, code: 'no_location', reason: "This party has no location yet. Edit the party and pick its address, then try again." };
  }
  const distance = distanceMeters(lat, lng, pLat, pLng);
  if (distance == null) {
    return { ok: false, distance: null, code: 'no_gps', reason: 'A valid current location is required.' };
  }
  const precise = party.location_source === 'verified';
  const allowed = precise
    ? GEOFENCE_RADIUS_M + (hasAcc ? Math.min(acc, ACCURACY_ALLOWANCE_CAP_M) : 0)
    : ROUGH_RADIUS_M;
  if (distance > allowed) {
    return {
      ok: false,
      distance,
      mode: precise ? 'precise' : 'rough',
      code: 'too_far',
      reason: precise
        ? `You must be within ${GEOFENCE_RADIUS_M}m of the party to ${action}. You are about ${Math.round(distance)}m away.`
        : `You are about ${Math.round(distance)}m from this party's address (limit ${ROUGH_RADIUS_M}m). Move closer to the shop, or check the party's address.`,
    };
  }
  return { ok: true, distance, mode: precise ? 'precise' : 'rough', learn: !precise && hasAcc };
}

module.exports = {
  GEOFENCE_RADIUS_M,
  ROUGH_RADIUS_M,
  MAX_VISIT_ACCURACY_M,
  checkVisitLocation,
  ADDRESS_PROXIMITY_RADIUS_M,
  CAPTURE_MAX_ACCURACY_M,
  CAPTURE_MAX_ADDRESS_DISTANCE_M,
  CAPTURE_MAX_PINCODE_DISTANCE_M,
  distanceMeters,
  checkGeofence,
  checkAddressProximity,
  validateOnsiteCapture,
};
