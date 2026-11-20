// Removes personal data and secrets from error reports before they leave RentPadi (Sentry).
// Plain TypeScript, no Deno or browser APIs: used by the edge functions and by the app
// (imported as '@shared/scrub.ts').
//
// Tenant links (/t/<token>) and receipt links (/r/<token>) work without a login, so their
// tokens are as sensitive as passwords. Phone numbers, emails and account numbers are personal
// data under the NDPA. None of them helps to fix a bug.

const RULES: [RegExp, string][] = [
  // Secrets first, before the shorter patterns below can eat into them.
  [/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, '[jwt]'],
  [/\b(?:sk|pk)_(?:test|live)_\w+/g, '[key]'],
  [/(Bearer\s+)\S+/gi, '$1[redacted]'],
  [/([?&#](?:access_token|refresh_token|token|apikey|api_key|code|p_token)=)[^&#\s"']+/gi, '$1[redacted]'],
  // Tenant and receipt links.
  [/(\/[tr]\/)[\w-]{16,}/g, '$1[token]'],
  // Emails.
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]'],
  // Nigerian phone numbers: +234…, 234…, 0803 123 4567, 08031234567.
  [/\+?\b234[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, '[phone]'],
  [/\b0[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b/g, '[phone]'],
  // Bank account numbers (NUBAN: 10 digits on their own).
  [/\b\d{10}\b/g, '[number]'],
]

/**
 * Sentry's `dataCollection` option (SDK 11+), shared by the app and the edge functions: collect
 * nothing beyond the error itself. Sentry's own defaults collect user info, cookies, headers,
 * bodies, query strings and local variables. scrubDeep() still runs on every event as a second layer.
 */
export const MINIMAL_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [] as never[],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
}

export function scrubText(text: string): string {
  let out = text
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement)
  return out
}

/** A copy of `value` with every string scrubbed. Objects and arrays are walked; cycles are cut. */
export function scrubDeep<T>(value: T, seen = new WeakSet<object>(), depth = 0): T {
  if (typeof value === 'string') return scrubText(value) as T
  if (value === null || typeof value !== 'object') return value
  if (depth > 20 || seen.has(value)) return '[cut]' as T
  seen.add(value)
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, seen, depth + 1)) as T
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) out[k] = scrubDeep(v, seen, depth + 1)
  return out as T
}
