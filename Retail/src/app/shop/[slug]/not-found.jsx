import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap sec" style={{ alignItems: 'flex-start' }}>
      <h1 style={{ fontSize: 28 }}>We could not find that frame</h1>
      <p className="mute">It may have sold out or moved. Browse the rest of the range instead.</p>
      <Link href="/shop" className="btn btn--pri">Shop all frames</Link>
    </div>
  );
}
