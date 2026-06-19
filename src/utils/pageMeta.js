/**
 * Per-route metadata for the catch-all server page.
 * Derived from the URL path segments (no client hooks needed), so public
 * pages get real <title>/description/OG tags for SEO + social previews.
 */

const SITE = 'Stallion Eyewear';
const DEFAULT_DESC =
  'Certified bulk safety eyewear for industries and enterprises — competitive pricing and reliable supply.';

/**
 * @param {string[]|undefined} slug - catch-all path segments (e.g. ['product','MAS-MYSTIC-C2'])
 * @returns {import('next').Metadata}
 */
export function metadataForSlug(slug) {
  const seg = Array.isArray(slug) ? slug : [];
  const first = seg[0] || '';
  const noindex = ['dashboard', 'login', 'register', 'cart'].includes(first);

  let title = SITE;
  let description = DEFAULT_DESC;

  switch (first) {
    case 'products':
      title = `Shop Eyewear | ${SITE}`;
      description = 'Browse the Stallion eyewear catalogue — frames, sunglasses and safety goggles.';
      break;
    case 'product': {
      const modelNo = seg[1] ? decodeURIComponent(seg[1]) : '';
      title = modelNo ? `${modelNo} | ${SITE}` : `Product | ${SITE}`;
      description = modelNo
        ? `${modelNo} — details, variations and pricing at ${SITE}.`
        : DEFAULT_DESC;
      break;
    }
    case 'about':
      title = `About Us | ${SITE}`;
      description = 'Stallion Eyewear — B2B safety eyewear manufacturing and global distribution.';
      break;
    case 'privacy-policy':
      title = `Privacy Policy | ${SITE}`;
      break;
    case 'cart':
      title = `Your Cart | ${SITE}`;
      break;
    case 'login':
    case 'register':
      title = `Sign in | ${SITE}`;
      break;
    case 'dashboard':
      title = `Dashboard | ${SITE}`;
      break;
    default:
      title = SITE;
  }

  return {
    title,
    description,
    openGraph: { title, description, siteName: SITE, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
