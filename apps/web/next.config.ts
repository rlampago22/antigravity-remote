import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@antigravity-remote/protocol'],
  serverExternalPackages: ['pg', 'better-auth', 'web-push'],
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' }],
      },
    ];
  },
};

export default nextConfig;
