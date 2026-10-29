import { get, SITE_URL } from '../lib/api';
import { jsonLd } from '../lib/seo';

// Organization + WebSite structured data (with the site search box). Add once, inside <body> of layout.jsx:
//   <OrgJsonLd />
export default async function OrgJsonLd() {
  const res = await get('/settings', { revalidate: 300 });
  const store = (res && res.data && res.data.store) || {};
  const name = store.name || 'Stallion';
  const social = store.social || {};
  const sameAs = Object.values(social).filter((u) => typeof u === 'string' && /^https?:\/\//.test(u));
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url: SITE_URL,
    ...(store.logo_url ? { logo: store.logo_url } : {}),
    ...(store.email || store.support_phone
      ? { contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', ...(store.email ? { email: store.email } : {}), ...(store.support_phone ? { telephone: store.support_phone } : {}) }] }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
  const site = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: SITE_URL,
    potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/shop?search={search_term_string}`, 'query-input': 'required name=search_term_string' },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(org)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(site)} />
    </>
  );
}
