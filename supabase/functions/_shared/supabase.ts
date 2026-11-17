import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.119.0'
import { requireEnv, UserError } from './http.ts'

/** Service-role client: bypasses RLS. Only use after checking who is allowed to do what. */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** The signed-in user calling this function, from their Authorization: Bearer <jwt> header. */
export async function requireUser(req: Request, admin: SupabaseClient): Promise<User> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new UserError('Please sign in again.', 401)
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new UserError('Please sign in again.', 401)
  return data.user
}
