/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { sentryVitePlugin } from '@sentry/bundler-plugins/vite'
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

/**
 * Readable production stack traces in Sentry. Only when SENTRY_AUTH_TOKEN is set (Vercel production
 * builds): source maps are made, uploaded to Sentry, then deleted, so they're never deployed and the
 * source isn't public. Builds without the token (local, previews without it) are unchanged.
 * The release is the commit Vercel built (VERCEL_GIT_COMMIT_SHA); the plugin also sets it in the app's
 * Sentry SDK, so each error links to the deploy that shipped it.
 */
function sentrySourceMaps(env: Record<string, string>): Plugin[] {
  if (!env.SENTRY_AUTH_TOKEN) return []
  return sentryVitePlugin({
    org: 'rent-padi',
    project: 'rent-padi-frontend',
    authToken: env.SENTRY_AUTH_TOKEN,
    release: { name: env.VERCEL_GIT_COMMIT_SHA || undefined },
    sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
    telemetry: false,
  }) as Plugin[]
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // '' loads every variable (process.env and .env files), not just VITE_ ones; only VITE_ ones reach the app.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // The Sentry plugin goes last (Sentry's docs: after all other plugins).
    plugins: [react(), tailwindcss(), appUrl(env.VITE_APP_URL), ...sentrySourceMaps(env)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // Plain-TypeScript modules shared with the edge functions (e.g. the receipt PDF).
        '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
      },
    },
    build: {
      // 'hidden': maps for Sentry only, with no link to them in the shipped files.
      sourcemap: env.SENTRY_AUTH_TOKEN ? 'hidden' : false,
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
  }
})
