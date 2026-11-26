// Profile photos are stored on the server as a bare file name (for example
// "me-1760000000000.webp") in the uploads/profile folder. The browser needs a
// full path to show one, so everything that displays a profile photo goes
// through resolveProfileImageUrl, and everything that saves one goes through
// toStoredProfileImage.
//
// '/uploads/...' is served by the app itself (Next rewrites it to the API host),
// so it works on every device without cross-origin settings.

export const PROFILE_IMAGE_PATH = '/uploads/profile/';

/** What to put in <img src>. Empty string when there is no photo. */
export function resolveProfileImageUrl(value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  // Already something the browser can load: data URL, full URL, blob, or a path.
  if (/^(data:|https?:|blob:|\/)/i.test(s)) return s;
  return PROFILE_IMAGE_PATH + s;
}

/**
 * What to send to the server as image_url.
 *  - ''        -> the user removed the photo (clear it)
 *  - undefined -> leave the stored photo alone (for example a local data preview)
 *  - string    -> the stored file name
 */
export function toStoredProfileImage(value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  if (/^data:/i.test(s) || /^blob:/i.test(s)) return undefined;
  if (s.startsWith(PROFILE_IMAGE_PATH)) return s.slice(PROFILE_IMAGE_PATH.length);
  return s;
}
