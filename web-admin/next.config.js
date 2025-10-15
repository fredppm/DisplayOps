/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    typedRoutes: true
  },
  env: {
    CUSTOM_KEY: 'office-tv-admin'
  },
  output: 'standalone',
  trailingSlash: false,
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
  webpack: (config, { isServer, dev }) => {
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
    
    // Enhanced HMR configuration for better gRPC server management
    if (dev && isServer) {
      // Ensure proper cleanup of gRPC server during HMR
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
      
      // Add plugin to handle gRPC cleanup
      if (!config.plugins) config.plugins = [];
      
      config.plugins.push({
        apply: (compiler) => {
          compiler.hooks.watchRun.tap('GrpcCleanupPlugin', () => {
            // Signal that a rebuild is starting
            if (global.__grpcServerSingletonInstance) {
              try {
                global.__grpcServerSingletonInstance.forceStop();
              } catch (error) {
                console.warn('Failed to cleanup gRPC server during HMR:', error);
              }
            }
          });
        }
      });
    }
    
    return config;
  },
};

module.exports = nextConfig;
