/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Link previews need absolute image URLs: %APP_URL% in index.html becomes VITE_APP_URL
 * (e.g. https://rent-padi.vercel.app). Without it the path stays relative, which most apps
 * still show but some ignore.
 */
function appUrl(url: string | undefined): Plugin {
  return {
    name: 'rentpadi-app-url',
    transformIndexHtml: (html) => html.replaceAll('%APP_URL%', (url ?? '').trim().replace(/\/+$/, '')),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), appUrl(loadEnv(mode, process.cwd(), 'VITE_').VITE_APP_URL)],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Plain-TypeScript modules shared with the edge functions (e.g. the receipt PDF).
      '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries change less often than our code, so phones keep them cached between releases.
        // (Merging our own small shared files into one was tried: it either dragged supabase-js
        // into tenant pages or broke module order, so the rest is left to the bundler.)
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'forms', test: /node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/ },
            { name: 'query', test: /node_modules[\\/]@tanstack[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
