'use client';
import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import App from '../pages/App';
import Loader from '../components/Loader';

function AppWrapper() {
  const pathname = usePathname();
  // The sign-in page is the front page: the home page is gone. A signed-in visitor on / is sent on to the dashboard.
  const page = pathname === '/' ? 'login' : pathname.slice(1);
  return <App initialPage={page} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<Loader isLoading={true} />}>
      <AppWrapper />
    </Suspense>
  );
}
