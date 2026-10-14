import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]
  const defaultBase = repository && !repository.endsWith('.github.io') ? `/${repository}/` : '/'
  const base = env.VITE_BASE_PATH || defaultBase
  if (!base.startsWith('/') || !base.endsWith('/')) {
    throw new Error('VITE_BASE_PATH must start and end with a slash, for example /Pushups/.')
  }
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'icons/*.png'],
        manifest: {
          id: base,
          name: 'Pushup — Push-Up Tracker',
          short_name: 'Pushup',
          description:
            'Every rep counts. Track push-ups, build a habit, and see your progress. Private and offline.',
          theme_color: '#c5f277',
          background_color: '#111410',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: base,
          scope: base,
          lang: 'en',
          categories: ['health', 'fitness', 'lifestyle'],
          icons: [
            {
              src: `${base}icons/icon-192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}icons/icon-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}icons/maskable-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  }
})
