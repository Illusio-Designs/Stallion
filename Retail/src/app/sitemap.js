import { get, SITE_URL } from '../lib/api';

export const revalidate = 3600;

// Used when the API cannot be reached, so the sitemap is never empty.
const STATIC = ['/', '/shop', '/blog', '/about', '/contact', '/help', '/policies/shipping', '/policies/returns', '/policies/privacy', '/policies/terms'];
const FREQ = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);

export default async function sitemap() {
  const res = await get('/sitemap', { revalidate: 3600 });
  const rows = res && Array.isArray(res.data) && res.data.length ? res.data : STATIC.map((path) => ({ path, changefreq: 'weekly', priority: path === '/' ? 1 : 0.6 }));
  return rows
    .filter((r) => r && typeof r.path === 'string')
    .map((r) => {
      const lm = r.lastmod ? new Date(r.lastmod) : null;
      const pr = Number(r.priority);
      return {
        url: `${SITE_URL}${r.path === '/' ? '' : r.path.startsWith('/') ? r.path : `/${r.path}`}`,
        ...(lm && !Number.isNaN(lm.getTime()) ? { lastModified: lm } : {}),
        ...(FREQ.has(r.changefreq) ? { changeFrequency: r.changefreq } : {}),
        ...(pr >= 0 && pr <= 1 ? { priority: pr } : {}),
      };
    });
}
