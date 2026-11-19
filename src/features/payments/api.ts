import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { portfolioKeys } from '@/features/properties/api'
import { invokeFunction } from '@/lib/functions'
import { supabase } from '@/lib/supabase'

export const METHOD_LABEL: Record<string, string> = { link: 'Online', cash: 'Cash', transfer: 'Transfer' }

const paymentKeys = {
  tenant: (tenantId: string) => [...portfolioKeys.all, 'payments', 'tenant', tenantId] as const,
  since: (sinceIso: string) => [...portfolioKeys.all, 'payments', 'since', sinceIso] as const,
  reminders: (tenantId: string) => [...portfolioKeys.all, 'reminders', tenantId] as const,
}

function useInvalidatePortfolio() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: portfolioKeys.all })
}

/** All of a tenant's payments (voided ones included, for the audit trail), newest first. */
export function useTenantPayments(tenantId: string) {
  return useQuery({
    queryKey: paymentKeys.tenant(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_overview')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('paid_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Valid (non-voided) payments since a moment, newest first. Used by the dashboard. */
export function usePaymentsSince(sinceIso: string) {
  return useQuery({
    queryKey: paymentKeys.since(sinceIso),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_overview')
        .select('*')
        .is('voided_at', null)
        .gte('paid_at', sinceIso)
        .order('paid_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export type ManualPayment = {
  chargeId: string
  amountKobo: number
  method: 'cash' | 'transfer'
  paidOn: string
  note: string
}

export function useRecordPayment() {
  const invalidate = useInvalidatePortfolio()
  return useMutation({
    mutationFn: async (p: ManualPayment) => {
      const { error } = await supabase.rpc('record_manual_payment', {
        p_charge_id: p.chargeId,
        p_amount_kobo: p.amountKobo,
        p_method: p.method,
        p_paid_on: p.paidOn,
        p_note: p.note,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useVoidPayment() {
  const invalidate = useInvalidatePortfolio()
  return useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const { error } = await supabase.rpc('void_payment', { p_payment_id: paymentId, p_reason: reason })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/** Reminders queued or sent for a tenant's charges, newest first. */
export function useTenantReminders(tenantId: string) {
  return useQuery({
    queryKey: paymentKeys.reminders(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('id, kind, channel, scheduled_for, message, status, sent_at, rent_charges!inner(tenant_id)')
        .eq('rent_charges.tenant_id', tenantId)
        .order('scheduled_for', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data
    },
  })
}

/** Send one WhatsApp reminder now, from RentPadi's WhatsApp number (send-reminder-now). */
export function useSendReminderNow(tenantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => invokeFunction<{ status: 'sent'; to: string }>('send-reminder-now', { tenant_id: tenantId }),
    // Sent or failed, the attempt is in the reminder list now.
    onSettled: () => qc.invalidateQueries({ queryKey: paymentKeys.reminders(tenantId) }),
  })
}
