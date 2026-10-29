import '../styles/base.css';
import '../styles/components.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Tracker from '../components/Tracker';
import ThemeScript from '../components/ThemeScript';
import { get, SITE_URL } from '../lib/api';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Stallion eyewear', template: '%s | Stallion' },
  description: 'Frames you will actually wear every day.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0c' },
  ],
};

export default async function RootLayout({ children }) {
  const res = await get('/settings', { revalidate: 300 });
  const s = (res && res.data) || {};
  const store = s.store || {};
  const wholesaleUrl = process.env.NEXT_PUBLIC_WHOLESALE_URL || '';
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Figtree:wght@400;500;600;700&display=swap" />
        <ThemeScript />
      </head>
      <body>
        <Header storeName={store.name || 'Stallion'} wholesaleUrl={wholesaleUrl} />
        <main>{children}</main>
        <Footer store={store} wholesaleUrl={wholesaleUrl} />
        <Tracker tracking={s.tracking || {}} />
      </body>
    </html>
  );
}
