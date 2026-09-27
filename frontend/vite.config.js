import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const WEEK_SECONDS = 7 * 24 * 60 * 60;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // The app calls /api/...; Vite forwards those requests to the FastAPI backend. The browser only
  // sees one address, so the backend doesn't need CORS settings for local development or the demo.
  const proxy = {
    '/api': {
      target: env.BACKEND_URL || 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  };
  return {
    plugins: [
      react(),
      // Installable web app: name, icons and full-screen mode, plus a service worker that caches the
      // app so it opens instantly and works offline. Health data from /api is never cached.
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'Breezy: your asthma companion',
          short_name: 'Breezy',
          description: 'Learns your personal asthma triggers and gives you a heads-up the day before a likely flare-up. Prototype with fictional demo data.',
          theme_color: '#3f9a8c',
          background_color: '#2f5f73',
          display: 'standalone',
          orientation: 'portrait',
          start_url: './',
          scope: './',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // The map library is large; allow it into the offline cache.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Map tiles and map fonts you've already seen stay available offline for a week.
              urlPattern: ({ url }) => url.origin === 'https://tiles.openfreemap.org',
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'map-tiles', expiration: { maxEntries: 500, maxAgeSeconds: WEEK_SECONDS }, cacheableResponse: { statuses: [0, 200] } },
            },
            {
              urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
              handler: 'CacheFirst',
              options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 52 * WEEK_SECONDS }, cacheableResponse: { statuses: [0, 200] } },
            },
          ],
        },
      }),
    ],
    server: { port: 5173, host: true, proxy },
    preview: { port: 4173, host: true, proxy },
  };
});
