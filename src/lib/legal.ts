import { env } from './env'

/**
 * Version of the Terms and Privacy notice. Change it whenever either page changes in
 * substance: every landlord is then asked to accept again before using the app.
 * Format: the date (YYYY-MM-DD, shown as "Last updated"), plus ".2", ".3"… for a second
 * change on the same day. At most 20 characters (database check).
 */
export const TERMS_VERSION = '2026-11-20.2'

/** The date part of TERMS_VERSION, for "Last updated". */
export const TERMS_DATE = TERMS_VERSION.slice(0, 10)

/**
 * Where landlords and tenants reach RentPadi about their data. Set VITE_SUPPORT_EMAIL (and the
 * website's SUPPORT_EMAIL) to the same monitored mailbox; the default is used when it's unset.
 */
export const SUPPORT_EMAIL = env.supportEmail?.trim() || 'rentpadiii@gmail.com'
