import Link from 'next/link';
import { notFound } from 'next/navigation';
import '../../../styles/article.css';
import '../../../styles/content.css';
import Crumbs from '../../../components/Crumbs';
import { get } from '../../../lib/api';
import { cleanHtml } from '../../../lib/html';
import { dateLong } from '../../../lib/format';
import { pageMetadata } from '../../../lib/seo';

export const revalidate = 600;
export const dynamicParams = false;

const POLICIES = {
  privacy: { title: 'Privacy policy', blurb: 'How we collect, use and protect your information.' },
  terms: { title: 'Terms of service', blurb: 'The terms that apply when you use our store and buy from us.' },
  returns: { title: 'Returns and refunds', blurb: 'How to return a frame and when you get your money back.' },
  shipping: { title: 'Shipping and delivery', blurb: 'Delivery areas, timelines, charges and cash on delivery.' },
};

export const generateStaticParams = () => Object.keys(POLICIES).map((key) => ({ key }));

export async function generateMetadata({ params }) {
  const { key } = await params;
  const policy = POLICIES[key];
  if (!policy) return { title: 'Page not found' };
  const res = await get(`/pages/${key}`, { revalidate: 600 });
  const page = res && res.data;
  return pageMetadata(`/policies/${key}`, { title: (page && page.title) || policy.title, description: policy.blurb });
}

export default async function PolicyPage({ params }) {
  const { key } = await params;
  const policy = POLICIES[key];
  if (!policy) notFound();
  const res = await get(`/pages/${key}`, { revalidate: 600 });
  const page = res && res.data;

  return (
    <div className="wrap sec">
      <article className="art">
        <Crumbs items={[{ label: 'Home', href: '/' }, { label: (page && page.title) || policy.title }]} />
        <h1 className="art__title">{(page && page.title) || policy.title}</h1>
        {page && page.updated_at ? <p className="art__meta">Last updated <time dateTime={page.updated_at}>{dateLong(page.updated_at)}</time></p> : null}
        {page && page.body ? (
          <div className="prose" dangerouslySetInnerHTML={{ __html: cleanHtml(page.body) }} />
        ) : (
          <div className="box">
            <b>{res ? 'This page is not written yet' : 'We could not load this page'}</b>
            <p className="mute">{res ? 'Please check back soon, or get in touch and we will answer any question.' : 'Please try again in a minute, or get in touch and we will help.'}</p>
            <Link href="/contact" className="btn">Contact us</Link>
          </div>
        )}
        <nav className="plinks" aria-label="Other policies">
          {Object.entries(POLICIES).filter(([k]) => k !== key).map(([k, p]) => <Link key={k} href={`/policies/${k}`} className="chip">{p.title}</Link>)}
        </nav>
      </article>
    </div>
  );
}
