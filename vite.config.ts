import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// Hangr is served from the `/Hangr/` subpath under derajyojith.dev. Every
// asset URL, the React Router basename, the PWA scope, and the workbox SPA
// fallback all need to know that — change them together via this constant.
const BASE = '/Hangr/'

// https://vitejs.dev/config/
export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.png'],
      manifest: {
        name: 'Hangr',
        short_name: 'Hangr',
        description:
          'Privacy-first wardrobe tracker. Photograph clothes once, see what you actually wear.',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: BASE,
        scope: BASE,
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // ML model files (BiRefNet, CLIP) are large — bump cache budget so they cache offline.
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
        // SPA routing — unknown URLs under /Hangr/ fall back to index.html.
        // Allowlist limits the fallback to our subpath so a sibling app under
        // the same domain (e.g. derajyojith.dev/anything-else) isn't hijacked.
        navigateFallback: `${BASE}index.html`,
        navigateFallbackAllowlist: [new RegExp(`^${BASE.replace(/\//g, '\\/')}`)],
        cleanupOutdatedCaches: true,
        // Activate new builds immediately instead of waiting for all tabs to close.
        // Critical on iOS Safari, where cached SWs can serve stale JS for days.
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Stamp the build time so we can verify which version is actually loaded.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // transformers.js / onnxruntime-web load wasm files at runtime; pre-bundling them
  // into Vite's optimized deps causes init failures. Exclude so they're loaded as-is.
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  server: {
    host: true, // expose on LAN so you can test on your phone
    headers: {
      // Some ONNX Runtime Web backends need cross-origin isolation for SharedArrayBuffer.
      // These headers enable it locally.
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
})
