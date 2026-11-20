// Error reporting for edge functions (Sentry). Does nothing until SENTRY_DSN is set.
//
// Only unexpected failures are reported (not "account not found" and other expected answers),
// never request bodies, and every event is scrubbed of tokens and personal data (scrub.ts).
import * as Sentry from 'npm:@sentry/deno@11.11.0'
import { MINIMAL_DATA_COLLECTION, scrubDeep } from './scrub.ts'

let initialised = false

function ready(): boolean {
  if (initialised) return true
  const dsn = Deno.env.get('SENTRY_DSN')
  if (!dsn) return false
  Sentry.init({
    dsn,
    environment: Deno.env.get('SENTRY_ENVIRONMENT') ?? 'production',
    // Edge functions share one global scope between requests, so Sentry's automatic
    // integrations (which assume one process per request) are off; errors are sent explicitly.
    // With them off, no request data (headers, bodies, IPs) is collected at all.
    defaultIntegrations: false,
    dataCollection: MINIMAL_DATA_COLLECTION,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubDeep(event),
    beforeBreadcrumb: (breadcrumb) => scrubDeep(breadcrumb),
  })
  Sentry.setTag('region', Deno.env.get('SB_REGION') ?? 'unknown')
  initialised = true
  return true
}

/**
 * Report an unexpected error and wait (up to 2 s) for it to be sent, since the function may
 * stop as soon as it responds. Never throws: monitoring must not break the request.
 */
export async function reportError(
  fn: string,
  error: unknown,
  details?: Record<string, string | number | boolean | null>,
): Promise<void> {
  try {
    if (!ready()) return
    Sentry.withScope((scope) => {
      scope.setTag('function', fn)
      if (details) scope.setContext('details', scrubDeep(details))
      Sentry.captureException(error)
    })
    await Sentry.flush(2000)
  } catch (err) {
    console.error('monitoring: could not report error', err)
  }
}

/** The function's name from its URL (/functions/v1/pay-checkout → pay-checkout). */
export function functionName(req: Request): string {
  try {
    return new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
