import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { TERMS_VERSION } from '@/lib/legal'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

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

/** No profile yet, no email, or the terms changed since they last accepted. */
export function needsOnboarding(landlord: Tables<'landlords'> | null | undefined): boolean {
  return !landlord || !landlord.email || landlord.terms_version !== TERMS_VERSION
}

export type ProfileValues = { fullName: string; displayName: string; email: string }

/** Create the profile (or bring it up to date) and record acceptance of the current terms. */
export function useCompleteOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fullName, displayName, email }: ProfileValues) => {
      const { error } = await supabase.rpc('complete_onboarding', {
        p_full_name: fullName,
        p_display_name: displayName,
        p_email: email,
        p_terms_version: TERMS_VERSION,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: landlordKey }),
  })
}

/** Edit name, tenant-facing name and email from Settings. */
export function useUpdateProfile() {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async ({ fullName, displayName, email }: ProfileValues) => {
      if (!session) throw new Error('You are signed out. Please sign in again.')
      const { error } = await supabase
        .from('landlords')
        .update({ full_name: fullName, display_name: displayName.trim() || null, email: email.trim().toLowerCase() })
        .eq('id', session.user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: landlordKey }),
  })
}

/** Settings switch: also send reminders and receipts on WhatsApp (alongside SMS). */
export function useSetWhatsappReminders() {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (on: boolean) => {
      if (!session) throw new Error('You are signed out. Please sign in again.')
      const { error } = await supabase.from('landlords').update({ whatsapp_reminders: on }).eq('id', session.user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: landlordKey }),
  })
}
