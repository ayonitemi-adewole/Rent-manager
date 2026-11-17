import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { env, isSupabaseConfigured } from './env'

// When env vars are missing we still create a client (pointing nowhere) so imports
// don't crash; the app shows a setup screen instead of making calls.
export const supabase = createClient<Database>(
  isSupabaseConfigured ? env.supabaseUrl! : 'http://localhost:54321',
  isSupabaseConfigured ? env.supabaseAnonKey! : 'missing-anon-key',
)
