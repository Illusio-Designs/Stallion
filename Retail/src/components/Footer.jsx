import Link from 'next/link';

export default function Footer({ store = {}, wholesaleUrl = '' }) {
  const name = store.name || 'Stallion';
  return (
    <footer className="ft">
      <div className="wrap ft__in">
        <div>
          <b style={{ font: '700 17px var(--font-display)' }}>{name.toUpperCase()}</b>
          <span>{store.tagline || 'Eyewear made for everyday faces.'}</span>
          {store.address ? <span>{store.address}</span> : null}
        </div>
        <div><b>Shop</b><Link href="/shop">All frames</Link><Link href="/shop?sort=new">New arrivals</Link><Link href="/track">Track order</Link></div>
        <div><b>Learn</b><Link href="/blog">Blog</Link><Link href="/about">About</Link><Link href="/help">Help and FAQ</Link><Link href="/contact">Contact</Link></div>
        <div><b>Policies</b><Link href="/policies/shipping">Shipping</Link><Link href="/policies/returns">Returns</Link><Link href="/policies/privacy">Privacy</Link><Link href="/policies/terms">Terms</Link>{wholesaleUrl ? <a href={wholesaleUrl}>Wholesale login</a> : null}</div>
      </div>
      <div className="wrap ft__cp">&copy; {new Date().getFullYear()} {name}</div>
    </footer>
  );
}
