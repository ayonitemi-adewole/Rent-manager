import { useMutation, useQuery } from '@tanstack/react-query'
import type { ChargeTiming, ChargeStatus } from '@/lib/charges'
import { invokeFunction } from '@/lib/functions'
import { supabase } from '@/lib/supabase'

export type PortalCharge = {
  id: string
  period_start: string
  period_end: string
  due_date: string
  amount_kobo: number
  amount_paid_kobo: number
  balance_kobo: number
  status: ChargeStatus
  timing: ChargeTiming
  days_until_due: number
}

export type Portal = {
  tenant_name: string
  unit_label: string
  property_name: string
  landlord_name: string
  payout_bank: string | null
  payout_account_last4: string | null
  can_pay_online: boolean
  charges: PortalCharge[]
  receipts: { receipt_number: string; receipt_token: string; amount_kobo: number; paid_at: string }[]
}

/** The tenant's page data, by their secret link token. null = invalid link. */
export function usePortal(token: string) {
  return useQuery({
    queryKey: ['portal', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tenant_portal', { p_token: token })
      if (error) throw error
      return (data as Portal | null) ?? null
    },
  })
}

/** Start a Flutterwave checkout for one charge and send the tenant there. */
export function useStartCheckout(token: string) {
  return useMutation({
    mutationFn: async (chargeId: string) => {
      const { link } = await invokeFunction<{ link: string }>('flw-checkout', { token, charge_id: chargeId })
      window.location.assign(link)
    },
  })
}

export type VerifyOutcome = 'recorded' | 'pending' | 'failed' | 'not_found' | 'ignored'

export function useVerifyPayment(token: string, txRef: string | null, transactionId: string | null) {
  return useQuery({
    queryKey: ['verify', txRef],
    enabled: Boolean(txRef),
    retry: 1,
    // Flutterwave can take a moment to mark a transfer successful: keep checking while pending.
    refetchInterval: (q) => (q.state.data?.outcome === 'pending' ? 4000 : false),
    queryFn: () =>
      invokeFunction<{ outcome: VerifyOutcome; reason?: string }>('flw-verify', {
        token,
        tx_ref: txRef,
        transaction_id: transactionId,
      }),
  })
}
