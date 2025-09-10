/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    typedRoutes: true
  },
  env: {
    CUSTOM_KEY: 'office-tv-controller',
    ADMIN_REGISTER_URL: process.env.ADMIN_REGISTER_URL || 'http://localhost:3000',
    CONTROLLER_AUTO_REGISTER: process.env.CONTROLLER_AUTO_REGISTER || 'true',
    CONTROLLER_LOCATION: process.env.CONTROLLER_LOCATION || '',
    CONTROLLER_SITE_ID: process.env.CONTROLLER_SITE_ID || ''
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, Cache-Control' },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Removed bonjour-service dependency
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        dns: false,
        net: false,
        tls: false,
        fs: false,
        dgram: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
