import { SITE_URL } from '../lib/api';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/cart', '/checkout', '/order', '/track'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
