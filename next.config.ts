import type { NextConfig } from "next";

// DESKTOP=1 (npm run build:desktop): web estática en out/ para meterla en la app de
// escritorio (Electron, para Steam). Sin servidor: ni rewrites ni optimización de imágenes.
const desktop = process.env.DESKTOP === '1';

const nextConfig: NextConfig = desktop
  ? {
    output: 'export',
    images: { unoptimized: true },
    env: { NEXT_PUBLIC_DESKTOP: '1' },
  }
  : {
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
