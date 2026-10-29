import Link from 'next/link';
import '../../styles/shop.css';
import ProductCard from '../../components/ProductCard';
import SearchSuggest from '../../components/SearchSuggest';
import ShopFilters from '../../components/ShopFilters';
import SortSelect from '../../components/SortSelect';
import { get, SITE_URL } from '../../lib/api';
import { pageMetadata, jsonLd } from '../../lib/seo';
import { FACETS, pickParams, shopHref, options } from '../../lib/shopQuery';
import { rs } from '../../lib/format';

const LIMIT = 12;
const FACET_LABEL = { shape: 'Shape', frame_type: 'Frame type', frame_material: 'Frame material', gender: 'Gender', color: 'Colour' };

export async function generateMetadata({ searchParams }) {
  const params = pickParams(await searchParams);
  const base = await pageMetadata('/shop', {
    title: 'Shop sunglasses and eyeglasses',
    description: 'Browse frames in every shape, material and colour. Honest MRP, free delivery over the free shipping amount and easy returns.',
  });
  const filtered = Object.keys(params).some((k) => k !== 'page');
  if (filtered) {
    // Filtered and search views are for people; the plain list and its pages are what Google should index.
    return { ...base, alternates: { canonical: `${SITE_URL}/shop` }, robots: { index: false, follow: true } };
  }
  if (params.page) {
    return { ...base, title: `${typeof base.title === 'string' ? base.title : 'Shop'} (page ${params.page})`, alternates: { canonical: `${SITE_URL}/shop?page=${params.page}` } };
  }
  return base;
}

const toApi = (params) => {
  const q = new URLSearchParams({ limit: String(LIMIT), ...params });
  return q.toString();
};

