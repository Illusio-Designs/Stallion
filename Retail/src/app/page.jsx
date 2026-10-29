import Link from 'next/link';
import '../styles/home.css';
import ProductCard from '../components/ProductCard';
import Glasses from '../components/Glasses';
import { get, SITE_URL } from '../lib/api';
import { pageMetadata, jsonLd } from '../lib/seo';
import { dateShort } from '../lib/format';

export async function generateMetadata() {
  return pageMetadata('/', {
    title: 'Stallion eyewear | Everyday frames online',
    description: 'Light, honest-priced sunglasses and eyeglasses in every shape. Free delivery over the free shipping amount and easy returns.',
  });
}

const DEFAULT_BANNER = { headline: 'Frames you will actually wear every day.', sub: 'Honest prices, free delivery on bigger orders and easy returns.', cta_label: 'Shop frames', cta_url: '/shop' };
const DEFAULT_USPS = [
  { title: 'Genuine frames', text: 'Quality checked before dispatch' }, { title: 'Easy returns', text: 'Simple, no questions' },
  { title: 'Fast delivery', text: 'Across India' }, { title: 'Help when you need it', text: 'Talk to a real person' },
];
const isLocal = (u) => typeof u === 'string' && u.startsWith('/');

export default async function Home() {
  const [homeRes, setRes] = await Promise.all([get('/home', { revalidate: 120 }), get('/settings', { revalidate: 300 })]);
  const home = (homeRes && homeRes.data) || {};
  const settings = (setRes && setRes.data) || {};
  const banner = { ...DEFAULT_BANNER, ...(home.banner || settings.banner || {}) };
  const usps = (Array.isArray(settings.usps) && settings.usps.length ? settings.usps : DEFAULT_USPS).slice(0, 4);
  const featured = Array.isArray(home.featured) ? home.featured : [];
  const shapes = Array.isArray(home.shapes) ? home.shapes : [];
  const posts = Array.isArray(home.posts) ? home.posts.slice(0, 3) : [];
  const wholesaleUrl = process.env.NEXT_PUBLIC_WHOLESALE_URL || '';
  const storeName = (settings.store && settings.store.name) || 'Stallion';
  const cta = banner.cta_url || '/shop';

  const site = {
    '@context': 'https://schema.org', '@type': 'WebSite', name: storeName, url: SITE_URL,
    potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/shop?search={search_term_string}`, 'query-input': 'required name=search_term_string' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(site)} />

      <section className="wrap sec hm-hero">
        <div className="hm-hero__txt">
          <div className="eyebrow">New season frames</div>
          <h1>{banner.headline}</h1>
          {banner.sub ? <p>{banner.sub}</p> : null}
          <div className="hm-hero__cta">
            {isLocal(cta) ? <Link className="btn btn--pri" href={cta}>{banner.cta_label || 'Shop frames'}</Link> : <a className="btn btn--pri" href={cta}>{banner.cta_label || 'Shop frames'}</a>}
            <Link className="btn" href="/blog">Find your face shape</Link>
          </div>
        </div>
        <div className="photo hm-hero__img">
          {banner.image ? <img src={banner.image} alt="" fetchPriority="high" /> : <Glasses />}
        </div>
      </section>

      <section className="wrap sec" aria-label="Why shop with us">
        <ul className="hm-usp">
          {usps.map((u, i) => <li key={i}><b>{u.title}</b><span>{u.text}</span></li>)}
        </ul>
      </section>

      {shapes.length ? (
        <section className="wrap sec" aria-labelledby="hm-shapes">
          <div className="row"><h2 id="hm-shapes" className="hm-h2">Shop by shape</h2><Link className="hm-link" href="/shop">View all</Link></div>
          <div className="grid hm-shapes">
            {shapes.slice(0, 4).map((s) => (
              <Link key={s.name} href={`/shop?shape=${encodeURIComponent(s.name)}`} className="hm-shape">
                <div className="photo">{s.image ? <img src={s.image} alt="" loading="lazy" /> : <Glasses />}</div>
                <div className="hm-shape__n"><span>{s.name}</span><span aria-hidden="true">&#8594;</span></div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="wrap sec" aria-labelledby="hm-best">
        <div className="row"><h2 id="hm-best" className="hm-h2">Best sellers</h2><Link className="hm-link" href="/shop">Shop all</Link></div>
        {featured.length ? (
          <div className="grid grid--cards hm-best">{featured.slice(0, 8).map((p) => <ProductCard key={p.id} p={p} />)}</div>
        ) : (
          <div className="box hm-empty">
            <b>{homeRes ? 'Frames are coming soon' : 'We can’t load frames right now'}</b>
            <p className="mute">{homeRes ? 'Check back in a little while, or browse the shop.' : 'Please try again in a moment.'}</p>
            <Link className="btn" href="/shop">Browse the shop</Link>
          </div>
        )}
      </section>

      {wholesaleUrl ? (
        <section className="hm-band">
          <div className="wrap sec">
            <div className="eyebrow">For opticians and retailers</div>
            <h2>Stocking frames for your shop?</h2>
            <p>Wholesale prices, sample trays and a salesman who visits. Log in to the retailer app or ask to become a retailer.</p>
            <div className="hm-band__cta">
              <a className="btn hm-band__b1" href={wholesaleUrl}>Wholesale login</a>
              <Link className="btn hm-band__b2" href="/contact">Become a retailer</Link>
            </div>
          </div>
        </section>
      ) : null}

      {posts.length ? (
        <section className="wrap sec" aria-labelledby="hm-blog">
          <div className="row"><h2 id="hm-blog" className="hm-h2">From the blog</h2><Link className="hm-link" href="/blog">All articles</Link></div>
          <div className="grid hm-posts">
            {posts.map((b) => (
              <Link key={b.slug} href={`/blog/${b.slug}`} className="hm-post">
                <div className="photo hm-post__ph">{b.cover_image ? <img src={b.cover_image} alt="" loading="lazy" /> : <Glasses />}</div>
                <div className="hm-post__bd">
                  <b>{b.title}</b>
                  <span>{[b.published_at ? dateShort(b.published_at) : null, b.read_minutes ? `${b.read_minutes} min read` : null, b.tags && b.tags[0]].filter(Boolean).join(' · ')}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
