import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Yolo Budget',
        short_name: 'Yolo',
        description: 'Offline-first double-entry budgeting app',
        theme_color: '#0ea5a4',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
  ,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id || !id.includes('node_modules')) return undefined
          if (id.includes('react') || id.includes('react-dom')) return 'react-vendor'
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'charts-vendor'
          if (id.includes('react-tag-input')) return 'tags-vendor'
          if (id.includes('workbox') || id.includes('vite-plugin-pwa')) return 'pwa-vendor'
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase-vendor'
          if (id.includes('idb') || id.includes('idb-keyval')) return 'idb-vendor'
          return 'vendor'
        }
      }
    }
  }
})
