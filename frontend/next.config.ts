import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost', '127.0.0.1:3000', 'localhost:3000'],
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.ELO_API_ORIGIN ?? 'http://127.0.0.1:8000'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
