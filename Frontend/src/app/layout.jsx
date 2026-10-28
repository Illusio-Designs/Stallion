import "./globals.css";
import "../styles/redesign.css";
import "../styles/redesign-public.css";
import "../styles/redesign-a.css";
import "../styles/redesign-b.css";
import "../styles/redesign-c.css";
import "../styles/redesign-d.css";
import "../styles/redesign-e.css";
import "../styles/redesign-g.css";
import "../styles/redesign-i.css";
import "../styles/redesign-h.css";
import "../styles/redesign-j.css";
import "../styles/redesign-k.css";
import "../styles/redesign-l.css";
import "../styles/redesign-m.css";
import "../styles/redesign-n-touch.css";
import "../styles/redesign-n-polish.css";
import LoaderProvider from "../components/LoaderProvider";
import ToastContainerProvider from "../components/ToastContainerProvider";
import ErrorBoundary from "../components/ErrorBoundary";
import { ConfirmProvider } from "../components/ui/ConfirmProvider";

export const metadata = {
  title: "Stallion Eyewear",
  description: "Your Vision, Our Passion",
  // Add to Home Screen: the manifest drives Android/desktop install; the
  // appleWebApp settings drive iPad/iPhone (full screen, name under the icon).
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Stallion',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  other: {
    'color-scheme': 'light only',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Not using viewport-fit=cover on purpose: without it the browser keeps all
  // content inside the notch / home-bar safe area, which the storefront and the
  // dashboard both rely on.
  themeColor: '#ffffff',
  // Do not disable zoom — maximumScale/userScalable:false is a WCAG failure.
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{colorScheme: 'light'}}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Figtree:wght@400;500;600;700&display=swap"
        />
        <meta name="color-scheme" content="light only" />
      </head>
      <body className="antialiased" style={{colorScheme: 'light'}}>
        <ErrorBoundary>
          <LoaderProvider>
            <ToastContainerProvider>
              <ConfirmProvider>
                {children}
              </ConfirmProvider>
            </ToastContainerProvider>
          </LoaderProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
