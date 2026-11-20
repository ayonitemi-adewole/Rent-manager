export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  /** Paystack public key (pk_test_… or pk_live_…). Only used to show test-mode hints. */
  paystackPublicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined,
  /** RentPadi's WhatsApp Business number (E.164), shown to tenants once WhatsApp is live. */
  whatsappNumber: import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined,
  /** Where landlords and tenants reach RentPadi (Terms and Privacy pages). */
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL as string | undefined,
  /** Sentry project DSN for the app. Unset: no error reporting. */
  sentryDsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  /** e.g. "production" or "preview". Defaults to Vite's mode. */
  sentryEnvironment: import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined,
}

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
