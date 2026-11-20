import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { portfolioKeys } from '@/features/properties/api'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

/** What the signed-in landlord's plan includes right now (public.landlord_entitlements). */
export type Entitlements = Database['public']['Functions']['my_entitlements']['Returns'][number]

// Under 'portfolio' so adding or removing units refreshes units_used.
export const entitlementsKey = [...portfolioKeys.all, 'entitlements'] as const

export function useEntitlements() {
  const { session } = useAuth()
  return useQuery({
    queryKey: entitlementsKey,
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_entitlements').maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/**
 * Whether the plan includes a feature, for showing or hiding buttons. While loading, or if the
 * plan can't be read, this says yes: the server enforces the real rule, so the app never blocks
 * something the landlord is entitled to.
 */
export function useFeature(feature: 'whatsapp_reminders'): boolean {
  const { data } = useEntitlements()
  return data ? data[feature] : true
}
