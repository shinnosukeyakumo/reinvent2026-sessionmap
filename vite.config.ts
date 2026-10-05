import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 're:Invent 2026 Session Map',
        short_name: 'Session Map',
        description: 're:Invent 2026 のセッションをラスベガスの地図で見る',
        lang: 'ja',
        display: 'standalone',
        start_url: '/',
        theme_color: '#0b0d17',
        background_color: '#0b0d17',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // アプリ本体は事前キャッシュ。セッションデータ（約 2MB）は下の実行時キャッシュで扱う
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        runtimeCaching: [
          {
            // 会場の Wi-Fi が弱くても開けるよう、手元の保存分を先に出して裏で更新する
            urlPattern: ({ url }) => url.pathname.endsWith('/data/sessions.json'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'sessions', expiration: { maxEntries: 2 } },
          },
          {
            // 一度表示した地図タイルだけを保存する（事前の一括取得はしない）
            urlPattern: ({ url }) => url.hostname === 'tile.openstreetmap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
