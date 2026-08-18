import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pekerjaan 2026',
    short_name: 'Pekerjaan 2026',
    description: 'CRM Pipeline & MBG dashboard',
    start_url: '/sirka',
    display: 'standalone',
    background_color: '#f4f6f9',
    theme_color: '#0d9488',
    icons: [
      { src: '/pwa-icon-192', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-icon-512', sizes: '512x512', type: 'image/png' },
    ],
  };
}
