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
    // Same-origin dev proxy: forward /api/* to the API server-side so the browser
    // never makes a cross-origin (CORS) request from localhost in dev. The client
    // uses a relative `/api` base in development (see getBaseURL); production calls
    // the API directly. Override the target with API_PROXY_TARGET (e.g. a local
    // backend at http://localhost:3000/api).
    const target = (
      process.env.API_PROXY_TARGET ||
      process.env.NEXT_PUBLIC_API_URL ||
      'https://api.stallioneyewear.in/api'
    ).replace(/\/+$/, '');
    return [{ source: '/api/:path*', destination: `${target}/:path*` }];
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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
