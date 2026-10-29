'use client';
import { useRouter } from 'next/navigation';
import { SORTS, shopHref } from '../lib/shopQuery';

// Sort dropdown that changes the URL (the page itself is rendered on the server).
export default function SortSelect({ params, value = 'popular' }) {
  const router = useRouter();
  return (
    <label className="sh-sort">
      <span className="mute">Sort</span>
      <select className="input" value={value} onChange={(e) => router.push(shopHref(params, { sort: e.target.value === 'popular' ? null : e.target.value }), { scroll: false })}>
        {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
    </label>
  );
}
