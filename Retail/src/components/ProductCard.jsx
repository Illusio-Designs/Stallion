import Link from 'next/link';
import Glasses from './Glasses';
import { rs } from '../lib/format';
import AddToCartButton from './AddToCartButton';

// Price-first product card (outlined). Used by home, shop, product detail (related) and blog posts.
export default function ProductCard({ p }) {
  return (
    <article className="pcard">
      <div className="pcard__head"><span className="pcard__price">{rs(p.mrp)}</span></div>
      <Link href={`/shop/${p.slug}`} className="photo pcard__photo" aria-label={p.title || p.model_no}>
        {p.image ? <img src={p.image} alt={p.title || p.model_no} loading="lazy" /> : <Glasses />}
      </Link>
      <Link href={`/shop/${p.slug}`} className="pcard__name">{p.title || p.model_no}</Link>
      <p className="pcard__sub">{p.low_stock ? `Only ${p.stock} left` : 'In stock'}{p.shape ? ` · ${p.shape}` : ''}</p>
      <AddToCartButton product={p} />
    </article>
  );
}
