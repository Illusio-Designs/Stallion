import Link from 'next/link';

// Visible breadcrumb trail. items: [{ label, href? }] (last item has no href).
export default function Crumbs({ items }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((it, i) => (
          <li key={it.label}>
            {it.href ? <Link href={it.href}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}
            {i < items.length - 1 ? <span className="crumbs__sep" aria-hidden="true">/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
