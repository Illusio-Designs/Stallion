import { get, SITE_URL } from './api';

// Metadata for a page, using the SEO row the admin set for that path (falls back to the given defaults).
export async function pageMetadata(path, defaults = {}) {
  const res = await get(`/seo?path=${encodeURIComponent(path)}`, { revalidate: 300 });
  const seo = (res && res.data) || {};
  const title = seo.title || defaults.title || 'Stallion';
  const description = seo.description || defaults.description || '';
  const image = seo.og_image || defaults.image || null;
  const canonical = seo.canonical || `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: seo.noindex ? { index: false, follow: false } : undefined,
    openGraph: { title, description, url: canonical, type: defaults.type || 'website', images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description },
  };
}

// <script type="application/ld+json"> payload helper.
export const jsonLd = (obj) => ({ __html: JSON.stringify(obj).replace(/</g, '\\u003c') });
