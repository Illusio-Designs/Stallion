/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  compress: true,
  experimental: {
    optimizePackageImports: ['react-icons', 'react-toastify'],
  },
};

export default nextConfig;
