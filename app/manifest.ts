import type { MetadataRoute } from 'next';

// Manifiesto de la app instalable (PWA): pantalla completa, icono y colores de la paleta
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Magic Poker',
    short_name: 'Magic Poker',
    description: 'A strategy card game',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0B0D0C',
    theme_color: '#0B0D0C',
    lang: 'en',
    categories: ['games'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
