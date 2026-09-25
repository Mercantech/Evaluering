import type { NextConfig } from 'next';

/** Intern API-URL (Docker-netværk). Browser kalder /api → rewrite hertil. */
const apiInternal =
  process.env.API_INTERNAL_URL?.replace(/\/$/, '') || 'http://localhost:3001';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiInternal}/:path*`,
      },
    ];
  },
};

export default nextConfig;