export default async function ShopPage({ searchParams }) {
  const params = pickParams(await searchParams);
  const [list, fres] = await Promise.all([
    get(`/products?${toApi(params)}`, { revalidate: 60 }),
    get('/products/filters', { revalidate: 300 }),
  ]);
  const items = list && Array.isArray(list.data) ? list.data : null;
  const pg = (list && list.pagination) || { page: 1, total: items ? items.length : 0, totalPages: 1 };
  const f = (fres && fres.data) || {};
  const groups = [
    ['shape', options(f.shapes)], ['frame_type', options(f.frame_types)], ['frame_material', options(f.frame_materials)],
    ['gender', options(f.genders)], ['color', options(f.colors)],
  ].filter(([, o]) => o.length);
  const priceActive = Boolean(params.min_price || params.max_price);
  const facetCount = FACETS.filter((k) => params[k]).length + (priceActive ? 1 : 0);
  const anyFilter = facetCount > 0 || Boolean(params.search);
  const heading = params.search ? `Results for “${params.search}”` : params.shape ? `${params.shape} frames` : 'Shop frames';
  const price = f.price || {};

  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/shop` },
  ] };
  const itemList = items && items.length ? {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/shop/${p.slug}`, name: p.title || p.model_no })),
  } : null;

  return (
    <div className="wrap sec sh">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(crumbs)} />
      {itemList ? <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(itemList)} /> : null}
      <nav className="crumb" aria-label="Breadcrumb"><Link href="/">Home</Link> / {params.shape || params.search ? <><Link href="/shop">Shop</Link> / {params.shape || 'Search'}</> : 'Shop'}</nav>
      <div className="row sh-head">
        <div>
          <h1 className="sh-title">{heading}</h1>
          <p className="mute">{items ? `${pg.total} ${pg.total === 1 ? 'frame' : 'frames'}` : ' '}</p>
        </div>
        <SearchSuggest initial={params.search || ''} />
      </div>

      {groups.find(([k]) => k === 'shape') ? (
        <div className="sh-quick" aria-label="Shapes">
          <Link href="/shop" className={`chip${!params.shape ? ' chip--on' : ''}`} scroll={false}>All</Link>
          {groups.find(([k]) => k === 'shape')[1].map((o) => (
            <Link key={o.value} href={shopHref(params, { shape: params.shape === o.value ? null : o.value })} className={`chip${params.shape === o.value ? ' chip--on' : ''}`} scroll={false}>{o.value}</Link>
          ))}
        </div>
      ) : null}

      <div className="sh-bar">
        <ShopFilters activeCount={facetCount} total={pg.total || 0}>
          {groups.map(([key, opts]) => (
            <section key={key} className="sh-grp">
              <h2 className="sh-grp__t">{FACET_LABEL[key]}</h2>
              <div className="sh-grp__o">
                {opts.map((o) => {
                  const on = params[key] && params[key].toLowerCase() === String(o.value).toLowerCase();
                  return (
                    <Link key={o.value} href={shopHref(params, { [key]: on ? null : o.value })} scroll={false} className={`chip${on ? ' chip--on' : ''}`} aria-pressed={on ? 'true' : 'false'} rel="nofollow">
                      {o.value}{o.count != null ? <small>{o.count}</small> : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
          <form className="sh-grp" action="/shop" method="get">
            <h2 className="sh-grp__t">Price (MRP)</h2>
            {Object.entries(params).filter(([k]) => !['min_price', 'max_price', 'page'].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <div className="sh-price">
              <label className="field"><span>Min</span><input className="input" type="number" inputMode="numeric" min="0" name="min_price" defaultValue={params.min_price || ''} placeholder={price.min != null ? rs(price.min) : '₹0'} /></label>
              <label className="field"><span>Max</span><input className="input" type="number" inputMode="numeric" min="0" name="max_price" defaultValue={params.max_price || ''} placeholder={price.max != null ? rs(price.max) : '₹'} /></label>
              <button type="submit" className="btn">Apply</button>
            </div>
          </form>
          {anyFilter ? <Link href={params.sort ? `/shop?sort=${params.sort}` : '/shop'} className="sh-clear" scroll={false}>Clear all filters</Link> : null}
        </ShopFilters>
        <SortSelect params={params} value={params.sort || 'popular'} />
      </div>

      {anyFilter ? (
        <div className="sh-active" aria-label="Active filters">
          {Object.entries(params).filter(([k]) => FACETS.includes(k) || k === 'search').map(([k, v]) => (
            <Link key={k} href={shopHref(params, { [k]: null })} className="chip chip--on" scroll={false} aria-label={`Remove filter ${v}`}>{v} &#10005;</Link>
          ))}
          {priceActive ? (
            <Link href={shopHref(params, { min_price: null, max_price: null })} className="chip chip--on" scroll={false} aria-label="Remove price filter">
              {params.min_price ? rs(params.min_price) : '₹0'} to {params.max_price ? rs(params.max_price) : 'any'} &#10005;
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="sh-main">
        {items === null ? (
          <div className="box sh-empty">
            <h2>We can’t load frames right now</h2>
            <p className="mute">Please check your connection and try again in a moment.</p>
            <Link className="btn btn--pri" href={shopHref(params)}>Try again</Link>
          </div>
        ) : items.length === 0 ? (
          <div className="box sh-empty">
            <h2>No frames match</h2>
            <p className="mute">Try removing a filter or searching for something broader.</p>
            <Link className="btn btn--pri" href="/shop">See all frames</Link>
          </div>
        ) : (
          <>
            <div className="grid grid--cards sh-grid">
              {items.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
            <Pager params={params} page={Number(pg.page) || 1} pages={Number(pg.totalPages) || 1} />
          </>
        )}
      </div>
    </div>
  );
}

function Pager({ params, page, pages }) {
  if (pages <= 1) return null;
  const nums = [];
  for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
  const link = (n) => shopHref(params, { page: n > 1 ? n : null });
  const out = [];
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push('gap' + n); out.push(n); });
  return (
    <nav className="sh-pager" aria-label="Pages">
      {page > 1 ? <Link className="chip" href={link(page - 1)} rel="prev">Previous</Link> : null}
      {out.map((n) => (typeof n === 'string' ? <span key={n} className="mute" aria-hidden="true">…</span>
        : <Link key={n} className={`chip${n === page ? ' chip--on' : ''}`} href={link(n)} aria-current={n === page ? 'page' : undefined} aria-label={`Page ${n}`}>{n}</Link>))}
      {page < pages ? <Link className="chip" href={link(page + 1)} rel="next">Next</Link> : null}
    </nav>
  );
}
