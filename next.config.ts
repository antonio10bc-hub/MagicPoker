import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Analíticas: los eventos salen por la propia web hacia PostHog (región EU), así no los
  // bloquean los bloqueadores de anuncios
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: 'https://eu-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/:path*', destination: 'https://eu.i.posthog.com/:path*' },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
