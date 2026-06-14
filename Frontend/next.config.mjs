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
