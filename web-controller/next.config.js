/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    typedRoutes: true
  },
  // Conditional output based on environment
  ...(process.env.NODE_ENV === 'production' ? {
    output: 'standalone', // For production builds
  } : {}),
  trailingSlash: false,
  poweredByHeader: false,
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
  webpack: (config, { dev, isServer }) => {
    // Enhanced Electron compatibility
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        dns: false,
        net: false,
        tls: false,
        fs: false,
        dgram: false,
        child_process: false,
        os: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        http: false,
        https: false,
        url: false,
        querystring: false,
      };
    }

    // Electron main process compatibility
    if (isServer) {
      config.externals = [...(config.externals || []), 'electron'];
    }

    // Better watch options for integrated server development
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: /node_modules/,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
