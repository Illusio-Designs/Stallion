'use client';
import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import App from '../pages/App';
import Loader from '../components/Loader';

function AppWrapper() {
  const pathname = usePathname();
  const page = pathname === '/' ? 'home' : pathname.slice(1);
  return <App initialPage={page} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<Loader isLoading={true} />}>
      <AppWrapper />
    </Suspense>
  );
}
