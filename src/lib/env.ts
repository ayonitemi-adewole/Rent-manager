export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  flwPublicKey: import.meta.env.VITE_FLW_PUBLIC_KEY as string | undefined,
  /** RentPadi's WhatsApp Business number (E.164), shown to tenants once WhatsApp is live. */
  whatsappNumber: import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined,
}

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
