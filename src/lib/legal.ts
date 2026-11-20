import { env } from './env'

/**
 * Version of the Terms and Privacy notice. Change it whenever either page changes in
 * substance: every landlord is then asked to accept again before using the app.
 */
export const TERMS_VERSION = '2026-11-20'

/**
 * Where landlords and tenants reach RentPadi about their data. Set VITE_SUPPORT_EMAIL (and the
 * website's SUPPORT_EMAIL) to the same monitored mailbox; the default is used when it's unset.
 */
export const SUPPORT_EMAIL = env.supportEmail?.trim() || 'rentpadiii@gmail.com'
