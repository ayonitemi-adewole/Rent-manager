import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { isSupabaseConfigured } from '@/lib/env'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // Phones get shared: never show the previous user's cached data.
      if (event === 'SIGNED_OUT') queryClient.clear()
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return <AuthContext value={{ session, loading, signOut }}>{children}</AuthContext>
}
