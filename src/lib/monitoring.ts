// Error reporting for the app (Sentry). Does nothing until VITE_SENTRY_DSN is set.
//
// Built for slow phones: Sentry's code downloads only when the browser is idle after
// the page has loaded, and not at all with Data Saver on or on 2G. Errors before then are kept
// (a few) and sent once it loads. Every event is scrubbed of tenant-link tokens and personal
// data first (@shared/scrub.ts).
import { MINIMAL_DATA_COLLECTION, scrubDeep } from '@shared/scrub.ts'
import { env } from './env'

type SentryModule = typeof import('./sentry-client')

const MAX_EARLY = 10
let sentry: SentryModule | null = null
const early: unknown[] = []

const keepEarly = (error: unknown) => {
  if (early.length < MAX_EARLY) early.push(error)
}
const onError = (e: ErrorEvent) => keepEarly(e.error ?? e.message)
const onRejection = (e: PromiseRejectionEvent) => keepEarly(e.reason)

type NetworkInfo = { saveData?: boolean; effectiveType?: string }

function lowData(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInfo }).connection
  return Boolean(connection?.saveData) || /2g/.test(connection?.effectiveType ?? '')
}

export function initMonitoring() {
  const dsn = env.sentryDsn?.trim()
  if (!dsn || typeof window === 'undefined' || lowData()) return

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)

  const load = () => {
    import('./sentry-client')
      .then((S) => {
        S.init({
          dsn,
          environment: env.sentryEnvironment || import.meta.env.MODE,
          dataCollection: MINIMAL_DATA_COLLECTION,
          tracesSampleRate: 0, // errors only
          beforeSend: (event) => scrubDeep(event),
          beforeBreadcrumb: (breadcrumb) => scrubDeep(breadcrumb),
        })
        sentry = S
        window.removeEventListener('error', onError)
        window.removeEventListener('unhandledrejection', onRejection)
        for (const error of early.splice(0)) S.captureException(error)
      })
      .catch(() => {
        // Couldn't download (offline, blocked): carry on without monitoring.
      })
  }

  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 8000 })
  else setTimeout(load, 3000)
}

/** Report an unexpected error (e.g. a page that crashed). Expected ones (offline, form errors) shouldn't come here. */
export function reportError(error: unknown) {
  if (!env.sentryDsn) return
  if (sentry) sentry.captureException(error)
  else keepEarly(error)
}
