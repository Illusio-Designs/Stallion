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

// Local placeholder shown when a product has no usable remote image. Same asset
// the storefront/product pages fall back to.
export const PRODUCT_IMAGE_PLACEHOLDER = '/images/products/spac1.webp';

// Image host: the upload server that serves /uploads/products/<file>. Same base
// the storefront and product-detail pages use (NEXT_PUBLIC_IMAGE_BASE_URL).
const IMAGE_BASE_URL = (process.env.NEXT_PUBLIC_IMAGE_BASE_URL || 'https://api.stallioneyewear.in').replace(/\/+$/, '');

// Pull a clean filename out of a stored image value. Handles bare filenames,
// "/uploads/products/x.webp" paths, full URLs, query/fragment, and trailing
// JSON junk (\", ], \) left over from historically double-encoded columns.
const extractUploadFilename = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') return null;
  const cleanPath = imagePath.split('?')[0].split('#')[0].replace(/([\]"\\])+$/, '');
  const filename = cleanPath.split('/').pop().split('\\').pop().replace(/([\]"\\])+$/, '');
  return filename && filename.includes('.') ? filename : null;
};

// Normalise the image_urls column into an array. It has been stored as a real
// array, an empty array, the string "[]", a JSON string, or even a
// double-encoded JSON string — handle them all.
const parseStoredImageUrls = (imageUrls) => {
  if (!imageUrls) return null;
  if (Array.isArray(imageUrls)) return imageUrls;
  if (typeof imageUrls === 'string') {
    try {
      let parsed = JSON.parse(imageUrls);
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { /* keep first parse */ }
      }
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'string') return [parsed];
    } catch {
      if (imageUrls.trim().length > 0 && imageUrls !== '[]') return [imageUrls];
    }
  }
  return null;
};

/**
 * Resolve a product's primary image URL exactly like the storefront/product
 * pages: first entry of image_urls -> the legacy image_url -> local placeholder.
 * Always returns a renderable src (never null), so an image always shows.
 */
export const getProductImageUrl = (product) => {
  if (!product) return PRODUCT_IMAGE_PLACEHOLDER;
  const urls = parseStoredImageUrls(product.image_urls);
  if (urls && urls.length > 0) {
    for (const u of urls) {
      const filename = extractUploadFilename(u);
      if (filename) return `${IMAGE_BASE_URL}/uploads/products/${encodeUploadName(filename)}`;
    }
  }
  const fallbackFilename = extractUploadFilename(product.image_url);
  if (fallbackFilename) return `${IMAGE_BASE_URL}/uploads/products/${encodeUploadName(fallbackFilename)}`;
  return PRODUCT_IMAGE_PLACEHOLDER;
};

/**
 * Resolve any stored upload path (e.g. "/uploads/salesman/pan_card-…") to a
 * full, renderable URL on the upload host. Full URLs are returned as-is; empty
 * values return ''. The final path segment (the filename) is percent-encoded.
 */
export const resolveUploadUrl = (path) => {
  if (!path || typeof path !== 'string') return '';
  const trimmed = path.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const clean = trimmed.replace(/^\/+/, '');
  const idx = clean.lastIndexOf('/');
  const dir = idx >= 0 ? clean.slice(0, idx) : '';
  const file = idx >= 0 ? clean.slice(idx + 1) : clean;
  const encoded = dir ? `${dir}/${encodeURIComponent(file)}` : encodeURIComponent(file);
  return `${IMAGE_BASE_URL}/${encoded}`;
};
