'use client';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import App from '../../pages/App';
import Loader from '../../components/Loader';

function DynamicPageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Extract page from pathname and query - handle dashboard tabs via ?tab=
  let page = pathname === '/' ? 'home' : (pathname.slice(1) || 'home');
  if (pathname === '/dashboard') {
    page = searchParams.get('tab') || 'dashboard';
  }
  
  // Extract productId from query params if available
  const productId = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;
  
  return <App initialPage={page} productId={productId} />;
}

export default function DynamicPage() {
  return (
    <Suspense fallback={<Loader isLoading={true} />}>
      <DynamicPageContent />
    </Suspense>
  );
}
