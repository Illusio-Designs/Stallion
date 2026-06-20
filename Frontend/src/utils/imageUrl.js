// Encode an upload filename for use inside a URL path. Product image files are
// stored with spaces and other characters in their names (the model_no is the
// base name, e.g. "FRAME 52223 LUNA-C2 TRANP GREEN-1781948895807.png"); an
// <img src> with raw spaces fails to load, so the name must be percent-encoded.
// decode-then-encode makes it idempotent — safe whether the name arrives raw or
// already encoded.
export const encodeUploadName = (name) => {
  if (!name) return name;
  const str = String(name);
  try {
    return encodeURIComponent(decodeURIComponent(str));
  } catch {
    return encodeURIComponent(str);
  }
};
