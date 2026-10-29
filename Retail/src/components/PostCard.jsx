import Link from 'next/link';
import Glasses from './Glasses';
import { dateLong } from '../lib/format';

// Blog list card: cover, tag, title, summary, date and read time.
export default function PostCard({ p }) {
  const href = `/blog/${p.slug}`;
  return (
    <article className="post">
      <Link href={href} className="post__ph" tabIndex={-1} aria-hidden="true">
        {p.cover_image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={p.cover_image} alt="" loading="lazy" />
          : <Glasses />}
      </Link>
      <div className="post__bd">
        {p.tags && p.tags[0] ? <span className="post__tag">{p.tags[0]}</span> : null}
        <h2 className="post__t"><Link href={href}>{p.title}</Link></h2>
        {p.summary ? <p className="post__s">{p.summary}</p> : null}
        <span className="post__m">
          {p.published_at ? <time dateTime={p.published_at}>{dateLong(p.published_at)}</time> : null}
          {p.published_at && p.read_minutes ? ' · ' : ''}
          {p.read_minutes ? `${p.read_minutes} min read` : ''}
        </span>
      </div>
    </article>
  );
}
