import Link from 'next/link';
import { notFound } from 'next/navigation';
import '../../../styles/article.css';
import Crumbs from '../../../components/Crumbs';
import ShareButton from '../../../components/ShareButton';
import ProductCard from '../../../components/ProductCard';
import Glasses from '../../../components/Glasses';
import { get, SITE_URL } from '../../../lib/api';
import { cleanHtml } from '../../../lib/html';
import { dateLong } from '../../../lib/format';
import { jsonLd, pageMetadata } from '../../../lib/seo';

export const revalidate = 300;

const loadPost = (slug) => get(`/blog/${encodeURIComponent(slug)}`, { revalidate: 300 }).then((r) => (r && r.data) || null);

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return { title: 'Article not found', robots: { index: false, follow: false } };
  const seo = post.seo || {};
  const meta = await pageMetadata(`/blog/${slug}`, {
    title: seo.title || post.title,
    description: seo.description || post.summary || '',
    image: seo.og_image || post.cover_image,
    type: 'article',
  });
  meta.openGraph = { ...meta.openGraph, type: 'article', publishedTime: post.published_at, modifiedTime: post.updated_at || post.published_at, tags: post.tags };
  return meta;
}

export default async function PostPage({ params }) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug || slug}`;
  const author = post.author || 'The Stallion team';
  const related = (post.related_products || []).slice(0, 4);
  const tag = (post.tags || [])[0];

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: (post.seo && post.seo.description) || post.summary || undefined,
    image: post.cover_image ? [post.cover_image] : undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: { '@type': post.author ? 'Person' : 'Organization', name: author },
    publisher: { '@type': 'Organization', name: 'Stallion', url: SITE_URL },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    keywords: (post.tags || []).join(', ') || undefined,
  };
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(article)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(crumbs)} />
      <article className="wrap sec">
        <div className="art">
          <Crumbs items={[{ label: 'Blog', href: '/blog' }, ...(tag ? [{ label: tag, href: `/blog?tag=${encodeURIComponent(tag)}` }] : []), { label: post.title }]} />
          <h1 className="art__title">{post.title}</h1>
          <p className="art__meta">
            By {author}
            {post.published_at ? <> · <time dateTime={post.published_at}>{dateLong(post.published_at)}</time></> : null}
            {post.read_minutes ? ` · ${post.read_minutes} min read` : ''}
          </p>
          <div className="photo art__cover">
            {post.cover_image
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={post.cover_image} alt={post.title} fetchPriority="high" />
              : <Glasses />}
          </div>
          {post.summary ? <p className="art__lede">{post.summary}</p> : null}
          <div className="prose" dangerouslySetInnerHTML={{ __html: cleanHtml(post.body) }} />
          {(post.tags || []).length > 0 && (
            <div className="filters art__tags" aria-label="Topics">
              {post.tags.map((t) => <Link key={t} href={`/blog?tag=${encodeURIComponent(t)}`} className="chip">{t}</Link>)}
            </div>
          )}
          <div className="art__foot">
            <ShareButton />
            <Link href="/blog" className="btn">More articles</Link>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="wrap sec" aria-labelledby="rel-h">
          <h2 id="rel-h" style={{ fontSize: 22 }}>Frames mentioned in this article</h2>
          <div className="grid grid--cards">
            {related.map((p) => <ProductCard key={p.id || p.slug} p={p} />)}
          </div>
        </section>
      )}
    </>
  );
}
