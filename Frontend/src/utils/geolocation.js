// Browser Geolocation helper for the on-site "capture location" flow.
//
// Wraps navigator.geolocation.getCurrentPosition in a promise that resolves to
// { latitude, longitude, accuracy } (accuracy in metres) or REJECTS with a
// friendly, user-facing Error message. High-accuracy is requested because the
// captured point becomes the party's trusted geofence anchor.

// The distance a salesman must be within to place a visit order or check in.
// Mirrors the server: 50 m from a precise shop spot (plus up to 25 m for a weak signal),
// 150 m the first time, while the shop's point still comes from its address.
export const GEOFENCE_RADIUS_M = 50;
export const ROUGH_RADIUS_M = 150;
export const ACCURACY_ALLOWANCE_CAP_M = 25;

// Does the party have a saved latitude/longitude (from its address or a first visit)?
export const hasPartyPoint = (p) => !!p
  && p.latitude != null && p.latitude !== '' && Number.isFinite(Number(p.latitude))
  && p.longitude != null && p.longitude !== '' && Number.isFinite(Number(p.longitude));

// How close the phone must be to this party's saved point.
export const visitRadius = (party, accuracy) => (party && party.location_source === 'verified'
  ? GEOFENCE_RADIUS_M + Math.min(Math.max(Number(accuracy) || 0, 0), ACCURACY_ALLOWANCE_CAP_M)
  : ROUGH_RADIUS_M);

// Great-circle distance in metres between two lat/lng points (Haversine).
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function captureCurrentPosition({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not available on this device/browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords || {};
        resolve({ latitude, longitude, accuracy });
      },
      (err) => {
        let message = 'Could not get your location. Please try again.';
        if (err) {
          if (err.code === 1 /* PERMISSION_DENIED */) {
            message = 'Location permission was denied. Please allow location access and try again.';
          } else if (err.code === 2 /* POSITION_UNAVAILABLE */) {
            message = 'Your location is unavailable right now. Move to open sky and try again.';
          } else if (err.code === 3 /* TIMEOUT */) {
            message = 'Getting your location took too long. Please try again.';
          }
        }
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
}
