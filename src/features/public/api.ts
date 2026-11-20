import { useMutation, useQuery } from '@tanstack/react-query'
import type { ChargeTiming, ChargeStatus } from '@/lib/charges'
import { publicFunction, publicRpc } from '@/lib/public-api'

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
    queryFn: async () => (await publicRpc<Portal | null>('tenant_portal', { p_token: token })) ?? null,
  })
}

/** Start a Paystack checkout for one charge and send the tenant there. */
export function useStartCheckout(token: string) {
  return useMutation({
    mutationFn: async (chargeId: string) => {
      const { link } = await publicFunction<{ link: string }>('pay-checkout', { token, charge_id: chargeId })
      window.location.assign(link)
    },
  })
}

export type VerifyOutcome = 'recorded' | 'pending' | 'failed' | 'not_found' | 'ignored'

export function useVerifyPayment(token: string, reference: string | null) {
  return useQuery({
    queryKey: ['verify', reference],
    enabled: Boolean(reference),
    retry: 1,
    // Paystack can take a moment to confirm a bank transfer: keep checking while pending.
    refetchInterval: (q) => (q.state.data?.outcome === 'pending' ? 4000 : false),
    queryFn: () =>
      publicFunction<{ outcome: VerifyOutcome; reason?: string }>('pay-verify', { token, reference }),
  })
}
