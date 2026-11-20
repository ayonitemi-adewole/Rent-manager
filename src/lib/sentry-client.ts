// The only part of Sentry the app downloads, loaded on demand by monitoring.ts. Importing just
// these two named functions lets the bundler drop the rest of the SDK (a namespace import of
// the whole package was ~150 kB gzipped).
export { captureException, init } from '@sentry/react'
