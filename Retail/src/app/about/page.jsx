import Link from 'next/link';
import '../../styles/article.css';
import '../../styles/content.css';
import Glasses from '../../components/Glasses';
import { get } from '../../lib/api';
import { cleanHtml } from '../../lib/html';
import { pageMetadata } from '../../lib/seo';

export const revalidate = 600;

const FALLBACK_TITLE = 'We make frames for people who wear them all day.';
const FALLBACK_INTRO = 'Stallion started by supplying frames to opticians. Now anyone can buy the same frames directly, at one honest price.';

export async function generateMetadata() {
  const res = await get('/pages/about', { revalidate: 600 });
  const page = res && res.data;
  return pageMetadata('/about', {
    title: (page && page.title) || 'About us',
    description: 'Who we are, where our frames come from and how we look after you.',
  });
}

export default async function AboutPage() {
  const [pageRes, setRes] = await Promise.all([get('/pages/about', { revalidate: 600 }), get('/settings', { revalidate: 300 })]);
  const page = pageRes && pageRes.data;
  const s = (setRes && setRes.data) || {};
  const usps = Array.isArray(s.usps) ? s.usps : [];
  const wholesaleUrl = process.env.NEXT_PUBLIC_WHOLESALE_URL || '';

  return (
    <>
      <div className="wrap sec">
        <div className="hero">
          <div>
            <div className="eyebrow">About {(s.store && s.store.name) || 'Stallion'}</div>
            <h1>{page && page.title ? page.title : FALLBACK_TITLE}</h1>
            {!page ? <p className="hero__p">{FALLBACK_INTRO}</p> : null}
            <div className="hero__cta">
              <Link href="/shop" className="btn btn--pri">Shop frames</Link>
              <Link href="/contact" className="btn">Contact us</Link>
            </div>
          </div>
          <div className="photo hero__ph"><Glasses /></div>
        </div>
      </div>

      {usps.length > 0 && (
        <div className="wrap sec">
          <ul className="usp">
            {usps.map((u) => (
              <li key={u.title}><b>{u.title}</b><span>{u.text}</span></li>
            ))}
          </ul>
        </div>
      )}

      {page && page.body ? (
        <div className="wrap sec">
          <article className="art">
            <div className="prose" dangerouslySetInnerHTML={{ __html: cleanHtml(page.body) }} />
          </article>
        </div>
      ) : null}

      {wholesaleUrl ? (
        <div className="band">
          <div className="wrap sec">
            <h2 style={{ fontSize: 24 }}>Own an optical shop?</h2>
            <p>Get wholesale prices, sample trays and a dedicated salesman.</p>
            <a href={wholesaleUrl} className="btn band__btn">Wholesale login</a>
          </div>
        </div>
      ) : null}
    </>
  );
}
