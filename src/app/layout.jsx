import "./globals.css";
import 'react-toastify/dist/ReactToastify.css';
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
        <link
          rel="preload"
          href="/SpoofTrial-Regular.otf"
          as="font"
          type="font/otf"
          crossOrigin="anonymous"
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
