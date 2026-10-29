import Link from 'next/link';
import '../../styles/article.css';
import '../../styles/blog.css';
import PostCard from '../../components/PostCard';
import { get, SITE_URL } from '../../lib/api';
import { pageMetadata } from '../../lib/seo';

export const revalidate = 120;

const PER_PAGE = 9;
const num = (v) => Math.max(1, parseInt(Array.isArray(v) ? v[0] : v, 10) || 1);
const one = (v) => (Array.isArray(v) ? v[0] : v) || '';

function blogHref({ tag, page }) {
  const q = new URLSearchParams();
  if (tag) q.set('tag', tag);
  if (page > 1) q.set('page', String(page));
  const s = q.toString();
  return s ? `/blog?${s}` : '/blog';
}

export async function generateMetadata({ searchParams }) {
  const sp = await searchParams;
  const tag = one(sp.tag);
  const page = num(sp.page);
  const meta = await pageMetadata('/blog', {
    title: tag ? `${tag} articles | Blog` : 'Blog',
    description: 'Guides on frames, face shapes and looking after your eyes.',
  });
  if (tag || page > 1) {
    const url = `${SITE_URL}${blogHref({ tag, page })}`;
    meta.alternates = { canonical: url };
    meta.openGraph = { ...meta.openGraph, url };
  }
  return meta;
}

// Tag chips are built from a wide, cached read of the list (the contract has no tags endpoint).
async function loadTags() {
  const res = await get('/blog?limit=100', { revalidate: 600 });
  const set = new Map();
  ((res && res.data) || []).forEach((p) => (p.tags || []).forEach((t) => set.set(t, (set.get(t) || 0) + 1)));
  return [...set.keys()].sort((a, b) => a.localeCompare(b));
}

export default async function BlogPage({ searchParams }) {
  const sp = await searchParams;
  const tag = one(sp.tag);
  const page = num(sp.page);
  const q = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) });
  if (tag) q.set('tag', tag);
  const [res, tags] = await Promise.all([get(`/blog?${q}`, { revalidate: 120 }), loadTags()]);
  const posts = (res && res.data) || [];
  const pg = (res && res.pagination) || { page, totalPages: 1 };
  const down = !res;

  return (
    <div className="wrap sec">
      <header className="blog__head">
        <h1>The Stallion blog</h1>
        <p className="mute">Guides on frames, face shapes and looking after your eyes.</p>
      </header>

      {tags.length > 0 && (
        <nav className="filters" aria-label="Filter by topic">
          <Link href="/blog" className={`chip${!tag ? ' chip--on' : ''}`} aria-current={!tag ? 'true' : undefined}>All</Link>
          {tags.map((t) => (
            <Link key={t} href={blogHref({ tag: t, page: 1 })} className={`chip${tag === t ? ' chip--on' : ''}`} aria-current={tag === t ? 'true' : undefined}>{t}</Link>
          ))}
        </nav>
      )}

      {down ? (
        <div className="box blog__empty">
          <b>The blog is taking a break</b>
          <p className="mute">We could not load the articles just now. Please try again in a minute.</p>
          <Link href="/shop" className="btn btn--pri">Browse frames</Link>
        </div>
      ) : posts.length === 0 ? (
        <div className="box blog__empty">
          <b>{tag ? `No articles about ${tag} yet` : 'No articles yet'}</b>
          <p className="mute">{tag ? 'Try another topic or see everything we have written.' : 'We are writing the first ones. Meanwhile, have a look at our frames.'}</p>
          {tag ? <Link href="/blog" className="btn">Show all articles</Link> : <Link href="/shop" className="btn btn--pri">Browse frames</Link>}
        </div>
      ) : (
        <div className="grid blog__grid">
          {posts.map((p) => <PostCard key={p.slug} p={p} />)}
        </div>
      )}

      {pg.totalPages > 1 && (
        <nav className="pager" aria-label="Pagination">
          {pg.page > 1 ? <Link className="btn" rel="prev" href={blogHref({ tag, page: pg.page - 1 })}>Previous</Link> : <span className="btn" aria-disabled="true" style={{ opacity: 0.45 }}>Previous</span>}
          <span className="pager__n">Page {pg.page} of {pg.totalPages}</span>
          {pg.page < pg.totalPages ? <Link className="btn" rel="next" href={blogHref({ tag, page: pg.page + 1 })}>Next</Link> : <span className="btn" aria-disabled="true" style={{ opacity: 0.45 }}>Next</span>}
        </nav>
      )}
    </div>
  );
}
