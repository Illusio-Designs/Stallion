import Link from 'next/link';
import '../styles/content.css';
import Glasses from '../components/Glasses';

export const metadata = { title: 'Page not found', robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <div className="wrap sec nf">
      <div className="photo nf__ph"><Glasses /></div>
      <p className="eyebrow">Error 404</p>
      <h1>We could not find that page</h1>
      <p className="mute">The link may be old or mistyped. Try one of these instead.</p>
      <div className="nf__cta">
        <Link href="/shop" className="btn btn--pri">Shop frames</Link>
        <Link href="/blog" className="btn">Read the blog</Link>
        <Link href="/help" className="btn">Get help</Link>
      </div>
    </div>
  );
}
