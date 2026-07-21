/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  compress: true,
  compiler: {
    // Strip console.* in production builds (keep error/warn) so the verbose
    // request/data logging never ships to users. Dev keeps all logs.
    removeConsole:
      process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  experimental: {
    optimizePackageImports: ['react-icons', 'react-toastify'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.stallioneyewear.in' },
    ],
  },
  async rewrites() {
    // Same-origin API proxy: the browser hits /api on THIS app's origin and Next
    // forwards it to the real API server-side. This removes browser CORS and the
    // OPTIONS preflight entirely (the things openresty/Imunify360 were blocking).
    // Target is NEXT_PUBLIC_API_URL; override with API_PROXY_TARGET for a local
    // backend. Works in dev and in any Node (non-static) production deployment.
    const target = (
      process.env.API_PROXY_TARGET ||
      process.env.NEXT_PUBLIC_API_URL ||
      'https://api.stallioneyewear.in/api'
    ).replace(/\/+$/, '');
    // Base host for uploaded files (the API host, without the /api suffix).
    const imgBase = (
      process.env.NEXT_PUBLIC_IMAGE_BASE_URL ||
      target.replace(/\/api$/, '') ||
      'https://api.stallioneyewear.in'
    ).replace(/\/+$/, '');
    return [
      { source: '/api/:path*', destination: `${target}/:path*` },
      // Serve product/upload images SAME-ORIGIN so they can be drawn onto a
      // canvas and embedded in the order PDF without a cross-origin (CORS) taint.
      { source: '/uploads/:path*', destination: `${imgBase}/uploads/:path*` },
    ];
  },
  async headers() {
    // Baseline security headers. (A strict Content-Security-Policy is
    // intentionally omitted for now — it needs per-source tuning against the
    // app's inline styles/scripts and the API/MSG91 origins.)
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // geolocation=(self): the app needs the browser Geolocation API for the
          // on-site "capture location" and visit-order/check-in GPS. An empty
          // geolocation=() allowlist blocks it even for our own origin.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
