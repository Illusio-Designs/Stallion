'use client';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import App from '../../pages/App';
import Loader from '../../components/Loader';
import { pathToDashboardPage, parseProductPath } from '../../utils/dashboardRoutes';

function DynamicPageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Resolve the page from the pathname. Dashboard pages use nested routes
  // (/dashboard/products, ...); product detail uses /product/<model_no>.
  let page = pathname === '/' ? 'home' : (pathname.slice(1) || 'home');
  const dashboardPage = pathToDashboardPage(pathname);
  if (dashboardPage) {
    page = dashboardPage;
    // Back-compat: honor a legacy ?tab= on the bare /dashboard route.
    if (pathname.replace(/\/+$/, '') === '/dashboard' && searchParams.get('tab')) {
      page = searchParams.get('tab');
    }
  } else if (parseProductPath(pathname)) {
    // Clean product detail route: /product/<model_no>
    page = 'product-detail';
  }

  // Extract productId from query params if available (legacy links).
  const productId = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

  return <App initialPage={page} productId={productId} />;
}

export default function DynamicClient() {
  return (
    <Suspense fallback={<Loader isLoading={true} />}>
      <DynamicPageContent />
    </Suspense>
  );
}
