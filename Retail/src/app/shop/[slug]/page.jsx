import Link from 'next/link';
import { notFound } from 'next/navigation';
import '../../../styles/product.css';
import ProductCard from '../../../components/ProductCard';
import ProductGallery from '../../../components/ProductGallery';
import ProductBuy from '../../../components/ProductBuy';
import PincodeCheck from '../../../components/PincodeCheck';
import ViewTrack from '../../../components/ViewTrack';
import { get, SITE_URL } from '../../../lib/api';
import { pageMetadata, jsonLd } from '../../../lib/seo';
import { rs } from '../../../lib/format';
import { cleanHtml, htmlText } from '../../../lib/html';

const load = async (slug) => {
  const res = await get(`/products/${encodeURIComponent(slug)}`, { revalidate: 60 });
  return res && res.data ? res.data : null;
};

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return { title: 'Frame not found', robots: { index: false, follow: false } };
  const seo = p.seo || {};
  const name = p.title || p.model_no;
  const desc = (seo.description || htmlText(p.description) || `Buy ${name} online at ${rs(p.mrp)}.`).replace(/\s+/g, ' ').slice(0, 300);
  return pageMetadata(`/shop/${slug}`, {
    title: seo.title || `${name}${p.shape ? ` ${p.shape.toLowerCase()} frame` : ''}`,
    description: desc,
    image: p.image || (p.images && p.images[0]) || null,
  });
}

const SPECS = [['shape', 'Shape'], ['frame_type', 'Frame type'], ['frame_material', 'Frame material'], ['lens', 'Lens'], ['size_mm', 'Size (mm)'], ['gender', 'Gender'], ['brand', 'Brand']];

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();

  const name = p.title || p.model_no;
  const stock = Number(p.stock) || 0;
  const specs = p.specs || {};
  const images = (p.images && p.images.length ? p.images : [p.image]).filter(Boolean);
  const colors = Array.isArray(p.colors) ? p.colors : [];
  const related = Array.isArray(p.related) ? p.related.slice(0, 4) : [];
  const url = `${SITE_URL}/shop/${p.slug}`;

  const product = {
    '@context': 'https://schema.org', '@type': 'Product',
    name, sku: p.model_no, mpn: p.model_no,
    image: images, description: htmlText(p.description) || undefined,
    brand: { '@type': 'Brand', name: specs.brand || 'Stallion' },
    color: p.color || undefined, material: specs.frame_material || undefined,
    offers: {
      '@type': 'Offer', url, priceCurrency: 'INR', price: Number(p.mrp).toFixed(2),
      availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
  const crumbItems = [['Home', SITE_URL], ['Shop', `${SITE_URL}/shop`]];
  if (specs.shape) crumbItems.push([specs.shape, `${SITE_URL}/shop?shape=${encodeURIComponent(specs.shape)}`]);
  crumbItems.push([name, url]);
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbItems.map(([n, item], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item })),
  };

  return (
    <div className="wrap sec pd">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(product)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(crumbs)} />
      <ViewTrack productId={p.id} value={p.mrp} />

      <nav className="crumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / <Link href="/shop">Shop</Link>
        {specs.shape ? <> / <Link href={`/shop?shape=${encodeURIComponent(specs.shape)}`}>{specs.shape}</Link></> : null}
        {' '}/ <span aria-current="page">{name}</span>
      </nav>

      <div className="pd-grid">
        <ProductGallery images={images} alt={name} />

        <div className="pd-info">
          {specs.brand ? <div className="crumb">{specs.brand}</div> : null}
          <h1 className="pd-title">{name}</h1>
          <div className="pd-price"><b>{rs(p.mrp)}</b><span className="mute">MRP</span></div>
          {stock <= 0 ? <span className="pill pill--bad pd-chip">Out of stock</span>
            : p.low_stock ? <span className="pill pill--warn pd-chip">Only {stock} left</span>
              : <span className="pill pd-chip">In stock</span>}

          {colors.length > 1 ? (
            <div className="pd-colors">
              <div className="field"><span>Colour: {p.color}</span></div>
              <div className="pd-colors__o">
                {colors.map((c) => {
                  const on = c.slug === p.slug;
                  return (
                    <Link key={c.slug} href={`/shop/${c.slug}`} className={`chip${on ? ' chip--on' : ''}`} aria-current={on ? 'true' : undefined} aria-label={`${c.name}${c.stock <= 0 ? ', out of stock' : ''}`}>
                      {c.name}{c.stock <= 0 ? <small>Sold out</small> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          <ProductBuy product={{ id: p.id, slug: p.slug, title: name, model_no: p.model_no, image: p.image || images[0] || null, mrp: p.mrp, stock }} />
          <PincodeCheck subtotal={Number(p.mrp) || 0} />

          {p.description ? <div className="pd-desc" dangerouslySetInnerHTML={{ __html: cleanHtml(p.description) }} /> : null}

          <div className="pd-specs">
            {SPECS.filter(([k]) => specs[k]).map(([k, label]) => (
              <div key={k}><small>{label}</small>{specs[k]}</div>
            ))}
          </div>
        </div>
      </div>

      {related.length ? (
        <section className="pd-rel" aria-labelledby="rel-h">
          <h2 id="rel-h" className="pd-h2">Other frames you may like</h2>
          <div className="grid grid--cards pd-rel__g">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
        </section>
      ) : null}
    </div>
  );
}
