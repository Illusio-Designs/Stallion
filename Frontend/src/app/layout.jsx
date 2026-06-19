import "./globals.css";
import 'react-toastify/dist/ReactToastify.css';
import LoaderProvider from "../components/LoaderProvider";
import ToastContainerProvider from "../components/ToastContainerProvider";
import ErrorBoundary from "../components/ErrorBoundary";
import { ConfirmProvider } from "../components/ui/ConfirmProvider";

export const metadata = {
  title: "Stallion Eyewear",
  description: "Your Vision, Our Passion",
  icons: {
    icon: '/favicon.png',
  },
  other: {
    'color-scheme': 'light only',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
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
