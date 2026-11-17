type DbError = { code?: string; message?: string }

/**
 * Turn a Supabase/Postgres error into something a landlord can act on.
 * Pass overrides for the constraint errors a given form can hit.
 */
export function friendlyError(
  err: unknown,
  overrides: { unique?: string; inUse?: string } = {},
): string {
  const e = (err ?? {}) as DbError
  if (e.code === '23505') return overrides.unique ?? 'That already exists.'
  if (e.code === '23503') return overrides.inUse ?? 'This is still in use, so it cannot be removed.'
  if (e.code === '23514') return 'Some details are not valid. Please check the form.'
  if (e.message === 'Failed to fetch') return 'No connection. Check your internet and try again.'
  return e.message || 'Something went wrong. Please try again.'
}
