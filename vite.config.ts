import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

function safeServerWsPlugin(): Plugin {
  const dummyWs = {
    send: () => {},
    on: () => {},
    off: () => {},
    close: () => {},
    listen: () => {},
    setInvokeHandler: () => {},
    handleInvoke: async () => ({}),
    clients: new Set(),
  };

  return {
    name: 'safe-server-ws',
    enforce: 'pre',
    configureServer(server: any) {
      if (!server.ws || typeof server.ws.send !== 'function') {
        server.ws = dummyWs;
      }
      if (!server.hot || typeof server.hot.send !== 'function') {
        server.hot = dummyWs;
      }
      if (server.environments?.client && (!server.environments.client.hot || typeof server.environments.client.hot.send !== 'function')) {
        server.environments.client.hot = dummyWs;
      }
    },
    hotUpdate(ctx: any) {
      if (!ctx.server.ws || typeof ctx.server.ws.send !== 'function') {
        ctx.server.ws = dummyWs;
      }
      if (!ctx.server.hot || typeof ctx.server.hot.send !== 'function') {
        ctx.server.hot = dummyWs;
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      safeServerWsPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'favicon-16x16.png',
          'favicon-32x32.png',
          'favicon-48x48.png',
          'apple-touch-icon.png',
          'icon.svg'
        ],
        manifest: {
          id: '/',
          name: 'SALONX',
          short_name: 'SALONX',
          description: 'No Waiting. Easy Booking.',
          theme_color: '#0E0E12',
          background_color: '#0E0E12',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          importScripts: ['/push-worker.js'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'unsplash-images',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
