import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MoodSync',
        short_name: 'MoodSync',
        description: 'Music that matches your mood',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})
