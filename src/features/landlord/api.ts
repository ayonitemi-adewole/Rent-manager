import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'

export const landlordKey = ['landlord'] as const

/** The signed-in landlord's profile, or null if they haven't finished onboarding. */
export function useLandlord() {
  const { session } = useAuth()
  return useQuery({
    queryKey: landlordKey,
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase.from('landlords').select('*').maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Create or update the signed-in landlord's profile. */
export function useSaveLandlord() {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async ({ fullName }: { fullName: string }) => {
      if (!session) throw new Error('You are signed out. Please sign in again.')
      const { error } = await supabase
        .from('landlords')
        .upsert({ id: session.user.id, full_name: fullName })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: landlordKey }),
  })
}
